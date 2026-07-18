// ============================================================
//  CHARTS — Chart.js line (accumulation) + pie (allocation)
// ============================================================

import { state, colorForAsset } from './state.js';
import { getPrice } from './prices.js';
import { calcAsset } from './calc.js';
import { fmt, formatDateWITA } from './utils.js';

function axisColor() {
  return getComputedStyle(document.body).getPropertyValue('--muted-2').trim() || '#9AA1AB';
}
function gridColor() {
  return document.body.classList.contains('dark') ? 'rgba(255,255,255,0.05)' : 'rgba(20,36,61,0.05)';
}

function buildLineData() {
  const dateSet = new Set();
  state.assets.forEach((a) => (state.data[a.symbol] || []).forEach((e) => dateSet.add(e.tanggal)));
  const dates = Array.from(dateSet).sort();
  if (!dates.length) return null;

  const labels = [], investData = [], gainData = [];
  dates.forEach((date) => {
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
  return { labels, investData, gainData };
}

export function renderLineChart() {
  const d = buildLineData();
  const emptyEl = document.getElementById('chart-empty');
  const wrapEl = document.getElementById('chart-wrapper');
  if (!d) { emptyEl.hidden = false; wrapEl.hidden = true; return; }

  const hasGain = d.gainData.some((v) => v !== null);
  emptyEl.hidden = hasGain;
  if (!hasGain) {
    emptyEl.hidden = false;
    emptyEl.innerHTML = '<i class="fa-regular fa-chart-bar"></i>Isi harga pasar semua aset untuk melihat unrealized gain di grafik.';
  }
  wrapEl.hidden = false;

  const ctx = document.getElementById('portfolioChart')?.getContext('2d');
  if (!ctx) return;

  if (state.charts.line) {
    const c = state.charts.line;
    c.data.labels = d.labels;
    c.data.datasets[0].data = d.investData;
    c.data.datasets[1].data = d.gainData;
    c.options.scales.x.ticks.color = axisColor();
    c.options.scales.y.ticks.color = axisColor();
    c.options.scales.x.grid.color = gridColor();
    c.options.scales.y.grid.color = gridColor();
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
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: gridColor() }, ticks: { color: axisColor(), font: { size: 11 }, maxRotation: 45, autoSkip: true, maxTicksLimit: 10 } },
        y: { grid: { color: gridColor() }, ticks: { color: axisColor(), font: { size: 11 }, callback: (v) => '$' + Number(v).toLocaleString('en-US', { notation: 'compact' }) } },
      },
    },
  });
}

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
}

export function renderCharts() { renderLineChart(); renderPieChart(); }
