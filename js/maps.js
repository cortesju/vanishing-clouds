// ============================================================
// VANISHING CLOUDS — maps.js  (Audubon-style single-map)
// One persistent full-screen Leaflet map.
// Layer groups toggled based on active panel.
// ============================================================

// ---- CONFIG ----
const COLOMBIA_BOUNDS   = [[-4.2, -79.0], [12.5, -66.9]];
const COLOMBIA_CENTER   = [5.0, -75.5];   // offset west to compensate for 420px left sidebar —
                                           // the three Andes cordilleras land in the open map area
const DEFAULT_ZOOM      = 7;              // country-close — Andean belt fills the visible viewport
const MIN_ZOOM          = 3;              // zoom-out limit: shows all Colombia
const MAX_ZOOM          = 9;             // zoom-in limit: ~20 miles on a 1080p monitor (23 mi full-screen)

// Species panel entry view — central Andes belt where GBIF records are densest
// (Chingaza / Sumapaz region, ~50 km SE of Bogotá). Tight bbox keeps initial
// GBIF points query fast; user can zoom out via "View full range" button.
const SPECIES_ENTRY_CENTER = [4.3, -74.1];
const SPECIES_ENTRY_ZOOM   = 9;   // = POINTS_MIN_ZOOM (declared below)

// ---- PARAMO FEATURE LAYER (ArcGIS FeatureServer) ----
const PARAMO_FEATURE_URL = 'https://services1.arcgis.com/ZIL9uO234SBBPGL7/arcgis/rest/services/Paramos_de_Colombia_CopyFeatures/FeatureServer/0';

// ---- SPECIES HEX LAYER (ArcGIS FeatureServer) ----
// One source, three thematic renderers: richness / count / decade.
const PARAMO_SPECIES_LAYER_URL = 'https://services1.arcgis.com/ZIL9uO234SBBPGL7/arcgis/rest/services/paramo_hex_records_count/FeatureServer/0';

// Theme configs — shared between the style function (maps.js) and the legend renderer (species.js).
// Exposed as window.SPECIES_HEX_THEMES so species.js can read them without duplication.
//
// Hex layer confirmed field names (from FeatureServer schema):
//   species_richness  — Integer, max ≈ 10  (Jenks 7-class, YlGnBu ramp)
//   total_records     — Integer, max ≈ 921 (Manual interval 7-class, Purples ramp)
//   decade_period     — String  (Unique Values: "Before 1980" | "1980-1999" | "2000-2010" |
//                                "2011-2020" | "2021-Present" | "Unknown" | null)
const SPECIES_HEX_THEMES = {
  richness: {
    field:  'species_richness',
    title:  'Species Richness',
    type:   'breaks',
    // Natural Breaks (Jenks) 7 classes matching ArcGIS Pro symbology
    breaks: [0, 1, 2, 4, 6, 8, Infinity],
    colors: ['#FFFFCC', '#C7E9B4', '#7FCDBB', '#41B6C4', '#2C7FB8', '#253494', '#081D58'],
    labels: ['0', '1', '2', '3 – 4', '5 – 6', '7 – 8', '9 – 10'],
  },
  count: {
    field:  'total_records',          // confirmed field name
    title:  'Observation Count',
    type:   'breaks',
    // Manual Interval 7 classes (max 921) matching ArcGIS Pro histogram
    breaks: [10, 50, 100, 200, 500, 600, Infinity],
    colors: ['#F2F0F7', '#DADAEB', '#BCBDDC', '#9E9AC8', '#756BB1', '#54278F', '#3F007D'],
    labels: ['1 – 10', '11 – 50', '51 – 100', '101 – 200', '201 – 500', '501 – 600', '600 +'],
  },
  decade: {
    field:   'decade_period',
    title:   'Observation Decade',
    type:    'unique',
    // Exact values from FeatureServer domain — aligned with site ERA_COLORS palette
    values: {
      'Before 1980':  '#5B2C8D',
      '1980-1999':    '#2874A6',
      '2000-2010':    '#148F77',
      '2011-2020':    '#E67E22',
      '2021-Present': '#27AE60',
      'Unknown':      '#9AA5B4',
    },
    fallback: '#CBD5E0',   // null / unrecognised values
  },
};
window.SPECIES_HEX_THEMES = SPECIES_HEX_THEMES;  // expose to species.js

// ---- GBIF occurrence points — animals & plants ----
// Field `kingdom` distinguishes kingdoms: "Animalia" | "Plantae"
const GBIF_POINTS_URL = 'https://services1.arcgis.com/ZIL9uO234SBBPGL7/arcgis/rest/services/GbifPoints_AnimalPlant/FeatureServer/0';
// Pre-aggregated heatmap service — used at low zoom for performance
const GBIF_HEAT_URL   = 'https://services1.arcgis.com/ZIL9uO234SBBPGL7/arcgis/rest/services/GbifPoints_AnimalPlantScale_heatmap/FeatureServer/0';
// Below this zoom: heat map   /   at or above: individual hex markers
const POINTS_MIN_ZOOM = 9;

// ---- CUSTOM BASEMAP LAYERS ----
// 1. Colombia terrain raster — ArcGIS MapServer (tiled)
const TERRAIN_URL = 'https://tiles.arcgis.com/tiles/ZIL9uO234SBBPGL7/arcgis/rest/services/base2/MapServer';

// 2. Vector tiles — ArcGIS VectorTileServer (labels, roads, borders)
const VECTOR_TILE_URL = 'https://tiles.arcgis.com/tiles/ZIL9uO234SBBPGL7/arcgis/rest/services/BasemapFInalProjCOl/VectorTileServer';

// 4. Detail vector tiles — water bodies & urban footprints at 1:100K (auto-shows on zoom in)
const DETAIL_TILE_URL  = '';
const DETAIL_MIN_ZOOM  = 9;   // Leaflet zoom level at which the layer fades in

// ════════════════════════════════════════════════════════════════
// 3. HILLSHADE URL — paste your own AGO service URL here
// ════════════════════════════════════════════════════════════════
//
// CURRENT: AWS Terrain Tiles (Terrarium RGB elevation, free & public,
//          no API key required). Decoded by MapLibre GL into a hillshade
//          rendering at z=202 below all data layers.
//
// TO REPLACE with your own ArcGIS Online hillshade:
//
//   ┌─ Option A: AGO Tiled Map Service (visual image tiles)
//   │   Publish your hillshade raster as an ArcGIS Map Service,
//   │   then set HILLSHADE_TYPE = 'esri-tiled' below and use:
//   │
//   │   const HILLSHADE_TILES = 'https://tiles.arcgis.com/tiles/ZIL9uO234SBBPGL7/arcgis/rest/services/YOUR_HILLSHADE/MapServer';
//   │   const HILLSHADE_TYPE  = 'esri-tiled';   // uses L.esri.tiledMapLayer
//   │
//   ├─ Option B: AGO Image Service (ImageServer with elevation data)
//   │   Export as Terrarium PNG tiles, then:
//   │   const HILLSHADE_TILES = 'https://tiles.arcgis.com/.../tile/{z}/{y}/{x}';
//   │   const HILLSHADE_TYPE  = 'raster-dem';   // stays as MapLibre GL
//   │
//   └─ Option C: Keep AWS (current, no change needed)
//      const HILLSHADE_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
//      const HILLSHADE_TYPE  = 'raster-dem';
//
// ════════════════════════════════════════════════════════════════
const HILLSHADE_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const HILLSHADE_TYPE  = 'raster-dem';   // 'raster-dem' | 'esri-tiled'

// ---- PÁRAMO GOLD SHADES (7 tones, picked by OBJECTID % 7) ----
const PARAMO_GOLD_SHADES = [
  { fill: '#D4AE38', stroke: '#A88018' },  // warm gold
  { fill: '#E0BC48', stroke: '#B49020' },  // bright gold
  { fill: '#C8A030', stroke: '#9C7010' },  // medium gold
  { fill: '#CCAA3C', stroke: '#A08018' },  // amber gold
  { fill: '#D8B440', stroke: '#AC8818' },  // honey gold
  { fill: '#B89030', stroke: '#8C6010' },  // dark gold
  { fill: '#C09838', stroke: '#947010' },  // bronze gold
];

// ---- COLORS ----
const ERA_COLORS = {
  'before-1980':  '#5B2C8D',
  '1980-1999':    '#2874A6',
  '2000-2010':    '#148F77',
  '2011-2020':    '#E67E22',
  '2021-present': '#27AE60',
};

const URGENCY_COLORS = {
  veryLow:  '#F4F1C2',   // pale cream
  low:      '#CFE8B8',   // soft green
  moderate: '#79C7B5',   // muted teal
  high:     '#E6A15D',   // soft orange
  veryHigh: '#C94A38',   // muted red
  noData:   '#C8C8C0',   // neutral gray for unmatched páramos
};


// ---- MAP + LAYER GROUPS ----
let map = null;
let terrainLayer    = null;   // L.esri.tiledMapLayer — Colombia terrain basemap
let vectorTileLayer = null;   // MapLibre GL map — base vector tile overlay (labels/roads)
let detailTileLayer = null;   // MapLibre GL map — detail vector tiles (water/urban, zoom-gated)
let hillshadeMapGL  = null;   // MapLibre GL map — hillshade overlay
let satelliteLayer  = null;   // L.tileLayer — Esri World Imagery satellite basemap
let _zoomControl    = null;   // Leaflet zoom control — stored so it can be repositioned

// Detail layer user-controlled state (separate from zoom-gate visibility)
let _detailEnabled = true;
let _detailOpacity = 1.0;

// ---- SINGLE RAF-THROTTLED GL SYNC ----
// Both MapLibre canvases (hillshade + vector tiles) are updated in one
// requestAnimationFrame callback so they always move in lockstep.
let _glSyncRAF = null;
function syncAllGL() {
  if (_glSyncRAF) return;
  _glSyncRAF = requestAnimationFrame(() => {
    _glSyncRAF = null;
    if (!map) return;
    const c = map.getCenter();
    const z = map.getZoom() - 1;   // MapLibre 512px offset vs Leaflet 256px
    if (hillshadeMapGL) {
      hillshadeMapGL.jumpTo({ center: [c.lng, c.lat], zoom: z });
    }
    if (vectorTileLayer && typeof vectorTileLayer.jumpTo === 'function') {
      vectorTileLayer.jumpTo({ center: [c.lng, c.lat], zoom: z });
    }
    if (detailTileLayer && typeof detailTileLayer.jumpTo === 'function') {
      detailTileLayer.jumpTo({ center: [c.lng, c.lat], zoom: z });
    }
  });
}

