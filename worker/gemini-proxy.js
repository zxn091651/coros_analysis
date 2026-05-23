/**
 * Cloudflare Worker：校验授权码并转发 Gemini API。
 *
 * Secrets（类型均为 Secret）：
 * - GEMINI_API_KEY
 * - AUTH_CODE
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

function secureEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function validateAuth(request, env) {
  const authCode = request.headers.get("X-Auth-Code")?.trim() || "";
  const expectedAuth = env.AUTH_CODE;
  const apiKey = env.GEMINI_API_KEY;

  if (!expectedAuth || !apiKey) {
    return { ok: false, status: 500, message: "Worker 未配置 AUTH_CODE 或 GEMINI_API_KEY" };
  }
  if (!authCode || !secureEqual(authCode, expectedAuth)) {
    return { ok: false, status: 401, message: "授权码无效" };
  }
  return { ok: true, apiKey };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const isVerify =
      url.pathname === "/verify" ||
      url.pathname === "/auth/verify" ||
      url.pathname.endsWith("/verify");

    const auth = validateAuth(request, env);
    if (!auth.ok) {
      return jsonError(auth.status, auth.message);
    }

    if (isVerify) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const path = url.pathname.startsWith("/v1beta")
      ? url.pathname
      : `/v1beta${url.pathname}`;
    const target = `${GEMINI_ORIGIN}${path}${url.search}`;

    const headers = new Headers();
    headers.set("x-goog-api-key", auth.apiKey);
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
