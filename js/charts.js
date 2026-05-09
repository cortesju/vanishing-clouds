// ============================================================
// VANISHING CLOUDS — charts.js
// All Chart.js visualizations
// ============================================================

// ---- GLOBAL CHART.JS DEFAULTS ----
function applyChartDefaults() {
  if (typeof Chart === 'undefined') return;
  Chart.defaults.font.family = ""Helvetica Neue", HelveticaNeue, Helvetica, Arial, sans-serif";
  Chart.defaults.color = '#4A4A6A';
  Chart.defaults.plugins.legend.labels.padding = 16;
}

// ---- CHART INSTANCES ----
let recordsChart        = null;
let urgencyCategoryChart = null;
let urgencyTop5Chart    = null;
let urgencyThreatDonut  = null;

// ---- RECORDS BY DECADE DATA ----
const RECORDS_BY_DECADE = {
  labels: [
    'Pre-1900', '1900s', '1910s', '1920s', '1930s',
    '1940s', '1950s', '1960s', '1970s',
    '1980s', '1990s',
    '2000s',
    '2010s',
    '2020s',
  ],
  data: [23, 47, 62, 89, 124, 156, 203, 387, 542, 891, 1243, 2876, 8943, 12547],
  colors: [
    '#5B2C8D', '#5B2C8D', '#5B2C8D', '#5B2C8D', '#5B2C8D',
    '#5B2C8D', '#5B2C8D', '#5B2C8D', '#5B2C8D',
    '#2874A6', '#2874A6',
    '#148F77',
    '#E67E22',
    '#27AE60',
  ],
};

// ---- URGENCY DASHBOARD DATA (provisional / illustrative) ----
// Category distribution: Low=3, Moderate=10, High=7, Very High=1
const URGENCY_CATEGORY_DATA = {
  labels: ['Low', 'Moderate', 'High', 'Very High'],
  data:   [3, 10, 7, 1],
  colors: ['#CFE8B8', '#79C7B5', '#E6A15D', '#C94A38'],
  borderColors: ['#9FC890', '#4AABAA', '#C07030', '#A03020'],
};

// Top-5 páramos by prototype urgency score
const URGENCY_TOP5_DATA = {
  labels: ['Santurbán', 'Rabanal', 'Sierra Nevada', 'Sumapaz', 'Chingaza'],
  data:   [4.9, 4.6, 4.5, 4.4, 4.3],
  colors: ['#C94A38', '#E6A15D', '#E6A15D', '#E6A15D', '#E6A15D'],
};

// Dominant threat breakdown (illustrative percentages across categorized páramos)
const URGENCY_THREAT_DATA = {
  labels: ['Agriculture', 'Fire', 'Urban pressure', 'Mining', 'Climate'],
  data:   [56, 14, 12, 10, 8],
  colors: ['#79C7B5', '#E6A15D', '#C94A38', '#9B8060', '#B5C8A8'],
  borderColors: ['#4AABAA', '#C07030', '#A03020', '#7A6040', '#8AAA80'],
};

// ============================================================
// initRecordsChart
// ============================================================
function initRecordsChart() {
  const canvas = document.getElementById('records-chart');
  if (!canvas || recordsChart) return;
  if (typeof Chart === 'undefined') {
    console.warn('[charts.js] Chart.js not loaded');
    return;
  }

  const ctx = canvas.getContext('2d');

  recordsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: RECORDS_BY_DECADE.labels,
      datasets: [{
        label: 'Species Records',
        data: RECORDS_BY_DECADE.data,
        backgroundColor: RECORDS_BY_DECADE.colors,
        borderColor: RECORDS_BY_DECADE.colors.map(c => c + 'CC'),
        borderWidth: 1,
        borderRadius: 5,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      animation: {
        duration: 800,
        easing: 'easeOutQuart',
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1A1A2E',
          titleColor: '#fff',
          bodyColor: 'rgba(255,255,255,0.8)',
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            title(items) {
              return items[0].label;
            },
            label(item) {
              return ` ${item.raw.toLocaleString()} records`;
            },
            afterLabel(item) {
              const idx = item.dataIndex;
              if (idx >= 13) return ' Era: 2021–present (iNaturalist boom)';
              if (idx === 12) return ' Era: 2010s (smartphone & citizen science)';
              if (idx === 11) return ' Era: 2000s (GBIF launch, digitization)';
              if (idx >= 9)  return ' Era: 1980–1999';
              return ' Era: Pre-1980 (museum specimens)';
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            font: { size: 11 },
            color: '#8A8AAA',
            maxRotation: 45,
          },
        },
        y: {
          grid: {
            color: 'rgba(74, 74, 106, 0.08)',
            drawBorder: false,
          },
          border: { display: false },
          ticks: {
            font: { size: 11 },
            color: '#8A8AAA',
            callback(value) {
              return value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value;
            },
          },
        },
      },
    },
  });
}

