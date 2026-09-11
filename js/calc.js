// ============================================================
//  CALC — portfolio math
// ============================================================

import { state, allSymbols, entriesOf } from './state.js?v=10';
import { getPrice } from './prices.js?v=10';

/** Angka aman: apa pun yang bukan angka valid dianggap 0 (bukan NaN menular). */
export function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Aggregate figures for a single asset. */
export function calcAsset(symbol) {
  const cp = getPrice(symbol);
  const entries = entriesOf(symbol);
  let totalCost = 0, totalUnits = 0;
  entries.forEach((e) => { totalCost += num(e.totalBeli); totalUnits += num(e.jumlahUnit); });

  const avgPrice = totalUnits > 0 ? totalCost / totalUnits : 0;
  const currentVal = cp !== null ? totalUnits * cp : null;
  const gain = currentVal !== null ? currentVal - totalCost : null;
  const pct = gain !== null && totalCost > 0 ? (gain / totalCost) * 100 : null;
  return { symbol, price: cp, totalCost, totalUnits, avgPrice, currentVal, gain, pct, txCount: entries.length };
}

/**
 * Totals across all assets.
 *
 * Aset yang harganya belum diisi TIDAK lagi bikin "Nilai Sekarang" pincang:
 * nilainya dihitung memakai harga pokok (cost basis) supaya Total Investasi,
 * Nilai Sekarang, dan Unrealized selalu konsisten satu sama lain.
 * Simbol yang harganya kosong dilaporkan lewat `missing`.
 */
export function calcTotals() {
  let totalInvest = 0, totalNow = 0, txCount = 0, priced = 0;
  const missing = [];

  allSymbols().forEach((symbol) => {
    const c = calcAsset(symbol);
    totalInvest += c.totalCost;
    txCount += c.txCount;
    if (c.currentVal !== null) {
      totalNow += c.currentVal;
      if (c.totalUnits > 0) priced++;
    } else {
      totalNow += c.totalCost; // fallback: pakai harga pokok
      if (c.totalUnits > 0) missing.push(symbol);
    }
  });

  const hasPrice = priced > 0;
  const gain = hasPrice ? totalNow - totalInvest : null;
  const pct = hasPrice && totalInvest > 0 ? (gain / totalInvest) * 100 : null;
  return {
    totalInvest,
    totalNow: hasPrice ? totalNow : null,
    gain, pct, txCount, hasPrice, missing,
  };
}
