#!/usr/bin/env python3
"""使用 Gemini 分析 COROS 数据。

示例:
  python analyze.py
  python analyze.py -q "最近跑步心率是否过高？"
  python analyze.py --weeks 12 -o reports/latest.md
"""

from __future__ import annotations

import argparse

from gemini_analyzer import run_analysis


def main() -> None:
    parser = argparse.ArgumentParser(description="用 Gemini 分析 COROS 运动数据")
    parser.add_argument(
        "-q", "--question",
        help="向 Gemini 提出的具体问题（默认生成全面分析报告）",
    )
    parser.add_argument(
        "-w", "--weeks",
        type=int,
        default=8,
        help="加载最近多少周的数据（默认 8）",
    )
    parser.add_argument(
        "--cache",
        help="coros-mcp 缓存数据库路径（默认 ~/.config/coros-mcp/cache.db）",
    )
    parser.add_argument(
        "-o", "--output",
        help="将分析报告保存到指定文件（如 reports/analysis.md）",
    )
    parser.add_argument(
        "-m", "--model",
        help="Gemini 模型名称（默认 gemini-2.5-pro）",
    )
    args = parser.parse_args()

    run_analysis(
        weeks=args.weeks,
        question=args.question,
        cache_path=args.cache,
        output_path=args.output,
        model=args.model,
    )


if __name__ == "__main__":
    main()
