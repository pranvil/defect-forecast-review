#!/usr/bin/env python3
"""
纯 Python（无第三方依赖）的周分布生成与校验脚本。

用途：
- 复刻当前实现的核心分布逻辑（Created 约束分段分配 + 尾部惩罚；Fixed 按开发解决率约束分配，并用 Backlog reserve 塑形）
- 校验关键约束：
  - 从第一个 V 节点（按“前一周”口径）开始，backlog 单调不增（不抬头）
  - backlog >= 0
  - 最终 backlog <= max(1, round(totalCreated * 0.002))
  - 节点 testSubmissionRate / devResolutionRate 的累计约束是否满足

用法示例：
  python tools/forecast_distribution_verify.py --start 26W43 --weeks 16 --total 1000 \\
    --milestone M4@26W53:ts=85:dr=90 --milestone V1@26W2:ts=96:dr=98
"""

from __future__ import annotations

import argparse
import math
import re
from dataclasses import dataclass
from typing import List, Optional, Tuple


FINAL_BACKLOG_RATIO = 0.002


@dataclass(frozen=True)
class WeeklyPoint:
    weekLabel: str
    created: int = 0
    fixed: int = 0
    cumCreated: int = 0
    cumFixed: int = 0
    backlog: int = 0


@dataclass(frozen=True)
class Milestone:
    name: str
    week: str
    testSubmissionRate: Optional[float] = None
    devResolutionRate: Optional[float] = None


def parse_week_label(label: str) -> Tuple[int, int]:
    clean = (label or "").strip().upper().replace(" ", "")
    if "W" not in clean:
        return (2026, 1)
    left, right = clean.split("W", 1)
    year = 2000 + int(left[-2:]) if left else 2026
    week = int(right) if right.isdigit() else 1
    week = max(1, min(53, week))
    return (year, week)


def normalize_week(year: int, week: int) -> str:
    return f"{str(year)[-2:]}W{week}"


def advance_week(label: str, delta: int) -> str:
    y, w = parse_week_label(label)
    w2 = w + delta
    # 简化处理：只在 [1,53] 内滚动；跨年时按 53 周近似推进
    while w2 > 53:
        y += 1
        w2 -= 53
    while w2 < 1:
        y -= 1
        w2 += 53
    return normalize_week(y, w2)


def build_base_weekly(start_week: str, weeks: int) -> List[WeeklyPoint]:
    start = start_week.strip()
    if not start:
        start = "26W1"
    return [WeeklyPoint(weekLabel=advance_week(start, i)) for i in range(max(1, int(weeks)))]


def week_index(weekly: List[WeeklyPoint], label: str) -> int:
    normalized = (label or "").strip()
    if not normalized:
        return -1
    for idx, row in enumerate(weekly):
        if row.weekLabel == normalized:
            return idx
    return -1


def is_version_milestone(name: str) -> bool:
    return bool(re.match(r"^v\d*$", (name or "").strip(), re.IGNORECASE))


def is_convergence_milestone(name: str) -> bool:
    raw = (name or "").strip()
    return bool(re.match(r"^m5(?:-\d+)?$", raw, re.IGNORECASE)) or is_version_milestone(raw)


def infer_tail_start_index(weekly: List[WeeklyPoint], milestones: List[Milestone]) -> int:
    convergence_weeks = [m.week.strip() for m in milestones if is_convergence_milestone(m.name) and m.week.strip()]
    if not convergence_weeks:
        return max(0, len(weekly) - 2)
    earliest = sorted(convergence_weeks, key=parse_week_label)[0]
    idx = week_index(weekly, earliest)
    return idx if idx >= 0 else max(0, len(weekly) - 2)


