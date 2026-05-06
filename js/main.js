// ============================================================
// VANISHING CLOUDS — main.js
// Panel switching, content injection, nav, layers dropdown
// Audubon Explorer-style app shell
// ============================================================

// ---- ACTIVE PANEL STATE ----
let activePanel = 'overview';
let panelCollapsed = false;

// ============================================================
// PANEL CONTENT TEMPLATES
// Each returns an HTML string injected into #panel-scroll
// ============================================================

const PANEL_TEMPLATES = {

  overview: () => `
    <div class="panel-section overview-panel">
      <span class="panel-eyebrow">EXPLORE</span>
      <h1 class="panel-title">Vanishing Clouds</h1>
      <p class="panel-lead">Colombia's páramo ecosystems hold the water, carbon, and life of a continent — and they are disappearing.</p>

      <div class="panel-stats">
        <div class="pstat">
          <span class="pstat-num" data-target="37">0</span>
          <span class="pstat-label">Páramo complexes</span>
        </div>
        <div class="pstat">
          <span class="pstat-num" data-target="70">0</span>
          <span class="pstat-label">% of world's páramos</span>
        </div>
        <div class="pstat">
          <span class="pstat-num" data-target="48">0</span>
          <span class="pstat-label">Million people supplied</span>
        </div>
        <div class="pstat">
          <span class="pstat-num" data-target="500">0</span>
          <span class="pstat-label">+ endemic species</span>
        </div>
      </div>

      <div class="panel-hint">
        <span class="hint-icon">👆</span>
        <span>Click any green polygon on the map to explore a páramo complex. Hover to preview.</span>
      </div>

      <div class="panel-divider"></div>

      <div class="panel-about">
        <h3>About this project</h3>
        <p>This interactive explorer maps the accelerating decline of Colombia's páramo ecosystems using biodiversity occurrence data, land cover change analysis, fire detection records, and a composite conservation urgency index.</p>
        <p>Use the navigation above to explore <strong>endemic species</strong>, <strong>records through time</strong>, <strong>threats</strong>, and the <strong>conservation urgency index</strong>.</p>
        <p style="margin-top:0.75rem;font-size:0.78rem;color:#9AA5B4;">
          Data: GBIF · Instituto Humboldt · MapBiomas Colombia · NASA FIRMS<br>
          Content licensed CC BY 4.0
        </p>
      </div>
    </div>
  `,

  species: () => `
    <div class="panel-section species-panel">
      <span class="panel-eyebrow">BIODIVERSITY</span>
      <h2 class="panel-title">Life Found Nowhere Else</h2>
      <p class="panel-lead">Endemic species uniquely adapted to the extreme cold and humidity of Colombia's high Andes.</p>

      <!-- ── Map theme selector ───────────────────────────────── -->
      <div class="species-map-section">
        <span class="species-section-label">MAP THEME</span>
        <div class="species-theme-selector">
          <button class="theme-btn"        data-theme="richness">Species Richness</button>
          <button class="theme-btn"        data-theme="count">Record Count</button>
          <button class="theme-btn"        data-theme="decade">Decade</button>
          <button class="theme-btn active" data-theme="points">Species Points</button>
        </div>

        <!-- Small description of the active hex theme — hidden for points -->
        <p id="theme-description" class="theme-description hidden"></p>

        <!-- Sub-filter shown only when Species Points theme is active -->
        <div id="species-points-filter" class="species-points-filter">
          <span class="species-section-label" style="margin-bottom:0.4rem">FILTER BY</span>
          <div class="points-filter-btns">
            <button class="pts-btn active" data-kingdom="">All</button>
            <button class="pts-btn" data-kingdom="Animalia">
              <span class="pts-swatch" style="background:#C8963E"></span>Animals
            </button>
            <button class="pts-btn" data-kingdom="Plantae">
              <span class="pts-swatch" style="background:#4F9942"></span>Plants
            </button>
          </div>

          <!-- ── Time slider ────────────────────────────────── -->
          <div class="timeslider-section">
            <div class="ts-header">
              <span class="species-section-label" style="margin:0">THROUGH TIME</span>
              <span id="ts-decade-label" class="ts-decade-label">2021–Now</span>
            </div>
            <div class="ts-track-wrap">
              <input id="ts-range" class="ts-range" type="range"
                     min="0" max="4" step="1" value="4">
              <div class="ts-marks">
                <span>Pre-1980</span>
                <span>1980s</span>
                <span>2000s</span>
                <span>2010s</span>
                <span>Now</span>
              </div>
            </div>
            <button id="ts-play-btn" class="ts-play-btn">▶ Play</button>
          </div>

          <!-- ── Species legend / quick-list ───────────────── -->
          <div class="species-legend-section">
            <button class="species-legend-toggle" id="sp-legend-toggle">
              <span>📋 Species in this dataset</span>
              <span class="sp-legend-arrow">›</span>
            </button>
            <div id="gbif-species-list" class="gbif-species-list hidden"></div>
          </div>
        </div>

        <div id="species-hex-legend" class="species-hex-legend"></div>

        <!-- Hex layer time slider — visible for richness / count / decade themes -->
        <div id="hex-time-section" class="hex-time-section hidden">
          <div class="ts-header">
            <span class="species-section-label" style="margin:0">THROUGH TIME</span>
            <span id="hex-ts-label" class="ts-decade-label">2021–Now</span>
          </div>
          <div class="ts-track-wrap">
            <input id="hex-ts-range" class="ts-range" type="range"
                   min="0" max="4" step="1" value="4">
            <div class="ts-marks">
              <span>Pre-1980</span>
              <span>1980s</span>
              <span>2000s</span>
              <span>2010s</span>
              <span>Now</span>
            </div>
          </div>
          <button id="hex-ts-play-btn" class="ts-play-btn">▶ Play</button>
        </div>
      </div>

      <div class="panel-divider"></div>

      <!-- ── Species card grid ────────────────────────────────── -->
      <span class="species-section-label">SPECIES EXPLORER</span>
      <div class="species-filters">
        <button class="filter-btn active" data-filter="all">All</button>
        <button class="filter-btn" data-filter="Flora">Flora</button>
        <button class="filter-btn" data-filter="Fauna">Fauna</button>
        <button class="filter-btn" data-filter="CR">CR</button>
        <button class="filter-btn" data-filter="EN">EN</button>
        <button class="filter-btn" data-filter="VU">VU</button>
      </div>
      <div id="species-grid" class="species-grid"></div>
    </div>
  `,

  timeline: () => `
    <div class="panel-section timeline-panel">
      <span class="panel-eyebrow">RECORDS</span>
      <h2 class="panel-title">Through Time</h2>
      <p class="panel-lead">How our knowledge of páramo biodiversity has grown — and what it reveals about scientific bias.</p>
      <div class="time-controls">
        <button class="time-btn active" data-period="all">All</button>
        <button class="time-btn" data-period="before-1980">Pre-1980</button>
        <button class="time-btn" data-period="1980-1999">1980–99</button>
        <button class="time-btn" data-period="2000-2010">2000s</button>
        <button class="time-btn" data-period="2011-2020">2010s</button>
        <button class="time-btn" data-period="2021-present">2020s</button>
      </div>
      <p id="record-count" class="record-count-display"></p>
      <div class="timeline-legend">
        <span class="legend-dot" style="background:#5B2C8D"></span>Pre-1980
        <span class="legend-dot" style="background:#2874A6"></span>1980–99
        <span class="legend-dot" style="background:#148F77"></span>2000s
        <span class="legend-dot" style="background:#E67E22"></span>2010s
        <span class="legend-dot" style="background:#27AE60"></span>2020s
      </div>
      <div class="chart-container">
        <canvas id="records-chart"></canvas>
      </div>
      <div class="insight-box">
        <h4>What the data tells us</h4>
        <p>The surge in post-2011 records corresponds with smartphone adoption and the rise of iNaturalist — not necessarily more species in the field.</p>
      </div>
    </div>
  `,

  threats: () => `
    <div class="panel-section threats-panel">
      <span class="panel-eyebrow">THREATS</span>
      <h2 class="panel-title">How Páramos Are Changing</h2>
      <p class="panel-lead">Agriculture, fire, urban growth, and mining are simultaneously transforming these ecosystems.</p>
      <div class="layer-controls">
        <h4>Toggle Layers</h4>
        <label class="layer-toggle">
          <input type="checkbox" id="toggle-agriculture" checked>
          <span class="toggle-label agriculture">🌾 Agriculture expansion</span>
        </label>
        <label class="layer-toggle">
          <input type="checkbox" id="toggle-fire" checked>
          <span class="toggle-label fire">🔥 Fire alerts</span>
        </label>
        <label class="layer-toggle">
          <input type="checkbox" id="toggle-urban">
          <span class="toggle-label urban">🏙️ Urban pressure</span>
        </label>
        <label class="layer-toggle">
          <input type="checkbox" id="toggle-mining">
          <span class="toggle-label mining">⛏️ Mining zones</span>
        </label>
      </div>
      <div class="threat-stats-list">
        <div class="threat-stat agriculture">
          <strong>34%</strong>
          of adjacent land converted to agriculture since 1985
        </div>
        <div class="threat-stat fire">
          <strong>2,847</strong>
          fire alerts detected in páramo zones annually
        </div>
        <div class="threat-stat urban">
          <strong>418 km²</strong>
          of urban growth adjacent to páramos since 2000
        </div>
        <div class="threat-stat mining">
          <strong>196</strong>
          active mining concessions overlapping or adjacent to páramos
        </div>
      </div>
    </div>
  `,

  urgency: () => `
    <div class="panel-section urgency-panel">
      <span class="panel-eyebrow">CONSERVATION</span>
      <h2 class="panel-title">Where Protection Matters Most</h2>
      <p class="panel-lead">A composite urgency score combining endemic richness, habitat loss, and threat pressure across 45 hexagonal zones.</p>
      <div class="urgency-legend-panel">
        <div class="legend-item"><span class="legend-color" style="background:#FFFFCC;border:1px solid #ccc"></span> Very Low (1–2)</div>
        <div class="legend-item"><span class="legend-color" style="background:#C7E9B4"></span> Low (2–3)</div>
        <div class="legend-item"><span class="legend-color" style="background:#7FCDBB"></span> Moderate (3–4)</div>
        <div class="legend-item"><span class="legend-color" style="background:#F4A261"></span> High (4–4.7)</div>
        <div class="legend-item"><span class="legend-color" style="background:#C0392B"></span> Very High (4.8–5)</div>
      </div>
      <div class="chart-wrapper">
        <canvas id="urgency-donut"></canvas>
      </div>
      <div class="risk-profiles">
        <h4>Highest Risk Complexes</h4>
        <div class="risk-card">
          <div class="risk-badge very-high">VERY HIGH</div>
          <h5>Santurbán</h5>
          <p>196 mining concessions threaten this páramo, which supplies water to over 2 million people in Bucaramanga.</p>
          <div class="risk-threats"><span>⛏️ Mining</span><span>🌾 Agriculture</span></div>
        </div>
        <div class="risk-card">
          <div class="risk-badge high">HIGH</div>
          <h5>Sumapaz</h5>
          <p>The world's largest páramo faces intense urban pressure from Bogotá's expanding metropolitan area.</p>
          <div class="risk-threats"><span>🏙️ Urban</span><span>🌾 Agriculture</span></div>
        </div>
        <div class="risk-card">
          <div class="risk-badge high">HIGH</div>
          <h5>Sierra Nevada de Santa Marta</h5>
          <p>Isolated massif with no climate connectivity corridors facing rising agricultural and tourism pressure.</p>
          <div class="risk-threats"><span>🌡️ Climate</span><span>🌾 Agriculture</span></div>
        </div>
      </div>
    </div>
  `,

  build: () => `
    <div class="panel-section build-panel">
      <span class="panel-eyebrow">GEOGRAPHY</span>
      <h2 class="panel-title">Build a Páramo</h2>
      <p class="panel-lead">Stack the environmental conditions that allow páramos to form — and watch the geography respond layer by layer.</p>

      <!-- What does a páramo need? -->
      <div class="bp-intro-card">
        <div class="bp-intro-icon">🏔</div>
        <div class="bp-intro-text">
          <strong>What does a páramo need?</strong>
          <p>Páramos are not random. They emerge where five conditions converge: high elevation, cold temperatures, abundant moisture, tropical latitude, and the specific architecture of the Andes. Toggle each condition below to build the picture.</p>
        </div>
      </div>

      <!-- Status bar -->
      <div class="bp-status-bar">
        <span id="bp-layer-count" class="bp-layer-count" data-count="0">No layers active</span>
        <button id="bp-reset-btn" class="bp-reset-btn" title="Remove all active layers">↺ Reset</button>
      </div>

      <!-- Environmental layer cards -->
      <div class="bp-layers-list">

        <div class="bp-layer-card" id="bp-card-elevation" style="--layer-color:#546E7A">
          <div class="bp-layer-card-header">
            <div class="bp-layer-icon" style="background:rgba(84,110,122,0.13);color:#37474F">⛰</div>
            <div class="bp-layer-meta">
              <span class="bp-layer-name">Elevation</span>
              <span class="bp-layer-label">High tropical mountains · ≥ 2,800 m</span>
            </div>
            <label class="bp-switch" title="Toggle elevation layer on map">
              <input type="checkbox" id="bp-toggle-elevation">
              <span class="bp-switch-track"><span class="bp-switch-thumb"></span></span>
            </label>
          </div>
          <p class="bp-layer-desc">Páramos form above the Andean tree line. Elevation controls temperature, UV intensity, and atmospheric pressure — it is the physical stage on which every other condition plays out. Without altitude, the other factors cannot exist in their páramo form.</p>
          <div class="bp-layer-swatch"></div>
        </div>

        <div class="bp-layer-card" id="bp-card-temperature" style="--layer-color:#3949AB">
          <div class="bp-layer-card-header">
            <div class="bp-layer-icon" style="background:rgba(57,73,171,0.13);color:#283593">🌡</div>
            <div class="bp-layer-meta">
              <span class="bp-layer-name">Temperature</span>
              <span class="bp-layer-label">Cold but not permanently frozen · 2 – 10 °C</span>
            </div>
            <label class="bp-switch" title="Toggle temperature layer on map">
              <input type="checkbox" id="bp-toggle-temperature">
              <span class="bp-switch-track"><span class="bp-switch-thumb"></span></span>
            </label>
          </div>
          <p class="bp-layer-desc">Mean annual temperatures between 2 °C and 10 °C define the thermal niche of páramo life. Unlike polar environments, páramos experience freeze-thaw cycles daily, not seasonally — temperatures can swing 20 °C in 24 hours, compressing a whole year of climate variation into a single day.</p>
          <div class="bp-layer-swatch"></div>
        </div>

        <div class="bp-layer-card" id="bp-card-precipitation" style="--layer-color:#1565C0">
          <div class="bp-layer-card-header">
            <div class="bp-layer-icon" style="background:rgba(21,101,192,0.13);color:#0D47A1">🌧</div>
            <div class="bp-layer-meta">
              <span class="bp-layer-name">Precipitation & Moisture</span>
              <span class="bp-layer-label">Wet, cloudy, humid · 700 – 3,000 mm / yr</span>
            </div>
            <label class="bp-switch" title="Toggle precipitation layer on map">
              <input type="checkbox" id="bp-toggle-precipitation">
              <span class="bp-switch-track"><span class="bp-switch-thumb"></span></span>
            </label>
          </div>
          <p class="bp-layer-desc">Persistent cloud cover and high annual rainfall keep páramo soils perpetually saturated. Frailejones capture cloud moisture through their woolly leaves and channel it into Colombia's river systems, supplying water to 48 million people downstream.</p>
          <div class="bp-layer-swatch"></div>
        </div>

        <div class="bp-layer-card" id="bp-card-equatorial" style="--layer-color:#C8A840">
          <div class="bp-layer-card-header">
            <div class="bp-layer-icon" style="background:rgba(200,168,64,0.13);color:#8B6914">🌐</div>
            <div class="bp-layer-meta">
              <span class="bp-layer-name">Equatorial Influence</span>
              <span class="bp-layer-label">Tropical latitude · Near the equator</span>
            </div>
            <label class="bp-switch" title="Toggle equatorial influence layer on map">
              <input type="checkbox" id="bp-toggle-equatorial">
              <span class="bp-switch-track"><span class="bp-switch-thumb"></span></span>
            </label>
          </div>
          <p class="bp-layer-desc">Páramos exist where extreme elevation meets tropical latitude. Near the equator, solar radiation remains intense year-round and seasonal variation is low. When these tropical conditions are lifted above 3,000 m in the Andes, unique alpine ecosystems emerge with dramatic day-night temperature swings, persistent cloud formation, and specialized biodiversity found nowhere else on Earth. Highest suitability lies between 11°N and 5°S.</p>
          <div class="bp-layer-swatch"></div>
        </div>

        <div class="bp-layer-card" id="bp-card-seasonality" style="--layer-color:#6A1B9A">
          <div class="bp-layer-card-header">
            <div class="bp-layer-icon" style="background:rgba(106,27,154,0.13);color:#4A148C">☁</div>
            <div class="bp-layer-meta">
              <span class="bp-layer-name">Climate Seasonality</span>
              <span class="bp-layer-label">Unique tropical alpine conditions</span>
            </div>
            <label class="bp-switch" title="Toggle climate seasonality layer on map">
              <input type="checkbox" id="bp-toggle-seasonality">
              <span class="bp-switch-track"><span class="bp-switch-thumb"></span></span>
            </label>
          </div>
          <p class="bp-layer-desc">Tropical latitude means no astronomical winter — yet high altitude brings intense UV radiation, thin air, and nightly frost. This paradox of simultaneous extremes, found nowhere else on Earth, shaped every organism living in the páramo into something wholly original.</p>
          <div class="bp-layer-swatch"></div>
        </div>

      </div><!-- /.bp-layers-list -->

      <div class="panel-divider"></div>

      <!-- Suitability composite -->
      <div class="bp-composite-section">
        <span class="species-section-label">SUITABILITY COMPOSITE</span>
        <p class="bp-composite-desc">Combine your active layers into a single suitability surface. Areas meeting more conditions appear in warmer gold tones. Activate at least two layers to unlock.</p>
        <button id="bp-composite-btn" class="bp-composite-btn" disabled title="Activate at least 2 environmental layers first">
          <span class="bp-composite-icon">◎</span>
          Show Suitability Composite
        </button>

        <label class="layer-toggle bp-compare-label" for="bp-compare-toggle">
          <input type="checkbox" id="bp-compare-toggle">
          <span class="toggle-label" style="color:var(--primary)">Overlay official páramo boundaries</span>
        </label>
        <p class="bp-compare-note">Compare the model with IAvH ground-truth polygons to see how closely environmental conditions predict real páramo locations.</p>
      </div>

      <!-- Interpretation (revealed once composite is active) -->
      <div id="bp-interpretation" class="bp-interpretation hidden">
        <div class="insight-box">
          <h4>What this tells us</h4>
          <p>Páramos are not accidents of nature. They arise where tropical latitude, Andean topography, high elevation, cool temperatures, and persistent moisture all converge — and nowhere is that overlap more concentrated than in Colombia's three cordilleras.</p>
          <p style="margin-top:0.5rem">Páramos emerge where tropical latitude and high Andean elevation overlap. Colombia contains one of the largest continuous regions on Earth where equatorial climate, mountain elevation, moisture, and alpine conditions converge simultaneously — making its páramos globally irreplaceable.</p>
          <p style="margin-top:0.5rem">Compare the suitability model with the official IAvH polygons: they should align closely over the established páramo belt, with divergence at transition zones where ecological classification is genuinely ambiguous.</p>
        </div>
        <div class="bp-suitability-legend">
          <span class="bp-suit-label">Low suitability</span>
          <div class="bp-suit-ramp"></div>
          <span class="bp-suit-label">High suitability</span>
        </div>
      </div>

      <!-- Placeholder notice -->
      <div class="bp-placeholder-notice">
        <span class="bp-placeholder-icon">⚠</span>
        <span>Environmental overlays are placeholder data. Replace the URL constants at the top of <code>js/build-paramo.js</code> with your raster tile services to enable real environmental layers.</span>
      </div>

    </div>
  `,

  about: () => `
    <div class="panel-section about-panel">
      <span class="panel-eyebrow">METHODOLOGY</span>
      <h2 class="panel-title">What the Data Shows</h2>
      <p class="panel-lead">Every dataset has limitations. Understanding them is as important as the findings themselves.</p>

      <h4>Data Sources</h4>
      <div class="data-source-list">
        <div class="data-source-item">
          <strong>Páramo Boundaries</strong>
          <span>Instituto Humboldt (IAvH) · Official delineations 2012–2023 · CC BY 4.0</span>
        </div>
        <div class="data-source-item">
          <strong>Species Occurrences</strong>
          <span>GBIF / iNaturalist · Georeferenced records · CC BY 4.0</span>
        </div>
        <div class="data-source-item">
          <strong>Land Cover Change</strong>
          <span>MapBiomas Colombia · Landsat annual 1985–2023 · CC BY 4.0</span>
        </div>
        <div class="data-source-item">
          <strong>Fire Alerts</strong>
          <span>NASA FIRMS / VIIRS 375m · Near-real-time · Public Domain</span>
        </div>
        <div class="data-source-item">
          <strong>Conservation Urgency</strong>
          <span>Composite derived index · Species richness + threat + protection · CC BY 4.0</span>
        </div>
      </div>

      <h4 style="margin-top:1.5rem;">Known Limitations</h4>
      <div class="limitation-list">
        <div class="limitation-item">
          <strong>📍 Sampling Bias</strong>
          <p>iNaturalist and GBIF records concentrate near roads. Remote páramos are systematically underrepresented.</p>
        </div>
        <div class="limitation-item">
          <strong>📊 Occurrence ≠ Abundance</strong>
          <p>A species with 1,000 records may not be more common than one with 10 — it may simply be more photographed.</p>
        </div>
        <div class="limitation-item">
          <strong>📅 Historical Uncertainty</strong>
          <p>Pre-1980 specimen records may have coordinate uncertainty of 5–50 km, limiting precise historical mapping.</p>
        </div>
        <div class="limitation-item">
          <strong>🗺️ Classification Limits</strong>
          <p>Land cover classifications have minimum mapping units (~1 ha). Small agricultural intrusions are not captured.</p>
        </div>
      </div>

      <div class="citation-box" style="margin-top:1.5rem;">
        <em>Vanishing Clouds</em>: Mapping the Hidden Decline of Colombia's Páramo Ecosystems, 2024.<br>
        Data: GBIF (CC BY 4.0) · Instituto Humboldt · MapBiomas Colombia · NASA FIRMS
      </div>
    </div>
  `,
};