// ── 360° Field Views ───────────────────────────────────────────────────────
// Curated Google Earth ground-level panoramas of páramo landscapes.
// Markers are shown only on the Overview/Páramos tab (PANEL_LAYERS.overview).
const PARAMO_360_VIEWS = [
  {
    name:  'Sumapaz',
    label: '360° Field View · Sumapaz',
    desc:  'The world\'s largest continuous páramo complex, spanning 333,000 ha south of Bogotá. Home to frailejones, spectacled bears, and the headwaters of four major river systems.',
    lat:   3.80627697,
    lng:   -74.23423282,
    url:   'https://earth.app.goo.gl/?apn=com.google.earth&isi=293622097&ius=googleearth&link=https%3a%2f%2fearth.google.com%2fweb%2f%403.80627697,-74.23423282,3698.64913957a,0d,60y,162.05114115h,84.51730587t,0r%2fdata%3dCgRCAggBIhsKF0NJSE0wb2dLRUlDQWdJQ3Y2SXpPMWdFEAU6AwoBMEICCABKDQj___________8BEAA',
  },
  {
    name:  'Chingaza',
    label: '360° Field View · Chingaza',
    desc:  'A national park and key water source for Bogotá, Chingaza sits at 3,200–4,020 m. Its cloud forest and páramo host the endangered mountain tapir and over 300 bird species.',
    lat:   4.58771184,
    lng:   -73.72434231,
    url:   'https://earth.app.goo.gl/?apn=com.google.earth&isi=293622097&ius=googleearth&link=https%3a%2f%2fearth.google.com%2fweb%2f%404.58771184,-73.72434231,3336.94841914a,0d,60y,273.89729042h,83.55011854t,0r%2fdata%3dCgRCAggBIhsKF0NJSE0wb2dLRUlDQWdJREV6UDIwdVFFEAU6AwoBMEICCABKDQj___________8BEAA',
  },
  {
    name:  'Los Nevados',
    label: '360° Field View · Los Nevados',
    desc:  'A volcanic páramo in the Central Cordillera reaching 5,321 m at Nevado del Ruiz. Glaciers here have retreated over 85% since 1850 — one of Colombia\'s most visible climate signals.',
    lat:   3.94266507,
    lng:   -74.10229399,
    url:   'https://earth.app.goo.gl/?apn=com.google.earth&isi=293622097&ius=googleearth&link=https%3a%2f%2fearth.google.com%2fweb%2f%403.94266507,-74.10229399,3753.1437403a,0d,60y,273.50889126h,85.38192584t,0r%2fdata%3dCgRCAggBIhsKF0NJSE0wb2dLRUlDQWdJQzRndk9VM2dFEAU6AwoBMEICCABKDQj___________8BEAA',
  },
  {
    name:  'Laguna Buitrago',
    label: '360° Field View · Laguna Buitrago',
    desc:  'A high-altitude glacial lake at 3,600 m in the Eastern Cordillera, surrounded by cushion-plant communities and dense frailejón stands — one of the most intact páramo landscapes near Bogotá.',
    lat:   4.7574235,
    lng:   -73.8292926,
    url:   'https://earth.app.goo.gl/?apn=com.google.earth&isi=293622097&ius=googleearth&link=https%3a%2f%2fearth.google.com%2fweb%2f%404.7574235,-73.8292926,3591.33938579a,0d,60y,234.89479306h,88.51625632t,0r%2fdata%3dCgRCAggBIhsKF0NJSE0wb2dLRUlDQWdJQzRwOTJ0dmdFEAU6AwoBMEICCABKDQj___________8BEAA',
  },
  {
    name:  'Nevado del Ruiz',
    label: '360° Field View · Nevado del Ruiz',
    desc:  'The northernmost active volcano in the Andes, infamous for the 1985 Armero tragedy. Its glaciated summit at 5,321 m feeds the Magdalena and Cauca rivers and hosts high-altitude páramo on its flanks.',
    lat:   4.69012329,
    lng:   -75.41429977,
    url:   'https://earth.app.goo.gl/?apn=com.google.earth&isi=293622097&ius=googleearth&link=https%3a%2f%2fearth.google.com%2fweb%2f%404.69012329,-75.41429977,4111.46562437a,0d,60y,144.6833785h,63.6918989t,0r%2fdata%3dCgRCAggBIhoKFkNJSE0wb2dLRUlDQWdJRG12YVdKTlEQBToDCgEwQgIIAEoNCP___________wEQAA',
  },
  {
    name:  'Sierra Nevada de Santa Marta 1',
    label: '360° Field View · Sierra Nevada de Santa Marta',
    desc:  'The world\'s highest coastal mountain range rises from sea level to 5,775 m in just 45 km. Its isolated páramos harbour dozens of endemic species found nowhere else on Earth.',
    lat:   10.8628574,
    lng:   -73.90188446,
    url:   'https://earth.app.goo.gl/?apn=com.google.earth&isi=293622097&ius=googleearth&link=https%3a%2f%2fearth.google.com%2fweb%2f%4010.8628574,-73.90188446,3897.29050404a,0d,60y,227.47382355h,98.23741061t,0r%2fdata%3dCgRCAggBIhoKFkNJSE0wb2dLRUlDQWdJRHFoYV9wSlEQBToDCgEwQgIIAEoNCP___________wEQAA',
  },
  {
    name:  'Sierra Nevada de Santa Marta 2',
    label: '360° Field View · Sierra Nevada de Santa Marta',
    desc:  'A second vantage into the Santa Marta massif\'s upper páramo, where the Kogui and Arhuaco peoples maintain living traditions tied to the Sierra\'s glacial lakes and cloud forests.',
    lat:   10.87904548,
    lng:   -73.8730566,
    url:   'https://earth.app.goo.gl/?apn=com.google.earth&isi=293622097&ius=googleearth&link=https%3a%2f%2fearth.google.com%2fweb%2f%4010.87904548,-73.8730566,3993.30142392a,0d,60y,221.55629601h,86.13833088t,0r%2fdata%3dCgRCAggBIhsKF0NJSE0wb2dLRUlDQWdJRHFoWi16endFEAU6AwoBMEICCABKDQj___________8BEA',
  },
  {
    name:  'Páramo El Almorzadero',
    label: '360° Field View · Páramo El Almorzadero',
    desc:  'Straddling Santander and Norte de Santander at 3,200–4,100 m, El Almorzadero is one of Colombia\'s best-preserved northeastern páramos — a mosaic of peat bogs, lagoons, and dense frailejón fields.',
    lat:   6.95176109,
    lng:   -72.68591729,
    url:   'https://earth.app.goo.gl/?apn=com.google.earth&isi=293622097&ius=googleearth&link=https%3a%2f%2fearth.google.com%2fweb%2f%406.95176109,-72.68591729,3799.35794131a,0d,43.40593481y,218.95373102h,95.33732155t,0r%2fdata%3dCgRCAggBIhsKF0NJSE0wb2dLRUlDQWdJRFV5N3Zmb1FFEAU6AwoBMEICCABKDQj___________8BEAA',
  },
  {
    name:  'El Cocuy',
    label: '360° Field View · El Cocuy',
    desc:  'Sierra Nevada del Cocuy shelters the largest glacier mass in Colombia\'s Eastern Cordillera. Its dramatic peaks rise above 5,300 m, flanked by emerald lagoons and vast páramo meadows.',
    lat:   6.29932539,
    lng:   -72.38216423,
    url:   'https://earth.app.goo.gl/?apn=com.google.earth&isi=293622097&ius=googleearth&link=https%3a%2f%2fearth.google.com%2fweb%2f%406.29932539,-72.38216423,3927.61195581a,0d,60y,101.45569958h,80.84628575t,0r%2fdata%3dCgRCAggBIhsKF0NJSE0wb2dLRUlDQWdJRHE3Ym1CNHdFEAU6AwoBMEICCABKDQj___________8BEAA',
  },
  {
    name:  'La Asomadera',
    label: '360° Field View · La Asomadera',
    desc:  'A páramo viewpoint in the El Cocuy massif revealing the Eastern Cordillera\'s glaciated ridgeline. The surrounding bofedales (peat wetlands) are critical freshwater stores for lowland communities.',
    lat:   6.29932539,
    lng:   -72.38216423,
    url:   'https://earth.app.goo.gl/?apn=com.google.earth&isi=293622097&ius=googleearth&link=https%3a%2f%2fearth.google.com%2fweb%2f%406.29932539,-72.38216423,3927.61195581a,0d,60y,101.45569958h,80.84628575t,0r%2fdata%3dCgRCAggBIhsKF0NJSE0wb2dLRUlDQWdJRHE3Ym1CNHdFEAU6AwoBMEICCABKDQj___________8BEAA',
  },
  {
    name:  'El Silencio Lagoon',
    label: '360° Field View · El Silencio Lagoon',
    desc:  'A high-altitude glacial lagoon in the El Cocuy complex, its still waters reflecting surrounding snow peaks. These lakes form part of a chain that feeds the Arauca and Casanare river basins.',
    lat:   6.29932539,
    lng:   -72.38216423,
    url:   'https://earth.app.goo.gl/?apn=com.google.earth&isi=293622097&ius=googleearth&link=https%3a%2f%2fearth.google.com%2fweb%2f%406.29932539,-72.38216423,3927.61195581a,0d,60y,101.45569958h,80.84628575t,0r%2fdata%3dCgRCAggBIhsKF0NJSE0wb2dLRUlDQWdJRHE3Ym1CNHdFEAU6AwoBMEICCABKDQj___________8BEAA',
  },
  {
    name:  'Valle de los Frailejones',
    label: '360° Field View · Valle de los Frailejones',
    desc:  'An otherworldly valley in the Macizo Colombiano carpeted with thousands of frailejones (Espeletia spp.). Located in Cauca at ~3,400 m, this corridor connects three of Colombia\'s major river watersheds.',
    lat:   2.36050167,
    lng:   -76.35054583,
    url:   'https://earth.app.goo.gl/?apn=com.google.earth&isi=293622097&ius=googleearth&link=https%3a%2f%2fearth.google.com%2fweb%2f%402.36050167,-76.35054583,3419.15192079a,0d,60y,5.85049007h,82.97659167t,0r%2fdata%3dCgRCAggBIhoKFkNJSE0wb2dLRUlDQWdJRHEtWWZjR1EQBToDCgEwQgIIAEoNCP___________wEQAA',
  },
];

const LG = {
  paramoFill:      null,
  paramoOutline:   null,
  views360:        null,   // 360° field-view markers — overview tab only
  speciesHexLayer: null,   // aggregated hex — richness / count / decade themes
  gbifPointsLayer: null,   // GBIF occurrence points — shown when 'points' theme is active
  speciesPoints:   null,
  agriculture:     null,
  fire:            null,
  urban:           null,
  mining:          null,
  urgencyParamos:  null,   // official paramo polygons styled by urgency score
};
window.LG = LG;   // expose to terrain-profile.js and other modules

// All loaded data (fetched once)
const DATA = {
  paramo:    null,
  species:   null,
  landCover: null,
  fire:      null,
  urgency:   null,
};

// Per-panel default visible layers
const PANEL_LAYERS = {
  overview:  ['paramoFill', 'paramoOutline', 'views360'],
  // build: no base layers — user stacks environmental layers interactively via build-paramo.js.
  // The compare toggle in the panel can optionally surface paramoFill.
  build:     [],
  species:   ['paramoOutline', 'speciesHexLayer'],    // hex richness is default; points built lazily
  // threats: managed entirely by threats.js — no base layers from PANEL_LAYERS
  threats:   [],
  urgency:   ['urgencyParamos'],   // single layer covers all paramo boundaries styled by score
  about:     ['paramoFill', 'paramoOutline'],
};

// Current time-period filter for species points
let currentPeriod = 'all';

// Active theme for the species hex layer — 'richness' is default (hex aggregates load instantly)
// Points theme is built lazily only when the user explicitly selects it.
let activeSpeciesTheme = 'richness';

// Track which panel is active so GBIF points never bleed onto non-species panels
// (named _mapActivePanel to avoid collision with main.js's own activePanel variable)
let _mapActivePanel = 'overview';

// Pan/zoom suppressor — set true while the map is moving so expensive
// per-feature hover effects (setStyle, bringToFront, icon swaps) are skipped.
// Eliminates the stutter that occurs when many features try to re-style
// while tiles are still loading and the viewport is actively changing.
let _mapMoving = false;
// Expose so other modules (threats.js, build-paramo.js) can guard their hover handlers
Object.defineProperty(window, '_mapMoving', { get: () => _mapMoving });

// GBIF points runtime state
let gbifHeatLayer         = null;   // L.heatLayer instance (zoom-out view)
let _gbifKingdomFilter    = null;   // "Animalia" | "Plantae" | null
let _gbifDecadeIdx        = 4;      // index into GBIF_DECADES (4 = all time)
let _gbifPlayInterval     = null;   // setInterval handle for timeline play
let _gbifQuerySeq         = 0;      // incremented per query to cancel stale callbacks
let _gbifMoveEndWired     = false;  // moveend listener added at most once

// Hex layer timeline state (shared across richness / count / decade themes)
let _hexDecadeIdx         = 4;      // index into GBIF_DECADES (4 = show all)
let _hexPlayInterval      = null;   // setInterval handle for hex play

// Cumulative decade time steps — each step adds one more era to the WHERE clause.
// Exposed so the sidebar JS can read labels without duplication.
const GBIF_DECADES = [
  { label: 'Pre-1980',  where: "decade_period = 'Before 1980'" },
  { label: '1980–1999', where: "decade_period IN ('Before 1980','1980-1999')" },
  { label: '2000–2010', where: "decade_period IN ('Before 1980','1980-1999','2000-2010')" },
  { label: '2011–2020', where: "decade_period IN ('Before 1980','1980-1999','2000-2010','2011-2020')" },
  { label: '2021–Now',  where: '1=1' },
];
window.GBIF_DECADES = GBIF_DECADES;

// ============================================================
// HELPERS
// ============================================================

function getUrgencyColor(score) {
  if (score >= 4.8) return URGENCY_COLORS.veryHigh;
  if (score >= 4.0) return URGENCY_COLORS.high;
  if (score >= 3.0) return URGENCY_COLORS.moderate;
  if (score >= 2.0) return URGENCY_COLORS.low;
  return URGENCY_COLORS.veryLow;
}