def infer_version_start_index(weekly: List[WeeklyPoint], milestones: List[Milestone]) -> int:
    v_weeks = [m.week.strip() for m in milestones if is_version_milestone(m.name) and m.week.strip()]
    if not v_weeks:
        return len(weekly)
    earliest = sorted(v_weeks, key=parse_week_label)[0]
    idx = week_index(weekly, earliest)
    return idx if idx >= 0 else len(weekly)


def clamp(v: float, low: float, high: float) -> float:
    return min(high, max(low, v))


def round_to_total(raw: List[float], target_total: int) -> List[int]:
    floored = [max(0, int(math.floor(v))) for v in raw]
    remainder = target_total - sum(floored)
    order = sorted(range(len(raw)), key=lambda i: raw[i] - math.floor(raw[i]), reverse=True)
    for i in order[: max(0, remainder)]:
        floored[i] += 1
    return floored


def cumulative(values: List[int]) -> List[int]:
    out: List[int] = []
    total = 0
    for v in values:
        total += int(v)
        out.append(total)
    return out


def collect_constraints(
    weekly: List[WeeklyPoint],
    milestones: List[Milestone],
    metric: str,
    target_mode: str = "currentWeek",
) -> List[dict]:
    out: List[dict] = []
    for m in milestones:
        rate = getattr(m, metric)
        if rate is None:
            continue
        idx = week_index(weekly, m.week)
        if idx < 0:
            continue
        if target_mode == "previousWeek":
            idx = max(0, idx - 1)
        out.append(
            {
                "milestone": m.name,
                "week": m.week,
                "index": idx,
                "rate": clamp(float(rate), 1.0, 100.0),
                "metric": metric,
            }
        )
    out.sort(key=lambda x: int(x["index"]))
    return out


def lifecycle_created_weights(length: int) -> List[float]:
    if length <= 1:
        return [1.0 for _ in range(length)]
    out: List[float] = []
    for idx in range(length):
        ratio = idx / (length - 1)
        if ratio < 0.18:
            out.append(0.78 + 0.24 * (ratio / 0.18))
        elif ratio < 0.55:
            out.append(1.02)
        elif ratio < 0.82:
            out.append(1.02 + (0.28 - 1.02) * ((ratio - 0.55) / 0.27))
        else:
            out.append(max(0.04, 0.28 + (0.04 - 0.28) * ((ratio - 0.82) / 0.18)))
    return out


def smooth_created_forward_spikes(values: List[int], window: int = 4) -> List[int]:
    out = values[:]
    for source in range(1, len(out)):
        guard = 0
        while guard < 1000:
            guard += 1
            previous = out[source - 1]
            limit = max(previous + 20, round(previous * 1.15))
            if out[source] <= limit:
                break
            start = max(0, source - int(window))
            targets = sorted(range(start, source), key=lambda idx: (out[idx], -idx))
            if not targets:
                break
            target = targets[0]
            out[source] -= 1
            out[target] += 1
    return out


def distribute_by_constraints(
    total: int,
    weights: List[float],
    constraints: List[dict],
    max_cum_by_index: Optional[List[int]] = None,
) -> List[int]:
    length = len(weights)
    values = [0 for _ in range(length)]

    prev_index = -1
    prev_cum = 0

    points_by_index: dict[int, int] = {}
    for c in constraints:
        idx = int(c["index"])
        requested_cum = int(c.get("targetCum", round(total * float(c["rate"]) / 100)))
        capped = requested_cum
        if max_cum_by_index is not None and 0 <= idx < len(max_cum_by_index):
            capped = min(capped, int(max_cum_by_index[idx]))
        points_by_index[idx] = max(points_by_index.get(idx, 0), capped)

    points_by_index[length - 1] = total
    points = [{"index": i, "cum": c} for i, c in points_by_index.items()]
    points.sort(key=lambda x: int(x["index"]))

    for p in points:
        end = min(length - 1, max(prev_index + 1, int(p["index"])))
        target_cum = max(prev_cum, min(total, int(p["cum"])))
        amount = target_cum - prev_cum
        span = list(range(prev_index + 1, end + 1))
        span_weights = [float(weights[i]) for i in span]
        tw = sum(span_weights) or len(span) or 1
        raw = [amount * w / tw for w in span_weights]
        rounded = round_to_total(raw, amount)
        for idx, v in zip(span, rounded):
            values[idx] = int(v)
        prev_index = end
        prev_cum = target_cum

    return values


