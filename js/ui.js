// ============================================================
//  UI — DOM rendering (no event wiring; app.js delegates events)
// ============================================================

import { state, assetOf, colorForAsset, canDeleteInstrument, saveActiveAsset, entriesOf, allSymbols } from './state.js?v=14';
import { getPrice, getSavedPriceUSD, setPriceUSD, displayPriceValue } from './prices.js?v=14';
import { calcAsset, calcTotals, num } from './calc.js?v=14';
import { renderCharts } from './charts.js?v=14';
import { fmt, fmtN, fmtPct, safeId, hexToRgba, todayISO, escapeHtml, currencySymbol } from './utils.js?v=14';
import { t } from './i18n.js?v=14';

const $ = (id) => document.getElementById(id);

// ---------- STATEMENT SUMMARY ----------
export function renderStatement() {
  const tot = calcTotals();
  $('s-total').textContent = fmt(tot.totalInvest);
  $('s-now').textContent = tot.hasPrice ? fmt(tot.totalNow) : '—';

  const gainEl = $('s-gain');
  gainEl.textContent = tot.hasPrice ? fmt(tot.gain) : '—';
  gainEl.className = 'statement-value' + (tot.hasPrice ? (tot.gain >= 0 ? ' positive' : ' negative') : '');

  $('s-pct').textContent = tot.pct !== null ? fmtPct(tot.pct) : t('stmt.gainSub');
  $('s-tx').textContent = tot.txCount;

  const note = $('statement-note');
  if (note) {
    if (tot.hasPrice && tot.missing.length) {
      note.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${escapeHtml(t('stmt.missing', { list: tot.missing.join(', ') }))}`;
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
  // Seed cache-dalam-memori dari nilai kanonik (USD) tersimpan, supaya harga
  // tidak hilang tiap kali panel ini dirender ulang (mis. setelah tambah
  // transaksi) dan supaya tampilannya otomatis mengikuti mata uang aktif.
  state.assets.forEach((a) => {
    const savedUsd = getSavedPriceUSD(a.symbol);
    if (savedUsd !== null && getPrice(a.symbol) === null) setPriceUSD(a.symbol, savedUsd);
  });

  const cur = currencySymbol();
  $('price-rows').innerHTML = state.assets.map((a) => {
    const color = colorForAsset(a.symbol);
    const val = displayPriceValue(a.symbol);
    return `
      <div class="price-row" style="--asset-color:${color};background:${hexToRgba(color, 0.05)}">
        <span class="asset-tag" style="color:${color}">${escapeHtml(a.symbol)}</span>
        <span class="cur">${escapeHtml(cur)}</span>
        <input type="number" id="price-${safeId(a.symbol)}" data-price="${escapeHtml(a.symbol)}"
               placeholder="${cur === 'Rp' ? '0' : '0.00'}" min="0" step="${cur === 'Rp' ? '1' : '0.01'}"
               value="${escapeHtml(val)}" inputmode="decimal" />
        <span class="unit">/${escapeHtml(a.unit)}</span>
      </div>`;
  }).join('');

  const usdNote = $('price-usd-note');
  if (usdNote) {
    usdNote.textContent = t('prices.usdOnly');
    usdNote.hidden = false;
  }
}

// ---------- TABS ----------
export function renderTabs() {
  const tabs = state.assets.map((a) =>
    `<button type="button" class="tab ${a.symbol === state.currentTab ? 'active' : ''}" data-action="switch-tab" data-symbol="${escapeHtml(a.symbol)}">${escapeHtml(a.symbol)}</button>`
  ).join('');
  $('tabs').innerHTML = tabs +
    `<button type="button" class="tab add-instrument" data-action="open-instrument"><i class="fa fa-plus"></i> ${escapeHtml(t('tabs.instrument'))}</button>`;
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
        <div class="asset-metric"><div class="label">${escapeHtml(t('metric.units'))}</div><div class="value">${fmtN(calc.totalUnits, 6)}</div><div class="sub">${escapeHtml(a.unit)}</div></div>
        <div class="asset-metric"><div class="label">${escapeHtml(t('metric.avg'))}</div><div class="value">${fmt(calc.avgPrice)}</div></div>
        <div class="asset-metric"><div class="label">${escapeHtml(t('metric.invested'))}</div><div class="value">${fmt(calc.totalCost)}</div></div>
        <div class="asset-metric"><div class="label">${escapeHtml(t('metric.now'))}</div><div class="value">${calc.currentVal !== null ? fmt(calc.currentVal) : '—'}</div></div>
        <div class="asset-metric"><div class="label">${escapeHtml(t('metric.gain'))}</div><div class="value ${gcls}">${calc.gain !== null ? fmt(calc.gain) : '—'}</div><div class="sub ${gcls}">${calc.pct !== null ? fmtPct(calc.pct) : '—'}</div></div>
      </div>`;
  }

  let tableHtml = '';
  if (entries.length === 0) {
    tableHtml = `<div class="empty"><i class="fa-regular fa-folder-open"></i>${escapeHtml(state.user ? t('table.empty') : t('table.emptyGuest'))}</div>`;
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
          <button type="button" class="btn btn-sm" data-action="edit-entry" data-symbol="${escapeHtml(a.symbol)}" data-id="${id}" title="${escapeHtml(t('table.edit'))}" aria-label="${escapeHtml(t('table.edit'))}"><i class="fa fa-pen"></i></button>
          <button type="button" class="btn btn-sm btn-danger" data-action="del-entry" data-symbol="${escapeHtml(a.symbol)}" data-id="${id}" title="${escapeHtml(t('table.delete'))}" aria-label="${escapeHtml(t('table.delete'))}"><i class="fa fa-trash"></i></button>
        </td>
      </tr>`;
    }).join('');

    const pageSizes = [10, 50, 100, 'ALL'];
    const rowsPerPageHtml = pageSizes.map((sz) => `
      <button type="button" class="rows-btn ${pageSize === sz ? 'active' : ''}" data-action="set-page-size" data-symbol="${escapeHtml(a.symbol)}" data-size="${sz}">${sz === 'ALL' ? escapeHtml(t('table.all')) : sz}</button>
    `).join('');

    const tableToolbar = `
      <div class="table-toolbar">
        <button type="button" class="btn btn-sm btn-quiet" data-action="toggle-sort" data-symbol="${escapeHtml(a.symbol)}">
          <i class="fa-solid ${sortDir === 'desc' ? 'fa-arrow-down-wide-short' : 'fa-arrow-up-wide-short'}"></i>
          ${escapeHtml(sortDir === 'desc' ? t('table.newest') : t('table.oldest'))}
        </button>
        <div class="rows-per-page" role="group" aria-label="Jumlah baris">
          <span class="rows-label">${escapeHtml(t('table.show'))}</span>
          ${rowsPerPageHtml}
        </div>
      </div>`;

    const shown = visible.length;
    const total = entries.length;
    const caption = `<p class="hint table-caption">${escapeHtml(t('table.caption', { shown, total }))}</p>`;

    tableHtml = `
      ${tableToolbar}
      <div class="table-wrap">
        <table>
          <thead><tr><th>${escapeHtml(t('table.date'))}</th><th>${escapeHtml(t('table.price'))}</th><th>${escapeHtml(t('table.qty'))}</th><th>${escapeHtml(t('table.total'))}</th><th>${escapeHtml(t('table.unrealized'))}</th><th>${escapeHtml(t('table.pct'))}</th><th>${escapeHtml(t('table.actions'))}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${caption}`;
  }

  const cur = currencySymbol();
  const isIdr = cur === 'Rp';
  const pricePh = isIdr ? t('form.pricePhIdr') : t('form.pricePh');
  const totalStep = isIdr ? '1' : '0.01';
  // Terbuka secara default (supaya tombol "Tambah Pembelian" selalu langsung
  // terlihat di semua instrumen) — hanya tertutup kalau user sendiri yang
  // pernah menutupnya lewat klik header.
  const formOpen = state.txFormOpen[a.symbol] !== false;

  $('tab-content').innerHTML = `
    <div class="panel">
      <div class="panel-head tx-form-toggle" data-action="toggle-tx-form" data-symbol="${escapeHtml(a.symbol)}" role="button" tabindex="0">
        <div>
          <p class="eyebrow">${escapeHtml(t('form.eyebrow'))}</p>
          <h2 class="panel-title">${escapeHtml(a.name)}</h2>
        </div>
        <i class="fa-solid fa-chevron-down tx-form-chevron ${formOpen ? 'open' : ''}"></i>
      </div>
      <div class="tx-form-body ${formOpen ? '' : 'collapsed'}">
        <div class="field-grid four">
          <label class="field"><span>${escapeHtml(t('form.date'))}</span><input type="date" id="f-tanggal" value="${todayISO()}"></label>
          <label class="field"><span>${escapeHtml(t('form.price', { unit: a.unit, cur }))}</span><input type="number" id="f-harga" placeholder="${escapeHtml(pricePh)}" min="0" step="${totalStep}" inputmode="decimal"></label>
          <label class="field"><span>${escapeHtml(t('form.qty'))}</span><input type="number" id="f-unit" placeholder="${escapeHtml(t('form.qtyPh'))}" min="0" step="any" inputmode="decimal"></label>
          <label class="field"><span>${escapeHtml(t('form.total', { cur }))}</span><input type="number" id="f-total" placeholder="${escapeHtml(t('form.totalPh'))}" min="0" step="${totalStep}" inputmode="decimal"></label>
        </div>
        <div class="btn-row">
          <button type="button" class="btn btn-primary" data-action="save-entry" data-symbol="${escapeHtml(a.symbol)}">${escapeHtml(t('form.add'))}</button>
          ${canDeleteInstrument(a) ? `<button type="button" class="btn btn-danger" data-action="remove-asset" data-symbol="${escapeHtml(a.symbol)}"><i class="fa fa-trash"></i> ${escapeHtml(t('form.removeInstrument'))}</button>` : ''}
        </div>
      </div>
    </div>
    ${summaryHtml}
    <div class="panel">${tableHtml}</div>`;

  renderStatement();
}

// ---------- KALENDER PEMANTAUAN INVESTASI BULANAN ----------
const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const CAL_COL_WIDTH = 30; // px per kolom instrumen — kotak dibuat kecil ala GitHub, bukan melebar penuh

export function renderInvestmentCalendar() {
  const wrap = $('investment-calendar');
  if (!wrap) return;
  const year = state.calendarYear || new Date().getFullYear();
  const yearInput = $('cal-year-label');
  // Jangan timpa nilai kalau elemen sedang difokus (user sedang mengetik tahun).
  if (yearInput && document.activeElement !== yearInput) yearInput.value = String(year);

  const symbols = allSymbols();
  if (symbols.length === 0) {
    wrap.innerHTML = `<div class="empty"><i class="fa-regular fa-calendar"></i>${escapeHtml(t('cal.empty'))}</div>`;
    return;
  }

  const headCells = symbols.map((s) => {
    const color = colorForAsset(s);
    return `<div class="cal-col-head" style="color:${color}">${escapeHtml(s)}</div>`;
  }).join('');

  const rows = MONTH_KEYS.map((mk, idx) => {
    const monthPrefix = `${year}-${String(idx + 1).padStart(2, '0')}`;
    const cells = symbols.map((s) => {
      const count = entriesOf(s).filter((e) => String(e.tanggal || '').startsWith(monthPrefix)).length;
      const cls = count === 0 ? 'none' : count === 1 ? 'once' : 'twice';
      const title = `${s} — ${t('cal.' + mk)} ${year}: ${count}× ${t('cal.txSuffix')}`;
      return `<div class="cal-cell cal-${cls}" title="${escapeHtml(title)}"><span class="sr-only">${count}</span></div>`;
    }).join('');
    return `
      <div class="cal-row">
        <div class="cal-row-label">${escapeHtml(t('cal.' + mk)).toUpperCase()}</div>
        <div class="cal-row-cells" style="grid-template-columns:repeat(${symbols.length},${CAL_COL_WIDTH}px)">${cells}</div>
      </div>`;
  }).join('');

  wrap.innerHTML = `
    <div class="cal-table">
      <div class="cal-row cal-head-row">
        <div class="cal-row-label"></div>
        <div class="cal-row-cells" style="grid-template-columns:repeat(${symbols.length},${CAL_COL_WIDTH}px)">${headCells}</div>
      </div>
      ${rows}
    </div>
    <div class="cal-legend">
      <span><i class="cal-swatch cal-none"></i>${escapeHtml(t('cal.legendNone'))}</span>
      <span><i class="cal-swatch cal-once"></i>${escapeHtml(t('cal.legendOnce'))}</span>
      <span><i class="cal-swatch cal-twice"></i>${escapeHtml(t('cal.legendTwice'))}</span>
    </div>`;
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
  renderInvestmentCalendar();
}

export function setLoading(msg) {
  $('tab-content').innerHTML = `<div class="panel"><div class="empty"><i class="fa-solid fa-circle-notch fa-spin"></i>${escapeHtml(msg)}</div></div>`;
}