// Normalize a páramo name for fuzzy matching between urgency GeoJSON and FeatureServer
// Strips accents, lowercases, collapses punctuation → "Santurbán" === "santurban"
function _normalizeParamoName(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function lngLatToLatLng(coords) {
  return coords.map(([lng, lat]) => [lat, lng]);
}

// ============================================================
// INITIALIZE MAP
// ============================================================

function initMap() {
  if (map) return;

  map = L.map('map-main', {
    center:              COLOMBIA_CENTER,
    zoom:                DEFAULT_ZOOM,
    minZoom:             MIN_ZOOM,
    maxZoom:             MAX_ZOOM,
    zoomControl:         false,
    scrollWheelZoom:     'center',  // zooms to map centre, not cursor — more predictable with GL overlays
    attributionControl:  true,
    // Disable Leaflet's CSS zoom animation — without it all layers (Leaflet tiles
    // + both MapLibre GL canvases) snap to the new zoom together instead of each
    // animating on their own timeline, eliminating the "different speeds" effect.
    zoomAnimation:       false,
    markerZoomAnimation: false,
  });
  window.map = map;   // expose to terrain-profile.js

  // ── Zoom diffuse effect ──────────────────────────────────────────────────
  // Blurs #map-main on zoomstart; debounced zoomend removes it 200 ms after
  // the last zoom step so rapid scroll-wheel zooming holds the blur until
  // the user settles on a level, then dissolves smoothly via CSS transition.
  (function initZoomBlur() {
    const mapEl = document.getElementById('map-main');
    let timer   = null;

    map.on('zoomstart movestart', () => {
      clearTimeout(timer);
      mapEl.classList.add('map-zooming');
      _mapMoving = true;   // suppress expensive per-feature hover effects
    });

    map.on('zoomend moveend', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        mapEl.classList.remove('map-zooming');
        _mapMoving = false;   // re-enable hover effects once settled
      }, 200);
    });
  })();

  // ---- LAYER 1: Custom Colombia terrain — esri-leaflet TiledMapLayer ----
  // Uses ArcGIS REST API natively; handles service discovery, CORS, and auth.
  terrainLayer = L.esri.tiledMapLayer({
    url: TERRAIN_URL,
    attribution: 'Custom terrain basemap',
    maxZoom: 18,
    opacity: 0.78,
  }).addTo(map);

  // ---- LAYER 2: Hillshade — dedicated MapLibre GL canvas at z=202 ----
  initHillshadeOverlay();

  // Zoom control — bottom-right by default; moved to top-right inside Build a Páramo
  // so it does not overlap the floating layer legend.
  _zoomControl = L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Scale bar — metric (km) + imperial (mi), bottom-left
  L.control.scale({
    position:  'bottomleft',
    metric:    true,
    imperial:  true,
    maxWidth:  140,
  }).addTo(map);

  // North arrow — fixed (Leaflet maps don't rotate), bottom-left above scale bar
  const NorthArrow = L.Control.extend({
    options: { position: 'bottomleft' },
    onAdd() {
      const el = L.DomUtil.create('div', 'north-arrow-ctrl');
      el.innerHTML = `
        <svg width="28" height="42" viewBox="0 0 28 42" xmlns="http://www.w3.org/2000/svg">
          <text x="14" y="9" text-anchor="middle"
            font-family="system-ui,sans-serif" font-size="9.5"
            font-weight="700" letter-spacing="0.5" fill="#1B5E3B">N</text>
          <!-- North half (dark) -->
          <polygon points="14,13 8,30 14,26 20,30" fill="#1B5E3B"/>
          <!-- South half (light) -->
          <polygon points="14,40 8,30 14,34 20,30" fill="#C8C8C8"/>
          <!-- Pivot -->
          <circle cx="14" cy="30" r="2.2" fill="white" stroke="#999" stroke-width="0.8"/>
        </svg>`;
      L.DomEvent.disableClickPropagation(el);
      return el;
    },
  });
  new NorthArrow().addTo(map);

  // ---- LAYER 3: Vector tiles — MapLibre GL synced canvas ----
  // Direct MapLibre GL overlay at z=450 (above Leaflet tile pane z=200).
  // Renders all style layers from the VectorTileServer style JSON.
  initVectorTileOverlay();

  // Detail vector tile overlay — water bodies & urban footprints.
  // Starts hidden; fades in automatically once zoom >= DETAIL_MIN_ZOOM.
  initDetailTileOverlay();
  map.on('zoomend', updateDetailLayerVisibility);
  map.on('zoomend', updateGbifLayersByZoom);
  map.on('zoomend', updateFieldViewMarkerVisibility);

  // Load all data then build initial layers
  loadAllData();

  // ── Hoist popup + tooltip panes above GL canvases ─────────────────────────
  // ROOT CAUSE: .leaflet-map-pane has z-index:auto (no explicit value), which
  // puts Leaflet's entire stacking context BELOW any sibling with a positive
  // z-index (#vector-tile-gl z=450, #threats-vt-gl z=460).  Even though the
  // Leaflet popup pane has z=700 *inside* its stacking context, it is buried
  // under the GL canvases in the outer context.
  //
  // FIX: move .leaflet-popup-pane and .leaflet-tooltip-pane into a new overlay
  // div (#map-popup-overlay) that is appended AFTER all GL canvases in DOM
  // order and carries z-index:9000.  The panning transform that Leaflet applies
  // to .leaflet-map-pane is mirrored onto the popup pane on every 'move' event
  // so popups continue to track their anchor point correctly during drag.
  _hoistPopupPane();

  // ── Auto-collapse overview panel on first map interaction ─────────────────
  // When the user drags or zooms the map while the overview panel is open,
  // collapse it automatically so the map is fully visible.
  map.on('dragstart', _autoCollapseOverview);
  map.on('zoomstart', _autoCollapseOverview);
}

function _autoCollapseOverview() {
  if (_mapActivePanel !== 'overview') return;
  const sp = document.getElementById('side-panel');
  if (!sp) return;
  const isMob = window.matchMedia('(max-width: 768px)').matches;
  // On desktop: already collapsed if .collapsed present
  // On mobile: already at peek state if .expanded absent
  const alreadyCollapsed = isMob
    ? !sp.classList.contains('expanded')
    : sp.classList.contains('collapsed');
  if (!alreadyCollapsed && typeof window.setPanelCollapsed === 'function') {
    window.setPanelCollapsed(true);
  }
}

// ============================================================
// POPUP PANE HOIST
// Moves Leaflet's popup + tooltip panes into a high-z overlay so
// they render above the MapLibre GL canvases (#vector-tile-gl z=450,
// #threats-vt-gl z=460) whose sibling position in #map-main would
// otherwise bury them.
// ============================================================
function _hoistPopupPane() {
  if (!map) return;

  // Create the overlay as the LAST child of #map-main so DOM order also
  // puts it above the GL canvases (belt-and-suspenders with z-index).
  const overlay = document.createElement('div');
  overlay.id = 'map-popup-overlay';
  document.getElementById('map-main').appendChild(overlay);

  // Detach Leaflet's popup and tooltip panes from .leaflet-map-pane and
  // re-parent them into the overlay.
  const popupPane   = map.getPane('popup');
  const tooltipPane = map.getPane('tooltip');
  if (popupPane)   overlay.appendChild(popupPane);
  if (tooltipPane) overlay.appendChild(tooltipPane);

  // Leaflet pans the map by updating .leaflet-map-pane's CSS transform, not
  // by moving individual elements.  Now that the panes live outside that
  // stacking context we must mirror the same transform so popups track their
  // anchor latLng during mid-drag (Leaflet only calls _updatePosition on
  // moveend/zoomend, not on every frame).
  const mapPane = document.querySelector('.leaflet-map-pane');
  function _syncPopupTransform() {
    const t = mapPane ? mapPane.style.transform : '';
    if (popupPane)   popupPane.style.transform = t;
    if (tooltipPane) tooltipPane.style.transform = t;
  }
  // Sync on every move frame (drag + zoom animation) so popups track anchor.
  // Also sync on popupopen: Leaflet calls _updatePosition() which sets the
  // popup container's translate(), but the pane transform must be current too.
  // And on zoomend to catch any final repositioning after animation completes.
  map.on('move zoom zoomend popupopen', _syncPopupTransform);
  _syncPopupTransform();   // apply current transform right away
  console.log('[maps.js] Popup/tooltip panes hoisted above GL canvases (#map-popup-overlay z=9000)');
}

// ============================================================
// HILLSHADE OVERLAY — dedicated MapLibre GL canvas at z=202
// Uses AWS Terrain Tiles (Terrarium format, free & public, no API key).
// mix-blend-mode: soft-light is applied via CSS on #hillshade-gl.
// ============================================================
function initHillshadeOverlay() {
  if (typeof maplibregl === 'undefined') return;

  const container = document.createElement('div');
  container.id = 'hillshade-gl';
  container.style.display = 'none';   // OFF by default — user enables via Map Layers panel
  document.getElementById('map-main').appendChild(container);

  const center = map.getCenter();

  hillshadeMapGL = new maplibregl.Map({
    container: 'hillshade-gl',
    style: {
      version: 8,
      sources: {
        'dem': {
          type: 'raster-dem',
          tiles: [HILLSHADE_TILES],
          tileSize: 256,
          encoding: 'terrarium',
          maxzoom: 14,
          attribution: 'Elevation data © AWS Terrain Tiles',
        },
      },
      layers: [
        {
          id: 'background',
          type: 'background',
          paint: { 'background-color': 'rgba(0,0,0,0)', 'background-opacity': 0 },
        },
        {
          id: 'hillshade',
          type: 'hillshade',
          source: 'dem',
          paint: {
            // Shadow-only mode: dark shadows darken mountain faces visibly;
            // transparent highlight leaves lit faces unchanged (terrain shows through).
            'hillshade-exaggeration':          0.65,
            'hillshade-shadow-color':          'rgba(20,30,15,0.72)',
            'hillshade-highlight-color':       'rgba(255,255,255,0)',
            'hillshade-accent-color':          'rgba(30,40,20,0.4)',
            'hillshade-illumination-direction': 335,
            'hillshade-illumination-anchor':   'map',
          },
        },
      ],
    },
    center: [center.lng, center.lat],
    zoom: map.getZoom() - 1,
    interactive: false,
    attributionControl: false,
    preserveDrawingBuffer: false,
  });

  map.on('move',    syncAllGL);
  map.on('moveend', syncAllGL);
  map.on('resize',  () => hillshadeMapGL && hillshadeMapGL.resize());

  // Confirm layer order in console
  const hsDiv = document.getElementById('hillshade-gl');
  const hsZ   = hsDiv ? window.getComputedStyle(hsDiv).zIndex : '?';
  console.log(`[maps.js] Hillshade GL canvas ready — CSS z-index: ${hsZ}, above terrain tile pane (200), mix-blend-mode: multiply`);
}

// ============================================================
// VECTOR TILE OVERLAY — MapLibre GL synced with Leaflet
// ArcGIS VectorTileServer rendered in its own GL canvas,
// positioned above data layers (z=450) but below tooltips.
// MapLibre GL uses 512px tiles so zoom is offset by -1 vs Leaflet.
// ============================================================
function initVectorTileOverlay() {
  if (typeof maplibregl === 'undefined') {
    console.warn('[maps.js] maplibre-gl not loaded — vector tile layer skipped');
    return;
  }

  const styleUrl = VECTOR_TILE_URL + '/resources/styles/root.json';
  const resourcesBase = VECTOR_TILE_URL + '/resources';

  // Container div — appended last inside #map-main so DOM order also favors it.
  // CSS gives it z-index: 450, above Leaflet's tile pane (z=200) and
  // overlay pane (z=400), but below UI chrome (nav z=600, panel z=500).
  const container = document.createElement('div');
  container.id = 'vector-tile-gl';
  // Force to top of stack: append after all Leaflet panes are created
  const mapMain = document.getElementById('map-main');
  mapMain.appendChild(container);

  const center = map.getCenter();

  fetch(styleUrl)
    .then(r => r.text())
    .then(text => {
      let style;
      try { style = JSON.parse(text); } catch {
        throw new Error('Style response is not valid JSON — service may require auth or be blocked');
      }
      return style;
    })
    .then(style => {
      // ArcGIS VectorTileServer style JSONs have several relative-URL quirks that
      // raw MapLibre GL cannot handle — patch all of them before initialization.

      // 1. Sprite: relative paths like "../../sprites/sprite" → absolute
      if (!style.sprite || !style.sprite.startsWith('http')) {
        style.sprite = resourcesBase + '/sprites/sprite';
      }

      // 2. Glyphs: relative paths → point to the VectorTileServer's own font files
      //    (stored at .../resources/fonts/{fontstack}/{range}.pbf on ArcGIS).
      //    If the style already has an absolute glyph URL, keep it as-is.
      if (!style.glyphs || !style.glyphs.startsWith('http')) {
        style.glyphs = resourcesBase + '/fonts/{fontstack}/{range}.pbf';
      }

      // 3. Sources: ArcGIS uses "url": "relative://." — a proprietary scheme.
      //    MapLibre's source.url expects a TileJSON endpoint, but ArcGIS VectorTileServer
      //    returns its own metadata format (not TileJSON) — so MapLibre can't discover tiles.
      //    Fix: skip TileJSON discovery entirely and point directly to the .pbf tile template.
      if (style.sources) {
        Object.values(style.sources).forEach(source => {
          if (!source.url && !source.tiles) return;
          const isRelative = source.url && (
            source.url.startsWith('relative://') ||
            !source.url.startsWith('http')
          );
          if (isRelative) {
            // Direct PBF tile URL — MapLibre loads all layers (fills, lines, labels)
            source.tiles = [VECTOR_TILE_URL + '/tile/{z}/{y}/{x}.pbf'];
            source.minzoom = 0;
            source.maxzoom = 22;
            delete source.url;
          }
        });
      }

      vectorTileLayer = new maplibregl.Map({
        container: 'vector-tile-gl',
        style,
        center: [center.lng, center.lat],
        zoom: map.getZoom() - 1,  // ArcGIS 512px tiles → 1 zoom offset vs Leaflet 256px
        interactive: false,
        attributionControl: false,
        preserveDrawingBuffer: false,
      });

      // Both GL canvases sync together via the shared RAF-throttled syncAllGL()
      map.on('move',    syncAllGL);
      map.on('moveend', syncAllGL);
      map.on('resize',  () => vectorTileLayer && vectorTileLayer.resize());
    })
    .catch(err => {
      console.info('[maps.js] Vector tile style not available:', err.message);
    });
}

