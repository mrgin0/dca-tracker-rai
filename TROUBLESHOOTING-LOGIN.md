# Troubleshooting Login — Meridian (project: family-office-3b102)

Config Firebase sudah ditanam di kode. Kalau login masih gagal, cek 4 hal ini **di Firebase Console**, urut dari yang paling sering jadi penyebab.

---

## ☐ Cek 1 — Email/Password provider aktif?

Buka langsung:
**<https://console.firebase.google.com/project/family-office-3b102/authentication/providers>**

- Kalau **Email/Password** statusnya "Disabled" → klik → **Enable** → **Save**.
- Ini penyebab #1 kalau muncul error "gagal masuk" tanpa detail jelas, atau error kode `auth/configuration-not-found`.

---

## ☐ Cek 2 — User memang ada di Authentication?

Buka langsung:
**<https://console.firebase.google.com/project/family-office-3b102/authentication/users>**

- Cari email yang Anda coba login. Kalau **tidak ada di list** → klik **Add user** → isi email + password → **Add user**.
- Email **case-sensitive**. `Nama@Email.com` ≠ `nama@email.com` di beberapa kasus — copy-paste persis dari Console.
- Kalau lupa password → hapus user (⋮ → Delete user) → buat ulang dengan password baru. Password tidak bisa dilihat ulang di Console.

---

## ☐ Cek 3 — Firestore Database dibuat + Rules published?

Buka langsung:
**<https://console.firebase.google.com/project/family-office-3b102/firestore>**

- Kalau belum ada database sama sekali → **Create database** → mode production → pilih lokasi → **Create**.
- Tab **Rules** → pastikan isinya persis seperti `firestore.rules` di project ini → **Publish**.
- Tanpa ini, login BISA berhasil tapi data gagal dimuat / gagal simpan (`Missing or insufficient permissions`).

---

## ☐ Cek 4 — Domain yang dipakai sudah di Authorized domains?

Buka langsung:
**<https://console.firebase.google.com/project/family-office-3b102/authentication/settings>** → tab **Authorized domains**

- `localhost` harusnya otomatis ada.
- Kalau buka dari GitHub Pages (`xxx.github.io`) dan **belum** ada di list → tambahkan via **Add domain**.
- Tanpa ini, login di domain publik akan gagal diam-diam atau error `auth/unauthorized-domain`.

---

## Error spesifik → solusi

| Kode error (lihat di Console F12) | Artinya | Solusi |
|---|---|---|
| `auth/user-not-found` | Email belum terdaftar | Cek 2 |
| `auth/wrong-password` | Password salah | Ketik ulang, cek Caps Lock |
| `auth/invalid-credential` | Email/password tidak cocok | Cek 2, pastikan persis |
| `auth/configuration-not-found` | Email/Password provider belum aktif | Cek 1 |
| `auth/too-many-requests` | Kebanyakan percobaan gagal | Tunggu 5–10 menit |
| `auth/unauthorized-domain` | Domain belum diizinkan | Cek 4 |
| `auth/network-request-failed` | Internet/koneksi bermasalah | Cek koneksi |
| `Missing or insufficient permissions` | Firestore Rules belum benar | Cek 3 |

Aplikasi sekarang menampilkan pesan ini otomatis di kotak merah bawah tombol "Masuk" — tidak perlu buka Console lagi untuk kasus umum.

---

## Cara lihat kode error asli (kalau pesan tidak jelas)

1. Buka halaman login.
2. Tekan **F12** → tab **Console**.
3. Coba login (gagal).
4. Baris merah biasanya berbunyi: `Login error: auth/xxxxx ...`
5. Cocokkan `auth/xxxxx` dengan tabel di atas.

---

## Test cepat: semua sudah benar tapi tetap gagal?

1. Hard refresh: **Ctrl+Shift+R** (Windows) / **Cmd+Shift+R** (Mac).
2. Pastikan dibuka via `http://localhost:8000`, **bukan** `file:///...`.
3. Pastikan file `js/firebase-config.js` tidak diubah (config sudah benar untuk `family-office-3b102`).
4. Coba buat user BARU khusus untuk testing di Cek 2, pakai password sederhana (mis. `test123456`), lalu login pakai itu.
