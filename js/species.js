// ============================================================
// VANISHING CLOUDS — species.js
// Species explorer: card grid, filtering, modal, mini-map
// ============================================================

// ---- STATE ----
let allSpecies = [];
let allOccurrences = [];
let currentFilter = 'all';
let modalMiniMap = null;

// ---- IUCN CONFIG ----
const IUCN_CONFIG = {
  'CR': { label: 'Critically Endangered', color: '#C0392B', bg: '#FDECEA' },
  'EN': { label: 'Endangered',            color: '#E67E22', bg: '#FEF3E2' },
  'VU': { label: 'Vulnerable',            color: '#F39C12', bg: '#FEFBE2' },
  'LC': { label: 'Least Concern',         color: '#27AE60', bg: '#E8F8F0' },
  'NT': { label: 'Near Threatened',       color: '#1ABC9C', bg: '#E8FAF7' },
};

// ---- GROUP CONFIG ----
const GROUP_CONFIG = {
  'Flora': { icon: '🌿', color: '#1B5E3B', bg: '#E8F5E9' },
  'Fauna': { icon: '🦁', color: '#1565C0', bg: '#E3F2FD' },
};

// ---- TIME PERIOD COLORS (matching timeline legend) ----
const TIME_PERIOD_COLORS = {
  'before-1980':   '#5B2C8D',
  '1980-1999':     '#2874A6',
  '2000-2010':     '#148F77',
  '2011-2020':     '#E67E22',
  '2021-present':  '#27AE60',
};

// ============================================================
// loadSpeciesData
// ============================================================
async function loadSpeciesData() {
  try {
    const [profilesRes, occurrencesRes] = await Promise.all([
      fetch('data/species_profiles.json'),
      fetch('data/species_occurrences.geojson'),
    ]);

    if (!profilesRes.ok) throw new Error(`species_profiles.json: ${profilesRes.status}`);
    if (!occurrencesRes.ok) throw new Error(`species_occurrences.geojson: ${occurrencesRes.status}`);

    allSpecies = await profilesRes.json();
    const occurrenceData = await occurrencesRes.json();
    allOccurrences = occurrenceData.features || [];

    renderSpeciesGrid(allSpecies);
  } catch (err) {
    console.error('[species.js] Failed to load species data:', err);
    const grid = document.getElementById('species-grid');
    if (grid) {
      grid.innerHTML = `
        <div class="species-error">
          <p>Unable to load species data. Please try refreshing the page.</p>
          <small>${err.message}</small>
        </div>`;
    }
  }
}

// ============================================================
// renderSpeciesGrid
// ============================================================
function renderSpeciesGrid(species) {
  const grid = document.getElementById('species-grid');
  if (!grid) return;

  grid.innerHTML = '';

  if (!species || species.length === 0) {
    grid.innerHTML = '<p class="no-results">No species match the selected filter.</p>';
    return;
  }

  species.forEach((sp, index) => {
    const groupCfg  = GROUP_CONFIG[sp.group]  || { icon: '🔵', color: '#555', bg: '#EEE' };
    const iucnCfg   = IUCN_CONFIG[sp.iucn_status] || { label: sp.iucn_status, color: '#555', bg: '#EEE' };
    const shortDesc = sp.description
      ? sp.description.substring(0, 80).trimEnd() + (sp.description.length > 80 ? '…' : '')
      : '';

    const card = document.createElement('div');
    card.className = 'species-card';
    card.dataset.speciesId = sp.id;
    card.style.animationDelay = `${index * 60}ms`;

    card.innerHTML = `
      <div class="species-icon" style="background:${groupCfg.bg}; color:${groupCfg.color};">
        ${groupCfg.icon}
      </div>
      <div class="species-info">
        <div class="species-badges">
          <span class="badge group-badge"
                style="background:${groupCfg.bg}; color:${groupCfg.color}; border-color:${groupCfg.color}20;">
            ${sp.group}
          </span>
          <span class="badge iucn-badge"
                style="background:${iucnCfg.bg}; color:${iucnCfg.color}; border-color:${iucnCfg.color}40;"
                title="${iucnCfg.label}">
            ${sp.iucn_status}
          </span>
          ${sp.endemic ? '<span class="badge endemic-badge">Endemic</span>' : ''}
        </div>
        <h4 class="species-common-name">${sp.common_name || '—'}</h4>
        <p class="species-scientific-name">${sp.scientific_name || ''}</p>
        <p class="species-description-short">${shortDesc}</p>
      </div>`;

    card.addEventListener('click', () => openSpeciesModal(sp.id));

    // Keyboard accessibility
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `View details for ${sp.common_name}`);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openSpeciesModal(sp.id);
      }
    });

    grid.appendChild(card);
  });
}

