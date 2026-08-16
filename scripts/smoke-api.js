// Smoke test API Kodya.id — jalankan setelah server hidup:
//   node server.js          (di terminal lain)
//   node scripts/smoke-api.js [baseURL]
const fs = require("node:fs");
const path = require("node:path");

const BASE = process.argv[2] || "http://localhost:4173";
let pass = 0, fail = 0;

async function req(method, url, { token, body, raw, contentType } = {}) {
  const headers = {};
  if (token) headers.Authorization = "Bearer " + token;
  if (raw !== undefined) headers["Content-Type"] = contentType;
  else if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + url, { method, headers, body: raw !== undefined ? raw : (body !== undefined ? JSON.stringify(body) : undefined), signal: AbortSignal.timeout(15000) });
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("json") ? await res.json() : Buffer.from(await res.arrayBuffer());
  return { status: res.status, data, ct };
}

function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("PASS  " + name); }
  else { fail++; console.log("FAIL  " + name + "  " + extra); }
}

(async () => {
  let r;

  r = await req("GET", "/api/articles");
  check("artikel kosong untuk anonim", r.status === 200 && Array.isArray(r.data.articles) && r.data.articles.length === 0, JSON.stringify(r.data));

  r = await req("GET", "/api/me");
  check("sesi tanpa token ditolak", r.status === 401);

  r = await req("POST", "/api/login", { body: { email: "admin@kodya.id", password: "adminredaksi2026" } });
  check("login admin berhasil", r.status === 200 && r.data.ok && r.data.token && r.data.user.role === "Super Admin", r.status + " " + JSON.stringify(r.data).slice(0, 140));
  const admin = r.data.token;

  r = await req("GET", "/api/me", { token: admin });
  check("sesi valid mengembalikan user", r.status === 200 && r.data.ok && r.data.user.email === "admin@kodya.id");

  r = await req("POST", "/api/login", { body: { email: "admin@kodya.id", password: "salah" } });
  check("login password salah ditolak", r.status === 401);

  r = await req("GET", "/api/users");
  check("daftar akun tanpa token ditolak", r.status === 401);

  r = await req("GET", "/api/users", { token: admin });
  check("daftar akun (admin) berisi 1", r.status === 200 && Array.isArray(r.data.users) && r.data.users.length === 1, JSON.stringify(r.data));

  r = await req("POST", "/api/users", { token: admin, body: { name: "Penulis Satu", email: "penulis1@kodya.id", password: "rahasia123" } });
  check("admin membuat akun penulis", r.status === 200 && r.data.ok && r.data.user.role === "Penulis");

  r = await req("POST", "/api/users", { token: admin, body: { name: "Penulis Dua", email: "penulis2@kodya.id", password: "rahasia456" } });
  check("admin membuat penulis kedua", r.status === 200 && r.data.ok);

  r = await req("GET", "/api/users", { token: admin });
  check("daftar akun berisi 3", r.status === 200 && r.data.users.length === 3);

  // Registrasi publik: akun Pembaca (untuk menulis opini), BUKAN penulis — penulis hanya dibuat admin.
  r = await req("POST", "/api/register", { body: { name: "Pembaca Publik", email: "pembaca@kodya.id", password: "rahasia789" } });
  check("registrasi publik jadi Pembaca", r.status === 200 && r.data.ok && r.data.user.role === "Pembaca", JSON.stringify(r.data));
  const pembaca = r.data.token;

  r = await req("POST", "/api/register", { body: { name: "X", email: "pembaca@kodya.id", password: "rahasia789" } });
  check("registrasi email duplikat ditolak", r.status === 409);

  r = await req("GET", "/api/users", { token: pembaca });
  check("pembaca dilarang kelola akun", r.status === 403);

  r = await req("POST", "/api/login", { body: { email: "penulis2@kodya.id", password: "rahasia456" } });
  check("login penulis buatan admin", r.status === 200 && r.data.ok);
  const penulis = r.data.token;

  r = await req("GET", "/api/users", { token: penulis });
  check("penulis dilarang kelola akun", r.status === 403);

  const articles = [
    { id: 1, title: "Artikel Terbit", excerpt: "Ringkasan", category: "Ekonomi", author: "Penulis Satu", status: "Published", featured: true, breaking: false, views: "12", date: "15 Agustus 2026", image: "https://example.com/a.jpg" },
    { id: 2, title: "Artikel Draf", excerpt: "Ringkasan", category: "Politik", author: "Penulis Satu", status: "Draft", featured: false, breaking: false, views: "0", date: "15 Agustus 2026", image: "https://example.com/b.jpg" }
  ];
  r = await req("POST", "/api/articles", { token: admin, body: { articles } });
  check("simpan 2 artikel", r.status === 200 && r.data.ok && r.data.count === 2);

  r = await req("GET", "/api/articles");
  check("anonim hanya melihat published", r.status === 200 && r.data.articles.length === 1 && r.data.articles[0].status === "Published");

  r = await req("GET", "/api/articles", { token: admin });
  check("login melihat semua artikel", r.status === 200 && r.data.articles.length === 2);

  r = await req("GET", "/api/forum");
  check("forum awal kosong", r.status === 200 && Array.isArray(r.data.threads) && r.data.threads.length === 0);
  await req("POST", "/api/forum", { token: pembaca, body: { threads: [{ id: 1, author: "Pembaca Publik", avatar: "", title: "Topik", message: "Isi", date: "15 Agustus 2026", votes: 0, comments: [] }] } });
  r = await req("GET", "/api/forum");
  check("pembaca bisa posting thread forum", r.status === 200 && r.data.threads.length === 1);

  r = await req("GET", "/api/opinions");
  check("opini awal kosong", r.status === 200 && Array.isArray(r.data.opinions) && r.data.opinions.length === 0);
  await req("POST", "/api/opinions", { token: pembaca, body: { opinions: [{ id: 1, author: "Pembaca Publik", avatar: "", title: "Opini", message: "Isi", date: "15 Agustus 2026" }] } });
  r = await req("GET", "/api/opinions");
  check("pembaca bisa posting opini", r.status === 200 && r.data.opinions.length === 1);

  await req("POST", "/api/media", { token: admin, body: { media: ["https://example.com/x.jpg"] } });
  r = await req("GET", "/api/media");
  check("simpan & baca media", r.status === 200 && r.data.media.length === 1);

  await req("POST", "/api/categories", { token: admin, body: { categories: ["Beranda", "Properti"] } });
  r = await req("GET", "/api/categories");
  check("simpan & baca kategori", r.status === 200 && r.data.categories.length === 2);

  r = await req("POST", "/api/profile", { token: admin, body: { name: "Admin Kodya Baru" } });
  check("perbarui profil (nama)", r.status === 200 && r.data.ok && r.data.user.name === "Admin Kodya Baru");

  const png = fs.readFileSync(path.join(__dirname, "..", "tiny-test.png"));
  r = await req("POST", "/api/upload", { token: admin, raw: png, contentType: "image/png" });
  check("upload gambar PNG", r.status === 200 && r.data.ok && /^\/api\/uploads\/img-.*\.png$/.test(r.data.url), r.data.url || JSON.stringify(r.data));
  const imgUrl = r.data.url;

  r = await req("GET", imgUrl);
  check("ambil gambar ter-upload", r.status === 200 && r.ct.startsWith("image/") && r.data.length === png.length);

  r = await req("POST", "/api/upload", { token: admin, raw: Buffer.from("hello world, definitely not an image, padding padding"), contentType: "image/png" });
  check("upload non-gambar ditolak", r.status === 400);

  const mp3 = Buffer.concat([Buffer.from("ID3\x04\x00\x00\x00\x00\x00\x00"), Buffer.alloc(200, 0)]);
  r = await req("POST", "/api/upload", { token: admin, raw: mp3, contentType: "audio/mpeg" });
  check("upload MP3 (podcast)", r.status === 200 && r.data.ok && /\.mp3$/.test(r.data.url), r.data.url || JSON.stringify(r.data));
  r = await req("GET", r.data.url);
  check("ambil MP3 (audio/mpeg)", r.status === 200 && r.ct.startsWith("audio/"));

  const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(200, 0)]);
  r = await req("POST", "/api/upload", { token: admin, raw: mp4, contentType: "video/mp4" });
  check("upload MP4 (video)", r.status === 200 && r.data.ok && /\.mp4$/.test(r.data.url), r.data.url || JSON.stringify(r.data));
  r = await req("GET", r.data.url);
  check("ambil MP4 (video/mp4)", r.status === 200 && r.ct.startsWith("video/"));

  r = await req("POST", "/api/upload", { token: admin, raw: Buffer.from("definitely not a real video file, just plain text here"), contentType: "video/mp4" });
  check("upload non-MP4 ditolak", r.status === 400);

  r = await req("DELETE", "/api/articles/1", { token: admin });
  r = await req("GET", "/api/articles", { token: admin });
  check("hapus satu artikel", r.status === 200 && r.data.articles.length === 1);

  r = await req("DELETE", "/api/articles", { token: admin });
  r = await req("GET", "/api/articles", { token: admin });
  check("hapus semua artikel", r.status === 200 && r.data.articles.length === 0);

  r = await req("POST", "/api/change-password", { token: penulis, body: { current: "rahasia456", next: "baru123456" } });
  check("ganti password", r.status === 200 && r.data.ok);
  r = await req("POST", "/api/login", { body: { email: "penulis2@kodya.id", password: "baru123456" } });
  check("login dengan password baru", r.status === 200 && r.data.ok);

  r = await req("DELETE", "/api/users?email=" + encodeURIComponent("penulis1@kodya.id"), { token: admin });
  check("hapus akun penulis", r.status === 200 && r.data.ok);
  r = await req("GET", "/api/users", { token: admin });
  check("akun tersisa 3 (admin, penulis2, pembaca)", r.status === 200 && r.data.users.length === 3);

  r = await req("DELETE", "/api/users?email=" + encodeURIComponent("admin@kodya.id"), { token: admin });
  check("admin tak bisa hapus akun sendiri", r.status === 400);

  r = await req("GET", "/api/quotes?symbols=" + encodeURIComponent("^JKSE,BTC-USD"));
  check("proxy quotes (200 & ok)", r.status === 200 && r.data.ok === true);

  r = await req("GET", "/api/nope");
  check("endpoint tak dikenal 404", r.status === 404);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("ERROR", e); process.exit(1); });
