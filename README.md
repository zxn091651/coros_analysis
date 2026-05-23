# COROS 数据分析

- **Web 版（GitHub Pages）**：`docs/` — 纯前端，浏览器登录 COROS + Gemini 分析 → [在线访问](https://zxn091651.github.io/coros_analysis/)
- **本地 CLI**：Python 脚本，从 coros-mcp 本地缓存读取数据

从 [coros-mcp](https://github.com/cygnusb/coros-mcp) 同源 API / 缓存读取运动与恢复数据，调用 [Google Gemini API](https://ai.google.dev/gemini-api/docs) 生成中文训练分析报告。

## Web 版（GitHub Pages）

见 [docs/README.md](docs/README.md)。推送 `main` 后由 Actions 自动部署到 `https://zxn091651.github.io/coros_analysis/`。

## 前置条件

1. 已在 Cursor 中配置并登录 **coros MCP**（`coros-mcp auth`）
2. 缓存中已有数据（在 Cursor 里调用 `sync_coros_data`，或终端运行 `coros-mcp sync`）
3. Python 3.11+
4. [Google AI Studio](https://aistudio.google.com/apikey) 中的 Gemini API 密钥

## 安装

```bash
cd e:\coros-analysis
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

配置 API（`.env` 已包含密钥时可跳过）：

```bash
copy .env.example .env
# 编辑 .env，填入 GEMINI_API_KEY
```

## 使用（推荐入口）

**交互式菜单**（手动分析最方便）：

```bash
python main.py
```

Windows 也可 **双击 `run.bat`**，会自动创建虚拟环境并打开菜单。

菜单选项：
1. 全面分析报告
2. 自定义问题（多行输入，单独一行 `END` 结束）
3. 分析最近一次运动
4. 从列表选择某次运动
5. 分析昨天的运动
6. 恢复指标专项（HRV / 训练负荷）
7. 查看本地缓存概况

**命令行快捷方式**（跳过菜单）：

```bash
python main.py --full
python main.py -q "分析我昨天的游泳"
python main.py --full -o reports/latest.md
```

**原 CLI**（仍可用）：

```bash
python analyze.py -q "我最近的 HRV 和训练负荷是否匹配？"
```

## 环境变量

| 变量 | 说明 | 默认 |
|------|------|------|
| `GEMINI_API_KEY` | Gemini API 密钥 | 必填 |
| `GEMINI_MODEL` | 模型名称 | `gemini-2.5-pro` |
| `COROS_CACHE_DB` | 缓存路径 | `%USERPROFILE%\.config\coros-mcp\cache.db` |

## 数据同步

本工具**只读**本地缓存。数据更新方式：

- Cursor 中让 AI 调用 MCP 工具 `sync_coros_data`
- 或终端：`coros-mcp sync --from 20250101`

## 安全说明

- `.env` 已加入 `.gitignore`，请勿将 API Key 提交到 Git
- 若密钥曾在聊天或公开仓库中暴露，建议在 Google AI Studio 轮换密钥
