// ---------- Storage lokal (dev): JSON di folder data/, gambar di folder uploads/ ----------
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const EXT = { "image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp", "image/svg+xml": ".svg", "audio/mpeg": ".mp3", "audio/mp3": ".mp3", "video/mp4": ".mp4" };
function mimeFromName(name) {
  const ext = path.extname(name).toLowerCase();
  return { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".mp4": "video/mp4" }[ext] || "application/octet-stream";
}

function localStorage(root) {
  const dataDir = path.join(root, "data");
  const uploadDir = path.join(root, "uploads");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadDir, { recursive: true });

  return {
    async getJSON(key, fallback) {
      try {
        return JSON.parse(fs.readFileSync(path.join(dataDir, `${key}.json`), "utf8"));
      } catch {
        return fallback;
      }
    },
    async setJSON(key, value) {
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(path.join(dataDir, `${key}.json`), JSON.stringify(value, null, 2));
    },
    async saveUpload(buffer, contentType) {
      fs.mkdirSync(uploadDir, { recursive: true });
      const ext = EXT[contentType] || ".bin";
      const name = `img-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
      fs.writeFileSync(path.join(uploadDir, name), buffer);
      return { url: `/api/uploads/${name}` };
    },
    async getUpload(key) {
      const safe = path.basename(String(key || "").replace(/[/\\]/g, ""));
      if (!safe) return null;
      try {
        const data = fs.readFileSync(path.join(uploadDir, safe));
        return { data, contentType: mimeFromName(safe) };
      } catch {
        return null;
      }
    }
  };
}

module.exports = { localStorage };
