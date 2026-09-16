// ============================================================
//  INVESTMENT CALENDAR — frekuensi pembelian per bulan / aset
// ============================================================

import { state, entriesOf } from './state.js?v=10';
import { t } from './i18n.js?v=10';
import { escapeHtml } from './utils.js?v=10';

const $ = (id) => document.getElementById(id);

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const currentYear = new Date().getFullYear();
if (!Number.isInteger(state.calendarYear)) state.calendarYear = currentYear;

function monthName(index) {
  return (state.lang === 'en' ? MONTHS_EN : MONTHS_ID)[index];
}

function countsForYear(year) {
  const counts = {};
  state.assets.forEach((asset) => {
    counts[asset.symbol] = Array(12).fill(0);
    entriesOf(asset.symbol).forEach((tx) => {
      const date = String(tx.tanggal || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      const y = Number(date.slice(0, 4));
      const m = Number(date.slice(5, 7)) - 1;
      if (y === year && m >= 0 && m < 12) counts[asset.symbol][m]++;
    });
  });
  return counts;
}

function renderCell(count, symbol, monthIndex, year) {
  const status = count >= 2 ? 'multi' : count === 1 ? 'invested' : 'empty';
  const label = count >= 2
    ? t('calendar.multi')
    : count === 1
      ? t('calendar.invested')
      : t('calendar.notInvested');
  return `<span class="calendar-cell ${status}" title="${escapeHtml(`${symbol} · ${monthName(monthIndex)} ${year}: ${count} ${count === 1 ? 'transaksi' : 'transaksi'}`)}" aria-label="${escapeHtml(`${symbol} · ${monthName(monthIndex)} ${year}: ${label}`)}"></span>`;
}

export function renderCalendar() {
  const root = $('investment-calendar');
  if (!root) return;

  const year = Number.isInteger(state.calendarYear) ? state.calendarYear : currentYear;
  const assets = state.assets || [];
  const counts = countsForYear(year);

  const assetHeaders = assets.map((a) =>
    `<span class="calendar-asset" title="${escapeHtml(a.name || a.symbol)}">${escapeHtml(a.symbol)}</span>`
  ).join('');

  const rows = MONTHS_ID.map((_, monthIndex) => `
    <div class="calendar-month">${escapeHtml(monthName(monthIndex))}</div>
    ${assets.map((a) => renderCell(counts[a.symbol]?.[monthIndex] || 0, a.symbol, monthIndex, year)).join('')}
  `).join('');

  root.innerHTML = `
    <section class="panel investment-calendar-panel">
      <div class="calendar-head">
        <div>
          <p class="eyebrow">${escapeHtml(t('calendar.eyebrow'))}</p>
          <h2 class="panel-title">${escapeHtml(t('calendar.title'))}</h2>
          <p class="calendar-hint">${escapeHtml(t('calendar.hint'))}</p>
        </div>
        <div class="calendar-year-nav" aria-label="${escapeHtml(t('calendar.yearNav'))}">
          <button type="button" class="calendar-nav-btn" data-action="calendar-prev" aria-label="${escapeHtml(t('calendar.previous'))}"><i class="fa-solid fa-chevron-left"></i></button>
          <span class="calendar-year">${year}</span>
          <button type="button" class="calendar-nav-btn" data-action="calendar-next" aria-label="${escapeHtml(t('calendar.next'))}"><i class="fa-solid fa-chevron-right"></i></button>
        </div>
      </div>

      <div class="calendar-scroll">
        <div class="calendar-grid" style="--calendar-assets:${Math.max(assets.length, 1)}">
          <div class="calendar-corner"></div>
          ${assetHeaders}
          ${rows}
        </div>
      </div>

      <div class="calendar-legend">
        <span><i class="calendar-cell empty"></i>${escapeHtml(t('calendar.notInvested'))}</span>
        <span><i class="calendar-cell invested"></i>${escapeHtml(t('calendar.invested'))}</span>
        <span><i class="calendar-cell multi"></i>${escapeHtml(t('calendar.multi'))}</span>
      </div>
    </section>`;
}

export function shiftCalendarYear(delta) {
  const base = Number.isInteger(state.calendarYear) ? state.calendarYear : currentYear;
  state.calendarYear = base + delta;
  renderCalendar();
}
