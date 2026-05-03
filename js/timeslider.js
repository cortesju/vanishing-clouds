// ============================================================
// VANISHING CLOUDS — timeslider.js
// Time period filter logic for the species records map
// ============================================================

// ---- TIME PERIOD CONFIG ----
const TIME_PERIODS = {
  'all':          { label: 'All Time',       color: '#1B5E3B',  bg: '#E8F5E9' },
  'before-1980':  { label: 'Before 1980',    color: '#5B2C8D',  bg: '#F3E8FD' },
  '1980-1999':    { label: '1980–1999',      color: '#2874A6',  bg: '#E3F0FA' },
  '2000-2010':    { label: '2000–2010',      color: '#148F77',  bg: '#E4F5F1' },
  '2011-2020':    { label: '2011–2020',      color: '#E67E22',  bg: '#FEF3E2' },
  '2021-present': { label: '2021–Present',   color: '#27AE60',  bg: '#E8F8F0' },
};

// Approximate record counts per period for display
const PERIOD_COUNTS = {
  'all':          201,
  'before-1980':  18,
  '1980-1999':    27,
  '2000-2010':    38,
  '2011-2020':    62,
  '2021-present': 56,
};

// Track active period
window.currentTimePeriod = 'all';

// ============================================================
// updateTimeBtnStyles
// Sets active button's background to its era color
// ============================================================
function updateTimeBtnStyles(activePeriod) {
  const buttons = document.querySelectorAll('.time-btn');
  buttons.forEach(btn => {
    const period = btn.dataset.period;
    const cfg    = TIME_PERIODS[period] || {};

    if (period === activePeriod) {
      btn.classList.add('active');
      btn.style.background   = cfg.color || '#1B5E3B';
      btn.style.color        = '#fff';
      btn.style.borderColor  = cfg.color || '#1B5E3B';
    } else {
      btn.classList.remove('active');
      btn.style.background  = '';
      btn.style.color       = '';
      btn.style.borderColor = '';
    }
  });
}

// ============================================================
// updateRecordCount
// Shows how many records are visible for the selected period
// ============================================================
function updateRecordCount(period) {
  const countEl = document.getElementById('record-count');
  if (!countEl) return;

  const count = PERIOD_COUNTS[period] ?? '—';
  const cfg   = TIME_PERIODS[period] || {};
  const label = cfg.label || period;

  countEl.innerHTML = `
    <strong style="color:${cfg.color || '#1B5E3B'}">
      ${count.toLocaleString()} records
    </strong>
    shown for <em>${label}</em>
  `;
}

// ============================================================
// selectTimePeriod
// Main handler: update UI + filter the map
// ============================================================
function selectTimePeriod(period) {
  window.currentTimePeriod = period;

  updateTimeBtnStyles(period);
  updateRecordCount(period);

  // Delegate to maps.js via global function
  if (typeof window.filterMapByPeriod === 'function') {
    window.filterMapByPeriod(period);
  } else {
    // Maps.js may not be ready yet — retry once
    setTimeout(() => {
      if (typeof window.filterMapByPeriod === 'function') {
        window.filterMapByPeriod(period);
      }
    }, 500);
  }
}

// ============================================================
// injectRecordCountEl
// Adds the record count element below the time buttons if
// not already present in the HTML
// ============================================================
function injectRecordCountEl() {
  if (document.getElementById('record-count')) return;

  const mapTime = document.getElementById('map-time');
  if (!mapTime) return;

  const el = document.createElement('p');
  el.id = 'record-count';
  el.style.cssText = [
    'text-align:center',
    'font-size:13px',
    'color:#4A4A6A',
    'margin:8px 0 0',
    "font-family:'Inter',sans-serif",
  ].join(';');

  mapTime.insertAdjacentElement('afterend', el);
  updateRecordCount('all');
}

// ============================================================
// initTimeslider — called by main.js after timeline panel HTML is injected
// ============================================================
window.initTimeslider = function() {
  const timeBtns = document.querySelectorAll('.time-btn');
  if (!timeBtns.length) return;

  timeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const period = btn.dataset.period || 'all';
      selectTimePeriod(period);
    });
  });

  updateTimeBtnStyles(window.currentTimePeriod || 'all');
  updateRecordCount(window.currentTimePeriod || 'all');
};

// ============================================================
// EVENT LISTENERS
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Wire up if timeline panel is already rendered (unlikely in new app model,
  // but kept for safety)
  const timeBtns = document.querySelectorAll('.time-btn');
  timeBtns.forEach(btn => {
    btn.addEventListener('click', () => selectTimePeriod(btn.dataset.period || 'all'));
  });
  updateTimeBtnStyles('all');
});
