// ============================================================
//  UI — DOM rendering (no event wiring; app.js delegates events)
// ============================================================

import { state, assetOf, colorForAsset, canDeleteInstrument, saveActiveAsset, entriesOf } from './state.js?v=10';
import { getPrice, getSavedPrice } from './prices.js?v=10';
import { calcAsset, calcTotals, num } from './calc.js?v=10';
import { renderCharts } from './charts.js?v=10';
import { fmt, fmtN, fmtPct, safeId, hexToRgba, todayISO, escapeHtml } from './utils.js?v=10';

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

  const note = $('statement-note');
  if (note) {
    if (t.hasPrice && t.missing.length) {
      note.innerHTML = `<i class="fa-solid fa-circle-info"></i> Harga pasar ${escapeHtml(t.missing.join(', '))} belum diisi — nilainya dihitung memakai harga pokok.`;
      note.hidden = false;
    } else {
      note.hidden = true;
      note.innerHTML = '';
    }
  }
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
    const val = old[a.symbol] || getSavedPrice(a.symbol) || '';
    return `
      <div class="price-row" style="--asset-color:${color};background:${hexToRgba(color, 0.05)}">
        <span class="asset-tag" style="color:${color}">${escapeHtml(a.symbol)}</span>
        <span class="cur">$</span>
        <input type="number" id="price-${safeId(a.symbol)}" data-price="${escapeHtml(a.symbol)}"
               placeholder="0.00" min="0" step="0.01" value="${escapeHtml(val)}" inputmode="decimal" />
        <span class="unit">/${escapeHtml(a.unit)}</span>
      </div>`;
  }).join('');
}

// ---------- TABS ----------
export function renderTabs() {
  const tabs = state.assets.map((a) =>
    `<button type="button" class="tab ${a.symbol === state.currentTab ? 'active' : ''}" data-action="switch-tab" data-symbol="${escapeHtml(a.symbol)}">${escapeHtml(a.symbol)}</button>`
  ).join('');
  $('tabs').innerHTML = tabs +
    `<button type="button" class="tab add-instrument" data-action="open-instrument"><i class="fa fa-plus"></i> Instrumen</button>`;
}

