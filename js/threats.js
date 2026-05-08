// ============================================================
// VANISHING CLOUDS — threats.js
// Phase 5: Threats to Páramo Ecosystems
// MapBiomas Colombia land-cover threat viewer.
//
// Manages its own map overlays independently from maps.js's
// PANEL_LAYERS system. All layer URLs default to null until
// the corresponding ArcGIS services are published and shared.
//
// Public API (exposed on window):
//   initThreatsPanel()    — lazy init, called automatically on first visit
//   wireThreatsPanel()    — re-wires DOM on every panel visit (main.js)
//   cleanupThreatsPanel() — removes overlays when leaving panel (maps.js)
// ============================================================

// ============================================================
// LAYER URL CONSTANTS
// Replace null with the published ArcGIS MapServer URL when ready.
//
// Tile rasters (MapServer): 'https://tiles.arcgis.com/.../MapServer'
//   → tiles.js uses /tile/{z}/{y}/{x} internally (bypasses ?f=json auth)
//
// Polygon layers (FeatureServer): 'https://services1.arcgis.com/.../FeatureServer/0'
//   → loaded via L.esri.featureLayer
// ============================================================

// ── Land-cover clipped rasters — full MapBiomas class set per year ──
const LANDCOVER_1986_URL = null;
const LANDCOVER_2000_URL = null;
const LANDCOVER_2010_URL = null;
const LANDCOVER_2020_URL = null;
const LANDCOVER_2024_URL = null;

// ── Binary threat rasters — Agriculture presence × year ──
const AGRICULTURE_1986_URL = null;
const AGRICULTURE_2000_URL = null;
const AGRICULTURE_2010_URL = null;
const AGRICULTURE_2020_URL = null;
const AGRICULTURE_2024_URL = null;

// ── Binary threat rasters — Pasture presence × year ──
const PASTURE_1986_URL = null;
const PASTURE_2000_URL = null;
const PASTURE_2010_URL = null;
const PASTURE_2020_URL = null;
const PASTURE_2024_URL = null;

// ── Binary threat rasters — Urban presence × year ──
const URBAN_1986_URL = null;
const URBAN_2000_URL = null;
const URBAN_2010_URL = null;
const URBAN_2020_URL = null;
const URBAN_2024_URL = null;

// ── Binary threat rasters — Mining presence × year ──
const MINING_1986_URL = null;
const MINING_2000_URL = null;
const MINING_2010_URL = null;
const MINING_2020_URL = null;
const MINING_2024_URL = null;

// ── Polygon layer — agriculture expansion categorized by páramo ──
const AGRICULTURE_EXPANSION_PARAMOS_URL = null;

// ── Binary raster — total detected land-cover change in páramo buffer ──
const TOTAL_LANDCOVER_CHANGE_URL = null;

// ── Fire pressure (placeholder — layers added later) ──
const FIRE_DENSITY_LAYER_URL   = null;
const FIRE_FREQUENCY_LAYER_URL = null;

// ============================================================
// CONFIGURATION
// ============================================================

// Threat category display props + per-year URL lookup
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
      '2000': PASTURE_2000_URL,
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

// Land-cover class legend rows (placeholder — update to match MapBiomas symbology)
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

// Agriculture expansion — 5-class graduated color ramp
// Category values expected from FeatureServer: 1 (none) … 5 (very high)
const TH_AG_EXP_CLASSES = [
  { color: '#F5F0E8', label: 'No increase' },
  { color: '#F9D76B', label: 'Low increase' },
  { color: '#E8A238', label: 'Moderate increase' },
  { color: '#C0541B', label: 'High increase' },
  { color: '#7B1209', label: 'Very high increase' },
];

// ============================================================
// MODULE STATE
// Persists across panel visits (re-entering restores last state).
// ============================================================

let _thMap           = null;          // Leaflet map reference
let _thInitialized   = false;         // true after initThreatsPanel ran once
let _thMode          = 'landcover';   // active view mode
let _thYear          = '2024';        // active year
let _thCategory      = 'agriculture'; // active threat category
let _thActiveOverlay = null;          // current tileLayer on map
let _thAgExpLayer    = null;          // featureLayer for agriculture expansion
let _thLegendEl      = null;          // floating .th-legend DOM node