// ============================================================
// PANEL SWITCHING
// ============================================================

function switchPanel(panelId) {
  if (panelId === activePanel) return;
  activePanel = panelId;

  // Update nav active state
  document.querySelectorAll('.tn-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.panel === panelId);
  });

  // Inject content
  const scroll = document.getElementById('panel-scroll');
  if (!scroll) return;

  // Fade out, swap, fade in
  scroll.style.opacity = '0';
  scroll.style.transform = 'translateY(6px)';

  setTimeout(() => {
    const tmpl = PANEL_TEMPLATES[panelId];
    scroll.innerHTML = tmpl ? tmpl() : '<div class="panel-section"><p>Panel not found.</p></div>';
    scroll.scrollTop = 0;

    // Trigger any JS that needs to run after content injection
    afterPanelRender(panelId);

    // Fade in
    requestAnimationFrame(() => {
      scroll.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      scroll.style.opacity = '1';
      scroll.style.transform = 'translateY(0)';
    });
  }, 150);

  // Notify maps.js
  if (typeof window.onPanelChange === 'function') {
    window.onPanelChange(panelId);
  }
}

// Called after panel HTML is injected — re-initializes sub-components
function afterPanelRender(panelId) {
  if (panelId === 'overview') {
    initCounters();
  }

  if (panelId === 'species') {
    // Re-wire filter buttons and render card grid
    if (typeof window.initSpeciesPanel === 'function') {
      window.initSpeciesPanel();
    }
    // Render initial legend for whichever theme is currently active
    if (typeof window.renderSpeciesHexLegend === 'function') {
      window.renderSpeciesHexLegend(
        (window.SPECIES_HEX_THEMES && window._activeSpeciesTheme) || 'richness'
      );
    }
  }

  if (panelId === 'timeline') {
    // Re-wire time buttons
    if (typeof window.initTimeslider === 'function') {
      window.initTimeslider();
    }
    // Re-init chart
    if (typeof window.initRecordsChart === 'function') {
      setTimeout(() => window.initRecordsChart(), 50);
    }
  }

  if (panelId === 'threats') {
    // Re-wire threat layer toggles
    if (typeof window.initThreatToggles === 'function') {
      window.initThreatToggles();
    }
  }

  if (panelId === 'urgency') {
    // Re-init donut chart
    if (typeof window.initUrgencyDonut === 'function') {
      setTimeout(() => window.initUrgencyDonut(), 50);
    }
  }

  if (panelId === 'build') {
    // Wire layer toggles, composite button and compare toggle
    if (typeof window.wireBuildPanel === 'function') {
      window.wireBuildPanel();
    }
  }
}