def distribute_increasing_by_constraints(
    total: int,
    length: int,
    constraints: List[dict],
    max_cum_by_index: Optional[List[int]] = None,
) -> List[int]:
    values = [0 for _ in range(length)]
    prev_index = -1
    prev_cum = 0

    points_by_index: dict[int, int] = {}
    for c in constraints:
        idx = int(c["index"])
        requested_cum = int(c.get("targetCum", round(total * float(c["rate"]) / 100)))
        capped = requested_cum
        if max_cum_by_index is not None and 0 <= idx < len(max_cum_by_index):
            capped = min(capped, int(max_cum_by_index[idx]))
        points_by_index[idx] = max(points_by_index.get(idx, 0), capped)

    points_by_index[length - 1] = total
    points = [{"index": i, "cum": c} for i, c in points_by_index.items()]
    points.sort(key=lambda x: int(x["index"]))

    for p in points:
        end = min(length - 1, max(prev_index + 1, int(p["index"])))
        target_cum = max(prev_cum, min(total, int(p["cum"])))
        amount = target_cum - prev_cum
        span_length = end - prev_index
        if span_length <= 0:
            prev_index = end
            prev_cum = target_cum
            continue
        base = amount // span_length
        remainder = amount - base * span_length
        for i in range(span_length):
            idx = prev_index + 1 + i
            values[idx] = base + (1 if i >= span_length - remainder else 0)
        prev_index = end
        prev_cum = target_cum

    return values


def move_total(values: List[int], from_indexes: List[int], to_indexes: List[int], amount: int, min_values: Optional[List[int]] = None) -> int:
    remaining = max(0, int(amount))
    for from_idx in from_indexes:
        if remaining <= 0:
            break
        available = values[from_idx] if 0 <= from_idx < len(values) else 0
        reserved = min_values[from_idx] if min_values is not None and 0 <= from_idx < len(min_values) else 0
        movable = max(0, available - reserved)
        if movable <= 0:
            continue
        moved = min(movable, remaining)
        values[from_idx] = available - moved
        remaining -= moved
        left = moved
        targets = sorted(
            [{"idx": idx, "value": values[idx]} for idx in to_indexes if 0 <= idx < len(values)],
            key=lambda x: (int(x["value"]), int(x["idx"])),
        )
        for target in targets:
            if left <= 0:
                break
            values[int(target["idx"])] += 1
            left -= 1
        cursor = 0
        while left > 0 and targets:
            target = targets[cursor % len(targets)]
            values[int(target["idx"])] += 1
            left -= 1
            cursor += 1
    return int(amount) - remaining


def enforce_minimum_cumulative(
    values: List[int],
    total: int,
    constraints: List[dict],
    max_cum_by_index: Optional[List[int]] = None,
    min_values: Optional[List[int]] = None,
) -> List[int]:
    out = values[:]
    for c in constraints:
        idx = max(0, min(len(out) - 1, int(c["index"])))
        requested = int(c.get("targetCum", round(total * float(c["rate"]) / 100)))
        target = min(requested, int(max_cum_by_index[idx])) if max_cum_by_index is not None else requested
        current = sum(out[: idx + 1])
        deficit = max(0, target - current)
        if not deficit:
            continue
        from_indexes = list(range(len(out) - 1, idx, -1))
        to_indexes = list(range(0, idx + 1))
        move_total(out, from_indexes, to_indexes, deficit, min_values)
    return out