// ============================================================
// DETAIL VECTOR TILE OVERLAY — water bodies & urban footprints
// Same URL-patching pattern as initVectorTileOverlay().
// Sits at z=300 (above hillshade, below Leaflet data overlays).
// Opacity-gated by zoom: fades in at DETAIL_MIN_ZOOM, out below it.
// ============================================================
function initDetailTileOverlay() {
  if (typeof maplibregl === 'undefined') return;

  const styleUrl      = DETAIL_TILE_URL + '/resources/styles/root.json';
  const resourcesBase = DETAIL_TILE_URL + '/resources';

  const container = document.createElement('div');
  container.id = 'detail-tile-gl';
  document.getElementById('map-main').appendChild(container);

  const center = map.getCenter();

  fetch(styleUrl)
    .then(r => r.text())
    .then(text => {
      let style;
      try { style = JSON.parse(text); } catch {
        throw new Error('Detail tile style is not valid JSON — service may require auth');
      }
      return style;
    })
    .then(style => {
      // Same three ArcGIS relative-URL patches as the base vector tile layer
      if (!style.sprite || !style.sprite.startsWith('http')) {
        style.sprite = resourcesBase + '/sprites/sprite';
      }
      if (!style.glyphs || !style.glyphs.startsWith('http')) {
        style.glyphs = resourcesBase + '/fonts/{fontstack}/{range}.pbf';
      }
      if (style.sources) {
        Object.values(style.sources).forEach(source => {
          const isRelative = source.url && (
            source.url.startsWith('relative://') || !source.url.startsWith('http')
          );
          if (isRelative) {
            source.tiles  = [DETAIL_TILE_URL + '/tile/{z}/{y}/{x}.pbf'];
            source.minzoom = 0;
            source.maxzoom = 22;
            delete source.url;
          }
        });
      }

      detailTileLayer = new maplibregl.Map({
        container: 'detail-tile-gl',
        style,
        center:    [center.lng, center.lat],
        zoom:      map.getZoom() - 1,
        interactive:      false,
        attributionControl: false,
        preserveDrawingBuffer: false,
      });

      map.on('resize', () => detailTileLayer && detailTileLayer.resize());
      // Initial visibility check (map may already be past threshold)
      updateDetailLayerVisibility();
    })
    .catch(err => {
      console.info('[maps.js] Detail tile style not available:', err.message);
    });
}

// Show / hide the detail layer based on zoom level AND user toggle.
// Uses opacity so the CSS transition gives a smooth fade; display:none
// is reserved for the user explicitly turning the layer off.
function updateDetailLayerVisibility() {
  const el = document.getElementById('detail-tile-gl');
  if (!el) return;

  if (!_detailEnabled) {
    el.style.display = 'none';
    return;
  }

  el.style.display = '';
  const aboveThreshold = map && map.getZoom() >= DETAIL_MIN_ZOOM;
  el.style.opacity = aboveThreshold ? String(_detailOpacity) : '0';
}

// ============================================================
// DATA LOADING
// ============================================================

function loadAllData() {
  // ── Critical path: only what the home (overview) panel needs ──────────────
  // Everything else is lazy — built on first visit to each panel via
  // _ensurePanelLayers().  Deferring the four GeoJSON fetches and the
  // ArcGIS FeatureServer calls for species/urgency shaves several seconds off
  // initial page load and keeps the home tab snappy.
  console.time('[perf] home:paramo-layers');
  buildParamoFill();
  buildParamoOutline();
  build360ViewMarkers();
  applyPanelLayers('overview');
  updateFieldViewMarkerVisibility();   // apply zoom gate on first load
  console.timeEnd('[perf] home:paramo-layers');
}

// ============================================================
// 360° FIELD VIEW MARKERS + MODAL
// Lightweight gold markers on the overview map. Clicking opens
// a compact floating card with a Google Earth deep-link.
// Nothing is preloaded — modal is built once and reused.
// ============================================================

function build360ViewMarkers() {
  if (LG.views360) { map.removeLayer(LG.views360); }
  LG.views360 = L.layerGroup();

  PARAMO_360_VIEWS.forEach(view => {
    const icon = L.divIcon({
      html: `<div class="v360-marker" title="${view.label}">
               <svg width="8" height="8" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
                 <circle cx="5.5" cy="5.5" r="4" stroke="#F9A825" stroke-width="1.5"/>
                 <circle cx="5.5" cy="5.5" r="1.8" fill="#F9A825"/>
               </svg>
               <span class="v360-label">360°</span>
             </div>`,
      className: 'v360-icon',
      iconSize:  [30, 13],
      iconAnchor:[15,  7],
    });

    const marker = L.marker([view.lat, view.lng], { icon, pane: 'markerPane' });
    marker.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      _show360Modal(view);
    });
    LG.views360.addLayer(marker);
  });
}

// ── Zoom-gated visibility ────────────────────────────────────
// Markers are only shown when the overview tab is active AND the
// map is zoomed in enough to make them useful and non-cluttering.
const VIEWS360_MIN_ZOOM = 7;

function updateFieldViewMarkerVisibility() {
  if (!LG.views360 || !map) return;

  const shouldShow = _mapActivePanel === 'overview' && map.getZoom() >= VIEWS360_MIN_ZOOM;

  if (shouldShow && !map.hasLayer(LG.views360)) {
    map.addLayer(LG.views360);
  } else if (!shouldShow && map.hasLayer(LG.views360)) {
    map.removeLayer(LG.views360);
    // Hide the modal if it was open — markers are no longer visible
    if (_v360ModalEl) _v360ModalEl.classList.add('v360-modal--hidden');
  }

  // Update the zoom-hint text in the overview panel (if the element exists)
  const hint = document.getElementById('v360-zoom-hint');
  if (hint) {
    hint.style.display = shouldShow ? 'none' : '';
  }

  // Optional zoom-based scale: add class to map container so CSS can nudge size
  const mapEl = document.getElementById('map-main');
  if (mapEl && map) {
    mapEl.classList.toggle('v360-z-high', map.getZoom() >= 10);
  }
}

// ── Modal ─────────────────────────────────────────────────────
let _v360ModalEl = null;

function _ensure360Modal() {
  if (_v360ModalEl) return _v360ModalEl;

  _v360ModalEl = document.createElement('div');
  _v360ModalEl.id        = 'v360-modal';
  _v360ModalEl.className = 'v360-modal v360-modal--hidden';
  _v360ModalEl.innerHTML = `
    <button class="v360-modal-close" aria-label="Close">✕</button>
    <p  class="v360-modal-kicker">🌐 360° Field View</p>
    <h3 class="v360-modal-name"></h3>
    <p  class="v360-modal-desc"></p>
    <a  class="v360-modal-btn" href="#" target="_blank" rel="noopener noreferrer">
      Open in Google Earth&nbsp;→
    </a>
  `;

  // Close button
  _v360ModalEl.querySelector('.v360-modal-close').addEventListener('click', () => {
    _v360ModalEl.classList.add('v360-modal--hidden');
  });

  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') _v360ModalEl.classList.add('v360-modal--hidden');
  });

  document.getElementById('map-main').appendChild(_v360ModalEl);
  return _v360ModalEl;
}

function _show360Modal(view) {
  const modal = _ensure360Modal();
  modal.querySelector('.v360-modal-name').textContent = view.name;
  modal.querySelector('.v360-modal-desc').textContent = view.desc;
  modal.querySelector('.v360-modal-btn').href         = view.url;
  modal.classList.remove('v360-modal--hidden');
}

// ── Lazy-load tracking ──────────────────────────────────────────────────────
// Tracks which panels have already had their heavy layers built.
// 'overview' is pre-built in loadAllData(); all others start false.
const _panelLayersBuilt = { overview: true };

// Build tab-specific layers for panelId the first time the panel is visited.
// Marks the panel built immediately to prevent duplicate builds from rapid clicks.
// Returns a resolved Promise so callers can always .then() regardless of caching.
async function _ensurePanelLayers(panelId) {
  if (_panelLayersBuilt[panelId]) return;
  _panelLayersBuilt[panelId] = true;   // mark first — prevents double-build

  switch (panelId) {

    case 'species': {
      // Hex layer only — instant (aggregated, ~50 features).
      // gbifPointsLayer is built lazily in switchSpeciesTheme() when user selects 'points'.
      console.time('[perf] load:species-layers');
      buildSpeciesHexLayer();
      console.timeEnd('[perf] load:species-layers');
      break;
    }

    case 'urgency': {
      // Local GeoJSON for the urgency hex grid.
      console.time('[perf] load:urgency-geojson');
      if (!DATA.urgency) {
        try {
          const r = await fetch('data/urgency_index.geojson');
          DATA.urgency = await r.json();
        } catch (e) {
          console.warn('[maps.js] Urgency GeoJSON failed:', e.message);
        }
      }
      buildUrgencyLayer();
      console.timeEnd('[perf] load:urgency-geojson');
      break;
    }

    case 'build': {
      // Local GeoJSON for Build-a-Páramo layer toggles.
      console.time('[perf] load:build-geojson');
      const pending = [];
      if (!DATA.landCover) pending.push(
        fetch('data/land_cover_change.geojson').then(r => r.json()).then(d => { DATA.landCover = d; })
      );
      if (!DATA.fire) pending.push(
        fetch('data/fire_alerts.geojson').then(r => r.json()).then(d => { DATA.fire = d; })
      );
      try { await Promise.all(pending); }
      catch (e) { console.warn('[maps.js] Build-panel GeoJSON failed:', e.message); }
      buildThreatLayers();
      console.timeEnd('[perf] load:build-geojson');
      break;
    }

    // 'threats' layers are managed entirely by threats.js (already lazy).
    // 'about', 'overview' need no extra layers.
  }
}

// Correct species-panel layer state after lazy build or on every panel visit.
// applyPanelLayers alone is not enough: the active theme determines which layer
// (speciesHexLayer vs gbifPointsLayer) should actually be on the map.
function _applySpeciesThemeCorrection() {
  if (typeof window.switchSpeciesTheme === 'function') {
    window.switchSpeciesTheme(activeSpeciesTheme || 'richness');
  } else {
    // Minimal fallback — switchSpeciesTheme not yet defined
    const theme = activeSpeciesTheme || 'richness';
    if (theme === 'points') {
      updateGbifLayersByZoom();
    } else if (LG.speciesHexLayer) {
      if (!map.hasLayer(LG.speciesHexLayer)) LG.speciesHexLayer.addTo(map);
      LG.speciesHexLayer.setStyle(f => getSpeciesHexStyle(theme, f));
    }
  }
  if (typeof window.renderSpeciesHexLegend === 'function') {
    window.renderSpeciesHexLegend(activeSpeciesTheme || 'richness');
  }
}

// ---- Field accessor: tries multiple names for the same concept ----
// ArcGIS CopyFeatures may rename fields; this tries the most likely variants.
function pf(props, ...keys) {
  for (const k of keys) {
    if (props[k] != null && props[k] !== '') return props[k];
  }
  return null;
}

// ---- Páramo filled polygons — live from ArcGIS FeatureServer ----
// Real field names (from FeatureServer schema):
//   pacomplejo = complex name  |  pacodigo = code  |  padistrito = district
//   pasector = sector          |  paarea = area km² |  pacotamax/min = elevation
function buildParamoFill() {
  if (LG.paramoFill) { map.removeLayer(LG.paramoFill); }

  LG.paramoFill = L.esri.featureLayer({
    url: PARAMO_FEATURE_URL,
    style: function(feature) {
      const id = (feature.properties?.OBJECTID || feature.id || 0);
      const shade = PARAMO_GOLD_SHADES[id % PARAMO_GOLD_SHADES.length];
      return {
        fillColor:   shade.fill,
        fillOpacity: 0.68,
        color:       shade.stroke,
        weight:      1.2,
        opacity:     1,
        className:   'paramo-polygon',
      };
    },
    onEachFeature(feature, layer) {
      const p = feature.properties || {};
      layer.bindTooltip(buildTooltipHTML(p), { sticky: true, direction: 'top', opacity: 1 });
      layer.bindPopup(buildParamoPopup(p), { maxWidth: 300 });
      layer.on('mouseover', function() {
        if (_mapMoving) return;
        this.setStyle({ fillOpacity: 0.92, weight: 2.5 });
        this.bringToFront();
      });
      layer.on('mouseout', function() {
        LG.paramoFill.resetStyle(this);
      });
    },
  });
}

// ---- Páramo outline only — context layer for non-overview panels ----
function buildParamoOutline() {
  if (LG.paramoOutline) { map.removeLayer(LG.paramoOutline); }

  LG.paramoOutline = L.esri.featureLayer({
    url: PARAMO_FEATURE_URL,
    style: function(feature) {
      const id = (feature.properties?.OBJECTID || feature.id || 0);
      const shade = PARAMO_GOLD_SHADES[id % PARAMO_GOLD_SHADES.length];
      return {
        fillOpacity: 0,
        color:       shade.stroke,
        weight:      1.5,
        opacity:     0.7,
        dashArray:   '4 3',
        className:   'paramo-polygon',
      };
    },
    onEachFeature(feature, layer) {
      const p = feature.properties || {};
      const name = p.pacomplejo || p.pacodigo || 'Páramo';
      layer.bindTooltip(
        `<div style="font-size:12px;padding:2px 4px;"><strong style="color:#C8A840">${name}</strong></div>`,
        { sticky: true, direction: 'top', opacity: 1 }
      );
      layer.bindPopup(buildParamoPopup(p), { maxWidth: 300 });
    },
  });
}

