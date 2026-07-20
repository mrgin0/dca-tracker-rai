# Meridian — Family Office DCA Ledger

Tracker DCA multi-instrumen. Front end statis (GitHub Pages), data di Firebase (Auth + Firestore).

Config Firebase project **`family-office-3b102`** sudah ditanam di `js/firebase-config.js` — tidak perlu diisi ulang.

---

## ✅ CEKLIS KONFIGURASI FIREBASE (wajib, urut)

Config API sudah benar, tapi **API key saja tidak cukup untuk login jalan**. 4 hal ini WAJIB dicek di Firebase Console:

### ☐ 1. Authentication → Sign-in method → Email/Password AKTIF

1. Buka <https://console.firebase.google.com/project/family-office-3b102/authentication/providers>
2. Cari **Email/Password** di daftar provider.
3. Kalau statusnya "Disabled" → klik → toggle **Enable** → **Save**.

> Ini penyebab paling umum error `auth/configuration-not-found` atau login gagal total.

### ☐ 2. Authentication → Users → user sudah dibuat

1. Buka <https://console.firebase.google.com/project/family-office-3b102/authentication/users>
2. Pastikan email yang mau dipakai login **ada di daftar**.
3. Kalau belum ada → klik **Add user** → isi email + password (min 6 karakter) → **Add user**.
4. **Email persis sama** (case-sensitive) dengan yang diketik di form login.

### ☐ 3. Firestore Database sudah dibuat + Rules di-publish

1. Buka <https://console.firebase.google.com/project/family-office-3b102/firestore>
2. Kalau belum ada database → **Create database** → pilih lokasi (mis. `asia-southeast1`) → **production mode** → **Create**.
3. Buka tab **Rules** di Firestore.
4. Tempel isi file `firestore.rules` (di project ini):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```
5. Klik **Publish**.

### ☐ 4. Authorized domains (WAJIB jika deploy ke GitHub Pages / domain publik)

1. Buka <https://console.firebase.google.com/project/family-office-3b102/authentication/settings>
2. Tab **Authorized domains**.
3. `localhost` biasanya sudah otomatis ada (untuk testing lokal).
4. Kalau deploy ke GitHub Pages (`username.github.io`), klik **Add domain** → masukkan `username.github.io` (tanpa path `/repo/`) → **Add**.

---

## Struktur

```
index.html
css/styles.css
js/firebase-config.js   ← sudah diisi project family-office-3b102
js/state.js             ← state + konstanta
js/utils.js             ← formatter, modal, theme
js/auth.js              ← login/logout/reset password
js/store.js             ← CRUD Firestore (assets, transactions, branding)
js/prices.js            ← harga pasar (fetch + input, tanpa histori)
js/calc.js              ← kalkulasi portofolio
js/charts.js             ← line + pie chart
js/ui.js                ← render tabs, tabel, summary
js/export.js            ← export .xlsx
js/branding.js          ← identitas custom (judul, logo, dll)
js/app.js               ← entry point + wiring semua modul
favicon.svg             ← ikon tab browser
firestore.rules         ← security rules
```

Struktur Firestore yang dipakai (dibuat otomatis saat pertama kali dipakai):

```
users/{uid}/assets/{id}         instrumen custom
users/{uid}/transactions/{id}   pembelian DCA
users/{uid}/meta/branding       identitas tampilan (judul, logo, dll)
```

Tidak ada koleksi histori harga — harga pasar hanya hidup di input session, tidak pernah ditulis ke database.

---

## Jalankan lokal

ES modules butuh HTTP (bukan `file://`):

```bash
cd dca-tracker
python3 -m http.server 8000
# buka http://localhost:8000
```

Buka **Console** (F12) — kalau ada error merah, cocokkan dengan `TROUBLESHOOTING-LOGIN.md`.

---

## Deploy GitHub Pages

1. Push folder ini ke repo GitHub.
2. Settings → Pages → Source: `main` / root `/`.
3. Buka URL `https://<user>.github.io/<repo>/`.
4. **Jangan lupa** Langkah 4 di ceklis atas — tambahkan domain `github.io` ke Authorized domains.

---

## Harga pasar

`js/firebase-config.js` → objek `PRICES`. Endpoint proxy realtime dipertahankan seperti setup sebelumnya. Klik **Ambil Data** untuk memuat; nilai **tidak** disimpan sebagai histori — hanya ada di input session browser.
