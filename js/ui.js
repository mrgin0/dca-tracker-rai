// ============================================================
//  UI — DOM rendering (no event wiring; app.js delegates events)
// ============================================================

import { state, assetOf, colorForAsset, canDeleteInstrument, saveActiveAsset } from './state.js';
import { getPrice, getSavedPrice } from './prices.js';
import { calcAsset, calcTotals } from './calc.js';
import { renderCharts } from './charts.js';
import { fmt, fmtN, fmtPct, safeId, hexToRgba, todayISO } from './utils.js';

const $ = (id) => document.getElementById(id);

// ---------- STATEMENT SUMMARY ----------
export function renderStatement() {
  const t = calcTotals();
  $('s-total').textContent = fmt(t.totalInvest);
  $('s-now').textContent = t.hasPrice ? fmt(t.totalNow) : '—';

  const gainEl = $('s-gain');
  gainEl.textContent = t.hasPrice ? fmt(t.gain) : '—';
  gainEl.className = 'statement-value' + (t.hasPrice ? (t.gain >= 0 ? ' positive' : ' negative') : '');

  $('s-pct').textContent = t.pct !== null ? fmtPct(t.pct) : 'isi harga pasar';
  $('s-tx').textContent = t.txCount;
  renderCharts();
}

// ---------- PRICE ROWS ----------
export function renderPriceRows() {
  const old = {};
  state.assets.forEach((a) => {
    const el = $('price-' + safeId(a.symbol));
    if (el) old[a.symbol] = el.value;
  });

  $('price-rows').innerHTML = state.assets.map((a) => {
    const color = colorForAsset(a.symbol);
    const val = old[a.symbol] ?? getSavedPrice(a.symbol) ?? '';
    return `
      <div class="price-row" style="--asset-color:${color};background:${hexToRgba(color, 0.05)}">
        <span class="asset-tag" style="color:${color}">${a.symbol}</span>
        <span class="cur">$</span>
        <input type="number" id="price-${safeId(a.symbol)}" data-price="${a.symbol}"
               placeholder="0.00" min="0" step="0.01" value="${val}" inputmode="decimal" />
        <span class="unit">/${a.unit}</span>
      </div>`;
  }).join('');
}

// ---------- TABS ----------
export function renderTabs() {
  const tabs = state.assets.map((a) =>
    `<button class="tab ${a.symbol === state.currentTab ? 'active' : ''}" data-action="switch-tab" data-symbol="${a.symbol}">${a.symbol}</button>`
  ).join('');
  $('tabs').innerHTML = tabs +
    `<button class="tab add-instrument" data-action="open-instrument"><i class="fa fa-plus"></i> Instrumen</button>`;
}

