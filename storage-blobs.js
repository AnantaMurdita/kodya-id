// ---------- Storage Netlify Blobs (dipakai saat deploy di Netlify Functions) ----------
// Data disimpan di store "kodya-data" milik situs Netlify — kredensial otomatis dari runtime Functions.
const { getStore } = require("@netlify/blobs");
const crypto = require("node:crypto");

const STORE_NAME = "kodya-data";
const EXT = { "image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp", "image/svg+xml": ".svg", "audio/mpeg": ".mp3", "audio/mp3": ".mp3", "video/mp4": ".mp4" };
function mimeFromName(name) {
  const ext = name.split(".").pop().toLowerCase();
  return { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", mp3: "audio/mpeg", mp4: "video/mp4" }[ext] || "application/octet-stream";
}

function blobStorage() {
  const store = getStore(STORE_NAME);

  return {
    async getJSON(key, fallback) {
      const value = await store.get(key, { type: "json" });
      return value === null || value === undefined ? fallback : value;
    },
    async setJSON(key, value) {
      await store.setJSON(key, value);
    },
    async saveUpload(buffer, contentType) {
      const ext = EXT[contentType] || ".bin";
      const name = `img-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
      // Buffer bisa jadi view ke memory pool yang lebih besar — salin ke ArrayBuffer murni.
      const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      await store.set(`uploads/${name}`, ab, { metadata: { contentType } });
      return { url: `/api/uploads/${name}` };
    },
    async getUpload(key) {
      const safe = String(key || "").replace(/[/\\]/g, "");
      if (!safe) return null;
      try {
        const entry = await store.getWithMetadata(`uploads/${safe}`, { type: "arrayBuffer" });
        if (!entry || entry.data === null || entry.data === undefined) return null;
        return {
          data: Buffer.from(entry.data),
          contentType: (entry.metadata && entry.metadata.contentType) || mimeFromName(safe)
        };
      } catch {
        return null;
      }
    }
  };
}

module.exports = { blobStorage };