// ============================================================
// filterSpecies
// ============================================================
function filterSpecies(filter) {
  currentFilter = filter;

  let filtered;
  if (filter === 'all') {
    filtered = allSpecies;
  } else if (filter === 'Flora' || filter === 'Fauna') {
    filtered = allSpecies.filter(sp => sp.group === filter);
  } else {
    // IUCN status filter
    filtered = allSpecies.filter(sp => sp.iucn_status === filter);
  }

  renderSpeciesGrid(filtered);
}

// ============================================================
// openSpeciesModal
// ============================================================
function openSpeciesModal(speciesId) {
  const sp = allSpecies.find(s => s.id === speciesId);
  if (!sp) return;

  // Filter occurrences for this species
  const occurrences = allOccurrences.filter(
    f => f.properties && f.properties.scientific_name === sp.scientific_name
  );

  const groupCfg = GROUP_CONFIG[sp.group]  || { icon: '🔵', color: '#555', bg: '#EEE' };
  const iucnCfg  = IUCN_CONFIG[sp.iucn_status] || { label: sp.iucn_status, color: '#555', bg: '#EEE' };

  const primaryParamos = sp.primary_paramos && sp.primary_paramos.length
    ? sp.primary_paramos.join(', ')
    : 'Data not available';

  const modalBody = document.getElementById('modal-body');
  if (!modalBody) return;

  modalBody.innerHTML = `
    <div class="modal-species-header">
      <div class="modal-species-icon" style="background:${groupCfg.bg}; color:${groupCfg.color};">
        ${groupCfg.icon}
      </div>
      <div class="modal-species-title">
        <div class="modal-badges">
          <span class="badge group-badge"
                style="background:${groupCfg.bg}; color:${groupCfg.color}; border-color:${groupCfg.color}20;">
            ${sp.group}
          </span>
          <span class="badge iucn-badge"
                style="background:${iucnCfg.bg}; color:${iucnCfg.color}; border-color:${iucnCfg.color}40;"
                title="${iucnCfg.label}">
            ${sp.iucn_status} — ${iucnCfg.label}
          </span>
          ${sp.endemic ? '<span class="badge endemic-badge">Endemic</span>' : ''}
        </div>
        <h2 class="modal-common-name">${sp.common_name || '—'}</h2>
        <h3 class="modal-scientific-name">${sp.scientific_name || ''}</h3>
      </div>
    </div>

    <p class="modal-description">${sp.description || ''}</p>

    <div class="modal-stats-grid">
      <div class="modal-stat">
        <span class="stat-val">${(sp.total_records ?? '—').toLocaleString()}</span>
        <span class="stat-lbl">Total Records</span>
      </div>
      <div class="modal-stat">
        <span class="stat-val">${sp.first_recorded ?? '—'}</span>
        <span class="stat-lbl">First Recorded</span>
      </div>
      <div class="modal-stat">
        <span class="stat-val">${sp.most_recent_year ?? '—'}</span>
        <span class="stat-lbl">Most Recent</span>
      </div>
      <div class="modal-stat">
        <span class="stat-val">${(sp.records_in_paramo ?? '—').toLocaleString()}</span>
        <span class="stat-lbl">Records in Páramos</span>
      </div>
    </div>

    <div class="modal-paramos">
      <strong>Primary Páramos:</strong> ${primaryParamos}
    </div>

    <div class="modal-altitude">
      <strong>Altitude range:</strong> ${sp.altitude_range || 'Unknown'}
    </div>

    <h4 class="modal-map-heading">Occurrence Map</h4>
    <p class="modal-occurrence-count">${occurrences.length} occurrence record${occurrences.length !== 1 ? 's' : ''} shown</p>

    <p class="modal-attribution">
      Data: GBIF / iNaturalist. Licensed CC BY 4.0.
      <span class="time-legend">
        <span style="color:#5B2C8D">●</span> Before 1980
        <span style="color:#2874A6">●</span> 1980–1999
        <span style="color:#148F77">●</span> 2000–2010
        <span style="color:#E67E22">●</span> 2011–2020
        <span style="color:#27AE60">●</span> 2021–Present
      </span>
    </p>`;

  // Show modal
  const modal = document.getElementById('species-modal');
  if (!modal) return;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Initialize mini-map after modal is visible (Leaflet needs the element painted)
  setTimeout(() => initModalMiniMap(occurrences), 50);
}

