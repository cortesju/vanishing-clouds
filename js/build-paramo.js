// ============================================================
// VANISHING CLOUDS — build-paramo.js
// "Build a Páramo" interactive suitability explorer.
//
// Manages its own map overlays independently from maps.js's
// PANEL_LAYERS system. Overlays are created once at init and
// toggled on/off as the user interacts with the panel.
// ============================================================

// ============================================================
// PLACEHOLDER RASTER TILE URLs
// Replace each constant with a real tile service URL when ready.
// Supported formats:
//   TileLayer (recommended): 'https://your-server.com/tiles/{z}/{x}/{y}.png'
//   ImageOverlay (static):   'https://your-server.com/colombia-layer.png'
// When null, a clearly-labelled placeholder rectangle is used.
// ============================================================
const ELEVATION_LAYER_URL        = 'https://tiles.arcgis.com/tiles/ZIL9uO234SBBPGL7/arcgis/rest/services/DEMScore/MapServer';
const PRECIPITATION_LAYER_URL    = 'https://tiles.arcgis.com/tiles/ZIL9uO234SBBPGL7/arcgis/rest/services/Precipitationcore/MapServer';
const MEAN_TEMP_LAYER_URL        = 'https://tiles.arcgis.com/tiles/ZIL9uO234SBBPGL7/arcgis/rest/services/MEANtemScore/MapServer';
const CLIMATE_LAYER_URL          = 'https://tiles.arcgis.com/tiles/ZIL9uO234SBBPGL7/arcgis/rest/services/ClimateScore/MapServer';
const EQUATORIAL_LAYER_URL       = null;  // No raster published — rendered as SVG latitudinal gradient
const SUITABILITY_COMPOSITE_URL  = 'https://tiles.arcgis.com/tiles/ZIL9uO234SBBPGL7/arcgis/rest/services/Map1/MapServer';
// Note: official páramo polygons are already loaded via PARAMO_FEATURE_URL in maps.js

// ---- ArcGIS Online API key (optional) ----
// The MapServer services above must be EITHER:
//   A) Shared as "Everyone" (public) in ArcGIS Online — leave token null, no auth needed.
//      ArcGIS Online → Content → [item] → Share → Everyone ✓ → Save
//   B) A valid API key from developers.arcgis.com pasted as a string below.
//
// WHY THIS MATTERS: L.esri.tiledMapLayer() fetches ?f=json before loading tiles.
// Private services return 499 Token Required on that call → layer silently fails.
// We bypass this by using L.tileLayer() with the explicit ArcGIS tile URL pattern
// (/tile/{z}/{y}/{x}), which goes straight to tile requests. Tiles still need to
// be publicly accessible (or the token appended) to actually render.
const ARCGIS_TOKEN = null;

// Bounding box covering all of Colombia (used for placeholder rectangles)
const _BP_BOUNDS = [[-4.2, -79.2], [12.5, -66.8]];

// Global equatorial suitability band: 11°N → 5°S, worldwide longitude.
// Used by the Equatorial Influence overlay to represent the tropical latitude zone.
// Equator (0°) sits 5/16 = 31.25% from bottom = 68.75% from top of this bbox.
const _EQ_BOUNDS = [[-5, -180], [11, 180]];

