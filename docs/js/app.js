import { login, fetchCorosDataset } from "./coros-client.js";
import {
  analyzeWithGemini,
  loadGeminiConfig,
  setGeminiProxyUrl,
  getGeminiProxyUrl,
} from "./gemini-client.js";

const $ = (id) => document.getElementById(id);

/** 简易 Markdown → HTML（无外部 CDN） */
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

function setStatus(el, text, type = "") {
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
    <div class="stat"><div class="stat-value">${data.region}</div><div class="stat-label">区域</div></div>
  `;
  $("data-preview").textContent = JSON.stringify(data, null, 2);
}

function syncGeminiProxy() {
  const url = $("gemini-proxy").value.trim();
  setGeminiProxyUrl(url);
  if (url) sessionStorage.setItem("coros_gemini_proxy", url);
}

async function handleFetch() {
  const email = $("email").value.trim();
  const password = $("password").value;
  const region = $("region").value;
  const geminiKey = $("gemini-key").value.trim();
  syncGeminiProxy();

  if (!email || !password) {
    setStatus($("fetch-status"), "请填写 COROS 邮箱和密码", "error");
    return;
  }
  if (!getGeminiProxyUrl()) {
    setStatus($("fetch-status"), "请填写 Gemini 代理地址（Cloudflare Worker）", "error");
    return;
  }
  if (!geminiKey) {
    setStatus($("fetch-status"), "请填写 Gemini API Key", "error");
    return;
  }

  $("btn-fetch").disabled = true;
  setStatus($("fetch-status"), "正在登录 COROS…");

  try {
    auth = await login(email, password, region);
    setStatus($("fetch-status"), `登录成功（${auth.region}），正在拉取数据…`);

    dataset = await fetchCorosDataset(auth, 8);
    renderStats(dataset);
    showSection("section-data");
    showSection("section-analyze");
    $("btn-analyze").disabled = false;

    const latest = dataset.activities[0];
    const extra = latest ? `最近：${latest.date} ${latest.name}` : "";
    setStatus($("fetch-status"), `已加载 ${dataset.activity_count} 条运动。${extra}`, "ok");

    sessionStorage.setItem("coros_email", email);
    sessionStorage.setItem("coros_region", region);
  } catch (e) {
    console.error(e);
    setStatus($("fetch-status"), e.message || String(e), "error");
    dataset = null;
    $("btn-analyze").disabled = true;
  } finally {
    $("btn-fetch").disabled = false;
  }
}

async function handleAnalyze() {
  const geminiKey = $("gemini-key").value.trim();
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
    const msg = e.message || String(e);
    setStatus($("analyze-status"), msg, "error");
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

const savedEmail = sessionStorage.getItem("coros_email");
const savedRegion = sessionStorage.getItem("coros_region");
if (savedEmail) $("email").value = savedEmail;
if (savedRegion) $("region").value = savedRegion;
