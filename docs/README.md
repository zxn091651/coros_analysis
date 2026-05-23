# COROS 分析 — GitHub Pages

纯静态站点，部署后访问：

**https://zxn091651.github.io/coros_analysis/**

## 功能

- 浏览器内登录 COROS（邮箱 + 密码，直连官方 API）
- 拉取近 8 周运动与恢复数据（与 coros-mcp 相同接口）
- 两种分析模式：`gemini-2.5-flash`
  - 最近一次运动（结合 HRV / 负荷等）
  - 全面分析

## 本地预览

**推荐：双击项目根目录的 `preview.bat`**

会先启动 HTTP 服务，再打开浏览器（避免 `chrome-error` 空白页）。
访问 **http://127.0.0.1:8088/**

或手动执行：

```powershell
cd e:\coros-analysis\docs
python -m http.server 8088 --bind 127.0.0.1
# 浏览器打开 http://127.0.0.1:8088/
```

**常见打不开的原因：**

1. **直接双击 `index.html`** — 不行，必须用上面的 HTTP 服务器
2. **地址错误** — 服务器在 `docs` 目录启动时，应访问 `http://127.0.0.1:8088/`（不是 `/docs/`）
3. **端口被占用** — 改端口：`python -m http.server 9000 --bind 127.0.0.1`

## 启用 Pages

仓库 Settings → Pages → Source: **GitHub Actions**

推送 `main` 分支后自动部署。