// ============================================================
// SPECIES HEX LAYER — aggregated statistics per páramo hexagon
// One L.esri.featureLayer instance; three themes switch via
// setStyle() so the data is fetched exactly once.
// ============================================================

// Returns the fill colour for a feature under the given theme.
function getSpeciesHexStyle(themeName, feature) {
  const theme = SPECIES_HEX_THEMES[themeName];
  const p = feature?.properties || {};
  let fillColor = '#9AA5B4';  // neutral fallback

  if (theme.type === 'breaks') {
    const val = Number(p[theme.field]);
    if (!isNaN(val)) {
      for (let i = 0; i < theme.breaks.length; i++) {
        if (val <= theme.breaks[i]) { fillColor = theme.colors[i]; break; }
      }
    }
  } else if (theme.type === 'unique') {
    fillColor = theme.values[p[theme.field]] ?? theme.fallback;
  }

  return {
    fillColor,
    fillOpacity: 0.78,
    color:   'rgba(255,255,255,0.35)',
    weight:  0.8,
    opacity: 0.9,
  };
}

function buildSpeciesHexPopup(p) {
  const richness = p.species_richness != null ? Number(p.species_richness).toLocaleString() : '—';
  const count    = p.record_count     != null ? Number(p.record_count).toLocaleString()     : '—';
  const decade   = p.decade_period    || '—';
  return `
    <div style="font-family:Helvetica Neue,Helvetica,Arial,sans-serif;padding:10px 13px;min-width:190px;">
      <h4 style="margin:0 0 8px;font-size:13px;font-weight:700;color:#1B5E3B;
                 border-bottom:1px solid #eee;padding-bottom:6px;">Páramo Hexagon</h4>
      <table style="width:100%;font-size:12px;border-collapse:collapse;">
        <tr>
          <td style="color:#888;padding:3px 0;">Species richness</td>
          <td style="font-weight:700;text-align:right;color:#1B5E3B;">${richness}</td>
        </tr>
        <tr>
          <td style="color:#888;padding:3px 0;">Total records</td>
          <td style="font-weight:700;text-align:right;">${count}</td>
        </tr>
        <tr>
          <td style="color:#888;padding:3px 0;">Peak decade</td>
          <td style="font-weight:700;text-align:right;">${decade}</td>
        </tr>
      </table>
    </div>`;
}

function buildSpeciesHexLayer() {
  if (LG.speciesHexLayer) { map.removeLayer(LG.speciesHexLayer); }

  LG.speciesHexLayer = L.esri.featureLayer({
    url:   PARAMO_SPECIES_LAYER_URL,
    style: feature => getSpeciesHexStyle(activeSpeciesTheme, feature),
    onEachFeature(feature, layer) {
      const p = feature.properties || {};
      layer.bindPopup(buildSpeciesHexPopup(p), { maxWidth: 260 });
      layer.on('mouseover', function() {
        if (_mapMoving) return;
        this.setStyle({ fillOpacity: 0.95, weight: 2 });
        this.bringToFront();
      });
      layer.on('mouseout', function() {
        LG.speciesHexLayer.resetStyle(this);
      });
    },
  });
}

// ============================================================
// GBIF OCCURRENCE POINTS — animals & plants
// Colored by `kingdom` field; sub-filtered via setWhere().
// Only added to the map when the 'points' theme is active.
// ============================================================

// ── Hex marker SVG (flat-top hexagon, ~10×12px) ──────────────
// Plants → green  /  Animals → amber-brown  /  Other → grey
const GBIF_COLORS = {
  animal: { fill: '#C8963E', stroke: '#8B6914' },
  plant:  { fill: '#4F9942', stroke: '#2D6A4F' },
  other:  { fill: '#9AA5B4', stroke: '#6B7A8D' },
};
window.GBIF_COLORS = GBIF_COLORS;  // expose so species.js can colour modals

function gbifKingdomKey(kingdom) {
  const k = (kingdom || '').toLowerCase();
  if (k.startsWith('anim')) return 'animal';
  if (k.startsWith('plant') || k.startsWith('virid')) return 'plant';
  return 'other';
}

function createHexIcon(kingdom) {
  const { fill, stroke } = GBIF_COLORS[gbifKingdomKey(kingdom)];
  // Flat-top regular hexagon inscribed in a 12×10 viewport
  // Points: right, upper-right, upper-left, left, lower-left, lower-right
  const pts = '11,5 8.5,0.5 3.5,0.5 1,5 3.5,9.5 8.5,9.5';
  return L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="10" viewBox="0 0 12 10">
             <polygon points="${pts}" fill="${fill}" fill-opacity="0.72"
                      stroke="${stroke}" stroke-width="0.9"/>
           </svg>`,
    className: 'gbif-hex-marker',
    iconSize:    [12, 10],
    iconAnchor:  [6,  5],
    popupAnchor: [0, -6],
  });
}

function buildGbifPointPopup(p) {
  const name    = p.scientificName || p.species || '—';
  const kingdom = p.kingdom || '—';
  const decade  = p.decade_period  || '—';
  const year    = p.year           ? String(p.year) : '—';
  const family  = p.family         || '—';
  const { fill } = GBIF_COLORS[gbifKingdomKey(p.kingdom)];
  return `
    <div style="font-family:Helvetica Neue,Helvetica,Arial,sans-serif;padding:10px 13px;min-width:200px;">
      <p style="margin:0 0 6px;font-style:italic;font-size:13px;font-weight:700;color:${fill};">${name}</p>
      <table style="width:100%;font-size:11px;border-collapse:collapse;">
        <tr><td style="color:#888;padding:2px 0">Kingdom</td><td style="font-weight:600;text-align:right">${kingdom}</td></tr>
        <tr><td style="color:#888;padding:2px 0">Family</td><td style="font-weight:600;text-align:right">${family}</td></tr>
        <tr><td style="color:#888;padding:2px 0">Year</td><td style="font-weight:600;text-align:right">${year}</td></tr>
        <tr><td style="color:#888;padding:2px 0">Decade</td><td style="font-weight:600;text-align:right">${decade}</td></tr>
      </table>
    </div>`;
}

// ── GBIF points: query-based approach (Options C + D) ─────────
// Instead of L.esri.featureLayer (which paginates through ALL records globally),
// we run a one-shot L.esri.query per viewport on each moveend, hard-capped at
// GBIF_POINTS_LIMIT features.  This keeps the DOM lean and the initial load fast.
const GBIF_POINTS_LIMIT = 500;

function buildGbifPointsLayer() {
  // Create a LayerGroup to hold the current viewport's geoJSON markers.
  if (LG.gbifPointsLayer) {
    if (map.hasLayer(LG.gbifPointsLayer)) map.removeLayer(LG.gbifPointsLayer);
  }
  LG.gbifPointsLayer = L.layerGroup();

  // Wire the moveend listener exactly once for the lifetime of the page.
  if (!_gbifMoveEndWired) {
    map.on('moveend', _refreshGbifQueryLayer);
    _gbifMoveEndWired = true;
  }
  // Fire immediately for the current viewport.
  _refreshGbifQueryLayer();
}

// Re-query the FeatureServer for the current map extent, replace markers.
// Stale callbacks (from previous queries still in flight) are discarded via seq.
function _refreshGbifQueryLayer() {
  if (activeSpeciesTheme !== 'points' || _mapActivePanel !== 'species') return;
  if (!LG.gbifPointsLayer) return;

  _setGbifPointsStatus('loading');
  const seq = ++_gbifQuerySeq;

  L.esri.query({ url: GBIF_POINTS_URL })
    .where(buildGbifWhere())
    .within(map.getBounds())
    .limit(GBIF_POINTS_LIMIT)
    .run((err, fc) => {
      if (seq !== _gbifQuerySeq) return;    // superseded by a newer query
      if (err) {
        console.warn('[maps.js] GBIF points query failed:', err);
        _setGbifPointsStatus('loaded', 0);
        return;
      }

      // Swap out the old markers for the new batch.
      LG.gbifPointsLayer.clearLayers();

      const geojsonLayer = L.geoJSON(fc, {
        pointToLayer: (feature, latlng) =>
          L.marker(latlng, { icon: createHexIcon(feature.properties?.kingdom) }),
        onEachFeature(feature, layer) {
          layer.on('click', function(e) {
            L.DomEvent.stopPropagation(e);
            if (typeof window.openGbifPointModal === 'function') {
              window.openGbifPointModal(feature.properties || {});
            }
          });
          layer.on('mouseover', function() {
            if (_mapMoving) return;
            const { fill, stroke } = GBIF_COLORS[gbifKingdomKey(feature.properties?.kingdom)];
            const pts = '11,5 8.5,0.5 3.5,0.5 1,5 3.5,9.5 8.5,9.5';
            this.setIcon(L.divIcon({
              html: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="12" viewBox="0 0 12 10">
                       <polygon points="${pts}" fill="${fill}" fill-opacity="1"
                                stroke="${stroke}" stroke-width="1.2"/>
                     </svg>`,
              className: 'gbif-hex-marker',
              iconSize: [14, 12], iconAnchor: [7, 6], popupAnchor: [0, -7],
            }));
          });
          layer.on('mouseout', function() {
            this.setIcon(createHexIcon(feature.properties?.kingdom));
          });
        },
      });

      LG.gbifPointsLayer.addLayer(geojsonLayer);
      _setGbifPointsStatus('loaded', fc?.features?.length ?? 0);
    });
}

// Update the inline status line shown below the Points theme controls.
function _setGbifPointsStatus(state, count) {
  const el = document.getElementById('gbif-points-status');
  if (!el) return;
  if (state === 'loading') {
    el.textContent = '⏳ Loading points…';
    el.style.opacity = '1';
  } else {
    const n = count ?? 0;
    el.textContent = n >= GBIF_POINTS_LIMIT
      ? `Showing ${GBIF_POINTS_LIMIT} of many points in this view — pan to explore`
      : `Showing ${n} point${n !== 1 ? 's' : ''} in this view`;
    el.style.opacity = '0.7';
  }
}

// ── Heat map — shown when zoom < POINTS_MIN_ZOOM ─────────────
// Uses leaflet.heat (already loaded). Populated via L.esri.query
// against the dedicated scale-heatmap service (pre-aggregated).

function initGbifHeatLayer() {
  if (gbifHeatLayer) return;  // already created
  gbifHeatLayer = L.heatLayer([], {
    radius:     22,
    blur:       18,
    minOpacity: 0.25,
    gradient: {
      0.0: 'rgba(8,29,88,0)',
      0.25: 'rgba(37,52,148,0.7)',
      0.5:  'rgba(65,182,196,0.8)',
      0.75: 'rgba(199,233,180,0.9)',
      1.0:  '#FFFFCC',
    },
  });
  refreshGbifHeatData();
}

function refreshGbifHeatData() {
  if (!gbifHeatLayer) return;
  const where = buildGbifWhere();
  L.esri.query({ url: GBIF_HEAT_URL })
    .where(where)
    .run((err, fc) => {
      if (err) { console.warn('[maps.js] Heat query failed:', err); return; }
      const pts = (fc?.features || []).map(f => [
        f.geometry.coordinates[1],
        f.geometry.coordinates[0],
        1,
      ]);
      gbifHeatLayer.setLatLngs(pts);
    });
}

// Build the combined WHERE clause from kingdom + decade filters
function buildGbifWhere() {
  const decade  = GBIF_DECADES[_gbifDecadeIdx]?.where || '1=1';
  const kingdom = _gbifKingdomFilter ? `kingdom = '${_gbifKingdomFilter}'` : null;
  if (kingdom && decade !== '1=1') return `(${decade}) AND (${kingdom})`;
  return kingdom || decade;
}

// Show GBIF points when the 'points' theme is active — called on zoom + theme switch.
// Heat-map zoom-out was disabled: the heatmap service query does not reliably return
// parseable point geometries, so points are shown at all zoom levels instead.
function updateGbifLayersByZoom() {
  // Only show points when the species panel is active AND points theme is selected
  if (activeSpeciesTheme !== 'points' || _mapActivePanel !== 'species') {
    if (gbifHeatLayer && map.hasLayer(gbifHeatLayer)) map.removeLayer(gbifHeatLayer);
    if (LG.gbifPointsLayer && map.hasLayer(LG.gbifPointsLayer)) map.removeLayer(LG.gbifPointsLayer);
    return;
  }
  if (gbifHeatLayer && map.hasLayer(gbifHeatLayer)) map.removeLayer(gbifHeatLayer);
  if (LG.gbifPointsLayer && !map.hasLayer(LG.gbifPointsLayer)) LG.gbifPointsLayer.addTo(map);
}

// ── Public API ────────────────────────────────────────────────

// Kingdom sub-filter (All / Animals / Plants)
window.filterGbifPoints = function(kingdom) {
  _gbifKingdomFilter = kingdom || null;
  _refreshGbifQueryLayer();   // re-query current viewport with new filter
  refreshGbifHeatData();
};

