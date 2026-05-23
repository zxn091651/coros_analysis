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

export function buildPrompt(mode, dataset) {
  const json = JSON.stringify(dataset, null, 2);

  if (mode === "last") {
    const latest = dataset.activities?.[0];
    const latestDesc = latest
      ? `${latest.date} ${latest.name}（${latest.sport}，${latest.duration}，${latest.distance}，平均心率 ${latest.avg_hr}，训练负荷 ${latest.training_load}）`
      : "（缓存中无运动记录）";
    return `${SYSTEM_PROMPT}

以下是我的 COROS 数据（JSON），请**只重点分析最近一次运动**：${latestDesc}

结合 daily_metrics 等恢复指标，评价该次强度是否合理，并给出恢复与下次同类训练建议。不要长篇分析其他历史运动。

数据：
${json}`;
  }

  return `${SYSTEM_PROMPT}

以下是我的 COROS 运动与恢复数据（JSON），请给出**全面的训练与恢复分析报告**（含数据概览、负荷与恢复、各类型运动点评、未来 3–7 天建议）：

${json}`;
}

export async function analyzeWithGemini(apiKey, mode, dataset, onProgress) {
  const prompt = buildPrompt(mode, dataset);
  if (onProgress) onProgress("正在请求 Gemini…");

  const url = `${API_BASE}/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3 },
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body.error?.message || `Gemini HTTP ${res.status}`;
    if (res.status === 429) throw new Error("Gemini 配额不足，请稍后再试或检查 API 配额");
    if (res.status === 400 && /API key/i.test(msg)) throw new Error("Gemini API Key 无效");
    throw new Error(msg);
  }

  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  if (!text) throw new Error("Gemini 未返回内容");
  return text;
}
