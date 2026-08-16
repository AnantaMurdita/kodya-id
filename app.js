const IMAGE = {
  hero: "https://images.unsplash.com/photo-1574958269340-fa927503f3dd?auto=format&fit=crop&w=1400&q=82",
  city: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=900&q=80",
  politics: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=900&q=80",
  technology: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80",
  business: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=80",
  world: "https://images.unsplash.com/photo-1521295121783-8a321d551ad2?auto=format&fit=crop&w=900&q=80",
  gold: "https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=900&q=80",
  crypto: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?auto=format&fit=crop&w=900&q=80",
  market: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=900&q=80"
};

const categories = ["Beranda", "Politik", "Ekonomi", "Bisnis", "Pasar & Data", "Teknologi", "Kripto", "Internasional", "Opini", "Podcast", "Video", "Indeks PRO"];
let app = document.querySelector("#app");
let activeMarket = "Indonesia";

const DEFAULT_AVATAR = "/default-avatar.svg";

// ---------- Lapisan data server-side ----------
// Seluruh konten (artikel, opini, media, kategori, akun) tersimpan di server
// (Netlify Blobs saat deploy, file di folder data/ saat dev lokal). Cache di memori
// dipakai agar render halaman tetap sinkron tanpa menunggu fetch tiap navigasi.
let __articles = null, __forum = null, __opinions = null, __media = null, __categories = null, __users = null;
function apiHeaders() { const s = session(); return s && s.token ? { Authorization: "Bearer " + s.token } : {}; }
async function apiGet(path) { const r = await fetch(path, { headers: apiHeaders() }); return r.json().catch(() => ({})); }
async function apiSend(path, method, body) {
  const r = await fetch(path, { method, headers: { "Content-Type": "application/json", ...apiHeaders() }, body: body === undefined ? undefined : JSON.stringify(body) });
  return r.json().catch(() => ({}));
}
async function ensureArticles(force = false) { if (__articles && !force) return __articles; const d = await apiGet("/api/articles"); __articles = Array.isArray(d.articles) ? d.articles : []; return __articles; }
function articles() { return __articles || []; }
function published() { return articles().filter(a => a && a.status === "Published"); }
async function saveArticles(items) { __articles = items; await apiSend("/api/articles", "POST", { articles: items }); }
async function ensureForum(force = false) { if (__forum && !force) return __forum; const d = await apiGet("/api/forum"); __forum = Array.isArray(d.threads) ? d.threads : []; return __forum; }
function forumThreads() { return __forum || []; }
async function saveForum(threads) { __forum = threads; await apiSend("/api/forum", "POST", { threads }); }
async function ensureOpinions(force = false) { if (__opinions && !force) return __opinions; const d = await apiGet("/api/opinions"); __opinions = Array.isArray(d.opinions) ? d.opinions : []; return __opinions; }
function opinionsList() { return __opinions || []; }
async function saveOpinions(list) { __opinions = list; await apiSend("/api/opinions", "POST", { opinions: list }); }
async function ensureMedia(force = false) { if (__media && !force) return __media; const d = await apiGet("/api/media"); __media = Array.isArray(d.media) ? d.media : []; return __media; }
function mediaList() { return __media || []; }
async function saveMedia(list) { __media = list; await apiSend("/api/media", "POST", { media: list }); }
async function ensureCategories(force = false) { if (__categories && !force) return __categories; const d = await apiGet("/api/categories"); __categories = Array.isArray(d.categories) && d.categories.length ? d.categories : categories; return __categories; }
function categoriesList() { return __categories || categories; }
async function saveCategories(list) { __categories = list; await apiSend("/api/categories", "POST", { categories: list }); }
async function ensureUsers(force = false) { if (__users && !force) return __users; const d = await apiGet("/api/users"); __users = Array.isArray(d.users) ? d.users : []; return __users; }
function users() { return __users || []; }
let __stats = null;
async function ensureStats(force = false) { if (__stats && !force) return __stats; const d = await apiGet("/api/stats"); __stats = (d && d.ok && d.stats) || { total: 0, daily: {}, articles: {} }; return __stats; }
async function uploadFile(file) {
  const res = await fetch("/api/upload", { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream", ...apiHeaders() }, body: file });
  return res.json().catch(() => ({ ok: false, error: "Tidak dapat terhubung ke server." }));
}
function slug(text) { return text.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-"); }
function esc(value = "") { return String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
function safeUrl(value = "") { try { const u = new URL(value); return ["http:", "https:"].includes(u.protocol) ? u.href : "#"; } catch { return "#"; } }
function go(hash) { location.hash = hash; }
function toast(message) { const t = document.querySelector("#toast"); t.textContent = message; t.classList.add("show"); clearTimeout(window.toastTimer); window.toastTimer = setTimeout(() => t.classList.remove("show"), 2200); }
window.confirmModal = ({ message, title = "Konfirmasi", confirmLabel = "Ya, lanjutkan", danger = false, onConfirm }) => {
  const wrap = document.createElement("div");
  wrap.className = "modal-wrap";
  wrap.innerHTML = `<div class="modal-backdrop"></div><div class="modal-card" role="dialog" aria-modal="true"><button class="modal-close" aria-label="Tutup">✕</button><div class="modal-icon ${danger ? "danger" : ""}">${danger ? "!" : "?"}</div><h3>${esc(title)}</h3><p>${esc(message)}</p><div class="modal-actions"><button class="button ghost modal-no">Batal</button><button class="button ${danger ? "danger" : ""} modal-yes">${esc(confirmLabel)}</button></div></div>`;
  document.body.appendChild(wrap);
  let fired = false;
  const onKey = e => { if (e.key === "Escape") close(); };
  const close = () => { fired = true; wrap.classList.remove("open"); setTimeout(() => wrap.remove(), 180); document.removeEventListener("keydown", onKey); };
  document.addEventListener("keydown", onKey);
  wrap.querySelector(".modal-backdrop").addEventListener("click", close);
  wrap.querySelector(".modal-close").addEventListener("click", close);
  wrap.querySelector(".modal-no").addEventListener("click", close);
  wrap.querySelector(".modal-yes").addEventListener("click", () => { if (fired) return; fired = true; close(); if (onConfirm) onConfirm(); });
  requestAnimationFrame(() => wrap.classList.add("open"));
};
function dateNow() { return new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }); }
function categoryPath(c) { return c === "Beranda" ? "#/" : c === "Indeks PRO" ? "#/indeks-pro" : `#/kategori/${slug(c)}`; }
function session() { try { return JSON.parse(localStorage.getItem("kodya-session") || "null"); } catch { return null; } }
function siteAuthor() { return localStorage.getItem("kodya-author") || "Redaksi Kodya"; }

function spark(red = false) { return `<svg class="spark ${red ? "red" : ""}" viewBox="0 0 35 19"><path d="M0 14 L6 11 L10 13 L15 5 L19 9 L25 7 L30 10 L35 2"/></svg>`; }

// ---------- Data pasar real-time (via proxy /api/quotes) ----------
// Setiap baris: [label, simbol Yahoo, nilai statis cadangan, persentase cadangan]
const MARKET_GROUPS = {
  Indonesia: [["IHSG", "^JKSE", "6.319,61", "+1,37%"], ["LQ45", "^JKLQ45", "635,21", "+1,81%"], ["USD/IDR", "IDR=X", "18.027", "-0,17%"]],
  Global: [["Dow Jones", "^DJI", "46.100", "+0,42%"], ["S&P 500", "^GSPC", "6.850", "+0,35%"], ["Nasdaq", "^IXIC", "26.350", "+0,21%"]],
  Kripto: [["BTC", "BTC-USD", "64.157", "+1,00%"], ["ETH", "ETH-USD", "1.873", "+0,84%"], ["SOL", "SOL-USD", "73,53", "+0,76%"], ["BNB", "BNB-USD", "590,88", "+0,66%"]],
  Komoditas: [["Gold", "GC=F", "4.080,50", "+0,31%"], ["Brent Oil", "BZ=F", "79,34", "-0,22%"]]
};
function fmtPrice(n) { return Number(n).toLocaleString("id-ID", { maximumFractionDigits: 2, minimumFractionDigits: 0 }); }
function pctFrom(change) { return (change >= 0 ? "+" : "") + change.toFixed(2).replace(".", ",") + "%"; }
function marketRows(group) {
  return (MARKET_GROUPS[group] || MARKET_GROUPS.Indonesia).map(([label, symbol, fPrice, fPct]) => {
    const q = window.__marketQuotes && window.__marketQuotes[symbol];
    const down = q ? q.change < 0 : fPct.startsWith("-");
    const price = q ? fmtPrice(q.price) : fPrice;
    const pct = q ? pctFrom(q.change) : fPct;
    return `<div class="market-row"><span>${label}</span><strong>${price}</strong><small class="${down ? "down" : "up"}">${pct} ${spark(down)}</small></div>`;
  }).join("");
}async function loadMarketQuotes(force = false) {
  if (window.__marketQuotes && !force) return window.__marketQuotes;
  try {
    const symbols = [...new Set(Object.values(MARKET_GROUPS).flat().map(x => x[1]))];
    const res = await fetch("/api/quotes?symbols=" + encodeURIComponent(symbols.join(",")));
    const data = await res.json();
    // Gabungkan, jangan timpa: bila sebagian simbol gagal diperbarui, nilai live lama tetap dipertahankan.
    if (data && data.ok && data.quotes) window.__marketQuotes = { ...(window.__marketQuotes || {}), ...data.quotes };
  } catch { /* tetap tampilkan nilai cadangan */ }
  return window.__marketQuotes || {};
}
function applyMarketQuotes() {
  const ticker = document.getElementById("ticker-items");
  if (ticker) ticker.innerHTML = tickerItems();
  const rows = document.getElementById("market-rows");
  if (rows) rows.innerHTML = marketRows(activeMarket);
  const panel = document.getElementById("ai-panel");
  if (panel && panel.classList.contains("open")) generateAiAnalysis();
}

// ---------- Analisis AI otomatis (berbasis data pasar real-time) ----------
function aiAnalysisHtml(groupName) {
  const rows = MARKET_GROUPS[groupName] || MARKET_GROUPS.Indonesia;
  const items = rows.map(([label, symbol, fPrice, fPct]) => {
    const q = window.__marketQuotes && window.__marketQuotes[symbol];
    const change = q ? q.change : parseFloat(String(fPct).replace("%", "").replace(",", "."));
    return { label, price: q ? fmtPrice(q.price) : fPrice, change };
  });
  const avg = items.reduce((s, x) => s + x.change, 0) / items.length;
  const sorted = [...items].sort((a, b) => b.change - a.change);
  const topGainer = sorted[0];
  const topLoser = sorted[sorted.length - 1];
  const up = items.filter(x => x.change > 0).length;
  const down = items.length - up;
  let chip, chipClass, sentiText;
  if (avg >= 1) { chip = "BULLISH KUAT"; chipClass = "bull"; sentiText = "dominan positif"; }
  else if (avg > 0.25) { chip = "BULLISH"; chipClass = "bull"; sentiText = "cenderung positif"; }
  else if (avg <= -1) { chip = "BEARISH KUAT"; chipClass = "bear"; sentiText = "tertekan"; }
  else if (avg < -0.25) { chip = "BEARISH"; chipClass = "bear"; sentiText = "cenderung melemah"; }
  else { chip = "NETRAL / MIXED"; chipClass = "mixed"; sentiText = "bercampur tanpa arah dominan"; }
  const score = Math.max(-100, Math.min(100, Math.round(avg * 60)));
  const fC = c => (c >= 0 ? "+" : "") + c.toFixed(2).replace(".", ",") + "%";
  const p1 = `Dari ${items.length} instrumen segmen ${esc(groupName)}, ${up} menguat dan ${down} melemah. Rata-rata pergerakan ${fC(avg)} — pasar terlihat ${sentiText}.`;
  const p2 = `Penggerak utama: ${esc(topGainer.label)} naik ${fC(topGainer.change)} ke ${topGainer.price}, sementara ${esc(topLoser.label)} turun ${fC(topLoser.change)}.`;
  const p3 = chipClass === "bull"
    ? "Momentum positif yang bertahan biasanya menarik minat beli lanjutan. Cermati level terbaru instrumen penggerak sebagai acuan sebelum mengambil posisi."
    : chipClass === "bear"
      ? "Tekanan jual mendominasi — pendekatan defensif dan pemantauan ketat terhadap level harga lebih disarankan."
      : "Pasar tidak menunjukkan arah tunggal; strategi selektif per instrumen lebih tepat daripada posisi menyeluruh.";
  return `
    <div class="ai-head"><span class="ai-badge">ANALISIS AI · ${esc(groupName).toUpperCase()}</span><button class="ai-close" onclick="closeAiAnalysis()" aria-label="Tutup">✕</button></div>
    <div class="ai-senti"><span>Sentimen</span><span class="ai-chip ${chipClass}">${chip}</span><span class="ai-score">Skor ${score >= 0 ? "+" : ""}${score}</span></div>
    <div class="ai-scorebar"><div class="ai-scorefill" style="width:${Math.round((score + 100) / 2)}%"></div></div>
    <p class="ai-p">${p1}</p>
    <p class="ai-p">${p2}</p>
    <p class="ai-p">${p3}</p>
    <div class="ai-movers"><div class="ai-mover"><span>PENGGERAK NAIK</span><strong class="up">${esc(topGainer.label)} · ${fC(topGainer.change)}</strong></div><div class="ai-mover"><span>PENGGERAK TURUN</span><strong class="down">${esc(topLoser.label)} · ${fC(topLoser.change)}</strong></div></div>
    <div class="ai-list">${items.map(x => `<div class="ai-item"><span>${esc(x.label)}</span><strong class="${x.change < 0 ? "down" : "up"}">${x.price} ${x.change >= 0 ? "▲" : "▼"} ${fC(x.change)}</strong></div>`).join("")}</div>
    <p class="ai-disclaimer">Dihasilkan otomatis dari data pasar terbaru (${wibNow()} WIB) oleh mesin analitik Kodya — bukan rekomendasi investasi.</p>
    <button class="ai-regen" onclick="regenerateAiAnalysis()">↻ Segarkan Analisis</button>`;
}
function generateAiAnalysis() {
  const panel = document.getElementById("ai-panel");
  if (!panel || !panel.classList.contains("open")) return;
  panel.innerHTML = `<div class="ai-loading"><span class="ai-spinner"></span> Menganalisis data pasar ${esc(activeMarket)}...</div>`;
  clearTimeout(window.__aiTimer);
  window.__aiTimer = setTimeout(() => {
    if (!panel.classList.contains("open")) return;
    panel.innerHTML = aiAnalysisHtml(activeMarket);
  }, 650);
}
window.toggleAiAnalysis = () => {
  const panel = document.getElementById("ai-panel");
  const btn = document.getElementById("ai-btn");
  if (!panel) return;
  const open = panel.classList.toggle("open");
  if (btn) btn.classList.toggle("active", open);
  if (open) generateAiAnalysis();
};
window.closeAiAnalysis = () => {
  clearTimeout(window.__aiTimer);
  const panel = document.getElementById("ai-panel");
  const btn = document.getElementById("ai-btn");
  if (panel) panel.classList.remove("open");
  if (btn) btn.classList.remove("active");
};
window.regenerateAiAnalysis = () => { generateAiAnalysis(); };

// ---------- Analisis AI Fundamental (halaman Pasar & Data) ----------
// Faktor fundamental per instrumen: [teks, arah] — arah 1 = mendukung naik, -1 = mendukung turun, 0 = netral.
const FUNDAMENTALS = {
  "IDX:COMPOSITE": {
    label: "IHSG",
    name: "Indeks Harga Saham Gabungan (BEI)",
    note: "",
    factors: [
      ["BI Rate 5,75% — arah kebijakan mulai longgar dari puncak 6,00%", 1],
      ["Inflasi 2,88% — terkendali di bawah batas atas target 3,5%", 1],
      ["Proyeksi pertumbuhan ekonomi 2026 sebesar 5,6–6,0%", 1],
      ["Cadangan devisa US$145 miliar — bantalan eksternal kuat", 1],
      ["Valuasi PER indeks sekitar 14x — di bawah rata-rata 5 tahun", 1],
      ["Aliran dana asing kembali masuk (net buy) di pasar saham", 1],
      ["Risiko eksternal: ketidakpastian kebijakan The Fed & tensi dagang", -1]
    ]
  },
  "FX_IDC:USDIDR": {
    label: "USD/IDR",
    name: "Nilai tukar dolar AS terhadap Rupiah",
    note: "Catatan: untuk USD/IDR, prediksi \"turun\" berarti Rupiah menguat terhadap dolar AS.",
    factors: [
      ["BI Rate 5,75% — masih menarik aliran masuk (carry trade)", -1],
      ["Cadangan devisa US$145 miliar — likuiditas valas aman", -1],
      ["Inflasi domestik 2,88% — tekanan harga terkendali", -1],
      ["Neraca perdagangan tetap surplus", -1],
      ["Indeks dolar (DXY) masih berada di zona tinggi", 1],
      ["Ekspektasi The Fed mulai memangkas suku bunga", -1]
    ]
  },
  "OANDA:XAUUSD": {
    label: "Emas",
    name: "Harga emas dunia (XAU/USD)",
    note: "",
    factors: [
      ["Ekspektasi pemangkasan suku bunga The Fed mendukung aset non-bunga", 1],
      ["Bank sentral global terus menambah cadangan emas", 1],
      ["Ketegangan geopolitik mendorong permintaan safe haven", 1],
      ["Dolar AS & yield obligasi mulai melemah", 1],
      ["Permintaan investasi ritel (ETF emas) meningkat", 1],
      ["Inflasi global mereda — menekan daya tarik lindung nilai", -1]
    ]
  },
  "BINANCE:BTCUSDT": {
    label: "Bitcoin",
    name: "Bitcoin (BTC/USDT)",
    note: "",
    factors: [
      ["Arus masuk bersih ETF spot Bitcoin terus berlanjut", 1],
      ["Siklus pasca-halving — pasokan bitcoin baru semakin terbatas", 1],
      ["Adopsi institusional & perusahaan makin luas", 1],
      ["Likuiditas global membaik seiring suku bunga turun", 1],
      ["Kejelasan regulasi kripto meningkat", 1],
      ["Potensi profit taking di dekat level tertinggi", -1]
    ]
  },
  "BINANCE:ETHUSDT": {
    label: "Ethereum",
    name: "Ethereum (ETH/USDT)",
    note: "",
    factors: [
      ["Arus masuk ETF spot Ethereum meningkat", 1],
      ["Aktivitas jaringan & DeFi (on-chain) kembali tumbuh", 1],
      ["Upgrade jaringan Pectra meningkatkan efisiensi & skalabilitas", 1],
      ["Sebagian pasokan ETH terkunci di staking", 1],
      ["Likuiditas global membaik mendukung aset kripto", 1],
      ["Persaingan ketat dari layer-1 lain (Solana, dll.)", -1]
    ]
  }
};
function tvAiAnalysisHtml(symbol) {
  const f = FUNDAMENTALS[symbol] || FUNDAMENTALS["IDX:COMPOSITE"];
  const up = f.factors.filter(x => x[1] > 0).length;
  const down = f.factors.filter(x => x[1] < 0).length;
  const neutral = f.factors.length - up - down;
  const verdictUp = up > down;
  const confidence = up + down > 0 ? Math.round((Math.max(up, down) / (up + down)) * 100) : 50;
  const chip = verdictUp ? "DIPERKIRAKAN NAIK" : "DIPERKIRAKAN TURUN";
  const chipClass = verdictUp ? "bull" : "bear";
  const p1 = `Dari ${f.factors.length} indikator fundamental yang dievaluasi, ${up} mendukung kenaikan, ${down} mendukung penurunan${neutral ? `, dan ${neutral} netral` : ""}. Berdasarkan data ini, ${f.name} diperkirakan <strong>${chip}</strong> dalam jangka pendek–menengah.`;
  const p2 = f.note ? `<p class="ai-p">${esc(f.note)}</p>` : "";
  return `
    <div class="ai-head"><span class="ai-badge">ANALISIS AI · FUNDAMENTAL · ${esc(f.label).toUpperCase()}</span><button class="ai-close" onclick="closeTvAiAnalysis()" aria-label="Tutup">✕</button></div>
    <div class="ai-senti"><span>Prediksi</span><span class="ai-chip ${chipClass}">${chip}</span><span class="ai-score">Keyakinan ${confidence}%</span></div>
    <div class="ai-scorebar"><div class="ai-scorefill" style="width:${confidence}%"></div></div>
    <p class="ai-p">${p1}</p>
    ${p2}
    <div class="ai-list">${f.factors.map(([text, dir]) => `<div class="ai-item"><span>${esc(text)}</span><strong class="${dir < 0 ? "down" : dir > 0 ? "up" : ""}">${dir > 0 ? "▲" : dir < 0 ? "▼" : "●"} ${dir > 0 ? "Mendukung naik" : dir < 0 ? "Mendukung turun" : "Netral"}</strong></div>`).join("")}</div>
    <p class="ai-disclaimer">Dihasilkan otomatis dari data fundamental terbaru (${wibNow()} WIB) oleh mesin analitik Kodya — bukan rekomendasi investasi.</p>
    <button class="ai-regen" onclick="regenerateTvAiAnalysis()">↻ Segarkan Analisis</button>`;
}
function generateTvAiAnalysis() {
  const panel = document.getElementById("tv-ai-panel");
  if (!panel || !panel.classList.contains("open")) return;
  const f = FUNDAMENTALS[activeSymbol] || FUNDAMENTALS["IDX:COMPOSITE"];
  panel.innerHTML = `<div class="ai-loading"><span class="ai-spinner"></span> Menganalisis data fundamental ${esc(f.label)}...</div>`;
  clearTimeout(window.__tvAiTimer);
  window.__tvAiTimer = setTimeout(() => {
    if (!panel.classList.contains("open")) return;
    panel.innerHTML = tvAiAnalysisHtml(activeSymbol);
  }, 650);
}
window.toggleTvAiAnalysis = () => {
  const panel = document.getElementById("tv-ai-panel");
  const btn = document.getElementById("tv-ai-btn");
  if (!panel) return;
  const open = panel.classList.toggle("open");
  if (btn) btn.classList.toggle("active", open);
  if (open) generateTvAiAnalysis();
};
window.closeTvAiAnalysis = () => {
  clearTimeout(window.__tvAiTimer);
  const panel = document.getElementById("tv-ai-panel");
  const btn = document.getElementById("tv-ai-btn");
  if (panel) panel.classList.remove("open");
  if (btn) btn.classList.remove("active");
};
window.regenerateTvAiAnalysis = () => { generateTvAiAnalysis(); };

// ---------- Grafik TradingView real-time ----------
const TV_SYMBOLS = [
  { label: "IHSG", symbol: "IDX:COMPOSITE", market: "idx", interval: "60" },
  { label: "USD/IDR", symbol: "FX_IDC:USDIDR", market: "fx", interval: "240" },
  { label: "Emas", symbol: "OANDA:XAUUSD", market: "fx", interval: "60" },
  { label: "Bitcoin", symbol: "BINANCE:BTCUSDT", market: "crypto", interval: "60" },
  { label: "Ethereum", symbol: "BINANCE:ETHUSDT", market: "crypto", interval: "60" }
];
let activeSymbol = "IDX:COMPOSITE";
let tvScriptPromise = null;
function wibNow() { return new Date().toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", second: "2-digit" }); }

// ---------- Jam perdagangan per pasar (WIB) ----------
const TV_MARKETS = {
  idx: {
    name: "Bursa Efek Indonesia",
    session: "Sesi reguler Senin–Jumat · 09.00–15.30 WIB",
    closedCopy: "Bursa Efek Indonesia sedang di luar jam perdagangan.",
    nextOpen(day, minutes) {
      if (day === 0 || day === 6) return "Senin, pukul 09.00 WIB";
      if (minutes < 9 * 60) return "hari ini pukul 09.00 WIB";
      const nxt = day === 5 ? 1 : day + 1;
      return `${["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][nxt]}, pukul 09.00 WIB`;
    }
  },
  fx: {
    name: "Pasar Valuta Asing & Komoditas",
    session: "24 jam Senin–Jumat · tutup akhir pekan",
    closedCopy: "Pasar valuta asing dan komoditas sedang tutup akhir pekan.",
    nextOpen(day, minutes) {
      return day === 1 && minutes < 5 * 60 ? "hari ini pukul 05.00 WIB" : "Senin, pukul 05.00 WIB";
    }
  }
};
function wibParts() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(new Date());
  const get = t => (parts.find(p => p.type === t) || {}).value || "";
  return {
    day: { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 }[get("weekday")],
    minutes: (parseInt(get("hour"), 10) || 0) * 60 + (parseInt(get("minute"), 10) || 0)
  };
}
function marketStatus(tvSymbol) {
  const meta = TV_SYMBOLS.find(s => s.symbol === tvSymbol) || {};
  const cfg = TV_MARKETS[meta.market];
  if (!cfg) return { open: true };
  const { day, minutes } = wibParts();
  const open = meta.market === "idx"
    ? day >= 1 && day <= 5 && minutes >= 9 * 60 && minutes < 15 * 60 + 30
    : !(day === 0 || (day === 6 && minutes >= 4 * 60) || (day === 1 && minutes < 5 * 60));
  return { open, cfg, day, minutes };
}
function closedChartHtml(cfg, nextOpen) {
  return `
    <div class="tv-closed">
      <h3>Pasar Sedang Tutup</h3>
      <p class="tv-closed-sub">${cfg.closedCopy}</p>
      <p class="tv-closed-next">Perdagangan akan kembali dibuka <strong>${nextOpen}</strong></p>
      <p class="tv-closed-session">${cfg.session}</p>
      <p class="tv-closed-note">Sementara menunggu pembukaan, kripto berjalan 24/7 — coba tab Bitcoin atau Ethereum untuk melihat grafik langsung.</p>
    </div>`;
}
function tradingViewSection(active) {
  return `
  <section class="tv-chart-section">
    <div class="tv-tabs" role="tablist" aria-label="Pilih instrumen">
      ${TV_SYMBOLS.map(s => `<button class="tv-tab ${s.symbol === active ? "active" : ""}" data-symbol="${s.symbol}" onclick="switchTradingSymbol('${s.symbol}')">${s.label}</button>`).join("")}
    </div>
    <div class="tv-chart" id="tv-chart"></div>
    <div class="tv-ai">
      <button class="ai-btn" id="tv-ai-btn" onclick="toggleTvAiAnalysis()"><span>Analisis AI Fundamental</span><span class="ai-btn-arrow">▶</span></button>
      <div class="ai-panel" id="tv-ai-panel"></div>
    </div>
  </section>`;
}
function loadTradingView() {
  if (window.TradingView) return Promise.resolve();
  if (!tvScriptPromise) {
    tvScriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://s3.tradingview.com/tv.js";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Gagal memuat TradingView"));
      document.head.appendChild(s);
    });
  }
  return tvScriptPromise;
}
function disposeTradingView() {
  if (window.__tvWidget && typeof window.__tvWidget.remove === "function") {
    try { window.__tvWidget.remove(); } catch { /* ignore */ }
  }
  window.__tvWidget = null;
}
async function initTradingView(containerId, symbol) {
  const el = document.getElementById(containerId);
  if (!el) return;
  disposeTradingView();
  const st = marketStatus(symbol);
  if (!st.open) {
    el.innerHTML = closedChartHtml(st.cfg, st.cfg.nextOpen(st.day, st.minutes));
    return;
  }
  el.innerHTML = `<div class="tv-loading">Memuat grafik real-time...</div>`;
  try {
    await loadTradingView();
    if (!document.getElementById(containerId)) return;
    el.innerHTML = "";
    window.__tvWidget = new TradingView.widget({
      container_id: containerId,
      autosize: true,
      symbol,
      interval: (TV_SYMBOLS.find(s => s.symbol === symbol) || {}).interval || "60",
      timezone: "Asia/Jakarta",
      theme: "light",
      style: "1",
      locale: "id_ID",
      backgroundColor: "rgba(255,255,255,1)",
      gridColor: "rgba(222,219,211,1)",
      hide_legend: true,
      allow_symbol_change: false,
      save_image: false,
      details: false,
      hotlist: false,
      calendar: false,
      studies: [],
      show_popup_button: false,
      withdateranges: false,
      hide_top_toolbar: true,
      hide_side_toolbar: true
    });
  } catch {
    if (document.getElementById(containerId)) el.innerHTML = `<div class="tv-loading">Grafik tidak dapat dimuat. Periksa koneksi internet Anda.</div>`;
  }
}
window.switchTradingSymbol = symbol => {
  activeSymbol = symbol;
  document.querySelectorAll(".tv-tab").forEach(b => b.classList.toggle("active", b.dataset.symbol === symbol));
  initTradingView("tv-chart", symbol);
  const tvPanel = document.getElementById("tv-ai-panel");
  if (tvPanel && tvPanel.classList.contains("open")) generateTvAiAnalysis();
};