def distribute_smooth_by_minimum_constraints(
    total: int,
    weights: List[float],
    constraints: List[dict],
    max_cum_by_index: Optional[List[int]] = None,
    min_values: Optional[List[int]] = None,
) -> List[int]:
    total_weight = sum(weights) or len(weights) or 1
    minimums = [max(0, int(v)) for v in min_values] if min_values else [0 for _ in weights]
    min_total = sum(minimums)
    base = minimums if min_total <= total else [0 for _ in weights]
    remaining = max(0, total - sum(base))
    seeded = [
        value + base[idx]
        for idx, value in enumerate(round_to_total([remaining * w / total_weight for w in weights], remaining))
    ]
    return enforce_minimum_cumulative(seeded, total, constraints, max_cum_by_index, min_values)


def spread_surplus_after_high_rate_milestones(
    values: List[int],
    total: int,
    constraints: List[dict],
    min_values: List[int],
) -> List[int]:
    out = values[:]
    slack = round(total * 0.04)
    high_rate_constraints = sorted(
        [c for c in constraints if float(c["rate"]) >= 85],
        key=lambda c: int(c["index"]),
        reverse=True,
    )
    for c in high_rate_constraints:
        idx = max(0, min(len(out) - 1, int(c["index"])))
        if idx >= len(out) - 1:
            continue
        target = round(total * float(c["rate"]) / 100)
        cap = min(total, target + slack)
        current = sum(out[: idx + 1])
        surplus = max(0, current - cap)
        if surplus <= 0:
            continue
        move_total(out, list(range(idx, -1, -1)), list(range(idx + 1, len(out))), surplus, min_values)
        out = enforce_minimum_cumulative(out, total, constraints, None, min_values)
    return out


def enforce_fixed_availability(fixed: List[int], created: List[int]) -> List[int]:
    out = fixed[:]
    created_cum = cumulative(created)
    fixed_cum = 0
    carry = 0
    for idx in range(len(out)):
        desired = int(out[idx]) + int(carry)
        available = max(0, int(created_cum[idx]) - int(fixed_cum))
        value = min(desired, available)
        out[idx] = int(value)
        fixed_cum += int(value)
        carry = desired - value
    return out


def enforce_tail_backlog_non_increasing(fixed: List[int], created: List[int], tail_start_index: int) -> List[int]:
    out = fixed[:]
    backlog = 0
    for idx in range(len(out)):
        previous_backlog = backlog
        backlog += int(created[idx]) - int(out[idx])
        if idx <= tail_start_index or backlog <= previous_backlog:
            continue
        needed = backlog - previous_backlog
        pulled = 0
        for j in range(idx + 1, len(out)):
            if pulled >= needed:
                break
            available = out[j]
            if available <= 0:
                continue
            take = min(available, needed - pulled)
            out[j] -= take
            out[idx] += take
            pulled += take
        backlog -= pulled
    return enforce_fixed_availability(out, created)


def tail_reserve_from_actual_backlog(created: List[int], fixed: List[int], tail_start_index: int, final_backlog: int) -> List[int]:
    n = max(len(created), len(fixed))
    if n <= 0:
        return []
    created_cum = cumulative(created[:n])
    fixed_cum = cumulative(fixed[:n])
    tail = max(0, min(n - 1, int(tail_start_index)))
    backlog_at_tail = max(0, int(created_cum[tail]) - int(fixed_cum[tail]))
    end = max(tail + 1, n - 1)
    span = max(1, end - tail)
    reserve: List[int] = []
    for idx in range(n):
        if idx < tail:
            reserve.append(0)
            continue
        t = (idx - tail) / span
        v = int(round(backlog_at_tail + (int(final_backlog) - backlog_at_tail) * t))
        reserve.append(max(int(final_backlog), v))
    for i in range(tail + 1, n):
        reserve[i] = min(reserve[i], reserve[i - 1])
    return reserve


