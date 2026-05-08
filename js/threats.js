// ============================================================
// VANISHING CLOUDS — threats.js
// Phase 5: Threats to Páramo Ecosystems
// MapBiomas Colombia land-cover threat viewer.
//
// Layer types used:
//   VectorTileServer — loaded via a dedicated MapLibre GL canvas
//                      (#threats-vt-gl) using the same ArcGIS style-
//                      patching pipeline as maps.js's vector tile overlay.
//   FeatureServer    — loaded via L.esri.featureLayer (Leaflet overlay pane).
//
// Public API (exposed on window):
//   initThreatsPanel()    — lazy init on first visit
//   wireThreatsPanel()    — re-wires DOM after panel HTML is injected (main.js)
//   cleanupThreatsPanel() — removes overlays + restores basemap (maps.js)
// ============================================================

// ============================================================
// LAYER URL CONSTANTS — VectorTileServer
// All threat category and land-cover layers are published as
// ArcGIS VectorTileServer services.
// ============================================================

// ── Land-cover clipped rasters (full MapBiomas class set per year) ──
const LANDCOVER_1986_URL = 'https://tiles.arcgis.com/tiles/ZIL9uO234SBBPGL7/arcgis/rest/services/LCPoly1986/VectorTileServer';
const LANDCOVER_2000_URL = 'https://tiles.arcgis.com/tiles/ZIL9uO234SBBPGL7/arcgis/rest/services/LCPoly2000/VectorTileServer';
const LANDCOVER_2010_URL = 'https://tiles.arcgis.com/tiles/ZIL9uO234SBBPGL7/arcgis/rest/services/LCPoly2010/VectorTileServer';
const LANDCOVER_2020_URL = 'https://tiles.arcgis.com/tiles/ZIL9uO234SBBPGL7/arcgis/rest/services/LCPoly2020/VectorTileServer';
const LANDCOVER_2024_URL = 'https://tiles.arcgis.com/tiles/ZIL9uO234SBBPGL7/arcgis/rest/services/LCPoly2024/VectorTileServer';

// ── Agriculture binary presence × year ──
const AGRICULTURE_1986_URL = 'https://tiles.arcgis.com/tiles/ZIL9uO234SBBPGL7/arcgis/rest/services/Agri1986Poly/VectorTileServer';
const AGRICULTURE_2000_URL = 'https://tiles.arcgis.com/tiles/ZIL9uO234SBBPGL7/arcgis/rest/services/Agri2000Poly/VectorTileServer';
const AGRICULTURE_2010_URL = 'https://tiles.arcgis.com/tiles/ZIL9uO234SBBPGL7/arcgis/rest/services/Agri2010Poly/VectorTileServer';
const AGRICULTURE_2020_URL = 'https://tiles.arcgis.com/tiles/ZIL9uO234SBBPGL7/arcgis/rest/services/Agri2020Poly/VectorTileServer';
const AGRICULTURE_2024_URL = 'https://tiles.arcgis.com/tiles/ZIL9uO234SBBPGL7/arcgis/rest/services/Agri2024Poly/VectorTileServer';

// ── Pasture binary presence × year ──
// NOTE: Pasture 2000 URL appears to duplicate Pasture 2020.
// Replace PASTURE_2000_URL with the correct Past2000Poly URL when available.
const PASTURE_1986_URL = 'https://tiles.arcgis.com/tiles/ZIL9uO234SBBPGL7/arcgis/rest/services/Past1986Poly/VectorTileServer';
const PASTURE_2000_URL = 'https://tiles.arcgis.com/tiles/ZIL9uO234SBBPGL7/arcgis/rest/services/Past2020Poly/VectorTileServer'; // ⚠ duplicate — see note above
const PASTURE_2010_URL = 'https://tiles.arcgis.com/tiles/ZIL9uO234SBBPGL7/arcgis/rest/services/Past2010Poly/VectorTileServer';
const PASTURE_2020_URL = 'https://tiles.arcgis.com/tiles/ZIL9uO234SBBPGL7/arcgis/rest/services/Past2020Poly/VectorTileServer';
const PASTURE_2024_URL = 'https://tiles.arcgis.com/tiles/ZIL9uO234SBBPGL7/arcgis/rest/services/Past2024Poly/VectorTileServer';

