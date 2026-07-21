// ============================================================
//  EXPORT — transactions + allocation to .xlsx
// ============================================================

import { state, allSymbols, entriesOf, assetOf } from './state.js?v=10';
import { getPrice } from './prices.js?v=10';
import { calcAsset, num } from './calc.js?v=10';
import { showAlert, todayISO } from './utils.js?v=10';

export function exportXLSX() {
  const rows = [];
  allSymbols().forEach((symbol) => {
    const a = state.assets.find((x) => x.symbol === symbol);
    const cp = getPrice(symbol);
    entriesOf(symbol).forEach((e) => {
      const units = num(e.jumlahUnit);
      const cost = num(e.totalBeli);
      const nilai = cp !== null ? units * cp : null;
      const gain = nilai !== null ? nilai - cost : null;
      const pct = gain !== null && cost > 0 ? (gain / cost) * 100 : null;
      rows.push({
        Asset: symbol,
        Nama: a?.name || symbol,
        Tanggal: e.tanggal || '',
        'Harga Beli USD': num(e.hargaBeli),
        'Jumlah Unit': units,
        'Total Beli USD': cost,
        // `?? ''` (bukan `|| ''`) supaya angka 0 tidak berubah jadi kosong.
        'Harga Pasar USD': cp ?? '',
        'Nilai Sekarang USD': nilai ?? '',
        'Unrealized Gain USD': gain ?? '',
        'Unrealized %': pct ?? '',
      });
    });
  });

  if (!rows.length) { showAlert('Belum ada transaksi untuk diekspor.'); return; }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Transactions');

  const alloc = allSymbols()
    .map((symbol) => {
      const c = calcAsset(symbol);
      return {
        Asset: symbol,
        Nama: state.assets.find((x) => x.symbol === symbol)?.name || symbol,
        'Total Unit': c.totalUnits,
        'Total Investasi USD': c.totalCost,
        'Nilai Sekarang USD': c.currentVal ?? '',
        'Unrealized USD': c.gain ?? '',
      };
    })
    .filter((r) => r['Total Investasi USD'] > 0);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(alloc), 'Allocation');

  XLSX.writeFile(wb, 'meridian-portfolio.xlsx');
}

/** Backup seluruh data (instrumen, transaksi, branding) sebagai satu file JSON. */
export function exportBackupJSON() {
  const hasAnyTx = allSymbols().some((s) => entriesOf(s).length > 0);
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