def front_load_fixed(fixed: List[int], created: List[int], reserve_by_index: List[int], tail_start_index: int) -> List[int]:
    out = fixed[:]
    created_cum = cumulative(created)
    start = max(1, int(tail_start_index) + 1)
    for source in range(start, len(out)):
        movable = out[source]
        while movable > 0:
            candidate = out[:]
            candidate[source] -= 1
            fixed_cum = 0
            target = -1
            for idx in range(source):
                reserve = int(reserve_by_index[idx]) if idx < len(reserve_by_index) else 0
                backlog_before = int(created_cum[idx]) - fixed_cum
                if backlog_before <= reserve:
                    fixed_cum += candidate[idx]
                    continue
                if idx < tail_start_index:
                    fixed_cum += candidate[idx]
                    continue
                if fixed_cum + candidate[idx] + 1 <= max(0, int(created_cum[idx]) - reserve):
                    target = idx
                    break
                fixed_cum += candidate[idx]
            if target < 0:
                break
            candidate[target] += 1
            normalized = enforce_fixed_availability(candidate, created)
            if normalized[source] != candidate[source] or normalized[target] != candidate[target]:
                break
            out[source] -= 1
            out[target] += 1
            movable -= 1
    return out


def tail_backlog_is_valid(fixed: List[int], created: List[int], tail_start_index: int) -> bool:
    backlog = 0
    for idx in range(len(fixed)):
        previous_backlog = backlog
        backlog += int(created[idx]) - int(fixed[idx])
        if backlog < 0:
            return False
        if idx > tail_start_index and backlog > previous_backlog:
            return False
    return True


def smooth_tail_fixed_spikes(fixed: List[int], created: List[int], tail_start_index: int) -> List[int]:
    out = fixed[:]
    start = max(0, tail_start_index)
    for source in range(len(out) - 1, start, -1):
        guard = 0
        while guard < 200:
            guard += 1
            targets = sorted(range(start, source), key=lambda idx: (out[idx], -idx))
            if not targets:
                break
            target = targets[0]
            if out[source] <= out[target]:
                break
            candidate = out[:]
            candidate[source] -= 1
            candidate[target] += 1
            if not tail_backlog_is_valid(candidate, created, tail_start_index):
                break
            out = candidate
    return out


def smooth_convergence_boundary_fixed_spike(fixed: List[int], created: List[int], tail_start_index: int, window: int = 2) -> List[int]:
    out = fixed[:]
    source = int(tail_start_index)
    if source <= 0 or source >= len(out):
        return out
    start = max(1, source - int(window) + 1)
    guard = 0
    while guard < 400:
        guard += 1
        if out[source] <= out[source - 1] + 1:
            break
        target = source - 1
        if target < start:
            break
        candidate = out[:]
        candidate[source] -= 1
        candidate[target] += 1
        normalized = enforce_fixed_availability(candidate, created)
        if normalized[source] != candidate[source] or normalized[target] != candidate[target]:
            break
        out = normalized
    return out


def final_backlog_target(total_created: int) -> int:
    total = max(0, int(round(total_created)))
    return max(1, int(round(total * FINAL_BACKLOG_RATIO)))


def backlog_reserve_shape(total_created: int, length: int, tail_start_index: int, final_target: int) -> List[int]:
    if length <= 1 or total_created <= 0:
        return [0 for _ in range(length)]
    tail = max(0, min(length - 1, int(tail_start_index)))
    peak = max(final_target, int(round(total_created * 0.1)))
    out: List[int] = []
    for idx in range(length):
        if idx <= 0:
            out.append(0)
            continue
        if idx >= length - 1:
            out.append(final_target)
            continue
        if idx <= tail:
            ratio = 0.0 if tail <= 0 else idx / tail
            out.append(int(round(peak * math.sin(math.pi / 2 * ratio))))
        else:
            span = max(1, (length - 1) - tail)
            ratio = (idx - tail) / span
            out.append(int(round(peak + (final_target - peak) * ratio)))
    # 尾部不抬头：从 tail+1 开始单调不增
    for i in range(max(1, tail + 1), length - 1):
        out[i] = min(out[i], out[i - 1])
    return [max(0, v) for v in out]


