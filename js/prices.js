// ============================================================
//  PRICES — market price inputs + realtime fetch
//  Prices live only in the inputs (mirrored to localStorage
//  for this browser session). No price history is stored.
// ============================================================

import { PRICES } from './firebase-config.js?v=13';
import { state } from './state.js?v=13';
import { safeId, toDisplayCurrency, toUSDFromDisplay } from './utils.js?v=13';

// Harga kanonik selalu disimpan dalam USD di sini, terlepas dari mata uang
// tampilan yang sedang aktif. Input di layar hanyalah representasi (USD atau
// IDR) dari nilai kanonik ini — konversi terjadi di titik baca/tulis.
const priceCacheUSD = {};

function priceKey(symbol) {
  const uid = state.user?.uid || 'guest';
  return `meridian-price-${uid}-${symbol}`;
}

/** String mentah tersimpan (selalu USD kanonik). */
export function getSavedPrice(symbol) {
  try {
    // Harga yang sempat tersimpan sebelum login (key "guest") ikut dipakai
    // supaya nilai tidak hilang tepat setelah sesi login aktif.
    return localStorage.getItem(priceKey(symbol))
      || localStorage.getItem(`meridian-price-guest-${symbol}`)
      || '';
  } catch { return ''; }
}

/** Angka USD kanonik tersimpan (null kalau kosong/tidak valid). */
export function getSavedPriceUSD(symbol) {
  const raw = parseFloat(getSavedPrice(symbol));
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

export function savePriceInput(symbol, value) {
  try { localStorage.setItem(priceKey(symbol), value || ''); } catch {}
}

export function savePriceInputs() {
  state.assets.forEach((a) => {
    const el = document.getElementById('price-' + safeId(a.symbol));
    if (el) {
      const usd = toUSDFromDisplay(parseFloat(el.value));
      setPriceUSD(a.symbol, usd);
      savePriceInput(a.symbol, Number.isFinite(usd) && usd > 0 ? String(usd) : '');
    }
  });
}

/** Simpan/lupakan harga kanonik (USD) di cache dalam-memori untuk simbol ini. */
export function setPriceUSD(symbol, usdValue) {
  const n = Number(usdValue);
  if (Number.isFinite(n) && n > 0) priceCacheUSD[symbol] = n;
  else delete priceCacheUSD[symbol];
}

/** Harga USD kanonik untuk sebuah simbol (dipakai semua perhitungan portofolio). */
export function getPrice(symbol) {
  const v = priceCacheUSD[symbol];
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** Angka yang seharusnya tampil di kotak input, sesuai mata uang aktif saat ini. */
export function displayPriceValue(symbol) {
  const usd = getPrice(symbol);
  if (usd === null) return '';
  const shown = toDisplayCurrency(usd);
  return state.currency === 'IDR' ? String(Math.round(shown)) : String(Number(shown.toFixed(shown >= 1000 ? 2 : 4)));
}

/** Tulis satu harga (selalu dalam USD, mis. dari fetch realtime) ke cache + input. Return true kalau berhasil. */
export function applyPrice(symbol, price) {
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return false;
  setPriceUSD(symbol, n);
  savePriceInput(symbol, String(n));
  const el = document.getElementById('price-' + safeId(symbol));
  if (el) el.value = displayPriceValue(symbol);
  return true;
}

/**
 * Fetch realtime prices via the configured proxy endpoint.
 * Returns { filled, prices, at } and writes values straight into the inputs.
 */
export async function fetchMarketPrices() {
  const targets = state.assets.filter((a) => a.yahoo);
  if (!targets.length) throw new Error('NO_TICKERS');

  const symbols = targets
    .map((a) => `${encodeURIComponent(a.symbol)}:${encodeURIComponent(a.yahoo)}`)
    .join(',');
  const url = `${PRICES.url}?symbols=${symbols}&force=true`;

  const res = await fetch(url, { headers: PRICES.headers });
  if (!res.ok) {
    const text = await res.text().catch(() => String(res.status));
    throw new Error(`Endpoint error ${res.status}: ${text}`);
  }
  const json = await res.json();
  if (!json.success && json.prices === undefined) throw new Error(json.error || 'Gagal ambil harga pasar');

  // Endpoint bisa mengembalikan key berupa kode aset ATAU ticker Yahoo.
  // Peta di bawah menerima keduanya, jadi harga tidak "hilang" hanya karena
  // formatnya berbeda.
  const lookup = new Map();
  targets.forEach((a) => {
    lookup.set(String(a.symbol).toUpperCase(), a.symbol);
    if (a.yahoo) lookup.set(String(a.yahoo).toUpperCase(), a.symbol);
  });

  let filled = 0;
  const appliedPrices = {};
  Object.entries(json.prices || {}).forEach(([key, price]) => {
    const symbol = lookup.get(String(key).toUpperCase()) || key;
    if (applyPrice(symbol, price)) {
      appliedPrices[symbol] = Number(price);
      filled++;
    }
  });

  return { filled, prices: appliedPrices, at: json.updated_at || json.fetched_at || new Date().toISOString() };
}
