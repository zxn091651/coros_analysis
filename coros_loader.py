"""从 coros-mcp 本地 SQLite 缓存加载运动与恢复数据。"""

from __future__ import annotations

import json
import os
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any


def default_cache_path() -> Path:
    env = os.getenv("COROS_CACHE_DB")
    if env:
        return Path(env)
    return Path.home() / ".config" / "coros-mcp" / "cache.db"


def _fmt_date(yyyymmdd: str) -> str:
    if len(yyyymmdd) == 8:
        return f"{yyyymmdd[:4]}-{yyyymmdd[4:6]}-{yyyymmdd[6:8]}"
    return yyyymmdd


def _fmt_duration(seconds: int | float | None) -> str:
    if not seconds:
        return "0:00"
    s = int(seconds)
    h, rem = divmod(s, 3600)
    m, sec = divmod(rem, 60)
    if h:
        return f"{h}:{m:02d}:{sec:02d}"
    return f"{m}:{sec:02d}"


def _fmt_distance(meters: float | None) -> str:
    if meters is None or meters <= 0:
        return "—"
    if meters >= 1000:
        return f"{meters / 1000:.2f} km"
    return f"{meters:.0f} m"


@dataclass
class CorosDataset:
    cache_path: Path
    activities: list[dict[str, Any]]
    daily_records: list[dict[str, Any]]
    sleep_records: list[dict[str, Any]]
    date_range: str

    def to_summary_dict(self) -> dict[str, Any]:
        return {
            "cache_path": str(self.cache_path),
            "date_range": self.date_range,
            "activity_count": len(self.activities),
            "activities": self.activities,
            "daily_metrics": self.daily_records,
            "sleep": self.sleep_records,
        }


def load_coros_data(
    cache_path: Path | None = None,
    weeks: int = 8,
) -> CorosDataset:
    """加载最近 N 周内的缓存数据。"""
    db = cache_path or default_cache_path()
    if not db.exists():
        raise FileNotFoundError(
            f"未找到 coros 缓存: {db}\n"
            "请先在 Cursor 中通过 coros MCP 执行 sync_coros_data，或运行: coros-mcp sync"
        )

    cutoff = (datetime.now() - timedelta(weeks=weeks)).strftime("%Y%m%d")

    conn = sqlite3.connect(db)
    conn.row_factory = sqlite3.Row
    try:
        activities_raw = conn.execute(
            "SELECT activity_id, start_day, data FROM activities WHERE start_day >= ? ORDER BY start_day DESC",
            (cutoff,),
        ).fetchall()
        daily_raw = conn.execute(
            "SELECT date, data FROM daily_records WHERE date >= ? ORDER BY date",
            (cutoff,),
        ).fetchall()
        sleep_raw = conn.execute(
            "SELECT date, data FROM sleep_records WHERE date >= ? ORDER BY date",
            (cutoff,),
        ).fetchall()
    finally:
        conn.close()

    activities: list[dict[str, Any]] = []
    for row in activities_raw:
        d = json.loads(row["data"])
        activities.append(
            {
                "id": row["activity_id"],
                "date": _fmt_date(row["start_day"]),
                "name": d.get("name"),
                "sport": d.get("sport_name") or f"Sport {d.get('sport_type')}",
                "duration": _fmt_duration(d.get("duration_seconds")),
                "distance": _fmt_distance(d.get("distance_meters")),
                "avg_hr": d.get("avg_hr"),
                "max_hr": d.get("max_hr"),
                "training_load": d.get("training_load"),
                "elevation_gain_m": d.get("elevation_gain"),
                "avg_power": d.get("avg_power"),
            }
        )

    daily_records: list[dict[str, Any]] = []
    for row in daily_raw:
        d = json.loads(row["data"])
        daily_records.append(
            {
                "date": _fmt_date(d.get("date", row["date"])),
                "sleep_hrv": d.get("avg_sleep_hrv"),
                "hrv_baseline": d.get("baseline"),
                "resting_hr": d.get("rhr"),
                "training_load": d.get("training_load"),
                "load_ratio": d.get("training_load_ratio"),
                "fatigue_pct": d.get("tired_rate"),
                "ati": d.get("ati"),
                "cti": d.get("cti"),
            }
        )

    sleep_records: list[dict[str, Any]] = []
    for row in sleep_raw:
        d = json.loads(row["data"])
        phases = d.get("phases") or {}
        sleep_records.append(
            {
                "date": _fmt_date(d.get("date", row["date"])),
                "total_sleep_min": d.get("total_duration_minutes"),
                "deep_min": phases.get("deep_minutes"),
                "rem_min": phases.get("rem_minutes"),
                "light_min": phases.get("light_minutes"),
                "awake_min": phases.get("awake_minutes"),
                "avg_hr": d.get("avg_hr"),
                "quality_score": d.get("quality_score"),
            }
        )

    dates: list[str] = []
    if daily_records:
        dates.extend(r["date"] for r in daily_records)
    if activities:
        dates.extend(a["date"] for a in activities)
    if dates:
        date_range = f"{min(dates)} – {max(dates)}"
    else:
        date_range = "无数据"

    return CorosDataset(
        cache_path=db,
        activities=activities,
        daily_records=daily_records,
        sleep_records=sleep_records,
        date_range=date_range,
    )


def get_cache_summary(cache_path: Path | None = None) -> dict[str, Any]:
    """返回本地缓存概况，不加载全部记录。"""
    db = cache_path or default_cache_path()
    if not db.exists():
        return {"exists": False, "path": str(db)}

    conn = sqlite3.connect(db)
    try:
        def _range(table: str, date_col: str) -> tuple[int, str | None, str | None]:
            row = conn.execute(
                f"SELECT COUNT(*), MIN({date_col}), MAX({date_col}) FROM {table}"
            ).fetchone()
            return row[0], row[1], row[2]

        act_n, act_from, act_to = _range("activities", "start_day")
        daily_n, daily_from, daily_to = _range("daily_records", "date")
        sleep_n, sleep_from, sleep_to = _range("sleep_records", "date")
    finally:
        conn.close()

    return {
        "exists": True,
        "path": str(db),
        "activities": {"count": act_n, "from": act_from, "to": act_to},
        "daily_records": {"count": daily_n, "from": daily_from, "to": daily_to},
        "sleep_records": {"count": sleep_n, "from": sleep_from, "to": sleep_to},
    }


def list_recent_activities(
    limit: int = 15,
    cache_path: Path | None = None,
) -> list[dict[str, Any]]:
    """列出最近的运动记录（用于菜单选择）。"""
    db = cache_path or default_cache_path()
    if not db.exists():
        return []

    conn = sqlite3.connect(db)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            "SELECT activity_id, start_day, data FROM activities "
            "ORDER BY start_day DESC LIMIT ?",
            (limit,),
        ).fetchall()
    finally:
        conn.close()

    result: list[dict[str, Any]] = []
    for row in rows:
        d = json.loads(row["data"])
        result.append(
            {
                "id": row["activity_id"],
                "date": _fmt_date(row["start_day"]),
                "name": d.get("name"),
                "sport": d.get("sport_name") or f"Sport {d.get('sport_type')}",
                "duration": _fmt_duration(d.get("duration_seconds")),
                "distance": _fmt_distance(d.get("distance_meters")),
                "avg_hr": d.get("avg_hr"),
                "training_load": d.get("training_load"),
            }
        )
    return result
