# COROS 分析 — GitHub Pages

纯静态前端，部署地址：

**https://zxn091651.github.io/coros_analysis/**

## 功能

- 浏览器内登录 COROS（邮箱 + 密码，直连中国区 Training Hub API）
- 拉取近 8 周运动、HRV、训练负荷等（与 coros-mcp 相同接口）
- AI 分析（`gemini-2.5-flash`，经 Cloudflare Worker 代理）：
  - **最近一次运动**（结合恢复指标）
  - **全面分析**

## 使用前准备（站点维护者）

1. 部署 [worker/gemini-proxy.js](../worker/gemini-proxy.js) 到 Cloudflare Worker，并按 [worker/README.md](../worker/README.md) 配置 **`GEMINI_API_KEY`**、**`AUTH_CODE`** 两个 Secret。
2. 确认 `config.json` 中 `geminiProxyUrl` 指向你的 Worker 地址。
3. 将 **授权码**（与 Worker 中 `AUTH_CODE` 相同）私下分发给需要使用 AI 分析的用户；**不要**把授权码写进仓库、Issues 或截图。

访客在页面填写 COROS 账号与授权码即可使用；授权码仅通过 HTTPS 发给 Worker 校验，浏览器不持有 Gemini API Key。

## 本地预览

**推荐：双击项目根目录 `preview.bat`**（自动选端口并打开浏览器）。

或：

```powershell
cd docs
python -m http.server 8088 --bind 127.0.0.1
# 打开 http://127.0.0.1:8088/
```

注意：

- **不要**直接双击 `index.html`（`file://` 会导致脚本或请求异常）。
- 服务根目录应为 `docs`；若 8088 被占用，可换端口或使用根目录 `preview.py`。

## 启用 GitHub Pages

仓库 **Settings** → **Pages** → Source: **GitHub Actions**。

向 `main` 推送 `docs/` 相关变更后，工作流会自动发布。
