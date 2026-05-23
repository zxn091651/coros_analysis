# Gemini 代理 Worker

浏览器无法直连 Google Gemini（CORS）。本 Worker 负责：

1. 接收请求头 **`X-Auth-Code`**（授权码）
2. 在 **Worker 内**解码得到 Gemini API Key（或使用机密变量）
3. 转发到 `generativelanguage.googleapis.com`

前端 **不再**包含 API Key 或解码逻辑。

## 部署 / 更新（必做）

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → 你的 Worker `coros-gemini-proxy`
2. **Edit code** → 用仓库中 `worker/gemini-proxy.js` **全部替换** → **Deploy**

## 可选：机密变量（更安全）

Worker → **Settings** → **Variables and Secrets** → 添加：

| 名称 | 类型 | 说明 |
|------|------|------|
| `GEMINI_API_KEY` | Secret | 你的 `AIza…` 密钥；设置后优先使用，不再依赖内置解码 |

授权码仍由 `X-Auth-Code` 校验；仅 API Key 存于 Cloudflare 机密中。

## 请求格式

```
POST https://coros-gemini-proxy.zxn091651.workers.dev/v1beta/models/gemini-2.5-flash:generateContent
X-Auth-Code: <授权码>
Content-Type: application/json
```

授权码错误时返回 **401**。
