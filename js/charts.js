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
let recordsChart = null;
let urgencyDonut = null;

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

// ---- URGENCY DISTRIBUTION DATA ----
const URGENCY_DISTRIBUTION = {
  labels: ['Very Low', 'Low', 'Moderate', 'High', 'Very High'],
  data: [8, 15, 22, 35, 20],
  colors: ['#FFFFCC', '#C7E9B4', '#7FCDBB', '#F4A261', '#C0392B'],
  borderColors: ['#C8C860', '#8FC87A', '#4AABAA', '#D07030', '#922B21'],
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
// initUrgencyDonut
// ============================================================
function initUrgencyDonut() {
  const canvas = document.getElementById('urgency-donut');
  if (!canvas || urgencyDonut) return;
  if (typeof Chart === 'undefined') {
    console.warn('[charts.js] Chart.js not loaded');
    return;
  }

  const ctx = canvas.getContext('2d');

  // Custom center text plugin
  const centerTextPlugin = {
    id: 'centerText',
    afterDraw(chart) {
      if (chart.config.type !== 'doughnut') return;
      const { ctx: c, chartArea: { width, height, left, top } } = chart;
      c.save();
      const centerX = left + width / 2;
      const centerY = top + height / 2;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.font = "bold 22px 'Helvetica Neue', HelveticaNeue, Helvetica, Arial, sans-serif";
      c.fillStyle = '#1A1A2E';
      c.fillText('37', centerX, centerY - 10);
      c.font = "12px "Helvetica Neue", HelveticaNeue, Helvetica, Arial, sans-serif";
      c.fillStyle = '#4A4A6A';
      c.fillText('Páramos', centerX, centerY + 12);
      c.restore();
    },
  };

  urgencyDonut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: URGENCY_DISTRIBUTION.labels,
      datasets: [{
        data: URGENCY_DISTRIBUTION.data,
        backgroundColor: URGENCY_DISTRIBUTION.colors,
        borderColor: URGENCY_DISTRIBUTION.borderColors,
        borderWidth: 1.5,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '65%',
      animation: {
        animateRotate: true,
        duration: 900,
        easing: 'easeOutQuart',
      },
      plugins: {
        legend: {
          position: 'right',
          labels: {
            padding: 14,
            font: { size: 12 },
            usePointStyle: true,
            pointStyleWidth: 12,
            generateLabels(chart) {
              const data = chart.data;
              return data.labels.map((label, i) => ({
                text: `${label} (${data.datasets[0].data[i]}%)`,
                fillStyle: data.datasets[0].backgroundColor[i],
                strokeStyle: data.datasets[0].borderColor[i],
                lineWidth: 1,
                pointStyle: 'circle',
                hidden: false,
                index: i,
              }));
            },
          },
        },
        tooltip: {
          backgroundColor: '#1A1A2E',
          titleColor: '#fff',
          bodyColor: 'rgba(255,255,255,0.8)',
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label(item) {
              const val = item.raw;
              const descriptions = {
                'Very Low': 'Minimal threat, good coverage',
                'Low': 'Some pressure, adequate protection',
                'Moderate': 'Moderate threats, partial protection',
                'High': 'High threat, limited protection',
                'Very High': 'Critical — immediate action needed',
              };
              const desc = descriptions[item.label] || '';
              return [` ${val}% of páramo area`, ` ${desc}`];
            },
          },
        },
      },
    },
    plugins: [centerTextPlugin],
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

window.initUrgencyDonut = function() {
  urgencyDonut = null; // reset
  applyChartDefaults();
  initUrgencyDonut();
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
    'records-chart': initRecordsChart,
    'urgency-donut': initUrgencyDonut,
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