// ============================================================
// LAYER CONFIGURATION
// Each entry maps to one interactive card in the panel.
// ============================================================
const BUILD_LAYERS_CONFIG = [
  {
    id:      'elevation',
    icon:    '⛰',
    name:    'Elevation',
    label:   'High tropical mountains · ≥ 2,800 m',
    desc:    'Páramos form above the Andean tree line, typically between 2,800 m and 5,000 m. Elevation controls temperature, UV intensity, and atmospheric pressure — it is the physical stage on which every other condition plays out. Without altitude, the other factors cannot exist in their páramo form.',
    color:   '#546E7A',   // blue-gray — topographic / rock
    url:     ELEVATION_LAYER_URL,
    opacity: 0.82,
  },
  {
    id:      'temperature',
    icon:    '🌡',
    name:    'Temperature',
    label:   'Cold but not permanently frozen · 2 – 10 °C',
    desc:    'Mean annual temperatures between 2 °C and 10 °C define the thermal niche of páramo life. Unlike polar environments, páramos experience freeze-thaw cycles daily, not seasonally — temperatures can swing 20 °C in 24 hours, compressing a whole year of climate variation into a single day.',
    color:   '#3949AB',   // indigo — cold
    url:     MEAN_TEMP_LAYER_URL,
    opacity: 0.82,
  },
  {
    id:      'precipitation',
    icon:    '🌧',
    name:    'Precipitation & Moisture',
    label:   'Wet, cloudy, humid · 700 – 3,000 mm / yr',
    desc:    'Persistent cloud cover and high annual rainfall keep páramo soils perpetually saturated. Frailejones — the iconic giant rosette plants — capture cloud moisture through their woolly leaves and channel it into Colombia\'s river systems, supplying water to 48 million people downstream.',
    color:   '#1565C0',   // deep blue — rain
    url:     PRECIPITATION_LAYER_URL,
    opacity: 0.82,
  },
  {
    id:            'equatorial',
    icon:          '🌐',
    name:          'Equatorial Influence',
    label:         'Tropical latitude · Near the equator',
    desc:          'Páramos exist where extreme elevation meets tropical latitude. Near the equator, solar radiation remains intense year-round and seasonal variation is low. When these tropical conditions are lifted above 3,000 m in the Andes, unique alpine ecosystems emerge with dramatic day-night temperature swings, persistent cloud formation, and specialized biodiversity found nowhere else on Earth.',
    color:         '#C8A840',   // warm gold — solar / equatorial
    url:           EQUATORIAL_LAYER_URL,
    opacity:       1.0,         // SVG handles its own opacity via gradient stops
    customFactory: _createEquatorialOverlay,  // hoisted function — always available
  },
  {
    id:      'seasonality',
    icon:    '☁',
    name:    'Climate Seasonality',
    label:   'Unique tropical alpine conditions',
    desc:    'Tropical latitude means no astronomical winter — yet high altitude brings intense UV radiation, thin air, and nightly frost. This paradox of simultaneous extremes, found nowhere else on Earth, shaped every organism living in the páramo into something wholly original.',
    color:   '#6A1B9A',   // purple — atmosphere
    url:     CLIMATE_LAYER_URL,
    opacity: 0.82,
  },
];

// ============================================================
// SCORE LAYER GROUPS
// Score layers are mutually exclusive — turning one on turns off
// the previously active one.  Equatorial is independently stackable.
// ============================================================
const _SCORE_LAYER_IDS = ['elevation', 'temperature', 'precipitation', 'seasonality'];

// ============================================================
// LEGEND CONFIGURATION
// One entry per toggleable layer + composite.
// ============================================================
// Legend color ramps are matched to the ArcGIS Pro symbology for each layer.
// All score layers use 1 (low suitability) → 5 (highest suitability).
const BP_LEGEND_CONFIG = {
  // DEM Score: pale aqua/cyan → teal → dark teal (matches AGO symbology)
  elevation: {
    title:  '⛰ Elevation Score',
    bar:    'linear-gradient(to right, #B2EBF2, #26C6DA, #00695C)',
    labels: ['1 · Low', '3 · Moderate', '5 · Optimal'],
    desc:   'Score 5 = optimal Andean highland zone (≥ 2,800 m above the tree line).',
  },
  // Mean Annual Temperature Score: pale gray → steel blue → deep indigo
  temperature: {
    title:  '🌡 Temperature Score',
    bar:    'linear-gradient(to right, #ECEFF1, #5C6BC0, #1A237E)',
    labels: ['1 · Low', '3 · Moderate', '5 · Optimal'],
    desc:   'Score 5 = optimal páramo thermal range (2–10 °C). Too warm or too cold scores 1.',
  },
  // Precipitation Score: pale yellow/tan → green → blue-teal (matches AGO symbology)
  precipitation: {
    title:  '🌧 Precipitation Score',
    bar:    'linear-gradient(to right, #FFF9C4, #81C784, #0277BD)',
    labels: ['1 · Dry', '3 · Moderate', '5 · Very wet'],
    desc:   'Score 5 = strong cloud-moisture suitability (700–3,000 mm yr⁻¹). Arid zones score 1.',
  },
  // Climate Score: black/dark brown → olive/brown → bright green (matches AGO symbology)
  seasonality: {
    title:  '☁ Climate Score',
    bar:    'linear-gradient(to right, #1A1A1A, #795548, #2E7D32)',
    labels: ['1 · Low', '3 · Moderate', '5 · Highest'],
    desc:   'Score 5 = highest combined temperature + precipitation alignment for páramo conditions.',
  },
  // Equatorial Influence: warm gold gradient — not an AGO raster, generated SVG overlay
  equatorial: {
    title:  '🌐 Equatorial Influence',
    bar:    'linear-gradient(to right, rgba(200,168,64,0.06), rgba(200,168,64,0.40), rgba(200,168,64,0.06))',
    labels: ['Far from equator', 'Tropical belt', 'Equator 0°'],
    desc:   'Highest influence at 0° latitude where tropical solar radiation is most intense year-round.',
  },
  // Final Suitability Composite: dark navy → gray/tan → yellow/gold (matches AGO symbology)
  composite: {
    title:  '◎ Páramo Suitability',
    bar:    'linear-gradient(to right, #0A1628, #90A4AE, #F9A825)',
    labels: ['1 · Low', '3 · Moderate', '5 · Highest'],
    desc:   'Combined score — areas where all five conditions align for optimal páramo formation.',
  },
};

