// ============================================================
//  CLOCK — jam pasar (WITA / LSE / NYSE) + kurs USD→IDR
//  Kurs dipakai untuk mode tampilan IDR. Data harga tetap USD.
//  Catatan: indikator buka/tutup hanya memakai jam & hari kerja —
//  hari libur bursa tidak diperhitungkan.
//
//  Strip ini berubah jadi MARQUEE otomatis ketika kartunya tidak
//  muat (mis. di layar HP): isinya diduplikasi lalu digeser terus
//  ke kiri. Tap sekali untuk berhenti, tap lagi untuk jalan lagi.
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

// Semua pembaruan teks memakai querySelectorAll, bukan getElementById,
// supaya salinan marquee ikut ter-update (dan tidak ada id ganda).
const all = (sel) => document.querySelectorAll(sel);

// ---------- helper zona waktu ----------
function zonedParts(date, tz) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return { weekday: map.weekday, minutes: Number(map.hour) * 60 + Number(map.minute) };
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
    const label = t(m.key);
    all(`[data-clock-label="${m.id}"]`).forEach((el) => { el.textContent = label; });
    const time = `${timeIn(m.tz, now)} · ${dateIn(m.tz, now)}`;
    all(`[data-clock-time="${m.id}"]`).forEach((el) => { el.textContent = time; });

    const open = isMarketOpen(m, now);
    const title = open ? t('market.open') : t('market.closed');
    all(`[data-clock-dot="${m.id}"]`).forEach((el) => {
      el.classList.toggle('open', open);
      el.title = title;
    });
  });
}

let clockTimer = null;
export function initClocks() {
  renderClocks();
  clearInterval(clockTimer);
  clockTimer = setInterval(renderClocks, 1000);
  // Ukur setelah font selesai dimuat — lebar teks bisa berubah sesudahnya.
  scheduleMarquee();
  document.fonts?.ready?.then(scheduleMarquee).catch(() => {});
}

// ============================================================
//  MARQUEE
// ============================================================
const SPEED_PX_PER_SEC = 42;   // kecepatan geser; makin besar makin cepat
let marqueeOn = false;
let marqueePaused = false;
let marqueeTimer = null;
let lastRoom = -1;      // lebar strip saat pengukuran terakhir

function stripEls() {
  const strip = document.getElementById('market-strip');
  return { strip, track: strip?.querySelector('.market-track') };
}

/** Ukur ulang: aktifkan marquee kalau kartunya tidak muat, matikan kalau muat. */
export function refreshMarquee() {
  const { strip, track } = stripEls();
  if (!strip || !track) return;

  const original = track.querySelector('.market-set');
  if (!original) return;

  // Ukur dalam kondisi statis: buang salinan lama & matikan animasi dulu.
  strip.classList.remove('is-marquee', 'is-paused');
  track.querySelectorAll('.market-set[data-clone]').forEach((el) => el.remove());

  const setWidth = original.getBoundingClientRect().width;
  const room = strip.clientWidth;
  lastRoom = room;
  if (!setWidth || !room || setWidth <= room + 1) {
    marqueeOn = false;
    strip.style.removeProperty('--marquee-shift');
    strip.style.removeProperty('--marquee-dur');
    return;
  }

  // Tidak muat → duplikat satu set supaya loop-nya mulus.
  const gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 8;
  const clone = original.cloneNode(true);
  clone.dataset.clone = '1';
  clone.setAttribute('aria-hidden', 'true');
  track.appendChild(clone);

  const shift = setWidth + gap;
  strip.style.setProperty('--marquee-shift', `${shift}px`);
  strip.style.setProperty('--marquee-dur', `${Math.max(10, shift / SPEED_PX_PER_SEC)}s`);
  strip.classList.add('is-marquee');
  if (marqueePaused) strip.classList.add('is-paused');
  marqueeOn = true;
}

function scheduleMarquee() {
  clearTimeout(marqueeTimer);
  marqueeTimer = setTimeout(refreshMarquee, 120);
}

/**
 * Versi untuk ResizeObserver. refreshMarquee() menambah/membuang salinan di
 * dalam strip, yang bisa memicu observer lagi — tanpa penjaga ini keduanya
 * bisa saling memanggil tanpa henti. Ukur ulang hanya kalau lebarnya berubah.
 */
function onStripResize() {
  const { strip } = stripEls();
  if (!strip || strip.clientWidth === lastRoom) return;
  scheduleMarquee();
}

function setPaused(paused) {
  const { strip } = stripEls();
  marqueePaused = paused;
  strip?.classList.toggle('is-paused', paused);
}

/**
 * Pasang interaksi strip.
 * - Marquee jalan  → tap di mana pun = berhenti.
 * - Marquee jeda   → tap kartu kurs = perbarui kurs, tap lainnya = jalan lagi.
 * - Marquee mati   → kartu kurs berfungsi seperti tombol biasa.
 */
export function initMarketStrip({ onRateRefresh } = {}) {
  const { strip } = stripEls();
  if (!strip) return;

  strip.addEventListener('click', (e) => {
    const onRate = !!e.target.closest('[data-rate-chip]');

    if (!marqueeOn) { if (onRate) onRateRefresh?.(); return; }

    if (!marqueePaused) { setPaused(true); return; }   // tap pertama: berhenti
    if (onRate) { onRateRefresh?.(); return; }         // sudah berhenti: tombol aktif
    setPaused(false);                                  // tap lagi: jalan
  });

  // Ukur ulang saat ukuran berubah.
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(onStripResize).observe(strip);
  }
  window.addEventListener('resize', scheduleMarquee);
  window.addEventListener('orientationchange', scheduleMarquee);
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
  const valueEls = all('[data-rate-value]');
  const subEls = all('[data-rate-sub]');
  if (!valueEls.length) return;

  const value = state.rate
    ? `1 USD = Rp ${Math.round(state.rate).toLocaleString('id-ID')}`
    : '1 USD = Rp —';
  const sub = state.rate
    ? `${t('market.rateUpdate')}: ${formatDateTimeWITA(state.rateAt) || '—'}`
    : t('market.rateLoading');

  valueEls.forEach((el) => { el.textContent = value; });
  subEls.forEach((el) => { el.textContent = sub; });
  all('[data-rate-chip]').forEach((el) => { el.title = t('market.rateRefresh'); });

  scheduleMarquee(); // lebar teks berubah → ukur ulang
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
  all('[data-rate-sub]').forEach((el) => { el.textContent = t('market.rateFail'); });
  scheduleMarquee();
  onDone?.(false);
  return null;
}