// ============================================================
// initModalMiniMap
// ============================================================
function initModalMiniMap(occurrences) {
  const mapEl = document.getElementById('modal-mini-map');
  if (!mapEl) return;
  if (typeof L === 'undefined') return;

  // Destroy existing map instance before re-init
  if (modalMiniMap) {
    modalMiniMap.remove();
    modalMiniMap = null;
  }

  // Colombia center fallback
  const colombiaCenter = [4.5709, -74.2973];
  const defaultZoom    = 6;

  modalMiniMap = L.map(mapEl, {
    zoomControl: true,
    scrollWheelZoom: false,
    attributionControl: true,
  });

  // CartoDB Positron (light) tiles
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/">CartoDB</a> &copy; OpenStreetMap contributors',
    subdomains: 'abcd',
    maxZoom: 18,
  }).addTo(modalMiniMap);

  if (occurrences.length === 0) {
    modalMiniMap.setView(colombiaCenter, defaultZoom);
    return;
  }

  const markers = [];

  occurrences.forEach(feature => {
    const coords = feature.geometry && feature.geometry.coordinates;
    if (!coords || coords.length < 2) return;

    const [lng, lat] = coords;
    const props      = feature.properties || {};
    const timePeriod = props.time_period || 'before-1980';
    const color      = TIME_PERIOD_COLORS[timePeriod] || '#888';
    const year       = props.year ? `Year: ${props.year}` : '';
    const paramo     = props.paramo_name ? `Páramo: ${props.paramo_name}` : '';
    const basis      = props.basis_of_record
      ? props.basis_of_record.replace(/_/g, ' ').toLowerCase()
      : '';

    const marker = L.circleMarker([lat, lng], {
      radius:      5,
      fillColor:   color,
      color:       '#fff',
      weight:      1,
      opacity:     1,
      fillOpacity: 0.85,
    });

    const popupLines = [year, paramo, basis].filter(Boolean);
    if (popupLines.length) {
      marker.bindPopup(`<small>${popupLines.join('<br>')}</small>`, { maxWidth: 160 });
    }

    marker.addTo(modalMiniMap);
    markers.push(marker);
  });

  if (markers.length > 0) {
    try {
      const group = L.featureGroup(markers);
      modalMiniMap.fitBounds(group.getBounds().pad(0.2));
    } catch (_) {
      modalMiniMap.setView(colombiaCenter, defaultZoom);
    }
  } else {
    modalMiniMap.setView(colombiaCenter, defaultZoom);
  }
}

// ============================================================
// closeModal
// ============================================================
function closeModal() {
  const modal = document.getElementById('species-modal');
  if (modal) {
    modal.classList.remove('active');
  }
  document.body.style.overflow = '';

  if (modalMiniMap) {
    modalMiniMap.remove();
    modalMiniMap = null;
  }

  // Clear modal-body so the old map container element is gone
  const modalBody = document.getElementById('modal-body');
  if (modalBody) modalBody.innerHTML = '';
}