// ── Urban binary presence × year ──
const URBAN_1986_URL = 'https://tiles.arcgis.com/tiles/ZIL9uO234SBBPGL7/arcgis/rest/services/Urban1986Poly/VectorTileServer';
const URBAN_2000_URL = 'https://tiles.arcgis.com/tiles/ZIL9uO234SBBPGL7/arcgis/rest/services/Urba2000Poly/VectorTileServer';
const URBAN_2010_URL = 'https://tiles.arcgis.com/tiles/ZIL9uO234SBBPGL7/arcgis/rest/services/Urba2010Poly/VectorTileServer';
const URBAN_2020_URL = 'https://tiles.arcgis.com/tiles/ZIL9uO234SBBPGL7/arcgis/rest/services/Urba2020Poly/VectorTileServer';
const URBAN_2024_URL = 'https://tiles.arcgis.com/tiles/ZIL9uO234SBBPGL7/arcgis/rest/services/Urba2024Poly/VectorTileServer';

// ── Mining binary presence × year ──
// Note: Mining 2020 is served from vectortileservices1 subdomain (not tiles.arcgis.com).
const MINING_1986_URL = 'https://tiles.arcgis.com/tiles/ZIL9uO234SBBPGL7/arcgis/rest/services/Min1986Poly/VectorTileServer';
const MINING_2000_URL = 'https://tiles.arcgis.com/tiles/ZIL9uO234SBBPGL7/arcgis/rest/services/Mi2000Poly/VectorTileServer';
const MINING_2010_URL = 'https://tiles.arcgis.com/tiles/ZIL9uO234SBBPGL7/arcgis/rest/services/Mi2010Poly/VectorTileServer';
const MINING_2020_URL = 'https://vectortileservices1.arcgis.com/ZIL9uO234SBBPGL7/arcgis/rest/services/Mi2020Poly/VectorTileServer';
const MINING_2024_URL = 'https://tiles.arcgis.com/tiles/ZIL9uO234SBBPGL7/arcgis/rest/services/Mi2024Poly/VectorTileServer';

// ── Total land-cover change summary (VectorTileServer) ──
const TOTAL_LANDCOVER_CHANGE_URL = 'https://tiles.arcgis.com/tiles/ZIL9uO234SBBPGL7/arcgis/rest/services/LandCoverToltalChnageso/VectorTileServer';

// ============================================================
// LAYER URL CONSTANTS — FeatureServer
// Polygon layers loaded via L.esri.featureLayer.
// ============================================================

// Agriculture expansion per páramo polygon
const AGRICULTURE_EXPANSION_PARAMOS_URL = 'https://services1.arcgis.com/ZIL9uO234SBBPGL7/arcgis/rest/services/agriculture_expansion_by_paramo/FeatureServer/0';

// Urban proximity risk per páramo polygon
const URBAN_RISK_PARAMOS_URL = 'https://services1.arcgis.com/ZIL9uO234SBBPGL7/arcgis/rest/services/ParamosProximitytourbanrisk/FeatureServer/0';

// ── Fire pressure (placeholder — data added later) ──
const FIRE_DENSITY_LAYER_URL   = null;
const FIRE_FREQUENCY_LAYER_URL = null;

// ============================================================
// CONFIGURATION
// ============================================================

// Threat category display props + per-year VectorTileServer URL lookup
const TH_CATEGORIES = {
  agriculture: {
    label: 'Agriculture', icon: '🌾', color: '#C9930A',
    urls: {
      '1986': AGRICULTURE_1986_URL,
      '2000': AGRICULTURE_2000_URL,
      '2010': AGRICULTURE_2010_URL,
      '2020': AGRICULTURE_2020_URL,
      '2024': AGRICULTURE_2024_URL,
    },
  },
  pasture: {
    label: 'Pasture', icon: '🐄', color: '#C8651A',
    urls: {
      '1986': PASTURE_1986_URL,
      '2000': PASTURE_2000_URL,   // ⚠ see PASTURE_2000_URL note above
      '2010': PASTURE_2010_URL,
      '2020': PASTURE_2020_URL,
      '2024': PASTURE_2024_URL,
    },
  },
  urban: {
    label: 'Urban', icon: '🏙', color: '#C0392B',
    urls: {
      '1986': URBAN_1986_URL,
      '2000': URBAN_2000_URL,
      '2010': URBAN_2010_URL,
      '2020': URBAN_2020_URL,
      '2024': URBAN_2024_URL,
    },
  },
  mining: {
    label: 'Mining', icon: '⛏', color: '#6B3FA0',
    urls: {
      '1986': MINING_1986_URL,
      '2000': MINING_2000_URL,
      '2010': MINING_2010_URL,
      '2020': MINING_2020_URL,
      '2024': MINING_2024_URL,
    },
  },
};