// ============================================================
// PANEL COLLAPSE / EXPAND
// ============================================================

function setPanelCollapsed(collapsed) {
  panelCollapsed = collapsed;
  const panel = document.getElementById('side-panel');
  if (!panel) return;
  panel.classList.toggle('collapsed', collapsed);
  // Update map padding so zoom controls don't overlap panel
  if (typeof window.updateMapPadding === 'function') {
    window.updateMapPadding(collapsed ? 0 : parseInt(getComputedStyle(document.documentElement).getPropertyValue('--panel-w')));
  }
}

// ============================================================
// ANIMATED STAT COUNTERS
// ============================================================

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function animateCounter(el, target, duration = 1800) {
  const start = performance.now();
  const labelText = el.nextElementSibling?.textContent || '';
  const addPct  = labelText.includes('%');
  const addPlus = target >= 500;

  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const value    = Math.round(easeOutCubic(progress) * target);
    el.textContent = value.toLocaleString() + (addPct ? '%' : addPlus ? '+' : '');
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function initCounters() {
  // IntersectionObserver for .pstat-num elements
  const els = document.querySelectorAll('.pstat-num[data-target]');
  if (!els.length) return;

  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      animateCounter(entry.target, parseInt(entry.target.dataset.target, 10));
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.5 });

  els.forEach(el => obs.observe(el));
}

