// ============================================================
//  CLOCK — jam pasar (WITA / LSE / NYSE) + kurs USD→IDR
//  Kurs dipakai untuk mode tampilan IDR. Data harga tetap USD.
// ============================================================

import { state, saveRate, restoreRate } from './state.js?v=10';
import { t, locale } from './i18n.js?v=10';
import { formatDateTimeWITA } from './utils.js?v=10';

const MARKETS = [
  // `tz` = zona yang DITAMPILKAN, `tzHours` = zona untuk hitung jam buka bursa.
  { id: 'wita', key: 'market.wita', cc: 'ID', tz: 'Asia/Makassar', tzHours: 'Asia/Jakarta', open: 9 * 60, close: 16 * 60 },
  { id: 'lse', key: 'market.lse', cc: 'GB', tz: 'Europe/London', open: 8 * 60, close: 16 * 60 + 30 },
  { id: 'nyse', key: 'market.nyse', cc: 'US', tz: 'America/New_York', open: 9 * 60 + 30, close: 16 * 60 },
];

// ---------- helper zona waktu ----------
function zonedParts(date, tz) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    weekday: map.weekday,
    minutes: Number(map.hour) * 60 + Number(map.minute),
  };
}

function isMarketOpen(m, now) {
  const { weekday, minutes } = zonedParts(now, m.tzHours || m.tz);
  if (weekday === 'Sat' || weekday === 'Sun') return false;
  return minutes >= m.open && minutes < m.close;
}

function timeIn(tz, now) {
  return now.toLocaleTimeString(locale(), { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
}
function dateIn(tz, now) {
  return now.toLocaleDateString(locale(), { timeZone: tz, day: '2-digit', month: 'short', year: 'numeric' });
}

// ---------- render jam ----------
export function renderClocks() {
  const now = new Date();
  MARKETS.forEach((m) => {
    const labelEl = document.getElementById(`clock-label-${m.id}`);
    const timeEl = document.getElementById(`clock-time-${m.id}`);
    const dotEl = document.getElementById(`clock-dot-${m.id}`);
    if (labelEl) labelEl.textContent = t(m.key);
    if (timeEl) timeEl.textContent = `${timeIn(m.tz, now)} · ${dateIn(m.tz, now)}`;
    if (dotEl) {
      const open = isMarketOpen(m, now);
      dotEl.classList.toggle('open', open);
      dotEl.title = open ? t('market.open') : t('market.closed');
    }
  });
}

let clockTimer = null;
export function initClocks() {
  renderClocks();
  clearInterval(clockTimer);
  clockTimer = setInterval(renderClocks, 1000);
}

// ---------- kurs USD → IDR ----------
const RATE_TTL_MS = 30 * 60 * 1000; // 30 menit

const RATE_SOURCES = [
  {
    url: 'https://open.er-api.com/v6/latest/USD',
    parse: (j) => ({ rate: Number(j?.rates?.IDR), at: j?.time_last_update_utc ? new Date(j.time_last_update_utc).toISOString() : null }),
  },
  {
    url: 'https://api.frankfurter.app/latest?from=USD&to=IDR',
    parse: (j) => ({ rate: Number(j?.rates?.IDR), at: j?.date ? new Date(j.date + 'T00:00:00Z').toISOString() : null }),
  },
];

export function renderRateChip() {
  const valEl = document.getElementById('rate-value');
  const subEl = document.getElementById('rate-sub');
  const chip = document.getElementById('rate-chip');
  if (!valEl || !subEl) return;

  if (state.rate) {
    valEl.textContent = `1 USD = Rp ${Math.round(state.rate).toLocaleString('id-ID')}`;
    subEl.textContent = `${t('market.rateUpdate')}: ${formatDateTimeWITA(state.rateAt) || '—'}`;
    if (chip) chip.title = t('market.rateRefresh');
  } else {
    valEl.textContent = '1 USD = Rp —';
    subEl.textContent = t('market.rateLoading');
    if (chip) chip.title = t('market.rateRefresh');
  }
}

/**
 * Ambil kurs USD→IDR. Hasil disimpan di localStorage supaya tidak menembak
 * endpoint tiap render. `force` melewati cache.
 */
export async function loadRate({ force = false, onDone } = {}) {
  if (!force) {
    const cached = restoreRate();
    if (cached && Date.now() - cached.savedAt < RATE_TTL_MS) {
      state.rate = cached.rate;
      state.rateAt = cached.at;
      renderRateChip();
      onDone?.(true);
      return state.rate;
    }
  }

  for (const src of RATE_SOURCES) {
    try {
      const res = await fetch(src.url);
      if (!res.ok) continue;
      const { rate, at } = src.parse(await res.json());
      if (Number.isFinite(rate) && rate > 0) {
        state.rate = rate;
        state.rateAt = at || new Date().toISOString();
        saveRate();
        renderRateChip();
        onDone?.(true);
        return rate;
      }
    } catch (e) {
      console.warn('kurs gagal dari', src.url, e.message);
    }
  }

  // Semua sumber gagal — pakai cache lama kalau ada, walau kedaluwarsa.
  const stale = restoreRate();
  if (stale) {
    state.rate = stale.rate;
    state.rateAt = stale.at;
    renderRateChip();
    onDone?.(true);
    return state.rate;
  }
  const subEl = document.getElementById('rate-sub');
  if (subEl) subEl.textContent = t('market.rateFail');
  onDone?.(false);
  return null;
}