// Land-cover class legend — MapBiomas classes.
// Update colors/labels to match actual ArcGIS symbology when available.
const TH_LANDCOVER_CLASSES = [
  { color: '#1B5E3B', label: 'Native vegetation / Forest' },
  { color: '#66BB6A', label: 'Grassland / Páramo heath' },
  { color: '#F9D76B', label: 'Agriculture (cropland)' },
  { color: '#D4813A', label: 'Pasture' },
  { color: '#C0392B', label: 'Urban / Built-up' },
  { color: '#6B3FA0', label: 'Mining' },
  { color: '#5C9BD4', label: 'Water bodies' },
  { color: '#C8C8C8', label: 'Other / Unclassified' },
];

// Agriculture expansion — 5-class graduated ramp (low → very high)
const TH_AG_EXP_CLASSES = [
  { color: '#F5F0E8', label: 'No increase' },
  { color: '#F9D76B', label: 'Low increase' },
  { color: '#E8A238', label: 'Moderate increase' },
  { color: '#C0541B', label: 'High increase' },
  { color: '#7B1209', label: 'Very high increase' },
];

// Urban proximity risk — 5-class graduated ramp (very low → very high)
const TH_URBAN_RISK_CLASSES = [
  { color: '#FFF5F0', label: 'Very low risk' },
  { color: '#FCBBA1', label: 'Low risk' },
  { color: '#FB6A4A', label: 'Moderate risk' },
  { color: '#CB181D', label: 'High risk' },
  { color: '#67000D', label: 'Very high risk' },
];

// ============================================================
// MODULE STATE
// Persists across panel visits — re-entering restores last state.
// ============================================================

let _thMap             = null;          // Leaflet map reference
let _thInitialized     = false;         // true after initThreatsPanel ran once

let _thMode            = 'landcover';   // active view mode
let _thYear            = '2024';        // active year (for landcover + threat modes)
let _thCategory        = 'agriculture'; // active threat category (for threat mode)

// VectorTileServer GL canvas state
let _thGlMap           = null;          // MapLibre GL map instance for VT layers
let _thGlContainer     = null;          // #threats-vt-gl DOM element
let _thStyleCache      = {};            // url → patched style JSON (avoids re-fetching)
let _thCurrentVtUrl    = null;          // VT URL currently loaded in _thGlMap
let _thLoadGeneration  = 0;             // incremented on each load; stale callbacks abort

// Leaflet overlay state
let _thActiveOverlay   = null;          // Leaflet tileLayer (fallback/future use)
let _thAgExpLayer      = null;          // featureLayer — agriculture expansion
let _thUrbanRiskLayer  = null;          // featureLayer — urban proximity risk

// Floating legend DOM node
let _thLegendEl        = null;

// Basemap simplification state (captured before hiding hillshade)
let _thBasemapState    = null;

// ============================================================
// BASEMAP SIMPLIFICATION
// Hides hillshade while VectorTile threat layers are active
// so threat polygon colors read clearly against the terrain.
// Restores the exact user-set state on exit.
// ============================================================

function _thCaptureBasemapState() {
  const h = document.getElementById('hillshade-gl');
  return {
    hillshade: !h || h.style.display !== 'none',
  };
}

function _thSimplifyBasemap() {
  if (_thBasemapState || typeof window.setBasemapVisible !== 'function') return;
  _thBasemapState = _thCaptureBasemapState();
  window.setBasemapVisible('hillshade', false);
}

function _thRestoreBasemap() {
  if (!_thBasemapState || typeof window.setBasemapVisible !== 'function') return;
  window.setBasemapVisible('hillshade', _thBasemapState.hillshade);
  _thBasemapState = null;
}

// ============================================================
// VECTOR TILE GL CANVAS
// A dedicated MapLibre GL map (z=360, between terrain and labels)
// holds all ArcGIS VectorTileServer threat layers.  Only one
// style is active at a time; setStyle() swaps the entire layer set.
// ============================================================

// Sync the threats GL canvas position with the Leaflet map.
// Called on every Leaflet 'move' event (always bound; cheap no-op
// when canvas is hidden).
function _syncThreatsGL() {
  if (!_thGlMap || !_thMap) return;
  const c = _thMap.getCenter();
  _thGlMap.jumpTo({ center: [c.lng, c.lat], zoom: _thMap.getZoom() - 1 });
}

