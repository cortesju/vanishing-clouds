// ============================================================
// VANISHING CLOUDS — terrain-profile.js
// Interactive terrain cross-section explorer.
//
// A thin gold horizontal line is draggable across the Colombia
// map.  Wherever it sits, we sample elevation from the AWS
// Terrarium DEM tiles (same source as the hillshade overlay),
// intersect the transect with páramo polygons, and render a
// scientific SVG profile in the bottom panel.
//
// Dependencies (resolved at runtime via window.*):
//   window.map  — the Leaflet map instance (exposed in maps.js)
//   window.LG   — the layer-group object (exposed in maps.js)
//
// Public API (consumed by onPanelChange in maps.js):
//   window.TP.show()
//   window.TP.hide()
// ============================================================

(function () {
  'use strict';

  // ── Config ────────────────────────────────────────────────
  const TERRARIUM_URL  = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
  const SAMPLE_ZOOM    = 9;           // tile zoom level for elevation reads
  const NUM_SAMPLES    = 90;          // sample points along the transect
  const LON_MIN        = -79.2;       // Colombia western coast
  const LON_MAX        = -66.8;       // Colombia eastern border
  const PARAMO_GOLD    = '#C8A96B';   // matches site accent
  const PARAMO_THRESH  = 3000;        // metres — annotation line
  const DEBOUNCE_MS    = 160;         // ms after last drag before sampling

  // NAV_H and STRIP_H match CSS --nav-h and #data-strip height
  const NAV_H   = 56;
  const STRIP_H = 32;

  // Major Andes cordillera axis longitudes (Colombia)
  const CORDILLERAS = [
    { lon: -77.05, label: 'W. CORDILLERA' },
    { lon: -75.40, label: 'C. CORDILLERA' },
    { lon: -72.90, label: 'E. CORDILLERA' },
  ];

  // ── State ─────────────────────────────────────────────────
  let crosshairLat  = 4.5;  // initial latitude — cuts through all three cordilleras
  let isDragging    = false;
  let _sampleGen    = 0;
  let _sampleTimer  = null;
  let _visible      = false;

  // Tile canvas cache  (key: "z/x/y" → HTMLCanvasElement)
  const tileCache = new Map();

  // ── DOM refs ──────────────────────────────────────────────
  let explorerEl, crosshairEl, lineEl, handleEl, latLabelEl;
  let panelEl, svgEl, loadingEl, closeBtnEl, latReadoutEl;

  // ── Init ──────────────────────────────────────────────────
  function init() {
    explorerEl  = document.getElementById('terrain-explorer');
    crosshairEl = document.getElementById('terrain-crosshair');
    lineEl      = document.getElementById('terrain-crosshair-line');
    handleEl    = document.getElementById('terrain-crosshair-handle');
    latLabelEl  = document.getElementById('terrain-crosshair-lat');
    panelEl     = document.getElementById('terrain-profile-panel');
    svgEl       = document.getElementById('terrain-profile-svg');
    loadingEl   = document.getElementById('terrain-profile-loading');
    closeBtnEl  = document.getElementById('terrain-profile-close');
    latReadoutEl = document.getElementById('tp-lat-readout');

    if (!explorerEl) return;  // HTML not present — bail out

    wireDrag();
    wireMapEvents();
    wireCloseButton();

    // Expose public API
    window.TP = { show: showExplorer, hide: hideExplorer };

    // Auto-show on overview panel (the active panel on first load)
    const activePanelBtn = document.querySelector('.tn-item.active');
    if (activePanelBtn && activePanelBtn.dataset.panel === 'overview') {
      // Slight delay lets maps.js finish building the map first
      setTimeout(showExplorer, 400);
    }
  }

  // ── Show / hide ───────────────────────────────────────────
  function showExplorer() {
    if (!explorerEl) return;
    explorerEl.classList.remove('hidden');
    document.body.classList.add('terrain-active');    // shorten sidebar via CSS
    _visible = true;
    positionCrosshairAtLat(crosshairLat);
    scheduleSample();
  }

  function hideExplorer() {
    if (!explorerEl) return;
    explorerEl.classList.add('hidden');
    document.body.classList.remove('terrain-active'); // restore sidebar height
    _visible = false;
    cancelSample();
  }

  // ── Close button ──────────────────────────────────────────
  function wireCloseButton() {
    if (!closeBtnEl) return;
    closeBtnEl.addEventListener('click', function () {
      hideExplorer();
    });
  }

  // ── Drag handling ─────────────────────────────────────────
  function wireDrag() {
    // Mouse
    lineEl.addEventListener('mousedown',   startDrag);
    handleEl.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup',   endDrag);

    // Touch
    lineEl.addEventListener('touchstart',   startDrag, { passive: false });
    handleEl.addEventListener('touchstart', startDrag, { passive: false });
    document.addEventListener('touchmove',  onDragMove, { passive: false });
    document.addEventListener('touchend',   endDrag);
  }

  function startDrag(e) {
    isDragging = true;
    lineEl.classList.add('dragging');
    handleEl.classList.add('dragging');
    e.preventDefault();
  }

  function endDrag() {
    if (!isDragging) return;
    isDragging = false;
    lineEl.classList.remove('dragging');
    handleEl.classList.remove('dragging');
  }

  function onDragMove(e) {
    if (!isDragging || !_visible) return;

    const map = window.map;
    if (!map) return;

    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const mapContainer = map.getContainer();
    const rect = mapContainer.getBoundingClientRect();

    // Clamp within the navigable map area (below nav, above profile panel + data-strip)
    const profileH = panelEl ? panelEl.offsetHeight : 158;
    const minY = NAV_H + 10;
    const maxY = rect.height - STRIP_H - profileH - 10;
    const clampedY = Math.max(minY, Math.min(maxY, clientY - rect.top));

    // Convert pixel → lat
    const latLng = map.containerPointToLatLng(L.point(rect.width / 2, clampedY));
    crosshairLat = latLng.lat;

    // Move the crosshair div
    crosshairEl.style.top = clampedY + 'px';
    updateLatLabels(crosshairLat);
    scheduleSample();

    if (e.cancelable) e.preventDefault();
  }

  // ── Map event wiring ──────────────────────────────────────
  // Reposition crosshair on pan / zoom so it stays on its lat.
  function wireMapEvents() {
    // We can't wire immediately — map may not exist yet.
    // Poll until window.map is set, then attach.
    function tryWire() {
      if (window.map) {
        window.map.on('moveend zoomend', function () {
          if (_visible) {
            positionCrosshairAtLat(crosshairLat);
            scheduleSample();
          }
        });
      } else {
        setTimeout(tryWire, 200);
      }
    }
    tryWire();
  }

  // ── Crosshair positioning ─────────────────────────────────
  function positionCrosshairAtLat(lat) {
    const map = window.map;
    if (!map || !crosshairEl) return;

    const mapContainer = map.getContainer();
    const rect = mapContainer.getBoundingClientRect();
    const pt = map.latLngToContainerPoint(L.latLng(lat, (LON_MIN + LON_MAX) / 2));

    // Clamp so it doesn't overlap the nav or profile panel
    const profileH = panelEl ? panelEl.offsetHeight : 158;
    const minY = NAV_H + 10;
    const maxY = rect.height - STRIP_H - profileH - 10;
    const y = Math.max(minY, Math.min(maxY, pt.y));

    crosshairEl.style.top = y + 'px';
    updateLatLabels(lat);
  }

  function updateLatLabels(lat) {
    const dir    = lat >= 0 ? 'N' : 'S';
    const text   = Math.abs(lat).toFixed(2) + '°' + dir;
    if (latLabelEl)   latLabelEl.textContent  = text;
    if (latReadoutEl) latReadoutEl.textContent = text;
  }

  // ── Sampling scheduler ────────────────────────────────────
  function scheduleSample() {
    clearTimeout(_sampleTimer);
    _sampleTimer = setTimeout(doSample, DEBOUNCE_MS);
  }

  function cancelSample() {
    clearTimeout(_sampleTimer);
    _sampleGen++;  // invalidate in-flight samples
  }

  // ── Elevation sampling ────────────────────────────────────
  async function doSample() {
    const gen = ++_sampleGen;
    const lat = crosshairLat;

    setLoading(true);

    // Build sample longitude array
    const lons = [];
    const step = (LON_MAX - LON_MIN) / (NUM_SAMPLES - 1);
    for (let i = 0; i < NUM_SAMPLES; i++) {
      lons.push(LON_MIN + i * step);
    }

    // Sample elevations in parallel batches (max 12 concurrent)
    let elevations;
    try {
      elevations = await batchSample(lat, lons, gen);
    } catch (_) {
      setLoading(false);
      return;
    }

    if (gen !== _sampleGen) return;  // superseded by newer drag

    // Páramo segments along this transect
    const paramoSegs = getParamoSegments(lat, lons);

    setLoading(false);
    renderProfile(lons, elevations, paramoSegs);
  }

  async function batchSample(lat, lons, gen) {
    const BATCH = 12;
    const results = new Array(lons.length);
    for (let i = 0; i < lons.length; i += BATCH) {
      if (gen !== _sampleGen) throw new Error('superseded');
      const slice = lons.slice(i, i + BATCH);
      const batch = await Promise.all(slice.map(lon => sampleElevation(lat, lon)));
      batch.forEach((v, j) => { results[i + j] = v; });
    }
    return results;
  }

  // ── Tile helpers ──────────────────────────────────────────
  function latLonToTile(lat, lon, zoom) {
    const n = Math.pow(2, zoom);
    const x = Math.floor((lon + 180) / 360 * n);
    const latRad = lat * Math.PI / 180;
    const y = Math.floor(
      (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n
    );
    return { x, y };
  }

  function tilePixel(lat, lon, zoom, tx, ty) {
    const n = Math.pow(2, zoom);
    const px = Math.floor(((lon + 180) / 360 * n - tx) * 256);
    const latRad = lat * Math.PI / 180;
    const py = Math.floor(
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n - ty) * 256
    );
    return {
      px: Math.max(0, Math.min(255, px)),
      py: Math.max(0, Math.min(255, py)),
    };
  }

  function fetchTileCanvas(tx, ty, zoom) {
    const key = zoom + '/' + tx + '/' + ty;
    if (tileCache.has(key)) return Promise.resolve(tileCache.get(key));

    return new Promise(function (resolve) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        canvas.getContext('2d').drawImage(img, 0, 0);
        tileCache.set(key, canvas);
        resolve(canvas);
      };
      img.onerror = function () { resolve(null); };
      img.src = TERRARIUM_URL
        .replace('{z}', zoom)
        .replace('{x}', tx)
        .replace('{y}', ty);
    });
  }

  async function sampleElevation(lat, lon) {
    const { x: tx, y: ty } = latLonToTile(lat, lon, SAMPLE_ZOOM);
    const canvas = await fetchTileCanvas(tx, ty, SAMPLE_ZOOM);
    if (!canvas) return 0;
    const { px, py } = tilePixel(lat, lon, SAMPLE_ZOOM, tx, ty);
    const d = canvas.getContext('2d').getImageData(px, py, 1, 1).data;
    // Terrarium RGB → elevation (metres)
    return d[0] * 256 + d[1] + d[2] / 256 - 32768;
  }

  // ── Páramo intersection ───────────────────────────────────
  // For each páramo polygon in LG.paramoFill, check if the
  // crosshair latitude is within its bounding-box latitude
  // range.  If so, mark the overlapping longitude range as gold.
  function getParamoSegments(lat, lons) {
    const LG = window.LG;
    if (!LG || !LG.paramoFill) return [];

    // Collect all lon ranges that bracket this lat
    const lonRanges = [];

    try {
      LG.paramoFill.eachFeature(function (layer) {
        if (!layer.feature || !layer.feature.geometry) return;
        const geom = layer.feature.geometry;

        const polys =
          geom.type === 'Polygon'      ? [geom.coordinates] :
          geom.type === 'MultiPolygon' ?  geom.coordinates   :
          [];

        for (const rings of polys) {
          const outer = rings[0];
          if (!outer || outer.length < 3) continue;

          let minLat = Infinity, maxLat = -Infinity;
          let minLon = Infinity, maxLon = -Infinity;
          for (const coord of outer) {
            const cLon = coord[0], cLat = coord[1];
            if (cLat < minLat) minLat = cLat;
            if (cLat > maxLat) maxLat = cLat;
            if (cLon < minLon) minLon = cLon;
            if (cLon > maxLon) maxLon = cLon;
          }
          if (lat >= minLat && lat <= maxLat) {
            lonRanges.push([minLon, maxLon]);
          }
        }
      });
    } catch (_) { /* eachFeature may throw if layer not loaded */ }

    if (lonRanges.length === 0) return [];

    // Mark sample indices
    const flags = new Array(lons.length).fill(false);
    for (let i = 0; i < lons.length; i++) {
      for (const [lo, hi] of lonRanges) {
        if (lons[i] >= lo && lons[i] <= hi) { flags[i] = true; break; }
      }
    }

    // Convert flags → [{start, end}] index pairs
    const segs = [];
    let inSeg = false, s = 0;
    for (let i = 0; i < flags.length; i++) {
      if (flags[i] && !inSeg) { inSeg = true; s = i; }
      else if (!flags[i] && inSeg) { segs.push([s, i - 1]); inSeg = false; }
    }
    if (inSeg) segs.push([s, flags.length - 1]);
    return segs;
  }

  // ── SVG profile rendering ─────────────────────────────────
  function renderProfile(lons, elevations, paramoSegs) {
    const NS = 'http://www.w3.org/2000/svg';

    const W  = svgEl.clientWidth  || 700;
    const H  = svgEl.clientHeight || 128;

    const PL = 36;   // left padding  (y-axis labels)
    const PR = 8;    // right padding
    const PT = 10;   // top padding
    const PB = 28;   // bottom padding (cordillera labels)

    const CW = W - PL - PR;
    const CH = H - PT - PB;

    const lonRange = lons[lons.length - 1] - lons[0];

    // Elevation extents — anchor at sea level
    const maxE = Math.max(5600, ...elevations.map(e => isFinite(e) ? e : 0));
    const minE = 0;
    const eRange = maxE - minE;

    const xOf = lon  => PL + (lon - lons[0]) / lonRange * CW;
    const yOf = elev => PT + CH - Math.max(0, elev - minE) / eRange * CH;

    const baseY = PT + CH;

    // Helper to create SVG element
    function el(tag, attrs, parent) {
      const node = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
      if (parent) parent.appendChild(node);
      return node;
    }

    // ── Clear SVG ──
    while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);
    svgEl.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

    // ── Gradient defs ──
    const defs = el('defs', {}, svgEl);
    // Terrain: muted sage-gray on light background
    const grad = el('linearGradient', { id: 'tp-terrain-grad', x1: '0', y1: '0', x2: '0', y2: '1' }, defs);
    el('stop', { offset: '0%',   'stop-color': 'rgba(92,108,90,0.42)'  }, grad);
    el('stop', { offset: '55%',  'stop-color': 'rgba(78,94,76,0.28)'   }, grad);
    el('stop', { offset: '100%', 'stop-color': 'rgba(60,76,60,0.14)'   }, grad);

    // Páramo gold gradient — richer at peak, fades toward base
    const pGrad = el('linearGradient', { id: 'tp-paramo-grad', x1: '0', y1: '0', x2: '0', y2: '1' }, defs);
    el('stop', { offset: '0%',   'stop-color': PARAMO_GOLD, 'stop-opacity': '0.55' }, pGrad);
    el('stop', { offset: '100%', 'stop-color': PARAMO_GOLD, 'stop-opacity': '0.12' }, pGrad);

    // ── Grid lines + y-axis labels ──
    const elevTicks = [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500];
    for (const tick of elevTicks) {
      if (tick > maxE + 300) continue;
      const ty = yOf(tick);
      if (ty < PT || ty > baseY) continue;

      // Grid
      el('line', {
        x1: PL, y1: ty, x2: PL + CW, y2: ty,
        stroke: 'rgba(90,110,90,0.13)', 'stroke-width': '1',
      }, svgEl);

      // Label (every 1000m)
      if (tick % 1000 === 0) {
        el('text', {
          x: PL - 4, y: ty + 3.5,
          'text-anchor': 'end',
          fill: 'rgba(70,90,70,0.60)',
          'font-size': '8.5',
          'font-family': 'Courier New, monospace',
        }, svgEl).textContent = (tick / 1000).toFixed(0) + 'k';
      }
    }

    // ── Páramo threshold dashed line ──
    const threshY = yOf(PARAMO_THRESH);
    if (threshY > PT && threshY < baseY) {
      el('line', {
        x1: PL, y1: threshY, x2: PL + CW, y2: threshY,
        stroke: '#A07828', 'stroke-width': '1',
        'stroke-dasharray': '4 3', opacity: '0.50',
      }, svgEl);
      el('text', {
        x: PL + CW - 3, y: threshY - 3,
        'text-anchor': 'end',
        fill: '#8B6820', 'font-size': '7.5',
        'font-family': 'Helvetica Neue, sans-serif',
        opacity: '0.75',
      }, svgEl).textContent = 'páramo';
    }

    // ── Build terrain path ──
    const pts = lons.map((lon, i) => {
      const x = xOf(lon);
      const y = yOf(Math.max(0, isFinite(elevations[i]) ? elevations[i] : 0));
      return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
    });
    pts.push(
      'L' + xOf(lons[lons.length - 1]).toFixed(1) + ',' + baseY,
      'L' + xOf(lons[0]).toFixed(1)                + ',' + baseY,
      'Z'
    );
    const pathD = pts.join(' ');

    // ── Páramo segments (gold fill behind terrain outline) ──
    for (const [si, ei] of paramoSegs) {
      const segPts = [];
      for (let k = si; k <= ei; k++) {
        const x = xOf(lons[k]);
        const y = yOf(Math.max(0, isFinite(elevations[k]) ? elevations[k] : 0));
        segPts.push((k === si ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1));
      }
      segPts.push(
        'L' + xOf(lons[ei]).toFixed(1) + ',' + baseY,
        'L' + xOf(lons[si]).toFixed(1) + ',' + baseY,
        'Z'
      );
      el('path', {
        d: segPts.join(' '),
        fill: 'url(#tp-paramo-grad)',
        stroke: 'none',
      }, svgEl);
    }

    // ── Terrain fill ──
    el('path', {
      d: pathD,
      fill: 'url(#tp-terrain-grad)',
      stroke: 'rgba(80,96,80,0.60)',
      'stroke-width': '1',
      'stroke-linejoin': 'round',
    }, svgEl);

    // ── Páramo segment top highlight line ──
    for (const [si, ei] of paramoSegs) {
      const outlinePts = lons.slice(si, ei + 1).map((lon, k) => {
        const x = xOf(lon);
        const y = yOf(Math.max(0, isFinite(elevations[si + k]) ? elevations[si + k] : 0));
        return (k === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
      });
      el('path', {
        d: outlinePts.join(' '),
        fill: 'none',
        stroke: PARAMO_GOLD,
        'stroke-width': '1.8',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        opacity: '0.8',
      }, svgEl);
    }

    // ── Cordillera labels ──
    for (const { lon, label } of CORDILLERAS) {
      if (lon < lons[0] || lon > lons[lons.length - 1]) continue;
      const cx = xOf(lon);

      // Short vertical tick at bottom
      el('line', {
        x1: cx, y1: baseY, x2: cx, y2: baseY + 4,
        stroke: 'rgba(80,100,80,0.30)', 'stroke-width': '1',
      }, svgEl);

      el('text', {
        x: cx, y: baseY + 13,
        'text-anchor': 'middle',
        fill: 'rgba(70,90,70,0.50)',
        'font-size': '7',
        'font-family': 'Helvetica Neue, Helvetica, Arial, sans-serif',
        'letter-spacing': '0.5',
      }, svgEl).textContent = label;
    }

    // ── Legend chip for páramo ──
    if (paramoSegs.length > 0) {
      const lgX = PL + 4;
      const lgY = PT + 8;
      el('rect', {
        x: lgX, y: lgY - 5, width: 9, height: 5,
        fill: PARAMO_GOLD, opacity: '0.65', rx: '1',
      }, svgEl);
      el('text', {
        x: lgX + 12, y: lgY,
        fill: 'rgba(130,96,28,0.75)',
        'font-size': '7.5',
        'font-family': 'Helvetica Neue, sans-serif',
      }, svgEl).textContent = 'Páramo zone';
    }
  }

  // ── Loading state ─────────────────────────────────────────
  function setLoading(on) {
    if (!loadingEl) return;
    if (on) {
      loadingEl.classList.remove('hidden');
      panelEl && panelEl.classList.add('tp-loading');
    } else {
      loadingEl.classList.add('hidden');
      panelEl && panelEl.classList.remove('tp-loading');
    }
  }

  // ── Boot ──────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM already ready; wait a tick so maps.js has time to expose window.map
    setTimeout(init, 50);
  }

})();
