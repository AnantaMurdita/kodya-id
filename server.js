const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { handleApi } = require("./api-handler");
const { localStorage } = require("./storage-local");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 4173);
const storage = localStorage(ROOT);

const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };

function send(res, status, type, body) {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

function readRawBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", chunk => {
      size += chunk.length;
      if (size > limit) { reject(new Error("Body terlalu besar")); req.destroy(); }
      else chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function safeParse(buf) {
  if (!buf || !buf.length) return {};
  try { return JSON.parse(buf.toString("utf8")); } catch { return {}; }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith("/api/")) {
    try {
      const rawBody = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) ? await readRawBody(req, 25 * 1024 * 1024) : null;
      const contentType = String(req.headers["content-type"] || "");
      const result = await handleApi({
        method: req.method,
        path: url.pathname,
        query: url.searchParams,
        headers: req.headers,
        rawBody,
        body: contentType.includes("json") ? safeParse(rawBody) : {},
        storage,
        env: process.env
      });
      const headers = { ...result.headers, "Cache-Control": "no-store" };
      if (Buffer.isBuffer(result.body)) {
        res.writeHead(result.status, headers);
        res.end(result.body);
      } else {
        res.writeHead(result.status, headers);
        res.end(result.body);
      }
    } catch (error) {
      send(res, 500, "application/json; charset=utf-8", JSON.stringify({ ok: false, error: error.message }));
    }
    return;
  }

  const relative = url.pathname === "/" ? "index.html" : path.normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, "");
  const file = path.resolve(ROOT, relative);
  if (!file.startsWith(ROOT + path.sep) && file !== path.join(ROOT, "index.html")) return send(res, 403, "text/plain; charset=utf-8", "Forbidden");
  fs.readFile(file, (error, data) => error
    ? send(res, 404, "text/plain; charset=utf-8", "Not found")
    : send(res, 200, types[path.extname(file)] || "application/octet-stream", data));
}).listen(PORT, () => console.log(`Kodya.id berjalan di http://localhost:${PORT}`));
