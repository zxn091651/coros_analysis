import { login, fetchCorosDataset } from "./coros-client.js";
import { analyzeWithGemini, loadGeminiConfig } from "./gemini-client.js";
import { deriveGeminiKeyFromAuthCode } from "./secrets.js";

const COROS_REGION = "cn";

const $ = (id) => document.getElementById(id);

function fieldValue(id) {
  const el = $(id);
  return el ? el.value : "";
}

function renderReportHtml(text) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^---$/gm, "<hr>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\n\n/g, "</p><p>")
    .replace(/^/, "<p>")
    .replace(/$/, "</p>");
}

let dataset = null;
let auth = null;
let geminiKey = null;

function setStatus(el, text, type = "") {
  if (!el) return;
  el.textContent = text;
  el.className = "status" + (type ? ` ${type}` : "");
}

function showSection(id) {
  $(id).classList.remove("card-hidden");
}

function renderStats(data) {
  $("data-stats").innerHTML = `
    <div class="stat"><div class="stat-value">${data.activity_count}</div><div class="stat-label">运动记录</div></div>
    <div class="stat"><div class="stat-value">${data.daily_metrics.length}</div><div class="stat-label">每日指标</div></div>
    <div class="stat"><div class="stat-value">${data.weeks}</div><div class="stat-label">周数</div></div>
    <div class="stat"><div class="stat-value">中国</div><div class="stat-label">区域</div></div>
  `;
  $("data-preview").textContent = JSON.stringify(data, null, 2);
}

function resolveGeminiKey() {
  return deriveGeminiKeyFromAuthCode(fieldValue("auth-code").trim());
}

async function handleFetch() {
  const email = fieldValue("email").trim();
  const password = fieldValue("password");
  const authCode = fieldValue("auth-code").trim();

  if (!email || !password) {
    setStatus($("fetch-status"), "请填写 COROS 邮箱和密码", "error");
    return;
  }
  if (!authCode) {
    setStatus($("fetch-status"), "请填写授权码", "error");
    return;
  }

  geminiKey = resolveGeminiKey();
  if (!geminiKey) {
    setStatus($("fetch-status"), "授权码无效，无法启用 AI 分析", "error");
    return;
  }

  $("btn-fetch").disabled = true;
  setStatus($("fetch-status"), "正在登录 COROS…");

  try {
    auth = await login(email, password, COROS_REGION);
    setStatus($("fetch-status"), "登录成功，正在拉取数据…");

    dataset = await fetchCorosDataset(auth, 8);
    renderStats(dataset);
    showSection("section-data");
    showSection("section-analyze");
    $("btn-analyze").disabled = false;

    const latest = dataset.activities[0];
    const extra = latest ? `最近：${latest.date} ${latest.name}` : "";
    setStatus($("fetch-status"), `已加载 ${dataset.activity_count} 条运动。${extra}`, "ok");

    sessionStorage.setItem("coros_email", email);
  } catch (e) {
    console.error(e);
    setStatus($("fetch-status"), e.message || String(e), "error");
    dataset = null;
    geminiKey = null;
    $("btn-analyze").disabled = true;
  } finally {
    $("btn-fetch").disabled = false;
  }
}

async function handleAnalyze() {
  if (!dataset || !geminiKey) return;

  const mode = document.querySelector('input[name="prompt"]:checked')?.value || "last";

  $("btn-analyze").disabled = true;
  setStatus($("analyze-status"), "分析中，请稍候（约 30–60 秒）…");
  $("report").innerHTML = '<p class="hint">生成中…</p>';

  showSection("section-result");

  try {
    const report = await analyzeWithGemini(geminiKey, mode, dataset, (msg) => {
      setStatus($("analyze-status"), msg);
    });
    $("report").innerHTML = renderReportHtml(report);
    setStatus($("analyze-status"), "分析完成", "ok");
    $("section-result").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) {
    console.error(e);
    $("report").innerHTML = "";
    setStatus($("analyze-status"), e.message || String(e), "error");
  } finally {
    $("btn-analyze").disabled = false;
  }
}

function handleCopy() {
  const text = $("report").innerText;
  if (!text) return;
  navigator.clipboard.writeText(text).then(
    () => setStatus($("analyze-status"), "已复制到剪贴板", "ok"),
    () => setStatus($("analyze-status"), "复制失败", "error"),
  );
}

$("btn-fetch").addEventListener("click", handleFetch);
$("btn-analyze").addEventListener("click", handleAnalyze);
$("btn-copy").addEventListener("click", handleCopy);

function init() {
  const savedEmail = sessionStorage.getItem("coros_email");
  const emailEl = $("email");
  if (savedEmail && emailEl) emailEl.value = savedEmail;
  loadGeminiConfig();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
