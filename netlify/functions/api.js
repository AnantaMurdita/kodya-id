// ---------- Netlify Function: semua /api/* diarahkan ke handler bersama dengan storage Blobs ----------
const { handleApi } = require("../../api-handler");
const { blobStorage } = require("../../storage-blobs");

function safeParse(buf) {
  if (!buf || !buf.length) return {};
  try { return JSON.parse(buf.toString("utf8")); } catch { return {}; }
}

exports.handler = async (event) => {
  const rawBody = event.body ? Buffer.from(event.body, event.isBase64Encoded ? "base64" : "utf8") : Buffer.alloc(0);
  const headers = {};
  for (const [k, v] of Object.entries(event.headers || {})) headers[k.toLowerCase()] = v;
  const contentType = String(headers["content-type"] || "");

  const result = await handleApi({
    method: event.httpMethod,
    path: event.path,
    query: new URLSearchParams(event.queryStringParameters || {}),
    headers,
    rawBody,
    body: contentType.includes("json") ? safeParse(rawBody) : {},
    storage: blobStorage(),
    env: process.env
  });

  const body = Buffer.isBuffer(result.body) ? result.body : Buffer.from(String(result.body));
  return {
    statusCode: result.status,
    headers: { ...result.headers, "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" },
    body: body.toString("base64"),
    isBase64Encoded: true
  };
};