// ============================================================
// EVENT LISTENERS
// ============================================================
// initSpeciesPanel — called by main.js after species panel HTML is injected
// ============================================================
window.initSpeciesPanel = function() {
  // If data is already loaded, render the grid immediately
  if (allSpecies.length > 0) {
    renderSpeciesGrid(allSpecies);
  }

  // ── Re-wire species card filter buttons ────────────────────
  const filterButtons = document.querySelectorAll('.filter-btn');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterSpecies(btn.dataset.filter || 'all');
    });
  });

  // ── Wire map theme selector buttons ────────────────────────
  const currentTheme = window._activeSpeciesTheme || 'richness';

  const themeButtons = document.querySelectorAll('.theme-btn');
  themeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === currentTheme);

    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;
      themeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      window._activeSpeciesTheme = theme;

      // Show / hide the Animal|Plant sub-filter
      const ptsFilter = document.getElementById('species-points-filter');
      if (ptsFilter) ptsFilter.classList.toggle('hidden', theme !== 'points');

      // Reset sub-filter to "All" whenever theme changes
      if (theme !== 'points') {
        document.querySelectorAll('.pts-btn').forEach(b => b.classList.toggle('active', !b.dataset.kingdom));
      }

      if (typeof window.switchSpeciesTheme === 'function') {
        window.switchSpeciesTheme(theme);
      }
    });
  });

  // ── Restore sub-filter visibility on panel re-render ───────
  const ptsFilter = document.getElementById('species-points-filter');
  if (ptsFilter) ptsFilter.classList.toggle('hidden', currentTheme !== 'points');

  // ── Wire Animal / Plant sub-filter buttons ─────────────────
  const ptsBtns = document.querySelectorAll('.pts-btn');
  ptsBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      ptsBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (typeof window.filterGbifPoints === 'function') {
        window.filterGbifPoints(btn.dataset.kingdom || null);
      }
    });
  });

  // Render the legend for the current theme
  window.renderSpeciesHexLegend(currentTheme);
};

// ============================================================
// renderSpeciesHexLegend — draws the colour legend for a given theme.
// Reads config from window.SPECIES_HEX_THEMES (set in maps.js).
// ============================================================
window.renderSpeciesHexLegend = function(themeName) {
  const container = document.getElementById('species-hex-legend');
  if (!container) return;

  // ── Species Points theme: show kingdom colour swatches ─────
  if (themeName === 'points') {
    container.innerHTML = `
      <div class="hex-legend-unique">
        <div class="hex-legend-item">
          <span class="hex-legend-swatch" style="background:#E67E22;"></span>
          <span class="hex-legend-label">Animals (Animalia)</span>
        </div>
        <div class="hex-legend-item">
          <span class="hex-legend-swatch" style="background:#27AE60;"></span>
          <span class="hex-legend-label">Plants (Plantae)</span>
        </div>
        <div class="hex-legend-item">
          <span class="hex-legend-swatch" style="background:#9AA5B4;border:1px solid rgba(0,0,0,0.12);"></span>
          <span class="hex-legend-label">Other kingdoms</span>
        </div>
      </div>`;
    return;
  }

  // ── Hex themes: read from maps.js config ───────────────────
  const themes = window.SPECIES_HEX_THEMES;
  if (!themes) { container.innerHTML = ''; return; }

  const theme = themes[themeName];
  if (!theme) { container.innerHTML = ''; return; }

  if (theme.type === 'breaks') {
    container.innerHTML = `
      <div class="hex-legend-ramp">
        ${theme.colors.map((color, i) => `
          <div class="hex-legend-item">
            <span class="hex-legend-swatch" style="background:${color};"></span>
            <span class="hex-legend-label">${theme.labels[i]}</span>
          </div>`).join('')}
      </div>`;
  } else if (theme.type === 'unique') {
    const entries = Object.entries(theme.values);
    container.innerHTML = `
      <div class="hex-legend-unique">
        ${entries.map(([label, color]) => `
          <div class="hex-legend-item">
            <span class="hex-legend-swatch" style="background:${color};"></span>
            <span class="hex-legend-label">${label}</span>
          </div>`).join('')}
        <div class="hex-legend-item">
          <span class="hex-legend-swatch" style="background:#CBD5E0;border:1px solid rgba(0,0,0,0.1);"></span>
          <span class="hex-legend-label">No data</span>
        </div>
      </div>`;
  }
};

document.addEventListener('DOMContentLoaded', () => {

  // Load data once (works for both initial load and panel switches)
  loadSpeciesData();

  // Modal close button (always in DOM)
  const closeBtn = document.getElementById('modal-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  // Click on overlay backdrop closes modal
  const modalOverlay = document.getElementById('species-modal');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });
  }

  // Escape key closes modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('species-modal');
      if (modal && modal.classList.contains('active')) closeModal();
    }
  });
});