// Time-slider step (0–4, cumulative decades)
window.setGbifDecade = function(idx) {
  _gbifDecadeIdx = Number(idx);
  _refreshGbifQueryLayer();   // re-query current viewport with new decade filter
  refreshGbifHeatData();
  // Update label in the sidebar if visible
  const lbl = document.getElementById('ts-decade-label');
  if (lbl) lbl.textContent = GBIF_DECADES[_gbifDecadeIdx]?.label ?? '';
};

// Timeline auto-play
window.playGbifTimeline = function() {
  if (_gbifPlayInterval) return;
  // Start from beginning if already at end
  if (_gbifDecadeIdx >= GBIF_DECADES.length - 1) {
    _gbifDecadeIdx = -1;  // will become 0 on first tick
    const rng = document.getElementById('ts-range');
    if (rng) rng.value = 0;
  }
  _gbifPlayInterval = setInterval(() => {
    _gbifDecadeIdx = Math.min(_gbifDecadeIdx + 1, GBIF_DECADES.length - 1);
    const rng = document.getElementById('ts-range');
    if (rng) rng.value = _gbifDecadeIdx;
    window.setGbifDecade(_gbifDecadeIdx);
    if (_gbifDecadeIdx >= GBIF_DECADES.length - 1) window.pauseGbifTimeline();
  }, 1400);
};

window.pauseGbifTimeline = function() {
  clearInterval(_gbifPlayInterval);
  _gbifPlayInterval = null;
  const btn = document.getElementById('ts-play-btn');
  if (btn) { btn.textContent = '▶ Play'; btn.classList.remove('playing'); }
};

// ── Hex layer decade filter ───────────────────────────────────────────────
window.setHexDecade = function(idx) {
  _hexDecadeIdx = Number(idx);
  const where = GBIF_DECADES[_hexDecadeIdx]?.where || '1=1';
  if (LG.speciesHexLayer) LG.speciesHexLayer.setWhere(where);
  const lbl = document.getElementById('hex-ts-label');
  if (lbl) lbl.textContent = GBIF_DECADES[_hexDecadeIdx]?.label ?? '';
};

window.playHexTimeline = function() {
  if (_hexPlayInterval) return;
  if (_hexDecadeIdx >= GBIF_DECADES.length - 1) {
    _hexDecadeIdx = -1;
    const rng = document.getElementById('hex-ts-range');
    if (rng) rng.value = 0;
  }
  _hexPlayInterval = setInterval(() => {
    _hexDecadeIdx = Math.min(_hexDecadeIdx + 1, GBIF_DECADES.length - 1);
    const rng = document.getElementById('hex-ts-range');
    if (rng) rng.value = _hexDecadeIdx;
    window.setHexDecade(_hexDecadeIdx);
    if (_hexDecadeIdx >= GBIF_DECADES.length - 1) window.pauseHexTimeline();
  }, 1400);
};

window.pauseHexTimeline = function() {
  clearInterval(_hexPlayInterval);
  _hexPlayInterval = null;
  const btn = document.getElementById('hex-ts-play-btn');
  if (btn) { btn.textContent = '▶ Play'; btn.classList.remove('playing'); }
};

// Called by the sidebar theme selector (wired in species.js).
window.switchSpeciesTheme = function(themeName) {
  // Stop whichever timeline is running when switching away from its theme
  if (activeSpeciesTheme === 'points' && themeName !== 'points') {
    window.pauseGbifTimeline();
  }
  if (activeSpeciesTheme !== 'points' && themeName === 'points') {
    window.pauseHexTimeline();
    // Reset hex layer to show all data when leaving
    if (LG.speciesHexLayer) LG.speciesHexLayer.setWhere('1=1');
    _hexDecadeIdx = 4;
  }

  activeSpeciesTheme = themeName;
  window._activeSpeciesTheme = themeName;

  if (themeName === 'points') {
    // Option C: lazy-build the heavy featureLayer only on first selection
    if (!LG.gbifPointsLayer) buildGbifPointsLayer();
    // Option A: if still at broad zoom, fly to the dense-records entry view
    if (map && map.getZoom() < SPECIES_ENTRY_ZOOM) {
      map.flyTo(SPECIES_ENTRY_CENTER, SPECIES_ENTRY_ZOOM, { duration: 1.0, easeLinearity: 0.5 });
    }
    if (LG.speciesHexLayer && map.hasLayer(LG.speciesHexLayer)) map.removeLayer(LG.speciesHexLayer);
    updateGbifLayersByZoom();
  } else {
    // Remove both GBIF layers
    if (LG.gbifPointsLayer && map.hasLayer(LG.gbifPointsLayer)) map.removeLayer(LG.gbifPointsLayer);
    if (gbifHeatLayer && map.hasLayer(gbifHeatLayer)) map.removeLayer(gbifHeatLayer);
    // Show hex layer styled for this theme
    if (LG.speciesHexLayer) {
      if (!map.hasLayer(LG.speciesHexLayer)) LG.speciesHexLayer.addTo(map);
      if (SPECIES_HEX_THEMES[themeName]) {
        LG.speciesHexLayer.setStyle(f => getSpeciesHexStyle(themeName, f));
      }
    }
  }

  if (typeof window.renderSpeciesHexLegend === 'function') {
    window.renderSpeciesHexLegend(themeName);
  }
};

// ---- Species occurrence points ----
function buildSpeciesPoints(period) {
  if (LG.speciesPoints) { map.removeLayer(LG.speciesPoints); }
  LG.speciesPoints = L.layerGroup();

  const features = DATA.species?.features || [];
  const filtered = period === 'all'
    ? features
    : features.filter(f => f.properties?.time_period === period);

  filtered.forEach(feature => {
    if (!feature.geometry || feature.geometry.type !== 'Point') return;
    const [lng, lat] = feature.geometry.coordinates;
    const p = feature.properties || {};
    const color = ERA_COLORS[p.time_period] || '#888';

    L.circleMarker([lat, lng], {
      radius: 6,
      fillColor: color,
      color: 'rgba(255,255,255,0.6)',
      weight: 1,
      fillOpacity: 0.75,
      opacity: 1,
    }).bindPopup(`
      <div style="font-family:Inter,sans-serif;min-width:170px;padding:8px 10px;">
        <p style="margin:0 0 3px;font-style:italic;color:#1B5E3B;font-size:12px;font-weight:600">${p.scientific_name || 'Unknown'}</p>
        <p style="margin:0 0 2px;font-size:11px;color:#666">Year: <strong>${p.year || 'N/A'}</strong></p>
        <p style="margin:0 0 2px;font-size:11px;color:#666">Páramo: ${p.paramo_name || 'N/A'}</p>
        <span style="display:inline-block;margin-top:4px;padding:2px 7px;border-radius:999px;font-size:10px;background:${color}22;color:${color};border:1px solid ${color}55;font-weight:600">${p.time_period || ''}</span>
      </div>
    `, { maxWidth: 220 }).addTo(LG.speciesPoints);
  });
}

// ---- Threat layers ----
function buildThreatLayers() {
  const features = DATA.landCover?.features || [];

  // Agriculture
  if (LG.agriculture) map.removeLayer(LG.agriculture);
  LG.agriculture = L.layerGroup();
  L.geoJSON({ type: 'FeatureCollection', features: features.filter(f => f.properties?.land_cover_class === 'Agriculture') }, {
    style: { fillColor: '#F9A825', color: '#E65100', weight: 1, fillOpacity: 0.6, opacity: 0.8 },
    onEachFeature(feature, layer) {
      const p = feature.properties;
      layer.bindPopup(`<div style="font-family:Inter,sans-serif;padding:8px 10px;font-size:12px"><strong style="color:#E65100">🌾 Agriculture</strong><br>Year: ${p.year}<br>Area: ${p.area_ha?.toLocaleString()} ha<br>Distance to páramo: ${p.paramo_proximity_km} km</div>`);
      layer.on('mouseover', function() { if (_mapMoving) return; this.setStyle({ fillOpacity: 0.85 }); });
      layer.on('mouseout',  function() { this.setStyle({ fillOpacity: 0.6 }); });
    },
  }).addTo(LG.agriculture);

  // Urban
  if (LG.urban) map.removeLayer(LG.urban);
  LG.urban = L.layerGroup();
  L.geoJSON({ type: 'FeatureCollection', features: features.filter(f => f.properties?.land_cover_class === 'Urban') }, {
    style: { fillColor: '#546E7A', color: '#37474F', weight: 1, fillOpacity: 0.55, opacity: 0.8 },
    onEachFeature(feature, layer) {
      const p = feature.properties;
      layer.bindPopup(`<div style="font-family:Inter,sans-serif;padding:8px 10px;font-size:12px"><strong style="color:#546E7A">🏙️ Urban area</strong><br>Year: ${p.year}<br>Area: ${p.area_ha?.toLocaleString()} ha</div>`);
    },
  }).addTo(LG.urban);

  // Mining
  if (LG.mining) map.removeLayer(LG.mining);
  LG.mining = L.layerGroup();
  L.geoJSON({ type: 'FeatureCollection', features: features.filter(f => f.properties?.land_cover_class === 'Mining') }, {
    style: { fillColor: '#FDD835', color: '#B8860B', weight: 1, fillOpacity: 0.6, opacity: 0.9 },
    onEachFeature(feature, layer) {
      const p = feature.properties;
      layer.bindPopup(`<div style="font-family:Inter,sans-serif;padding:8px 10px;font-size:12px"><strong style="color:#B8860B">⛏️ Mining zone</strong><br>Year: ${p.year}<br>Area: ${p.area_ha?.toLocaleString()} ha</div>`);
    },
  }).addTo(LG.mining);

  // Fire
  if (LG.fire) map.removeLayer(LG.fire);
  LG.fire = L.layerGroup();
  (DATA.fire?.features || []).forEach(feature => {
    if (feature.geometry?.type !== 'Point') return;
    const [lng, lat] = feature.geometry.coordinates;
    const p = feature.properties || {};
    const r = Math.min(11, Math.max(5, Math.sqrt((p.fire_radiative_power || 50) / 8)));
    L.circleMarker([lat, lng], {
      radius: r,
      fillColor: '#C0392B',
      color: '#7B241C',
      weight: 1,
      fillOpacity: 0.8,
    }).bindPopup(`<div style="font-family:Inter,sans-serif;padding:8px 10px;font-size:12px"><strong style="color:#C0392B">🔥 Fire Alert</strong><br>Year: ${p.year}  Month: ${p.month}<br>Confidence: ${p.confidence}<br>FRP: ${p.fire_radiative_power?.toFixed(1)} MW<br>Páramo: ${p.paramo_name || 'N/A'}</div>`).addTo(LG.fire);
  });
}

// ---- Provisional urgency scores (prototype / illustrative) ----
// These are approximate values used to demonstrate the dashboard design.
// Final scores will be recalculated from completed threat, biodiversity,
// and habitat layers. All values marked as provisional in the popup.
const PROVISIONAL_URGENCY_DATA = [
  { name: 'Santurbán',               score: 4.9, cls: 'Very High', agri: 3, urban: 2, fire: 1, bio: 5, concern: 'Mining (196 active concessions)',              threat: 'Mining'         },
  { name: 'Rabanal',                  score: 4.6, cls: 'High',      agri: 4, urban: 3, fire: 2, bio: 3, concern: 'Mining and agricultural expansion',             threat: 'Mining'         },
  { name: 'Sierra Nevada',            score: 4.5, cls: 'High',      agri: 4, urban: 2, fire: 3, bio: 5, concern: 'Agricultural encroachment into endemic habitat', threat: 'Agriculture'    },
  { name: 'Sumapaz',                  score: 4.4, cls: 'High',      agri: 4, urban: 4, fire: 5, bio: 5, concern: 'Fire and urban expansion from Bogotá',           threat: 'Fire'           },
  { name: 'Cruz Verde-Sumapaz',       score: 4.2, cls: 'High',      agri: 4, urban: 4, fire: 4, bio: 4, concern: 'Fire and peri-urban agricultural pressure',      threat: 'Fire'           },
  { name: 'Chingaza',                 score: 4.3, cls: 'High',      agri: 3, urban: 4, fire: 2, bio: 4, concern: 'Urban proximity — Bogotá water supply at risk',  threat: 'Urban pressure' },
  { name: 'Almorzadero',              score: 4.2, cls: 'High',      agri: 4, urban: 2, fire: 3, bio: 3, concern: 'Agricultural pressure on intact peat bogs',       threat: 'Agriculture'    },
  { name: 'Los Nevados',              score: 4.1, cls: 'High',      agri: 3, urban: 2, fire: 3, bio: 4, concern: 'Glacial retreat (>85% since 1850) + agriculture', threat: 'Agriculture'    },
  { name: 'Tota-Bijagual-Mamapacha',  score: 3.7, cls: 'Moderate',  agri: 3, urban: 3, fire: 3, bio: 3, concern: 'Mixed agricultural and urban pressure',           threat: 'Agriculture'    },
  { name: 'Las Hermosas',             score: 3.6, cls: 'Moderate',  agri: 3, urban: 2, fire: 3, bio: 3, concern: 'Agricultural encroachment',                       threat: 'Agriculture'    },
  { name: 'Cocuy',                    score: 3.5, cls: 'Moderate',  agri: 2, urban: 1, fire: 3, bio: 4, concern: 'Tourism pressure and glacial retreat',            threat: 'Climate'        },
  { name: 'Nevado del Huila',         score: 3.4, cls: 'Moderate',  agri: 3, urban: 1, fire: 3, bio: 3, concern: 'Agricultural pressure and climate vulnerability', threat: 'Agriculture'    },
  { name: 'Farallones de Cali',       score: 3.4, cls: 'Moderate',  agri: 3, urban: 3, fire: 3, bio: 3, concern: 'Urban-agricultural pressure near Cali',           threat: 'Agriculture'    },
  { name: 'Guerrero',                 score: 3.3, cls: 'Moderate',  agri: 3, urban: 3, fire: 2, bio: 3, concern: 'Agricultural expansion and urban proximity',       threat: 'Agriculture'    },
  { name: 'Pisba',                    score: 3.2, cls: 'Moderate',  agri: 3, urban: 1, fire: 3, bio: 3, concern: 'Agricultural pressure',                           threat: 'Agriculture'    },
  { name: 'Chili-Barragán',           score: 3.2, cls: 'Moderate',  agri: 3, urban: 2, fire: 2, bio: 3, concern: 'Agricultural pressure',                           threat: 'Agriculture'    },
  { name: 'Iguaque-Merchán',          score: 3.1, cls: 'Moderate',  agri: 3, urban: 2, fire: 2, bio: 3, concern: 'Agricultural encroachment',                       threat: 'Agriculture'    },
  { name: 'Belmira',                  score: 3.0, cls: 'Moderate',  agri: 3, urban: 2, fire: 2, bio: 2, concern: 'Pasture expansion',                               threat: 'Agriculture'    },
  { name: 'Frontino-Urrao',           score: 2.5, cls: 'Low',       agri: 2, urban: 1, fire: 2, bio: 3, concern: 'Agricultural pressure',                           threat: 'Agriculture'    },
  { name: 'Sonsón',                   score: 2.3, cls: 'Low',       agri: 2, urban: 1, fire: 2, bio: 2, concern: 'Agricultural pressure',                           threat: 'Agriculture'    },
  { name: 'Tatamá',                   score: 2.1, cls: 'Low',       agri: 2, urban: 1, fire: 1, bio: 3, concern: 'Agricultural pressure',                           threat: 'Agriculture'    },
];

