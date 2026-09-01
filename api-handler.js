// ---------- API handler bersama (dipakai server.js untuk dev lokal & Netlify Functions) ----------
const { hashPassword, verifyPassword, signToken, verifyToken, secret } = require("./auth");

const ADMIN_ROLE = "Super Admin";
const AUTHOR_ROLE = "Penulis";
const READER_ROLE = "Pembaca";
const STAFF_ROLES = new Set([ADMIN_ROLE, AUTHOR_ROLE]); // Super Admin & Penulis tidak dihitung sebagai views
const STATS_PUBLIC_ONLY = 4; // views hanya dari pengunjung publik / Pembaca
const SESSION_COOKIE = "kodya_sid";
const SESSION_MAX_AGE = 12 * 60 * 60;
const MAX_UPLOAD = 25 * 1024 * 1024; // 25 MB (gambar, audio MP3, video MP4)
const ALLOWED_MEDIA = { "image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp", "image/svg+xml": ".svg", "audio/mpeg": ".mp3", "audio/mp3": ".mp3", "video/mp4": ".mp4" };

// ---------- Proxy kuotasi pasar (Yahoo Finance), cache per proses ----------
const QUOTES_CACHE = new Map(); // symbol -> { at, data }
const QUOTES_TTL = 60 * 1000;
const YAHOO_HOSTS = ["https://query2.finance.yahoo.com", "https://query1.finance.yahoo.com"];
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

async function fetchYahooQuote(symbol) {
  let lastError = null;
  for (const host of YAHOO_HOSTS) {
    try {
      const res = await fetch(`${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`, { headers: { "User-Agent": BROWSER_UA }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const meta = json?.chart?.result?.[0]?.meta;
      if (!meta || typeof meta.regularMarketPrice !== "number") throw new Error("Data tidak tersedia");
      const prev = meta.chartPreviousClose ?? meta.previousClose;
      return {
        price: meta.regularMarketPrice,
        change: prev ? (meta.regularMarketPrice / prev - 1) * 100 : 0,
        updated: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : new Date().toISOString()
      };
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error("Gagal mengambil data pasar");
}

function looksLikeUpload(buf, mime) {
  if (!ALLOWED_MEDIA[mime]) return false;
  if (buf.length < 12) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8) return true; // JPEG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true; // PNG
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return true; // GIF
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf.slice(8, 12).toString() === "WEBP") return true; // WebP
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true; // MP3 (ID3 tag)
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return true; // MP3 (MPEG frame sync)
  if (buf.slice(4, 8).toString() === "ftyp") return true; // MP4
  return mime === "image/svg+xml"; // SVG diperiksa lewat MIME
}

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, avatar: u.avatar || "" };
}

function nextId(list) {
  return list.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1;
}

function cookieValue(headers, name) {
  const raw = (headers && (headers.cookie || headers.Cookie)) || "";
  const m = String(raw).match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[1]) : "";
}

function bearerToken(headers) {
  const h = (headers && (headers.authorization || headers.Authorization)) || "";
  if (h.startsWith("Bearer ")) return h.slice(7).trim();
  return cookieValue(headers, SESSION_COOKIE);
}

function isStaffUser(user) {
  if (!user) return false;
  const role = String(user.role || "").toLowerCase().replace(/\s+/g, " ").trim();
  return role !== READER_ROLE.toLowerCase();
}

