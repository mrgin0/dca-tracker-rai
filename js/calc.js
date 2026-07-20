// ============================================================
//  CALC — portfolio math
// ============================================================

import { state } from './state.js?v=3';
import { getPrice } from './prices.js?v=3';

/** Aggregate figures for a single asset. */
export function calcAsset(symbol) {
  const cp = getPrice(symbol);
  const entries = state.data[symbol] || [];
  let totalCost = 0, totalUnits = 0;
  entries.forEach((e) => { totalCost += e.totalBeli; totalUnits += e.jumlahUnit; });

  const avgPrice = totalUnits > 0 ? totalCost / totalUnits : 0;
  const currentVal = cp ? totalUnits * cp : null;
  const gain = currentVal !== null ? currentVal - totalCost : null;
  const pct = gain !== null && totalCost > 0 ? (gain / totalCost) * 100 : null;
  return { totalCost, totalUnits, avgPrice, currentVal, gain, pct };
}

/** Totals across all assets. */
export function calcTotals() {
  let totalInvest = 0, totalNow = 0, txCount = 0, hasPrice = false;
  state.assets.forEach((a) => {
    const c = calcAsset(a.symbol);
    totalInvest += c.totalCost;
    txCount += (state.data[a.symbol] || []).length;
    if (c.currentVal !== null) { totalNow += c.currentVal; hasPrice = true; }
  });
  const gain = totalNow - totalInvest;
  const pct = totalInvest > 0 && hasPrice ? (gain / totalInvest) * 100 : null;
  return { totalInvest, totalNow, gain, pct, txCount, hasPrice };
}