// ============================================================
// STATE
// ============================================================
let _bpMap              = null;    // reference to window.map (Leaflet)
let _bpLayerEls         = {};      // id → { overlay: Leaflet layer, active: boolean }
let _bpCompositeOn      = false;
let _bpCompareOn        = false;
let _bpCompositeLayer   = null;    // created lazily
let _bpInitialized      = false;
let _bpActiveScoreLayer = null;    // id of the currently-active score layer, or null
let _bpLegendEl         = null;    // floating legend DOM element
let _bpBasemapState     = null;    // snapshot of basemap visibility before simplification

// ============================================================
// OVERLAY FACTORIES
// ============================================================

// True for ArcGIS tiled MapServer URLs (ending in /MapServer, no {z} template).
function _isEsriMapServer(url) {
  return typeof url === 'string' && /\/MapServer\/?$/.test(url);
}

// Build a Leaflet tile layer for an ArcGIS MapServer service.
//
// WHY NOT L.esri.tiledMapLayer():
//   esri-leaflet GETs "{url}?f=json" before loading tiles. Private services
//   return 499 Token Required on that call → the layer silently never loads.
//
// SOLUTION — bypass the metadata fetch:
//   Use L.tileLayer() with the explicit ArcGIS tile URL pattern /tile/{z}/{y}/{x}.
//   Note: ArcGIS row=y, col=x so the template is {z}/{y}/{x} NOT {z}/{x}/{y}.
//
// TOKEN SUPPORT:
//   When ARCGIS_TOKEN is set, it is appended to every tile request so private
//   services also work. When null, services must be publicly shared.
function _makeAgoTileLayer(serviceUrl, opacity) {
  const tokenSuffix = ARCGIS_TOKEN ? `?token=${ARCGIS_TOKEN}` : '';
  return L.tileLayer(serviceUrl + '/tile/{z}/{y}/{x}' + tokenSuffix, {
    opacity:        opacity,
    tileSize:       256,
    attribution:    '',
    // maxNativeZoom: clamp tile requests to LODs the service has cached.
    // ArcGIS Online regional rasters are typically cached to LOD 11–13.
    // Leaflet scales up the highest cached tile if the map zooms past this.
    maxNativeZoom:  11,
    // Silently skip tiles outside the cached LOD range (no error tile shown).
    errorTileUrl:   '',
  });
}

function _createLayerOverlay(cfg) {
  if (cfg.url) {
    if (_isEsriMapServer(cfg.url)) {
      return _makeAgoTileLayer(cfg.url, cfg.opacity);
    }
    if (cfg.url.includes('{z}')) {
      return L.tileLayer(cfg.url, { opacity: cfg.opacity, attribution: '' });
    }
    return L.imageOverlay(cfg.url, _BP_BOUNDS, { opacity: cfg.opacity });
  }
  if (cfg.customFactory) {
    return cfg.customFactory();
  }
  // Fallback: translucent colored rectangle
  return L.rectangle(_BP_BOUNDS, {
    color:       cfg.color,
    fillColor:   cfg.color,
    fillOpacity: cfg.opacity * 0.85,
    weight:      0,
    interactive: false,
  });
}

