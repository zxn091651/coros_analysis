/**
 * Cloudflare Worker：校验授权码并转发 Gemini API（API Key 仅在 Worker 内解码）。
 *
 * 部署：粘贴到 Cloudflare Worker 并 Deploy。
 * 可选：在 Worker 设置中添加机密变量 GEMINI_API_KEY，将优先于内置解码逻辑。
 */
const GEMINI_ORIGIN = "https://generativelanguage.googleapis.com";
const ENC = "GzEUPmNAcmx4Wm07WxZkAQJlUnwQCgUNdl4BdXt3DzcXHgAUZWBa";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Auth-Code",
  "Access-Control-Max-Age": "86400",
};

function deriveGeminiKey(authCode) {
  if (!authCode) return null;
  let raw;
  try {
    raw = atob(ENC);
  } catch {
    return null;
  }
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    out += String.fromCharCode(
      raw.charCodeAt(i) ^ authCode.charCodeAt(i % authCode.length),
    );
  }
  return out.startsWith("AIza") ? out : null;
}

function jsonError(status, message) {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const authCode = request.headers.get("X-Auth-Code")?.trim() || "";
    const apiKey = env.GEMINI_API_KEY || deriveGeminiKey(authCode);

    if (!apiKey) {
      return jsonError(401, "授权码无效");
    }

    const url = new URL(request.url);
    const path = url.pathname.startsWith("/v1beta")
      ? url.pathname
      : `/v1beta${url.pathname}`;
    const target = `${GEMINI_ORIGIN}${path}${url.search}`;

    const headers = new Headers();
    headers.set("x-goog-api-key", apiKey);
    const ct = request.headers.get("Content-Type");
    if (ct) headers.set("Content-Type", ct);

    let body = null;
    if (request.method !== "GET" && request.method !== "HEAD") {
      body = await request.arrayBuffer();
    }

    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
    });

    const outHeaders = new Headers(CORS);
    const upstreamCt = upstream.headers.get("Content-Type");
    if (upstreamCt) outHeaders.set("Content-Type", upstreamCt);

    return new Response(upstream.body, {
      status: upstream.status,
      headers: outHeaders,
    });
  },
};