// Build normalized lookup once (accent-stripped lowercase → data entry)
const _provisionalLookup = Object.fromEntries(
  PROVISIONAL_URGENCY_DATA.map(d => [_normalizeParamoName(d.name), d])
);

function _lookupProvisional(pacomplejo) {
  if (!pacomplejo) return null;
  const key = _normalizeParamoName(pacomplejo);
  if (_provisionalLookup[key]) return _provisionalLookup[key];
  // Try stripping common article prefix ("El", "La", "Los", "Las")
  const noPrefix = key.replace(/^(el|la|los|las)\s+/, '');
  if (_provisionalLookup[noPrefix]) return _provisionalLookup[noPrefix];
  // Partial match — longest lookup key that is contained by key or vice versa
  let best = null, bestLen = 0;
  for (const [lk, val] of Object.entries(_provisionalLookup)) {
    if ((key.includes(lk) || lk.includes(key)) && lk.length > bestLen) {
      best = val; bestLen = lk.length;
    }
  }
  return best;
}

// ---- Urgency páramo layer ----
// Styles official páramo complex boundaries by provisional urgency score.
// Matches FeatureServer polygons via normalized name lookup.
function buildUrgencyLayer() {
  if (LG.urgencyParamos) {
    if (map.hasLayer(LG.urgencyParamos)) map.removeLayer(LG.urgencyParamos);
    LG.urgencyParamos = null;
  }

  // ── Small indicator bar helper (inline HTML, 0–5 scale) ──────────────────
  function _indicatorBar(val, color) {
    const pct = Math.round((val / 5) * 100);
    return `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">
      <div style="flex:1;height:5px;background:#E8EAE4;border-radius:3px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:${color};border-radius:3px"></div>
      </div>
      <span style="font-size:10px;color:#666;width:14px;text-align:right">${val}/5</span>
    </div>`;
  }

  LG.urgencyParamos = L.esri.featureLayer({
    url: PARAMO_FEATURE_URL,
    style(feature) {
      const u = _lookupProvisional(feature.properties?.pacomplejo);
      if (!u) {
        return { fillColor: URGENCY_COLORS.noData, color: 'rgba(255,255,255,0.6)', weight: 0.8, fillOpacity: 0.28 };
      }
      return { fillColor: getUrgencyColor(u.score), color: 'rgba(255,255,255,0.8)', weight: 0.8, fillOpacity: 0.62 };
    },
    onEachFeature(feature, layer) {
      const p    = feature.properties || {};
      const name = p.pacomplejo || p.pacodigo || 'Páramo';
      const u    = _lookupProvisional(p.pacomplejo);
      const color = u ? getUrgencyColor(u.score) : URGENCY_COLORS.noData;
      const isDark = u && color !== URGENCY_COLORS.veryLow && color !== URGENCY_COLORS.noData;

      // Tooltip
      layer.bindTooltip(
        `<div style="font-family:Inter,sans-serif;font-size:11px;padding:3px 6px">
           <strong style="color:${u ? color : '#999'}">${u ? u.cls : 'No data'} ${u ? '· prototype' : ''}</strong><br>${name}
         </div>`,
        { sticky: true, direction: 'top', opacity: 1 }
      );

      // Popup
      const badge = u
        ? `<span style="display:inline-block;padding:2px 9px;border-radius:999px;font-size:10px;font-weight:700;background:${color};color:${isDark ? '#fff' : '#555'}">${u.cls}</span>`
        : `<span style="display:inline-block;padding:2px 9px;border-radius:999px;font-size:10px;font-weight:600;background:#e0e0dc;color:#777">No data</span>`;

      const indicators = u ? `
        <div style="margin-top:10px">
          <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#888;letter-spacing:0.06em;text-transform:uppercase">Pressure indicators</p>
          <p style="margin:0 0 2px;font-size:10px;color:#555">Agriculture</p>
          ${_indicatorBar(u.agri,  '#79C7B5')}
          <p style="margin:4px 0 2px;font-size:10px;color:#555">Urban proximity</p>
          ${_indicatorBar(u.urban, '#E6A15D')}
          <p style="margin:4px 0 2px;font-size:10px;color:#555">Fire frequency</p>
          ${_indicatorBar(u.fire,  '#C94A38')}
          <p style="margin:4px 0 2px;font-size:10px;color:#555">Biodiversity importance</p>
          ${_indicatorBar(u.bio,   '#1B5E3B')}
        </div>
        <p style="margin:8px 0 4px;font-size:10px;color:#555"><strong style="color:#C8A840">Main concern:</strong> ${u.concern}</p>` : '';

      const note = `<p style="margin:8px 0 0;font-size:9.5px;color:#AAA;font-style:italic;border-top:1px solid #eee;padding-top:6px">
        ${u ? '⚠ Prototype value — pending final analysis' : 'No urgency data available for this complex'}
      </p>`;

      layer.bindPopup(`
        <div style="font-family:Inter,sans-serif;padding:10px 12px;min-width:220px;max-width:270px">
          <h4 style="margin:0 0 5px;font-family:'Playfair Display',serif;font-size:14px;color:#1B5E3B">${name}</h4>
          ${badge}
          ${u ? `<p style="margin:5px 0 0;font-size:10px;color:#888">Prototype score: <strong style="color:#333">${u.score.toFixed(1)} / 5.0</strong></p>` : ''}
          ${indicators}
          ${note}
        </div>
      `, { maxWidth: 285 });

      layer.on('mouseover', function() {
        if (_mapMoving) return;
        this.setStyle({ color: '#1F2937', weight: 2, fillOpacity: u ? 0.80 : 0.40 });
        this.bringToFront();
      });
      layer.on('mouseout', function() { LG.urgencyParamos.resetStyle(this); });
    },
  });
}

// ============================================================
// POPUP BUILDERS
// ============================================================

// ---- Páramo popup images ----
// All images are served from the local Photos/ folder (relative to index.html).
// Images are assigned to páramos by hashing the feature name and cycling through
// the array — every popup shows a real photo, no blank containers.
// To assign specific images to specific páramos later, replace this array with
// a lookup table keyed by pacomplejo value.
const PARAMO_POPUP_IMAGES = [
  'Photos/pexels-andrea-beltran-329102829-13834163.jpg',
  'Photos/pexels-higarcia-13542634.jpg',
  'Photos/pexels-juan-felipe-ramirez-312591454-17370936.jpg',
  'Photos/pexels-juan-felipe-ramirez-312591454-17398429.jpg',
  'Photos/pexels-juan-felipe-ramirez-312591454-17398435.jpg',
  'Photos/pexels-juan-felipe-ramirez-312591454-17398452.jpg',
  'Photos/pexels-juan-felipe-ramirez-312591454-28154523.jpg',
  'Photos/pexels-juan-felipe-ramirez-312591454-28154527.jpg',
  'Photos/pexels-juan-felipe-ramirez-312591454-28154580.jpg',
  'Photos/pexels-juan-felipe-ramirez-312591454-28154615.jpg',
  'Photos/pexels-juan-felipe-ramirez-312591454-28154634.jpg',
  'Photos/pexels-juan-felipe-ramirez-312591454-28154864.jpg',
  'Photos/pexels-juan-felipe-ramirez-312591454-28154865.jpg',
  'Photos/pexels-juan-felipe-ramirez-312591454-28154920.jpg',
  'Photos/pexels-julia-volk-5197969.jpg',
];

/**
 * Simple non-cryptographic string hash — maps a name to a stable integer.
 * Used to pick a consistent image per páramo name without a lookup table.
 */
function _hashParamoName(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return Math.abs(h);
}

/**
 * Returns a local photo path for any páramo name.
 * Every name maps to a stable image via hash — no blank containers.
 * @param {string} name — the pacomplejo value from the feature properties
 * @returns {string}
 */
function _paramoImageForName(name) {
  const key   = name ? name.trim() : 'default';
  const index = _hashParamoName(key) % PARAMO_POPUP_IMAGES.length;
  return PARAMO_POPUP_IMAGES[index];
}

function buildTooltipHTML(p) {
  const name = p.pacomplejo || p.pacodigo || 'Páramo';
  const area = p.paarea != null ? Number(p.paarea).toLocaleString(undefined, { maximumFractionDigits: 0 }) : null;
  return `
    <div style="font-size:12px;padding:5px 8px;max-width:220px;line-height:1.5;">
      <strong style="color:#C8A840;font-size:13px;">${name}</strong>
      ${area ? `<br><span style="color:#888">Area: ${area} ha</span>` : ''}
    </div>
  `;
}

function buildParamoPopup(p) {
  const name    = p.pacomplejo || p.pacodigo || 'Páramo';
  const code    = p.pacodigo   || 'Not available';
  const distrit = p.padistrito || 'Not available';
  const sector  = p.pasector   || 'Not available';
  const area    = p.paarea != null ? Number(p.paarea).toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' ha' : 'Not available';
  const cotaMax = p.pacotamax  != null ? Number(p.pacotamax).toLocaleString() + ' m' : 'Not available';
  const cotaMin = p.pacotamin  != null ? Number(p.pacotamin).toLocaleString() + ' m' : 'Not available';

  const imgUrl = _paramoImageForName(name);
  const imgHTML = `
    <div style="position:relative;height:140px;margin-bottom:10px;border-radius:8px;
                overflow:hidden;
                background:linear-gradient(135deg,#1B5E3B 0%,#2E7D52 55%,#C8A840 100%);">
      <img src="${imgUrl}" alt="${name}" loading="lazy"
           style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;"
           onerror="this.style.display='none'">
    </div>`;

  return `
    <div style="padding:12px 14px;min-width:220px;max-width:280px;">
      ${imgHTML}
      <h3 style="margin:0 0 4px;font-size:15px;color:#C8A840;border-bottom:1px solid #eee;padding-bottom:6px">${name}</h3>
      <table style="width:100%;font-size:12px;border-collapse:collapse;margin-top:6px">
        <tr><td style="color:#888;padding:2px 0;width:45%">Code</td><td style="font-weight:600">${code}</td></tr>
        <tr><td style="color:#888;padding:2px 0">District</td><td style="font-weight:600">${distrit}</td></tr>
        <tr><td style="color:#888;padding:2px 0">Sector</td><td style="font-weight:600">${sector}</td></tr>
        <tr><td style="color:#888;padding:2px 0">Area</td><td style="font-weight:600">${area}</td></tr>
        <tr><td style="color:#888;padding:2px 0">Max elevation</td><td style="font-weight:600">${cotaMax}</td></tr>
        <tr><td style="color:#888;padding:2px 0">Min elevation</td><td style="font-weight:600">${cotaMin}</td></tr>
      </table>
    </div>
  `;
}

// ============================================================
// LAYER VISIBILITY MANAGEMENT
// ============================================================

function showLayer(key) {
  const lg = LG[key];
  if (!lg || !map) return;
  if (!map.hasLayer(lg)) lg.addTo(map);
}

