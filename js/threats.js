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

// Páramo reference polygons — same service used by maps.js overview/species panels.
// Shown as a subtle underlay in "Threat category by year" mode only.
const PARAMO_REFERENCE_URL = 'https://services1.arcgis.com/ZIL9uO234SBBPGL7/arcgis/rest/services/Paramos_de_Colombia_CopyFeatures/FeatureServer/0';

// ── Fire pressure — real ArcGIS Online services ──
const FIRE_DENSITY_KERNEL_URL  = 'https://tiles.arcgis.com/tiles/ZIL9uO234SBBPGL7/arcgis/rest/services/fire_density_kernel/MapServer';
const FIRE_POINTS_URL          = 'https://services1.arcgis.com/ZIL9uO234SBBPGL7/arcgis/rest/services/fire_points_paramo/FeatureServer';
const FIRE_FREQUENCY_PARAMO_URL = 'https://services1.arcgis.com/ZIL9uO234SBBPGL7/arcgis/rest/services/fire_frequency_by_paramo/FeatureServer';

// ============================================================
// CONFIGURATION
// ============================================================

// Threat category display props + per-year VectorTileServer URL lookup.
// vtColor — exact fill-color read from the published VectorTileServer style JSON
//           (the color actually visible on the map).
// color   — UI accent used for panel buttons / tooltips (can differ from vtColor).
const TH_CATEGORIES = {
  agriculture: {
    label: 'Agriculture', icon: '🌾',
    color:   '#C9930A',    // UI accent (amber)
    vtColor: '#A8A800',    // actual layer fill: olive-green (Agri*Poly style)
    urls: {
      '1986': AGRICULTURE_1986_URL,
      '2000': AGRICULTURE_2000_URL,
      '2010': AGRICULTURE_2010_URL,
      '2020': AGRICULTURE_2020_URL,
      '2024': AGRICULTURE_2024_URL,
    },
  },
  pasture: {
    label: 'Pasture', icon: '🐄',
    color:   '#C8651A',    // UI accent (burnt orange)
    vtColor: '#A87000',    // actual layer fill: amber-brown (Past*Poly style)
    urls: {
      '1986': PASTURE_1986_URL,
      '2000': PASTURE_2000_URL,   // ⚠ see PASTURE_2000_URL note above
      '2010': PASTURE_2010_URL,
      '2020': PASTURE_2020_URL,
      '2024': PASTURE_2024_URL,
    },
  },
  urban: {
    label: 'Urban', icon: '🏙',
    color:   '#555555',    // UI accent (dark gray)
    vtColor: '#343434',    // actual layer fill: dark charcoal (Urban*Poly style)
    urls: {
      '1986': URBAN_1986_URL,
      '2000': URBAN_2000_URL,
      '2010': URBAN_2010_URL,
      '2020': URBAN_2020_URL,
      '2024': URBAN_2024_URL,
    },
  },
  mining: {
    label: 'Mining', icon: '⛏',
    color:   '#D73027',    // UI accent (red)
    vtColor: '#E60000',    // actual layer fill: bright red (Min*Poly style)
    urls: {
      '1986': MINING_1986_URL,
      '2000': MINING_2000_URL,
      '2010': MINING_2010_URL,
      '2020': MINING_2020_URL,
      '2024': MINING_2024_URL,
    },
  },
};

// Land-cover class legend — derived directly from the LCPoly VectorTileServer
// style (root.json _symbol field values and fill-color paint properties).
// Ordered alphabetically as in the service; colors are exact hex values from
// the published ArcGIS style.
const TH_LANDCOVER_CLASSES = [
  { color: '#00E6A9', label: 'Andean Herbaceous and Shrubby Vegetation' },
  { color: '#73DFFF', label: 'Aquaculture' },
  { color: '#FFFFBE', label: 'Beach, dune and sand spot',                   border: true },
  { color: '#BED2FF', label: 'Flooded Andean Herbaceous and Shrubby Veg.' },
  { color: '#73B2FF', label: 'Flooded forest' },
  { color: '#267300', label: 'Forest' },
  { color: '#A8A800', label: 'Forest plantation' },
  { color: '#FFFFFF', label: 'Glacier',                                      border: true },
  { color: '#343434', label: 'Infrastructure' },
  { color: '#A80000', label: 'Mining' },
  { color: '#CDAA66', label: 'Mosaic of agriculture and pasture' },
  { color: '#C8C8C8', label: 'Not observed',                                 border: true },
  { color: '#BEFFE8', label: 'Other natural non-vegetated area' },
  { color: '#CDCD66', label: 'Other non-forest formation' },
  { color: '#BEFFE8', label: 'Other non-vegetated area' },
  { color: '#00A9E6', label: 'River, lake or ocean' },
  { color: '#828282', label: 'Rocky outcrop' },
  { color: '#00E6A9', label: 'Wetland' },
];

// Agriculture expansion — 5-class graduated ramp.
// Field: VALUE_12 (the column is literally "VALUE_12"; the service aliases it
// as "VALUE_1" in the renderer but L.esri.featureLayer returns the real name).
// Breaks and colors match the ArcGIS classBreaks renderer exactly.
// An extra "No data" entry handles null / zero values.
const TH_AG_EXP_BREAKS = [
  { min: 0,               max: 4230748.092123,   color: '#EAF3F8', label: 'Very low increase',  border: true },
  { min: 4230748.092124,  max: 10434999.204721,  color: '#B9D7EA', label: 'Low increase' },
  { min: 10434999.204722, max: 19686077.901982,  color: '#9E8AC6', label: 'Moderate increase' },
  { min: 19686077.901983, max: 63101331.304162,  color: '#8E3FA8', label: 'High increase' },
  { min: 63101331.304163, max: Infinity,         color: '#7A0177', label: 'Very high increase' },
];
// Separate no-data entry (not part of classification loop)
const TH_AG_EXP_NODATA = { color: '#D1D5DB', label: 'No data', border: true };

// Urban proximity risk — 5-class graduated ramp.
// Field: NEAR_DIST (normalized proximity distance to urban areas).
// Scale is INVERTED: smaller (more negative) NEAR_DIST = closer to urban = higher risk.
// Break thresholds derived from the published classBreaks renderer.
// Index 0 = lowest risk (yellow), index 4 = highest risk (dark red).
const TH_URBAN_RISK_CLASSES = [
  { color: '#FFF7BC', label: 'Very low risk',  border: true },  // NEAR_DIST > 0.082391
  { color: '#FEC44F', label: 'Low risk' },                      // 0.046735 – 0.082391
  { color: '#FE9929', label: 'Moderate risk' },                 // 0.018562 – 0.046734
  { color: '#D95F0E', label: 'High risk' },                     // -0.999999 – 0.018561
  { color: '#B10026', label: 'Very high risk' },                // ≤ -1 (within / adjacent to urban)
];
const TH_URBAN_RISK_NODATA = { color: '#D1D5DB', label: 'No data', border: true };

