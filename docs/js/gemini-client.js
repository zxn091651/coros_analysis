/**
 * Gemini API — 经 Worker 代理；授权码由 Worker 与 AUTH_CODE Secret 比对，浏览器不传 API Key。
 */

const MODEL = "gemini-2.5-flash";
const DEFAULT_PROXY_URL = "https://coros-gemini-proxy.zxn091651.workers.dev";

export const SYSTEM_PROMPT = `你是一位专业的耐力运动教练与运动生理分析师，熟悉 COROS 手表的数据含义。

用户会提供 JSON 格式的 COROS 数据，包含：
- activities: 运动记录（跑步、骑行、游泳等）
- daily_metrics: 每日恢复指标（睡眠 HRV、静息心率、训练负荷、ATI/CTI、疲劳度等）
- dashboard_hrv: 近期 HRV 列表（如有）

请用中文回答，结构清晰，使用 Markdown。若数据不足请明确说明，不要编造。数字引用要具体。`;

let _proxyBase = DEFAULT_PROXY_URL;

export function setGeminiProxyUrl(url) {
  _proxyBase = (url || "").trim().replace(/\/$/, "");
}

export async function loadGeminiConfig() {
  setGeminiProxyUrl(DEFAULT_PROXY_URL);
  try {
    const res = await fetch("config.json", { cache: "no-store" });
    if (res.ok) {
      const cfg = await res.json();
      if (cfg.geminiProxyUrl) setGeminiProxyUrl(cfg.geminiProxyUrl);
    }
  } catch {
    /* 使用 DEFAULT_PROXY_URL */
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

function parseGeminiError(status, body) {
  const msg = body?.error?.message || `HTTP ${status}`;

  if (status === 401) {
    return "授权码无效，请在 Worker 重新部署后重试";
  }
  if (status === 429 || /quota|RESOURCE_EXHAUSTED/i.test(msg)) {
    return "Gemini 配额不足或请求过快，请稍后再试。";
  }
  if (/API key not valid|API_KEY_INVALID/i.test(msg)) {
    return `Gemini 服务异常：${msg}`;
  }
  return msg;
}

export async function verifyAuthCode(authCode) {
  const code = (authCode || "").trim();
  if (!code) throw new Error("请填写授权码");
  if (!_proxyBase) throw new Error("未配置 Gemini 代理地址");

  let res;
  try {
    res = await fetch(`${_proxyBase}/verify`, {
      method: "POST",
      headers: { "X-Auth-Code": code },
    });
  } catch (e) {
    throw new Error(`无法连接 Gemini 代理：${e.message}`);
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseGeminiError(res.status, body));
  }
}

export async function analyzeWithGemini(authCode, mode, dataset, onProgress) {
  const code = (authCode || "").trim();
  if (!code) throw new Error("请填写授权码");

  if (!_proxyBase) {
    throw new Error("未配置 Gemini 代理地址");
  }

  await verifyAuthCode(code);

  const prompt = buildPrompt(mode, dataset);
  if (onProgress) onProgress("正在通过代理请求 Gemini…");

  const url = `${_proxyBase}/v1beta/models/${MODEL}:generateContent`;

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Code": code,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3 },
      }),
    });
  } catch (e) {
    throw new Error(`无法连接 Gemini 代理：${e.message}`);
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
