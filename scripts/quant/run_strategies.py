#!/usr/bin/env python3
import argparse
import datetime as dt
import json
import math
import os
import sys
import urllib.parse
import urllib.request
import time

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

STRATEGY_CAPITALS = [
    {"id": "fixed_5w", "name": "固定金额 5万", "capital": 50000, "price_min": 10, "price_max": 100},
    {"id": "fixed_20w", "name": "固定金额 20万", "capital": 200000, "price_min": 100, "price_max": 500},
    {"id": "fixed_50w", "name": "固定金额 50万", "capital": 500000, "price_min": 500, "price_max": None},
]

STRATEGY_RISKS = [
    {"id": "aggressive", "name": "激进型", "risk_level": "aggressive"},
    {"id": "low_vol", "name": "低波型", "risk_level": "low_vol"},
    {"id": "income", "name": "创收型", "risk_level": "income"},
    {"id": "steady", "name": "稳收益", "risk_level": "steady"},
]

STRATEGY_LABELS = {
    "fixed_5w_aggressive": "F5-AG",
    "fixed_5w_low_vol": "F5-LV",
    "fixed_5w_income": "F5-IN",
    "fixed_5w_steady": "F5-ST",
    "fixed_20w_aggressive": "F20-AG",
    "fixed_20w_low_vol": "F20-LV",
    "fixed_20w_income": "F20-IN",
    "fixed_20w_steady": "F20-ST",
    "fixed_50w_aggressive": "F50-AG",
    "fixed_50w_low_vol": "F50-LV",
    "fixed_50w_income": "F50-IN",
    "fixed_50w_steady": "F50-ST",
}

MAX_PICKS = 5
DEFAULT_LIQUIDITY_TOP = 500


def is_etf(stock):
    stock_id = str(stock.get("stock_id") or "")
    name = str(stock.get("name") or "")
    if stock_id.startswith("00"):
        return True
    if "ETF" in name.upper():
        return True
    return False


def request_json(method, path, params=None, payload=None, prefer=None, retries=3, return_response=False):
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

    url = f"{SUPABASE_URL}/rest/v1/{path}"
    if params:
        url = f"{url}?{urllib.parse.urlencode(params, doseq=True)}"

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer

    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    last_error = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                body = resp.read().decode("utf-8")
                if return_response:
                    return resp.status, (json.loads(body) if body else [])
                return json.loads(body) if body else []
        except Exception as exc:
            last_error = exc
            time.sleep(1 + attempt)
    raise last_error


def to_date(value):
    if isinstance(value, dt.date):
        return value
    return dt.datetime.strptime(value, "%Y-%m-%d").date()


def percent_change(a, b):
    if a is None or b is None or a == 0:
        return 0.0
    return (b - a) / a


def stddev(values):
    if not values:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / len(values)
    return math.sqrt(variance)


def fetch_active_stocks(limit=None):
    params = {
        "select": "stock_id,name,is_active",
        "is_active": "eq.true",
        "order": "stock_id.asc",
    }
    if limit:
        params["limit"] = str(limit)
    return request_json("GET", "stocks", params=params)


def fetch_prices_range(stock_id, start_date, end_date):
    return request_json(
        "GET",
        "stock_prices",
        params={
            "select": "trade_date,close,volume",
            "stock_id": f"eq.{stock_id}",
            "trade_date": f"gte.{start_date}",
            "trade_date": f"lte.{end_date}",
            "order": "trade_date.asc",
        },
    )


def fetch_prices_bulk(stock_ids, start_date, end_date):
    if not stock_ids:
        return []
    in_list = ",".join(stock_ids)
    return request_json(
        "GET",
        "stock_prices",
        params={
            "select": "stock_id,trade_date,close,volume,turnover,high,low",
            "stock_id": f"in.({in_list})",
            "trade_date": f"gte.{start_date}",
            "trade_date": f"lte.{end_date}",
            "order": "trade_date.asc",
        },
    )


