#!/usr/bin/env python3
"""COROS 数据分析 — 交互式入口。

手动运行:
  python main.py          # 显示菜单
  python main.py --full   # 直接跑全面分析（无菜单）

Windows 也可双击 run.bat
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta
from pathlib import Path

from coros_loader import get_cache_summary, list_recent_activities
from gemini_analyzer import run_analysis

REPORTS_DIR = Path(__file__).resolve().parent / "reports"
DEFAULT_MODEL = "gemini-2.5-flash"


def _prompt(text: str, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""
    value = input(f"{text}{suffix}: ").strip()
    return value or default


def _prompt_int(text: str, default: int) -> int:
    while True:
        raw = _prompt(text, str(default))
        try:
            return int(raw)
        except ValueError:
            print("请输入数字。")


def _prompt_yes(text: str, default: bool = True) -> bool:
    hint = "Y/n" if default else "y/N"
    raw = _prompt(f"{text} ({hint})", "Y" if default else "N").lower()
    if not raw:
        return default
    return raw in ("y", "yes", "是", "1")


def _timestamp_slug() -> str:
    return datetime.now().strftime("%Y-%m-%d_%H%M")


def _default_output(slug: str) -> str:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    return str(REPORTS_DIR / f"{slug}.md")


def _run(
    question: str | None,
    weeks: int = 8,
    output: str | None = None,
    model: str = DEFAULT_MODEL,
) -> None:
    try:
        run_analysis(
            weeks=weeks,
            question=question,
            output_path=output,
            model=model,
        )
    except FileNotFoundError as e:
        print(f"\n错误: {e}")
    except RuntimeError as e:
        print(f"\n错误: {e}")
    except KeyboardInterrupt:
        print("\n已取消。")


def show_cache_status() -> None:
    summary = get_cache_summary()
    print("\n--- 本地 COROS 缓存 ---")
    if not summary["exists"]:
        print(f"未找到缓存: {summary['path']}")
        print("请先在 Cursor 中 sync_coros_data，或运行 coros-mcp sync")
        return
    print(f"路径: {summary['path']}")
    for key in ("activities", "daily_records", "sleep_records"):
        block = summary[key]
        print(
            f"  {key}: {block['count']} 条 "
            f"({block['from']} – {block['to']})"
        )
    print()


def menu_full_analysis() -> None:
    weeks = _prompt_int("加载最近几周数据", 8)
    save = _prompt_yes("是否保存报告到 reports 目录", True)
    output = _default_output(f"full_{_timestamp_slug()}") if save else None
    _run(
        question=None,
        weeks=weeks,
        output=output,
    )


def menu_custom_question() -> None:
    print("请输入你的问题（多行输入结束后单独一行输入 END）：")
    lines: list[str] = []
    while True:
        line = input()
        if line.strip().upper() == "END":
            break
        lines.append(line)
    question = "\n".join(lines).strip()
    if not question:
        print("未输入问题，已取消。")
        return
    weeks = _prompt_int("加载最近几周数据", 8)
    save = _prompt_yes("是否保存报告", True)
    output = _default_output(f"custom_{_timestamp_slug()}") if save else None
    _run(question=question, weeks=weeks, output=output)


def menu_last_activity() -> None:
    activities = list_recent_activities(limit=10)
    if not activities:
        print("缓存中没有运动记录。")
        return
    latest = activities[0]
    print(f"\n最近一次运动: {latest['date']} {latest['name']} ({latest['sport']})")
    print(
        f"  时长 {latest['duration']} | 距离 {latest['distance']} | "
        f"心率 {latest['avg_hr']} | 负荷 {latest['training_load']}"
    )
    question = (
        f"请专门分析我最近一次运动（{latest['date']} {latest['name']}，"
        f"类型 {latest['sport']}）：结合时长、距离、心率、训练负荷等指标，"
        f"评价强度是否合理，并给出恢复与下次同类训练的建议。只分析这一次运动。"
    )
    save = _prompt_yes("是否保存报告", True)
    output = _default_output(f"last_{_timestamp_slug()}") if save else None
    _run(question=question, weeks=2, output=output)


def menu_pick_activity() -> None:
    activities = list_recent_activities(limit=15)
    if not activities:
        print("缓存中没有运动记录。")
        return
    print("\n最近运动记录:")
    for i, a in enumerate(activities, 1):
        print(
            f"  {i}. {a['date']} | {a['name']} | {a['sport']} | "
            f"{a['duration']} | {a['distance']} | HR {a['avg_hr']}"
        )
    idx = _prompt_int("请输入序号", 1) - 1
    if idx < 0 or idx >= len(activities):
        print("序号无效。")
        return
    picked = activities[idx]
    question = (
        f"请专门分析以下这一次运动（{picked['date']} {picked['name']}，"
        f"类型 {picked['sport']}，时长 {picked['duration']}，"
        f"距离 {picked['distance']}，平均心率 {picked['avg_hr']}，"
        f"训练负荷 {picked['training_load']}）。"
        f"评价强度与恢复建议，不要分析其他运动。"
    )
    save = _prompt_yes("是否保存报告", True)
    output = _default_output(f"activity_{_timestamp_slug()}") if save else None
    _run(question=question, weeks=4, output=output)


def menu_yesterday() -> None:
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    question = (
        f"请专门分析我昨天（{yesterday}）的所有 COROS 运动记录。"
        f"若有多项运动请分别点评；若昨天无运动请说明并基于最近数据给建议。"
    )
    save = _prompt_yes("是否保存报告", True)
    output = _default_output(f"yesterday_{_timestamp_slug()}") if save else None
    _run(question=question, weeks=2, output=output)


def menu_recovery() -> None:
    question = (
        "请根据 daily_metrics 和 sleep 数据，重点分析我的 HRV 趋势、"
        "静息心率、ATI/CTI、疲劳度与训练负荷比，判断恢复是否充分、"
        "是否存在过度训练风险，并给出未来 3–7 天的训练安排建议。"
        "不需要详细点评单次运动。"
    )
    weeks = _prompt_int("加载最近几周数据", 4)
    save = _prompt_yes("是否保存报告", True)
    output = _default_output(f"recovery_{_timestamp_slug()}") if save else None
    _run(question=question, weeks=weeks, output=output)


def print_menu() -> None:
    print()
    print("=" * 50)
    print("  COROS 数据分析（Gemini）")
    print("=" * 50)
    print("  1. 全面分析报告")
    print("  2. 自定义问题分析")
    print("  3. 分析最近一次运动")
    print("  4. 从列表选择某次运动分析")
    print("  5. 分析昨天的运动")
    print("  6. 恢复指标专项分析（HRV / 负荷）")
    print("  7. 查看本地缓存概况")
    print("  0. 退出")
    print("=" * 50)


def interactive_loop() -> None:
    actions = {
        "1": menu_full_analysis,
        "2": menu_custom_question,
        "3": menu_last_activity,
        "4": menu_pick_activity,
        "5": menu_yesterday,
        "6": menu_recovery,
        "7": show_cache_status,
    }
    while True:
        print_menu()
        choice = input("请选择 [0-7]: ").strip()
        if choice == "0":
            print("再见。")
            break
        if choice == "7":
            show_cache_status()
            input("\n按 Enter 继续...")
            continue
        action = actions.get(choice)
        if not action:
            print("无效选项，请重新选择。")
            continue
        print()
        action()
        if choice != "7":
            input("\n按 Enter 返回主菜单...")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="COROS 数据分析交互入口",
        epilog="不带参数运行将进入交互菜单；也可双击 run.bat",
    )
    parser.add_argument(
        "--full",
        action="store_true",
        help="直接运行全面分析（跳过菜单）",
    )
    parser.add_argument("-q", "--question", help="直接提问（跳过菜单）")
    parser.add_argument("-w", "--weeks", type=int, default=8)
    parser.add_argument("-o", "--output", help="报告保存路径")
    parser.add_argument("-m", "--model", default=DEFAULT_MODEL)
    args = parser.parse_args()

    if args.full:
        _run(question=None, weeks=args.weeks, output=args.output, model=args.model)
        return
    if args.question:
        _run(
            question=args.question,
            weeks=args.weeks,
            output=args.output,
            model=args.model,
        )
        return

    if not sys.stdin.isatty():
        print("非交互环境请使用: python main.py --full 或 python analyze.py")
        sys.exit(1)

    interactive_loop()


if __name__ == "__main__":
    main()