// Create the #threats-vt-gl canvas once on first initThreatsPanel call.
function _thInitGlMap() {
  if (_thGlContainer) return;   // already created
  if (typeof maplibregl === 'undefined') {
    console.warn('[threats.js] MapLibre GL not available — VectorTileServer layers disabled');
    return;
  }

  const mapEl = document.getElementById('map-main');
  if (!mapEl) return;

  _thGlContainer = document.createElement('div');
  _thGlContainer.id = 'threats-vt-gl';
  mapEl.appendChild(_thGlContainer);

  const c = _thMap.getCenter();
  const z = _thMap.getZoom() - 1;  // MapLibre 512px tiles → 1 zoom offset vs Leaflet 256px

  // Blank starting style — no tiles, transparent background
  const blankStyle = {
    version: 8,
    sources: {},
    layers: [{
      id:    'background',
      type:  'background',
      paint: { 'background-color': 'rgba(0,0,0,0)', 'background-opacity': 0 },
    }],
  };

  _thGlMap = new maplibregl.Map({
    container:            'threats-vt-gl',
    style:                blankStyle,
    center:               [c.lng, c.lat],
    zoom:                 z,
    interactive:          false,
    attributionControl:   false,
    preserveDrawingBuffer: false,
  });

  // Sync on every Leaflet pan/zoom — always active (tiny overhead when hidden)
  _thMap.on('move',    _syncThreatsGL);
  _thMap.on('moveend', _syncThreatsGL);
  _thMap.on('resize',  () => _thGlMap && _thGlMap.resize());

  console.log('[threats.js] VectorTileServer GL canvas created (#threats-vt-gl)');
}

// ── Style fetch + ArcGIS URL patching ─────────────────────────────────────
// Identical to the three-step patch in maps.js initVectorTileOverlay().
// Styles are cached by URL so re-selecting a previously-seen year is instant.

