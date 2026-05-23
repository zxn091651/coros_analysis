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

```bash
cd docs
python -m http.server 8080
# 打开 http://localhost:8080
```

需使用本地服务器（ES module 不支持 `file://`）。

## 启用 Pages

仓库 Settings → Pages → Source: **GitHub Actions**

推送 `main` 分支后自动部署。
