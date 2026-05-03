// ============================================================
// VANISHING CLOUDS — maps.js  (Audubon-style single-map)
// One persistent full-screen Leaflet map.
// Layer groups toggled based on active panel.
// ============================================================

// ---- CONFIG ----
const COLOMBIA_BOUNDS   = [[-4.2, -79.0], [12.5, -66.9]];
const COLOMBIA_CENTER   = [5.0, -73.8];   // centred on the main Andean páramo belt
const DEFAULT_ZOOM      = 6;              // country-level view — shows all of Colombia on load
const MIN_ZOOM          = 3;              // zoom-out limit: shows all Colombia
const MAX_ZOOM          = 9;             // zoom-in limit: ~20 miles on a 1080p monitor (23 mi full-screen)

// ---- PARAMO FEATURE LAYER (ArcGIS FeatureServer) ----
const PARAMO_FEATURE_URL = 'https://services1.arcgis.com/ZIL9uO234SBBPGL7/arcgis/rest/services/Paramos_de_Colombia_CopyFeatures/FeatureServer/0';

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
  veryLow:  '#FFFFCC',
  low:      '#C7E9B4',
  moderate: '#7FCDBB',
  high:     '#F4A261',
  veryHigh: '#C0392B',
};


// ---- MAP + LAYER GROUPS ----
let map = null;
let terrainLayer    = null;   // L.esri.tiledMapLayer — Colombia terrain basemap
let vectorTileLayer = null;   // MapLibre GL map — base vector tile overlay (labels/roads)
let detailTileLayer = null;   // MapLibre GL map — detail vector tiles (water/urban, zoom-gated)
let hillshadeMapGL  = null;   // MapLibre GL map — hillshade overlay

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

const LG = {
  paramoFill:      null,
  paramoOutline:   null,
  speciesPoints:   null,
  agriculture:     null,
  fire:            null,
  urban:           null,
  mining:          null,
  urgencyHexagons: null,
};

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
  overview:  ['paramoFill', 'paramoOutline'],
  species:   ['paramoOutline', 'speciesPoints'],
  timeline:  ['paramoOutline', 'speciesPoints'],
  threats:   ['paramoOutline', 'agriculture', 'fire'],
  urgency:   ['urgencyHexagons', 'paramoOutline'],
  about:     ['paramoFill', 'paramoOutline'],
};

// Current time-period filter for species points
let currentPeriod = 'all';

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

  // ── Zoom diffuse effect ──────────────────────────────────────────────────
  // Blurs #map-main on zoomstart; debounced zoomend removes it 200 ms after
  // the last zoom step so rapid scroll-wheel zooming holds the blur until
  // the user settles on a level, then dissolves smoothly via CSS transition.
  (function initZoomBlur() {
    const mapEl = document.getElementById('map-main');
    let timer   = null;

    map.on('zoomstart', () => {
      clearTimeout(timer);
      mapEl.classList.add('map-zooming');
    });

    map.on('zoomend', () => {
      clearTimeout(timer);
      timer = setTimeout(() => mapEl.classList.remove('map-zooming'), 200);
    });
  })();

  // ---- LAYER 1: Custom Colombia terrain — esri-leaflet TiledMapLayer ----
  // Uses ArcGIS REST API natively; handles service discovery, CORS, and auth.
  terrainLayer = L.esri.tiledMapLayer({
    url: TERRAIN_URL,
    attribution: 'Custom terrain basemap',
    maxZoom: 18,
    opacity: 1,
  }).addTo(map);

  // ---- LAYER 2: Hillshade — dedicated MapLibre GL canvas at z=202 ----
  initHillshadeOverlay();

  // Zoom control — bottom-right, above data strip
  L.control.zoom({ position: 'bottomright' }).addTo(map);

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

  // Load all data then build initial layers
  loadAllData();
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

async function loadAllData() {
  // ── Páramo layers load live from ArcGIS FeatureServer — completely independent
  // of the local GeoJSON files below. Build and show them immediately so a failure
  // in the local data fetch can never take them down.
  buildParamoFill();
  buildParamoOutline();
  applyPanelLayers('overview');

  // ── Local GeoJSON data (species, land cover, fire, urgency) ──
  // Wrapped in its own try/catch so errors here never affect the páramo layer.
  try {
    const [speciesRes, landRes, fireRes, urgencyRes] = await Promise.all([
      fetch('data/species_occurrences.geojson'),
      fetch('data/land_cover_change.geojson'),
      fetch('data/fire_alerts.geojson'),
      fetch('data/urgency_index.geojson'),
    ]);

    DATA.species   = await speciesRes.json();
    DATA.landCover = await landRes.json();
    DATA.fire      = await fireRes.json();
    DATA.urgency   = await urgencyRes.json();

    buildSpeciesPoints('all');
    buildThreatLayers();
    buildUrgencyLayer();

  } catch (err) {
    console.warn('[maps.js] Local data load failed (non-critical):', err.message);
  }
}

