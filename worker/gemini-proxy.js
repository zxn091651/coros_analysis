/**
 * Cloudflare Worker：转发 Gemini API，解决浏览器 CORS 限制。
 *
 * 部署后把 Worker 地址填入 docs/config.json 的 geminiProxyUrl
 * 或在网页「Gemini 代理地址」中填写。
 */
const GEMINI_ORIGIN = "https://generativelanguage.googleapis.com";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-goog-api-key",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    // 支持 /v1beta/models/... 或完整路径
    const path = url.pathname.startsWith("/v1beta")
      ? url.pathname
      : `/v1beta${url.pathname}`;
    const target = `${GEMINI_ORIGIN}${path}${url.search}`;

    const headers = new Headers();
    const apiKey = request.headers.get("x-goog-api-key");
    if (apiKey) headers.set("x-goog-api-key", apiKey);
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
