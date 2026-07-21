// ============================================================
//  CHARTS — Chart.js line (accumulation) + pie (allocation)
// ============================================================

import { state, colorForAsset, allSymbols, entriesOf } from './state.js?v=10';
import { getPrice } from './prices.js?v=10';
import { calcAsset, num } from './calc.js?v=10';
import { fmt, fmtCompact, formatDateWITA } from './utils.js?v=10';
import { t } from './i18n.js?v=10';

function axisColor() {
  return getComputedStyle(document.body).getPropertyValue('--muted-2').trim() || '#9AA1AB';
}
function gridColor() {
  return document.body.classList.contains('dark') ? 'rgba(255,255,255,0.05)' : 'rgba(20,36,61,0.05)';
}
const round2 = (n) => Math.round(n * 100) / 100;

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

/** Tanggal lokal (bukan UTC) dalam format YYYY-MM-DD. */
function localISO(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function buildLineData() {
  // Hanya simbol yang benar-benar punya transaksi. Instrumen kosong tidak
  // boleh ikut menentukan apakah garis unrealized bisa digambar.
  const symbols = allSymbols().filter((s) => entriesOf(s).length > 0);
  if (!symbols.length) return null;

  const dateSet = new Set();
  symbols.forEach((s) => entriesOf(s).forEach((e) => { if (e.tanggal) dateSet.add(e.tanggal); }));
  const rawDates = Array.from(dateSet).sort();
  if (!rawDates.length) return null;

  const priceOf = {};
  symbols.forEach((s) => { priceOf[s] = getPrice(s); });
  const missingPrice = symbols.filter((s) => priceOf[s] === null);
  const canGain = missingPrice.length === 0;

  const labels = [], investData = [], gainData = [];
  rawDates.forEach((date) => {
    let cumCost = 0, cumValue = 0;
    symbols.forEach((s) => {
      const cp = priceOf[s];
      entriesOf(s).forEach((e) => {
        if (e.tanggal && e.tanggal <= date) {
          cumCost += num(e.totalBeli);
          if (cp !== null) cumValue += num(e.jumlahUnit) * cp;
        }
      });
    });
    labels.push(formatDateWITA(date));
    investData.push(round2(cumCost));
    gainData.push(canGain ? round2(cumValue - cumCost) : null);
  });
  return { rawDates, labels, investData, gainData, missingPrice };
}

/** Slice the full series down to the selected range, keeping one anchor point before the window so the line doesn't falsely drop to zero. */
function filterByRange(full, range) {
  if (!full) return full;
  if (range === 'ALL' || !RANGE_DAYS[range]) return full;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RANGE_DAYS[range]);
  const cutoffStr = localISO(cutoff);

  let startIdx = full.rawDates.findIndex((d) => d >= cutoffStr);
  if (startIdx === -1) {
    startIdx = full.rawDates.length - 1; // semua data lebih tua dari rentang — tampilkan titik terakhir saja
  } else if (startIdx > 0) {
    startIdx -= 1; // sertakan 1 titik sebelum jendela sebagai jangkar, biar garis tidak jatuh ke nol
  }
  return {
    ...full,
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

function setLineNotice(html) {
  const el = document.getElementById('chart-note');
  if (!el) return;
  el.innerHTML = html || '';
  el.hidden = !html;
}

export function renderLineChart() {
  const full = buildLineData();
  updateRangeButtonsUI();

  const emptyEl = document.getElementById('chart-empty');
  const wrapEl = document.getElementById('chart-wrapper');
  if (!emptyEl || !wrapEl) return;

  if (!full) {
    emptyEl.innerHTML = `<i class="fa-regular fa-chart-bar"></i>${t('chart.empty')}`;
    emptyEl.hidden = false;
    wrapEl.hidden = true;
    setLineNotice('');
    return;
  }

  // Ada data → grafik SELALU tampil. Kalau harga belum lengkap, cukup beri
  // catatan kecil; jangan sembunyikan grafiknya.
  emptyEl.hidden = true;
  wrapEl.hidden = false;
  setLineNotice(full.missingPrice.length
    ? t('chart.note', { list: full.missingPrice.join(', ') })
    : '');

  const d = filterByRange(full, state.chartRange);
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
    c.data.datasets[0].label = t('chart.invest');
    c.data.datasets[1].label = t('chart.gain');
    c.options.scales.x.ticks.color = axisColor();
    c.options.scales.y.ticks.color = axisColor();
    c.options.scales.x.grid.color = gridColor();
    c.options.scales.y.grid.color = gridColor();
    c.update();           // zoom/pan pengguna sengaja TIDAK direset di sini
    return;
  }

  state.charts.line = new Chart(ctx, {
    type: 'line',
    data: {
      labels: d.labels,
      datasets: [
        { label: t('chart.invest'), data: d.investData, borderColor: '#3E5C82', backgroundColor: 'rgba(62,92,130,0.08)', borderWidth: 2.5, pointRadius: 3, fill: true, tension: 0.35 },
        { label: t('chart.gain'), data: d.gainData, borderColor: '#3F6E5A', backgroundColor: 'rgba(63,110,90,0.08)', borderWidth: 2.5, borderDash: [6, 3], pointRadius: 3, fill: true, tension: 0.35, spanGaps: false },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        zoom: zoomConfig,
        tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.y === null ? '—' : fmt(c.parsed.y)}` } },
      },
      scales: {
        x: { grid: { color: gridColor() }, ticks: { color: axisColor(), font: { size: 11 }, maxRotation: 45, autoSkip: true, maxTicksLimit: 10 } },
        y: { grid: { color: gridColor() }, ticks: { color: axisColor(), font: { size: 11 }, callback: (v) => fmtCompact(v) } },
      },
    },
  });
  nudgeResize(state.charts.line);
}

/** Ganti rentang waktu chart (1W/1M/1Y/5Y/10Y/ALL) lalu render ulang. */
export function setChartRange(range) {
  state.chartRange = range;
  state.charts.line?.resetZoom?.();
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
  // Alokasi memakai NILAI PASAR bila harganya sudah ada, dan otomatis
  // jatuh ke harga pokok untuk aset yang harganya belum diisi. Jadi pie
  // ikut berubah begitu tombol "Ambil Data" dipakai.
  const rows = allSymbols()
    .map((symbol) => {
      const c = calcAsset(symbol);
      const live = c.currentVal !== null && c.totalUnits > 0;
      return {
        symbol,
        value: live ? c.currentVal : c.totalCost,
        cost: c.totalCost,
        live,
        color: colorForAsset(symbol),
      };
    })
    .filter((r) => r.value > 0);
  const total = rows.reduce((s, r) => s + r.value, 0);

  const empty = document.getElementById('pie-empty');
  const wrap = document.getElementById('pie-wrapper');
  const list = document.getElementById('asset-mini-list');
  if (!empty || !wrap || !list) return;

  if (!rows.length || total <= 0) {
    empty.hidden = false; wrap.hidden = true; list.innerHTML = '';
    return;
  }
  empty.hidden = true; wrap.hidden = false;

  list.innerHTML = rows.map((r) => `
    <div class="mini-row">
      <span><span class="dot" style="background:${r.color}"></span>${r.symbol}${r.live ? '' : ` <em class="mini-flag">${t('pie.costFlag')}</em>`}</span>
      <b>${fmt(r.value)} · ${((r.value / total) * 100).toFixed(1)}%</b>
    </div>`).join('');

  const ctx = document.getElementById('assetPieChart')?.getContext('2d');
  if (!ctx) return;
  const labels = rows.map((r) => r.symbol);
  const values = rows.map((r) => r.value);
  const colors = rows.map((r) => r.color);
  const border = document.body.classList.contains('dark') ? '#141E2C' : '#FFFFFF';

  if (state.charts.pie) {
    const c = state.charts.pie;
    c.data.labels = labels;
    c.data.datasets[0].data = values;
    c.data.datasets[0].backgroundColor = colors;
    c.data.datasets[0].borderColor = border;
    c.options.plugins.legend.labels.color = axisColor();
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
        tooltip: {
          callbacks: {
            // Total dihitung ulang dari data aktual, bukan dari closure lama —
            // kalau tidak, persentase tooltip akan basi setelah data berubah.
            label: (item) => {
              const sum = (item.chart.data.datasets[0].data || []).reduce((s, v) => s + Number(v || 0), 0);
              const pct = sum > 0 ? ((item.parsed / sum) * 100).toFixed(1) : '0.0';
              return `${item.label}: ${fmt(item.parsed)} (${pct}%)`;
            },
          },
        },
      },
    },
  });
  nudgeResize(state.charts.pie);
}

export function renderCharts() { renderLineChart(); renderPieChart(); }