// ============================================================
// MAP LAYERS DROPDOWN  — visibility, opacity, drag-to-reorder
// ============================================================

function initLayersDropdown() {
  const btn      = document.getElementById('map-layers-btn');
  const dropdown = document.getElementById('layers-dropdown');
  if (!btn || !dropdown) return;

  // Open / close
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = !dropdown.classList.contains('hidden');
    dropdown.classList.toggle('hidden', isOpen);
    btn.classList.toggle('open', !isOpen);
  });
  document.addEventListener('click', e => {
    if (!dropdown.contains(e.target) && e.target !== btn) {
      dropdown.classList.add('hidden');
      btn.classList.remove('open');
    }
  });

  // ── Data layers: visibility + opacity ──────────────────────
  document.querySelectorAll('#data-layers-list .layer-row').forEach(row => {
    const key = row.dataset.layerKey;
    const cb  = row.querySelector('input[type="checkbox"]');
    const sl  = row.querySelector('.layer-opacity-slider');

    cb?.addEventListener('change', () => {
      window.setLayerVisible?.(key, cb.checked);
    });

    sl?.addEventListener('input', () => {
      window.setLayerOpacity?.(key, sl.value / 100);
    });
    // Prevent slider mousedown from triggering drag
    sl?.addEventListener('mousedown', e => e.stopPropagation());
  });

  // ── Basemap layers: visibility + opacity ───────────────────
  document.querySelectorAll('#basemap-layers-list .layer-row').forEach(row => {
    const key = row.dataset.basemapKey;
    const cb  = row.querySelector('input[type="checkbox"]');
    const sl  = row.querySelector('.layer-opacity-slider');

    cb?.addEventListener('change', () => {
      window.setBasemapVisible?.(key, cb.checked);
    });

    sl?.addEventListener('input', () => {
      window.setBasemapOpacity?.(key, sl.value / 100);
    });
    sl?.addEventListener('mousedown', e => e.stopPropagation());
  });

  // ── Drag-to-reorder (data layers only) ─────────────────────
  initDragReorder(document.getElementById('data-layers-list'));
}

