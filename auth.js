// ---------- Auth: hashing password (scrypt) + token sesi stateless (HMAC) ----------
const crypto = require("node:crypto");

const SESSION_TTL = 12 * 60 * 60 * 1000; // 12 jam

// Format tersimpan: "<salt>:<hash-hex>"
function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return salt + ":" + hash;
}

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== "string" || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  try {
    const candidate = crypto.scryptSync(String(password || ""), salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

// Token: "<payload-base64url>.<signature-base64url>", payload = { email, exp }
function signToken(user, secret, ttl = SESSION_TTL) {
  const payload = Buffer.from(JSON.stringify({ email: user.email, exp: Date.now() + ttl })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return payload + "." + sig;
}

function verifyToken(token, secret) {
  try {
    const [payload, sig] = String(token || "").split(".");
    if (!payload || !sig) return null;
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.email || typeof data.exp !== "number" || Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

function secret(env) {
  return env.SESSION_SECRET || "kodya-dev-secret-ganti-di-produksi";
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken, secret, SESSION_TTL };
