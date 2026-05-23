/**
 * Gemini API (browser) — gemini-2.5-flash
 */

const MODEL = "gemini-2.5-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export const SYSTEM_PROMPT = `你是一位专业的耐力运动教练与运动生理分析师，熟悉 COROS 手表的数据含义。

用户会提供 JSON 格式的 COROS 数据，包含：
- activities: 运动记录（跑步、骑行、游泳等）
- daily_metrics: 每日恢复指标（睡眠 HRV、静息心率、训练负荷、ATI/CTI、疲劳度等）
- dashboard_hrv: 近期 HRV 列表（如有）

请用中文回答，结构清晰，使用 Markdown。若数据不足请明确说明，不要编造。数字引用要具体。`;

/** 压缩数据体积，降低 400/超时概率 */
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
    return (
      "Gemini 拒绝了该 API Key（在网页端调用时常见）。请检查：\n" +
      "1. 密钥完整复制，无多余空格（以 AIza 开头）\n" +
      "2. 在 Google AI Studio / Cloud Console 中，该 Key 的「应用限制」选「无」" +
      "，或添加引荐来源：https://zxn091651.github.io/*\n" +
      "3. API 限制中已启用「Generative Language API」\n" +
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
    throw new Error("API Key 格式异常，应以 AIza 开头（请从 Google AI Studio 复制完整密钥）");
  }

  const prompt = buildPrompt(mode, dataset);
  if (onProgress) onProgress("正在请求 Gemini…");

  const url = `${API_BASE}/models/${MODEL}:generateContent`;

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
    if (e instanceof TypeError && /fetch/i.test(e.message)) {
      throw new Error(
        "无法连接 Gemini 服务器（网络或浏览器拦截）。若在中国大陆，可能需要可访问 Google 的网络；" +
          "本地 Python 能用时，网页端仍可能因网络不同而失败。"
      );
    }
    throw e;
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseGeminiError(res.status, body));
  }

  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  if (!text) {
    const block = body.candidates?.[0]?.finishReason;
    throw new Error(`Gemini 未返回正文（finishReason: ${block || "未知"}）`);
  }
  return text;
}
