# Gemini 代理 Worker

浏览器因 CORS 无法直连 Google API。本 Worker 在校验 **`X-Auth-Code`** 后，将请求转发到 Gemini；**API Key 与授权码仅保存在 Cloudflare Secrets**，不出现在仓库或前端代码中。

## 架构

```
浏览器 (GitHub Pages)
  → POST + X-Auth-Code
  → Cloudflare Worker (校验 AUTH_CODE)
  → generativelanguage.googleapis.com (带 GEMINI_API_KEY)
```

## 配置 Secrets

在 Worker 控制台：**Settings** → **Variables and Secrets** → **Add**，类型务必选 **Secret**（不要 Plaintext）。

| 名称 | 说明 |
|------|------|
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) 创建的密钥 |
| `AUTH_CODE` | 你自行设定的访问口令；网页「授权码」须与此完全一致 |

- 授权码请使用足够长的随机字符串，**不要写入 Git、Issues、截图或公开文档**。
- 若密钥或授权码曾泄露，请在 Google / Cloudflare 中**轮换**后重新部署。
- 修改 Secret 后需再次 **Deploy** 才会生效。

## 部署

1. 将本目录 `gemini-proxy.js` 粘贴到 Cloudflare Worker 编辑器（或通过 Wrangler 部署）。
2. 配置上述两个 Secret。
3. 点击 **Deploy**。
4. 将 Worker 的 HTTPS 地址写入 `docs/config.json` 的 `geminiProxyUrl`（若域名与默认不同）。

## 请求格式

```http
POST /v1beta/models/gemini-2.5-flash:generateContent
Content-Type: application/json
X-Auth-Code: <你在 Secret 中配置的 AUTH_CODE>
```

| 响应 | 含义 |
|------|------|
| 401 | `X-Auth-Code` 与 `AUTH_CODE` 不一致 |
| 500 | Worker 未配置 Secret |
| 2xx | 已转发至 Gemini |

## 安全建议

- 公开仓库中的 Worker 源码可被任何人阅读，**访问控制完全依赖 `AUTH_CODE` 的强度与保密**。
- 不要将真实 `AUTH_CODE`、`GEMINI_API_KEY` 提交到版本库；`.env` 仅用于本地 Python CLI。
- 可为 Worker 配置自定义域名与速率限制（Cloudflare 仪表盘），降低滥用风险。