def build_distribution(
    start_week: str,
    weeks: int,
    total_defects: int,
    milestones: List[Milestone],
    target_mode: str = "currentWeek",
) -> Tuple[List[WeeklyPoint], dict]:
    base_weekly = build_base_weekly(start_week, weeks)
    total = max(0, int(round(total_defects)))

    tail_start = infer_tail_start_index(base_weekly, milestones)
    # Milestones split the lifecycle into cumulative target segments.
    created_constraints = collect_constraints(base_weekly, milestones, "testSubmissionRate", target_mode)
    created = distribute_increasing_by_constraints(total, len(base_weekly), created_constraints)

    created_cum = cumulative(created)

    # fixed: distribute with dev resolution constraints, but shape by backlog reserve
    fixed_constraints = collect_constraints(base_weekly, milestones, "devResolutionRate", target_mode)
    fixed_constraints_by_created = []
    for c in fixed_constraints:
        idx = int(c["index"])
        target_cum = int(round((created_cum[idx] if idx < len(created_cum) else 0) * float(c["rate"]) / 100))
        fixed_constraints_by_created.append({**c, "targetCum": target_cum})

    last_fixed_constraint = fixed_constraints[-1] if fixed_constraints else None
    final_backlog = 0 if last_fixed_constraint and float(last_fixed_constraint["rate"]) >= 100 else final_backlog_target(total)
    fixed_total = max(0, total - final_backlog)
    reserve = backlog_reserve_shape(total, len(base_weekly), tail_start, final_backlog)

    fixed_weights = [
        (created[i - 1] if i > 0 else 0) + (created[i - 2] if i > 1 else 0) * 0.8 + 1
        for i in range(len(created))
    ]
    if tail_start >= 0 and reserve:
        for i in range(tail_start, len(fixed_weights)):
            reserve_pressure = 1.0 + max(0, int(reserve[tail_start]) - int(reserve[i])) / max(1, int(total))
            fixed_weights[i] *= reserve_pressure
    # devResolutionRate 优先：reserve 只影响权重倾向，不再作为 fixed 累计硬上限。
    fixed_raw = distribute_increasing_by_constraints(fixed_total, len(base_weekly), fixed_constraints_by_created, created_cum)
    fixed = smooth_tail_fixed_spikes(
        enforce_tail_backlog_non_increasing(
            front_load_fixed(
                (fixed_avail := enforce_fixed_availability(fixed_raw, created)),
                created,
                tail_reserve_from_actual_backlog(created, fixed_avail, tail_start, final_backlog),
                tail_start,
            ),
            created,
            tail_start,
        ),
        created,
        tail_start,
    )
    fixed = smooth_convergence_boundary_fixed_spike(fixed, created, tail_start, window=2)

    out: List[WeeklyPoint] = []
    cum_c = 0
    cum_f = 0
    for row, c, f in zip(base_weekly, created, fixed):
        cum_c += int(c)
        cum_f += int(f)
        out.append(
            WeeklyPoint(
                weekLabel=row.weekLabel,
                created=int(c),
                fixed=int(f),
                cumCreated=int(cum_c),
                cumFixed=int(cum_f),
                backlog=int(cum_c - cum_f),
            )
        )

    meta = {
        "tailStartIndex": tail_start,
        "tailStartWeek": out[tail_start].weekLabel if out else "",
        "finalBacklogTarget": final_backlog,
        "targetMode": target_mode,
    }
    return out, meta


