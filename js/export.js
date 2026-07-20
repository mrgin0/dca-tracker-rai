// ============================================================
//  EXPORT — transactions + allocation to .xlsx
// ============================================================

import { state } from './state.js?v=3';
import { getPrice } from './prices.js?v=3';
import { calcAsset } from './calc.js?v=3';
import { showAlert } from './utils.js?v=3';

export function exportXLSX() {
  const rows = [];
  state.assets.forEach((a) => (state.data[a.symbol] || []).forEach((e) => {
    const cp = getPrice(a.symbol);
    const nilai = cp ? e.jumlahUnit * cp : null;
    const gain = nilai !== null ? nilai - e.totalBeli : null;
    const pct = gain !== null && e.totalBeli > 0 ? (gain / e.totalBeli) * 100 : null;
    rows.push({
      Asset: a.symbol, Nama: a.name, Tanggal: e.tanggal,
      'Harga Beli USD': e.hargaBeli, 'Jumlah Unit': e.jumlahUnit, 'Total Beli USD': e.totalBeli,
      'Harga Pasar USD': cp || '', 'Nilai Sekarang USD': nilai || '',
      'Unrealized Gain USD': gain || '', 'Unrealized %': pct || '',
    });
  }));

  if (!rows.length) { showAlert('Belum ada transaksi untuk diekspor.'); return; }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Transactions');

  const alloc = state.assets
    .map((a) => ({ Asset: a.symbol, Nama: a.name, 'Total Investasi USD': calcAsset(a.symbol).totalCost }))
    .filter((r) => r['Total Investasi USD'] > 0);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(alloc), 'Allocation');

  XLSX.writeFile(wb, 'meridian-portfolio.xlsx');
}
