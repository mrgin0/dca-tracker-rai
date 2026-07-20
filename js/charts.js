// ============================================================
//  CHARTS — Chart.js line (accumulation) + pie (allocation)
// ============================================================

import { state, colorForAsset } from './state.js?v=8';
import { getPrice } from './prices.js?v=8';
import { calcAsset } from './calc.js?v=8';
import { fmt, formatDateWITA } from './utils.js?v=8';

function axisColor() {
  return getComputedStyle(document.body).getPropertyValue('--muted-2').trim() || '#9AA1AB';
}
function gridColor() {
  return document.body.classList.contains('dark') ? 'rgba(255,255,255,0.05)' : 'rgba(20,36,61,0.05)';
}

/**
 * Chart.js measures its container's size at creation time. If the wrapper
 * was still mid-transition from hidden -> visible in the same tick (common
 * right after tab-switch or first render on mobile), that measurement can
 * be 0x0 and the chart never recovers its size until something else nudges
 * it. A resize one/two frames later fixes this reliably.
 */
function nudgeResize(chart) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => chart?.resize());
  });
}

const RANGE_DAYS = { '1W': 7, '1M': 30, '1Y': 365, '5Y': 365 * 5, '10Y': 365 * 10 };

function buildLineData() {
  const dateSet = new Set();
  state.assets.forEach((a) => (state.data[a.symbol] || []).forEach((e) => dateSet.add(e.tanggal)));
  const rawDates = Array.from(dateSet).sort();
  if (!rawDates.length) return null;

  const labels = [], investData = [], gainData = [];
  rawDates.forEach((date) => {
    let cumCost = 0, cumValue = 0, hasAllPrices = true;
    state.assets.forEach((a) => {
      const cp = getPrice(a.symbol);
      if (!cp) hasAllPrices = false;
      (state.data[a.symbol] || []).forEach((e) => {
        if (e.tanggal <= date) {
          cumCost += e.totalBeli;
          if (cp) cumValue += e.jumlahUnit * cp;
        }
      });
    });
    labels.push(formatDateWITA(date));
    investData.push(Number(cumCost.toFixed(2)));
    gainData.push(hasAllPrices ? Number((cumValue - cumCost).toFixed(2)) : null);
  });
  return { rawDates, labels, investData, gainData };
}

/** Slice the full series down to the selected range, keeping one anchor point before the window so the line doesn't falsely drop to zero. */
function filterByRange(full, range) {
  if (!full) return full;
  if (range === 'ALL' || !RANGE_DAYS[range]) return full;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RANGE_DAYS[range]);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  let startIdx = full.rawDates.findIndex((d) => d >= cutoffStr);
  if (startIdx === -1) {
    startIdx = full.rawDates.length - 1; // semua data lebih tua dari rentang — tampilkan titik terakhir saja
  } else if (startIdx > 0) {
    startIdx -= 1; // sertakan 1 titik sebelum jendela sebagai jangkar, biar garis tidak jatuh ke nol
  }
  return {
    rawDates: full.rawDates.slice(startIdx),
    labels: full.labels.slice(startIdx),
    investData: full.investData.slice(startIdx),
    gainData: full.gainData.slice(startIdx),
  };
}

function updateRangeButtonsUI() {
  document.querySelectorAll('[data-action="set-chart-range"]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.range === state.chartRange);
  });
}