// ---------- TAB CONTENT (form + summary + table) ----------
export function renderTabContent() {
  const a = assetOf(state.currentTab);
  const entries = state.data[a.symbol] || [];
  const calc = calcAsset(a.symbol);
  const cp = getPrice(a.symbol);
  const isEdit = state.editIdx !== null;
  const ed = isEdit ? entries[state.editIdx] : null;

  let summaryHtml = '';
  if (entries.length > 0) {
    const gcls = calc.gain !== null ? (calc.gain >= 0 ? 'positive' : 'negative') : '';
    summaryHtml = `
      <div class="asset-summary">
        <div class="asset-metric"><div class="label">Total Unit</div><div class="value">${fmtN(calc.totalUnits, 6)}</div><div class="sub">${a.unit}</div></div>
        <div class="asset-metric"><div class="label">Avg Harga Beli</div><div class="value">${fmt(calc.avgPrice)}</div></div>
        <div class="asset-metric"><div class="label">Total Investasi</div><div class="value">${fmt(calc.totalCost)}</div></div>
        <div class="asset-metric"><div class="label">Nilai Sekarang</div><div class="value">${calc.currentVal !== null ? fmt(calc.currentVal) : '—'}</div></div>
        <div class="asset-metric"><div class="label">Unrealized G/L</div><div class="value ${gcls}">${calc.gain !== null ? fmt(calc.gain) : '—'}</div><div class="sub ${gcls}">${calc.pct !== null ? fmtPct(calc.pct) : '—'}</div></div>
      </div>`;
  }

  let tableHtml = '';
  if (entries.length === 0) {
    tableHtml = `<div class="empty"><i class="fa-regular fa-folder-open"></i>${state.user ? 'Belum ada transaksi. Catat pembelian DCA pertama Anda.' : 'Masuk dulu agar transaksi tersimpan.'}</div>`;
  } else {
    const expanded = !!state.showAllRows[a.symbol];
    const visible = expanded ? entries : entries.slice(0, 5);
    const rows = visible.map((e, i) => {
      const cv = cp ? e.jumlahUnit * cp : null;
      const ug = cv !== null ? cv - e.totalBeli : null;
      const up = ug !== null && e.totalBeli > 0 ? (ug / e.totalBeli) * 100 : null;
      const gc = ug !== null ? (ug >= 0 ? 'positive' : 'negative') : '';
      return `<tr>
        <td>${e.tanggal}</td>
        <td>${fmt(e.hargaBeli)}</td>
        <td>${fmtN(e.jumlahUnit, 6)} ${a.unit}</td>
        <td>${fmt(e.totalBeli)}</td>
        <td class="${gc}">${ug !== null ? fmt(ug) : '—'}</td>
        <td class="${gc}" style="font-size:12px">${up !== null ? fmtPct(up) : '—'}</td>
        <td>
          <button class="btn btn-sm" data-action="edit-entry" data-symbol="${a.symbol}" data-idx="${i}" title="Edit"><i class="fa fa-pen"></i></button>
          <button class="btn btn-sm btn-danger" data-action="del-entry" data-symbol="${a.symbol}" data-idx="${i}" title="Hapus"><i class="fa fa-trash"></i></button>
        </td>
      </tr>`;
    }).join('');
    const toggle = entries.length > 5
      ? `<div class="btn-row" style="justify-content:center;margin-top:1rem"><button class="btn" data-action="toggle-rows" data-symbol="${a.symbol}">${expanded ? 'Tampilkan 5 baris' : 'Tampilkan semua'} (${entries.length})</button></div>`
      : '';
    tableHtml = `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Tanggal</th><th>Harga Beli</th><th>Jumlah</th><th>Total Beli</th><th>Unrealized</th><th>%</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>${toggle}`;
  }

  $('tab-content').innerHTML = `
    <div class="panel">
      <div class="panel-head"><div>
        <p class="eyebrow">${isEdit ? 'Ubah' : 'Catat'} Transaksi</p>
        <h2 class="panel-title">${a.name}</h2>
      </div></div>
      <div class="field-grid four">
        <label class="field"><span>Tanggal pembelian</span><input type="date" id="f-tanggal" value="${isEdit ? ed.tanggal : todayISO()}"></label>
        <label class="field"><span>Harga beli / ${a.unit} ($)</span><input type="number" id="f-harga" placeholder="cth: 480.50" min="0" step="0.01" inputmode="decimal" value="${isEdit ? ed.hargaBeli : ''}"></label>
        <label class="field"><span>Jumlah / qty</span><input type="number" id="f-unit" placeholder="cth: 1.5" min="0" step="any" inputmode="decimal" value="${isEdit ? ed.jumlahUnit : ''}"></label>
        <label class="field"><span>Total beli ($)</span><input type="number" id="f-total" placeholder="otomatis harga × qty" min="0" step="0.01" inputmode="decimal" value="${isEdit ? ed.totalBeli : ''}"></label>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" data-action="save-entry" data-symbol="${a.symbol}">${isEdit ? 'Simpan Perubahan' : 'Tambah Pembelian'}</button>
        ${canDeleteInstrument(a) ? `<button class="btn btn-danger" data-action="remove-asset" data-symbol="${a.symbol}"><i class="fa fa-trash"></i> Hapus Instrumen</button>` : ''}
        ${isEdit ? `<button class="btn" data-action="cancel-edit">Batal</button>` : ''}
      </div>
    </div>
    ${summaryHtml}
    <div class="panel">${tableHtml}</div>`;

  renderStatement();
}

// ---------- ORCHESTRATE ----------
export function renderAll() {
  if (!state.assets.some((a) => a.symbol === state.currentTab)) {
    state.currentTab = state.assets[0]?.symbol || 'QQQM';
  }
  saveActiveAsset();
  renderPriceRows();
  renderTabs();
  renderTabContent();
}

export function setLoading(msg) {
  $('tab-content').innerHTML = `<div class="panel"><div class="empty"><i class="fa-solid fa-circle-notch fa-spin"></i>${msg}</div></div>`;
}
