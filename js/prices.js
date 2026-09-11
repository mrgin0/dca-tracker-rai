// ============================================================
//  PRICES — market price inputs + realtime fetch
//  Prices live only in the inputs (mirrored to localStorage
//  for this browser session). No price history is stored.
// ============================================================

import { PRICES } from './firebase-config.js?v=10';
import { state } from './state.js?v=10';
import { safeId } from './utils.js?v=10';

function priceKey(symbol) {
  const uid = state.user?.uid || 'guest';
  return `meridian-price-${uid}-${symbol}`;
}

export function getSavedPrice(symbol) {
  try {
    // Harga yang sempat tersimpan sebelum login (key "guest") ikut dipakai
    // supaya nilai tidak hilang tepat setelah sesi login aktif.
    return localStorage.getItem(priceKey(symbol))
      || localStorage.getItem(`meridian-price-guest-${symbol}`)
      || '';
  } catch { return ''; }
}

export function savePriceInput(symbol, value) {
  try { localStorage.setItem(priceKey(symbol), value || ''); } catch {}
}

export function savePriceInputs() {
  state.assets.forEach((a) => {
    const el = document.getElementById('price-' + safeId(a.symbol));
    if (el) savePriceInput(a.symbol, el.value);
  });
}

/** Current price for a symbol, read from its input. Returns null if empty/invalid. */
export function getPrice(symbol) {
  const el = document.getElementById('price-' + safeId(symbol));
  if (!el) return null;
  const v = parseFloat(el.value);
  return !Number.isFinite(v) || v <= 0 ? null : v;
}

/** Tulis satu harga ke input + localStorage. Return true kalau berhasil. */
export function applyPrice(symbol, price) {
  const el = document.getElementById('price-' + safeId(symbol));
  if (!el) return false;
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return false;
  const val = n.toFixed(n >= 1000 ? 2 : 4);
  el.value = val;
  savePriceInput(symbol, val);
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
