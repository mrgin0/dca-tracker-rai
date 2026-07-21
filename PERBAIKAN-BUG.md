# Catatan Perbaikan Bug

## Akar masalah utama: nomor versi modul yang berbeda-beda

Setiap file JS mengimpor modul lain dengan query string versi, tapi angkanya tidak seragam:

```
app.js    → state.js?v=9
calc.js   → state.js?v=3     ← beda URL = MODUL BERBEDA
prices.js → state.js?v=6     ← beda lagi
```

Di ES Modules, URL yang berbeda dianggap modul yang berbeda dan dievaluasi ulang.
Akibatnya ada **tiga objek `state` terpisah** di dalam satu halaman:

- `app.js` / `ui.js` / `charts.js` mengisi data transaksi ke `state` versi 9
- `calc.js` (yang menghitung semua angka) membaca `state` versi 3 — **selalu kosong**

Itu sebabnya Total Investasi selalu `$0.00`, Nilai Sekarang `—`, Total Transaksi `0`,
dan pie chart "Komposisi Alokasi Aset" selalu kosong, walaupun tabel transaksi terisi.

**Perbaikan:** semua impor internal diseragamkan ke `?v=10`.

---

## Daftar perbaikan

### 1. Ringkasan portofolio tidak sinkron
- Semua modul kini memakai satu `state` yang sama.
- `calcTotals()` menghitung ulang lewat `allSymbols()` sehingga transaksi milik
  instrumen yang sudah dihapus tetap ikut terhitung (tidak "bocor").
- Aset yang harga pasarnya belum diisi tidak lagi membuat Nilai Sekarang pincang —
  nilainya memakai harga pokok, dan ada catatan kecil di bawah ringkasan.
- Semua angka dilewatkan penjaga `num()` agar satu field rusak tidak menular jadi `NaN`.
- Snapshot harga dari Firestore dulu ditulis ke input **tanpa render ulang**, jadi
  ringkasan tetap memakai kondisi "harga kosong". Sekarang render ulang dipanggil.

### 2. Chart pie & line tidak sinkron
- Pie memakai `calcAsset()` yang tadinya membaca state kosong → sekarang benar.
- Pie kini memakai **nilai pasar terkini** (fallback ke harga pokok) sehingga ikut
  berubah setelah tombol "Ambil Data".
- Persentase di tooltip pie dulu memakai nilai `total` dari render pertama (stale);
  sekarang dihitung ulang dari data aktual.
- Line chart: garis Unrealized dulu batal digambar kalau **ada instrumen apa pun**
  tanpa harga — termasuk instrumen yang belum punya transaksi. Sekarang hanya
  instrumen yang benar-benar punya transaksi yang diperhitungkan, dan kalau ada yang
  harganya kosong grafik tetap tampil disertai catatan simbol mana yang kurang.
- Zoom/pan pengguna tidak lagi ter-reset paksa setiap render.
- Filter rentang waktu memakai tanggal lokal, bukan UTC.

### 3. Tombol Edit di tabel transaksi
- Edit sekarang membuka **modal "Ubah Transaksi"** (bukan lagi mengisi form jauh di
  atas tabel), berisi Tanggal, Harga Beli, Jumlah, dan Total Beli.
- Hitung otomatis dua arah: harga × qty → total, atau total ÷ harga → qty.
- Panel pratinjau menampilkan Nilai Sekarang, Unrealized, dan % secara langsung saat
  diketik. Kedua angka ini memang **tidak bisa diketik manual** karena hasil hitungan
  (nilai pasar × jumlah − total beli); yang perlu diubah adalah keempat field di atas.
- Ada tombol Hapus di dalam modal.
- Pencocokan id transaksi memakai `String()` agar tidak gagal karena beda tipe.
- Semua tombol yang dirender ulang diberi `type="button"`.

### 4. Perbaikan lain yang ikut disertakan
- **Firestore `orderBy` dihapus.** Query `orderBy('tanggal')` / `orderBy('createdAt')`
  diam-diam **membuang dokumen yang tidak punya field tersebut**. Dokumen lama bisa
  hilang dari hasil dan bikin total tidak cocok. Pengurutan sekarang dilakukan di JS.
- Penjaga race-condition saat memuat data: `onAuth` yang terpanggil dua kali dulu bisa
  membuat transaksi terhitung dobel. Sekarang dipakai token load + dedupe id.
- Pemanggilan `handleUserChange` ganda saat boot dihapus.
- `fetchMarketPrices()` menerima key respons berupa kode aset **atau** ticker Yahoo.
- Validasi input: nilai harus angka > 0.
- Export XLSX: `?? ''` menggantikan `|| ''` agar angka 0 tidak berubah jadi kosong.
- `escapeHtml()` dipakai untuk semua teks yang masuk ke `innerHTML`.

---

## Cara deploy

Ganti seluruh isi folder dengan versi ini, lalu **hard refresh** (Ctrl+Shift+R /
Cmd+Shift+R) agar browser memuat `?v=10` yang baru.