def compute_score(prices):
    if len(prices) < 2:
        return None
    closes = [row["close"] for row in prices if row.get("close") is not None]
    volumes = [row.get("volume") or 0 for row in prices]
    turnovers = [
        row.get("turnover")
        if row.get("turnover") is not None
        else (row.get("close") or 0) * (row.get("volume") or 0)
        for row in prices
    ]
    highs = [row.get("high") for row in prices if row.get("high") is not None]
    lows = [row.get("low") for row in prices if row.get("low") is not None]
    if len(closes) < 2:
        return None
    returns = []
    for i in range(1, len(closes)):
        returns.append(percent_change(closes[i - 1], closes[i]))
    vol = stddev(returns)
    avg_volume = sum(volumes) / len(volumes) if volumes else 0.0
    avg_turnover = sum(turnovers) / len(turnovers) if turnovers else 0.0
    last_close = closes[-1]
    prev_close = closes[-2] if len(closes) > 1 else closes[-1]
    close_3 = closes[-4] if len(closes) > 3 else closes[0]
    close_5 = closes[-6] if len(closes) > 5 else closes[0]
    close_10 = closes[-11] if len(closes) > 10 else closes[0]
    ret_1 = percent_change(prev_close, last_close)
    ret_3 = percent_change(close_3, last_close)
    ret_5 = percent_change(close_5, last_close)
    ret_10 = percent_change(close_10, last_close)
    avg_range = 0.0
    if highs and lows and len(highs) == len(lows):
        ranges = [(h - l) / l if l else 0 for h, l in zip(highs, lows)]
        avg_range = sum(ranges) / len(ranges) if ranges else 0.0
    vol_std = stddev(volumes) if volumes else 0.0
    vol_stability = vol_std / (avg_volume + 1e-6)
    last_volume = volumes[-1] if volumes else 0.0
    return {
        "volatility": vol,
        "avg_volume": avg_volume,
        "avg_turnover": avg_turnover,
        "last_volume": last_volume,
        "ret_1": ret_1,
        "ret_3": ret_3,
        "ret_5": ret_5,
        "ret_10": ret_10,
        "avg_range": avg_range,
        "vol_stability": vol_stability,
        "last_close": last_close,
    }


def build_strategy_id(capital, risk):
    return f"{capital['id']}_{risk['id']}"


def allocate_weights(scores):
    positive = [max(0.0, s) for s in scores]
    total = sum(positive)
    if total <= 0:
        return [1.0 / len(scores) for _ in scores]
    return [s / total for s in positive]


def cross_zscore(values):
    if not values:
        return []
    mean = sum(values) / len(values)
    sd = stddev(values)
    if sd == 0:
        return [0.0 for _ in values]
    return [(v - mean) / sd for v in values]


def target_score(value, target, tolerance):
    if tolerance <= 0:
        return 0.0
    diff = abs(value - target)
    score = 1.0 - (diff / tolerance)
    return max(0.0, min(1.0, score))


def above_score(value, threshold, span):
    if span <= 0:
        return 0.0
    score = (value - threshold) / span
    return max(0.0, min(1.0, score))


def build_profile_scores(items):
    if not items:
        return
    keys = [
        "ret_1",
        "ret_3",
        "ret_5",
        "ret_10",
        "volatility",
        "avg_volume",
        "avg_turnover",
        "avg_range",
        "vol_stability",
        "last_volume",
    ]
    for key in keys:
        values = [item.get(key, 0.0) or 0.0 for item in items]
        zs = cross_zscore(values)
        for item, z in zip(items, zs):
            item[f"{key}_z"] = z

    for item in items:
        daily_ret = (item.get("ret_10") or 0.0) / 10.0
        item["daily_ret"] = daily_ret
        item["mid_return_score"] = target_score(item.get("ret_5") or 0.0, 0.02, 0.01)
        item["low_return_score"] = target_score(item.get("ret_1") or 0.0, 0.005, 0.005)
        item["high_return_score"] = above_score(item.get("ret_1") or 0.0, 0.03, 0.03)
        item["steady_return_score"] = target_score(daily_ret, 0.015, 0.005)
        item["momentum_accel"] = (item.get("ret_3") or 0.0) - (item.get("ret_1") or 0.0)


