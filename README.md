# Kodya.id

Media digital Kodya.id dengan CMS sendiri: akun admin & penulis, manajemen artikel (tambah/edit/hapus/hapus-semua), media library, kategori, opini publik & forum diskusi, grafik pasar real-time, dan panel analisis AI — siap diluncurkan.

## Arsitektur

- **Frontend**: HTML/CSS/JS murni (tanpa framework), hash-routing.
- **Backend API**: satu handler bersama (`api-handler.js`) yang dipakai dua adapter:
  - `server.js` + `storage-local.js` — untuk **dev lokal** (data di folder `data/`, gambar di `uploads/`).
  - `netlify/functions/api.js` + `storage-blobs.js` — untuk **produksi di Netlify** (data di **Netlify Blobs**, store `kodya-data`).
- **Sesi**: token stateless (HMAC-SHA256, TTL 12 jam) — tidak perlu sesi server, cocok untuk serverless.
- **Password**: di-hash dengan **scrypt + salt** acak per akun (bukan plaintext).

Semua data situs (artikel, opini, forum, media, kategori, akun) tersimpan di server, sehingga semua pengunjung melihat konten yang sama.

## Akun

- **Admin bawaan** (dibuat otomatis saat store pertama kali kosong):
  - Email: `admin@kodya.id`
  - Password: `adminredaksi2026`
  - ⚠️ **Segera ganti** password ini lewat Dashboard → Pengaturan → Ubah Password, atau set env `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
- **Pembaca (publik)**: siapa pun bisa **membuat akun sendiri** lewat tombol "Daftar akun" di halaman login (mirip Twitter). Akun ini dipakai untuk menulis **opini** di halaman Opini dan **berdiskusi** di Forum Diskusi — profil (nama + foto) tampil di setiap opini & balasan. Pembaca **tidak** bisa membuka dashboard.
- **Penulis**: akun penulis **hanya dibuat oleh admin** lewat Dashboard → Penulis (tidak ada registrasi publik sebagai penulis). Admin menentukan nama, email, dan password awal saat membuat akun.
- **Hak akses**: Super Admin melihat semua menu (termasuk Penulis & Pengaturan). Penulis hanya mengelola konten (berita, media). Pembaca menulis opini di halaman Opini (murni baca — tanpa balasan/komentar/vote) dan berdiskusi di Forum Diskusi (balasan + vote + share). Sesi kedaluwarsa otomatis setelah 12 jam.

## Dev lokal

```bash
npm install
npm start        # lalu buka http://localhost:4173
```

- Data dev tersimpan di `data/` (`users.json`, `articles.json`, `forum.json`, `opinions.json`, `media.json`, `categories.json`) dan gambar di `uploads/`. Folder ini otomatis dibuat saat server pertama kali dijalankan.
- Jangan buka `index.html` langsung (protokol `file://`) — API tidak akan berfungsi.

### Uji API (smoke test)

Jalankan server dulu, lalu:

```bash
node scripts/smoke-api.js            # default http://localhost:4173
node scripts/smoke-api.js http://localhost:4321
```

### Endpoint API

| Method | Path | Auth | Fungsi |
|---|---|---|---|
| POST | `/api/register` | — | Daftar akun publik (Pembaca) |
| POST | `/api/login` | — | Login, mengembalikan token |
| GET | `/api/me` | token | Validasi sesi / data akun |
| POST | `/api/change-password` | token | Ganti password sendiri |
| POST | `/api/profile` | token | Ubah nama / foto profil |
| GET/POST | `/api/users` | admin | Lihat / buat akun |
| DELETE | `/api/users?email=` | admin | Hapus akun (bukan diri sendiri) |
| GET | `/api/articles` | opsional | Tanpa login: hanya yang Published; dengan login: semua |
| POST | `/api/articles` | token | Simpan daftar artikel (replace-all) |
| DELETE | `/api/articles` | token | Hapus semua artikel |
| DELETE | `/api/articles/:id` | token | Hapus satu artikel |
| GET/POST | `/api/forum` | (tulis: token) | Baca / simpan thread forum diskusi |
| GET/POST | `/api/opinions` | (tulis: token) | Baca / simpan opini publik (read-only di UI, tanpa balasan/vote) |
| GET/POST | `/api/media` | (tulis: token) | Baca / simpan media library |
| GET/POST | `/api/categories` | (tulis: token) | Baca / simpan kategori |
| POST | `/api/upload` | token | Upload gambar (JPG/PNG/GIF/WebP/SVG), audio MP3, video MP4 (maks 25 MB) |
| GET | `/api/uploads/:file` | — | Mengambil gambar tersimpan |
| GET | `/api/quotes?symbols=` | — | Proxy harga pasar (Yahoo Finance, cache 60 dtk) |

