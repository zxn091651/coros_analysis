"""使用 Google Gemini API 分析 Coros 数据。"""

from __future__ import annotations

import json
import os
from typing import Any

from dotenv import load_dotenv
from google import genai
from google.genai import types

from coros_loader import CorosDataset, load_coros_data

load_dotenv()

SYSTEM_PROMPT = """你是一位专业的耐力运动教练与运动生理分析师，熟悉 COROS 手表的数据含义。

用户会提供 JSON 格式的 COROS 缓存数据，包含：
- activities: 运动记录（跑步、骑行、游泳等）
- daily_metrics: 每日恢复指标（睡眠 HRV、静息心率、训练负荷、ATI/CTI、疲劳度等）
- sleep: 睡眠阶段与时长

请用中文回答，结构清晰，包含：
1. **数据概览**（时间范围、运动次数与类型分布）
2. **训练负荷与恢复**（HRV 趋势、ATI/CTI、疲劳度、是否过度训练或恢复不足）
3. **单次运动点评**（强度是否合理、心率是否偏高/偏低，结合运动类型）
4. **可执行建议**（接下来 3–7 天如何安排训练与休息）

若数据不足某一项，请明确说明，不要编造。数字引用要具体。"""


def _client() -> genai.Client:
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if api_key:
        return genai.Client(api_key=api_key)
    return genai.Client()


def analyze_with_gemini(
    dataset: CorosDataset,
    question: str | None = None,
    model: str | None = None,
) -> str:
    """将 Coros 数据发送给 Gemini 并返回分析文本。"""
    model = model or os.getenv("GEMINI_MODEL", "gemini-2.5-pro")
    payload: dict[str, Any] = dataset.to_summary_dict()

    user_parts = [
        "以下是我的 COROS 运动与恢复数据（JSON）：\n",
        json.dumps(payload, ensure_ascii=False, indent=2),
    ]
    if question:
        user_parts.append(f"\n\n请重点回答这个问题：\n{question}")
    else:
        user_parts.append(
            "\n\n请根据上述数据，给出全面的训练与恢复分析报告。"
        )

    client = _client()
    try:
        response = client.models.generate_content(
            model=model,
            contents="".join(user_parts),
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.3,
            ),
        )
    except Exception as e:
        err = str(e).lower()
        if "api_key" in err or "invalid" in err and "key" in err:
            raise RuntimeError(
                "GEMINI_API_KEY 无效，请检查 .env 中的密钥是否正确。"
            ) from e
        if "quota" in err or "resource_exhausted" in err:
            raise RuntimeError(
                f"Gemini 模型 {model} 配额不足（免费层可能不支持该模型）。"
                "可尝试: python analyze.py -m gemini-2.5-flash"
                "或在 https://aistudio.google.com 查看配额。"
            ) from e
        raise
    return response.text or ""


def run_analysis(
    weeks: int = 8,
    question: str | None = None,
    cache_path: str | None = None,
    output_path: str | None = None,
    model: str | None = None,
) -> str:
    """加载数据、调用 Gemini、可选保存报告。"""
    from pathlib import Path

    ds = load_coros_data(
        cache_path=Path(cache_path) if cache_path else None,
        weeks=weeks,
    )
    print(f"已加载缓存: {ds.cache_path}")
    print(
        f"数据范围: {ds.date_range} | "
        f"运动 {len(ds.activities)} 次 | "
        f"每日指标 {len(ds.daily_records)} 天 | "
        f"睡眠 {len(ds.sleep_records)} 天"
    )
    model_name = model or os.getenv("GEMINI_MODEL", "gemini-2.5-pro")
    print(f"正在请求 Gemini 分析（{model_name}）…")

    report = analyze_with_gemini(ds, question=question, model=model)
    print("\n" + "=" * 60 + "\n")
    print(report)

    if output_path:
        out = Path(output_path)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(report, encoding="utf-8")
        print(f"\n报告已保存: {out}")

    return report
