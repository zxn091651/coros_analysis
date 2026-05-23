# COROS 数据分析

从 [coros-mcp](https://github.com/cygnusb/coros-mcp) 同源 API / 本地缓存读取运动与恢复数据，使用 [Google Gemini](https://ai.google.dev/gemini-api/docs) 生成中文训练分析报告。

| 方式 | 目录 | 说明 |
|------|------|------|
| **Web** | [`docs/`](docs/) | 纯前端：浏览器登录 COROS，经 Cloudflare Worker 调用 Gemini |
| **CLI** | 项目根目录 | Python：读取 coros-mcp 本地 `cache.db` |

在线站点（推送 `main` 后由 Actions 部署）：  
https://zxn091651.github.io/coros_analysis/

---

## Web 版

使用说明、本地预览与 Pages 配置见 **[docs/README.md](docs/README.md)**。

Gemini 代理部署与 Secret 配置见 **[worker/README.md](worker/README.md)**。

要点：

- COROS 账号密码仅在浏览器内请求官方 API，不经本仓库服务器。
- Gemini API Key **不进入前端**；网页仅向你的 Worker 发送授权码（`X-Auth-Code`），由 Worker 校验后转发。
- 授权码与 API Key 在 Cloudflare 中以 **Secret** 配置，请勿提交到 Git 或写在公开 README 中。

---

## 本地 CLI

### 前置条件

1. 已配置并登录 **coros-mcp**（`coros-mcp auth`）
2. 缓存中已有数据（`sync_coros_data` 或 `coros-mcp sync`）
3. Python 3.11+
4. Gemini API 密钥（写入 `.env`，见下）

### 安装

```bash
cd coros-analysis
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env   # Windows；Unix 用 cp
# 编辑 .env，填入 GEMINI_API_KEY（勿提交）
```

### 使用

**交互菜单**（推荐）：

```bash
python main.py
```

Windows 可双击 **`run.bat`**。

菜单含：全面分析、自定义问题、最近一次运动、按列表选择、昨日运动、恢复指标专项、缓存概况等。

**命令行**：

```bash
python main.py --full
python main.py -q "分析我昨天的游泳"
python main.py --full -o reports/latest.md
python analyze.py -q "最近的 HRV 和训练负荷是否匹配？"
```

### 环境变量

| 变量 | 说明 | 默认 |
|------|------|------|
| `GEMINI_API_KEY` | Gemini API 密钥 | 必填 |
| `GEMINI_MODEL` | 模型 | `gemini-2.5-pro` |
| `COROS_CACHE_DB` | 缓存路径 | `~/.config/coros-mcp/cache.db`（Windows 为 `%USERPROFILE%\.config\coros-mcp\cache.db`） |

### 数据同步

本工具**只读**本地缓存。更新数据：

- Cursor 中调用 MCP `sync_coros_data`
- 或：`coros-mcp sync --from 20250101`

---

## 保密与仓库卫生

- `.env`、`config.secrets.*` 已忽略，**不要**把 API Key、COROS 密码或 Web 授权码推送到 GitHub。
- 若密钥曾在聊天、截图或公开提交中暴露，请在 [Google AI Studio](https://aistudio.google.com/apikey) 轮换，并更新 Cloudflare Secret / 本地 `.env`。
- 公开 Pages 站点可被任何人打开；Web 端 AI 能力由你自建的 Worker + `AUTH_CODE` 保护，请使用强口令并定期更换。