def profile_score(profile_id, item):
    if profile_id == "aggressive":
        return (
            (item.get("high_return_score") or 0.0) * 0.5
            + (item.get("volatility_z") or 0.0) * 0.4
            - (item.get("avg_volume_z") or 0.0) * 0.3
        )
    if profile_id == "low_vol":
        return (
            (item.get("avg_turnover_z") or 0.0) * 0.35
            + (item.get("avg_volume_z") or 0.0) * 0.15
            + (item.get("mid_return_score") or 0.0) * 0.35
            - (item.get("avg_range_z") or 0.0) * 0.15
        )
    if profile_id == "income":
        accel = item.get("momentum_accel") or 0.0
        return (
            (item.get("ret_3_z") or 0.0) * 0.3
            + (item.get("low_return_score") or 0.0) * 0.4
            - (item.get("volatility_z") or 0.0) * 0.3
            + accel * 0.2
        )
    if profile_id == "steady":
        return (
            (item.get("avg_turnover_z") or 0.0) * 0.35
            + (item.get("avg_volume_z") or 0.0) * 0.15
            + (item.get("steady_return_score") or 0.0) * 0.3
            - (item.get("vol_stability_z") or 0.0) * 0.2
        )
    return 0.0


def in_price_bucket(price, bucket_min, bucket_max):
    if price is None:
        return False
    if bucket_min is not None and price < bucket_min:
        return False
    if bucket_max is not None and price >= bucket_max:
        return False
    return True