async function _thFetchStyle(url) {
  if (_thStyleCache[url]) return _thStyleCache[url];

  const base         = url.replace(/\/+$/, '');
  const styleUrl     = `${base}/resources/styles/root.json`;
  const resourcesBase = `${base}/resources`;

  const resp = await fetch(styleUrl);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} — ${styleUrl}`);

  const text = await resp.text();
  let style;
  try { style = JSON.parse(text); }
  catch { throw new Error(`VectorTileServer style is not valid JSON (${styleUrl})`); }

  // 1. Sprite: relative path → absolute
  if (!style.sprite || !style.sprite.startsWith('http')) {
    style.sprite = `${resourcesBase}/sprites/sprite`;
  }

  // 2. Glyphs: relative path → absolute
  if (!style.glyphs || !style.glyphs.startsWith('http')) {
    style.glyphs = `${resourcesBase}/fonts/{fontstack}/{range}.pbf`;
  }

  // 3. Sources: "relative://." or other non-http URLs → direct PBF tile endpoint
  if (style.sources) {
    Object.values(style.sources).forEach(source => {
      const isRelative = source.url && (
        source.url.startsWith('relative://') || !source.url.startsWith('http')
      );
      if (isRelative) {
        source.tiles  = [`${base}/tile/{z}/{y}/{x}.pbf`];
        source.minzoom = 0;
        source.maxzoom = 22;
        delete source.url;
      }
    });
  }

  _thStyleCache[url] = style;
  return style;
}

// ── Load a VectorTileServer URL into the GL canvas ───────────────────────
// Uses a generation counter so rapid user clicks cancel stale loads.
// The container opacity fades out → load → fade in for a smooth transition.

async function _thLoadVtLayer(url, label) {
  console.log(`[threats.js] Loading Threats layer: ${label}`);

  if (!_thGlMap || !_thGlContainer) {
    console.warn('[threats.js] GL canvas not ready — cannot load VT layer');
    return;
  }

  // Same URL already displayed — nothing to do
  if (_thCurrentVtUrl === url) {
    _thGlContainer.style.display = '';
    _thGlContainer.style.opacity = '1';
    return;
  }

  // Claim this load slot; any in-flight load with a lower gen will abort
  const gen = ++_thLoadGeneration;

  // Fade out during transition
  _thGlContainer.style.opacity = '0';
  _thGlContainer.style.display = '';

  try {
    const style = await _thFetchStyle(url);

    // Abort if a newer load started while we were fetching
    if (gen !== _thLoadGeneration) return;

    // 3-second fallback: force-show even if 'style.load' never fires
    let fadeInDone = false;
    const fadeInTimeout = setTimeout(() => {
      if (gen !== _thLoadGeneration || fadeInDone) return;
      fadeInDone = true;
      _thGlContainer.style.opacity = '1';
      console.log(`[threats.js] Threats layer loaded (fallback): ${label}`);
    }, 3000);

    _thGlMap.once('style.load', () => {
      if (gen !== _thLoadGeneration) { clearTimeout(fadeInTimeout); return; }
      clearTimeout(fadeInTimeout);
      if (!fadeInDone) {
        fadeInDone = true;
        _thGlContainer.style.opacity = '1';
        console.log(`[threats.js] Threats layer loaded: ${label}`);
      }
    });

    _thGlMap.setStyle(style);
    _thCurrentVtUrl = url;
    _syncThreatsGL();  // re-sync position after style change

  } catch (err) {
    console.error(`[threats.js] Threats layer failed: ${label} — ${err.message}`);
    if (gen === _thLoadGeneration) {
      _thGlContainer.style.display = 'none';
      _thCurrentVtUrl = null;
    }
  }
}

// Hide the VT canvas without destroying the GL instance
function _thHideVtLayer() {
  if (_thGlContainer) {
    _thGlContainer.style.opacity = '0';
    _thGlContainer.style.display = 'none';
  }
  _thCurrentVtUrl = null;
  _thLoadGeneration++;  // cancel any in-flight load
}

// ============================================================
// OVERLAY MANAGEMENT — clear everything before switching modes
// ============================================================

function _thClearOverlays() {
  // VectorTile GL layer
  _thHideVtLayer();

  // Leaflet tileLayer (legacy/fallback path — kept for safety)
  if (_thActiveOverlay && _thMap) {
    if (_thMap.hasLayer(_thActiveOverlay)) _thMap.removeLayer(_thActiveOverlay);
    _thActiveOverlay = null;
  }

  // FeatureLayer — agriculture expansion
  if (_thAgExpLayer && _thMap) {
    if (_thMap.hasLayer(_thAgExpLayer)) _thMap.removeLayer(_thAgExpLayer);
    _thAgExpLayer = null;
  }

  // FeatureLayer — urban proximity risk
  if (_thUrbanRiskLayer && _thMap) {
    if (_thMap.hasLayer(_thUrbanRiskLayer)) _thMap.removeLayer(_thUrbanRiskLayer);
    _thUrbanRiskLayer = null;
  }
}

// ============================================================
// FLOATING LEGEND (position: fixed, bottom-right of map)
// ============================================================

function _thGetLegendEl() {
  if (!_thLegendEl) {
    _thLegendEl = document.createElement('div');
    _thLegendEl.className = 'th-legend';
    const mapEl = document.getElementById('map-main');
    if (mapEl) mapEl.appendChild(_thLegendEl);
  }
  return _thLegendEl;
}

function _thHideLegend() {
  if (_thLegendEl) _thLegendEl.style.display = 'none';
}

function _thShowLegend(mode) {
  const el = _thGetLegendEl();
  el.style.display = 'block';

  switch (mode) {

    case 'landcover': {
      // VT layers use service symbology — legend shows reference classes
      el.innerHTML = `
        <div class="th-legend-title">🗂 Land Cover · ${_thYear}</div>
        <div class="th-legend-rows">
          ${TH_LANDCOVER_CLASSES.map(c =>
            `<div class="th-legend-row">
               <span class="th-swatch" style="background:${c.color}"></span>
               ${c.label}
             </div>`
          ).join('')}
        </div>
        <div class="th-legend-note">
          MapBiomas Colombia land-cover classification · páramo buffer zone.
          Colors match the ArcGIS service symbology.
        </div>
      `;
      break;
    }

    case 'threat': {
      const cat = TH_CATEGORIES[_thCategory];
      el.innerHTML = `
        <div class="th-legend-title" style="color:${cat.color}">${cat.icon} ${cat.label} · ${_thYear}</div>
        <div class="th-legend-rows">
          <div class="th-legend-row">
            <span class="th-swatch th-swatch--empty"></span>
            No ${cat.label.toLowerCase()} detected
          </div>
          <div class="th-legend-row">
            <span class="th-swatch" style="background:${cat.color}"></span>
            ${cat.label} presence
          </div>
        </div>
        <div class="th-legend-note">
          ArcGIS VectorTileServer · presence of ${cat.label.toLowerCase()} land-use in ${_thYear}.
          ${(_thCategory === 'pasture' && _thYear === '2000') ? '<br><em>⚠ Pasture 2000 uses the 2020 layer — correct URL pending.</em>' : ''}
        </div>
      `;
      break;
    }

    case 'agexpansion': {
      el.innerHTML = `
        <div class="th-legend-title">🌾 Agriculture Expansion</div>
        <div class="th-legend-rows">
          ${TH_AG_EXP_CLASSES.map((c, i) =>
            `<div class="th-legend-row">
               <span class="th-swatch" style="background:${c.color}${i === 0 ? ';border:1px solid #ccc' : ''}"></span>
               ${c.label}
             </div>`
          ).join('')}
        </div>
        <div class="th-legend-note">
          Increase in agriculture per páramo complex over the study period.
        </div>
      `;
      break;
    }

    case 'urbanrisk': {
      el.innerHTML = `
        <div class="th-legend-title">🏙 Urban Proximity Risk</div>
        <div class="th-legend-rows">
          ${TH_URBAN_RISK_CLASSES.map((c, i) =>
            `<div class="th-legend-row">
               <span class="th-swatch" style="background:${c.color}${i === 0 ? ';border:1px solid #ccc' : ''}"></span>
               ${c.label}
             </div>`
          ).join('')}
        </div>
        <div class="th-legend-note">
          Risk rating per páramo complex based on proximity to urban areas.
        </div>
      `;
      break;
    }

    case 'totalchange': {
      el.innerHTML = `
        <div class="th-legend-title">📊 Total Land-Cover Change</div>
        <div class="th-legend-rows">
          <div class="th-legend-row">
            <span class="th-swatch th-swatch--empty"></span>
            No detected change
          </div>
          <div class="th-legend-row">
            <span class="th-swatch" style="background:#D4521A"></span>
            Detected change
          </div>
        </div>
        <div class="th-legend-note">
          Areas where agriculture, pasture, urban, or mining changed during the study period.
        </div>
      `;
      break;
    }

    case 'fire': {
      el.innerHTML = `
        <div class="th-legend-title">🔥 Fire Pressure</div>
        <div class="th-legend-note th-legend-note--pending">
          Fire layers not yet published. Will show VIIRS/MODIS fire density and frequency around páramo zones.
        </div>
      `;
      break;
    }
  }
}

// ============================================================
// MODE APPLY FUNCTIONS
// ============================================================

function _thLandcoverUrlForYear(year) {
  return {
    '1986': LANDCOVER_1986_URL,
    '2000': LANDCOVER_2000_URL,
    '2010': LANDCOVER_2010_URL,
    '2020': LANDCOVER_2020_URL,
    '2024': LANDCOVER_2024_URL,
  }[year] || null;
}

// A. Land-cover timeline — one VectorTileServer layer per year
function _thApplyLandcover() {
  _thClearOverlays();
  _thSimplifyBasemap();
  const url = _thLandcoverUrlForYear(_thYear);
  _thLoadVtLayer(url, `Land cover ${_thYear}`);
  _thShowLegend('landcover');
}

// B. Threat category × year — single binary VectorTileServer layer
function _thApplyThreat() {
  _thClearOverlays();
  const cat = TH_CATEGORIES[_thCategory];
  const url = cat ? cat.urls[_thYear] : null;

  if (_thCategory === 'pasture' && _thYear === '2000') {
    console.warn('[threats.js] Pasture 2000 URL appears to duplicate Pasture 2020. Replace when the correct Past2000Poly URL is available.');
  }

  _thSimplifyBasemap();
  _thLoadVtLayer(url, `${cat ? cat.label : 'Threat'} ${_thYear}`);
  _thShowLegend('threat');
}

// C. Agriculture expansion by páramo — FeatureServer polygon layer
function _thApplyAgExpansion() {
  _thClearOverlays();
  _thRestoreBasemap();  // FeatureLayer works fine on the normal basemap

  console.log('[threats.js] Loading Threats layer: Agriculture expansion by páramo');

  // Derive fill-color class index (1-based integer or string)
  function _agExpIdx(feature) {
    const p   = feature.properties || {};
    const raw = p.ag_exp_cat     ?? p.ag_expansion_cat ?? p.expansion_cat
              ?? p.agr_exp       ?? p.category          ?? p.CLASS        ?? 1;
    const n = Number(raw);
    return isNaN(n) ? 0 : Math.min(Math.max(0, Math.round(n) - 1), TH_AG_EXP_CLASSES.length - 1);
  }

  _thAgExpLayer = L.esri.featureLayer({
    url: AGRICULTURE_EXPANSION_PARAMOS_URL,
    style(feature) {
      const color = TH_AG_EXP_CLASSES[_agExpIdx(feature)].color;
      return {
        fillColor:   color,
        fillOpacity: 0.75,
        color:       'rgba(0,0,0,0.18)',
        weight:      0.9,
        opacity:     0.85,
      };
    },
    onEachFeature(feature, layer) {
      const p    = feature.properties || {};
      const name = p.pacomplejo || p.pacodigo || p.Nombre || p.nombre || p.name || 'Páramo';
      const cat  = p.ag_exp_cat ?? p.ag_expansion_cat ?? p.expansion_cat ?? p.Categoria ?? '—';
      const pct  = p.ag_exp_pct    != null ? `${Number(p.ag_exp_pct).toFixed(1)} %`
                 : p.ag_change_pct != null ? `${Number(p.ag_change_pct).toFixed(1)} %`
                 : p.cambio_agr    != null ? `${Number(p.cambio_agr).toFixed(1)} %`
                 : '—';

      layer.bindTooltip(
        `<strong style="color:#8B4000;font-size:12px">${name}</strong>`,
        { sticky: true, direction: 'top', opacity: 1 }
      );
      layer.bindPopup(`
        <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                    padding:10px 13px;min-width:190px">
          <h4 style="margin:0 0 6px;font-size:13px;color:#C8A840;
                     border-bottom:1px solid #eee;padding-bottom:5px">${name}</h4>
          <table style="width:100%;font-size:12px;border-collapse:collapse">
            <tr>
              <td style="color:#888;padding:2px 0">Expansion category</td>
              <td style="font-weight:700;text-align:right">${cat}</td>
            </tr>
            <tr>
              <td style="color:#888;padding:2px 0">Agriculture change</td>
              <td style="font-weight:700;text-align:right">${pct}</td>
            </tr>
          </table>
        </div>
      `, { maxWidth: 265 });

      layer.on('mouseover', function() {
        this.setStyle({ fillOpacity: 0.95, weight: 2 });
        this.bringToFront();
      });
      layer.on('mouseout', function() {
        if (_thAgExpLayer) _thAgExpLayer.resetStyle(this);
      });
    },
  });

  _thAgExpLayer.addTo(_thMap);
  _thAgExpLayer.once('load', () => console.log('[threats.js] Threats layer loaded: Agriculture expansion'));
  _thAgExpLayer.on('requesterror', (e) => console.error('[threats.js] Threats layer failed: Agriculture expansion —', e));
  _thShowLegend('agexpansion');
}

// D. Urban proximity risk — FeatureServer polygon layer
function _thApplyUrbanRisk() {
  _thClearOverlays();
  _thRestoreBasemap();  // FeatureLayer works fine on the normal basemap

  console.log('[threats.js] Loading Threats layer: Urban proximity risk by páramo');

  function _urbanRiskIdx(feature) {
    const p   = feature.properties || {};
    const raw = p.risk_cat         ?? p.urban_risk_cat ?? p.proximity_risk
              ?? p.risk_category   ?? p.categoria_r    ?? p.CLASS             ?? 1;
    const n = Number(raw);
    return isNaN(n) ? 0 : Math.min(Math.max(0, Math.round(n) - 1), TH_URBAN_RISK_CLASSES.length - 1);
  }

  _thUrbanRiskLayer = L.esri.featureLayer({
    url: URBAN_RISK_PARAMOS_URL,
    style(feature) {
      const color = TH_URBAN_RISK_CLASSES[_urbanRiskIdx(feature)].color;
      return {
        fillColor:   color,
        fillOpacity: 0.75,
        color:       'rgba(0,0,0,0.18)',
        weight:      0.9,
        opacity:     0.85,
      };
    },
    onEachFeature(feature, layer) {
      const p    = feature.properties || {};
      const name = p.pacomplejo  || p.pacodigo || p.Nombre || p.nombre || p.name || 'Páramo';
      const risk = p.risk_cat    ?? p.urban_risk_cat ?? p.proximity_risk ?? p.risk_category ?? p.Categoria ?? '—';
      const dist = p.dist_urban_km != null ? `${Number(p.dist_urban_km).toFixed(1)} km`
                 : p.proximity_km  != null ? `${Number(p.proximity_km).toFixed(1)} km`
                 : p.dist_km       != null ? `${Number(p.dist_km).toFixed(1)} km`
                 : '—';

      layer.bindTooltip(
        `<strong style="color:#C0392B;font-size:12px">${name}</strong>`,
        { sticky: true, direction: 'top', opacity: 1 }
      );
      layer.bindPopup(`
        <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                    padding:10px 13px;min-width:190px">
          <h4 style="margin:0 0 6px;font-size:13px;color:#C8A840;
                     border-bottom:1px solid #eee;padding-bottom:5px">${name}</h4>
          <table style="width:100%;font-size:12px;border-collapse:collapse">
            <tr>
              <td style="color:#888;padding:2px 0">Urban risk category</td>
              <td style="font-weight:700;text-align:right">${risk}</td>
            </tr>
            <tr>
              <td style="color:#888;padding:2px 0">Distance to urban</td>
              <td style="font-weight:700;text-align:right">${dist}</td>
            </tr>
          </table>
        </div>
      `, { maxWidth: 265 });

      layer.on('mouseover', function() {
        this.setStyle({ fillOpacity: 0.95, weight: 2 });
        this.bringToFront();
      });
      layer.on('mouseout', function() {
        if (_thUrbanRiskLayer) _thUrbanRiskLayer.resetStyle(this);
      });
    },
  });

  _thUrbanRiskLayer.addTo(_thMap);
  _thUrbanRiskLayer.once('load', () => console.log('[threats.js] Threats layer loaded: Urban proximity risk'));
  _thUrbanRiskLayer.on('requesterror', (e) => console.error('[threats.js] Threats layer failed: Urban proximity risk —', e));
  _thShowLegend('urbanrisk');
}

// E. Total land-cover change — VectorTileServer summary layer
function _thApplyTotalChange() {
  _thClearOverlays();
  _thSimplifyBasemap();
  _thLoadVtLayer(TOTAL_LANDCOVER_CHANGE_URL, 'Total land-cover change');
  _thShowLegend('totalchange');
}

// F. Fire pressure — placeholder (no data yet)
function _thApplyFire() {
  _thClearOverlays();
  // No layers — legend communicates coming-soon status
  _thShowLegend('fire');
}

// ============================================================
// MODE DISPATCHER
// ============================================================

function _thApplyMode() {
  if (!_thMap) return;
  switch (_thMode) {
    case 'landcover':   _thApplyLandcover();   break;
    case 'threat':      _thApplyThreat();       break;
    case 'agexpansion': _thApplyAgExpansion();  break;
    case 'urbanrisk':   _thApplyUrbanRisk();    break;
    case 'totalchange': _thApplyTotalChange();  break;
    case 'fire':        _thApplyFire();         break;
    default:            _thApplyLandcover();    break;
  }
}

// ============================================================
// PANEL UI SYNC
// Syncs button active states and shows/hides control sections.
// Safe to call multiple times (idempotent).
// ============================================================

const _TH_ALL_MODES = ['landcover', 'threat', 'agexpansion', 'urbanrisk', 'totalchange', 'fire'];

function _updateThreatsUI() {
  // Mode buttons
  document.querySelectorAll('.th-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === _thMode);
  });

  // Year buttons
  document.querySelectorAll('.th-year-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.year === _thYear);
  });

  // Category buttons
  document.querySelectorAll('.th-cat-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === _thCategory);
  });

  // Year selector: only visible for modes that need a year
  const showYear = (_thMode === 'landcover' || _thMode === 'threat');
  const yearSec  = document.getElementById('th-year-section');
  if (yearSec) yearSec.style.display = showYear ? '' : 'none';

  // Category selector: only visible in threat mode
  const catSec = document.getElementById('th-cat-section');
  if (catSec) catSec.style.display = _thMode === 'threat' ? '' : 'none';

  // Context cards: show only the active mode's card
  _TH_ALL_MODES.forEach(m => {
    const el = document.getElementById(`th-ctx-${m}`);
    if (el) el.style.display = (m === _thMode) ? '' : 'none';
  });
}

// ============================================================
// INIT — lazy, called once on first visit to the threats panel
// ============================================================

function initThreatsPanel() {
  if (_thInitialized) return;
  _thMap = window.map;
  if (!_thMap) {
    console.warn('[threats.js] Map not ready — initThreatsPanel deferred');
    return;
  }
  _thInitGlMap();   // create the VT GL canvas
  _thInitialized = true;
  console.log('[threats.js] initThreatsPanel complete');
}

// ============================================================
// WIRE — called on every panel visit after HTML is injected
// ============================================================

function wireThreatsPanel() {
  if (!_thInitialized) initThreatsPanel();
  if (!_thMap) return;

  // Show the VT GL canvas (it was hidden during cleanup)
  // — visibility is managed per-load inside _thLoadVtLayer

  // ── Mode buttons ──
  document.querySelectorAll('.th-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _thMode = btn.dataset.mode;
      _updateThreatsUI();
      _thApplyMode();
    });
  });

  // ── Year buttons ──
  document.querySelectorAll('.th-year-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _thYear = btn.dataset.year;
      _updateThreatsUI();
      if (_thMode === 'landcover' || _thMode === 'threat') _thApplyMode();
    });
  });

  // ── Category buttons ──
  document.querySelectorAll('.th-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _thCategory = btn.dataset.category;
      _updateThreatsUI();
      if (_thMode === 'threat') _thApplyMode();
    });
  });

  // Restore UI state from previous visit, then apply current mode
  _updateThreatsUI();
  _thApplyMode();
}

// ============================================================
// CLEANUP — called when leaving the threats panel
// ============================================================

function cleanupThreatsPanel() {
  _thClearOverlays();   // hides GL canvas, removes featureLayers
  _thHideLegend();
  _thRestoreBasemap();  // restore hillshade if it was hidden
}

// ============================================================
// EXPOSE
// ============================================================
window.initThreatsPanel    = initThreatsPanel;
window.wireThreatsPanel    = wireThreatsPanel;
window.cleanupThreatsPanel = cleanupThreatsPanel;