// (buildAllLayers removed — páramo layers are built at the top of loadAllData,
//  species/threat/urgency are built after their data files resolve)

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
    },
  });
}

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
      layer.on('mouseover', function() { this.setStyle({ fillOpacity: 0.85 }); });
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

// ---- Urgency hexagon layer ----
function buildUrgencyLayer() {
  if (LG.urgencyHexagons) map.removeLayer(LG.urgencyHexagons);

  LG.urgencyHexagons = L.geoJSON(DATA.urgency, {
    style(feature) {
      const color = getUrgencyColor(feature.properties?.urgency_score || 0);
      return { fillColor: color, color: 'rgba(255,255,255,0.5)', weight: 0.8, fillOpacity: 0.75 };
    },
    onEachFeature(feature, layer) {
      const p = feature.properties || {};
      const color = getUrgencyColor(p.urgency_score || 0);
      layer.bindTooltip(
        `<div style="font-family:Inter,sans-serif;font-size:11px;padding:3px 6px"><strong style="color:${color}">${p.urgency_class}</strong><br>${p.paramo_name || ''}</div>`,
        { sticky: true, direction: 'top', opacity: 1 }
      );
      layer.bindPopup(`
        <div style="font-family:Inter,sans-serif;padding:10px 12px;min-width:190px;">
          <h4 style="margin:0 0 6px;font-family:'Playfair Display',serif;font-size:14px;color:#1B5E3B">${p.paramo_name || 'Area'}</h4>
          <span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;background:${color};color:${color === '#FFFFCC' ? '#666' : '#fff'}">${p.urgency_class}</span>
          <table style="width:100%;font-size:11px;margin-top:8px;border-collapse:collapse">
            <tr><td style="color:#888;padding:2px 0">Urgency score</td><td style="font-weight:600">${p.urgency_score?.toFixed(2)}</td></tr>
            <tr><td style="color:#888;padding:2px 0">Endemic richness</td><td style="font-weight:600">${p.endemic_richness_score}/5</td></tr>
            <tr><td style="color:#888;padding:2px 0">Dominant threat</td><td style="font-weight:600">${p.dominant_threat}</td></tr>
          </table>
        </div>
      `, { maxWidth: 240 });
      layer.on('mouseover', function() { this.setStyle({ fillOpacity: 0.92, weight: 2 }); this.bringToFront(); });
      layer.on('mouseout',  function() { LG.urgencyHexagons.resetStyle(this); });
    },
  });
}

// ============================================================
// POPUP BUILDERS
// ============================================================

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
  const code    = p.pacodigo   || '—';
  const distrit = p.padistrito || '—';
  const sector  = p.pasector   || null;
  const area    = p.paarea != null ? Number(p.paarea).toLocaleString(undefined, { maximumFractionDigits: 0 }) : null;
  const cotaMax = p.pacotamax  != null ? Number(p.pacotamax).toLocaleString() + ' m' : '—';
  const cotaMin = p.pacotamin  != null ? Number(p.pacotamin).toLocaleString() + ' m' : '—';
  return `
    <div style="padding:12px 14px;min-width:220px;">
      <h3 style="margin:0 0 4px;font-size:15px;color:#C8A840;border-bottom:1px solid #eee;padding-bottom:6px">${name}</h3>
      <table style="width:100%;font-size:12px;border-collapse:collapse;margin-top:6px">
        <tr><td style="color:#888;padding:2px 0;width:45%">Código</td><td style="font-weight:600">${code}</td></tr>
        <tr><td style="color:#888;padding:2px 0">Distrito</td><td style="font-weight:600">${distrit}</td></tr>
        ${sector ? `<tr><td style="color:#888;padding:2px 0">Sector</td><td style="font-weight:600">${sector}</td></tr>` : ''}
        ${area ? `<tr><td style="color:#888;padding:2px 0">Área</td><td style="font-weight:600">${area} ha</td></tr>` : ''}
        <tr><td style="color:#888;padding:2px 0">Elevación máx</td><td style="font-weight:600">${cotaMax}</td></tr>
        <tr><td style="color:#888;padding:2px 0">Elevación mín</td><td style="font-weight:600">${cotaMin}</td></tr>
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
    urgencyHexagons: 0.75,
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
// PANEL CHANGE HANDLER (called from main.js)
// ============================================================

window.onPanelChange = function(panelId) {
  applyPanelLayers(panelId);

  // Threats panel: re-wire checkboxes after content injection
  if (panelId === 'threats') {
    setTimeout(wireThreatToggles, 100);
  }
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