// ---------- TAB CONTENT (form + summary + table) ----------
export function renderTabContent() {
  const a = assetOf(state.currentTab);
  if (!a) return;
  const entries = entriesOf(a.symbol);
  const calc = calcAsset(a.symbol);
  const cp = getPrice(a.symbol);

  let summaryHtml = '';
  if (entries.length > 0) {
    const gcls = calc.gain !== null ? (calc.gain >= 0 ? 'positive' : 'negative') : '';
    summaryHtml = `
      <div class="asset-summary">
        <div class="asset-metric"><div class="label">Total Unit</div><div class="value">${fmtN(calc.totalUnits, 6)}</div><div class="sub">${escapeHtml(a.unit)}</div></div>
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
    const sortDir = state.tableSortDir[a.symbol] || 'desc'; // default: terbaru dulu
    const pageSize = state.tableRowsPerPage[a.symbol] ?? 10; // default 10 baris

    const sortedEntries = [...entries].sort((x, y) => {
      const dx = String(x.tanggal || ''), dy = String(y.tanggal || '');
      if (dx < dy) return sortDir === 'asc' ? -1 : 1;
      if (dx > dy) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    const visible = pageSize === 'ALL' ? sortedEntries : sortedEntries.slice(0, pageSize);

    const rows = visible.map((e) => {
      const units = num(e.jumlahUnit);
      const cost = num(e.totalBeli);
      const cv = cp !== null ? units * cp : null;
      const ug = cv !== null ? cv - cost : null;
      const up = ug !== null && cost > 0 ? (ug / cost) * 100 : null;
      const gc = ug !== null ? (ug >= 0 ? 'positive' : 'negative') : '';
      const id = escapeHtml(e.id);
      return `<tr data-row-id="${id}">
        <td>${escapeHtml(e.tanggal || '—')}</td>
        <td>${fmt(num(e.hargaBeli))}</td>
        <td>${fmtN(units, 6)} ${escapeHtml(a.unit)}</td>
        <td>${fmt(cost)}</td>
        <td class="${gc}">${ug !== null ? fmt(ug) : '—'}</td>
        <td class="${gc}" style="font-size:12px">${up !== null ? fmtPct(up) : '—'}</td>
        <td class="row-actions">
          <button type="button" class="btn btn-sm" data-action="edit-entry" data-symbol="${escapeHtml(a.symbol)}" data-id="${id}" title="Edit" aria-label="Edit transaksi"><i class="fa fa-pen"></i></button>
          <button type="button" class="btn btn-sm btn-danger" data-action="del-entry" data-symbol="${escapeHtml(a.symbol)}" data-id="${id}" title="Hapus" aria-label="Hapus transaksi"><i class="fa fa-trash"></i></button>
        </td>
      </tr>`;
    }).join('');

    const pageSizes = [10, 50, 100, 'ALL'];
    const rowsPerPageHtml = pageSizes.map((sz) => `
      <button type="button" class="rows-btn ${pageSize === sz ? 'active' : ''}" data-action="set-page-size" data-symbol="${escapeHtml(a.symbol)}" data-size="${sz}">${sz === 'ALL' ? 'Semua' : sz}</button>
    `).join('');

    const tableToolbar = `
      <div class="table-toolbar">
        <button type="button" class="btn btn-sm btn-quiet" data-action="toggle-sort" data-symbol="${escapeHtml(a.symbol)}">
          <i class="fa-solid ${sortDir === 'desc' ? 'fa-arrow-down-wide-short' : 'fa-arrow-up-wide-short'}"></i>
          ${sortDir === 'desc' ? 'Terbaru dulu' : 'Terlama dulu'}
        </button>
        <div class="rows-per-page" role="group" aria-label="Jumlah baris">
          <span class="rows-label">Tampilkan:</span>
          ${rowsPerPageHtml}
        </div>
      </div>`;

    const shown = visible.length;
    const total = entries.length;
    const caption = `<p class="hint table-caption">Menampilkan ${shown} dari ${total} transaksi. Klik <i class="fa fa-pen"></i> untuk mengubah baris.</p>`;

    tableHtml = `
      ${tableToolbar}
      <div class="table-wrap">
        <table>
          <thead><tr><th>Tanggal</th><th>Harga Beli</th><th>Jumlah</th><th>Total Beli</th><th>Unrealized</th><th>%</th><th>Aksi</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${caption}`;
  }

  $('tab-content').innerHTML = `
    <div class="panel">
      <div class="panel-head"><div>
        <p class="eyebrow">Catat Transaksi</p>
        <h2 class="panel-title">${escapeHtml(a.name)}</h2>
      </div></div>
      <div class="field-grid four">
        <label class="field"><span>Tanggal pembelian</span><input type="date" id="f-tanggal" value="${todayISO()}"></label>
        <label class="field"><span>Harga beli / ${escapeHtml(a.unit)} ($)</span><input type="number" id="f-harga" placeholder="cth: 480.50" min="0" step="0.01" inputmode="decimal"></label>
        <label class="field"><span>Jumlah / qty</span><input type="number" id="f-unit" placeholder="cth: 1.5" min="0" step="any" inputmode="decimal"></label>
        <label class="field"><span>Total beli ($)</span><input type="number" id="f-total" placeholder="otomatis harga × qty" min="0" step="0.01" inputmode="decimal"></label>
      </div>
      <div class="btn-row">
        <button type="button" class="btn btn-primary" data-action="save-entry" data-symbol="${escapeHtml(a.symbol)}">Tambah Pembelian</button>
        ${canDeleteInstrument(a) ? `<button type="button" class="btn btn-danger" data-action="remove-asset" data-symbol="${escapeHtml(a.symbol)}"><i class="fa fa-trash"></i> Hapus Instrumen</button>` : ''}
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
  $('tab-content').innerHTML = `<div class="panel"><div class="empty"><i class="fa-solid fa-circle-notch fa-spin"></i>${escapeHtml(msg)}</div></div>`;
}
