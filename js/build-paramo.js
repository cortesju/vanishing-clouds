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
// NOTE: Equatorial Influence is NOT listed here — it is a permanent
//       ambient layer added automatically when entering the Build tab.
//       See _bpEquatorialLayer and initBuildPanel / wireBuildPanel.
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
    color:   '#388E3C',   // green — matches AGO MEANtemScore symbology
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
    id:      'seasonality',
    icon:    '☁',
    name:    'Climate Match Score',
    label:   'Temperature + precipitation overlap',
    desc:    'This layer combines the temperature suitability score and the precipitation suitability score to show where both climate conditions align for páramo formation. High scores mean a stronger match between the ideal cool temperature range and the ideal moisture range — not simply more climate or more seasonality.',
    color:   '#6A1B9A',   // purple — combined climate index
    url:     CLIMATE_LAYER_URL,
    opacity: 0.82,
  },
];

// Highest-suitability cluster locations for composite callout markers.
// These are shown as small labelled dots when the composite layer is active
// to help users identify real-world equivalents of the highest-score zones.
const _BP_CALLOUT_CLUSTERS = [
  { latlng: [5.0,  -74.5], label: 'Northern Andes' },
  { latlng: [-0.5, -78.5], label: 'Ecuador' },
  { latlng: [-9.5, -75.5], label: 'Peru' },
  { latlng: [0.3,   35.0], label: 'East Africa' },
  { latlng: [-4.0, 137.0], label: 'New Guinea' },
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
// Equatorial Influence has no legend entry — it is a permanent ambient context layer.
const BP_LEGEND_CONFIG = {
  // DEM Score: pale aqua/cyan → teal → dark teal (matches AGO DEM Score ramp)
  elevation: {
    title:  '⛰ Elevation Score',
    bar:    'linear-gradient(to right, #B2EBF2, #26C6DA, #00695C)',
    labels: ['1 · Low', '3 · Moderate', '5 · Optimal'],
    desc:   'Score 5 = optimal Andean highland zone (≥ 2,800 m above the tree line).',
  },
  // Mean Annual Temperature Score: light green → medium green → dark green
  // Matches AGO MEANtemScore symbology (green color scale)
  temperature: {
    title:  '🌡 Temperature Score',
    bar:    'linear-gradient(to right, #E8F5E9, #66BB6A, #1B5E20)',
    labels: ['1 · Low', '3 · Moderate', '5 · Optimal'],
    desc:   'Score 5 = optimal páramo thermal range (2–10 °C). Too warm or too cold scores 1.',
  },
  // Precipitation Score: pale yellow/tan → green → blue-teal (matches AGO symbology)
  // Score 5 = ideal páramo moisture niche, NOT simply the wettest areas.
  precipitation: {
    title:  '🌧 Moisture Suitability Score',
    bar:    'linear-gradient(to right, #FFF9C4, #81C784, #0277BD)',
    labels: ['1 · Poor match', '3 · Moderate', '5 · Ideal range'],
    desc:   'Higher scores indicate precipitation closer to the modeled páramo moisture niche. Not simply the wettest areas — places that are too dry or excessively wet score lower.',
  },
  // Climate Match Score: near-black → brown → bright green (matches AGO ClimateScore ramp)
  // This is the combined temperature + precipitation suitability index.
  seasonality: {
    title:  '☁ Climate Match Score',
    bar:    'linear-gradient(to right, #1A1A1A, #795548, #2E7D32)',
    labels: ['1 · Low match', '3 · Moderate', '5 · Highest match'],
    desc:   'Higher scores show where mean annual temperature and precipitation conditions overlap most closely with the modeled páramo climate niche.',
  },
  // Final Suitability Composite: dark navy → gray → bright green (matches AGO Map1 ramp)
  // High-suitability areas render as bright green; callout markers identify major clusters.
  composite: {
    title:  '◎ Páramo Suitability Composite',
    bar:    'linear-gradient(to right, #0A1628, #7B9BAA, #27AE60)',
    labels: ['1 · Low', '3 · Moderate', '5 · Highest'],
    desc:   'Higher scores show where elevation, cool temperatures, moisture, climate, and equatorial influence combine. Bright green = highest modeled suitability.',
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
let _bpEquatorialLayer  = null;    // permanent equatorial context overlay (not a toggle)
let _bpCompositeCallouts = null;   // DivIcon cluster markers shown with composite layer

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

// Cluster callout markers for the composite view.
// Small labelled dots placed on the major highest-suitability zones so users
// can orient themselves without the map becoming a noisy heatmap.
function _createCompositeCallouts() {
  const markers = _BP_CALLOUT_CLUSTERS.map(({ latlng, label }) =>
    L.marker(latlng, {
      icon: L.divIcon({
        className:  'bp-composite-callout',
        html:       `<span class="bp-callout-dot"></span><span class="bp-callout-label">${label}</span>`,
        iconSize:   null,
        iconAnchor: [6, 6],
      }),
      interactive: false,
      keyboard:    false,
    })
  );
  return L.layerGroup(markers);
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
// composite > active score layer > nothing
// Equatorial is now a permanent ambient layer with no toggleable legend.
function _updateLegendForCurrentState() {
  if (_bpCompositeOn) { _showLegend('composite'); return; }
  if (_bpActiveScoreLayer) { _showLegend(_bpActiveScoreLayer); return; }
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

  // Composite button — enabled once any score layer is active (or already on).
  // Previously required ≥2 layers, but score layers are now mutually exclusive
  // (one-at-a-time), so count can never exceed 1. Threshold lowered to 1.
  const btn = document.getElementById('bp-composite-btn');
  if (btn) {
    const canComposite = count >= 1 || _bpCompositeOn;
    btn.disabled = !canComposite;
    btn.title = canComposite ? '' : 'Activate an environmental layer first';
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
    // Show cluster callout markers so users can identify major suitability zones
    if (!_bpCompositeCallouts) _bpCompositeCallouts = _createCompositeCallouts();
    if (!_bpMap.hasLayer(_bpCompositeCallouts)) _bpCompositeCallouts.addTo(_bpMap);
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
    // Remove cluster callout markers
    if (_bpCompositeCallouts && _bpMap.hasLayer(_bpCompositeCallouts)) {
      _bpMap.removeLayer(_bpCompositeCallouts);
    }
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

  // Ensure the permanent equatorial overlay is on the map every time the panel loads
  // (it is removed by cleanupBuildPanel when navigating away)
  if (_bpEquatorialLayer && _bpMap && !_bpMap.hasLayer(_bpEquatorialLayer)) {
    _bpEquatorialLayer.addTo(_bpMap);
  }

  // Restore legend for current state (score layer, composite, or none)
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

  // Create the permanent equatorial overlay once (added to map in wireBuildPanel)
  if (!_bpEquatorialLayer) {
    _bpEquatorialLayer = _createEquatorialOverlay();
  }

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

  // Remove composite callout markers
  if (_bpCompositeCallouts && _bpMap.hasLayer(_bpCompositeCallouts)) {
    _bpMap.removeLayer(_bpCompositeCallouts);
  }

  // Remove the permanent equatorial layer (re-added when user returns)
  if (_bpEquatorialLayer && _bpMap.hasLayer(_bpEquatorialLayer)) {
    _bpMap.removeLayer(_bpEquatorialLayer);
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