// ============================================================
// DRAG-TO-REORDER
// Only fires when the user grabs the ⠿ handle; checkbox and
// opacity slider interactions are ignored.
// ============================================================

function initDragReorder(container) {
  if (!container) return;
  let dragSrc        = null;
  let fromHandle     = false;   // true only when drag starts on .drag-handle

  // Track whether the mousedown was on the handle
  container.addEventListener('mousedown', e => {
    fromHandle = !!e.target.closest('.drag-handle');
  });

  container.addEventListener('dragstart', e => {
    if (!fromHandle) { e.preventDefault(); return; }
    const row = e.target.closest('.layer-row[draggable]');
    if (!row) { e.preventDefault(); return; }
    dragSrc = row;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', row.dataset.layerKey || '');
    // Defer so the ghost image is captured before the class dims the row
    setTimeout(() => row.classList.add('dragging'), 0);
  });

  container.addEventListener('dragover', e => {
    if (!dragSrc) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const target = e.target.closest('.layer-row[draggable]');
    if (!target || target === dragSrc) return;
    // Show insertion indicator above or below target
    container.querySelectorAll('.drag-over-top, .drag-over-bot').forEach(r => {
      r.classList.remove('drag-over-top', 'drag-over-bot');
    });
    const mid = target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2;
    target.classList.add(e.clientY < mid ? 'drag-over-top' : 'drag-over-bot');
  });

  container.addEventListener('dragleave', e => {
    if (!container.contains(e.relatedTarget)) {
      container.querySelectorAll('.drag-over-top, .drag-over-bot').forEach(r => {
        r.classList.remove('drag-over-top', 'drag-over-bot');
      });
    }
  });

  container.addEventListener('drop', e => {
    e.preventDefault();
    const target = e.target.closest('.layer-row[draggable]');
    if (!target || !dragSrc || target === dragSrc) return;
    const mid = target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2;
    container.insertBefore(dragSrc, e.clientY < mid ? target : target.nextSibling);
    target.classList.remove('drag-over-top', 'drag-over-bot');
  });

  container.addEventListener('dragend', () => {
    dragSrc = null;
    fromHandle = false;
    container.querySelectorAll('.dragging, .drag-over-top, .drag-over-bot').forEach(r => {
      r.classList.remove('dragging', 'drag-over-top', 'drag-over-bot');
    });
    syncLayerOrder(container);
  });
}

