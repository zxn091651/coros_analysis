/**
 * Gemini API — 经可选代理转发（浏览器必须走代理，不能直连 Google）
 */

const MODEL = "gemini-2.5-flash";
const GEMINI_ORIGIN = "https://generativelanguage.googleapis.com/v1beta";

export const SYSTEM_PROMPT = `你是一位专业的耐力运动教练与运动生理分析师，熟悉 COROS 手表的数据含义。

用户会提供 JSON 格式的 COROS 数据，包含：
- activities: 运动记录（跑步、骑行、游泳等）
- daily_metrics: 每日恢复指标（睡眠 HRV、静息心率、训练负荷、ATI/CTI、疲劳度等）
- dashboard_hrv: 近期 HRV 列表（如有）

请用中文回答，结构清晰，使用 Markdown。若数据不足请明确说明，不要编造。数字引用要具体。`;

let _proxyBase = "";

export function setGeminiProxyUrl(url) {
  _proxyBase = (url || "").trim().replace(/\/$/, "");
}

export function getGeminiProxyUrl() {
  return _proxyBase;
}

export async function loadGeminiConfig() {
  try {
    const res = await fetch("config.json", { cache: "no-store" });
    if (res.ok) {
      const cfg = await res.json();
      if (cfg.geminiProxyUrl) setGeminiProxyUrl(cfg.geminiProxyUrl);
    }
  } catch {
    /* 忽略 */
  }
}

export function compactDataset(dataset) {
  return {
    date_range: dataset.date_range,
    region: dataset.region,
    activities: (dataset.activities || []).slice(0, 30),
    daily_metrics: (dataset.daily_metrics || []).slice(-60),
    dashboard_hrv: (dataset.dashboard_hrv || []).slice(-14),
  };
}

export function buildPrompt(mode, dataset) {
  const compact = compactDataset(dataset);
  const json = JSON.stringify(compact, null, 2);

  if (mode === "last") {
    const latest = compact.activities?.[0];
    const latestDesc = latest
      ? `${latest.date} ${latest.name}（${latest.sport}，${latest.duration}，${latest.distance}，平均心率 ${latest.avg_hr}，训练负荷 ${latest.training_load}）`
      : "（无运动记录）";
    return `请**只重点分析最近一次运动**：${latestDesc}

结合 daily_metrics 等恢复指标，评价强度与恢复建议。不要长篇分析其他历史运动。

数据 JSON：
${json}`;
  }

  return `请给出**全面的训练与恢复分析报告**（数据概览、负荷与恢复、运动点评、未来 3–7 天建议）。

数据 JSON：
${json}`;
}

function normalizeApiKey(raw) {
  return (raw || "").trim().replace(/\s+/g, "");
}

function buildApiUrl() {
  const path = `/models/${MODEL}:generateContent`;
  if (_proxyBase) {
    return `${_proxyBase}${path}`;
  }
  return `${GEMINI_ORIGIN}${path}`;
}

function parseGeminiError(status, body) {
  const msg = body?.error?.message || body?.error?.status || `HTTP ${status}`;
  const reason = body?.error?.details?.[0]?.reason || "";

  if (status === 429 || /quota|RESOURCE_EXHAUSTED/i.test(msg)) {
    return "Gemini 配额不足或请求过快，请稍后再试。";
  }

  if (
    /API key not valid|API_KEY_INVALID|invalid.*api.*key/i.test(msg) ||
    reason === "API_KEY_INVALID"
  ) {
    if (!_proxyBase) {
      return (
        "Gemini 在浏览器中无法直连（会误报 API Key 无效）。\n\n" +
        "请部署 Cloudflare Worker 代理（见仓库 worker/README.md），\n" +
        "在下方填写「Gemini 代理地址」，或写入 docs/config.json 后重新推送。\n\n" +
        `原始错误：${msg}`
      );
    }
    return (
      "API Key 被 Google 拒绝。请检查：\n" +
      "1. 密钥完整（AIza 开头）\n" +
      "2. AI Studio 中 Key 应用限制为「无」\n" +
      `原始错误：${msg}`
    );
  }

  if (status === 403 || /PERMISSION_DENIED|leaked/i.test(msg)) {
    return `Gemini 权限被拒绝：${msg}`;
  }

  return msg;
}

export async function analyzeWithGemini(apiKey, mode, dataset, onProgress) {
  const key = normalizeApiKey(apiKey);
  if (!key) throw new Error("请填写 Gemini API Key");
  if (!key.startsWith("AIza")) {
    throw new Error("API Key 格式应以 AIza 开头");
  }

  if (!_proxyBase) {
    throw new Error(
      "未配置 Gemini 代理。网页端必须经 Cloudflare Worker 转发才能调用 Gemini。\n" +
        "请填写下方「Gemini 代理地址」（部署说明见 GitHub 仓库 worker/README.md），" +
        "或改用本地：python analyze.py"
    );
  }

  const prompt = buildPrompt(mode, dataset);
  if (onProgress) onProgress(`正在通过代理请求 Gemini…`);

  const url = buildApiUrl();

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3 },
      }),
    });
  } catch (e) {
    throw new Error(
      `无法连接 Gemini 代理（${_proxyBase}）：${e.message}\n请确认 Worker 已部署且地址正确。`
    );
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseGeminiError(res.status, body));
  }

  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  if (!text) {
    throw new Error(`Gemini 未返回正文（finishReason: ${body.candidates?.[0]?.finishReason || "?"}）`);
  }
  return text;
}
