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
    {"id": "fixed_5w", "name": "固定金额 5万", "capital": 50000, "liquidity_top": 800},
    {"id": "fixed_20w", "name": "固定金额 20万", "capital": 200000, "liquidity_top": 500},
    {"id": "fixed_50w", "name": "固定金额 50万", "capital": 500000, "liquidity_top": 300},
    {"id": "dca_2k", "name": "定投 每周 2000", "capital": 2000},
    {"id": "dca_5k", "name": "定投 每周 5000", "capital": 5000},
    {"id": "dca_10k", "name": "定投 每周 10000", "capital": 10000},
]

STRATEGY_RISKS = [
    {"id": "high_high", "name": "高收益高风险", "risk_level": "high", "mom_weight": 0.7, "vol_weight": 0.4, "liq_weight": 0.2},
    {"id": "high_mid", "name": "高收益中风险", "risk_level": "mid", "mom_weight": 0.7, "vol_weight": 0.2, "liq_weight": 0.2},
    {"id": "mid_mid", "name": "中收益中风险", "risk_level": "mid", "mom_weight": 0.5, "vol_weight": 0.0, "liq_weight": 0.3},
    {"id": "mid_low", "name": "中收益低风险", "risk_level": "low", "mom_weight": 0.3, "vol_weight": -0.3, "liq_weight": 0.5},
    {"id": "low_low", "name": "低收益低风险", "risk_level": "low", "mom_weight": 0.1, "vol_weight": -0.6, "liq_weight": 0.6},
]

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


def zscore(values):
    if not values:
        return 0.0
    mean = sum(values) / len(values)
    sd = stddev(values)
    if sd == 0:
        return 0.0
    return (values[-1] - mean) / sd


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
            "select": "stock_id,trade_date,close,volume,turnover",
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
    if len(closes) < 2:
        return None
    momentum = percent_change(closes[0], closes[-1])
    returns = []
    for i in range(1, len(closes)):
        returns.append(percent_change(closes[i - 1], closes[i]))
    vol = stddev(returns)
    volume_score = zscore(volumes)
    turnover_score = zscore(turnovers)
    avg_volume = sum(volumes) / len(volumes) if volumes else 0.0
    avg_turnover = sum(turnovers) / len(turnovers) if turnovers else 0.0
    return {
        "momentum": momentum,
        "volatility": vol,
        "volume_z": volume_score,
        "turnover_z": turnover_score,
        "avg_volume": avg_volume,
        "avg_turnover": avg_turnover,
        "score": momentum * 0.7 + volume_score * 0.3,
    }


def build_strategy_id(capital, risk):
    return f"{capital['id']}_{risk['id']}"


def allocate_weights(scores):
    positive = [max(0.0, s) for s in scores]
    total = sum(positive)
    if total <= 0:
        return [1.0 / len(scores) for _ in scores]
    return [s / total for s in positive]


def run(week_end, lookback_days, dry_run, stock_limit=None, liquidity_top=None):
    active_stocks = fetch_active_stocks(limit=stock_limit)
    if not active_stocks:
        print("No active stocks")
        return

    start_date = (week_end - dt.timedelta(days=lookback_days)).strftime("%Y-%m-%d")
    end_date = week_end.strftime("%Y-%m-%d")

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

    runs_payload = []
    signals_payload = []

    for capital in STRATEGY_CAPITALS:
        capital_universe = stock_stats
        capital_liq = capital.get("liquidity_top") or liquidity_top
        if capital_liq:
            capital_universe = stock_stats[:capital_liq]
        for risk in STRATEGY_RISKS:
            strategy_id = build_strategy_id(capital, risk)
            # risk-adjusted score
            scored = []
            for item in capital_universe:
                adjusted = (
                    item["momentum"] * risk["mom_weight"]
                    + item["volatility"] * risk["vol_weight"]
                    + item["turnover_z"] * risk["liq_weight"]
                )
                scored.append((adjusted, item))
            scored.sort(key=lambda x: x[0], reverse=True)
            picks = [item for _, item in scored[:MAX_PICKS]]

            weights = allocate_weights([p["score"] for p in picks])
            for pick, weight in zip(picks, weights):
                signals_payload.append({
                    "strategy_id": strategy_id,
                    "risk_level": risk["risk_level"],
                    "week_end": end_date,
                    "stock_id": pick["stock_id"],
                    "target_weight": round(weight, 6),
                    "score": round(pick["score"], 6),
                    "reason": {
                        "momentum": pick["momentum"],
                        "volatility": pick["volatility"],
                        "volume_z": pick["volume_z"],
                        "turnover_z": pick["turnover_z"],
                    },
                })

            runs_payload.append({
                "strategy_id": strategy_id,
                "risk_level": risk["risk_level"],
                "week_end": end_date,
                "universe_count": len(stock_stats),
                "selected_count": len(picks),
                "gross_exposure": 1.0,
                "risk_state": "normal",
                "metrics": {
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
    run(week_end, args.lookback, args.dry_run, stock_limit=stock_limit, liquidity_top=liquidity_top)


if __name__ == "__main__":
    main()