// Equatorial influence — returns a LayerGroup containing:
//   1. worldwide SVG gradient ImageOverlay (latitude band)
//   2. thin equator reference polyline at 0°
//   3. "0° · Equator" DivIcon label
//
// Bounds: _EQ_BOUNDS = [[-5°S, -180°], [11°N, 180°]] (full equatorial belt).
// Equator (0°) sits 5/16 = 31.25% from bottom = 68.75% from top of the bbox.
// Gradient peaks at the 69% stop; opacity boosted from 0.30 → 0.35 for visibility.
function _createEquatorialOverlay() {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">',
    '  <defs>',
    '    <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">',
    // 11°N — top edge
    '      <stop offset="0%"   stop-color="#D4AE38" stop-opacity="0.00"/>',
    '      <stop offset="20%"  stop-color="#C8A840" stop-opacity="0.06"/>',
    '      <stop offset="45%"  stop-color="#C8A840" stop-opacity="0.16"/>',
    // ~1.5°N — approaching equatorial peak
    '      <stop offset="60%"  stop-color="#D4AE38" stop-opacity="0.28"/>',
    // 0° equator — maximum suitability (68.75% from top ≈ 69%)
    '      <stop offset="69%"  stop-color="#D4AE38" stop-opacity="0.35"/>',
    // 2°S — still highly tropical
    '      <stop offset="78%"  stop-color="#C8A840" stop-opacity="0.26"/>',
    '      <stop offset="90%"  stop-color="#C8A840" stop-opacity="0.12"/>',
    // 5°S — bottom edge
    '      <stop offset="100%" stop-color="#B89830" stop-opacity="0.00"/>',
    '    </linearGradient>',
    '  </defs>',
    '  <rect width="100" height="100" fill="url(#eq)"/>',
    '</svg>',
  ].join('');

  const dataUrl = 'data:image/svg+xml;base64,' + btoa(svg);

  const imageOverlay = L.imageOverlay(dataUrl, _EQ_BOUNDS, {
    opacity:     1.0,
    interactive: false,
    className:   'bp-equatorial-overlay',
  });

  // Thin dashed reference line along the equator (lat 0°)
  const equatorLine = L.polyline([[0, -180], [0, 180]], {
    color:       '#C8A840',
    weight:      1,
    opacity:     0.40,
    dashArray:   '3 10',
    interactive: false,
  });

  // Text label — placed over open Atlantic (lng -50) so it's visible at
  // the default Build a Páramo view (zoom 4, center [3.5, -73])
  const equatorLabel = L.marker([0, -50], {
    icon: L.divIcon({
      className:  'bp-equator-label',
      html:       '<span>0° · Equator</span>',
      iconSize:   [90, 16],
      iconAnchor: [45, 8],   // center both axes on the marker point
    }),
    interactive: false,
    keyboard:    false,
  });

  return L.layerGroup([imageOverlay, equatorLine, equatorLabel]);
}

function _createCompositeOverlay() {
  if (SUITABILITY_COMPOSITE_URL) {
    if (_isEsriMapServer(SUITABILITY_COMPOSITE_URL)) {
      return _makeAgoTileLayer(SUITABILITY_COMPOSITE_URL, 0.88);
    }
    if (SUITABILITY_COMPOSITE_URL.includes('{z}')) {
      return L.tileLayer(SUITABILITY_COMPOSITE_URL, { opacity: 0.88, attribution: '' });
    }
    return L.imageOverlay(SUITABILITY_COMPOSITE_URL, _BP_BOUNDS, { opacity: 0.88 });
  }
  // Fallback placeholder: gold dashed rectangle
  return L.rectangle(_BP_BOUNDS, {
    color:       '#C8A840',
    fillColor:   '#D4AE38',
    fillOpacity: 0.22,
    weight:      2.5,
    dashArray:   '8 5',
    interactive: false,
  });
}

// ============================================================
// BASEMAP SIMPLIFICATION
// When a score layer (or the composite) is active, the detailed
// basemap visually competes with the raster data.  We auto-hide
// hillshade, labels/roads, and water/urban detail, restoring
// them exactly when the last score layer (and composite) is off.
//
// Implementation notes:
//   • _bpBasemapState is null while the basemap is NOT simplified.
//   • window.setBasemapVisible is exposed by maps.js and covers all
//     three layers via the 'hillshade' / 'vectortiles' / 'detail' keys.
//   • We read visibility from the DOM (style.display !== 'none') rather
//     than maps.js private variables so we handle any previous user state.
// ============================================================

function _captureBasemapState() {
  const h = document.getElementById('hillshade-gl');
  const v = document.getElementById('vector-tile-gl');
  const d = document.getElementById('detail-tile-gl');
  return {
    hillshade:   !h || h.style.display   !== 'none',
    vectorTiles: !v || v.style.display   !== 'none',
    detail:      !d || d.style.display   !== 'none',
  };
}

