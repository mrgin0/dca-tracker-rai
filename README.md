# Meridian — Family Office DCA Ledger

Tracker DCA multi-instrumen. Front end statis (GitHub Pages), data di Firebase (Auth + Firestore).

## Struktur

```
index.html
css/styles.css
js/firebase-config.js   <- isi kredensial Firebase + endpoint harga
js/state.js             <- state + konstanta
js/utils.js             <- formatter, modal, theme
js/auth.js              <- login/logout (Firebase Auth)
js/store.js             <- CRUD Firestore
js/prices.js            <- harga pasar (fetch + input)
js/calc.js              <- kalkulasi portofolio
js/charts.js            <- line + pie chart
js/ui.js                <- render tabs, tabel, summary
js/export.js            <- export .xlsx
js/app.js               <- entry point + wiring
firestore.rules         <- security rules
```

## 1. Setup Firebase

1. Buka <https://console.firebase.google.com> → buat project.
2. **Authentication** → Sign-in method → aktifkan **Email/Password**.
3. **Authentication** → Users → **Add user** (buat akun manual, tidak ada signup publik).
4. **Firestore Database** → Create database (mode production).
5. Project settings → General → **Your apps** → Web app → salin konfig ke `js/firebase-config.js` (ganti bagian `firebaseConfig`).

## 2. Security rules

Firestore → Rules → tempel isi `firestore.rules`, lalu Publish. Rule ini membatasi tiap user hanya ke `users/{uid}` miliknya.

Struktur data:

```
users/{uid}/assets/{id}         { symbol, name, unit, yahoo, createdAt }
users/{uid}/transactions/{id}   { asset, tanggal, hargaBeli, jumlahUnit, totalBeli, createdAt }
```

Tidak ada koleksi histori harga — harga pasar hanya hidup di input.

## 3. Harga pasar (dipertahankan)

`js/firebase-config.js` → objek `PRICES`. Default memakai endpoint proxy `get-prices` lama sebagai sumber harga realtime. Ganti `url` + `headers` bila punya endpoint sendiri (mis. Cloud Function). Klik **Ambil Data** untuk memuat; nilai tidak disimpan sebagai histori.

## 4. Jalankan lokal

ES modules butuh HTTP (bukan `file://`):

```bash
python3 -m http.server 8000
# buka http://localhost:8000
```

## 5. Deploy GitHub Pages

1. Push folder ini ke repo GitHub.
2. Settings → Pages → Source: `main` / root `/`.
3. Buka URL `https://<user>.github.io/<repo>/`.
4. Firebase Console → Authentication → Settings → **Authorized domains** → tambahkan domain `github.io` Anda.

Selesai.