def run(week_end, lookback_days, dry_run, stock_limit=None, liquidity_top=None, as_of=None):
    active_stocks = fetch_active_stocks(limit=stock_limit)
    if not active_stocks:
        print("No active stocks")
        return

    data_end = as_of or week_end
    start_date = (data_end - dt.timedelta(days=lookback_days)).strftime("%Y-%m-%d")
    end_date = data_end.strftime("%Y-%m-%d")

    stock_stats = []
    filtered = [s for s in active_stocks if not is_etf(s)]
    if stock_limit:
        filtered = filtered[:stock_limit]

    # bulk fetch prices in chunks to reduce requests
    chunk_size = 50
    price_map = {}
    for i in range(0, len(filtered), chunk_size):
        chunk = filtered[i:i + chunk_size]
        ids = [str(s.get("stock_id")) for s in chunk if s.get("stock_id")]
        rows = fetch_prices_bulk(ids, start_date, end_date)
        for row in rows:
            sid = row.get("stock_id")
            if not sid:
                continue
            price_map.setdefault(sid, []).append(row)

    for stock in filtered:
        if is_etf(stock):
            continue
        stock_id = stock.get("stock_id")
        if not stock_id:
            continue
        prices = price_map.get(stock_id, [])
        if not prices:
            continue
        stats = compute_score(prices)
        if not stats:
            continue
        stock_stats.append({
            "stock_id": stock_id,
            "name": stock.get("name") or stock_id,
            **stats,
        })

    if not stock_stats:
        print("No stats computed")
        return

    if liquidity_top:
        stock_stats.sort(key=lambda x: x.get("avg_turnover") or 0, reverse=True)
        stock_stats = stock_stats[:liquidity_top]

    build_profile_scores(stock_stats)

    runs_payload = []
    signals_payload = []

    for capital in STRATEGY_CAPITALS:
        capital_universe = stock_stats
        for risk in STRATEGY_RISKS:
            strategy_id = build_strategy_id(capital, risk)

            for item in capital_universe:
                item["profile_score"] = profile_score(risk["id"], item)

            bucket_candidates = [
                item
                for item in capital_universe
                if in_price_bucket(item.get("last_close"), capital.get("price_min"), capital.get("price_max"))
            ]
            bucket_candidates.sort(key=lambda x: x.get("profile_score") or 0.0, reverse=True)
            overall_candidates = sorted(
                capital_universe, key=lambda x: x.get("profile_score") or 0.0, reverse=True
            )

            picks = bucket_candidates[:3]
            if len(picks) < 3:
                for item in overall_candidates:
                    if item in picks:
                        continue
                    picks.append(item)
                    if len(picks) >= 3:
                        break

            for item in overall_candidates:
                if len(picks) >= MAX_PICKS:
                    break
                if item in picks:
                    continue
                picks.append(item)

            weights = allocate_weights([p.get("profile_score") or 0.0 for p in picks])
            for pick, weight in zip(picks, weights):
                signals_payload.append({
                    "strategy_id": strategy_id,
                    "risk_level": risk["risk_level"],
                    "week_end": end_date,
                    "stock_id": pick["stock_id"],
                    "target_weight": round(weight, 6),
                    "score": round(pick.get("profile_score") or 0.0, 6),
                    "reason": {
                        "ret_1": pick.get("ret_1"),
                        "ret_3": pick.get("ret_3"),
                        "ret_5": pick.get("ret_5"),
                        "ret_10": pick.get("ret_10"),
                        "avg_volume": pick.get("avg_volume"),
                        "avg_turnover": pick.get("avg_turnover"),
                        "avg_range": pick.get("avg_range"),
                        "volatility": pick.get("volatility"),
                    },
                })

            runs_payload.append({
                "strategy_id": strategy_id,
                "risk_level": risk["risk_level"],
                "week_end": week_end.strftime("%Y-%m-%d"),
                "universe_count": len(stock_stats),
                "selected_count": len(picks),
                "gross_exposure": 1.0,
                "risk_state": "normal",
                "metrics": {
                    "label": STRATEGY_LABELS.get(strategy_id, strategy_id),
                    "drawdown": None,
                    "volatility": None,
                    "sharpe": None,
                    "annualized_return": None,
                    "win_rate": None,
                },
            })

    if dry_run:
        print(json.dumps({"runs": runs_payload[:2], "signals": signals_payload[:5]}, ensure_ascii=False, indent=2))
        return

    request_json(
        "POST",
        "strategy_runs",
        params={"on_conflict": "strategy_id,week_end"},
        payload=runs_payload,
        prefer="resolution=merge-duplicates",
    )

    request_json(
        "POST",
        "strategy_signals",
        params={"on_conflict": "strategy_id,week_end,stock_id"},
        payload=signals_payload,
        prefer="resolution=merge-duplicates",
    )
    print(f"Saved runs={len(runs_payload)} signals={len(signals_payload)}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--week-end", required=False, help="YYYY-MM-DD, default latest Friday")
    parser.add_argument("--as-of", required=False, help="YYYY-MM-DD, use data up to this date")
    parser.add_argument("--lookback", type=int, default=20)
    parser.add_argument("--stock-limit", type=int, default=0, help="limit number of stocks for faster dry-run")
    parser.add_argument(
        "--liquidity-top",
        type=int,
        default=DEFAULT_LIQUIDITY_TOP,
        help="select top N stocks by average volume",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if args.week_end:
        week_end = to_date(args.week_end)
    else:
        today = dt.date.today()
        delta = (today.weekday() - 4) % 7
        week_end = today - dt.timedelta(days=delta)
    stock_limit = args.stock_limit if args.stock_limit and args.stock_limit > 0 else None
    liquidity_top = args.liquidity_top if args.liquidity_top and args.liquidity_top > 0 else None
    as_of = to_date(args.as_of) if args.as_of else None
    run(
        week_end,
        args.lookback,
        args.dry_run,
        stock_limit=stock_limit,
        liquidity_top=liquidity_top,
        as_of=as_of,
    )


if __name__ == "__main__":
    main()
