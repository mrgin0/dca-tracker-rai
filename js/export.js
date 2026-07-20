// ============================================================
//  EXPORT — transactions + allocation to .xlsx
// ============================================================

import { state } from './state.js?v=5';
import { getPrice } from './prices.js?v=5';
import { calcAsset } from './calc.js?v=5';
import { showAlert, todayISO } from './utils.js?v=5';

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

/** Backup seluruh data (instrumen, transaksi, branding) sebagai satu file JSON. */
export function exportBackupJSON() {
  const hasAnyTx = state.assets.some((a) => (state.data[a.symbol] || []).length > 0);
  if (!hasAnyTx && !state.assets.some((a) => !a.isDefault)) {
    showAlert('Belum ada data untuk dibackup.');
    return;
  }

  const payload = {
    app: 'Meridian DCA Tracker',
    exportedAt: new Date().toISOString(),
    branding: state.branding || null,
    assets: state.assets.map((a) => ({
      symbol: a.symbol, name: a.name, unit: a.unit, yahoo: a.yahoo || '', isDefault: !!a.isDefault,
    })),
    transactions: state.data,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `meridian-backup-${todayISO()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