function sessionSetCookie(token) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_MAX_AGE}; SameSite=Lax`;
}

function seedAdmin(env) {
  return {
    id: 1,
    name: "Admin Kodya",
    email: String(env.ADMIN_EMAIL || "admin@kodya.id").toLowerCase().trim(),
    password: hashPassword(env.ADMIN_PASSWORD || "adminredaksi2026"),
    role: ADMIN_ROLE,
    avatar: "/default-avatar.svg"
  };
}

/**
 * handleApi({ method, path, query, headers, body, rawBody, storage, env })
 *  - query: URLSearchParams
 *  - body: object hasil parse JSON (untuk JSON request)
 *  - rawBody: Buffer (untuk upload gambar)
 *  - storage: { getJSON, setJSON, saveUpload, getUpload }
 * Returns { status, headers, body } — body berupa string (JSON) atau Buffer (gambar).
 */
async function handleApi({ method, path, query = new URLSearchParams(), headers = {}, body = {}, rawBody = null, storage, env = {} }) {
  const json = (status, obj, extra = {}) => ({ status, headers: { "Content-Type": "application/json; charset=utf-8", ...extra }, body: JSON.stringify(obj) });
  const fail = (status, error) => json(status, { ok: false, error });

  try {
    let users = await storage.getJSON("users", []);
    // Seed admin pertama kali bila store belum punya akun (password default bisa diganti via env ADMIN_EMAIL/ADMIN_PASSWORD).
    if (!Array.isArray(users) || !users.length) {
      users = [seedAdmin(env)];
      await storage.setJSON("users", users);
    }
    // Auto-sync admin password dari env: bila password hash tidak match, update otomatis.
    const adminEmail = String(env.ADMIN_EMAIL || "admin@kodya.id").toLowerCase().trim();
    const adminPw = env.ADMIN_PASSWORD || "adminredaksi2026";
    const adminIdx = users.findIndex(u => u.email && u.email.toLowerCase() === adminEmail);
    if (adminIdx !== -1 && users[adminIdx].role === ADMIN_ROLE && !verifyPassword(adminPw, users[adminIdx].password)) {
      users[adminIdx] = { ...users[adminIdx], password: hashPassword(adminPw) };
      await storage.setJSON("users", users);
    }

    const currentUser = () => {
      const token = bearerToken(headers);
      const data = token ? verifyToken(token, secret(env)) : null;
      if (!data) return null;
      return users.find(u => u.email.toLowerCase() === String(data.email).toLowerCase()) || null;
    };

    // Super Admin & Penulis tidak dihitung. Angka lama (versi < 2) direset ke 0.
    const loadPublicStats = async () => {
      const stats = await storage.getJSON("stats", {});
      if (Number(stats.version) === STATS_PUBLIC_ONLY) {
        stats.daily = stats.daily || {};
        stats.articles = stats.articles || {};
        stats.total = Number(stats.total) || 0;
        return stats;
      }
      const reset = { version: STATS_PUBLIC_ONLY, total: 0, daily: {}, articles: {} };
      await storage.setJSON("stats", reset);
      return reset;
    };

    // ---------- Auth ----------
    if (path === "/api/me" && method === "GET") {
      const me = currentUser();
      if (!me) return fail(401, "Sesi tidak valid. Silakan masuk kembali.");
      return json(200, { ok: true, user: publicUser(me) });
    }

    if (method === "POST" && path === "/api/login") {
      const { email, password } = body || {};
      const user = users.find(u => u.email.toLowerCase() === String(email || "").toLowerCase());
      if (!user || !verifyPassword(password, user.password)) return fail(401, "Email atau password salah.");
      const token = signToken(user, secret(env));
      return json(200, { ok: true, token, user: publicUser(user) }, { "Set-Cookie": sessionSetCookie(token) });
    }

    if (method === "POST" && path === "/api/register") {
      // Akun publik (Pembaca) untuk menulis opini — bukan Penulis. Akun penulis hanya dibuat admin.
      const name = String(body.name || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!name) return fail(400, "Nama wajib diisi.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(400, "Format email tidak valid.");
      if (password.length < 6) return fail(400, "Password minimal 6 karakter.");
      if (users.some(u => u.email.toLowerCase() === email)) return fail(409, "Email sudah terdaftar. Silakan masuk.");
      const user = { id: nextId(users), name, email, password: hashPassword(password), role: "Pembaca", avatar: "/default-avatar.svg" };
      users = [...users, user];
      await storage.setJSON("users", users);
      return json(200, { ok: true, token: signToken(user, secret(env)), user: publicUser(user) });
    }

    if (method === "POST" && path === "/api/change-password") {
      const me = currentUser();
      if (!me) return fail(401, "Sesi tidak valid. Silakan masuk kembali.");
      if (!verifyPassword(body.current, me.password)) return fail(401, "Password lama tidak cocok.");
      if (String(body.next || "").length < 6) return fail(400, "Password baru minimal 6 karakter.");
      users = users.map(u => u.id === me.id ? { ...u, password: hashPassword(body.next) } : u);
      await storage.setJSON("users", users);
      return json(200, { ok: true });
    }

    if (method === "POST" && path === "/api/profile") {
      const me = currentUser();
      if (!me) return fail(401, "Sesi tidak valid. Silakan masuk kembali.");
      const next = { ...me };
      if (typeof body.name === "string" && body.name.trim()) next.name = body.name.trim();
      if (typeof body.avatar === "string") next.avatar = body.avatar.trim();
      users = users.map(u => u.id === me.id ? next : u);
      await storage.setJSON("users", users);
      return json(200, { ok: true, user: publicUser(next) });
    }

    // ---------- Manajemen akun (hanya Super Admin) ----------
    if (path === "/api/users" && method === "GET") {
      const me = currentUser();
      if (!me) return fail(401, "Sesi tidak valid. Silakan masuk kembali.");
      if (me.role !== ADMIN_ROLE) return fail(403, "Hanya Super Admin yang dapat mengelola akun.");
      return json(200, { ok: true, users: users.map(publicUser) });
    }

    if (path === "/api/users" && method === "POST") {
      const me = currentUser();
      if (!me) return fail(401, "Sesi tidak valid. Silakan masuk kembali.");
      if (me.role !== ADMIN_ROLE) return fail(403, "Hanya Super Admin yang dapat mengelola akun.");
      const name = String(body.name || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!name) return fail(400, "Nama wajib diisi.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(400, "Format email tidak valid.");
      if (password.length < 6) return fail(400, "Password minimal 6 karakter.");
      if (users.some(u => u.email.toLowerCase() === email)) return fail(409, "Email sudah terdaftar.");
      const user = { id: nextId(users), name, email, password: hashPassword(password), role: "Penulis", avatar: "/default-avatar.svg" };
      users = [...users, user];
      await storage.setJSON("users", users);
      return json(200, { ok: true, user: publicUser(user) });
    }

    if (path === "/api/users" && method === "DELETE") {
      const me = currentUser();
      if (!me) return fail(401, "Sesi tidak valid. Silakan masuk kembali.");
      if (me.role !== ADMIN_ROLE) return fail(403, "Hanya Super Admin yang dapat mengelola akun.");
      const email = String(query.get("email") || "").toLowerCase();
      if (!email) return fail(400, "Parameter email wajib diisi.");
      if (me.email.toLowerCase() === email) return fail(400, "Tidak dapat menghapus akun sendiri.");
      const target = users.find(u => u.email.toLowerCase() === email);
      if (!target) return fail(404, "Akun tidak ditemukan.");
      users = users.filter(u => u.email.toLowerCase() !== email);
      await storage.setJSON("users", users);
      return json(200, { ok: true });
    }

    // ---------- Artikel ----------
    if (path === "/api/articles" && method === "GET") {
      const articles = await storage.getJSON("articles", []);
      const stats = await loadPublicStats();
      const viewsMap = stats.articles || {};
      const users = await storage.getJSON("users", []);
      const me = currentUser();
      const list = (me ? articles : (Array.isArray(articles) ? articles.filter(a => a && a.status === "Published") : []))
        .map(a => {
          // Profil penulis selalu mengikuti profil akun TERBARU (nama & foto), bukan salinan lama.
          const u = users.find(x => x.email && String(x.email).toLowerCase() === String(a.authorEmail || "").toLowerCase());
          return { ...a, views: viewsMap[a.id] || 0, author: u ? u.name : a.author, avatar: u ? (u.avatar || "") : (a.avatar || "") };
        });
      return json(200, { ok: true, articles: list });
    }

    if (path === "/api/articles" && method === "POST") {
      const me = currentUser();
      if (!me) return fail(401, "Sesi tidak valid. Silakan masuk kembali.");
      const list = Array.isArray(body.articles) ? body.articles : [];
      await storage.setJSON("articles", list);
      return json(200, { ok: true, count: list.length });
    }

    if (path === "/api/articles" && method === "DELETE") {
      const me = currentUser();
      if (!me) return fail(401, "Sesi tidak valid. Silakan masuk kembali.");
      await storage.setJSON("articles", []);
      return json(200, { ok: true });
    }

    if (path.startsWith("/api/articles/") && method === "DELETE") {
      const me = currentUser();
      if (!me) return fail(401, "Sesi tidak valid. Silakan masuk kembali.");
      const id = Number(path.split("/")[3]);
      const articles = await storage.getJSON("articles", []);
      await storage.setJSON("articles", articles.filter(a => Number(a.id) !== id));
      return json(200, { ok: true });
    }

    // ---------- Statistik pengunjung (real, tersimpan di server) ----------
    if (path === "/api/views" && method === "POST") {
      const me = currentUser();
      if (me && STAFF_ROLES.has(me.role)) return json(200, { ok: true, skipped: true });
      const id = Number(body && body.id) || null;
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
      const stats = await loadPublicStats();
      stats.total = (Number(stats.total) || 0) + 1;
      stats.daily[today] = (Number(stats.daily[today]) || 0) + 1;
      if (id) stats.articles[id] = (Number(stats.articles[id]) || 0) + 1;
      await storage.setJSON("stats", stats);
      return json(200, { ok: true });
    }
    if (path === "/api/stats" && method === "GET") {
      const me = currentUser();
      if (!me) return fail(401, "Sesi tidak valid. Silakan masuk kembali.");
      if (me.role !== ADMIN_ROLE) return fail(403, "Hanya Super Admin yang dapat melihat statistik.");
      const stats = await loadPublicStats();
      return json(200, { ok: true, stats: { total: Number(stats.total) || 0, daily: stats.daily || {}, articles: stats.articles || {} } });
    }

    // ---------- Forum diskusi & Opini publik, media, kategori ----------
    // Forum diskusi memakai endpoint & key penyimpanan "forum" (kompatibel data lama);
    // opini publik memakai store & endpoint terpisah ("opinions").
    if (path === "/api/forum" && method === "GET") {
      const threads = await storage.getJSON("forum", []);
      const users = await storage.getJSON("users", []);
      const pf = email => users.find(x => x.email && String(x.email).toLowerCase() === String(email || "").toLowerCase());
      const list = (Array.isArray(threads) ? threads : []).map(t => {
        const u = pf(t.email);
        const comments = (t.comments || []).map(c => { const cu = pf(c.email); return cu ? { ...c, author: cu.name, avatar: cu.avatar || "" } : c; });
        return { ...t, author: u ? u.name : t.author, avatar: u ? (u.avatar || "") : (t.avatar || ""), comments };
      });
      return json(200, { ok: true, threads: list });
    }
    if (path === "/api/forum" && method === "POST") {
      const me = currentUser();
      if (!me) return fail(401, "Sesi tidak valid. Silakan masuk kembali.");
      await storage.setJSON("forum", Array.isArray(body.threads) ? body.threads : []);
      return json(200, { ok: true });
    }
    if (path === "/api/opinions" && method === "GET") {
      const opinions = await storage.getJSON("opinions", []);
      const users = await storage.getJSON("users", []);
      const list = (Array.isArray(opinions) ? opinions : []).map(t => {
        const u = users.find(x => x.email && String(x.email).toLowerCase() === String(t.email || "").toLowerCase());
        return u ? { ...t, author: u.name, avatar: u.avatar || "" } : t;
      });
      return json(200, { ok: true, opinions: list });
    }
    if (path === "/api/opinions" && method === "POST") {
      const me = currentUser();
      if (!me) return fail(401, "Sesi tidak valid. Silakan masuk kembali.");
      await storage.setJSON("opinions", Array.isArray(body.opinions) ? body.opinions : []);
      return json(200, { ok: true });
    }
    if (path === "/api/media" && method === "GET") {
      return json(200, { ok: true, media: await storage.getJSON("media", []) });
    }
    if (path === "/api/media" && method === "POST") {
      const me = currentUser();
      if (!me) return fail(401, "Sesi tidak valid. Silakan masuk kembali.");
      await storage.setJSON("media", Array.isArray(body.media) ? body.media : []);
      return json(200, { ok: true });
    }
    if (path === "/api/categories" && method === "GET") {
      return json(200, { ok: true, categories: await storage.getJSON("categories", []) });
    }
    if (path === "/api/categories" && method === "POST") {
      const me = currentUser();
      if (!me) return fail(401, "Sesi tidak valid. Silakan masuk kembali.");
      await storage.setJSON("categories", Array.isArray(body.categories) ? body.categories : []);
      return json(200, { ok: true });
    }

    // ---------- Upload gambar ----------
    if (path === "/api/upload" && method === "POST") {
      const me = currentUser();
      if (!me) return fail(401, "Sesi tidak valid. Silakan masuk kembali.");
      const mime = String(headers["content-type"] || headers["Content-Type"] || "").split(";")[0].trim().toLowerCase();
      if (!rawBody || rawBody.length < 12) return fail(400, "File kosong atau tidak valid.");
      if (rawBody.length > MAX_UPLOAD) return fail(400, "File terlalu besar (maks 25 MB).");
      if (!looksLikeUpload(rawBody, mime)) return fail(400, "File harus berupa gambar (JPG, PNG, GIF, WebP, SVG), audio MP3, atau video MP4.");
      const { url } = await storage.saveUpload(rawBody, mime);
      return json(200, { ok: true, url });
    }

    if (path.startsWith("/api/uploads/") && method === "GET") {
      const key = path.slice("/api/uploads/".length);
      const up = await storage.getUpload(key);
      if (!up) return json(404, { ok: false, error: "Gambar tidak ditemukan." });
      return { status: 200, headers: { "Content-Type": up.contentType, "Cache-Control": "public, max-age=31536000, immutable" }, body: up.data };
    }

    // ---------- Kuotasi pasar ----------
    if (path === "/api/quotes" && method === "GET") {
      const symbols = String(query.get("symbols") || "").split(",").map(s => s.trim()).filter(Boolean).slice(0, 20);
      if (!symbols.length) return fail(400, "Parameter symbols wajib diisi.");
      const out = {};
      const stale = symbols.filter(s => { const c = QUOTES_CACHE.get(s); return !c || Date.now() - c.at > QUOTES_TTL; });
      const results = await Promise.allSettled(stale.map(async s => [s, await fetchYahooQuote(s)]));
      results.forEach(r => { if (r.status === "fulfilled") { const [s, d] = r.value; QUOTES_CACHE.set(s, { at: Date.now(), data: d }); } });
      symbols.forEach(s => { const c = QUOTES_CACHE.get(s); if (c) out[s] = c.data; });
      return json(200, { ok: true, quotes: out });
    }

    return fail(404, "Endpoint tidak ditemukan.");
  } catch (error) {
    return fail(500, "Terjadi kesalahan server: " + (error && error.message ? error.message : "unknown"));
  }
}

module.exports = { handleApi, looksLikeUpload };
