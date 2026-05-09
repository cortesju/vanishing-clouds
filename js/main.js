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
      <p class="panel-lead">Colombia's páramo ecosystems hold the water, carbon, and life of a continent, and they are disappearing.</p>

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

      <!-- View controls row: entry zoom label + reset button -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.6rem;gap:0.5rem;">
        <p class="panel-note" style="font-size:0.76rem;color:var(--text-medium);background:rgba(27,94,59,0.06);border-radius:6px;padding:0.4rem 0.65rem;margin:0;flex:1;">
          Showing Chingaza · Sumapaz — densest records area.
        </p>
        <button onclick="window.resetSpeciesView()"
          style="flex-shrink:0;font-size:0.72rem;padding:0.3rem 0.6rem;border:1px solid rgba(27,94,59,0.25);border-radius:6px;background:rgba(27,94,59,0.06);color:var(--text-medium);cursor:pointer;white-space:nowrap;">
          🗺 Full range
        </button>
      </div>

      <!-- ── Map theme selector ───────────────────────────────── -->
      <div class="species-map-section">
        <span class="species-section-label">MAP THEME</span>
        <div class="species-theme-selector">
          <button class="theme-btn active" data-theme="richness">Species Richness</button>
          <button class="theme-btn"        data-theme="count">Record Count</button>
          <button class="theme-btn"        data-theme="decade">Decade</button>
          <button class="theme-btn"        data-theme="points">Species Points</button>
        </div>

        <!-- Small description of the active hex theme — hidden for points -->
        <p id="theme-description" class="theme-description hidden"></p>

        <!-- Sub-filter shown only when Species Points theme is active -->
        <div id="species-points-filter" class="species-points-filter">
          <!-- Status line: loading indicator + record cap notice (Option D) -->
          <p id="gbif-points-status" style="font-size:0.72rem;color:var(--text-medium);margin:0 0 0.5rem;opacity:0.7;">
            Showing up to 1,000 points in current view
          </p>
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

  threats: () => `
    <div class="panel-section threats-panel">
      <span class="panel-eyebrow">THREATS</span>
      <h2 class="panel-title">Threats to Páramo Ecosystems</h2>
      <p class="panel-lead">Land-cover change, agriculture expansion, urban pressure, mining, pasture, and fire disturbance, 1986 to 2024.</p>

      <!-- Intro card -->
      <div class="th-intro-card">
        <p>Páramos are protected by elevation, climate, and isolation, but not from land-use pressure. Explore how agriculture, pasture, urban growth, mining, and fire have encroached on páramo landscapes from 1986 to 2024, using MapBiomas Colombia annual land-cover maps.</p>
      </div>

      <!-- View mode selector -->
      <div class="th-section-label">View mode</div>
      <div class="th-mode-group">
        <button class="th-mode-btn active" data-mode="landcover">🗂 Land-cover timeline</button>
        <button class="th-mode-btn" data-mode="threat">⚠ Threat category by year</button>
        <button class="th-mode-btn" data-mode="agexpansion">🌾 Agriculture expansion by páramo</button>
        <button class="th-mode-btn" data-mode="urbanrisk">🏙 Urban proximity risk</button>
        <button class="th-mode-btn" data-mode="totalchange">📊 Total land-cover change</button>
        <button class="th-mode-btn" data-mode="fire">🔥 Fire pressure</button>
      </div>

      <!-- Year selector — hidden for modes that don't need it -->
      <div id="th-year-section">
        <div class="th-section-label">Year</div>
        <div class="th-year-group">
          <button class="th-year-btn" data-year="1986">1986</button>
          <button class="th-year-btn" data-year="2000">2000</button>
          <button class="th-year-btn" data-year="2010">2010</button>
          <button class="th-year-btn" data-year="2020">2020</button>
          <button class="th-year-btn active" data-year="2024">2024</button>
        </div>
      </div>

      <!-- Category selector — only visible in threat mode -->
      <div id="th-cat-section" class="th-cat-section" style="display:none">
        <div class="th-section-label">Threat category</div>
        <div class="th-cat-group">
          <button class="th-cat-btn active" data-category="agriculture" style="--cat-color:#C9930A">🌾 Agriculture</button>
          <button class="th-cat-btn" data-category="pasture" style="--cat-color:#C8651A">🐄 Pasture</button>
          <button class="th-cat-btn" data-category="urban" style="--cat-color:#C0392B">🏙 Urban</button>
          <button class="th-cat-btn" data-category="mining" style="--cat-color:#6B3FA0">⛏ Mining</button>
        </div>
      </div>

      <!-- Mode context cards — only the active mode's card is shown -->
      <div id="th-ctx-landcover" class="th-mode-context">
        <p>Select a year to compare MapBiomas Colombia land-cover maps clipped to the páramo buffer zone. Watch how vegetation, agriculture, pasture, and urban areas have shifted over nearly four decades.</p>
      </div>

      <div id="th-ctx-threat" class="th-mode-context" style="display:none">
        <p>Select a threat category and year to display a binary raster showing where that land-use type was present in the páramo buffer zone. Only one category is shown at a time.</p>
      </div>

      <div id="th-ctx-agexpansion" class="th-mode-context" style="display:none">
        <p>Each páramo complex is colored by how much agriculture increased inside or around its boundary over the full study period. Click any polygon to see its expansion category and change value.</p>
      </div>

      <div id="th-ctx-urbanrisk" class="th-mode-context" style="display:none">
        <p>Each páramo complex is rated by its proximity to urban areas. Higher risk indicates páramos that are closer to existing or expanding urban footprints and therefore face greater human pressure. Click any polygon to see its risk category and distance to nearest urban area.</p>
      </div>

      <div id="th-ctx-totalchange" class="th-mode-context" style="display:none">
        <p>Areas where one or more threat categories (agriculture, pasture, urban, or mining) changed during the study period within the páramo buffer zone. A quick overall pressure footprint.</p>
      </div>

      <div id="th-ctx-fire" class="th-mode-context" style="display:none">
        <p>Three views of fire pressure on páramo ecosystems derived from VIIRS/MODIS satellite data.</p>
        <div class="th-section-label">Fire layer</div>
        <div class="th-fire-mode-group">
          <button class="th-fire-btn active" data-fire-mode="density">🔥 Fire density</button>
          <button class="th-fire-btn" data-fire-mode="points">📍 Points over time</button>
          <button class="th-fire-btn" data-fire-mode="frequency">📊 Frequency by páramo</button>
        </div>
        <div id="th-fire-year-section" style="display:none">
          <div class="th-section-label">Year: <span id="th-fire-year-label">2024</span></div>
          <div class="th-fire-slider-row">
            <input type="range" id="th-fire-year-slider" min="2012" max="2024" value="2024" step="1">
            <button id="th-fire-play-btn" class="th-play-btn">▶ Play</button>
          </div>
          <div class="th-fire-year-range">2012-2024</div>
          <button id="th-fire-points-toggle" class="th-layer-toggle th-layer-toggle--on">
            👁 Points visible
          </button>
        </div>
      </div>

    </div>
  `,

  urgency: () => `
    <div class="panel-section urgency-panel">
      <span class="panel-eyebrow">CONSERVATION</span>
      <h2 class="panel-title">Where Protection Matters Most</h2>
      <p class="panel-lead">A composite urgency score combining endemic richness, habitat loss, and threat pressure across 45 hexagonal zones.</p>
      <p class="urgency-boundary-note" style="font-size:0.78rem;color:var(--text-medium);background:rgba(27,94,59,0.06);border-radius:6px;padding:0.5rem 0.75rem;margin-bottom:0.5rem;">Urgency scores are shown only within official páramo boundaries.</p>
      <p class="panel-note" style="font-size:0.78rem;color:var(--text-medium);background:rgba(196,139,30,0.08);border-radius:6px;padding:0.5rem 0.75rem;margin-bottom:0.75rem;">Note: This section is still a work in progress. Urgency results are being refined and should be interpreted as a preliminary visualization.</p>
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
      <p class="panel-lead">Stack the environmental conditions that allow páramos to form, and watch the geography respond layer by layer.</p>

      <!-- What does a páramo need? -->
      <div class="bp-intro-card">
        <div class="bp-intro-icon">🏔</div>
        <div class="bp-intro-text">
          <strong>What does a páramo need?</strong>
          <p>Páramos are not random. They emerge where five conditions converge: high elevation, cold temperatures, abundant moisture, tropical latitude, and the specific architecture of the Andes. Toggle each condition below to build the picture.</p>
        </div>
      </div>

      <!-- Pan/zoom tip -->
      <div class="bp-tip-card">
        <span class="bp-tip-icon">🌍</span>
        <p>Tip: Pan and zoom around the globe to compare where páramo-like conditions appear outside Colombia.</p>
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
          <p class="bp-layer-desc">Páramos form above the Andean tree line. Elevation controls temperature, UV intensity, and atmospheric pressure: it is the physical stage on which every other condition plays out. Without altitude, the other factors cannot exist in their páramo form.</p>
          <div class="bp-layer-swatch"></div>
        </div>

        <div class="bp-layer-card" id="bp-card-temperature" style="--layer-color:#388E3C">
          <div class="bp-layer-card-header">
            <div class="bp-layer-icon" style="background:rgba(56,142,60,0.13);color:#1B5E20">🌡</div>
            <div class="bp-layer-meta">
              <span class="bp-layer-name">Temperature</span>
              <span class="bp-layer-label">Cold but not permanently frozen · 2 – 10 °C</span>
            </div>
            <label class="bp-switch" title="Toggle temperature layer on map">
              <input type="checkbox" id="bp-toggle-temperature">
              <span class="bp-switch-track"><span class="bp-switch-thumb"></span></span>
            </label>
          </div>
          <p class="bp-layer-desc">Mean annual temperatures between 2 °C and 10 °C define the thermal niche of páramo life. Unlike polar environments, páramos experience freeze-thaw cycles daily, not seasonally. Temperatures can swing 20 °C in 24 hours, compressing a whole year of climate variation into a single day.</p>
          <div class="bp-layer-swatch"></div>
        </div>

        <div class="bp-layer-card" id="bp-card-precipitation" style="--layer-color:#1565C0">
          <div class="bp-layer-card-header">
            <div class="bp-layer-icon" style="background:rgba(21,101,192,0.13);color:#0D47A1">🌧</div>
            <div class="bp-layer-meta">
              <span class="bp-layer-name">Precipitation & Moisture</span>
              <span class="bp-layer-label">Ideal moisture range · Not just the wettest areas</span>
            </div>
            <label class="bp-switch" title="Toggle precipitation & moisture layer on map">
              <input type="checkbox" id="bp-toggle-precipitation">
              <span class="bp-switch-track"><span class="bp-switch-thumb"></span></span>
            </label>
          </div>
          <p class="bp-layer-desc">Páramos need persistent moisture, cloud cover, and rainfall, but the model looks for an ideal moisture range, not simply the wettest places on Earth. Higher scores indicate precipitation conditions that better match páramo ecosystems. Areas that are too dry or excessively wet can receive lower suitability scores.</p>
          <div class="bp-layer-swatch"></div>
        </div>

        <div class="bp-layer-card" id="bp-card-seasonality" style="--layer-color:#6A1B9A">
          <div class="bp-layer-card-header">
            <div class="bp-layer-icon" style="background:rgba(106,27,154,0.13);color:#4A148C">☁</div>
            <div class="bp-layer-meta">
              <span class="bp-layer-name">Climate Match Score</span>
              <span class="bp-layer-label">Temperature + precipitation overlap</span>
            </div>
            <label class="bp-switch" title="Toggle climate match score layer on map">
              <input type="checkbox" id="bp-toggle-seasonality">
              <span class="bp-switch-track"><span class="bp-switch-thumb"></span></span>
            </label>
          </div>
          <p class="bp-layer-desc">This layer combines the temperature suitability score and the precipitation suitability score to show where both climate conditions align for páramo formation. High scores do not mean "more climate" or "more seasonality." They indicate the area has a stronger match between the ideal cool temperature range and the ideal moisture range for páramo ecosystems.</p>
          <div class="bp-layer-formula">
            <span class="bp-formula-chip">🌡 Temperature</span>
            <span class="bp-formula-op">+</span>
            <span class="bp-formula-chip">🌧 Precipitation</span>
            <span class="bp-formula-op">=</span>
            <span class="bp-formula-chip bp-formula-result">☁ Climate Match</span>
          </div>
          <div class="bp-layer-swatch"></div>
        </div>

      </div><!-- /.bp-layers-list -->

      <!-- Equatorial Influence — permanent context layer, not a toggle -->
      <div class="bp-eq-context-card">
        <div class="bp-eq-context-icon">🌐</div>
        <div class="bp-eq-context-text">
          <strong>Equatorial Influence</strong>
          <p>Páramos exist only where extreme Andean elevation meets equatorial solar patterns. This warm gold band (always visible on the map) marks the tropical latitude zone (11°N – 5°S) where year-round intense solar radiation makes high-altitude páramo conditions possible. The equator line shows where influence is highest.</p>
        </div>
      </div>

      <div class="panel-divider"></div>

      <!-- Suitability composite -->
      <div class="bp-composite-section">
        <span class="species-section-label">SUITABILITY COMPOSITE</span>
        <p class="bp-composite-desc">View the full modeled suitability surface. <strong>Bright green areas</strong> indicate the highest suitability: Colombia's páramo belt and equivalent zones worldwide. Activate any environmental layer to unlock.</p>
        <button id="bp-composite-btn" class="bp-composite-btn" disabled title="Activate an environmental layer first">
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
          <p>Páramos are not accidents of nature. They arise where tropical latitude, Andean topography, high elevation, cool temperatures, and persistent moisture all converge, and nowhere is that overlap more concentrated than in Colombia's three cordilleras.</p>
          <p style="margin-top:0.5rem">Páramos emerge where tropical latitude and high Andean elevation overlap. Colombia contains one of the largest continuous regions on Earth where equatorial climate, mountain elevation, moisture, and alpine conditions converge simultaneously, making its páramos globally irreplaceable.</p>
          <p style="margin-top:0.5rem">Compare the suitability model with the official IAvH polygons: they should align closely over the established páramo belt, with divergence at transition zones where ecological classification is genuinely ambiguous.</p>
        </div>
        <div class="bp-suitability-legend">
          <span class="bp-suit-label">Low suitability</span>
          <div class="bp-suit-ramp"></div>
          <span class="bp-suit-label">High suitability</span>
        </div>
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
          <p>A species with 1,000 records may not be more common than one with 10. It may simply be more photographed.</p>
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

      <div class="about-credit" style="margin-top:1.5rem;padding:1rem 1.2rem;background:rgba(27,94,59,0.06);border-radius:10px;border-left:3px solid var(--primary);">
        <p style="margin:0 0 0.3rem;font-size:0.82rem;color:var(--text-medium);font-weight:600;">Created by</p>
        <p style="margin:0 0 0.2rem;font-size:0.9rem;color:var(--text-dark);font-weight:700;">Juan Sebastian Cortes</p>
        <p style="margin:0 0 0.4rem;font-size:0.78rem;color:var(--text-medium);">M.S. Geographic Information Science and Technology<br>USC Spatial Sciences Institute</p>
        <p style="margin:0;font-size:0.82rem;"><a href="mailto:Sebastian.co.fe@gmail.com" style="color:var(--primary);text-decoration:none;">Sebastian.co.fe@gmail.com</a></p>
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

  // On mobile: scroll the active tab into horizontal view
  if (isMobile()) {
    const activeTab = document.querySelector(`.tn-item[data-panel="${panelId}"]`);
    if (activeTab) activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

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

  // Keep Map Layers dropdown in sync with the active panel
  syncLayersDropdownToPanel(panelId);

  // Keep mobile peek bar title + nav buttons in sync
  if (isMobile()) _updateMobPeekBar();
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

  if (panelId === 'threats') {
    // Wire threats.js interactive controls
    if (typeof window.wireThreatsPanel === 'function') {
      window.wireThreatsPanel();
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

function isMobile() {
  return window.matchMedia('(max-width: 768px)').matches;
}

function setPanelCollapsed(collapsed) {
  panelCollapsed = collapsed;
  const panel = document.getElementById('side-panel');
  if (!panel) return;

  if (isMobile()) {
    // Mobile: toggle .expanded (open sheet) vs default peek state
    panel.classList.toggle('expanded', !collapsed);
    _updateMobPeekBar();
  } else {
    // Desktop: slide panel left/right
    panel.classList.toggle('collapsed', collapsed);
    if (typeof window.updateMapPadding === 'function') {
      window.updateMapPadding(
        collapsed ? 0 : parseInt(getComputedStyle(document.documentElement).getPropertyValue('--panel-w'))
      );
    }
  }

  // Invalidate map size after the CSS transition finishes (350 ms)
  if (window.map) {
    setTimeout(() => {
      try { window.map.invalidateSize({ animate: false }); } catch (e) { /* ignore */ }
    }, 380);
  }
}

// Expose to maps.js for auto-collapse on first map interaction
window.setPanelCollapsed = setPanelCollapsed;

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

// Show only the layer rows relevant to the active panel.
// Each .layer-row in #data-layers-list (and optionally #basemap-layers-list) can carry a
// data-panels attribute listing space-separated panel IDs where that row is visible.
// Rows without data-panels are shown on every panel (safe default).
function syncLayersDropdownToPanel(panelId) {
  // Data layers — all tagged rows; untagged rows are always visible
  document.querySelectorAll('#data-layers-list .layer-row').forEach(row => {
    const attr   = (row.dataset.panels || '').trim();
    const panels = attr ? attr.split(/\s+/) : null;
    row.style.display = (!panels || panels.includes(panelId)) ? '' : 'none';
  });
  // Basemap layers — only rows that carry a data-panels attribute are filtered;
  // rows without it (terrain, hillshade, vector tiles) remain visible everywhere.
  document.querySelectorAll('#basemap-layers-list .layer-row').forEach(row => {
    const attr = (row.dataset.panels || '').trim();
    if (!attr) return;                          // no restriction → always visible
    const panels = attr.split(/\s+/);
    row.style.display = panels.includes(panelId) ? '' : 'none';
  });

  // Build panel: sync checkbox states with live layer state from build-paramo.js
  if (panelId === 'build' && typeof window.getBuildLayerState === 'function') {
    const st = window.getBuildLayerState();
    document.querySelectorAll('[data-build-layer-id]').forEach(row => {
      const id = row.dataset.buildLayerId;
      const cb = row.querySelector('input[type="checkbox"]');
      if (!cb) return;
      if (id === 'composite')  cb.checked = !!st.compositeOn;
      else if (id === 'compare') cb.checked = !!st.compareOn;
      else cb.checked = !!st.scores?.find(s => s.id === id)?.active;
    });
  }
}

// Expose so build-paramo.js can call it after layer state changes
window.syncLayersDropdownToPanel = syncLayersDropdownToPanel;

function initLayersDropdown() {
  const btn      = document.getElementById('map-layers-btn');
  const dropdown = document.getElementById('layers-dropdown');
  if (!btn || !dropdown) return;

  // Open / close — sync visible rows every time the dropdown is opened
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = !dropdown.classList.contains('hidden');
    if (!isOpen) syncLayersDropdownToPanel(activePanel);  // refresh before revealing
    dropdown.classList.toggle('hidden', isOpen);
    btn.classList.toggle('open', !isOpen);
  });
  document.addEventListener('click', e => {
    if (!dropdown.contains(e.target) && e.target !== btn) {
      dropdown.classList.add('hidden');
      btn.classList.remove('open');
    }
  });

  // ── Build panel layer rows — delegate to build-paramo.js ───
  document.querySelectorAll('[data-build-layer-id]').forEach(row => {
    const id = row.dataset.buildLayerId;
    const cb = row.querySelector('input[type="checkbox"]');
    if (!cb) return;
    cb.addEventListener('change', () => {
      if (typeof window.bpToggleFromDropdown === 'function') {
        window.bpToggleFromDropdown(id);
        // bpToggleFromDropdown calls syncLayersDropdownToPanel which corrects
        // the checkbox to the actual post-toggle state
      }
    });
  });

  // ── Data layers: visibility + opacity ──────────────────────
  document.querySelectorAll('#data-layers-list .layer-row').forEach(row => {
    const key = row.dataset.layerKey;
    const cb  = row.querySelector('input[type="checkbox"]');
    const sl  = row.querySelector('.layer-opacity-slider');

    // Skip build-specific rows — handled above
    if (row.dataset.buildLayerId) return;

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

  // Initial sync — hide rows that don't belong on the default panel
  syncLayersDropdownToPanel(activePanel);
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

  // Mobile hamburger — opens #mob-nav-drawer (injected by initMobile)
  const mobileHamburger = document.getElementById('tn-hamburger');
  if (mobileHamburger) {
    mobileHamburger.addEventListener('click', e => {
      e.stopPropagation();
      const drawer = document.getElementById('mob-nav-drawer');
      if (!drawer) return;
      const nowOpen = !drawer.classList.contains('open');
      drawer.classList.toggle('open', nowOpen);
      mobileHamburger.textContent = nowOpen ? '✕' : '☰';
    });
    // Close drawer when user taps outside it
    document.addEventListener('click', e => {
      const drawer = document.getElementById('mob-nav-drawer');
      if (drawer && drawer.classList.contains('open') &&
          !drawer.contains(e.target) && e.target !== mobileHamburger) {
        drawer.classList.remove('open');
        mobileHamburger.textContent = '☰';
      }
    });
  }
}

// ============================================================
// MOBILE — helpers, peek bar, nav drawer, swipe gestures
// ============================================================

// Human-readable tab labels for the peek bar and nav drawer
const PANEL_LABELS = {
  overview: 'Páramos',
  build:    'Build a Páramo',
  species:  'Species',
  threats:  'Threats',
  urgency:  'Urgency',
  about:    'About',
};

// SVG path inner content, matched to the desktop tn-item icons
const PANEL_ICONS_SVG = {
  overview: '<path d="M8 1L1 14h14L8 1z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  build:    '<path d="M1 13L5.5 5.5l3 4 2.5-3.5L15 13H1z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M1 15h14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  species:  '<circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="M8 4v4l3 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  threats:  '<path d="M8 2L1.5 13.5h13L8 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 6.5v3M8 11v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  urgency:  '<circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="M8 5v3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="11" r=".75" fill="currentColor"/>',
  about:    '<path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
};

/**
 * Update peek bar title and active state on mobile nav buttons.
 * Called whenever the active panel changes.
 */
function _updateMobPeekBar() {
  const title = document.getElementById('mob-peek-title');
  if (title) title.textContent = PANEL_LABELS[activePanel] || activePanel;

  document.querySelectorAll('.mob-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.panel === activePanel);
  });
}

/**
 * One-time mobile initialisation:
 *  1. Injects #mob-peek-bar at top of #side-panel
 *  2. Injects #mob-nav-drawer below the top nav
 *  3. Wires swipe-up / swipe-down gestures on the sheet
 *  4. Starts panel in peek (collapsed) state
 *  5. Hides terrain profile on phones (< 600 px)
 */
function initMobile() {
  if (!isMobile()) return;

  const panel  = document.getElementById('side-panel');
  const scroll = document.getElementById('panel-scroll');
  const nav    = document.getElementById('top-nav');
  if (!panel || !scroll || !nav) return;

  // ── 1. Peek bar ──────────────────────────────────────────────
  const peekBar = document.createElement('div');
  peekBar.id = 'mob-peek-bar';
  peekBar.innerHTML = `
    <div id="mob-peek-pill"></div>
    <span id="mob-peek-title">${PANEL_LABELS[activePanel] || 'Páramos'}</span>
    <span id="mob-peek-hint">tap to expand</span>
  `;
  panel.insertBefore(peekBar, scroll);

  peekBar.addEventListener('click', () => {
    // Toggle: peek → expanded, expanded → peek
    setPanelCollapsed(panel.classList.contains('expanded'));
  });

  // ── 2. Mobile nav drawer ─────────────────────────────────────
  const panels = ['overview', 'build', 'species', 'threats', 'urgency', 'about'];
  const drawer = document.createElement('div');
  drawer.id = 'mob-nav-drawer';
  drawer.innerHTML = `
    <div class="mob-nav-grid">
      ${panels.map(pid => `
        <button class="mob-nav-btn${pid === activePanel ? ' active' : ''}" data-panel="${pid}">
          <svg width="18" height="16" viewBox="0 0 16 16" fill="none">
            ${PANEL_ICONS_SVG[pid] || ''}
          </svg>
          ${PANEL_LABELS[pid]}
        </button>
      `).join('')}
    </div>`;
  nav.insertAdjacentElement('afterend', drawer);

  // Wire each nav button
  drawer.querySelectorAll('.mob-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchPanel(btn.dataset.panel);
      drawer.classList.remove('open');
      const ham = document.getElementById('tn-hamburger');
      if (ham) ham.textContent = '☰';
      // Expand sheet so user sees the content
      setTimeout(() => setPanelCollapsed(false), 60);
    });
  });

  // ── 3. Swipe gestures on panel ───────────────────────────────
  let _swipeStartY = 0;
  let _swipeStartT = 0;

  panel.addEventListener('touchstart', e => {
    _swipeStartY = e.touches[0].clientY;
    _swipeStartT = Date.now();
  }, { passive: true });

  panel.addEventListener('touchend', e => {
    if (Date.now() - _swipeStartT > 600) return;   // ignore long presses
    const dy = _swipeStartY - e.changedTouches[0].clientY;
    if (Math.abs(dy) < 28) return;                  // minimum swipe distance
    if (dy > 0 && !panel.classList.contains('expanded')) {
      setPanelCollapsed(false);   // swipe up → expand
    } else if (dy < 0 && panel.classList.contains('expanded')) {
      setPanelCollapsed(true);    // swipe down → peek
    }
  }, { passive: true });

  // ── 4. Start in peek state ───────────────────────────────────
  panel.classList.remove('expanded', 'collapsed');
  panelCollapsed = true;

  // ── 5. Auto-collapse terrain profile on phones ───────────────
  if (window.innerWidth <= 600 && window.TP) {
    window.TP.hide();
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
  initMobile();   // mobile bottom-sheet + nav drawer + swipe gestures

  // Expose switchPanel globally so other JS can navigate panels
  window.switchPanel = switchPanel;

  // ── Welcome screen ──────────────────────────────────────────────────────
  // Show full-screen cinematic overlay on every load (no sessionStorage while testing).
  // Remove .leaving guard once ready to gate by sessionStorage.
  initWelcomeScreen();
});

function initWelcomeScreen() {
  const screen = document.getElementById('welcome-screen');
  const btn    = document.getElementById('enter-map-btn');
  if (!screen || !btn) return;

  // Set background image via JS so the path resolves relative to the HTML
  // document rather than the stylesheet, avoiding CSS url() resolution issues.
  screen.style.backgroundImage = [
    'linear-gradient(160deg, rgba(8,22,14,0.45) 0%, rgba(10,28,18,0.65) 55%, rgba(5,15,10,0.78) 100%)',
    'url("Photos/Blackwhite.jpg")',
  ].join(', ');

  // Dismiss handler
  function dismiss() {
    screen.classList.add('leaving');

    // After the CSS transition finishes, fully hide + fix the map
    screen.addEventListener('transitionend', function onDone(e) {
      // Wait for the opacity transition specifically (not filter or transform)
      if (e.propertyName !== 'opacity') return;
      screen.removeEventListener('transitionend', onDone);

      screen.style.display = 'none';

      // Tell Leaflet the map container is now fully visible so tiles re-render correctly.
      // window.map is exposed by maps.js right after L.map() initialisation.
      if (window.map && typeof window.map.invalidateSize === 'function') {
        window.map.invalidateSize({ animate: false });
      }
    });
  }

  btn.addEventListener('click', dismiss);

  // Also allow pressing Escape or Enter to dismiss
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape' || e.key === 'Enter') {
      document.removeEventListener('keydown', onKey);
      dismiss();
    }
  });
}
