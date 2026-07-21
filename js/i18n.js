// ============================================================
//  I18N — Bahasa Indonesia / English
//  Pemakaian di HTML:
//    data-i18n="key"        -> textContent
//    data-i18n-html="key"   -> innerHTML
//    data-i18n-ph="key"     -> placeholder
//    data-i18n-title="key"  -> title + aria-label
// ============================================================

import { state, saveLang } from './state.js?v=10';

const STRINGS = {
  id: {
    'nav.dark': 'Dark', 'nav.light': 'Light', 'nav.setting': 'Setting', 'nav.logout': 'Keluar',
    'nav.currency': 'Mata uang tampilan', 'nav.lang': 'Ganti bahasa',

    'market.wita': 'Indonesia (WITA)', 'market.lse': 'London (LSE)', 'market.nyse': 'New York (NYSE)',
    'market.open': 'Buka', 'market.closed': 'Tutup',
    'market.rateUpdate': 'Update', 'market.rateLoading': 'Memuat kurs…',
    'market.rateFail': 'Kurs gagal dimuat — klik untuk coba lagi',
    'market.rateRefresh': 'Klik untuk perbarui kurs',

    'login.title': 'Masuk ke akun', 'login.sub': 'Portofolio pribadi Anda, tersimpan aman.',
    'login.email': 'Email', 'login.password': 'Kata sandi', 'login.signin': 'Masuk',
    'login.forgot': 'Lupa password?',

    'stmt.total': 'Total Investasi', 'stmt.totalSub': 'nilai pokok',
    'stmt.now': 'Nilai Sekarang', 'stmt.nowSub': 'valuasi pasar',
    'stmt.gain': 'Unrealized Gain / Loss', 'stmt.gainSub': 'isi harga pasar',
    'stmt.tx': 'Total Transaksi', 'stmt.txSub': 'pembelian tercatat',
    'stmt.missing': 'Harga pasar {list} belum diisi — nilainya dihitung memakai harga pokok.',

    'prices.eyebrow': 'Valuasi Pasar', 'prices.title': 'Harga terkini per instrumen',
    'prices.fetch': 'Ambil Data',
    'prices.hint': 'Harga tersimpan hanya di sesi ini, tidak disimpan sebagai histori. Klik Ambil Data untuk memuat harga realtime.',
    'prices.usdOnly': 'Harga pasar selalu dalam USD; nilai portofolio ditampilkan dalam IDR memakai kurs di atas.',
    'prices.loading': 'Mengambil harga realtime…',
    'prices.updated': 'Harga diperbarui: {at}',
    'prices.noValid': 'Tidak ada harga valid dari ticker yang dipakai.',
    'prices.noTicker': 'Belum ada aset dengan ticker. Isi harga pasar manual.',
    'prices.failed': 'Ambil data gagal. Cek endpoint harga atau tunggu jika sedang rate limit.',

    'tabs.instrument': 'Instrumen',

    'form.eyebrow': 'Catat Transaksi', 'form.date': 'Tanggal pembelian',
    'form.price': 'Harga beli / {unit} ($)', 'form.qty': 'Jumlah / qty', 'form.total': 'Total beli ($)',
    'form.pricePh': 'cth: 480.50', 'form.qtyPh': 'cth: 1.5', 'form.totalPh': 'otomatis harga × qty',
    'form.add': 'Tambah Pembelian', 'form.removeInstrument': 'Hapus Instrumen',

    'metric.units': 'Total Unit', 'metric.avg': 'Avg Harga Beli', 'metric.invested': 'Total Investasi',
    'metric.now': 'Nilai Sekarang', 'metric.gain': 'Unrealized G/L',

    'table.date': 'Tanggal', 'table.price': 'Harga Beli', 'table.qty': 'Jumlah',
    'table.total': 'Total Beli', 'table.unrealized': 'Unrealized', 'table.pct': '%', 'table.actions': 'Aksi',
    'table.newest': 'Terbaru dulu', 'table.oldest': 'Terlama dulu',
    'table.show': 'Tampilkan:', 'table.all': 'Semua',
    'table.caption': 'Menampilkan {shown} dari {total} transaksi. Klik ikon pensil untuk mengubah baris.',
    'table.empty': 'Belum ada transaksi. Catat pembelian DCA pertama Anda.',
    'table.emptyGuest': 'Masuk dulu agar transaksi tersimpan.',
    'table.edit': 'Edit transaksi', 'table.delete': 'Hapus transaksi',

    'chart.eyebrow': 'Perkembangan', 'chart.title': 'Akumulasi & unrealized gain',
    'chart.invest': 'Total Investasi', 'chart.gain': 'Unrealized G/L',
    'chart.empty': 'Tambahkan transaksi & isi harga pasar untuk melihat grafik.',
    'chart.note': 'Garis <b>Unrealized G/L</b> belum bisa digambar: harga pasar {list} masih kosong.',
    'chart.resetZoom': 'Reset Zoom',
    'chart.zoomHint': 'Scroll mouse untuk zoom, drag untuk geser, atau cubit layar (pinch) di HP.',
    'chart.r1w': '1 Mgg', 'chart.r1m': '1 Bln', 'chart.r1y': '1 Thn', 'chart.r5y': '5 Thn', 'chart.r10y': '10 Thn', 'chart.rall': 'Semua',

    'pie.eyebrow': 'Komposisi', 'pie.title': 'Alokasi aset',
    'pie.hint': 'Memakai nilai pasar terkini; aset tanpa harga dihitung dari harga pokok.',
    'pie.empty': 'Belum ada data investasi.', 'pie.costFlag': 'pokok',

    'notes.eyebrow': 'Jurnal', 'notes.title': 'Catatan portofolio',
    'notes.placeholder': 'Tulis catatan: alasan beli, target, rencana rebalancing…',
    'notes.add': 'Tambah Catatan', 'notes.empty': 'Belum ada catatan. Tulis sesuatu di atas.',
    'notes.edit': 'Ubah catatan', 'notes.delete': 'Hapus catatan',
    'notes.save': 'Simpan', 'notes.cancel': 'Batal',
    'notes.created': 'Dibuat {at}', 'notes.updated': 'Diubah {at}',
    'notes.confirmDelete': 'Hapus catatan ini? Tindakan ini tidak bisa dibatalkan.',
    'notes.confirmTitle': 'Hapus catatan?',
    'notes.emptyText': 'Catatan tidak boleh kosong.',
    'notes.guest': 'Masuk dulu agar catatan tersimpan.',
    'notes.count': '{n} catatan', 'notes.count1': '1 catatan',

    'export.eyebrow': 'Arsip', 'export.title': 'Unduh catatan portofolio',
    'export.xlsx': 'Export .xlsx', 'export.json': 'Backup Data (JSON)',
    'footer.tag': 'Data pribadi Anda, tersimpan aman di Firebase.',

    'instr.title': 'Tambah Instrumen',
    'instr.sub': 'Tambahkan aset baru ke portofolio. Ticker kosong berarti harga diisi manual.',
    'instr.code': 'Kode aset', 'instr.name': 'Nama aset', 'instr.unit': 'Unit', 'instr.ticker': 'Ticker harga (opsional)',
    'instr.add': 'Tambah Instrumen',

    'edit.title': 'Ubah Transaksi',
    'edit.sub': '{name} · ubah lalu simpan. Unrealized & % dihitung ulang otomatis.',
    'edit.date': 'Tanggal pembelian', 'edit.price': 'Harga beli ($)', 'edit.qty': 'Jumlah / qty',
    'edit.total': 'Total beli ($)', 'edit.now': 'Nilai sekarang', 'edit.gain': 'Unrealized', 'edit.pct': '%',
    'edit.hint': 'Unrealized & % tidak diketik manual — keduanya dihitung dari harga pasar terkini dikali jumlah, lalu dikurangi total beli.',
    'edit.delete': 'Hapus', 'edit.save': 'Simpan Perubahan',
    'edit.noPrice': 'harga pasar kosong',
    'edit.notFound': 'Transaksi tidak ditemukan — mungkin sudah berubah. Muat ulang halaman lalu coba lagi.',
    'edit.notFoundTitle': 'Tidak bisa diubah',

    'set.title': 'Pengaturan Tampilan',
    'set.sub': 'Sesuaikan identitas family office Anda. Perubahan tersimpan ke akun.',
    'set.upload': 'Unggah logo', 'set.removeLogo': 'Hapus logo',
    'set.headTitle': 'Judul (header)', 'set.headDesc': 'Deskripsi (header)',
    'set.eyebrow': 'Label ringkasan', 'set.pageTitle': 'Judul utama', 'set.lede': 'Deskripsi utama',
    'set.save': 'Simpan',

    'common.cancel': 'Batal', 'common.ok': 'OK', 'common.confirm': 'Ya, lanjut', 'common.info': 'Info',
    'common.notLoggedIn': 'Sesi login belum aktif. Coba refresh halaman lalu login ulang.',
    'common.notLoggedInTitle': 'Belum login',
    'common.fillFields': 'Lengkapi semua field dengan angka lebih besar dari 0.',
    'common.loading': 'Memuat data dari Firebase…',
    'common.confirmDelTx': 'Hapus transaksi ini?', 'common.confirmDelTxTitle': 'Hapus transaksi?',
  },

  en: {
    'nav.dark': 'Dark', 'nav.light': 'Light', 'nav.setting': 'Settings', 'nav.logout': 'Sign out',
    'nav.currency': 'Display currency', 'nav.lang': 'Change language',

    'market.wita': 'Indonesia (WITA)', 'market.lse': 'London (LSE)', 'market.nyse': 'New York (NYSE)',
    'market.open': 'Open', 'market.closed': 'Closed',
    'market.rateUpdate': 'Updated', 'market.rateLoading': 'Loading rate…',
    'market.rateFail': 'Rate failed to load — click to retry',
    'market.rateRefresh': 'Click to refresh rate',

    'login.title': 'Sign in', 'login.sub': 'Your private portfolio, stored securely.',
    'login.email': 'Email', 'login.password': 'Password', 'login.signin': 'Sign in',
    'login.forgot': 'Forgot password?',

    'stmt.total': 'Total Invested', 'stmt.totalSub': 'cost basis',
    'stmt.now': 'Current Value', 'stmt.nowSub': 'market valuation',
    'stmt.gain': 'Unrealized Gain / Loss', 'stmt.gainSub': 'enter market price',
    'stmt.tx': 'Total Transactions', 'stmt.txSub': 'purchases recorded',
    'stmt.missing': 'Market price for {list} is empty — valued at cost basis instead.',

    'prices.eyebrow': 'Market Valuation', 'prices.title': 'Latest price per instrument',
    'prices.fetch': 'Fetch Data',
    'prices.hint': 'Prices live in this session only and are never stored as history. Click Fetch Data to load live quotes.',
    'prices.usdOnly': 'Market prices are always in USD; portfolio values are shown in IDR using the rate above.',
    'prices.loading': 'Fetching live prices…',
    'prices.updated': 'Prices updated: {at}',
    'prices.noValid': 'No valid price returned for the tickers used.',
    'prices.noTicker': 'No asset has a ticker yet. Enter market prices manually.',
    'prices.failed': 'Fetch failed. Check the price endpoint or wait if you are rate limited.',

    'tabs.instrument': 'Instrument',

    'form.eyebrow': 'Record Transaction', 'form.date': 'Purchase date',
    'form.price': 'Buy price / {unit} ($)', 'form.qty': 'Quantity', 'form.total': 'Total cost ($)',
    'form.pricePh': 'e.g. 480.50', 'form.qtyPh': 'e.g. 1.5', 'form.totalPh': 'auto: price × qty',
    'form.add': 'Add Purchase', 'form.removeInstrument': 'Delete Instrument',

    'metric.units': 'Total Units', 'metric.avg': 'Avg Buy Price', 'metric.invested': 'Total Invested',
    'metric.now': 'Current Value', 'metric.gain': 'Unrealized G/L',

    'table.date': 'Date', 'table.price': 'Buy Price', 'table.qty': 'Quantity',
    'table.total': 'Total Cost', 'table.unrealized': 'Unrealized', 'table.pct': '%', 'table.actions': 'Actions',
    'table.newest': 'Newest first', 'table.oldest': 'Oldest first',
    'table.show': 'Show:', 'table.all': 'All',
    'table.caption': 'Showing {shown} of {total} transactions. Click the pencil icon to edit a row.',
    'table.empty': 'No transactions yet. Record your first DCA purchase.',
    'table.emptyGuest': 'Sign in so your transactions are saved.',
    'table.edit': 'Edit transaction', 'table.delete': 'Delete transaction',

    'chart.eyebrow': 'Progress', 'chart.title': 'Accumulation & unrealized gain',
    'chart.invest': 'Total Invested', 'chart.gain': 'Unrealized G/L',
    'chart.empty': 'Add transactions & market prices to see the chart.',
    'chart.note': 'The <b>Unrealized G/L</b> line cannot be drawn yet: market price for {list} is still empty.',
    'chart.resetZoom': 'Reset Zoom',
    'chart.zoomHint': 'Scroll to zoom, drag to pan, or pinch on mobile.',
    'chart.r1w': '1W', 'chart.r1m': '1M', 'chart.r1y': '1Y', 'chart.r5y': '5Y', 'chart.r10y': '10Y', 'chart.rall': 'All',

    'pie.eyebrow': 'Composition', 'pie.title': 'Asset allocation',
    'pie.hint': 'Uses latest market value; assets without a price fall back to cost basis.',
    'pie.empty': 'No investment data yet.', 'pie.costFlag': 'cost',

    'notes.eyebrow': 'Journal', 'notes.title': 'Portfolio notes',
    'notes.placeholder': 'Write a note: why you bought, targets, rebalancing plan…',
    'notes.add': 'Add Note', 'notes.empty': 'No notes yet. Write something above.',
    'notes.edit': 'Edit note', 'notes.delete': 'Delete note',
    'notes.save': 'Save', 'notes.cancel': 'Cancel',
    'notes.created': 'Created {at}', 'notes.updated': 'Edited {at}',
    'notes.confirmDelete': 'Delete this note? This cannot be undone.',
    'notes.confirmTitle': 'Delete note?',
    'notes.emptyText': 'A note cannot be empty.',
    'notes.guest': 'Sign in so your notes are saved.',
    'notes.count': '{n} notes', 'notes.count1': '1 note',

    'export.eyebrow': 'Archive', 'export.title': 'Download portfolio records',
    'export.xlsx': 'Export .xlsx', 'export.json': 'Backup Data (JSON)',
    'footer.tag': 'Your private data, stored securely in Firebase.',

    'instr.title': 'Add Instrument',
    'instr.sub': 'Add a new asset to the portfolio. Leave the ticker empty to enter prices manually.',
    'instr.code': 'Asset code', 'instr.name': 'Asset name', 'instr.unit': 'Unit', 'instr.ticker': 'Price ticker (optional)',
    'instr.add': 'Add Instrument',

    'edit.title': 'Edit Transaction',
    'edit.sub': '{name} · change then save. Unrealized & % are recalculated automatically.',
    'edit.date': 'Purchase date', 'edit.price': 'Buy price ($)', 'edit.qty': 'Quantity',
    'edit.total': 'Total cost ($)', 'edit.now': 'Current value', 'edit.gain': 'Unrealized', 'edit.pct': '%',
    'edit.hint': 'Unrealized & % are never typed by hand — both come from market price × quantity, minus total cost.',
    'edit.delete': 'Delete', 'edit.save': 'Save Changes',
    'edit.noPrice': 'market price empty',
    'edit.notFound': 'Transaction not found — it may have changed. Reload the page and try again.',
    'edit.notFoundTitle': 'Cannot edit',

    'set.title': 'Display Settings',
    'set.sub': 'Tailor your family office identity. Changes are saved to your account.',
    'set.upload': 'Upload logo', 'set.removeLogo': 'Remove logo',
    'set.headTitle': 'Title (header)', 'set.headDesc': 'Description (header)',
    'set.eyebrow': 'Summary label', 'set.pageTitle': 'Main heading', 'set.lede': 'Main description',
    'set.save': 'Save',

    'common.cancel': 'Cancel', 'common.ok': 'OK', 'common.confirm': 'Yes, continue', 'common.info': 'Info',
    'common.notLoggedIn': 'Your session is not active. Refresh the page and sign in again.',
    'common.notLoggedInTitle': 'Not signed in',
    'common.fillFields': 'Fill every field with a number greater than 0.',
    'common.loading': 'Loading data from Firebase…',
    'common.confirmDelTx': 'Delete this transaction?', 'common.confirmDelTxTitle': 'Delete transaction?',
  },
};

/** Ambil string terjemahan; `vars` mengganti placeholder {nama}. */
export function t(key, vars) {
  const table = STRINGS[state.lang] || STRINGS.id;
  let out = table[key] ?? STRINGS.id[key] ?? key;
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => { out = out.split(`{${k}}`).join(String(v)); });
  }
  return out;
}

/** Locale untuk toLocaleString (angka, tanggal, jam). */
export function locale() { return state.lang === 'en' ? 'en-GB' : 'id-ID'; }

export function setLang(lang) {
  state.lang = lang === 'en' ? 'en' : 'id';
  saveLang();
  document.documentElement.lang = state.lang;
  applyI18n();
}

export function toggleLang() {
  setLang(state.lang === 'id' ? 'en' : 'id');
  return state.lang;
}

/** Terapkan terjemahan ke seluruh elemen statis di halaman. */
export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  root.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const v = t(el.dataset.i18nTitle);
    el.title = v; el.setAttribute('aria-label', v);
  });
}