function hideLayer(key) {
  const lg = LG[key];
  if (lg && map && map.hasLayer(lg)) map.removeLayer(lg);
}

function applyPanelLayers(panelId) {
  const panelDefault = PANEL_LAYERS[panelId] || PANEL_LAYERS.overview;

  // All layer keys
  const allKeys = Object.keys(LG);

  allKeys.forEach(key => {
    if (panelDefault.includes(key)) {
      showLayer(key);
    } else {
      hideLayer(key);
    }
  });
}

// Global: set an individual data layer visible/hidden (called by layers dropdown)
window.setLayerVisible = function(layerKey, visible) {
  if (visible) showLayer(layerKey);
  else hideLayer(layerKey);
};

// Global: toggle basemap layers (terrain / hillshade / vector tiles)
// Add a new case here each time you add a basemap layer to the dropdown.
window.setBasemapVisible = function(key, visible) {
  switch (key) {
    case 'terrain':
      if (terrainLayer && map) {
        visible ? terrainLayer.addTo(map) : map.removeLayer(terrainLayer);
      }
      break;
    case 'hillshade': {
      const glDiv = document.getElementById('hillshade-gl');
      if (glDiv) glDiv.style.display = visible ? '' : 'none';
      break;
    }
    case 'satellite': {
      if (visible) {
        if (!satelliteLayer) {
          satelliteLayer = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            { attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community', maxZoom: 19, pane: 'tilePane' }
          );
        }
        if (map && !map.hasLayer(satelliteLayer)) {
          satelliteLayer.addTo(map);
          // Place satellite above terrain (z=200), below GL overlays
          if (terrainLayer && map.hasLayer(terrainLayer)) terrainLayer.setOpacity(0);
        }
      } else {
        if (satelliteLayer && map && map.hasLayer(satelliteLayer)) map.removeLayer(satelliteLayer);
        // Restore terrain opacity
        const terrainCheck = document.getElementById('gl-basemap-terrain');
        if (terrainLayer && map && (terrainCheck ? terrainCheck.checked : true)) terrainLayer.setOpacity(0.78);
      }
      break;
    }
    case 'vectortiles': {
      const vtDiv = document.getElementById('vector-tile-gl');
      if (vtDiv) vtDiv.style.display = visible ? '' : 'none';
      break;
    }
    case 'detail':
      _detailEnabled = visible;
      updateDetailLayerVisibility();
      break;
    // ── Add future basemap cases here ──────────────────────────────────
  }
};

// Reorder Leaflet data layers to match the dropdown's visual order.
// orderedKeys[0] = top of list = should render ON TOP of the map.
// Leaflet renders last-added on top, so we bring layers to front
// from bottom of list to top (reverse order).
window.reorderLayers = function(orderedKeys) {
  [...orderedKeys].reverse().forEach(key => {
    const lg = LG[key];
    if (lg && map && map.hasLayer(lg) && typeof lg.bringToFront === 'function') {
      lg.bringToFront();
    }
  });
};

// Set the opacity of a data layer (called by the opacity slider).
// Uses per-layer base fill ratios so the relative fill/stroke balance is preserved.
window.setLayerOpacity = function(key, opacity) {
  const lg = LG[key];
  if (!lg) return;

  // Base fill opacity for each layer (matches the original style definitions)
  const BASE_FILL = {
    paramoFill:      0.68,
    paramoOutline:   0.00,
    speciesPoints:   0.75,
    agriculture:     0.60,
    urban:           0.55,
    mining:          0.60,
    fire:            0.80,
    urgencyParamos:  0.62,
  };
  const baseFill = BASE_FILL[key] ?? 0.70;

  function applyToPath(layer) {
    if (typeof layer.setStyle === 'function') {
      layer.setStyle({ opacity, fillOpacity: baseFill * opacity });
    } else if (typeof layer.setOpacity === 'function') {
      layer.setOpacity(opacity);
    }
  }

  if (typeof lg.eachLayer === 'function') {
    lg.eachLayer(child => {
      applyToPath(child);
      // Handle geoJSON layers nested inside layerGroups
      if (typeof child.eachLayer === 'function') child.eachLayer(applyToPath);
    });
  } else {
    applyToPath(lg);
  }
};

// Set the opacity of a basemap layer (called by the opacity slider).
// Add a new case here when adding a new basemap layer to the dropdown.
window.setBasemapOpacity = function(key, opacity) {
  switch (key) {
    case 'terrain':
      if (terrainLayer) terrainLayer.setOpacity(opacity);
      break;
    case 'hillshade': {
      const el = document.getElementById('hillshade-gl');
      if (el) el.style.opacity = opacity;
      break;
    }
    case 'satellite': {
      if (satelliteLayer) satelliteLayer.setOpacity(opacity);
      break;
    }
    case 'vectortiles': {
      const el = document.getElementById('vector-tile-gl');
      if (el) el.style.opacity = opacity;
      break;
    }
    case 'detail':
      _detailOpacity = opacity;
      updateDetailLayerVisibility();
      break;
    // ── Add future basemap cases here ─────────────────────────
  }
};

// ============================================================
// OPTION A — TRUE TAB ISOLATION
// Each destroy function removes all layers owned by a tab from the
// map, nulls the LG references, and resets _panelLayersBuilt so
// _ensurePanelLayers() rebuilds from the DATA cache on next visit.
// paramoFill / paramoOutline are kept alive (shared across tabs).
// ============================================================

function _destroySpeciesLayers() {
  // Stop any running playback timers
  if (_gbifPlayInterval) { clearInterval(_gbifPlayInterval); _gbifPlayInterval = null; }
  if (_hexPlayInterval)  { clearInterval(_hexPlayInterval);  _hexPlayInterval  = null; }
  // Cancel any in-flight GBIF query callback
  _gbifQuerySeq++;

  if (LG.speciesHexLayer) {
    if (map.hasLayer(LG.speciesHexLayer)) map.removeLayer(LG.speciesHexLayer);
    LG.speciesHexLayer = null;
  }
  if (LG.gbifPointsLayer) {
    if (map.hasLayer(LG.gbifPointsLayer)) map.removeLayer(LG.gbifPointsLayer);
    LG.gbifPointsLayer = null;
  }
  if (gbifHeatLayer) {
    if (map.hasLayer(gbifHeatLayer)) map.removeLayer(gbifHeatLayer);
    gbifHeatLayer = null;
  }
  _panelLayersBuilt.species = false;
  console.log('[isolation] species layers destroyed');
}

function _destroyUrgencyLayers() {
  if (LG.urgencyParamos) {
    if (map.hasLayer(LG.urgencyParamos)) map.removeLayer(LG.urgencyParamos);
    LG.urgencyParamos = null;
  }
  _panelLayersBuilt.urgency = false;
  console.log('[isolation] urgency layers destroyed');
}

function _destroyBuildLayers() {
  ['agriculture', 'fire', 'urban', 'mining'].forEach(key => {
    if (LG[key]) {
      if (map.hasLayer(LG[key])) map.removeLayer(LG[key]);
      LG[key] = null;
    }
  });
  // Also let build-paramo.js clean up its own overlays
  if (typeof window.cleanupBuildPanel === 'function') window.cleanupBuildPanel();
  _panelLayersBuilt.build = false;
  console.log('[isolation] build layers destroyed');
}

// ============================================================
// PANEL CHANGE HANDLER (called from main.js)
// ============================================================

window.onPanelChange = function(panelId) {
  // ── OPTION A: destroy ALL layers for the tab being left ────────────────────
  if (_mapActivePanel !== panelId) {
    switch (_mapActivePanel) {
      case 'species': _destroySpeciesLayers(); break;
      case 'urgency': _destroyUrgencyLayers(); break;
      case 'build':
        _destroyBuildLayers();
        // Restore Colombia close-up when leaving Build a Páramo
        if (map) map.flyTo(COLOMBIA_CENTER, DEFAULT_ZOOM, { duration: 1.2, easeLinearity: 0.5 });
        // Move zoom control back to bottom-right and remove build-mode class
        if (_zoomControl && map) {
          _zoomControl.remove();
          _zoomControl = L.control.zoom({ position: 'bottomright' }).addTo(map);
        }
        document.getElementById('map-main')?.classList.remove('map-build-mode');
        break;
      case 'threats':
        if (typeof window.cleanupThreatsPanel === 'function') window.cleanupThreatsPanel();
        break;
    }
  }
  _mapActivePanel = panelId;

  // Apply whatever layers are already built (null layers are skipped gracefully).
  applyPanelLayers(panelId);
  // Zoom gate must run AFTER applyPanelLayers so it can override any unconditional add
  updateFieldViewMarkerVisibility();

  // Lazy-build this panel's heavy layers if visiting for the first time.
  // On completion, re-apply layers and fix any theme state corrections.
  _ensurePanelLayers(panelId).then(() => {
    if (_mapActivePanel !== panelId) return;   // user navigated away — discard
    applyPanelLayers(panelId);
    updateFieldViewMarkerVisibility();   // re-apply zoom gate after lazy build
    if (panelId === 'species') _applySpeciesThemeCorrection();
  });

  // ── Special-case per-panel side-effects ───────────────────────────────────

  // Build a Páramo: fly to wider regional view so users see the equatorial context
  // (Colombia, Ecuador, Venezuela, Peru) and why páramos are geographically rare.
  if (panelId === 'build') {
    if (map) map.flyTo([3.5, -73], 4, { duration: 1.4, easeLinearity: 0.5 });
    // Move zoom control to top-right so it does not cover the floating legend.
    // The map-build-mode class pushes the topright corner below the nav bar.
    if (_zoomControl && map) {
      _zoomControl.remove();
      _zoomControl = L.control.zoom({ position: 'topright' }).addTo(map);
    }
    document.getElementById('map-main')?.classList.add('map-build-mode');
  }

  // Show terrain cross-section explorer on overview panel, hide on others
  if (window.TP) {
    if (panelId === 'overview') window.TP.show();
    else window.TP.hide();
  }

  // Species panel: fly to the dense-records entry view (Option A) and correct
  // layer visibility for the active theme.
  if (panelId === 'species') {
    if (map) map.flyTo(SPECIES_ENTRY_CENTER, SPECIES_ENTRY_ZOOM, { duration: 1.2, easeLinearity: 0.5 });
    _applySpeciesThemeCorrection();
  }

  // Threats panel: wiring is handled by threats.js via main.js afterPanelRender
};

// Reset species map to the full Colombia view (called by "View full range" button)
window.resetSpeciesView = function() {
  if (map) map.flyTo(COLOMBIA_CENTER, DEFAULT_ZOOM, { duration: 1.2, easeLinearity: 0.5 });
};

// Wire threat layer checkboxes (threats panel injects them dynamically)
function wireThreatToggles() {
  const MAP = {
    'toggle-agriculture': 'agriculture',
    'toggle-fire':        'fire',
    'toggle-urban':       'urban',
    'toggle-mining':      'mining',
  };
  Object.entries(MAP).forEach(([id, key]) => {
    const cb = document.getElementById(id);
    if (!cb) return;
    // Set initial state based on whether layer is on map
    cb.checked = map.hasLayer(LG[key]);
    cb.addEventListener('change', () => {
      if (cb.checked) showLayer(key);
      else hideLayer(key);
    });
  });
}

// Expose for main.js afterPanelRender
window.initThreatToggles = function() {
  setTimeout(wireThreatToggles, 80);
};

// ============================================================
// TIME FILTER (called by timeslider.js)
// ============================================================

window.filterMapByPeriod = function(period) {
  currentPeriod = period;
  buildSpeciesPoints(period);
  // If species layer is visible, refresh it
  if (map && LG.speciesPoints) {
    LG.speciesPoints.addTo(map);
  }
  // Update count display
  const features = DATA.species?.features || [];
  const count = period === 'all' ? features.length : features.filter(f => f.properties?.time_period === period).length;
  const el = document.getElementById('record-count');
  if (el) {
    const cfg = { 'all': { label:'All time', color:'#1B5E3B' }, 'before-1980': { label:'Before 1980', color:'#5B2C8D' }, '1980-1999': { label:'1980–1999', color:'#2874A6' }, '2000-2010': { label:'2000–2010', color:'#148F77' }, '2011-2020': { label:'2011–2020', color:'#E67E22' }, '2021-present': { label:'2021–Present', color:'#27AE60' } }[period] || {};
    el.innerHTML = `<strong style="color:${cfg.color}">${count.toLocaleString()} records</strong> — <em>${cfg.label}</em>`;
  }
};

// ============================================================
// MAP PADDING (account for side panel width)
// ============================================================

window.updateMapPadding = function(panelWidth) {
  if (!map) return;
  // Leaflet doesn't support CSS padding directly, but we can pan
  // The map itself fills the full screen; the panel overlays it
  // Just invalidate size so map re-calculates tiles
  setTimeout(() => map.invalidateSize({ animate: true }), 350);
};

// ============================================================
// ENTRY POINT
// ============================================================

(function boot() {
  function tryInit() {
    if (typeof L === 'undefined') {
      setTimeout(tryInit, 80);
      return;
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initMap);
    } else {
      initMap();
    }
  }
  tryInit();
})();