def verify(
    weekly: List[WeeklyPoint],
    milestones: List[Milestone],
    meta: dict,
) -> List[str]:
    errors: List[str] = []
    if not weekly:
        return ["empty weekly"]

    tail = int(meta.get("tailStartIndex", 0))
    # backlog >= 0
    for row in weekly:
        if row.backlog < 0:
            errors.append(f"backlog<0 at {row.weekLabel}: {row.backlog}")
            break
    # tail backlog non-increasing
    for i in range(max(1, tail + 1), len(weekly)):
        if weekly[i].backlog > weekly[i - 1].backlog:
            errors.append(
                f"tail backlog rises at {weekly[i-1].weekLabel}->{weekly[i].weekLabel}: "
                f"{weekly[i-1].backlog}->{weekly[i].backlog}"
            )
            break
    # final backlog threshold
    final_target = int(meta.get("finalBacklogTarget", 0))
    if weekly[-1].backlog > final_target:
        errors.append(f"final backlog {weekly[-1].backlog} > target {final_target}")

    # milestone constraints check.
    # build lookup
    idx_by_week = {row.weekLabel: i for i, row in enumerate(weekly)}
    for m in milestones:
        idx = idx_by_week.get(m.week.strip(), -1)
        if idx < 0:
            continue
        if meta.get("targetMode") == "previousWeek":
            idx = max(0, idx - 1)
        row = weekly[idx]
        total = weekly[-1].cumCreated or 1
        if m.testSubmissionRate is not None:
            required = int(round(total * float(m.testSubmissionRate) / 100))
            if row.cumCreated < required:
                errors.append(
                    f"{m.name} testSubmissionRate not met at {row.weekLabel}: "
                    f"cumCreated={row.cumCreated} < required={required}"
                )
        if m.devResolutionRate is not None:
            required_fixed = int(round(row.cumCreated * float(m.devResolutionRate) / 100))
            if row.cumFixed < required_fixed:
                errors.append(
                    f"{m.name} devResolutionRate not met at {row.weekLabel}: "
                    f"cumFixed={row.cumFixed} < required={required_fixed}"
                )

    return errors


def parse_milestone_arg(text: str) -> Milestone:
    # format: Name@26W10:ts=96:dr=98
    raw = (text or "").strip()
    if "@" not in raw:
        raise ValueError(f"invalid milestone '{text}', expected Name@Week:ts=..:dr=..")
    name, rest = raw.split("@", 1)
    parts = rest.split(":")
    week = parts[0].strip()
    ts = None
    dr = None
    for p in parts[1:]:
        p = p.strip()
        if p.startswith("ts="):
            ts = float(p.split("=", 1)[1])
        elif p.startswith("dr="):
            dr = float(p.split("=", 1)[1])
    return Milestone(name=name.strip(), week=week, testSubmissionRate=ts, devResolutionRate=dr)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", default="26W1", help="start week label, e.g. 26W20")
    ap.add_argument("--weeks", type=int, default=20, help="number of weeks")
    ap.add_argument("--total", type=int, default=1000, help="total defects / total created")
    ap.add_argument("--target-mode", choices=["currentWeek", "previousWeek"], default="currentWeek")
    ap.add_argument("--milestone", action="append", default=[], help="milestone definition, Name@Week:ts=..:dr=..")
    args = ap.parse_args()

    milestones = [parse_milestone_arg(x) for x in args.milestone]
    weekly, meta = build_distribution(args.start, args.weeks, args.total, milestones, args.target_mode)
    errors = verify(weekly, milestones, meta)

    print(f"tailStart={meta['tailStartWeek']} (index={meta['tailStartIndex']}) finalBacklogTarget={meta['finalBacklogTarget']}")
    print("week,created,fixed,cumCreated,cumFixed,backlog")
    for r in weekly:
        print(f"{r.weekLabel},{r.created},{r.fixed},{r.cumCreated},{r.cumFixed},{r.backlog}")
    if errors:
        print("\nVERIFY: FAIL")
        for e in errors:
            print(" -", e)
        return 2
    print("\nVERIFY: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