// Returns true while any score layer OR the composite is active.
function _needsSimplifiedBasemap() {
  return _bpActiveScoreLayer !== null || _bpCompositeOn;
}

// Capture current state then hide the decorative basemap layers.
// Guard: does nothing if already simplified (state already captured).
function _simplifyBasemap() {
  if (_bpBasemapState) return;
  _bpBasemapState = _captureBasemapState();
  if (typeof window.setBasemapVisible !== 'function') return;
  window.setBasemapVisible('hillshade',   false);
  window.setBasemapVisible('vectortiles', false);
  window.setBasemapVisible('detail',      false);
}

// Restore basemap to the state captured before simplification.
// Guard: does nothing if never simplified (state is null).
function _restoreBasemap() {
  if (!_bpBasemapState) return;
  if (typeof window.setBasemapVisible === 'function') {
    window.setBasemapVisible('hillshade',   _bpBasemapState.hillshade);
    window.setBasemapVisible('vectortiles', _bpBasemapState.vectorTiles);
    window.setBasemapVisible('detail',      _bpBasemapState.detail);
  }
  _bpBasemapState = null;
}

// ============================================================
// LAYER MANAGEMENT
// ============================================================

function _getActiveLayers() {
  return BUILD_LAYERS_CONFIG.filter(l => _bpLayerEls[l.id]?.active);
}

// ============================================================
// FLOATING LEGEND — one at a time, bottom-right of map
// ============================================================

function _getOrCreateLegendEl() {
  if (_bpLegendEl) return _bpLegendEl;
  const el = document.createElement('div');
  el.className = 'bp-legend';
  el.style.display = 'none';
  document.getElementById('map-main')?.appendChild(el);
  _bpLegendEl = el;
  return el;
}

function _showLegend(id) {
  const cfg = BP_LEGEND_CONFIG[id];
  if (!cfg) { _hideLegend(); return; }
  const el = _getOrCreateLegendEl();
  el.innerHTML =
    `<div class="bp-legend-title">${cfg.title}</div>` +
    `<div class="bp-legend-bar" style="background:${cfg.bar}"></div>` +
    `<div class="bp-legend-labels">${cfg.labels.map(l => `<span>${l}</span>`).join('')}</div>` +
    (cfg.desc ? `<div class="bp-legend-desc">${cfg.desc}</div>` : '');
  el.style.display = '';
}

function _hideLegend() {
  if (_bpLegendEl) _bpLegendEl.style.display = 'none';
}

// Determine which legend to show based on current state:
// composite > active score layer > equatorial > nothing
function _updateLegendForCurrentState() {
  if (_bpCompositeOn) { _showLegend('composite'); return; }
  if (_bpActiveScoreLayer) { _showLegend(_bpActiveScoreLayer); return; }
  if (_bpLayerEls['equatorial']?.active) { _showLegend('equatorial'); return; }
  _hideLegend();
}

function _updatePanelUI() {
  const count = _getActiveLayers().length;

  // Count badge
  const badge = document.getElementById('bp-layer-count');
  if (badge) {
    badge.textContent = count === 0
      ? 'No layers active'
      : `${count} layer${count === 1 ? '' : 's'} active`;
    badge.dataset.count = count;
  }

  // Composite button — enabled when ≥2 layers are active (or already on)
  const btn = document.getElementById('bp-composite-btn');
  if (btn) {
    const canComposite = count >= 2 || _bpCompositeOn;
    btn.disabled = !canComposite;
    btn.title = canComposite ? '' : 'Activate at least 2 environmental layers first';
  }
}

function _buildLayerOn(id) {
  const state = _bpLayerEls[id];
  if (!state || !_bpMap) return;

  // One-at-a-time: if a different score layer is already active, turn it off first
  if (_SCORE_LAYER_IDS.includes(id) && _bpActiveScoreLayer && _bpActiveScoreLayer !== id) {
    const prevId    = _bpActiveScoreLayer;
    const prevState = _bpLayerEls[prevId];
    if (prevState) {
      prevState.active = false;
      if (prevState.overlay && _bpMap.hasLayer(prevState.overlay)) {
        _bpMap.removeLayer(prevState.overlay);
      }
    }
    // Sync DOM for the previously-active card
    const prevToggle = document.getElementById(`bp-toggle-${prevId}`);
    if (prevToggle) prevToggle.checked = false;
    document.getElementById(`bp-card-${prevId}`)?.classList.remove('active');
    _bpActiveScoreLayer = null;
  }

  state.active = true;
  if (_SCORE_LAYER_IDS.includes(id)) _bpActiveScoreLayer = id;

  if (!_bpCompositeOn) {
    if (!_bpMap.hasLayer(state.overlay)) state.overlay.addTo(_bpMap);
  }

  // Simplify basemap the first time a score layer activates
  if (_SCORE_LAYER_IDS.includes(id)) _simplifyBasemap();

  _showLegend(id);
  _updatePanelUI();
}

