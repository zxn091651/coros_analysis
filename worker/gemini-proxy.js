/**
 * Cloudflare Worker：校验授权码并转发 Gemini API。
 *
 * 须在 Worker 中配置 Secrets：
 * - GEMINI_API_KEY  — Gemini API 密钥
 * - AUTH_CODE       — 网页端填写的授权码（与前端一致）
 */
const GEMINI_ORIGIN = "https://generativelanguage.googleapis.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Auth-Code",
  "Access-Control-Max-Age": "86400",
};

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
    const expectedAuth = env.AUTH_CODE;
    const apiKey = env.GEMINI_API_KEY;

    if (!expectedAuth || !apiKey) {
      return jsonError(500, "Worker 未配置 AUTH_CODE 或 GEMINI_API_KEY");
    }
    if (!authCode || authCode !== expectedAuth) {
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