// Read the new DOM order and tell maps.js to match it
function syncLayerOrder(container) {
  const keys = [...container.querySelectorAll('.layer-row[data-layer-key]')]
    .map(r => r.dataset.layerKey)
    .filter(Boolean);
  window.reorderLayers?.(keys);
}

// ============================================================
// NAV PANEL TOGGLE (hamburger)
// ============================================================

function initNavToggles() {
  // Panel collapse tab
  const collapseTab = document.getElementById('panel-collapse-tab');
  collapseTab?.addEventListener('click', () => setPanelCollapsed(!panelCollapsed));

  // Panel toggle button in nav (hamburger icon)
  const toggleBtn = document.getElementById('panel-toggle-btn');
  toggleBtn?.addEventListener('click', () => setPanelCollapsed(!panelCollapsed));

  // Nav items
  document.querySelectorAll('.tn-item[data-panel]').forEach(btn => {
    btn.addEventListener('click', () => {
      // On mobile, expand panel if collapsed
      if (panelCollapsed) setPanelCollapsed(false);
      switchPanel(btn.dataset.panel);
    });
  });

  // Mobile hamburger (shows nav items)
  const mobileHamburger = document.getElementById('tn-hamburger');
  const tnCenter        = document.getElementById('tn-center');
  if (mobileHamburger && tnCenter) {
    mobileHamburger.addEventListener('click', e => {
      e.stopPropagation();
      const open = tnCenter.style.display === 'flex';
      tnCenter.style.display = open ? '' : 'flex';
      tnCenter.style.flexDirection = 'column';
      tnCenter.style.position = 'fixed';
      tnCenter.style.top = 'var(--nav-h)';
      tnCenter.style.left = '0';
      tnCenter.style.right = '0';
      tnCenter.style.background = 'white';
      tnCenter.style.padding = '0.5rem';
      tnCenter.style.boxShadow = '0 4px 20px rgba(0,0,0,0.12)';
      tnCenter.style.zIndex = '700';
      mobileHamburger.textContent = open ? '☰' : '✕';
    });
    // Close on nav item click
    tnCenter.addEventListener('click', e => {
      if (e.target.classList.contains('tn-item')) {
        tnCenter.style.display = '';
        mobileHamburger.textContent = '☰';
      }
    });
  }
}

// ============================================================
// ENTRY POINT
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // Render initial overview panel
  const scroll = document.getElementById('panel-scroll');
  if (scroll) {
    scroll.innerHTML = PANEL_TEMPLATES.overview();
    afterPanelRender('overview');
  }

  initNavToggles();
  initLayersDropdown();

  // Expose switchPanel globally so other JS can navigate panels
  window.switchPanel = switchPanel;
});
