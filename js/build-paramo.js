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
const ELEVATION_LAYER_URL        = null;  // High-elevation zone raster (≥2800 m)
const PRECIPITATION_LAYER_URL    = null;  // Annual precipitation raster
const MEAN_TEMP_LAYER_URL        = null;  // Mean annual temperature raster
const CLIMATE_LAYER_URL          = null;  // Climate seasonality / moisture index raster
const EQUATORIAL_LAYER_URL       = null;  // Equatorial influence raster (latitudinal gradient)
const SUITABILITY_COMPOSITE_URL  = null;  // Composite suitability raster (low→high gradient)
// Note: official páramo polygons are already loaded via PARAMO_FEATURE_URL in maps.js

// Bounding box covering all of Colombia (used for placeholder rectangles)
const _BP_BOUNDS = [[-4.2, -79.2], [12.5, -66.8]];

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
    opacity: 0.38,
  },
  {
    id:      'temperature',
    icon:    '🌡',
    name:    'Temperature',
    label:   'Cold but not permanently frozen · 2 – 10 °C',
    desc:    'Mean annual temperatures between 2 °C and 10 °C define the thermal niche of páramo life. Unlike polar environments, páramos experience freeze-thaw cycles daily, not seasonally — temperatures can swing 20 °C in 24 hours, compressing a whole year of climate variation into a single day.',
    color:   '#3949AB',   // indigo — cold
    url:     MEAN_TEMP_LAYER_URL,
    opacity: 0.35,
  },
  {
    id:      'precipitation',
    icon:    '🌧',
    name:    'Precipitation & Moisture',
    label:   'Wet, cloudy, humid · 700 – 3,000 mm / yr',
    desc:    'Persistent cloud cover and high annual rainfall keep páramo soils perpetually saturated. Frailejones — the iconic giant rosette plants — capture cloud moisture through their woolly leaves and channel it into Colombia\'s river systems, supplying water to 48 million people downstream.',
    color:   '#1565C0',   // deep blue — rain
    url:     PRECIPITATION_LAYER_URL,
    opacity: 0.38,
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
    opacity: 0.33,
  },
];

// ============================================================
// STATE
// ============================================================
let _bpMap            = null;    // reference to window.map (Leaflet)
let _bpLayerEls       = {};      // id → { overlay: Leaflet layer, active: boolean }
let _bpCompositeOn    = false;
let _bpCompareOn      = false;
let _bpCompositeLayer = null;    // created lazily
let _bpInitialized    = false;

// ============================================================
// OVERLAY FACTORIES
// ============================================================

function _createLayerOverlay(cfg) {
  if (cfg.url) {
    // Real tile service — URL takes precedence over customFactory
    return cfg.url.includes('{z}')
      ? L.tileLayer(cfg.url, { opacity: cfg.opacity, attribution: '' })
      : L.imageOverlay(cfg.url, _BP_BOUNDS, { opacity: cfg.opacity });
  }
  if (cfg.customFactory) {
    // Special-purpose placeholder (e.g. equatorial gradient SVG)
    return cfg.customFactory();
  }
  // Standard placeholder: translucent colored rectangle over Colombia
  return L.rectangle(_BP_BOUNDS, {
    color:       cfg.color,
    fillColor:   cfg.color,
    fillOpacity: cfg.opacity * 0.85,
    weight:      0,
    interactive: false,
  });
}

// Equatorial influence — SVG gradient ImageOverlay.
// Colombia spans -4.2°S → 12.5°N (16.7° total).
// The equator (0°) sits 4.2/16.7 = 25.1% from the southern edge,
// which is 74.9% ≈ 75% from the TOP of the image overlay.
// The gradient peaks at that latitude and fades smoothly north and south.
function _createEquatorialOverlay() {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="400">',
    '  <defs>',
    '    <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">',
    // 12.5°N (top) — barely any tropical influence at Colombia's northern tip
    '      <stop offset="0%"   stop-color="#C8A840" stop-opacity="0.00"/>',
    '      <stop offset="20%"  stop-color="#C8A840" stop-opacity="0.03"/>',
    '      <stop offset="42%"  stop-color="#C8A840" stop-opacity="0.09"/>',
    '      <stop offset="60%"  stop-color="#C8A840" stop-opacity="0.17"/>',
    // ~3°N — approaching equatorial belt
    '      <stop offset="70%"  stop-color="#D4AE38" stop-opacity="0.24"/>',
    // ~0° equator — peak suitability
    '      <stop offset="75%"  stop-color="#D4AE38" stop-opacity="0.30"/>',
    // 2–4°S — still tropical, trailing off slightly south of equator
    '      <stop offset="85%"  stop-color="#C8A840" stop-opacity="0.22"/>',
    '      <stop offset="100%" stop-color="#B89830" stop-opacity="0.10"/>',
    '    </linearGradient>',
    '  </defs>',
    '  <rect width="100" height="400" fill="url(#eq)"/>',
    '</svg>',
  ].join('');

  const dataUrl = 'data:image/svg+xml;base64,' + btoa(svg);
  return L.imageOverlay(dataUrl, _BP_BOUNDS, {
    opacity:     1.0,
    interactive: false,
    className:   'bp-equatorial-overlay',
  });
}

function _createCompositeOverlay() {
  if (SUITABILITY_COMPOSITE_URL) {
    return SUITABILITY_COMPOSITE_URL.includes('{z}')
      ? L.tileLayer(SUITABILITY_COMPOSITE_URL, { opacity: 0.70, attribution: '' })
      : L.imageOverlay(SUITABILITY_COMPOSITE_URL, _BP_BOUNDS, { opacity: 0.70 });
  }
  // Placeholder: gold dashed rectangle signalling "suitability result"
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
// LAYER MANAGEMENT
// ============================================================

function _getActiveLayers() {
  return BUILD_LAYERS_CONFIG.filter(l => _bpLayerEls[l.id]?.active);
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
  state.active = true;
  if (!_bpCompositeOn) {
    if (!_bpMap.hasLayer(state.overlay)) state.overlay.addTo(_bpMap);
  }
  _updatePanelUI();
}

function _buildLayerOff(id) {
  const state = _bpLayerEls[id];
  if (!state || !_bpMap) return;
  state.active = false;
  if (state.overlay && _bpMap.hasLayer(state.overlay)) {
    _bpMap.removeLayer(state.overlay);
  }
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
    // UI
    if (btn) {
      btn.classList.remove('active');
      btn.innerHTML = '<span class="bp-composite-icon">◎</span> Show Suitability Composite';
    }
    interp?.classList.add('hidden');
  }

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
  if (_bpCompositeOn) _setComposite(false);
  if (_bpCompareOn) {
    const ct = document.getElementById('bp-compare-toggle');
    if (ct) ct.checked = false;
    _setCompare(false);
  }
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
}

// ============================================================
// EXPOSE
// ============================================================
window.initBuildPanel    = initBuildPanel;
window.wireBuildPanel    = wireBuildPanel;
window.cleanupBuildPanel = cleanupBuildPanel;