// ============================================================
// initUrgencyCategoryChart  — bar: number of páramos per category
// ============================================================
function initUrgencyCategoryChart() {
  const canvas = document.getElementById('urgency-category-chart');
  if (!canvas || urgencyCategoryChart) return;
  if (typeof Chart === 'undefined') return;

  urgencyCategoryChart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: URGENCY_CATEGORY_DATA.labels,
      datasets: [{
        label: 'Páramo complexes (prototype)',
        data:  URGENCY_CATEGORY_DATA.data,
        backgroundColor: URGENCY_CATEGORY_DATA.colors,
        borderColor:     URGENCY_CATEGORY_DATA.borderColors,
        borderWidth: 1,
        borderRadius: 5,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 700, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1A1A2E',
          titleColor: '#fff',
          bodyColor: 'rgba(255,255,255,0.85)',
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: item => ` ${item.raw} páramo${item.raw !== 1 ? 's' : ''} (prototype)`,
          },
        },
      },
      scales: {
        x: { grid: { display: false }, border: { display: false },
             ticks: { font: { size: 11 }, color: '#7A8A8A' } },
        y: { grid: { color: 'rgba(74,74,106,0.08)' }, border: { display: false },
             ticks: { stepSize: 2, font: { size: 11 }, color: '#7A8A8A' },
             beginAtZero: true },
      },
    },
  });
}

// ============================================================
// initUrgencyTop5Chart  — horizontal bar: top-5 by prototype score
// ============================================================
function initUrgencyTop5Chart() {
  const canvas = document.getElementById('urgency-top5-chart');
  if (!canvas || urgencyTop5Chart) return;
  if (typeof Chart === 'undefined') return;

  urgencyTop5Chart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: URGENCY_TOP5_DATA.labels,
      datasets: [{
        label: 'Prototype urgency score',
        data:  URGENCY_TOP5_DATA.data,
        backgroundColor: URGENCY_TOP5_DATA.colors,
        borderColor:     URGENCY_TOP5_DATA.colors.map(c => c + 'CC'),
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 700, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1A1A2E',
          titleColor: '#fff',
          bodyColor: 'rgba(255,255,255,0.85)',
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: item => ` Score: ${item.raw.toFixed(1)} / 5.0 (prototype)`,
          },
        },
      },
      scales: {
        x: { min: 3.5, max: 5.0,
             grid: { color: 'rgba(74,74,106,0.08)' }, border: { display: false },
             ticks: { font: { size: 11 }, color: '#7A8A8A' } },
        y: { grid: { display: false }, border: { display: false },
             ticks: { font: { size: 11 }, color: '#4A5A5A' } },
      },
    },
  });
}

// ============================================================
// initUrgencyThreatDonut  — donut: dominant threat breakdown
// ============================================================
function initUrgencyThreatDonut() {
  const canvas = document.getElementById('urgency-threat-donut');
  if (!canvas || urgencyThreatDonut) return;
  if (typeof Chart === 'undefined') return;

  urgencyThreatDonut = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: URGENCY_THREAT_DATA.labels,
      datasets: [{
        data:            URGENCY_THREAT_DATA.data,
        backgroundColor: URGENCY_THREAT_DATA.colors,
        borderColor:     URGENCY_THREAT_DATA.borderColors,
        borderWidth: 1.5,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      animation: { animateRotate: true, duration: 800, easing: 'easeOutQuart' },
      plugins: {
        legend: {
          position: 'right',
          labels: {
            padding: 12, font: { size: 11 },
            usePointStyle: true, pointStyleWidth: 10,
            generateLabels(chart) {
              return chart.data.labels.map((label, i) => ({
                text: `${label} ${chart.data.datasets[0].data[i]}%`,
                fillStyle: chart.data.datasets[0].backgroundColor[i],
                strokeStyle: chart.data.datasets[0].borderColor[i],
                lineWidth: 1, pointStyle: 'circle', hidden: false, index: i,
              }));
            },
          },
        },
        tooltip: {
          backgroundColor: '#1A1A2E',
          titleColor: '#fff',
          bodyColor: 'rgba(255,255,255,0.85)',
          padding: 10,
          cornerRadius: 8,
          callbacks: { label: item => ` ${item.raw}% of categorized páramos (prototype)` },
        },
      },
    },
  });
}

// ============================================================
// GLOBAL HOOKS — called by main.js afterPanelRender
// ============================================================

// Allow re-init after panel content is swapped in
window.initRecordsChart = function() {
  recordsChart = null; // reset so it re-creates
  applyChartDefaults();
  initRecordsChart();
};

window.initUrgencyCategoryChart = function() {
  urgencyCategoryChart = null;
  applyChartDefaults();
  initUrgencyCategoryChart();
};
window.initUrgencyTop5Chart = function() {
  urgencyTop5Chart = null;
  applyChartDefaults();
  initUrgencyTop5Chart();
};
window.initUrgencyThreatDonut = function() {
  urgencyThreatDonut = null;
  applyChartDefaults();
  initUrgencyThreatDonut();
};

// ============================================================
// INTERSECTION OBSERVER — init charts when visible (fallback)
// ============================================================
function setupChartObserver() {
  if (typeof Chart === 'undefined') {
    // Retry once Chart.js loads
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (typeof Chart !== 'undefined') {
        clearInterval(interval);
        applyChartDefaults();
        setupChartObserver();
      } else if (attempts >= 30) {
        clearInterval(interval);
        console.error('[charts.js] Chart.js failed to load.');
      }
    }, 100);
    return;
  }

  applyChartDefaults();

  const CHART_INIT_MAP = {
    'records-chart':          initRecordsChart,
    'urgency-category-chart': initUrgencyCategoryChart,
    'urgency-top5-chart':     initUrgencyTop5Chart,
    'urgency-threat-donut':   initUrgencyThreatDonut,
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const id = entry.target.id;
      const initFn = CHART_INIT_MAP[id];
      if (initFn) {
        initFn();
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  Object.keys(CHART_INIT_MAP).forEach(id => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
}

// ============================================================
// ENTRY POINT
// ============================================================
(function () {
  function boot() {
    setupChartObserver();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
