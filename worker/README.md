# Gemini 代理 Worker（解决网页端 API Key 报错）

GitHub Pages 在**浏览器里**无法直连 `generativelanguage.googleapis.com`（无 CORS），
会表现为「API Key 无效」。本地 Python 不受影响。

## 免费部署（约 2 分钟）

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create**
2. 选 **Create Worker** → 粘贴 `gemini-proxy.js` 全部内容 → **Deploy**
3. 记下地址，例如：`https://coros-gemini-proxy.xxx.workers.dev`

## 配置到网站

**方式 A（推荐）**：编辑仓库 `docs/config.json`：

```json
{
  "geminiProxyUrl": "https://coros-gemini-proxy.xxx.workers.dev"
}
```

推送后 GitHub Pages 会自动使用代理。

**方式 B**：在网页「Gemini 代理地址」输入框填写 Worker 地址（保存在浏览器本地）。