// ============================================================
// LAYER FACTORY — ArcGIS MapServer tile pattern
// Bypasses ?f=json discovery (which returns 499 on private
// services) by targeting the tile endpoint directly.
// Same pattern used by build-paramo.js.
// ============================================================

function _thMakeTileLayer(url, opacity) {
  if (!url) return null;
  const base = url.replace(/\/+$/, '');
  return L.tileLayer(`${base}/tile/{z}/{y}/{x}`, {
    opacity:       opacity !== undefined ? opacity : 0.82,
    maxZoom:       18,
    maxNativeZoom: 15,
    attribution:   'MapBiomas Colombia',
  });
}

// ============================================================
// MAP OVERLAY MANAGEMENT
// ============================================================

function _thClearOverlays() {
  if (_thActiveOverlay && _thMap) {
    if (_thMap.hasLayer(_thActiveOverlay)) _thMap.removeLayer(_thActiveOverlay);
    _thActiveOverlay = null;
  }
  if (_thAgExpLayer && _thMap) {
    if (_thMap.hasLayer(_thAgExpLayer)) _thMap.removeLayer(_thAgExpLayer);
    _thAgExpLayer = null;
  }
}

// ============================================================
// FLOATING LEGEND  (position: fixed, bottom-right of map)
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
      const hasUrl = !!_thLandcoverUrlForYear(_thYear);
      el.innerHTML = `
        <div class="th-legend-title">🗂 Land Cover · ${_thYear}</div>
        <div class="th-legend-rows${hasUrl ? '' : ' th-legend-rows--muted'}">
          ${TH_LANDCOVER_CLASSES.map(c =>
            `<div class="th-legend-row">
               <span class="th-swatch" style="background:${c.color}"></span>
               ${c.label}
             </div>`
          ).join('')}
        </div>
        <div class="th-legend-note${hasUrl ? '' : ' th-legend-note--pending'}">
          ${hasUrl
            ? 'MapBiomas Colombia land-cover classification · páramo buffer zone.'
            : 'Layer not yet published — class list shown as reference.'}
        </div>
      `;
      break;
    }

    case 'threat': {
      const cat    = TH_CATEGORIES[_thCategory];
      const hasUrl = !!(cat && cat.urls[_thYear]);
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
        <div class="th-legend-note${hasUrl ? '' : ' th-legend-note--pending'}">
          ${hasUrl
            ? `Binary raster: ${cat.label.toLowerCase()} land-use detected in ${_thYear}.`
            : `Layer not yet published for ${_thYear}.`}
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
        <div class="th-legend-note${AGRICULTURE_EXPANSION_PARAMOS_URL ? '' : ' th-legend-note--pending'}">
          ${AGRICULTURE_EXPANSION_PARAMOS_URL
            ? 'Increase in agriculture per páramo complex over the study period.'
            : 'Layer not yet published.'}
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
        <div class="th-legend-note${TOTAL_LANDCOVER_CHANGE_URL ? '' : ' th-legend-note--pending'}">
          ${TOTAL_LANDCOVER_CHANGE_URL
            ? 'One or more threat categories changed here during the study period.'
            : 'Layer not yet published.'}
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
  const urls = {
    '1986': LANDCOVER_1986_URL,
    '2000': LANDCOVER_2000_URL,
    '2010': LANDCOVER_2010_URL,
    '2020': LANDCOVER_2020_URL,
    '2024': LANDCOVER_2024_URL,
  };
  return urls[year] || null;
}

// A. Land-cover timeline — one full land-cover raster per year
function _thApplyLandcover() {
  _thClearOverlays();
  const url = _thLandcoverUrlForYear(_thYear);
  if (url) {
    _thActiveOverlay = _thMakeTileLayer(url, 0.85);
    _thActiveOverlay.addTo(_thMap);
  }
  _thShowLegend('landcover');
}

// B. Threat category × year — single binary raster
function _thApplyThreat() {
  _thClearOverlays();
  const cat = TH_CATEGORIES[_thCategory];
  const url = cat ? cat.urls[_thYear] : null;
  if (url) {
    _thActiveOverlay = _thMakeTileLayer(url, 0.88);
    _thActiveOverlay.addTo(_thMap);
  }
  _thShowLegend('threat');
}