// Fire frequency by páramo — 5-class natural-breaks ramp.
// Field: fire_density_km2 (fire events per km² over the study period).
// Break values and colors match the ArcGIS Pro classBreaks renderer exactly.
const TH_FIRE_FREQ_BREAKS = [
  { min: 0,        max: 0.020954, color: '#FFF7EC', label: 'Very low',  border: true },
  { min: 0.020955, max: 0.116200, color: '#FDD49E', label: 'Low' },
  { min: 0.116201, max: 0.200816, color: '#FC8D59', label: 'Moderate' },
  { min: 0.200817, max: 0.463644, color: '#E34A33', label: 'High' },
  { min: 0.463645, max: Infinity,  color: '#B30000', label: 'Very high' },
];
const TH_FIRE_FREQ_NODATA = { color: '#D1D5DB', label: 'No data', border: true };

// Fire density kernel legend — matches the graduated ramp of the MapServer raster.
// Entries listed from transparent (lowest) to darkest red (highest density).
const TH_FIRE_DENSITY_LEGEND = [
  { color: 'transparent', label: 'No fire detected', border: true },
  { color: '#FEE5D9', label: 'Very low density' },
  { color: '#FCBBA1', label: 'Low density' },
  { color: '#FB6A4A', label: 'Moderate density' },
  { color: '#CB181D', label: 'High density' },
  { color: '#7F0000', label: 'Very high density' },
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
let _thParamoRefLayer  = null;          // featureLayer — páramo reference (threat mode only)

// Floating legend DOM node
let _thLegendEl        = null;

// Basemap simplification state (captured before hiding hillshade)
let _thBasemapState    = null;

// ── Fire pressure state ───────────────────────────────────────────────────
let _thFireMode        = 'density';  // 'density' | 'points' | 'frequency'
let _thFireYear        = 2024;       // current year (integer, 2012–2024)
let _thFirePlayInterval = null;      // setInterval handle for animation
let _thFireDateField   = null;       // detected date/year field name in fire_points_paramo
let _thFireDateFieldType = null;     // 'date' | 'numeric' (drives WHERE clause format)
let _thFireDensityLayer    = null;   // L.tileLayer — fire density kernel raster
let _thFirePointsLayer    = null;   // L.geoJSON — fire points (direct query, filtered by year)
let _thFireFreqLayer      = null;   // L.esri.featureLayer — fire frequency by páramo
let _thFireParamoRefLayer = null;   // L.esri.featureLayer — páramo reference outline (all fire sub-modes)

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

  // 4. Remove opaque background layers — ArcGIS VT styles often include a
  //    background fill layer with opacity:1.  If we leave it, the entire GL
  //    canvas fills with a solid colour and hides the Leaflet basemap.
  if (Array.isArray(style.layers)) {
    style.layers.forEach(layer => {
      if (layer.type === 'background') {
        if (!layer.paint) layer.paint = {};
        layer.paint['background-opacity'] = 0;
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
  const _perfKey = `[perf] load:threats:${label}`;
  console.time(_perfKey);
  console.log(`[threats.js] Loading Threats layer: ${label}`);

  if (!_thGlMap || !_thGlContainer) {
    console.warn('[threats.js] GL canvas not ready — cannot load VT layer');
    return;
  }

  // Same URL already displayed — just ensure it is visible
  if (_thCurrentVtUrl === url) {
    // resize() in case the canvas was ever 0×0
    _thGlMap.resize();
    _thGlContainer.style.opacity = '0.9';
    return;
  }

  // Claim this load slot; any in-flight load with a lower gen will abort
  const gen = ++_thLoadGeneration;

  // Fade out during transition (opacity only — never touch display)
  _thGlContainer.style.opacity = '0';

  // Ensure the GL canvas has correct dimensions before setStyle().
  // This is critical when the panel was hidden on first init.
  _thGlMap.resize();

  try {
    const style = await _thFetchStyle(url);

    // Abort if a newer load started while we were fetching
    if (gen !== _thLoadGeneration) return;

    // 3-second fallback: force-show even if 'style.load' never fires
    let fadeInDone = false;
    const fadeInTimeout = setTimeout(() => {
      if (gen !== _thLoadGeneration || fadeInDone) return;
      fadeInDone = true;
      _thGlMap.resize();
      _thGlContainer.style.opacity = '0.9';
      console.log(`[threats.js] Threats layer shown (fallback timer): ${label}`);
    }, 3000);

    _thGlMap.once('style.load', () => {
      if (gen !== _thLoadGeneration) { clearTimeout(fadeInTimeout); return; }
      clearTimeout(fadeInTimeout);
      if (!fadeInDone) {
        fadeInDone = true;
        _thGlMap.resize();   // re-confirm dimensions after style swap
        _thGlContainer.style.opacity = '0.9';
        console.timeEnd(_perfKey);
        console.log(`[threats.js] Threats layer loaded: ${label}`);
      }
    });

    _thGlMap.setStyle(style);
    _thCurrentVtUrl = url;
    _syncThreatsGL();  // re-sync position after style change

  } catch (err) {
    console.error(`[threats.js] Threats layer failed: ${label} — ${err.message}`);
    if (gen === _thLoadGeneration) {
      // Keep canvas invisible via opacity; do NOT set display:none
      _thGlContainer.style.opacity = '0';
      _thCurrentVtUrl = null;
    }
  }
}

// Hide the VT canvas without destroying the GL instance.
// Opacity-only: never set display:none (would re-introduce the 0×0 canvas bug).
function _thHideVtLayer() {
  if (_thGlContainer) {
    _thGlContainer.style.opacity = '0';
    // deliberately NOT touching display
  }
  _thCurrentVtUrl = null;
  _thLoadGeneration++;  // cancel any in-flight load
}

// ============================================================
// OVERLAY MANAGEMENT — clear everything before switching modes
// ============================================================

function _thClearFireLayers() {
  // Stop any running animation
  if (_thFirePlayInterval) {
    clearInterval(_thFirePlayInterval);
    _thFirePlayInterval = null;
  }
  // Reset play button label if it exists in DOM
  const playBtn = document.getElementById('th-fire-play-btn');
  if (playBtn) playBtn.textContent = '▶ Play';

  if (_thFireParamoRefLayer && _thMap) {
    if (_thMap.hasLayer(_thFireParamoRefLayer)) _thMap.removeLayer(_thFireParamoRefLayer);
    _thFireParamoRefLayer = null;
  }
  if (_thFireDensityLayer && _thMap) {
    if (_thMap.hasLayer(_thFireDensityLayer)) _thMap.removeLayer(_thFireDensityLayer);
    _thFireDensityLayer = null;
  }
  if (_thFirePointsLayer && _thMap) {
    if (_thMap.hasLayer(_thFirePointsLayer)) _thMap.removeLayer(_thFirePointsLayer);
    _thFirePointsLayer = null;
  }
  if (_thFireFreqLayer && _thMap) {
    if (_thMap.hasLayer(_thFireFreqLayer)) _thMap.removeLayer(_thFireFreqLayer);
    _thFireFreqLayer = null;
  }
}

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

  // FeatureLayer — páramo reference underlay (threat mode only)
  if (_thParamoRefLayer && _thMap) {
    if (_thMap.hasLayer(_thParamoRefLayer)) _thMap.removeLayer(_thParamoRefLayer);
    _thParamoRefLayer = null;
  }

  // Fire layers
  _thClearFireLayers();
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
  // Reset mode-specific modifier classes before applying new content
  el.classList.remove('th-legend--landcover');

  switch (mode) {

    case 'landcover': {
      // Colors and labels derived directly from the LCPoly VectorTileServer
      // style (root.json _symbol values) — exact hex match to service symbology.
      el.classList.add('th-legend--landcover');
      el.innerHTML = `
        <div class="th-legend-title">🗂 Land Cover · ${_thYear}</div>
        <div class="th-legend-rows">
          ${TH_LANDCOVER_CLASSES.map(c =>
            `<div class="th-legend-row">
               <span class="th-swatch" style="background:${c.color}${c.border ? ';border:1px solid #bbb' : ''}"></span>
               ${c.label}
             </div>`
          ).join('')}
        </div>
        <div class="th-legend-note">
          MapBiomas Colombia · páramo buffer zone · ${_thYear}.
          Colors match the published ArcGIS style exactly.
        </div>
      `;
      break;
    }

    case 'threat': {
      const cat = TH_CATEGORIES[_thCategory];
      // vtColor = actual fill color from the published VectorTileServer style JSON
      const vc  = cat.vtColor;
      el.innerHTML = `
        <div class="th-legend-title" style="color:${vc}">${cat.icon} ${cat.label} · ${_thYear}</div>
        <div class="th-legend-rows">
          <div class="th-legend-row">
            <span class="th-swatch th-swatch--empty"></span>
            No presence detected
          </div>
          <div class="th-legend-row">
            <span class="th-swatch" style="background:${vc}"></span>
            ${cat.label} presence
          </div>
          <div class="th-legend-row" style="margin-top:3px;padding-top:3px;border-top:1px solid rgba(0,0,0,0.07)">
            <span class="th-swatch" style="background:#F5ECC8;border:1px solid #5A7A3A"></span>
            Páramo boundary
          </div>
        </div>
        <div class="th-legend-note">
          VectorTileServer · ${cat.label.toLowerCase()} presence · ${_thYear}.
          ${(_thCategory === 'pasture' && _thYear === '2000') ? '<br><em>⚠ Pasture 2000 uses the 2020 layer.</em>' : ''}
        </div>
      `;
      break;
    }

    case 'agexpansion': {
      el.innerHTML = `
        <div class="th-legend-title">🌾 Agriculture Expansion by Páramo</div>
        <div class="th-legend-rows">
          ${TH_AG_EXP_BREAKS.map(c =>
            `<div class="th-legend-row">
               <span class="th-swatch" style="background:${c.color}${c.border ? ';border:1px solid #aaa' : ''}"></span>
               ${c.label}
             </div>`
          ).join('')}
          <div class="th-legend-row">
            <span class="th-swatch" style="background:${TH_AG_EXP_NODATA.color};border:1px solid #bbb"></span>
            ${TH_AG_EXP_NODATA.label}
          </div>
        </div>
        <div class="th-legend-note">
          Agriculture expansion per páramo complex (field: VALUE_12, m²).
          Graduated blue → purple ramp · 5 natural-break classes.
        </div>
      `;
      break;
    }

    case 'urbanrisk': {
      el.innerHTML = `
        <div class="th-legend-title">🏙 Urban Proximity Risk</div>
        <div class="th-legend-rows">
          ${TH_URBAN_RISK_CLASSES.map(c =>
            `<div class="th-legend-row">
               <span class="th-swatch" style="background:${c.color}${c.border ? ';border:1px solid #aaa' : ''}"></span>
               ${c.label}
             </div>`
          ).join('')}
          <div class="th-legend-row">
            <span class="th-swatch" style="background:${TH_URBAN_RISK_NODATA.color};border:1px solid #bbb"></span>
            ${TH_URBAN_RISK_NODATA.label}
          </div>
        </div>
        <div class="th-legend-note">
          Field: NEAR_DIST · lower value = closer to urban = higher risk.
          Yellow → red graduated ramp · 5 natural-break classes.
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

    case 'fire-density': {
      el.innerHTML = `
        <div class="th-legend-title">🔥 Fire Density Kernel</div>
        <div class="th-legend-rows">
          ${TH_FIRE_DENSITY_LEGEND.map(c =>
            `<div class="th-legend-row">
               <span class="th-swatch" style="background:${c.color}${c.border ? ';border:1px solid #ccc' : ''}"></span>
               ${c.label}
             </div>`
          ).join('')}
        </div>
        <div class="th-legend-note">
          VIIRS/MODIS fire density kernel · páramo buffer zone.
          Raster shows relative fire event concentration.
        </div>
      `;
      break;
    }

    case 'fire-points': {
      el.innerHTML = `
        <div class="th-legend-title">📍 Fire Points · ${_thFireYear}</div>
        <div class="th-legend-rows">
          <div class="th-legend-row">
            <span class="th-swatch th-swatch--circle" style="background:#C2410C;border:2px solid #FFF3B0"></span>
            Fire detection (VIIRS/MODIS)
          </div>
        </div>
        <div class="th-legend-note">
          Individual fire detections · ${_thFireYear}.
          Use slider to animate 2012 – 2024.
        </div>
      `;
      break;
    }

    case 'fire-frequency': {
      el.innerHTML = `
        <div class="th-legend-title">📊 Fire Frequency by Páramo</div>
        <div class="th-legend-rows">
          ${TH_FIRE_FREQ_BREAKS.map(c =>
            `<div class="th-legend-row">
               <span class="th-swatch" style="background:${c.color}${c.border ? ';border:1px solid #ccc' : ''}"></span>
               ${c.label}
             </div>`
          ).join('')}
          <div class="th-legend-row">
            <span class="th-swatch" style="background:${TH_FIRE_FREQ_NODATA.color};border:1px solid #bbb"></span>
            ${TH_FIRE_FREQ_NODATA.label}
          </div>
        </div>
        <div class="th-legend-note">
          Field: fire_density_km2 · fire events per km² · 5 classes.
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

// ── Páramo reference underlay (threat mode only) ──────────────────────────
// Loaded once per threat-mode activation (idempotent).  Sits in threatsRefPane
// (z=455), which is above the basemap overlay pane (400) but below the GL
// canvas (z=460), so the threat VT layer always draws on top of it.
function _thShowParamoRef() {
  if (_thParamoRefLayer) return;   // already on map from a previous year/cat switch

  _thParamoRefLayer = L.esri.featureLayer({
    url:  PARAMO_REFERENCE_URL,
    pane: 'threatsRefPane',
    style() {
      return {
        fillColor:   '#F5ECC8',   // pale cream — very subtle
        fillOpacity: 0.15,
        color:       '#5A7A3A',   // muted dark-green outline
        weight:      1.0,
        opacity:     0.65,
      };
    },
    // No popups/tooltips — this is a silent reference layer
  });

  _thParamoRefLayer.addTo(_thMap);
  _thParamoRefLayer.once('load', () =>
    console.log('[threats.js] Páramo reference layer loaded')
  );
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
  _thShowParamoRef();   // add subtle páramo boundary underlay (z=455, below GL canvas)
  _thLoadVtLayer(url, `${cat ? cat.label : 'Threat'} ${_thYear}`);
  _thShowLegend('threat');
}

// ── Agriculture expansion helpers ────────────────────────────────────────
// The FeatureServer column is VALUE_12 (aliased "VALUE_1" in ArcGIS Pro —
// L.esri.featureLayer returns the real column name in feature.properties).

function _agExpBreakForValue(val) {
  const v = Number(val);
  if (val === null || val === undefined || isNaN(v)) return null;   // no-data
  for (const b of TH_AG_EXP_BREAKS) {
    if (v <= b.max) return b;
  }
  return TH_AG_EXP_BREAKS[TH_AG_EXP_BREAKS.length - 1];
}

function _agExpColorForValue(val) {
  const b = _agExpBreakForValue(val);
  return b ? b.color : TH_AG_EXP_NODATA.color;
}

function _agExpLabelForValue(val) {
  const b = _agExpBreakForValue(val);
  return b ? b.label : TH_AG_EXP_NODATA.label;
}

// C. Agriculture expansion by páramo — FeatureServer polygon layer
function _thApplyAgExpansion() {
  _thClearOverlays();
  _thRestoreBasemap();

  console.time('[perf] load:threats:Ag expansion by páramo');
  console.log('[threats.js] Loading Threats layer: Agriculture expansion by páramo');
  console.log('[threats.js] Ag-expansion field: VALUE_12 (service alias: VALUE_1)');

  _thAgExpLayer = L.esri.featureLayer({
    url:  AGRICULTURE_EXPANSION_PARAMOS_URL,
    pane: 'threatsPane',
    style(feature) {
      // Real column name returned by L.esri is VALUE_12 (alias VALUE_1 in ArcGIS Pro)
      const val = feature.properties?.VALUE_12 ?? feature.properties?.VALUE_1 ?? null;
      const isNoData = (val === null || val === undefined || Number(val) === 0);
      if (isNoData) {
        return {
          fillColor:   TH_AG_EXP_NODATA.color,
          fillOpacity: 0.45,
          color:       'rgba(255,255,255,0.7)',
          weight:      0.6,
          opacity:     1,
        };
      }
      return {
        fillColor:   _agExpColorForValue(val),
        fillOpacity: 0.75,
        color:       'rgba(255,255,255,0.7)',
        weight:      0.6,
        opacity:     1,
      };
    },
    onEachFeature(feature, layer) {
      const p       = feature.properties || {};
      const name    = p.pacomplejo || p.pacodigo || p.Nombre || p.nombre || p.name || 'Páramo';
      // VALUE_12 is the real column; VALUE_1 is its alias — try both
      const rawVal  = p.VALUE_12 ?? p.VALUE_1 ?? null;
      const catLabel = _agExpLabelForValue(rawVal);
      const valFmt   = rawVal != null
        ? Number(rawVal).toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' m²'
        : '—';

      layer.bindTooltip(
        `<strong style="color:#8E3FA8;font-size:12px">${name}</strong>`,
        { sticky: true, direction: 'top', opacity: 1 }
      );
      layer.bindPopup(`
        <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                    padding:10px 13px;min-width:210px">
          <h4 style="margin:0 0 6px;font-size:13px;color:#C8A840;
                     border-bottom:1px solid #eee;padding-bottom:5px">${name}</h4>
          <table style="width:100%;font-size:12px;border-collapse:collapse">
            <tr>
              <td style="color:#888;padding:2px 0">Agriculture expansion</td>
              <td style="font-weight:700;text-align:right">${valFmt}</td>
            </tr>
            <tr>
              <td style="color:#888;padding:2px 0">Category</td>
              <td style="font-weight:700;text-align:right">${catLabel}</td>
            </tr>
          </table>
        </div>
      `, { maxWidth: 280 });

      layer.on('click', function() {
        console.log(`[threats.js] Ag-expansion clicked: ${name} | VALUE_12=${rawVal} | category="${catLabel}"`);
      });
      layer.on('mouseover', function() {
        if (window._mapMoving) return;
        this.setStyle({ fillOpacity: 0.92, color: '#1F2937', weight: 2 });
        this.bringToFront();
      });
      layer.on('mouseout', function() {
        if (_thAgExpLayer) _thAgExpLayer.resetStyle(this);
      });
    },
  });

  _thAgExpLayer.addTo(_thMap);
  _thAgExpLayer.once('load', () => {
    console.timeEnd('[perf] load:threats:Ag expansion by páramo');
    console.log('[threats.js] Threats layer loaded: Agriculture expansion');
  });
  _thAgExpLayer.on('requesterror', (e) => console.error('[threats.js] Threats layer failed: Agriculture expansion —', e));
  _thShowLegend('agexpansion');
}

// ── Urban risk classifier ─────────────────────────────────────────────────
// Field: NEAR_DIST (normalized proximity distance to urban areas).
// Scale is INVERTED: lower (more negative) value = closer to urban = higher risk.
// Break thresholds match the published classBreaks renderer on ParamosProximitytourbanrisk.
// Returns { idx, label } — idx is an index into TH_URBAN_RISK_CLASSES (0=very low, 4=very high).
function _urbanRiskClassify(nearDist) {
  if (nearDist === null || nearDist === undefined) return { idx: null, label: 'No data' };
  const v = Number(nearDist);
  if (isNaN(v))   return { idx: null, label: 'No data' };
  if (v <= 0.018561)  return { idx: 4, label: 'Very high risk' };  // includes -1 (within/adjacent urban)
  if (v <= 0.046734)  return { idx: 3, label: 'High risk' };
  if (v <= 0.082391)  return { idx: 2, label: 'Moderate risk' };
  if (v <= 0.554609)  return { idx: 1, label: 'Low risk' };
  return                   { idx: 0, label: 'Very low risk' };
}

// D. Urban proximity risk — FeatureServer polygon layer
function _thApplyUrbanRisk() {
  _thClearOverlays();
  _thRestoreBasemap();

  console.time('[perf] load:threats:Urban risk by páramo');
  console.log('[threats.js] Loading Threats layer: Urban proximity risk by páramo');
  console.log('[threats.js] Urban-risk field: NEAR_DIST (lower = closer to urban = higher risk)');

  _thUrbanRiskLayer = L.esri.featureLayer({
    url:  URBAN_RISK_PARAMOS_URL,
    pane: 'threatsPane',
    style(feature) {
      const nearDist = feature.properties?.NEAR_DIST ?? null;
      const { idx }  = _urbanRiskClassify(nearDist);
      if (idx === null) {
        return {
          fillColor:   TH_URBAN_RISK_NODATA.color,
          fillOpacity: 0.45,
          color:       'rgba(255,255,255,0.7)',
          weight:      0.6,
          opacity:     1,
        };
      }
      return {
        fillColor:   TH_URBAN_RISK_CLASSES[idx].color,
        fillOpacity: 0.72,
        color:       'rgba(255,255,255,0.7)',
        weight:      0.6,
        opacity:     1,
      };
    },
    onEachFeature(feature, layer) {
      const p         = feature.properties || {};
      const name      = p.pacomplejo || p.pacodigo || p.Nombre || p.nombre || p.name || 'Páramo';
      const nearDist  = p.NEAR_DIST ?? null;
      const { label: riskLabel } = _urbanRiskClassify(nearDist);
      const nearFmt   = nearDist != null ? Number(nearDist).toFixed(6) : '—';

      layer.bindTooltip(
        `<strong style="color:#D95F0E;font-size:12px">${name}</strong>`,
        { sticky: true, direction: 'top', opacity: 1 }
      );
      layer.bindPopup(`
        <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                    padding:10px 13px;min-width:210px">
          <h4 style="margin:0 0 6px;font-size:13px;color:#C8A840;
                     border-bottom:1px solid #eee;padding-bottom:5px">${name}</h4>
          <table style="width:100%;font-size:12px;border-collapse:collapse">
            <tr>
              <td style="color:#888;padding:2px 0">Urban proximity risk</td>
              <td style="font-weight:700;text-align:right">${riskLabel}</td>
            </tr>
            <tr>
              <td style="color:#888;padding:2px 0">NEAR_DIST value</td>
              <td style="font-weight:700;text-align:right">${nearFmt}</td>
            </tr>
          </table>
        </div>
      `, { maxWidth: 280 });

      layer.on('click', function() {
        console.log(`[threats.js] Urban-risk clicked: ${name} | NEAR_DIST=${nearDist} | category="${riskLabel}"`);
      });
      layer.on('mouseover', function() {
        if (window._mapMoving) return;
        this.setStyle({ fillOpacity: 0.92, color: '#1F2937', weight: 2 });
        this.bringToFront();
      });
      layer.on('mouseout', function() {
        if (_thUrbanRiskLayer) _thUrbanRiskLayer.resetStyle(this);
      });
    },
  });

  _thUrbanRiskLayer.addTo(_thMap);
  _thUrbanRiskLayer.once('load', () => {
    console.timeEnd('[perf] load:threats:Urban risk by páramo');
    console.log('[threats.js] Threats layer loaded: Urban proximity risk');
    // Log a sample of properties from the first few features to confirm field names
    let sampleCount = 0;
    _thUrbanRiskLayer.eachFeature(lyr => {
      if (sampleCount++ < 2) {
        console.log('[threats.js] Urban-risk sample properties:', lyr.feature?.properties);
      }
    });
  });
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

// ── Fire: páramo reference outline (shown under all fire sub-modes) ──────
// Sits in fireRefPane (z=462) — above the density raster (threatsPane z=460)
// so the outline remains visible on top of any fire data layer.
// fillOpacity=0: outlines only, no fill obstruction.

function _thShowFireParamoRef() {
  // Already on map — don't re-add
  if (_thFireParamoRefLayer && _thMap.hasLayer(_thFireParamoRefLayer)) return;
  // Orphaned ref from a previous clear — clean up before re-adding
  if (_thFireParamoRefLayer) {
    _thMap.removeLayer(_thFireParamoRefLayer);
    _thFireParamoRefLayer = null;
  }

  console.log('[threats.js] Adding fire páramo reference outline (fireRefPane z=462)');

  _thFireParamoRefLayer = L.esri.featureLayer({
    url:  PARAMO_REFERENCE_URL,
    pane: 'fireRefPane',
    style() {
      return {
        fillOpacity: 0,
        color:       '#C8A64A',   // muted gold — páramo boundary context
        weight:      1.0,
        opacity:     0.65,
      };
    },
    // Silent reference layer — no popups or tooltips
  });

  _thFireParamoRefLayer.addTo(_thMap);
  _thFireParamoRefLayer.once('load', () =>
    console.log('[threats.js] Fire páramo reference outline loaded')
  );
}

// ── Fire: date/year field auto-detection ─────────────────────────────────
// Fetches the FeatureServer layer metadata and identifies which field
// holds fire date/year information.  Sets _thFireDateField and
// _thFireDateFieldType so WHERE clauses can be formed correctly.

async function _thDetectFireDateField() {
  if (_thFireDateField) return;   // already detected

  const metaUrl = `${FIRE_POINTS_URL}/0?f=json`;
  console.log('[threats.js] Detecting fire date field from:', metaUrl);

  let fields = [];
  try {
    const resp = await fetch(metaUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    fields = json.fields || [];
    console.log('[threats.js] Fire points fields:', fields.map(f => `${f.name} (${f.type})`));
  } catch (e) {
    console.error('[threats.js] Could not fetch fire points metadata:', e.message);
    return;
  }

  // Candidates in priority order: exact date fields first, then numeric year
  const dateCandidates  = ['ACQ_DATE', 'acq_date', 'DATE', 'date', 'timestamp', 'TIMESTAMP'];
  const yearCandidates  = ['YEAR', 'year', 'FireYear', 'FIRE_YEAR'];

  const fieldNames = fields.map(f => f.name);

  for (const c of dateCandidates) {
    if (fieldNames.includes(c)) {
      _thFireDateField     = c;
      _thFireDateFieldType = 'date';
      console.log(`[threats.js] Fire date field detected: ${c} (type: date)`);
      return;
    }
  }
  for (const c of yearCandidates) {
    if (fieldNames.includes(c)) {
      _thFireDateField     = c;
      _thFireDateFieldType = 'numeric';
      console.log(`[threats.js] Fire date field detected: ${c} (type: numeric)`);
      return;
    }
  }

  console.warn('[threats.js] No date/year field found in fire points layer — will show all years');
}

// Build a WHERE clause string for the given year, based on detected field type.
function _thFireWhereForYear(year) {
  if (!_thFireDateField) return '1=1';
  if (_thFireDateFieldType === 'date') {
    return `${_thFireDateField} >= DATE '${year}-01-01' AND ${_thFireDateField} <= DATE '${year}-12-31'`;
  }
  // numeric year field
  return `${_thFireDateField} = ${year}`;
}

// ── Fire sub-mode: density kernel (MapServer raster tiled layer) ─────────
function _thShowFireDensity() {
  console.time('[perf] load:threats:Fire density kernel');
  console.log('[threats.js] Loading fire density kernel (MapServer tiled)');

  // Use L.tileLayer with ArcGIS MapServer tile URL pattern
  _thFireDensityLayer = L.tileLayer(
    `${FIRE_DENSITY_KERNEL_URL}/tile/{z}/{y}/{x}`,
    {
      opacity:     0.72,
      pane:        'threatsPane',
      attribution: 'Fire density — VIIRS/MODIS via ArcGIS Online',
      maxZoom:     18,
    }
  );

  _thFireDensityLayer.addTo(_thMap);
  _thFireDensityLayer.once('load', () => {
    console.timeEnd('[perf] load:threats:Fire density kernel');
    console.log('[threats.js] Fire density kernel loaded');
  });
  _thFireDensityLayer.on('tileerror', (e) =>
    console.error('[threats.js] Fire density kernel tile error:', e)
  );

  _thShowLegend('fire-density');
}

// ── Fire sub-mode: points over time (direct FeatureServer query → L.geoJSON) ──
// Direct query approach: fetches only the filtered features for the active year
// as GeoJSON, then renders them as L.geoJSON.  This guarantees no unfiltered
// "ghost" layer from the server's own renderer appears behind the custom markers.
// The existing _thFirePointsLayer is always removed before re-querying so there
// are never two point layers on the map simultaneously.

async function _thShowFirePoints() {
  const perfKey = `[perf] load:threats:Fire points ${_thFireYear}`;
  console.time(perfKey);
  console.log(`[threats.js] Querying fire points for year ${_thFireYear}`);

  // Always remove any existing points layer before adding a new one
  if (_thFirePointsLayer && _thMap) {
    if (_thMap.hasLayer(_thFirePointsLayer)) _thMap.removeLayer(_thFirePointsLayer);
    _thFirePointsLayer = null;
  }

  // Detect date field (cached after first call)
  await _thDetectFireDateField();

  const where = _thFireWhereForYear(_thFireYear);
  console.log(`[threats.js] Fire points field: "${_thFireDateField}" (${_thFireDateFieldType}) | year: ${_thFireYear} | WHERE: ${where}`);

  // Direct FeatureServer query — returns GeoJSON, bypasses server renderer entirely
  const queryUrl = `${FIRE_POINTS_URL}/0/query?` + new URLSearchParams({
    where,
    outFields:         '*',
    f:                 'geojson',
    returnGeometry:    'true',
    resultRecordCount: '4000',  // request up to 4000 features per year
  }).toString();

  let geojson;
  try {
    const resp = await fetch(queryUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} — ${queryUrl}`);
    geojson = await resp.json();
  } catch (e) {
    console.error('[threats.js] Fire points query failed:', e.message);
    console.timeEnd(perfKey);
    return;
  }

  const count = geojson.features?.length ?? 0;
  console.log(`[threats.js] Fire points loaded: ${count} features for year ${_thFireYear}`);

  if (count === 0) {
    console.warn(`[threats.js] Fire points: no features returned for year ${_thFireYear} — WHERE="${where}"`);
  }

  // Render as L.geoJSON — no server symbology, pure client-side rendering
  _thFirePointsLayer = L.geoJSON(geojson, {
    pane: 'threatsPane',
    pointToLayer(feature, latlng) {
      return L.circleMarker(latlng, {
        radius:      3.5,
        fillColor:   '#C2410C',   // orange-red — VIIRS/MODIS fire
        color:       '#FFF3B0',   // pale yellow outline
        weight:      0.5,
        fillOpacity: 0.85,
        opacity:     1,
      });
    },
    onEachFeature(feature, layer) {
      const p = feature.properties || {};
      // Use the detected field first; fall back to common alternatives
      const dateVal    = (_thFireDateField && p[_thFireDateField] != null)
                         ? p[_thFireDateField]
                         : (p.ACQ_DATE ?? p.acq_date ?? p.YEAR ?? p.year ?? '—');
      const confidence = p.CONFIDENCE ?? p.confidence ?? p.FRP ?? '—';
      const bright_ti4 = p.BRIGHT_TI4 ?? p.bright_ti4 ?? '—';

      layer.bindPopup(`
        <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                    padding:8px 11px;min-width:180px">
          <h4 style="margin:0 0 5px;font-size:12px;color:#C2410C;
                     border-bottom:1px solid #eee;padding-bottom:4px">🔥 Fire Detection</h4>
          <table style="width:100%;font-size:11px;border-collapse:collapse">
            <tr>
              <td style="color:#888;padding:2px 0">Date / Year</td>
              <td style="font-weight:700;text-align:right">${dateVal}</td>
            </tr>
            <tr>
              <td style="color:#888;padding:2px 0">Confidence</td>
              <td style="font-weight:700;text-align:right">${confidence}</td>
            </tr>
            <tr>
              <td style="color:#888;padding:2px 0">Brightness</td>
              <td style="font-weight:700;text-align:right">${bright_ti4}</td>
            </tr>
          </table>
        </div>
      `, { maxWidth: 240 });
    },
  }).addTo(_thMap);

  console.timeEnd(perfKey);
  _thShowLegend('fire-points');
}

// ── Fire sub-mode: frequency by páramo (FeatureServer polygon) ───────────
// Styled client-side using fire_density_km2 with exact ArcGIS Pro class breaks.
// Both lower-case and upper-case field name variants are tried to handle
// any service aliasing.

function _thShowFireFrequency() {
  console.time('[perf] load:threats:Fire frequency by páramo');
  console.log('[threats.js] Loading fire frequency by páramo | field: fire_density_km2');

  // Classifier — uses exact break values provided in TH_FIRE_FREQ_BREAKS
  function _fireFreqBreak(val) {
    const v = Number(val);
    if (val === null || val === undefined || isNaN(v)) return null;
    for (const b of TH_FIRE_FREQ_BREAKS) {
      if (v <= b.max) return b;
    }
    return TH_FIRE_FREQ_BREAKS[TH_FIRE_FREQ_BREAKS.length - 1];
  }

  // Resolve the fire_density_km2 value from a feature — try both case variants
  function _fireFreqVal(props) {
    const p = props || {};
    return p.fire_density_km2 ?? p.FIRE_DENSITY_KM2 ?? p.Fire_Density_km2 ?? null;
  }

  _thFireFreqLayer = L.esri.featureLayer({
    url:  `${FIRE_FREQUENCY_PARAMO_URL}/0`,
    pane: 'threatsPane',
    style(feature) {
      const val = _fireFreqVal(feature.properties);
      const brk = _fireFreqBreak(val);
      if (!brk) {
        return {
          fillColor:   TH_FIRE_FREQ_NODATA.color,
          fillOpacity: 0.45,
          color:       'rgba(255,255,255,0.7)',
          weight:      0.7,
          opacity:     1,
        };
      }
      return {
        fillColor:   brk.color,
        fillOpacity: 0.72,
        color:       'rgba(255,255,255,0.7)',
        weight:      0.7,
        opacity:     1,
      };
    },
    onEachFeature(feature, layer) {
      const p    = feature.properties || {};
      const name = p.pacomplejo || p.pacodigo || p.Nombre || p.nombre || p.name || 'Páramo';
      const val  = _fireFreqVal(p);
      const brk  = _fireFreqBreak(val);
      const cat  = brk ? brk.label : TH_FIRE_FREQ_NODATA.label;
      const valFmt = val != null
        ? Number(val).toFixed(6) + ' fires/km²'
        : '—';

      layer.bindTooltip(
        `<strong style="color:#E34A33;font-size:12px">${name}</strong>`,
        { sticky: true, direction: 'top', opacity: 1 }
      );
      layer.bindPopup(`
        <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                    padding:10px 13px;min-width:210px">
          <h4 style="margin:0 0 6px;font-size:13px;color:#C8A840;
                     border-bottom:1px solid #eee;padding-bottom:5px">${name}</h4>
          <table style="width:100%;font-size:12px;border-collapse:collapse">
            <tr>
              <td style="color:#888;padding:2px 0">fire_density_km2</td>
              <td style="font-weight:700;text-align:right">${valFmt}</td>
            </tr>
            <tr>
              <td style="color:#888;padding:2px 0">Category</td>
              <td style="font-weight:700;text-align:right">${cat}</td>
            </tr>
          </table>
        </div>
      `, { maxWidth: 280 });

      layer.on('click', function() {
        console.log(`[threats.js] Fire-freq click: "${name}" | fire_density_km2=${val} | category="${cat}" | color=${brk ? brk.color : 'nodata'}`);
      });
      layer.on('mouseover', function() {
        if (window._mapMoving) return;
        this.setStyle({ fillOpacity: 0.92, color: '#1F2937', weight: 2 });
        this.bringToFront();
      });
      layer.on('mouseout', function() {
        if (_thFireFreqLayer) _thFireFreqLayer.resetStyle(this);
      });
    },
  });

  _thFireFreqLayer.addTo(_thMap);
  _thFireFreqLayer.once('load', () => {
    console.timeEnd('[perf] load:threats:Fire frequency by páramo');
    // Log the first 3 feature property sets to confirm field names in service response
    let n = 0;
    _thFireFreqLayer.eachFeature(lyr => {
      if (n++ < 3) {
        const p   = lyr.feature?.properties || {};
        const val = _fireFreqVal(p);
        const brk = _fireFreqBreak(val);
        console.log(`[threats.js] Fire-freq sample [${n}]: fire_density_km2=${val} → category="${brk ? brk.label : 'nodata'}" | all props:`, p);
      }
    });
    console.log(`[threats.js] Fire frequency by páramo loaded`);
  });
  _thFireFreqLayer.on('requesterror', (e) =>
    console.error('[threats.js] Fire frequency layer error:', e)
  );

  _thShowLegend('fire-frequency');
}

// F. Fire pressure — sub-mode dispatcher
// Layer order:
//   threatsPane (z=460) — fire data layer (density raster / points / freq polygons)
//   fireRefPane  (z=462) — páramo reference outline on top for context
//   Leaflet popups       — always above via #map-popup-overlay (z=9000)

function _thApplyFire() {
  _thClearFireLayers();
  _thRestoreBasemap();

  // Add páramo outline first (goes into fireRefPane z=462).
  // It draws on top of the density raster and fire data so the boundary
  // is always visible with low weight and no fill obstruction.
  _thShowFireParamoRef();

  switch (_thFireMode) {
    case 'density':   _thShowFireDensity();   break;
    case 'points':    _thShowFirePoints();     break;
    case 'frequency': _thShowFireFrequency();  break;
    default:          _thShowFireDensity();    break;
  }
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

  // Fire sub-mode buttons
  document.querySelectorAll('.th-fire-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.fireMode === _thFireMode);
  });

  // Fire year section: only visible when sub-mode is 'points'
  const fireYearSec = document.getElementById('th-fire-year-section');
  if (fireYearSec) fireYearSec.style.display = (_thMode === 'fire' && _thFireMode === 'points') ? '' : 'none';

  // Fire year label + slider sync
  const fireYearLabel  = document.getElementById('th-fire-year-label');
  const fireYearSlider = document.getElementById('th-fire-year-slider');
  if (fireYearLabel)  fireYearLabel.textContent = _thFireYear;
  if (fireYearSlider) fireYearSlider.value       = _thFireYear;
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

  // Dedicated Leaflet pane for FeatureServer polygon layers.
  // z=460 matches the GL canvas so threats layer z-ordering is consistent.
  if (!_thMap.getPane('threatsPane')) {
    const pane = _thMap.createPane('threatsPane');
    pane.style.zIndex = 460;
    pane.style.pointerEvents = 'none';
  }

  // Reference underlay pane — sits BELOW the GL canvas (z=460) but ABOVE
  // the basemap overlay pane (z=400), so reference polygons are always behind
  // the active threat VT layer.
  if (!_thMap.getPane('threatsRefPane')) {
    const refPane = _thMap.createPane('threatsRefPane');
    refPane.style.zIndex = 455;
    refPane.style.pointerEvents = 'none';
  }

  // Fire reference pane — sits ABOVE threatsPane (z=460) so the páramo outline
  // is always visible on top of the fire density raster and fire data layers.
  // fillOpacity:0 + thin muted-gold stroke keeps it a lightweight context outline.
  if (!_thMap.getPane('fireRefPane')) {
    const fireRef = _thMap.createPane('fireRefPane');
    fireRef.style.zIndex = 462;
    fireRef.style.pointerEvents = 'none';
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

  // ── Fire sub-mode buttons ──
  document.querySelectorAll('.th-fire-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _thFireMode = btn.dataset.fireMode;
      _updateThreatsUI();
      if (_thMode === 'fire') _thApplyFire();
    });
  });

  // ── Fire year slider ──
  const fireSlider = document.getElementById('th-fire-year-slider');
  if (fireSlider) {
    fireSlider.addEventListener('input', () => {
      _thFireYear = parseInt(fireSlider.value, 10);
      _updateThreatsUI();
      // Re-query the FeatureServer for the new year (removes old L.geoJSON + fetches fresh)
      if (_thMode === 'fire' && _thFireMode === 'points') {
        _thShowFirePoints();
      }
    });
  }

  // ── Fire play/pause button ──
  const playBtn = document.getElementById('th-fire-play-btn');
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      if (_thFirePlayInterval) {
        // Pause
        clearInterval(_thFirePlayInterval);
        _thFirePlayInterval = null;
        playBtn.textContent = '▶ Play';
      } else {
        // Play: advance year every 1.8s, loop 2012→2024, re-query each step
        playBtn.textContent = '⏸ Pause';
        _thFirePlayInterval = setInterval(() => {
          _thFireYear = (_thFireYear >= 2024) ? 2012 : _thFireYear + 1;
          _updateThreatsUI();
          if (_thMode === 'fire' && _thFireMode === 'points') {
            _thShowFirePoints();   // re-query filtered GeoJSON for new year
          }
        }, 1800);
      }
    });
  }

  // Restore UI state from previous visit, then apply current mode
  _updateThreatsUI();
  _thApplyMode();
}

// ============================================================
// CLEANUP — called when leaving the threats panel
// ============================================================

function cleanupThreatsPanel() {
  _thClearOverlays();     // hides GL canvas, removes featureLayers, clears fire layers
  _thHideLegend();
  _thRestoreBasemap();    // restore hillshade if it was hidden
}

// ============================================================
// DEBUG HELPER — window.debugThreatLayer(category, year)
// Call from the browser console to diagnose layer loading issues.
// Examples:
//   debugThreatLayer('landcover', '2020')
//   debugThreatLayer('agriculture', '1986')
//   debugThreatLayer('agexpansion')
//   debugThreatLayer('urbanrisk')
//   debugThreatLayer('totalchange')
// ============================================================

window.debugThreatLayer = async function(category, year) {
  const yr  = String(year || _thYear || '2024');
  const cat = String(category || 'landcover');

  // Resolve the URL for this category/year
  let url = null;
  if (cat === 'landcover') {
    url = _thLandcoverUrlForYear(yr);
  } else if (cat === 'totalchange') {
    url = TOTAL_LANDCOVER_CHANGE_URL;
  } else if (cat === 'agexpansion') {
    url = AGRICULTURE_EXPANSION_PARAMOS_URL;
    console.group(`[debugThreatLayer] agexpansion (FeatureServer)`);
    console.log('  FeatureServer URL:', url);
    console.log('  Field used:        VALUE_12 (aliased as VALUE_1 in ArcGIS Pro)');
    console.log('  Break thresholds:');
    TH_AG_EXP_BREAKS.forEach((b, i) =>
      console.log(`    Class ${i + 1}: ${b.min.toLocaleString()} – ${b.max === Infinity ? '∞' : b.max.toLocaleString()} m²  → ${b.color}  (${b.label})`)
    );
    console.log('  Loading layer on map now…');
    console.groupEnd();
    _thApplyAgExpansion();
    return;
  } else if (cat === 'urbanrisk') {
    url = URBAN_RISK_PARAMOS_URL;
    console.group(`[debugThreatLayer] urbanrisk (FeatureServer)`);
    console.log('  FeatureServer URL:', url);
    console.log('  Field used:        NEAR_DIST (lower = closer to urban = higher risk)');
    console.log('  Break thresholds:');
    console.log('    NEAR_DIST ≤ 0.018561  → Very high risk  (#B10026)');
    console.log('    0.018562 – 0.046734   → High risk       (#D95F0E)');
    console.log('    0.046735 – 0.082391   → Moderate risk   (#FE9929)');
    console.log('    0.082392 – 0.554609   → Low risk        (#FEC44F)');
    console.log('    > 0.554609            → Very low risk   (#FFF7BC)');
    console.log('  Loading layer on map now…');
    console.groupEnd();
    _thApplyUrbanRisk();
    return;
  } else if (TH_CATEGORIES[cat]) {
    url = TH_CATEGORIES[cat].urls[yr];
  }

  if (!url) {
    console.error(`[debugThreatLayer] No URL for category="${cat}" year="${yr}"`);
    return;
  }

  const base     = url.replace(/\/+$/, '');
  const styleUrl = `${base}/resources/styles/root.json`;
  const tileUrl  = `${base}/tile/{z}/{y}/{x}.pbf`;

  console.group(`[debugThreatLayer] ${cat} / ${yr}`);
  console.log('  Service URL:       ', url);
  console.log('  Style JSON URL:    ', styleUrl);
  console.log('  PBF tile pattern:  ', tileUrl);

  // Check style JSON
  try {
    const resp = await fetch(styleUrl);
    if (!resp.ok) {
      console.error('  ✗ Style JSON fetch failed:', resp.status, resp.statusText);
    } else {
      const json = await resp.json();
      console.log('  ✓ Style JSON OK   — layers:', json.layers?.length ?? 0,
                  ' sources:', Object.keys(json.sources || {}).length);
      const bgLayers = (json.layers || []).filter(l => l.type === 'background');
      if (bgLayers.length) {
        console.warn('  ⚠ Background layers found (will be made transparent by _thFetchStyle):',
                     bgLayers.map(l => l.id));
      }
    }
  } catch (e) {
    console.error('  ✗ Style JSON fetch error:', e.message);
  }

  // Fit map to Colombia bbox
  if (_thMap) {
    console.log('  Fitting map to Colombia…');
    _thMap.fitBounds([[-4.5, -82], [13, -66.5]]);
  }

  // Load the layer
  console.log('  Loading layer on map now…');
  console.groupEnd();

  if (!_thInitialized) initThreatsPanel();
  if (cat === 'landcover') {
    _thClearOverlays();
    _thLoadVtLayer(url, `debug: ${cat} ${yr}`);
  } else if (cat === 'totalchange') {
    _thClearOverlays();
    _thLoadVtLayer(url, `debug: totalchange`);
  } else {
    _thClearOverlays();
    _thLoadVtLayer(url, `debug: ${cat} ${yr}`);
  }
};

// ============================================================
// EXPOSE
// ============================================================
window.initThreatsPanel    = initThreatsPanel;
window.wireThreatsPanel    = wireThreatsPanel;
window.cleanupThreatsPanel = cleanupThreatsPanel;
