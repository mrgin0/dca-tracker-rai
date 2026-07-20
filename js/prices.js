// ============================================================
//  PRICES — market price inputs + realtime fetch
//  Prices live only in the inputs (mirrored to localStorage
//  for this browser session). No price history is stored.
// ============================================================

import { PRICES } from './firebase-config.js';
import { state } from './state.js';
import { safeId } from './utils.js';

function priceKey(symbol) {
  const uid = state.user?.uid || 'guest';
  return `meridian-price-${uid}-${symbol}`;
}

export function getSavedPrice(symbol) {
  try { return localStorage.getItem(priceKey(symbol)) || ''; } catch { return ''; }
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
  const v = parseFloat(document.getElementById('price-' + safeId(symbol))?.value);
  return isNaN(v) || v <= 0 ? null : v;
}

/**
 * Fetch realtime prices via the configured proxy endpoint.
 * Returns { filled, at } and writes values straight into the inputs.
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
  if (!json.success) throw new Error(json.error || 'Gagal ambil harga pasar');

  let filled = 0;
  Object.entries(json.prices || {}).forEach(([symbol, price]) => {
    const el = document.getElementById('price-' + safeId(symbol));
    if (el && price !== null && price !== undefined) {
      el.value = Number(price).toFixed(symbol === 'BTC' ? 2 : 4);
      savePriceInput(symbol, el.value);
      filled++;
    }
  });

  return { filled, at: json.updated_at || json.fetched_at || new Date().toISOString() };
}