export function renderLineChart() {
  const full = buildLineData();
  updateRangeButtonsUI();

  const emptyEl = document.getElementById('chart-empty');
  const wrapEl = document.getElementById('chart-wrapper');
  if (!full) { emptyEl.hidden = false; wrapEl.hidden = true; return; }

  const d = filterByRange(full, state.chartRange);
  const hasGain = d.gainData.some((v) => v !== null);
  emptyEl.hidden = hasGain;
  if (!hasGain) {
    emptyEl.hidden = false;
    emptyEl.innerHTML = '<i class="fa-regular fa-chart-bar"></i>Isi harga pasar semua aset untuk melihat unrealized gain di grafik.';
  }
  wrapEl.hidden = false;

  const ctx = document.getElementById('portfolioChart')?.getContext('2d');
  if (!ctx) return;

  const zoomConfig = {
    pan: { enabled: true, mode: 'x' },
    zoom: {
      wheel: { enabled: true, speed: 0.12 },
      pinch: { enabled: true },
      mode: 'x',
    },
  };

  if (state.charts.line) {
    const c = state.charts.line;
    c.data.labels = d.labels;
    c.data.datasets[0].data = d.investData;
    c.data.datasets[1].data = d.gainData;
    c.options.scales.x.ticks.color = axisColor();
    c.options.scales.y.ticks.color = axisColor();
    c.options.scales.x.grid.color = gridColor();
    c.options.scales.y.grid.color = gridColor();
    c.resetZoom?.();
    c.update();
    return;
  }

  state.charts.line = new Chart(ctx, {
    type: 'line',
    data: {
      labels: d.labels,
      datasets: [
        { label: 'Total Investasi', data: d.investData, borderColor: '#3E5C82', backgroundColor: 'rgba(62,92,130,0.08)', borderWidth: 2.5, pointRadius: 3, fill: true, tension: 0.35 },
        { label: 'Unrealized G/L', data: d.gainData, borderColor: '#3F6E5A', backgroundColor: 'rgba(63,110,90,0.08)', borderWidth: 2.5, borderDash: [6, 3], pointRadius: 3, fill: true, tension: 0.35, spanGaps: false },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, zoom: zoomConfig },
      scales: {
        x: { grid: { color: gridColor() }, ticks: { color: axisColor(), font: { size: 11 }, maxRotation: 45, autoSkip: true, maxTicksLimit: 10 } },
        y: { grid: { color: gridColor() }, ticks: { color: axisColor(), font: { size: 11 }, callback: (v) => '$' + Number(v).toLocaleString('en-US', { notation: 'compact' }) } },
      },
    },
  });
  nudgeResize(state.charts.line);
}

/** Ganti rentang waktu chart (1W/1M/1Y/5Y/10Y/ALL) lalu render ulang. */
export function setChartRange(range) {
  state.chartRange = range;
  renderLineChart();
}

/** Reset posisi zoom/pan chart ke tampilan awal. */
export function resetChartZoom() {
  state.charts.line?.resetZoom?.();
}

// Chart.js responsive mode sometimes needs a manual nudge on mobile
// orientation change / viewport resize (iOS Safari quirk).
let _resizeTimer = null;
function _handleResize() {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    state.charts.line?.resize();
    state.charts.pie?.resize();
  }, 150);
}
window.addEventListener('resize', _handleResize);
window.addEventListener('orientationchange', _handleResize);

export function renderPieChart() {
  const rows = state.assets
    .map((a) => ({ symbol: a.symbol, total: calcAsset(a.symbol).totalCost, color: colorForAsset(a.symbol) }))
    .filter((r) => r.total > 0);
  const total = rows.reduce((s, r) => s + r.total, 0);

  const empty = document.getElementById('pie-empty');
  const wrap = document.getElementById('pie-wrapper');
  const list = document.getElementById('asset-mini-list');

  if (!rows.length) {
    empty.hidden = false; wrap.hidden = true; list.innerHTML = '';
    return;
  }
  empty.hidden = true; wrap.hidden = false;

  list.innerHTML = rows.map((r) => `
    <div class="mini-row">
      <span><span class="dot" style="background:${r.color}"></span>${r.symbol}</span>
      <b>${fmt(r.total)} · ${((r.total / total) * 100).toFixed(1)}%</b>
    </div>`).join('');

  const ctx = document.getElementById('assetPieChart')?.getContext('2d');
  if (!ctx) return;
  const labels = rows.map((r) => r.symbol);
  const values = rows.map((r) => r.total);
  const colors = rows.map((r) => r.color);
  const border = document.body.classList.contains('dark') ? '#141E2C' : '#FFFFFF';

  if (state.charts.pie) {
    const c = state.charts.pie;
    c.data.labels = labels;
    c.data.datasets[0].data = values;
    c.data.datasets[0].backgroundColor = colors;
    c.data.datasets[0].borderColor = border;
    c.update();
    return;
  }

  state.charts.pie = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderColor: border, borderWidth: 2 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '58%',
      plugins: {
        legend: { position: 'bottom', labels: { color: axisColor(), font: { size: 12 }, padding: 14, usePointStyle: true } },
        tooltip: { callbacks: { label: (c) => `${c.label}: ${fmt(c.parsed)} (${((c.parsed / total) * 100).toFixed(1)}%)` } },
      },
    },
  });
  nudgeResize(state.charts.pie);
}

export function renderCharts() { renderLineChart(); renderPieChart(); }
