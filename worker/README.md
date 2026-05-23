# Gemini 代理 Worker

浏览器只发送 **`X-Auth-Code`**，API Key 仅存于 Cloudflare Secrets。

## Secrets（必填，类型均选 Secret）

| 名称 | 值 |
|------|-----|
| `GEMINI_API_KEY` | Google AI Studio 的 `AIza…` 密钥 |
| `AUTH_CODE` | 网页授权码（与前端填写一致，如 `Zxn_091651`） |

**Settings** → **Variables and Secrets** → **Add** → 选 **Secret**，不要用 Plaintext。

## 部署

1. 用本目录 `gemini-proxy.js` 替换 Worker 代码 → **Deploy**
2. 确认两个 Secret 已保存

## 请求示例

```
POST .../v1beta/models/gemini-2.5-flash:generateContent
X-Auth-Code: <你的授权码>
Content-Type: application/json
```

授权码错误 → **401**；未配置 Secret → **500**。