// C. Agriculture expansion by páramo polygon (featureLayer)
function _thApplyAgExpansion() {
  _thClearOverlays();

  if (!AGRICULTURE_EXPANSION_PARAMOS_URL) {
    _thShowLegend('agexpansion');
    return;
  }

  // Derive fill color from a numeric expansion category field (1–5).
  // Tries several likely field names; falls back to class 0 (no increase).
  function _agExpColorIdx(feature) {
    const p   = feature.properties || {};
    const raw = p.ag_exp_cat ?? p.ag_expansion_cat ?? p.expansion_cat
              ?? p.agr_exp   ?? p.category          ?? 1;
    const n = Number(raw);
    if (isNaN(n)) return 0;
    return Math.min(Math.max(0, Math.round(n) - 1), TH_AG_EXP_CLASSES.length - 1);
  }

  _thAgExpLayer = L.esri.featureLayer({
    url: AGRICULTURE_EXPANSION_PARAMOS_URL,
    style(feature) {
      const idx   = _agExpColorIdx(feature);
      const color = TH_AG_EXP_CLASSES[idx].color;
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
      const name = p.pacomplejo || p.pacodigo || p.name || 'Páramo';
      const cat  = p.ag_exp_cat ?? p.ag_expansion_cat ?? p.expansion_cat ?? '—';
      const pct  = p.ag_exp_pct  != null
                     ? `${Number(p.ag_exp_pct).toFixed(1)} %`
                     : (p.ag_change_pct != null ? `${Number(p.ag_change_pct).toFixed(1)} %` : '—');

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
  _thShowLegend('agexpansion');
}

// D. Total land-cover change summary
function _thApplyTotalChange() {
  _thClearOverlays();
  if (TOTAL_LANDCOVER_CHANGE_URL) {
    _thActiveOverlay = _thMakeTileLayer(TOTAL_LANDCOVER_CHANGE_URL, 0.80);
    _thActiveOverlay.addTo(_thMap);
  }
  _thShowLegend('totalchange');
}

// E. Fire pressure — placeholder (no active data yet)
function _thApplyFire() {
  _thClearOverlays();
  // No overlays: legend communicates coming-soon status.
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

  // Show year selector only for modes that use it
  const showYear = (_thMode === 'landcover' || _thMode === 'threat');
  const yearSec  = document.getElementById('th-year-section');
  if (yearSec) yearSec.style.display = showYear ? '' : 'none';

  // Show category selector only in threat mode
  const catSec = document.getElementById('th-cat-section');
  if (catSec) catSec.style.display = _thMode === 'threat' ? '' : 'none';

  // Show only the active context card
  ['landcover', 'threat', 'agexpansion', 'totalchange', 'fire'].forEach(m => {
    const el = document.getElementById(`th-ctx-${m}`);
    if (el) el.style.display = (m === _thMode) ? '' : 'none';
  });
}

// ============================================================
// INIT — lazy, called once on first visit
// ============================================================

function initThreatsPanel() {
  if (_thInitialized) return;
  _thMap = window.map;
  if (!_thMap) {
    console.warn('[threats.js] Map not ready — initThreatsPanel deferred');
    return;
  }
  _thInitialized = true;
}

// ============================================================
// WIRE — called on every visit after panel HTML is injected
// ============================================================

function wireThreatsPanel() {
  // Lazy init on first visit
  if (!_thInitialized) initThreatsPanel();
  if (!_thMap) return;

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
      // Year only matters for landcover and threat modes
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

  // Restore UI state from previous visit and apply current mode
  _updateThreatsUI();
  _thApplyMode();
}

// ============================================================
// CLEANUP — called when leaving the threats panel
// ============================================================

function cleanupThreatsPanel() {
  _thClearOverlays();
  _thHideLegend();
}

// ============================================================
// EXPOSE
// ============================================================
window.initThreatsPanel    = initThreatsPanel;
window.wireThreatsPanel    = wireThreatsPanel;
window.cleanupThreatsPanel = cleanupThreatsPanel;