function _buildLayerOff(id) {
  const state = _bpLayerEls[id];
  if (!state || !_bpMap) return;
  state.active = false;
  if (_SCORE_LAYER_IDS.includes(id) && _bpActiveScoreLayer === id) {
    _bpActiveScoreLayer = null;
  }
  if (state.overlay && _bpMap.hasLayer(state.overlay)) {
    _bpMap.removeLayer(state.overlay);
  }
  // Restore basemap once no score layers and no composite are active
  if (!_needsSimplifiedBasemap()) _restoreBasemap();
  _updateLegendForCurrentState();
  _updatePanelUI();
}

// ============================================================
// COMPOSITE ON / OFF
// ============================================================
function _setComposite(on) {
  _bpCompositeOn = on;
  if (!_bpMap) return;

  const btn    = document.getElementById('bp-composite-btn');
  const interp = document.getElementById('bp-interpretation');

  if (on) {
    // Hide individual overlays
    BUILD_LAYERS_CONFIG.forEach(l => {
      const st = _bpLayerEls[l.id];
      if (st?.overlay && _bpMap.hasLayer(st.overlay)) _bpMap.removeLayer(st.overlay);
    });
    // Show composite
    if (!_bpCompositeLayer) _bpCompositeLayer = _createCompositeOverlay();
    if (!_bpMap.hasLayer(_bpCompositeLayer)) _bpCompositeLayer.addTo(_bpMap);
    // If compare is on, keep paramoFill on top
    if (_bpCompareOn && window.LG?.paramoFill) {
      if (!_bpMap.hasLayer(window.LG.paramoFill)) window.LG.paramoFill.addTo(_bpMap);
      window.LG.paramoFill.bringToFront?.();
    }
    // Composite is also a raster — simplify the basemap
    _simplifyBasemap();
    // UI
    if (btn) {
      btn.classList.add('active');
      btn.innerHTML = '<span class="bp-composite-icon">✕</span> Hide Composite';
    }
    interp?.classList.remove('hidden');

  } else {
    // Remove composite
    if (_bpCompositeLayer && _bpMap.hasLayer(_bpCompositeLayer)) {
      _bpMap.removeLayer(_bpCompositeLayer);
    }
    // Restore active individual overlays
    BUILD_LAYERS_CONFIG.forEach(l => {
      const st = _bpLayerEls[l.id];
      if (st?.active && st.overlay && !_bpMap.hasLayer(st.overlay)) {
        st.overlay.addTo(_bpMap);
      }
    });
    // Restore basemap if no score layers are active either
    if (!_needsSimplifiedBasemap()) _restoreBasemap();
    // UI
    if (btn) {
      btn.classList.remove('active');
      btn.innerHTML = '<span class="bp-composite-icon">◎</span> Show Suitability Composite';
    }
    interp?.classList.add('hidden');
  }

  _updateLegendForCurrentState();
  _updatePanelUI();
}

// ============================================================
// COMPARE WITH OFFICIAL PÁRAMO BOUNDARIES
// ============================================================
function _setCompare(on) {
  _bpCompareOn = on;
  if (!_bpMap || !window.LG) return;
  const pf = window.LG.paramoFill;
  if (!pf) return;
  if (on) {
    if (!_bpMap.hasLayer(pf)) pf.addTo(_bpMap);
    pf.bringToFront?.();
  } else {
    if (_bpMap.hasLayer(pf)) _bpMap.removeLayer(pf);
  }
}