## Deploy ke Netlify

Karena domain `.com` Anda sudah terdaftar di Netlify, ikuti langkah berikut:

1. **Buat repositori git** dan push proyek ini (Netlify akan menjalankan `npm install` otomatis):
   ```bash
   git init && git add . && git commit -m "Kodya.id production"
   ```
2. Di Netlify: **Add new site → Import an existing project** → pilih repo → **Deploy site**.
   - Build command: kosongkan (tidak perlu).
   - Publish directory: `.`
   - Netlify otomatis mendeteksi `netlify/functions` dan `netlify.toml`.
3. **Set environment variables** (Site configuration → Environment variables):
   - `SESSION_SECRET` — **wajib**, string acak panjang. Contoh: `openssl rand -hex 32`.
   - (opsional) `ADMIN_EMAIL` / `ADMIN_PASSWORD` untuk mengganti kredensial admin yang di-seed.
4. **Attach domain**: Site configuration → Domain management → Add domain → pilih domain `.com` yang sudah terdaftar di Netlify.
5. Buka situs, login sebagai admin, **segera ganti password** di Pengaturan, lalu isi konten (artikel, kategori, penulis).

### Penyimpanan data di produksi

- Semua data & upload gambar tersimpan di **Netlify Blobs** (store `kodya-data`) milik situs Netlify Anda — tanpa database eksternal. Bisa dilihat/diunduh lewat Netlify UI (Blobs).
- Batas bawaan Netlify (cek paket Anda): ukuran blob ~25 MB, total penyimpanan store bervariasi per paket, fungsi ~10 MB per respons.
- Karena data tersimpan di Blobs (bukan di repo), data tidak ikut terhapus saat deploy ulang.

### Keterbatasan yang perlu diketahui

- **Sesi tidak persisten**: token sesi 12 jam; pengguna login ulang setelahnya (aman & umum untuk serverless).
- **Proxy harga pasar**: bergantung ketersediaan Yahoo Finance; bila gagal, nilai cadangan statis tetap ditampilkan.
- **Upload media di Netlify**: fungsi sinkron Netlify membatasi isi request ±10 MB — untuk MP3/MP4 besar (di atas itu) pertimbangkan mengompres file atau memakai Netlify Background Functions.
- **Artikel tersimpan server-side**: semua pengunjung melihat konten yang dikelola lewat dashboard — tidak lagi per-browser (ini perbaikan utama dari versi demo).

## Fitur situs

- Beranda dengan carousel headline, kartu Pasar Hari Ini (tab Indonesia/Global/Kripto/Komoditas) + analisis AI otomatis, trending, breaking news.
- Halaman kategori, detail artikel, pencarian, Indeks PRO, **Dengarkan Artikel** (pemutar audio "Dengarkan artikel ini" di halaman artikel bila redaksi mengunggah versi suara MP3 — untuk pembaca yang tidak ingin membaca), Podcast (audio), Video (video), **Opini** (opini publik — publik menulis opini, posting **wajib login**, murni untuk dibaca & dibagikan, tanpa balasan/komentar/vote, profil (nama + foto) pengguna tampil di setiap opini).
- **Forum Diskusi** (`#/forum`): ruang diskusi publik — buat topik, balas, vote naik/turun, dan bagikan; posting & balas **wajib login**.
- Grafik TradingView real-time di halaman Pasar & Data (IHSG, USD/IDR, Emas, Bitcoin, Ethereum) dengan deteksi jam buka/tutup pasar.
- Dashboard CMS: dashboard, daftar berita (cari/filter/hapus/hapus semua), editor berita (publish/draft/scheduled, featured, breaking) dengan toolbar format teks — termasuk perataan rata kiri/tengah/kanan/**justify** — dan seksi **upload audio versi suara artikel** (MP3), media library, kategori, penulis (kelola akun — dibuat admin), traffic & analytics, pengaturan (profil + foto, ubah password).
- **Podcast & Video dari dashboard**: pilih kategori Podcast → upload **MP3**, kategori Video → upload **MP4** (maks 25 MB). File tersimpan di server dan langsung diputar di halaman Podcast/Video serta di detail artikel.

## Struktur file penting

```
app.js               Frontend (routing, render, interaksi)
server.js            Dev server lokal
api-handler.js       Logika API (dipakai server lokal & Netlify)
auth.js              Hash password + token sesi
storage-local.js     Penyimpanan file (dev)
storage-blobs.js     Penyimpanan Netlify Blobs (produksi)
netlify/functions/   Netlify Function (entry /api/*)
netlify.toml         Konfigurasi deploy Netlify
scripts/smoke-api.js Uji API otomatis
```