const TICKER_DEFS = [
  ["IHSG", "^JKSE", "6.319,61", "+1,37%"],
  ["USD/IDR", "IDR=X", "18.027", "-0,17%"],
  ["BTC", "BTC-USD", "64.157", "+1,00%"],
  ["Gold", "GC=F", "4.080,50", "+0,31%"]
];
function tickerItems() {
  const items = TICKER_DEFS.map(([label, symbol, fPrice, fPct]) => {
    const q = window.__marketQuotes && window.__marketQuotes[symbol];
    const down = q ? q.change < 0 : fPct.startsWith("-");
    const price = q ? fmtPrice(q.price) : fPrice;
    const pct = (q ? pctFrom(q.change) : fPct).replace(/^\+/, "");
    return `<span>${label} ${price} <span class="${down ? "down" : "up"}">${down ? "▼" : "▲"} ${pct}</span></span>`;
  }).join("");
  return `<span class="market-live">● LIVE MARKET</span>${items}`;
}
function marketStrip() { return `<div class="market-strip"><div class="shell market-inner"><div class="ticker-items" id="ticker-items">${tickerItems()}</div></div></div>`; }
function publicChrome(content, route = "") {
  const active = route ? route.toLowerCase() : "beranda";
  const breaking = published().filter(a => a.breaking).slice(0, 3);
  return `
    ${marketStrip()}
    <header class="site-header"><div class="shell brand-row"><div class="brand-block"><a class="brand" href="#/">kodya<em>.id</em></a><span class="brand-tagline">Information Beyond Limits</span></div><form class="search" onsubmit="searchFromHeader(event)"><span class="search-icon">⌕</span><input name="q" placeholder="Cari berita, analisis, data, atau topik..."/><button hidden>Cari</button></form><div class="header-actions"><a href="#/newsletter">Newsletter</a>${session() ? `<a class="header-user" href="${session().role === "Pembaca" ? "#/profil" : "#/admin"}"><img class="avatar" src="${esc(session().avatar || DEFAULT_AVATAR)}" alt=""><span>${esc(session().name || "Akun")}</span></a><a class="header-logout" href="#/admin/login" onclick="logout()">Keluar</a>` : `<a href="#/admin/login">Masuk</a>`}<a class="button" href="#/indeks-pro">Berlangganan</a></div></div></header>
    <nav class="nav-wrap"><div class="shell main-nav"><div class="nav-links">${categoriesList().map(c => `<a class="nav-link ${active === c.toLowerCase() || (active === "pasar-data" && c === "Pasar & Data") ? "active" : ""}" href="${categoryPath(c)}">${c.toUpperCase()}</a>`).join("")}<a class="nav-link ${active === "forum" ? "active" : ""}" href="#/forum">FORUM DISKUSI</a></div><button class="menu-button" onclick="toggleMobileMenu()" aria-label="Buka menu kategori"><span></span><span></span><span></span></button></div><div class="mobile-menu" id="mobile-menu">${categoriesList().map(c => `<a class="mobile-link" href="${categoryPath(c)}" onclick="closeMobileMenu()">${c}</a>`).join("")}<a class="mobile-link" href="#/forum" onclick="closeMobileMenu()">Forum Diskusi</a>${session() ? `<a class="mobile-link" href="${session().role === "Pembaca" ? "#/profil" : "#/admin"}" onclick="closeMobileMenu()">Akun Saya</a><a class="mobile-link" href="#/admin/login" onclick="logout()">Keluar</a>` : `<a class="mobile-link" href="#/admin/login" onclick="closeMobileMenu()">Masuk</a>`}</div></nav>
    <div class="breaking"><div class="shell breaking-inner"><span class="breaking-badge">ϟ BREAKING NEWS</span><div class="breaking-list">${breaking.length ? breaking.map(a => `<a href="#/artikel/${a.id}">${esc(a.title)}</a>`).join("") : "<span>Tidak ada breaking news saat ini.</span>"}</div><a href="#/search" class="all-link">Lihat semua →</a></div></div>
    ${content}
    ${footer()}`;
}

function footer() { return `<footer class="footer"><div class="shell"><div class="footer-grid"><div><div class="brand-block"><a href="#/" class="brand">kodya<em>.id</em></a><span class="brand-tagline">Information Beyond Limits</span></div><div class="social-links"><a href="https://www.instagram.com/kodya.id?igsh=ZXA3YTU1YzM2Zmph&amp;utm_source=qr" target="_blank" rel="noopener" aria-label="Instagram @kodya.id" title="Instagram @kodya.id"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg></a><a href="https://www.tiktok.com/@kodyamedia?_r=1&amp;_t=ZS-98veeAfg4CT" target="_blank" rel="noopener" aria-label="TikTok @kodyamedia" title="TikTok @kodyamedia"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"></path></svg></a></div></div><div><h4>Navigasi</h4><ul><li><a href="#/kategori/politik">Politik</a></li><li><a href="#/kategori/ekonomi">Ekonomi</a></li><li><a href="#/kategori/bisnis">Bisnis</a></li><li><a href="#/kategori/teknologi">Teknologi</a></li><li><a href="#/kategori/kripto">Kripto</a></li></ul></div><div><h4>Informasi</h4><ul><li>Tentang Kami</li><li>Redaksi</li><li>Kontak</li><li>Pedoman Media Siber</li><li>Kebijakan Privasi</li></ul></div><div><h4>Newsletter</h4><p>Dapatkan ringkasan berita penting setiap hari.</p><form class="newsletter" onsubmit="newsletter(event)"><input required type="email" placeholder="Email Anda"/><button>→</button></form></div></div><div class="copyright">© 2026 Kodya.id. Semua hak dilindungi.</div></div></footer>`; }

function marketCard() { return `<aside class="market-card"><div class="market-heading"><span>PASAR HARI INI</span><span class="live">● LIVE</span></div><div class="tabs">${["Indonesia", "Global", "Kripto", "Komoditas"].map(x => `<button class="tab ${x === activeMarket ? "active" : ""}" onclick="switchMarket('${x}')">${x}</button>`).join("")}</div><div id="market-rows">${marketRows(activeMarket)}</div><button class="ai-btn" id="ai-btn" onclick="toggleAiAnalysis()"><span>Analisis AI</span><span class="ai-btn-arrow">▶</span></button><div class="ai-panel" id="ai-panel"></div><a href="#/kategori/pasar-data" class="market-full">Lihat Data Lengkap →</a></aside>`; }

function storyCard(a) { return `<article class="story-card"><a href="#/artikel/${a.id}" class="story-image">${a.breaking ? `<span class="breaking-badge-card">ϟ BREAKING</span>` : ""}<img src="${a.image || IMAGE.city}" alt="" loading="lazy"></a><span class="tag">${esc(a.category)}</span><a href="#/artikel/${a.id}"><h3>${esc(a.title)}</h3></a><time>${esc(a.date)} · ${esc(a.author)}</time></article>`; }

function home() {
  const items = published();
  if (!items.length) {
    return publicChrome(`<main class="page homepage"><div class="shell"><div class="section-label"><span>EDISI PAGI</span></div><div class="empty" style="padding:64px 0">Belum ada berita yang dipublikasikan.</div></div></main>`);
  }
  const lead = items.find(a => a.featured) || items[0];
  const slides = [lead, ...items.filter(a => a.id !== lead.id).slice(0, 4)];
  const slideIds = new Set(slides.map(s => s.id));
  const supporting = items.filter(a => !slideIds.has(a.id)).slice(0, 3);
  // Breaking news didahulukan, sisanya diisi pilihan redaksi agar grid tetap penuh.
  const editorial = items.filter(a => a.breaking).concat(items.filter(a => !a.breaking && ["Politik", "Bisnis", "Internasional", "Teknologi"].includes(a.category))).slice(0, 4);
  const supportingIds = new Set(supporting.map(s => s.id));
  const trends = items.filter(a => !slideIds.has(a.id) && !supportingIds.has(a.id)).slice(0, 4);
  return publicChrome(`
    <main class="page homepage">
      <div class="shell">
        <div class="section-label"><span>EDISI PAGI</span></div>
        <div class="hero">
          <article class="hero-feature" id="hero-feature">
            <div class="hero-track" id="hero-track">${slides.map((a, i) => heroSlide(a, i)).join("")}</div>
            <div class="hero-controls" aria-label="Navigasi slide"><button class="hero-arrow" onclick="heroPrev()" aria-label="Slide sebelumnya">←</button><span class="hero-count" id="hero-count" aria-live="polite">01 / ${String(slides.length).padStart(2, "0")}</span><button class="hero-arrow" onclick="heroNext()" aria-label="Slide berikutnya">→</button></div>
          </article>
          ${marketCard()}
        </div>
        <div class="under-hero"><div class="mini-grid">${supporting.map(a => `<article class="mini-card"><a href="#/artikel/${a.id}" class="mini-image"><img src="${a.image || IMAGE.city}" alt="" loading="lazy"></a><span class="tag">${esc(a.category)}</span><a href="#/artikel/${a.id}"><h3>${esc(a.title)}</h3></a><p>${esc(a.date)} · ${esc(a.author)}</p></article>`).join("")}</div><section class="trending"><h2>TRENDING</h2>${trends.map((a,i) => `<a href="#/artikel/${a.id}" class="trend-item"><span class="trend-no">0${i+1}</span><span><span class="trend-title">${esc(a.title)}</span><span class="trend-meta">${a.views} views · ${esc(a.date)}</span></span></a>`).join("")}</section></div>
        <section class="section"><div class="section-head"><h2>Breaking News</h2><a href="#/search">Lihat Semua →</a></div><div class="editorial-grid">${editorial.map(storyCard).join("")}</div></section>
      </div>
    </main>`);
}

function heroSlide(a, i) {
  return `<article class="hero-slide" ${i > 0 ? `aria-hidden="true"` : ""}><div class="hero-copy"><span class="tag">HEADLINE · ${esc(a.category)}</span><h1>${esc(a.title)}</h1><p class="hero-summary">${esc(a.excerpt)}</p><div class="byline"><strong>${esc(a.author)}</strong><br>${esc(a.updatedAt || a.date)}</div><a href="#/artikel/${a.id}" class="read-more">Baca Selengkapnya →</a></div><img class="hero-img" src="${a.image || IMAGE.city}" alt="${esc(a.title)}" loading="${i === 0 ? "eager" : "lazy"}"></article>`;
}
let __heroIndex = 0;
function heroGo(i) {
  const track = document.getElementById("hero-track");
  if (!track || !track.children.length) return;
  const n = track.children.length;
  __heroIndex = ((i % n) + n) % n;
  track.style.transform = `translateX(-${__heroIndex * 100}%)`;
  track.querySelectorAll(".hero-slide").forEach((s, k) => {
    if (k === __heroIndex) s.removeAttribute("aria-hidden");
    else s.setAttribute("aria-hidden", "true");
  });
  const count = document.getElementById("hero-count");
  if (count) count.textContent = `${String(__heroIndex + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}`;
}
window.heroPrev = () => heroGo(__heroIndex - 1);
window.heroNext = () => heroGo(__heroIndex + 1);
function startHeroSlider() {
  clearInterval(window.__heroTimer);
  const feature = document.getElementById("hero-feature");
  const track = document.getElementById("hero-track");
  if (!feature || !track) return;
  const controls = feature.querySelector(".hero-controls");
  if (track.children.length <= 1) {
    if (controls) controls.style.display = "none";
    return;
  }
  if (controls) controls.style.display = "";
  heroGo(0);
  const arm = () => {
    clearInterval(window.__heroTimer);
    window.__heroTimer = setInterval(() => {
      if (!document.getElementById("hero-track")) { clearInterval(window.__heroTimer); window.__heroTimer = null; return; }
      heroGo(__heroIndex + 1);
    }, 7000);
  };
  arm();
  feature.onmouseenter = () => clearInterval(window.__heroTimer);
  feature.onmouseleave = arm;
}
const relatedMap = {
  Politik: ["Ekonomi", "Bisnis", "Internasional"],
  Ekonomi: ["Pasar & Data", "Bisnis"],
  Bisnis: ["Ekonomi", "Pasar & Data"],
  "Pasar & Data": ["Ekonomi", "Bisnis", "Kripto"],
  Teknologi: ["Ekonomi", "Bisnis"],
  Kripto: ["Pasar & Data", "Teknologi"],
  Internasional: ["Ekonomi", "Pasar & Data"],
  Opini: ["Ekonomi", "Pasar & Data", "Politik"],
  Podcast: ["Ekonomi", "Pasar & Data", "Opini"],
  Video: ["Ekonomi", "Pasar & Data", "Teknologi"]
};
function genericPage(name) {
  const normalized = name === "Pasar Data" ? "Pasar & Data" : name;
  const all = published();
  // Halaman kategori hanya menampilkan berita sesuai kategorinya sendiri (tidak diisi berita kategori lain).
  const list = normalized === "Indeks PRO" ? all : all.filter(a => a.category === normalized);
  const lead = list[0];
  const desc = {Politik:"Perkembangan politik Indonesia dan dunia dalam perspektif yang lebih luas.", Ekonomi:"Membaca arah ekonomi Indonesia dan global melalui data serta analisis yang tajam.", Bisnis:"Kabar perusahaan, industri, investasi, dan para penggerak ekonomi Indonesia.", "Pasar & Data":"Data pasar, pergerakan aset, dan insight untuk setiap keputusan finansial.", Teknologi:"Inovasi, produk, dan pemikiran yang membentuk masa depan digital.", Kripto:"Blockchain, aset digital, regulasi, dan dinamika pasar kripto.", Internasional:"Dunia bergerak cepat. Kami membantu Anda memahami dampaknya.", Opini:"Ruang opini publik — sampaikan pandangan Anda dan baca pandangan sesama pembaca.", Podcast:"Percakapan panjang untuk isu yang layak didengarkan.", Video:"Cerita, wawancara, dan penjelasan visual pilihan redaksi.", "Indeks PRO":"Analisis eksklusif, market intelligence, dan riset mendalam untuk anggota Kodya PRO."}[normalized] || "Berita dan analisis terkurasi dari Kodya.id.";
  const special = normalized === "Pasar & Data" ? tradingViewSection("IDX:COMPOSITE") + `<section class="section"><div class="section-head"><h2>Economic Dashboard</h2><span class="meta">Data pembaruan terakhir · ${wibNow()} WIB</span></div><div class="metric-grid" style="background:var(--night);color:white;padding:0 20px">${[["Inflasi (Juli)","2,88%"],["BI Rate","5,75%"],["GDP Growth 2026F","5,6–6,0%"],["Rupiah","18.027"],["Cadangan Devisa","US$145 M"]].map(x=>`<div class="metric"><span>${x[0]}</span><strong>${x[1]}</strong><small class="up">▲ Positif</small></div>`).join("")}</div></section>` : normalized === "Indeks PRO" ? `<section class="section" style="background:var(--night);color:white;padding:34px"><span class="tag">KODYA PRO</span><h2 style="font:38px var(--serif);margin:10px 0">Keunggulan informasi untuk keputusan yang lebih tajam.</h2><p style="color:#bbb6c5;max-width:600px;font-size:14px;line-height:1.6">Dapatkan exclusive analysis, market intelligence, deep research, dan premium data dari newsroom Kodya.</p><a class="button" href="#/newsletter">Berlangganan Kodya PRO</a></section>` : "";
  const layout = normalized === "Opini"
    ? `<div class="opini-forum">${opinionSection()}</div>`
    : !lead
      ? `<div class="empty" style="padding:60px 0">Belum ada berita di kategori ini.</div>`
      : `<div class="category-layout"><div><article class="category-lead"><img src="${lead.image}" alt=""><div class="category-lead-copy"><span class="tag">${esc(lead.category)}</span><a href="#/artikel/${lead.id}"><h2>${esc(lead.title)}</h2></a><p>${esc(lead.excerpt)}</p><span class="meta">${esc(lead.author)} · ${esc(lead.date)}</span></div></article><section class="article-list"><div class="section-label"><span>TERBARU</span></div>${list.slice(1).map(listItem).join("")}</section></div><aside>${sidebars(all)}</aside></div>`;
  return publicChrome(`<main class="page"><div class="shell"><header class="category-title"><span class="tag">KODYA.ID</span><h1>${esc(normalized)}</h1><p>${desc}</p></header>${special}${layout}</div></main>`, normalized);
}

function listItem(a) { return `<article class="list-item"><a href="#/artikel/${a.id}"><img src="${a.image || IMAGE.city}" alt="" loading="lazy"></a><div><span class="tag">${esc(a.category)}</span><a href="#/artikel/${a.id}"><h3>${esc(a.title)}</h3></a><p>${esc(a.excerpt)}</p><span class="meta">${esc(a.author)} · ${esc(a.date)} · ${esc(a.views)} views</span></div></article>`; }

// ---------- Opini Publik (halaman Opini) ----------
// Fitur opini: publik menulis pandangan, murni untuk dibaca (tanpa balasan/komentar/vote).
function opinionSection() { const items = opinionsList(); const me = session(); return `
  <section class="forum" id="opini">
    <div class="section-head"><h2>Opini Publik</h2><a href="#opini" class="meta">${items.length} opini · bagikan pandangan Anda</a></div>
    ${me ? `<div class="forum-new"><h3>Tulis Opini Anda</h3><div class="forum-poster"><img class="avatar" src="${esc(me.avatar || DEFAULT_AVATAR)}" alt=""><span>${esc(me.name || "")}</span></div><form onsubmit="postOpinion(event)"><div class="forum-fields"><input name="title" placeholder="Judul opini" required></div><textarea name="message" rows="3" placeholder="Tulis pandangan Anda untuk publik..." required></textarea><button class="button">Kirim Opini</button></form></div>` : `<div class="forum-login-note">Login untuk menulis opini — <a href="#/admin/login">Masuk</a> atau <a href="#/register">Daftar akun</a></div>`}
    <div class="forum-list">${items.length ? items.map(t => opinionCard(t)).join("") : `<div class="empty">Belum ada opini. Jadilah yang pertama!</div>`}</div>
  </section>`; }
function opinionCard(t) {
  return `<article class="forum-thread" id="opinion-${t.id}"><div class="forum-body"><div class="forum-thread-head"><img class="avatar forum-avatar" src="${esc(t.avatar || DEFAULT_AVATAR)}" alt=""><div><span class="tag">OPINI</span><h3 id="opinion-title-${t.id}">${esc(t.title)}</h3><span class="meta">${esc(t.author)} · ${esc(t.date)}</span></div></div><p class="forum-message">${esc(t.message)}</p></div><div class="forum-actions"><button class="thread-act" onclick="shareMenu(event, ${t.id})" aria-label="Bagikan opini" aria-expanded="false" aria-haspopup="menu">↗</button><button class="thread-act del" onclick="deleteOpinion(${t.id})" aria-label="Hapus opini">✕</button><div class="share-menu" id="share-menu-${t.id}" role="menu"><button role="menuitem" onclick="shareOpinion(${t.id}, 'x')">X</button><button role="menuitem" onclick="shareOpinion(${t.id}, 'wa')">WhatsApp</button><button role="menuitem" onclick="shareOpinion(${t.id}, 'copy')">Salin tautan</button></div></div></article>`;
}
window.scrollToOpinion = id => {
  const el = document.getElementById(`opinion-${id}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.classList.add("flash");
  setTimeout(() => el.classList.remove("flash"), 1600);
};
window.deleteOpinion = id => {
  const items = opinionsList();
  const t = items.find(x => x.id === Number(id));
  if (!t) return;
  closeShareMenus();
  confirmModal({ danger: true, title: "Hapus opini?", message: `"${(t.title || "").slice(0, 60)}" akan dihapus permanen dari halaman Opini.`, confirmLabel: "Ya, hapus", onConfirm: async () => { await saveOpinions(items.filter(x => x.id !== Number(id))); toast("Opini dihapus."); location.reload(); } });
};

// ---------- Forum Diskusi (halaman /forum) ----------
// Fitur diskusi publik dengan balasan & vote.
function forumSection() { const threads = forumThreads(); const me = session(); return `
  <section class="forum" id="forum">
    <div class="section-head"><h2>Forum Diskusi</h2><a href="#forum" class="meta">${threads.length} topik · berpartisipasilah</a></div>
    ${me ? `<div class="forum-new"><h3>Mulai diskusi baru</h3><div class="forum-poster"><img class="avatar" src="${esc(me.avatar || DEFAULT_AVATAR)}" alt=""><span>${esc(me.name || "")}</span></div><form onsubmit="postForum(event)"><div class="forum-fields"><input name="title" placeholder="Judul topik" required></div><textarea name="message" rows="3" placeholder="Tulis gagasan atau pertanyaan Anda..." required></textarea><button class="button">Kirim ke Forum</button></form></div>` : `<div class="forum-login-note">Login untuk berdiskusi — <a href="#/admin/login">Masuk</a> atau <a href="#/register">Daftar akun</a></div>`}
    <div class="forum-list">${threads.length ? threads.map(t => forumThread(t, me)).join("") : `<div class="empty">Belum ada diskusi. Jadilah yang pertama!</div>`}</div>
  </section>`; }
function forumThread(t, me) {
  const uv = Number(localStorage.getItem(`kodya-vote-${t.id}`) || 0);
  return `<article class="forum-thread" id="forum-thread-${t.id}"><div class="forum-vote"><button class="vote-btn up ${uv === 1 ? "active" : ""}" id="vote-up-${t.id}" onclick="voteForum(${t.id}, 1)" aria-label="Vote naik">▲</button><span class="vote-score" id="vote-score-${t.id}">${t.votes || 0}</span><button class="vote-btn down ${uv === -1 ? "active" : ""}" id="vote-down-${t.id}" onclick="voteForum(${t.id}, -1)" aria-label="Vote turun">▼</button></div><div class="forum-body"><div class="forum-thread-head"><img class="avatar forum-avatar" src="${esc(t.avatar || DEFAULT_AVATAR)}" alt=""><div><span class="tag">DISKUSI</span><h3 id="forum-title-${t.id}">${esc(t.title)}</h3><span class="meta">${esc(t.author)} · ${esc(t.date)}</span></div></div><p class="forum-message">${esc(t.message)}</p><div class="forum-comments">${(t.comments || []).map((c, ci) => `<div class="forum-comment"><button class="del-x" onclick="deleteForumComment(${t.id}, ${ci})" aria-label="Hapus komentar">✕</button><img class="avatar forum-avatar" src="${esc(c.avatar || DEFAULT_AVATAR)}" alt=""><div><strong>${esc(c.author)}</strong> <span class="meta">${esc(c.date)}</span><p>${esc(c.message)}</p></div></div>`).join("")}</div>${me ? `<form class="forum-reply" onsubmit="postReply(event, ${t.id})"><input name="message" placeholder="Balas diskusi ini..." required><button class="button ghost">Balas</button></form>` : `<p class="meta forum-reply-note">Login untuk membalas diskusi.</p>`}</div><div class="forum-actions"><button class="thread-act" onclick="shareMenu(event, ${t.id})" aria-label="Bagikan diskusi" aria-expanded="false" aria-haspopup="menu">↗</button><button class="thread-act del" onclick="deleteForumThread(${t.id})" aria-label="Hapus diskusi">✕</button><div class="share-menu" id="share-menu-${t.id}" role="menu"><button role="menuitem" onclick="shareForum(${t.id}, 'x')">X</button><button role="menuitem" onclick="shareForum(${t.id}, 'wa')">WhatsApp</button><button role="menuitem" onclick="shareForum(${t.id}, 'copy')">Salin tautan</button></div></div></article>`;
}
window.scrollToThread = id => {
  const el = document.getElementById(`forum-thread-${id}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.classList.add("flash");
  setTimeout(() => el.classList.remove("flash"), 1600);
};
window.deleteForumThread = id => {
  const threads = forumThreads();
  const t = threads.find(x => x.id === Number(id));
  if (!t) return;
  closeShareMenus();
  confirmModal({ danger: true, title: "Hapus diskusi?", message: `"${(t.title || "").slice(0, 60)}" akan dihapus permanen dari forum.`, confirmLabel: "Ya, hapus", onConfirm: async () => { await saveForum(threads.filter(x => x.id !== Number(id))); localStorage.removeItem(`kodya-vote-${id}`); toast("Diskusi dihapus."); location.reload(); } });
};
window.deleteForumComment = (id, ci) => {
  const threads = forumThreads();
  const t = threads.find(x => x.id === Number(id));
  if (!t || !t.comments || !t.comments[ci]) return;
  const c = t.comments[ci];
  confirmModal({ danger: true, title: "Hapus komentar?", message: `Komentar dari ${(c.author || "").slice(0, 40)} akan dihapus permanen.`, confirmLabel: "Ya, hapus", onConfirm: async () => { t.comments.splice(ci, 1); await saveForum(threads); toast("Komentar dihapus."); location.reload(); } });
};

// ---------- Halaman Forum Diskusi ----------
function forumPage() {
  return publicChrome(`<main class="page"><div class="shell"><header class="category-title"><span class="tag">KODYA.ID</span><h1>Forum Diskusi</h1><p>Ruang diskusi publik — ajukan pertanyaan, sampaikan gagasan, dan beri balasan.</p></header>${forumSection()}</div></main>`, "forum");
}

// ---------- Halaman Podcast & Video ----------
const DEMO_VIDEO = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
const DEMO_AUDIO = ["https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3"];
function videoPage() {
  const vids = published().filter(a => a.category === "Video");
  const lead = vids[0];
  return publicChrome(`<main class="page"><div class="shell"><header class="category-title"><span class="tag">KODYA.TV</span><h1>Video</h1><p>Cerita, wawancara, dan penjelasan visual pilihan redaksi.</p></header>
    ${lead ? `<div class="media-hero"><img src="${lead.image}" alt=""><div class="media-hero-play" onclick="playVideo(${lead.id})">▶</div><span class="media-duration">05:42</span><div class="media-hero-copy"><h2>${esc(lead.title)}</h2><p>${esc(lead.excerpt)}</p></div></div>` : `<div class="empty" style="padding:50px 0">Belum ada video. Video pertama akan tampil di sini.</div>`}
    <section class="section"><div class="section-head"><h2>Semua Video</h2></div><div class="video-grid">${vids.map((v, i) => `<article class="video-card"><div class="video-thumb" onclick="playVideo(${v.id})"><img src="${v.image}" alt="" loading="lazy"><span class="media-play">▶</span><span class="media-duration">${i === 0 ? "05:42" : "08:13"}</span></div><h3>${esc(v.title)}</h3><p class="meta">${esc(v.date)} · ${esc(v.views)} views</p></article>`).join("")}</div></section>
  </div></main>`, "Video");
}
function podcastPage() {
  const eps = published().filter(a => a.category === "Podcast");
  return publicChrome(`<main class="page"><div class="shell"><header class="category-title"><span class="tag">KODYA.FM</span><h1>Podcast</h1><p>Percakapan panjang untuk isu yang layak didengarkan.</p></header>
    <section class="section"><div class="section-head"><h2>Episode Terbaru</h2></div><div class="podcast-list">${eps.map((e, i) => `<article class="podcast-card"><div class="podcast-art" style="background-image:url('${e.image}')"><span class="media-play">▶</span></div><div class="podcast-body"><h3>${esc(e.title)}</h3><p>${esc(e.excerpt)}</p><span class="meta">${esc(e.date)} · ${i === 0 ? "28 menit" : "34 menit"}</span><audio controls preload="none" src="${e.media || DEMO_AUDIO[i % DEMO_AUDIO.length]}"></audio></div></article>`).join("")}</div></section>
  </div></main>`, "Podcast");
}
function sidebars(all) { return `<section class="side-box"><h3>TERPOPULER</h3>${all.slice(0,3).map((a,i) => `<a href="#/artikel/${a.id}" class="side-list"><span class="orange">0${i+1}. </span>${esc(a.title)}</a>`).join("")}</section><section class="side-box"><h3>UPDATE TERBARU</h3>${all.slice(3,6).map(a => `<a href="#/artikel/${a.id}" class="side-list">${esc(a.title)}</a>`).join("")}</section>`; }

function formatArticleBody(content) {
  const safe = esc(content || "");
  return safe.split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
}
function articlePage(id) { const a = articles().find(x => x.id === Number(id)) || published()[0]; if (!a) return publicChrome(`<main class="page"><div class="shell"><div class="empty" style="padding:80px 0">Artikel tidak ditemukan.</div></div></main>`); const rel = published().filter(x => x.id !== a.id).slice(0, 3); const role = a.category === "Podcast" ? "Produser Podcast Kodya.id" : a.category === "Video" ? "Produser Video Kodya.id" : "Reporter Kodya.id"; return publicChrome(`<main class="page"><div class="shell article-page"><header class="article-heading"><span class="tag">${esc(a.category)}</span><h1>${esc(a.title)}</h1><p class="dek">${esc(a.excerpt)}</p><div class="article-author"><img class="avatar" src="${esc(a.avatar || DEFAULT_AVATAR)}" alt=""><span><strong>${esc(a.author)}</strong><br><span class="meta">${role} · ${esc(a.date)}${a.updatedAt ? ` · Diperbarui ${esc(a.updatedAt)}` : ""}</span></span></div></header><img class="article-hero" src="${a.image || IMAGE.city}" alt=""><div class="caption">Ilustrasi: Kodya.id / Unsplash</div>${a.category === "Podcast" && a.media ? `<div class="article-media"><audio controls preload="none" src="${esc(a.media)}"></audio></div>` : a.category === "Video" && a.media ? `<div class="article-media"><video controls preload="metadata" poster="${esc(a.image || IMAGE.city)}" src="${esc(a.media)}"></video></div>` : ""}<div class="article-layout"><article class="article-body">${a.content ? formatArticleBody(a.content) : `<p>${esc(a.excerpt)}</p>`}<div class="section"><div class="section-head"><h2>Artikel Terkait</h2></div><div class="editorial-grid">${rel.map(storyCard).join("")}</div></div></article><aside><section class="article-snapshot"><h4>MARKET SNAPSHOT</h4><div><span>IHSG</span><strong class="up">6.319 ▲</strong></div><div><span>USD/IDR</span><strong class="down">18.027 ▼</strong></div><div><span>Gold</span><strong class="up">4.080 ▲</strong></div></section><div style="margin-top:30px">${sidebars(published())}</div></aside></div></div></main>`, a.category); }

function searchPage(query = "") { const q = query.trim().toLowerCase(); const result = published().filter(a => !q || `${a.title} ${a.excerpt} ${a.category}`.toLowerCase().includes(q)); return publicChrome(`<main class="page"><div class="shell search-page"><h1>Temukan perspektif baru.</h1><form class="search-big" onsubmit="doSearch(event)"><input name="q" autofocus value="${esc(query)}" placeholder="Cari berita, analisis, data, atau topik..."><button class="button">Cari</button></form><div class="search-filters"><button class="filter active">Semua</button><button class="filter">Berita</button><button class="filter">Analisis</button><button class="filter">Opini</button><button class="filter">Video</button></div><p class="meta">${q ? `${result.length} hasil untuk “${esc(query)}”` : "Artikel, analisis, data, dan percakapan Kodya.id"}</p><section class="article-list">${result.length ? result.map(listItem).join("") : `<div class="empty">Tidak ada hasil yang cocok. Coba kata kunci lain.</div>`}</section></div></main>`); }

function loginPage() { app.innerHTML = `<main class="login-page"><section class="login-box"><a class="login-back" href="#/">← Kembali ke Beranda</a><a class="brand" href="#/">kodya<em>.id</em></a><h1>Selamat datang.</h1><p>Masuk untuk mengelola newsroom, menulis opini, atau berdiskusi di forum.</p><form onsubmit="login(event)"><label>Email</label><input class="form-control" name="email" type="email" placeholder="email@domain.com" required><label>Password</label><input class="form-control" name="password" type="password" placeholder="••••••••" required><p class="login-error" id="login-error"></p><button class="button" id="login-btn">Masuk →</button></form><p class="login-alt">Belum punya akun? <a href="#/register">Daftar akun</a></p></section></main>`; }
function registerPage() { app.innerHTML = `<main class="login-page"><section class="login-box"><a class="login-back" href="#/admin/login">← Kembali ke Login</a><a class="brand" href="#/">kodya<em>.id</em></a><h1>Daftar akun.</h1><p>Buat akun untuk menulis opini, berdiskusi di forum, dan tampil dengan profil Anda.</p><form onsubmit="register(event)"><label>Nama</label><input class="form-control" name="name" placeholder="Nama Anda" required><label>Email</label><input class="form-control" name="email" type="email" placeholder="email@domain.com" required><label>Password</label><input class="form-control" name="password" type="password" minlength="6" required><p class="login-error" id="register-error"></p><button class="button" id="register-btn">Daftar →</button></form></section></main>`; }
function profilPage() {
  const me = session() || {};
  const myName = String(me.name || "").toLowerCase();
  const myOpinions = opinionsList().filter(t => t.author && String(t.author).toLowerCase() === myName);
  const myThreads = forumThreads().filter(t => t.author && String(t.author).toLowerCase() === myName);
  return publicChrome(`<main class="page"><div class="shell profile-page"><header class="category-title"><span class="tag">PROFIL</span><h1>${esc(me.name || "Akun")}</h1></header><section class="profile-card"><img class="avatar profile-avatar" id="profile-avatar" src="${esc(me.avatar || DEFAULT_AVATAR)}" alt=""><div class="profile-info"><p class="meta">${esc(me.email || "")} · ${esc(me.role || "")}</p><p class="panel-subtitle">Akun ini dipakai untuk menulis opini dan berdiskusi di forum Kodya.</p><button class="button ghost" type="button" onclick="document.getElementById('profile-file').click()">Ubah Foto Profil</button><input type="file" id="profile-file" accept="image/*" hidden onchange="uploadProfilePhoto(this)"></div></section><form class="editor" onsubmit="updateProfile(event)"><section class="form-card"><div><label>Nama tampilan</label><input class="form-control" name="name" value="${esc(me.name || "")}" required></div><button class="button">Simpan Profil</button><p class="login-error" id="profile-msg"></p></section></form><button class="button ghost" style="margin-top:14px" onclick="logout()">Keluar dari Akun</button><section class="section"><div class="section-head"><h2>Opini Saya</h2></div>${myOpinions.length ? myOpinions.map(t => opinionCard(t)).join("") : `<p class="empty">Belum ada opini yang Anda tulis.</p>`}</section><section class="section"><div class="section-head"><h2>Diskusi Saya</h2></div>${myThreads.length ? myThreads.map(t => forumThread(t, me)).join("") : `<p class="empty">Belum ada topik yang Anda buat di forum.</p>`}</section></div></main>`);
}

function adminChrome(content, section = "dashboard") {
  const me = session() || {};
  const isAdmin = me.role === "Super Admin";
  const allGroups = [
    ["OVERVIEW", [["Dashboard", "dashboard"]]],
    ["CONTENT", [["Semua Berita", "articles"], ["Tambah Berita", "new"], ["Tambah Podcast", "new-podcast"], ["Tambah Video", "new-video"], ["Draft", "drafts"], ["Terjadwal", "scheduled"]]],
    ["EDITORIAL & ANALYTICS", [["Media Library", "media"], ["Kategori", "categories"], ["Penulis", "authors"], ["Traffic & Analytics", "analytics"]]],
    ["SYSTEM", [["Pengaturan", "settings"]]]
  ];
  // Penulis: pengelolaan berita (buat & edit) + media library untuk foto artikel; sisanya khusus Super Admin.
  const allowed = isAdmin ? null : ["articles", "new", "drafts", "scheduled", "media"];
  const groups = allowed ? allGroups.map(([label, items]) => [label, items.filter(([l, k]) => allowed.includes(k))]) : allGroups;
  return `<main class="admin"><div class="mobile-admin-top"><a class="brand" href="#/admin">kodya<em>.id</em></a><span class="mobile-admin-actions"><a href="#/">Lihat situs →</a><a href="#/admin/login" onclick="logout()">Keluar</a><button class="mobile-admin-burger" onclick="toggleAdminMenu()" aria-label="Buka menu admin">☰</button></span></div><nav class="mobile-admin-menu" id="mobile-admin-menu">${groups.map(([label, items]) => items.length ? `<div class="admin-menu-label">${label}</div>${items.map(x => adminLink(x, section)).join("")}` : "").join("")}</nav><div class="admin-shell"><aside class="admin-side"><a class="brand" href="#/admin">kodya<em>.id</em></a><div class="admin-user"><img class="avatar" src="${esc(me.avatar || DEFAULT_AVATAR)}" alt=""><span><strong>${esc(me.name || "Admin Kodya")}</strong><small>${esc(me.email || "")} · ${esc(me.role || "Super Admin")}</small></span></div>${groups.map(([label, items]) => items.length ? `<div class="admin-menu-label">${label}</div>${items.map(x => adminLink(x, section)).join("")}` : "").join("")}<a class="admin-link" href="#/">← Lihat Situs</a><a class="admin-link" href="#/admin/login" onclick="logout()">← Logout</a></aside><section class="admin-main">${content}</section></div></main>`;
}
function adminLink(x, active) { return `<a class="admin-link ${x[1] === active ? "active" : ""}" href="#/admin/${x[1] === "dashboard" ? "" : x[1]}">${x[0]}</a>`; }
window.toggleAdminMenu = () => { const m = document.getElementById("mobile-admin-menu"); if (m) m.classList.toggle("open"); };

// ---------- Statistik pengunjung (real) ----------
function viewsChart(daily) {
  const points = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    points.push({ label: d.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short" }), v: (daily && daily[key]) || 0 });
  }
  const max = Math.max(1, ...points.map(p => p.v));
  const W = 700, H = 210, pad = 12;
  const pts = points.map((p, i) => {
    const px = pad + (i * (W - pad * 2)) / (points.length - 1);
    const py = H - pad - (p.v / max) * (H - pad * 2);
    return [px, py];
  });
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${H} L${pts[0][0].toFixed(1)} ${H} Z`;
  return { line, area, labels: points.map(p => p.label), points };
}
async function trackView(parts) {
  try {
    const hash = location.hash;
    if (window.__lastTrackedHash === hash) return; // jangan hitung render ulang (mis. ganti tab pasar)
    window.__lastTrackedHash = hash;
    const id = parts[0] === "artikel" ? (Number(parts[1]) || null) : null;
    fetch("/api/views", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => { });
  } catch { /* abaikan */ }
}
function dashboard() {
  const all = articles();
  const pub = all.filter(a => a.status === "Published").length, draft = all.filter(a => a.status === "Draft").length;
  const totalViews = (__stats && __stats.total) || 0;
  const views = viewsChart((__stats && __stats.daily) || {});
  const top = [...all].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 3);
  return adminChrome(`<header class="admin-header"><div><h1>Good morning, Admin</h1><p>Berikut performa Kodya.id hari ini.</p></div><a href="#/admin/new" class="button">+ Tambah Berita</a></header><div class="admin-cards"><div class="admin-card"><span>Total Artikel</span><strong>${all.length.toLocaleString("id-ID")}</strong></div><div class="admin-card"><span>Published</span><strong>${pub.toLocaleString("id-ID")}</strong></div><div class="admin-card"><span>Draft</span><strong>${draft.toLocaleString("id-ID")}</strong><small style="color:#8a683b">Perlu ditinjau</small></div><div class="admin-card"><span>Total Views</span><strong>${totalViews.toLocaleString("id-ID")}</strong><small>▲ Real-time</small></div></div><div class="admin-grid"><section class="admin-panel"><h2 class="panel-title">Traffic Overview</h2><p class="panel-subtitle">Page views 7 hari terakhir (data real)</p><div class="chart"><svg viewBox="0 0 700 210" preserveAspectRatio="none"><path class="chart-area" d="${views.area}"></path><path class="chart-line" d="${views.line}"></path></svg></div><div class="chart-meta">${views.labels.map(l => `<span>${l}</span>`).join("")}</div></section><section class="admin-panel"><h2 class="panel-title">Top Articles</h2><p class="panel-subtitle">Artikel paling banyak dibaca</p>${top.length ? top.map((a, i) => `<div class="top-article"><strong>0${i + 1}</strong><p>${esc(a.title)}<br><small>${(a.views || 0).toLocaleString("id-ID")} views</small></p></div>`).join("") : `<p class="panel-subtitle">Belum ada views.</p>`}</section></div>`, "dashboard");
}

function adminArticles(type = "all") { let data = articles(); if (type === "drafts") data=data.filter(a=>a.status==="Draft"); if (type === "scheduled") data=data.filter(a=>a.status==="Scheduled"); const label = type === "drafts" ? "Draft" : type === "scheduled" ? "Terjadwal" : "Semua Berita"; return adminChrome(`<header class="admin-header"><div><h1>${label}</h1><p>Kelola seluruh konten yang tampil di Kodya.id.</p></div><div style="display:flex;gap:10px"><button class="button ghost" onclick="deleteAllArticles()">Hapus Semua</button><a href="#/admin/new" class="button">+ Tambah Berita</a></div></header><section class="admin-table-wrap"><div class="toolbar"><input oninput="filterAdminTable(this.value)" placeholder="Cari judul berita..."><select class="form-control" style="width:auto" onchange="filterAdminStatus(this.value)"><option value="">Semua status</option><option>Published</option><option>Draft</option><option>Scheduled</option></select></div><table class="admin-table"><thead><tr><th>Artikel</th><th>Kategori</th><th>Penulis</th><th>Status</th><th>Views</th><th>Tanggal</th><th></th></tr></thead><tbody id="admin-article-rows">${data.map(tableRow).join("")}</tbody></table></section>`, type === "all" ? "articles" : type); }
function tableRow(a) { return `<tr data-title="${esc(a.title).toLowerCase()}" data-status="${a.status}"><td><div style="display:flex;align-items:center;gap:10px"><img class="table-thumb" src="${a.image || IMAGE.city}" alt=""><strong>${esc(a.title)}</strong></div></td><td>${esc(a.category)}</td><td>${esc(a.author)}</td><td><span class="status ${a.status.toLowerCase()}">${a.status}</span></td><td>${esc(a.views)}</td><td>${esc(a.date)}</td><td><a class="table-action" href="#/admin/edit/${a.id}">Edit</a><button class="table-action" onclick="deleteArticle(${a.id})">Hapus</button></td></tr>`; }

function articleEditor(id = null, presetCategory = null) {
  const existing = id ? articles().find(a => a.id === Number(id)) : null;
  const a = existing || { title: "", excerpt: "", category: presetCategory || "Ekonomi", author: siteAuthor(), status: "Draft", featured: false, breaking: false, image: IMAGE.city, content: "", media: "" };
  const isPodcast = a.category === "Podcast", isVideo = a.category === "Video", isMedia = isPodcast || isVideo;
  const heading = existing ? (isPodcast ? "Edit Podcast" : isVideo ? "Edit Video" : "Edit Berita") : presetCategory ? "Tambah " + presetCategory : "Tambah Berita";
  const sub = isPodcast ? "Unggah file audio (MP3) dan terbitkan sebagai episode podcast." : isVideo ? "Unggah file video (MP4) dan terbitkan." : "Siapkan berita agar siap diterbitkan pada Kodya.id.";
  const badge = isPodcast ? `<span class="mode-badge podcast">● PODCAST</span>` : isVideo ? `<span class="mode-badge video">▶ VIDEO</span>` : "";
  const mediaLabel = isPodcast ? "File audio (MP3, maks 25 MB)" : isVideo ? "File video (MP4, maks 25 MB)" : "File media audio/video";
  const uploadBtn = isPodcast ? "Pilih File MP3" : isVideo ? "Pilih File MP4" : "Pilih File";
  const mediaAccept = isPodcast ? "audio/mpeg,.mp3" : isVideo ? "video/mp4,.mp4" : "audio/mpeg,.mp3,video/mp4,.mp4";
  const mediaRowStyle = isMedia ? "" : "display:none";
  const formClass = isPodcast ? "editor editor--podcast" : isVideo ? "editor editor--video" : "editor";
  const publishLabel = existing ? "Simpan Perubahan" : isPodcast ? "Terbitkan Podcast" : isVideo ? "Terbitkan Video" : "Publish Berita";
  return adminChrome(`<header class="admin-header"><div><h1>${heading}${badge}</h1><p>${sub}</p></div><a href="#/admin/articles" class="button ghost">← Semua Berita</a></header><form class="${formClass}" onsubmit="saveArticle(event, ${id || "null"})"><section class="form-card"><div><label for="title">Judul</label><input class="title-input" id="title" name="title" value="${esc(a.title)}" placeholder="Masukkan judul berita..." required></div><div><label>Ringkasan</label><textarea class="form-control" name="excerpt" rows="3" placeholder="Tulis ringkasan singkat...">${esc(a.excerpt)}</textarea></div>${isMedia ? "" : `<div><label>Isi artikel</label><div class="editor-toolbar"><button type="button"><b>B</b></button><button type="button"><i>I</i></button><button type="button">H2</button><button type="button">❝</button><button type="button">↗</button><button type="button">☷</button></div><textarea class="content-area" name="content" placeholder="Mulai menulis berita Anda di sini...">${esc(a.content || "")}</textarea></div><div><label>SEO Title</label><input class="form-control" name="seo" value="${esc(a.title)}" placeholder="Judul untuk mesin pencari"></div>`}</section><aside class="form-card form-side"><div><label>Status</label><select class="form-control" name="status"><option ${a.status==="Draft"?"selected":""}>Draft</option><option ${a.status==="Scheduled"?"selected":""}>Scheduled</option><option ${a.status==="Published"?"selected":""}>Published</option></select></div><div><label>Kategori</label><select class="form-control" name="category" onchange="updateMediaField(this)">${categories.slice(1,11).map(c=>`<option ${a.category===c?"selected":""}>${c}</option>`).join("")}</select></div><div><label>Penulis</label><select class="form-control" name="author"><option selected>${esc(session()?.name || siteAuthor())}</option></select></div><div><label>URL gambar unggulan</label><input class="form-control" name="image" value="${esc(a.image)}"><button type="button" class="button ghost" style="margin-top:8px;display:block" onclick="openMediaPicker()">Pilih dari Media Library</button></div><div id="media-field-row" style="${mediaRowStyle}"><label id="media-field-label">${mediaLabel}</label><label class="upload-btn" id="media-upload-btn" for="media-file-input"><span class="upload-icon">↑</span> ${uploadBtn}</label><input type="file" id="media-file-input" class="upload-input" accept="${mediaAccept}" onchange="uploadArticleMedia(this)"><span class="upload-file-name" id="media-file-name">${a.media ? "File: " + esc(String(a.media).split("/").pop()) : "Belum ada file dipilih"}</span><input class="form-control" name="media" value="${esc(a.media || "")}" placeholder="URL file media" style="margin-top:8px"><p class="panel-subtitle" id="media-msg"></p></div><label class="check-row"><input type="checkbox" name="featured" ${a.featured ? "checked" : ""}> Featured article</label><label class="check-row"><input type="checkbox" name="breaking" ${a.breaking ? "checked" : ""}> Breaking news</label><button class="button" name="action" value="publish">${publishLabel}</button><button class="button ghost" name="action" value="draft">Simpan sebagai Draft</button></aside></form>`, isPodcast ? "new-podcast" : isVideo ? "new-video" : "new");
}
window.updateMediaField = sel => {
  const label = document.getElementById("media-field-label");
  const input = document.getElementById("media-file-input");
  const isPodcast = sel.value === "Podcast", isVideo = sel.value === "Video";
  if (label) label.textContent = isPodcast ? "File audio (MP3, maks 25 MB)" : isVideo ? "File video (MP4, maks 25 MB)" : "File media audio/video (MP3/MP4, untuk kategori Podcast/Video)";
  if (input) input.accept = isPodcast ? "audio/mpeg,.mp3" : isVideo ? "video/mp4,.mp4" : "audio/mpeg,.mp3,video/mp4,.mp4";
};
window.uploadArticleMedia = async input => {
  const file = input && input.files && input.files[0];
  const msg = document.getElementById("media-msg");
  const nameEl = document.getElementById("media-file-name");
  if (msg) msg.textContent = "";
  if (!file) return;
  if (nameEl) nameEl.textContent = file.name;
  if (file.size > 25 * 1024 * 1024) { if (msg) msg.textContent = "File terlalu besar (maks 25 MB)."; return; }
  const d = await uploadFile(file);
  if (d.ok) {
    const urlInput = document.querySelector('form.editor [name="media"]');
    if (urlInput) urlInput.value = d.url;
    if (nameEl) nameEl.textContent = "File terunggah: " + d.url.split("/").pop();
    if (msg) msg.textContent = "File media terunggah.";
    toast("File media terunggah.");
  } else if (msg) msg.textContent = d.error || "Gagal mengunggah file.";
};

function adminUtility(page) { if (page === "categories") return adminCategories(); if (page === "authors") return adminAuthors(); if (page === "settings") return adminSettings(); if (page === "media") return adminMedia(); return adminAnalytics(); }

function adminCategories() { const cats = categoriesList(); return adminChrome(`<header class="admin-header"><div><h1>Kategori</h1><p>Atur struktur kategori agar konten mudah ditemukan pembaca.</p></div></header><form class="editor" onsubmit="addCategory(event)"><section class="form-card"><div><label>Nama kategori baru</label><input class="form-control" name="name" placeholder="mis. Properti" required></div><button class="button">+ Tambah Kategori</button></section></form><section class="admin-panel" style="margin-top:18px"><h2 class="panel-title">Kategori aktif (${cats.length})</h2><div class="cat-chips">${cats.map(c => `<span class="cat-chip">${esc(c)} <button onclick="removeCategory('${encodeURIComponent(c)}')" aria-label="Hapus">✕</button></span>`).join("")}</div></section>`, "categories"); }

function userRow(u) {
  const me = session() || {};
  const self = me.email && u.email && me.email.toLowerCase() === u.email.toLowerCase();
  const roleBadge = u.role === "Super Admin" ? `<span class="status published">ADMIN</span>` : u.role === "Penulis" ? `<span class="status draft">PENULIS</span>` : `<span class="status scheduled">PEMBACA</span>`;
  return `<div class="user-row"><img class="avatar" src="${esc(u.avatar || DEFAULT_AVATAR)}" alt=""><div class="user-info"><strong>${esc(u.name)}</strong><small>${esc(u.email)}</small></div>${roleBadge}${self ? "<span class=\"meta\">Anda</span>" : `<button class="table-action" onclick="deleteUser('${encodeURIComponent(u.email)}')">Hapus</button>`}</div>`;
}
function adminAuthors() {
  const list = users();
  return adminChrome(`<header class="admin-header"><div><h1>Penulis</h1><p>Kelola akun penulis dan admin newsroom.</p></div></header><form class="editor" onsubmit="createUser(event)"><section class="form-card"><div><label>Nama</label><input class="form-control" name="name" required></div><div><label>Email</label><input class="form-control" name="email" type="email" required></div><div><label>Password awal</label><input class="form-control" name="password" type="text" minlength="6" required></div><button class="button">+ Buat Akun Penulis</button></section></form><section class="admin-panel" style="margin-top:18px"><h2 class="panel-title">Akun aktif (${list.length})</h2>${list.length ? list.map(userRow).join("") : `<p class="panel-subtitle">Belum ada akun.</p>`}</section>`, "authors");
}

function adminSettings() { const me = session() || {}; return adminChrome(`<header class="admin-header"><div><h1>Pengaturan</h1><p>Kelola profil akun dan keamanan.</p></div></header><section class="admin-panel"><h2 class="panel-title">Profil</h2><p class="panel-subtitle">Foto profil dan nama tampilan Anda.</p><div class="profile-row"><img class="avatar profile-avatar" id="profile-avatar" src="${esc(me.avatar || DEFAULT_AVATAR)}" alt=""><div><p class="panel-subtitle" style="margin-bottom:8px">Foto profil tampil di dashboard dan halaman artikel.</p><button class="button ghost" type="button" onclick="document.getElementById('profile-file').click()">Ubah Foto Profil</button><input type="file" id="profile-file" accept="image/*" hidden onchange="uploadProfilePhoto(this)"></div></div><form class="editor" onsubmit="updateProfile(event)"><section class="form-card"><div><label>Nama tampilan</label><input class="form-control" name="name" value="${esc(me.name || "")}" required></div><button class="button">Simpan Profil</button><p class="login-error" id="profile-msg"></p></section></form></section><form class="editor" onsubmit="changePassword(event)" style="margin-top:18px"><section class="form-card"><h2 class="panel-title">Ubah Password</h2><div><label>Password lama</label><input class="form-control" name="current" type="password" required></div><div><label>Password baru</label><input class="form-control" name="next" type="password" minlength="6" required></div><button class="button">Simpan Password Baru</button><p class="login-error" id="pw-msg"></p></section></form>`, "settings"); }

function adminMedia() { const media = mediaList(); return adminChrome(`<header class="admin-header"><div><h1>Media Library</h1><p>Unggah gambar dari perangkat atau tambahkan via URL.</p></div></header>
<form class="editor" onsubmit="event.preventDefault()"><section class="form-card"><div><label>Unggah gambar dari perangkat</label><input class="form-control" type="file" id="media-file" accept="image/*" required><p class="panel-subtitle">Format: JPG, PNG, GIF, WebP, atau SVG · maksimal 10 MB</p></div><button class="button" type="button" id="upload-btn" onclick="uploadMedia()">↑ Unggah Gambar</button><p class="login-error" id="upload-msg"></p></section></form>
<form class="editor" onsubmit="addMedia(event)"><section class="form-card"><div><label>Atau tambahkan gambar via URL</label><input class="form-control" name="url" type="url" placeholder="https://..." required></div><button class="button">+ Tambah ke Media</button></section></form>
<section class="admin-panel" style="margin-top:18px"><h2 class="panel-title">Gambar tersimpan (${media.length})</h2><div class="media-grid">${media.map(u => `<figure class="media-figure"><img src="${u}" alt="" loading="lazy" onerror="this.parentElement.style.display='none'"><figcaption><button class="table-action" onclick="copyMediaUrl('${encodeURIComponent(u)}')">Salin URL</button></figcaption></figure>`).join("")}</div></section>`, "media"); }


function adminAnalytics() {
  const all = articles();
  const byCat = {}; all.forEach(a => byCat[a.category] = (byCat[a.category] || 0) + 1);
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...cats.map(c => c[1]));
  const totalViews = (__stats && __stats.total) || 0;
  const daily = viewsChart((__stats && __stats.daily) || {});
  const dailyMax = Math.max(1, ...daily.points.map(p => p.v));
  return adminChrome(`<header class="admin-header"><div><h1>Traffic & Analytics</h1><p>Pantau pembaca dan performa konten Kodya.id (data real).</p></div></header><div class="admin-cards"><div class="admin-card"><span>Total Artikel</span><strong>${all.length}</strong></div><div class="admin-card"><span>Published</span><strong>${all.filter(a => a.status === "Published").length}</strong></div><div class="admin-card"><span>Total Views</span><strong>${totalViews.toLocaleString("id-ID")}</strong></div><div class="admin-card"><span>Views Hari Ini</span><strong>${(daily.points[daily.points.length - 1].v || 0).toLocaleString("id-ID")}</strong></div></div><section class="admin-panel" style="margin-top:18px"><h2 class="panel-title">Views 7 Hari Terakhir</h2><div class="bar-list">${daily.points.map(d => `<div class="bar-row"><span>${d.label}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(4, Math.round(d.v / dailyMax * 100))}%"></div></div><strong>${d.v.toLocaleString("id-ID")}</strong></div>`).join("")}</div></section><section class="admin-panel" style="margin-top:18px"><h2 class="panel-title">Artikel per Kategori</h2><div class="bar-list">${cats.map(c => `<div class="bar-row"><span>${esc(c[0])}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(8, Math.round(c[1] / max * 100))}%"></div></div><strong>${c[1]}</strong></div>`).join("")}</div></section>`, "analytics");
}

async function route() {
  disposeTradingView();
  clearInterval(window.__heroTimer);
  const parts = location.hash.slice(2).split("/").filter(Boolean);
  const root = parts[0] || "";
  if (root === "admin") {
    if (parts[1] === "login" || !session()) return loginPage();
    // Akun publik (Pembaca) tidak punya akses dashboard — arahkan ke beranda.
    if (session().role === "Pembaca") { location.hash = "#/"; return; }
    // Muat ulang data dari server setiap ganti halaman agar isi selalu terbaru.
    await Promise.all([ensureArticles(true), ensureUsers(true), ensureForum(true), ensureMedia(true), ensureCategories(true), ensureStats(true)]);
    const isAdminUser = session().role === "Super Admin";
    if (!parts[1]) app.innerHTML = isAdminUser ? dashboard() : adminArticles("all");
    else if (["articles", "drafts", "scheduled"].includes(parts[1])) app.innerHTML = adminArticles(parts[1] === "articles" ? "all" : parts[1]);
    else if (parts[1] === "new") app.innerHTML = articleEditor();
    else if (parts[1] === "edit") app.innerHTML = articleEditor(parts[2]);
    else if (isAdminUser && parts[1] === "new-podcast") app.innerHTML = articleEditor(null, "Podcast");
    else if (isAdminUser && parts[1] === "new-video") app.innerHTML = articleEditor(null, "Video");
    else if (parts[1] === "media") app.innerHTML = adminMedia();
    else if (isAdminUser && ["categories", "authors", "analytics", "settings"].includes(parts[1])) app.innerHTML = adminUtility(parts[1]);
    else app.innerHTML = isAdminUser ? dashboard() : adminArticles("all");
    return;
  }
  if (root === "register") return registerPage();
  if (root === "profil") {
    if (!session()) return loginPage();
    await Promise.all([ensureArticles(true), ensureForum(true), ensureOpinions(true)]);
    app.innerHTML = profilPage();
    return;
  }
  // Muat ulang data dari server setiap ganti halaman agar isi selalu terbaru.
  await Promise.all([ensureArticles(true), ensureForum(true), ensureOpinions(true), ensureMedia(true), ensureCategories(true)]);
  if (root === "kategori") {
    const cat = (parts[1]?.split("?")[0] || "Ekonomi").split("-").map(s => s[0].toUpperCase() + s.slice(1)).join(" ");
    if (cat === "Podcast") app.innerHTML = podcastPage();
    else if (cat === "Video") app.innerHTML = videoPage();
    else app.innerHTML = genericPage(cat);
  }
  else if (root === "artikel") app.innerHTML = articlePage(parts[1]);
  else if (root === "forum") app.innerHTML = forumPage();
  else if (root === "search") app.innerHTML = searchPage(new URLSearchParams(location.hash.split("?")[1] || "").get("q") || "");
  else if (root === "indeks-pro") app.innerHTML = genericPage("Indeks PRO");
  else app.innerHTML = home();
  if (document.getElementById("tv-chart")) initTradingView("tv-chart", activeSymbol);
  if (document.getElementById("hero-track")) startHeroSlider();
  const topik = Number(new URLSearchParams(location.hash.split("?")[1] || "").get("topik"));
  if (topik) setTimeout(() => scrollToThread(topik), 400);
  const opiniId = Number(new URLSearchParams(location.hash.split("?")[1] || "").get("opini"));
  if (opiniId) setTimeout(() => scrollToOpinion(opiniId), 400);
  if (!window.__marketQuotesLoaded) {
    // Muat kuotasi real-time di semua halaman (dipakai ticker atas dan kartu pasar).
    window.__marketQuotesLoaded = true;
    loadMarketQuotes().then(applyMarketQuotes);
    window.__marketTimer = setInterval(() => loadMarketQuotes(true).then(applyMarketQuotes), 5 * 60 * 1000);
  }
  trackView(parts);
  window.scrollTo(0, 0);
}

window.closeReader = () => { const m = document.querySelector(".reader-modal"); if (m) m.remove(); document.body.classList.remove("reader-open"); };
document.addEventListener("keydown", e => { if (e.key === "Escape") window.closeReader(); });
window.searchFromHeader = e => { e.preventDefault(); go(`#/search?q=${encodeURIComponent(new FormData(e.target).get("q"))}`); };
window.doSearch = e => { e.preventDefault(); go(`#/search?q=${encodeURIComponent(new FormData(e.target).get("q"))}`); };
window.newsletter = e => { e.preventDefault(); e.target.reset(); toast("Terima kasih — Anda terdaftar untuk newsletter Kodya."); };
window.toggleMobileMenu = () => { const m = document.getElementById("mobile-menu"); const b = document.querySelector(".menu-button"); if (!m) return; const open = m.classList.toggle("open"); if (b) b.classList.toggle("open", open); };
window.closeMobileMenu = () => { const m = document.getElementById("mobile-menu"); if (m) m.classList.remove("open"); const b = document.querySelector(".menu-button"); if (b) b.classList.remove("open"); };
window.playVideo = id => { const v = published().find(x => x.id === Number(id)); if (!v) return; const modal = document.createElement("div"); modal.className = "reader-modal"; modal.innerHTML = `<div class="reader-backdrop" onclick="closeReader()"></div><div class="reader-panel media-panel"><button class="reader-close" onclick="closeReader()" aria-label="Tutup">✕</button><div class="reader-content"><h2>${esc(v.title)}</h2><p class="meta">${esc(v.excerpt)}</p><div class="video-frame"><video controls autoplay poster="${esc(v.image || IMAGE.city)}" src="${v.media || DEMO_VIDEO}"></video></div></div></div>`; document.body.appendChild(modal); document.body.classList.add("reader-open"); };
window.postOpinion = async e => { e.preventDefault(); const me = session(); if (!me) return toast("Silakan login terlebih dahulu."); const f = new FormData(e.target); const items = opinionsList(); items.unshift({ id: Date.now(), author: me.name || "Anonim", avatar: me.avatar || "", email: me.email || "", title: f.get("title"), message: f.get("message"), date: dateNow() }); await saveOpinions(items); toast("Opini Anda dipublikasikan."); location.reload(); };
window.postForum = async e => { e.preventDefault(); const me = session(); if (!me) return toast("Silakan login terlebih dahulu."); const f = new FormData(e.target); const threads = forumThreads(); threads.unshift({ id: Date.now(), author: me.name || "Anonim", avatar: me.avatar || "", email: me.email || "", title: f.get("title"), message: f.get("message"), date: dateNow(), votes: 0, comments: [] }); await saveForum(threads); toast("Topik diskusi dipublikasikan."); location.reload(); };
window.postReply = async (e, id) => { e.preventDefault(); const me = session(); if (!me) return toast("Silakan login terlebih dahulu."); const f = new FormData(e.target); const threads = forumThreads(); const t = threads.find(x => x.id === Number(id)); if (!t) return; (t.comments = t.comments || []).push({ author: me.name || "Anonim", avatar: me.avatar || "", email: me.email || "", message: f.get("message"), date: dateNow() }); await saveForum(threads); toast("Balasan terkirim."); location.reload(); };
window.voteForum = async (id, dir) => {
  const threads = forumThreads();
  const t = threads.find(x => x.id === Number(id));
  if (!t) return;
  const key = `kodya-vote-${id}`;
  const prev = Number(localStorage.getItem(key) || 0);
  const next = prev === dir ? 0 : dir;
  t.votes = (t.votes || 0) + (next - prev);
  localStorage.setItem(key, String(next));
  await saveForum(threads);
  const scoreEl = document.getElementById(`vote-score-${id}`);
  if (scoreEl) scoreEl.textContent = t.votes;
  const up = document.getElementById(`vote-up-${id}`), down = document.getElementById(`vote-down-${id}`);
  if (up) up.classList.toggle("active", next === 1);
  if (down) down.classList.toggle("active", next === -1);
};
window.shareMenu = (e, id) => { e.stopPropagation(); const menu = document.getElementById(`share-menu-${id}`); if (!menu) return; const wasOpen = menu.classList.contains("open"); document.querySelectorAll(".share-menu.open").forEach(m => m.classList.remove("open")); if (!wasOpen) menu.classList.add("open"); const btn = e.currentTarget; if (btn) btn.setAttribute("aria-expanded", String(!wasOpen)); };
const closeShareMenus = () => { document.querySelectorAll(".share-menu.open").forEach(m => m.classList.remove("open")); document.querySelectorAll(".thread-act[aria-expanded]" ).forEach(b => b.setAttribute("aria-expanded", "false")); };
document.addEventListener("click", e => { if (!e.target.closest(".forum-actions")) closeShareMenus(); });
window.shareOpinion = (id, type) => {
  document.querySelectorAll(".share-menu.open").forEach(m => m.classList.remove("open"));
  const t = opinionsList().find(x => x.id === Number(id));
  if (!t) return;
  const title = (document.getElementById(`opinion-title-${id}`)?.textContent || t.title).trim();
  const text = `${title} — Opini Kodya.id`;
  const url = `${location.origin}${location.pathname}#/kategori/opini?opini=${id}`;
  if (type === "x") window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank", "noopener");
  else if (type === "wa") window.open(`https://wa.me/?text=${encodeURIComponent(text + " " + url)}`, "_blank", "noopener");
  else {
    const copied = () => toast("Tautan opini disalin.");
    const failed = () => toast("Gagal menyalin tautan. Salin manual dari bilah alamat.");
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(copied).catch(failed);
    } else {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); copied(); } catch { failed(); }
      ta.remove();
    }
  }
};
window.shareForum = (id, type) => {
  document.querySelectorAll(".share-menu.open").forEach(m => m.classList.remove("open"));
  const t = forumThreads().find(x => x.id === Number(id));
  if (!t) return;
  const title = (document.getElementById(`forum-title-${id}`)?.textContent || t.title).trim();
  const text = `${title} — Diskusi Kodya.id`;
  const url = `${location.origin}${location.pathname}#/forum?topik=${id}`;
  if (type === "x") window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank", "noopener");
  else if (type === "wa") window.open(`https://wa.me/?text=${encodeURIComponent(text + " " + url)}`, "_blank", "noopener");
  else {
    const copied = () => toast("Tautan diskusi disalin.");
    const failed = () => toast("Gagal menyalin tautan. Salin manual dari bilah alamat.");
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(copied).catch(failed);
    } else {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); copied(); } catch { failed(); }
      ta.remove();
    }
  }
};
window.addCategory = async e => { e.preventDefault(); const name = new FormData(e.target).get("name").trim(); const cats = categoriesList(); if (!name) return toast("Nama kategori wajib diisi."); if (cats.includes(name)) return toast("Kategori sudah ada."); cats.push(name); await saveCategories(cats); toast("Kategori ditambahkan."); location.reload(); };
window.removeCategory = async name => { const decoded = decodeURIComponent(name); await saveCategories(categoriesList().filter(c => c !== decoded)); toast("Kategori dihapus."); location.reload(); };
window.updateAuthor = async e => { e.preventDefault(); const name = new FormData(e.target).get("name").trim(); if (!name) return; localStorage.setItem("kodya-author", name); await saveArticles(articles().map(a => ({ ...a, author: name }))); toast("Nama penulis diperbarui di semua artikel."); location.reload(); };
window.changePassword = async e => { e.preventDefault(); const f = new FormData(e.target); const msg = document.getElementById("pw-msg"); const btn = e.submitter; if (btn) btn.disabled = true; try { const d = await apiSend("/api/change-password", "POST", { current: f.get("current"), next: f.get("next") }); if (d.ok) { toast("Password berhasil diubah."); location.reload(); } else if (msg) msg.textContent = d.error || "Gagal mengubah password."; } catch { if (msg) msg.textContent = "Tidak dapat terhubung ke server."; } finally { if (btn) btn.disabled = false; } };
window.addMedia = async e => { e.preventDefault(); const url = new FormData(e.target).get("url").trim(); if (!/^https?:\/\//.test(url)) return toast("URL tidak valid."); await saveMedia([...new Set([url, ...mediaList()])]); toast("Gambar ditambahkan ke media."); location.reload(); };
window.copyMediaUrl = u => { const url = decodeURIComponent(u); if (navigator.clipboard) navigator.clipboard.writeText(url); toast("URL disalin."); };
window.openMediaPicker = () => {
  const urls = mediaList();
  const wrap = document.createElement("div");
  wrap.className = "reader-modal";
  wrap.innerHTML = `<div class="reader-backdrop" onclick="closeMediaPicker()"></div><div class="reader-panel media-picker"><button class="reader-close" onclick="closeMediaPicker()" aria-label="Tutup">✕</button><div class="reader-content"><h2 style="font:26px var(--serif);margin:0 0 4px">Pilih Foto</h2><p class="meta">Klik foto untuk memakainya sebagai gambar unggulan artikel.</p>${urls.length ? `<div class="media-grid" style="margin-top:14px">${urls.map(u => `<figure class="media-figure" style="cursor:pointer" onclick="pickMedia('${encodeURIComponent(u)}')"><img src="${esc(u)}" alt="" loading="lazy" onerror="this.parentElement.style.display='none'"></figure>`).join("")}</div>` : `<p class="empty">Belum ada gambar di Media Library — unggah dulu lewat menu Media Library.</p>`}</div></div>`;
  document.body.appendChild(wrap);
  document.body.classList.add("reader-open");
};
window.closeMediaPicker = () => { const m = document.querySelector(".reader-modal"); if (m) m.remove(); document.body.classList.remove("reader-open"); };
window.pickMedia = u => {
  const input = document.querySelector('form [name="image"]');
  if (input) input.value = decodeURIComponent(u);
  closeMediaPicker();
  toast("Foto dipilih. Simpan artikel untuk menerapkan.");
};
window.uploadMedia = async () => { const input = document.getElementById("media-file"); const file = input && input.files && input.files[0]; const msg = document.getElementById("upload-msg"); const btn = document.getElementById("upload-btn"); if (msg) msg.textContent = ""; if (!file) { if (msg) msg.textContent = "Pilih file gambar terlebih dahulu."; return; } if (btn) { btn.disabled = true; btn.textContent = "Mengunggah..."; } try { const d = await uploadFile(file); if (d.ok) { await saveMedia([...new Set([d.url, ...mediaList()])]); toast("Gambar berhasil diunggah."); location.reload(); } else if (msg) msg.textContent = d.error || "Gagal mengunggah gambar."; } catch { if (msg) msg.textContent = "Tidak dapat terhubung ke server."; } finally { if (btn) { btn.disabled = false; btn.textContent = "↑ Unggah Gambar"; } } };
window.switchMarket = x => { activeMarket=x; route(); };
window.login = async e => { e.preventDefault(); const f = new FormData(e.target); const btn = document.getElementById("login-btn"); const err = document.getElementById("login-error"); if (err) err.textContent = ""; if (btn) { btn.disabled = true; btn.textContent = "Memeriksa..."; } try {
  const d = await apiSend("/api/login", "POST", { email: f.get("email"), password: f.get("password") });
  if (d.ok) { localStorage.setItem("kodya-session", JSON.stringify({ token: d.token, email: d.user.email, name: d.user.name, role: d.user.role, avatar: d.user.avatar || "" })); __articles = __users = __forum = __opinions = __media = __categories = null; await ensureArticles(true); toast("Selamat datang, " + d.user.name + "!"); go(d.user.role === "Pembaca" ? "#/" : "#/admin"); return; }
  if (err) err.textContent = d.error || d.errorMessage || "Email atau password salah.";
} catch { if (err) err.textContent = "Tidak dapat terhubung ke server. Pastikan server berjalan (npm start) lalu buka http://localhost:4173 — jangan buka file index.html langsung."; }
finally { if (btn) { btn.disabled = false; btn.textContent = "Masuk ke Dashboard →"; } } };
window.createUser = async e => { e.preventDefault(); const f = new FormData(e.target); const d = await apiSend("/api/users", "POST", { name: f.get("name"), email: f.get("email"), password: f.get("password") }); if (d.ok) { __users = null; toast("Akun penulis dibuat."); location.reload(); } else toast(d.error || "Gagal membuat akun."); };
window.deleteUser = email => { const em = decodeURIComponent(email); confirmModal({ danger: true, title: "Hapus akun?", message: `Akun ${em} akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`, confirmLabel: "Ya, hapus", onConfirm: async () => { const d = await apiSend("/api/users?email=" + encodeURIComponent(em), "DELETE"); __users = null; toast(d.ok ? "Akun dihapus." : (d.error || "Gagal menghapus akun.")); location.reload(); } }); };
window.updateProfile = async e => { e.preventDefault(); const f = new FormData(e.target); const me = session(); const msg = document.getElementById("profile-msg"); if (!me) return toast("Silakan masuk kembali."); const d = await apiSend("/api/profile", "POST", { name: f.get("name") }); if (d.ok) { localStorage.setItem("kodya-session", JSON.stringify({ ...me, name: d.user.name, avatar: d.user.avatar || "" })); __articles = __forum = __opinions = null; toast("Profil diperbarui."); location.reload(); } else if (msg) msg.textContent = d.error || "Gagal memperbarui profil."; };
window.uploadProfilePhoto = async input => { const file = input && input.files && input.files[0]; if (!file) return; const me = session(); if (!me) return toast("Silakan masuk kembali."); const d = await uploadFile(file); if (!d.ok) return toast(d.error || "Gagal mengunggah foto."); const p = await apiSend("/api/profile", "POST", { avatar: d.url }); if (p.ok) { localStorage.setItem("kodya-session", JSON.stringify({ ...me, name: p.user.name, avatar: d.url })); __articles = __forum = __opinions = null; toast("Foto profil diperbarui."); location.reload(); } else toast(p.error || "Gagal memperbarui foto profil."); };
window.deleteAllArticles = () => confirmModal({ danger: true, title: "Hapus semua artikel?", message: "Semua artikel akan dihapus permanen dari server. Tindakan ini tidak dapat dibatalkan.", confirmLabel: "Ya, hapus semua", onConfirm: async () => { await saveArticles([]); toast("Semua artikel dihapus."); location.reload(); } });
window.register = async e => { e.preventDefault(); const f = new FormData(e.target); const btn = document.getElementById("register-btn"); const err = document.getElementById("register-error"); if (err) err.textContent = ""; if (btn) { btn.disabled = true; btn.textContent = "Mendaftarkan..."; } try { const d = await apiSend("/api/register", "POST", { name: f.get("name"), email: f.get("email"), password: f.get("password") }); if (d.ok) { localStorage.setItem("kodya-session", JSON.stringify({ token: d.token, email: d.user.email, name: d.user.name, role: d.user.role, avatar: d.user.avatar || "" })); __articles = __users = __forum = __opinions = __media = __categories = null; toast("Akun berhasil dibuat. Selamat datang, " + d.user.name + "!"); go("#/"); return; }  if (err) err.textContent = d.error || d.errorMessage || "Gagal mendaftar.";
} catch { if (err) err.textContent = "Tidak dapat terhubung ke server. Pastikan server berjalan (npm start)."; } finally { if (btn) { btn.disabled = false; btn.textContent = "Daftar →"; } } };
window.logout = () => { localStorage.removeItem("kodya-session"); __articles = __users = __forum = __opinions = __media = __categories = null; toast("Anda telah keluar dari dashboard."); go("#/admin/login"); };
window.filterAdminTable = value => document.querySelectorAll("#admin-article-rows tr").forEach(row => row.style.display = row.dataset.title.includes(value.toLowerCase()) ? "" : "none");
window.filterAdminStatus = value => document.querySelectorAll("#admin-article-rows tr").forEach(row => row.style.display = !value || row.dataset.status === value ? "" : "none");
window.deleteArticle = id => { confirmModal({ danger: true, title: "Hapus artikel?", message: "Artikel ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.", confirmLabel: "Ya, hapus", onConfirm: async () => { await saveArticles(articles().filter(a=>a.id!==id)); toast("Artikel dihapus."); location.reload(); } }); };
window.saveArticle = async (e,id) => { e.preventDefault(); const f = new FormData(e.target); const action = e.submitter?.value; const status = action === "publish" ? "Published" : action === "draft" ? "Draft" : f.get("status") || "Draft"; const existing = id ? articles().find(x => x.id === id) : null;
  const item = { id: id || Date.now(), title:f.get("title"), excerpt:f.get("excerpt"), content:f.get("content"), category:f.get("category"), author: session()?.name || siteAuthor(), avatar: session()?.avatar || "", authorEmail: session()?.email || "", image:f.get("image") || IMAGE.city, media: f.get("media") || "", status, featured:f.get("featured") === "on", breaking:f.get("breaking") === "on", views: existing ? (existing.views || 0) : 0, date: existing?.date || dateNow(), updatedAt: dateNow() + " · " + wibNow() + " WIB" }; const all = articles(); await saveArticles(id ? all.map(a=>a.id===id?item:a) : [item,...all]); toast(id ? "Perubahan disimpan." : (status === "Published" ? "Berita berhasil dipublikasikan." : "Berita disimpan sebagai draft.")); go("#/admin/articles"); };
if (location.protocol === "file:") {
  const banner = document.createElement("div");
  banner.className = "file-mode-banner";
  banner.innerHTML = `<strong>Mode file terdeteksi.</strong> Login dan grafik TradingView tidak akan berfungsi jika dibuka langsung. Jalankan <code>npm start</code>, lalu buka <code>http://localhost:4173</code>. <button onclick="this.parentElement.remove()" aria-label="Tutup">✕</button>`;
  document.body.prepend(banner);
}
async function boot() {
  // Bersihkan kunci localStorage lama yang tidak lagi dipakai (data demo versi sebelumnya).
  ["kodya-articles", "kodya-forum", "kodya-media", "kodya-categories", "kodya-seed-version", "kodya-forum-seeded"].forEach(k => localStorage.removeItem(k));
  // Validasi sesi lama: bila token tidak valid/kedaluwarsa, hapus sesi agar tidak macet di dashboard.
  if (session()) {
    const d = await apiGet("/api/me");
    if (!d.ok) localStorage.removeItem("kodya-session");
  }
  route();
}
// Reload penuh setiap ganti halaman (hash berubah) agar isi selalu ter-update.
window.addEventListener("hashchange", () => location.reload()); boot();