// ============================================================
// RESET
// ============================================================
function _resetBuildPanel() {
  BUILD_LAYERS_CONFIG.forEach(l => {
    const toggle = document.getElementById(`bp-toggle-${l.id}`);
    if (toggle) toggle.checked = false;
    document.getElementById(`bp-card-${l.id}`)?.classList.remove('active');
    _buildLayerOff(l.id);
  });
  _bpActiveScoreLayer = null;
  if (_bpCompositeOn) _setComposite(false);
  if (_bpCompareOn) {
    const ct = document.getElementById('bp-compare-toggle');
    if (ct) ct.checked = false;
    _setCompare(false);
  }
  _restoreBasemap();   // belt-and-suspenders: ensure basemap is restored on full reset
  _hideLegend();
  _updatePanelUI();
}

// ============================================================
// WIRE PANEL CONTROLS
// Called every time the build panel HTML is injected into the DOM.
// ============================================================
function wireBuildPanel() {
  // Lazily initialize overlays on first visit
  if (!_bpInitialized) initBuildPanel();

  // Layer toggle switches — wire and restore visual state
  BUILD_LAYERS_CONFIG.forEach(l => {
    const toggle = document.getElementById(`bp-toggle-${l.id}`);
    if (!toggle) return;

    // Restore checked state from previous visit
    toggle.checked = _bpLayerEls[l.id]?.active || false;
    if (toggle.checked) {
      document.getElementById(`bp-card-${l.id}`)?.classList.add('active');
    }

    toggle.addEventListener('change', () => {
      const card = document.getElementById(`bp-card-${l.id}`);
      if (toggle.checked) {
        _buildLayerOn(l.id);
        card?.classList.add('active');
      } else {
        _buildLayerOff(l.id);
        card?.classList.remove('active');
      }
    });
  });

  // Composite button
  const compositeBtn = document.getElementById('bp-composite-btn');
  if (compositeBtn) {
    if (_bpCompositeOn) {
      compositeBtn.classList.add('active');
      compositeBtn.innerHTML = '<span class="bp-composite-icon">✕</span> Hide Composite';
    }
    compositeBtn.addEventListener('click', () => _setComposite(!_bpCompositeOn));
  }

  // Compare toggle
  const compareToggle = document.getElementById('bp-compare-toggle');
  if (compareToggle) {
    compareToggle.checked = _bpCompareOn;
    compareToggle.addEventListener('change', () => _setCompare(compareToggle.checked));
  }

  // Reset button
  document.getElementById('bp-reset-btn')?.addEventListener('click', _resetBuildPanel);

  // Restore interpretation panel visibility
  const interp = document.getElementById('bp-interpretation');
  if (interp) {
    interp.classList.toggle('hidden', !_bpCompositeOn);
  }

  // Restore legend for current state (score layer, equatorial, composite, or none)
  _updateLegendForCurrentState();

  _updatePanelUI();
}

// ============================================================
// INIT — Creates overlay objects once (idempotent).
// ============================================================
function initBuildPanel(mapInstance) {
  if (_bpInitialized) return;
  _bpMap = mapInstance || window.map;
  if (!_bpMap) return;

  BUILD_LAYERS_CONFIG.forEach(l => {
    _bpLayerEls[l.id] = {
      overlay: _createLayerOverlay(l),
      active:  false,
    };
  });

  _bpInitialized = true;
}

// ============================================================
// CLEANUP — Remove all build overlays when leaving the panel.
// State is preserved so the panel restores on next visit.
// ============================================================
function cleanupBuildPanel() {
  if (!_bpMap) return;

  BUILD_LAYERS_CONFIG.forEach(l => {
    const st = _bpLayerEls[l.id];
    if (st?.overlay && _bpMap.hasLayer(st.overlay)) _bpMap.removeLayer(st.overlay);
  });

  if (_bpCompositeLayer && _bpMap.hasLayer(_bpCompositeLayer)) {
    _bpMap.removeLayer(_bpCompositeLayer);
  }

  // Remove paramoFill if compare was on (maps.js will re-add per PANEL_LAYERS for next panel)
  if (_bpCompareOn && window.LG?.paramoFill && _bpMap.hasLayer(window.LG.paramoFill)) {
    _bpMap.removeLayer(window.LG.paramoFill);
  }

  // Always restore basemap on exit (covers the case where the user leaves without
  // manually turning off score layers, e.g. clicking a different tab)
  _restoreBasemap();

  // Hide legend — it will be re-shown when the user returns to the panel
  _hideLegend();
}

// ============================================================
// EXPOSE
// ============================================================
window.initBuildPanel    = initBuildPanel;
window.wireBuildPanel    = wireBuildPanel;
window.cleanupBuildPanel = cleanupBuildPanel;
