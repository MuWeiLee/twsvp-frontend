# Stock Price 同步策略（台北时区）

## 目标流程

1. 交易日 `10:00`：把当日所有股票写入 `stock_price_missing` 为 `pending`。  
2. 交易日 `15:00` 起：持续补录 `pending`，直到当天缺口趋近完成。  
3. 周末：执行历史 backfill + 缺口重扫，不挤占交易日配额。  

## 代码对齐点

- `sync-stock-prices-missing-scan` 新增 `mode=trade_date`，用于 10:00 批量建 pending。
- `sync-stock-prices-missing` 支持：
  - `trade_date` / `start_date` / `end_date` 过滤。
  - `retry_failed=1`（默认），失败任务回到 `pending`，持续重试。
- `sync-stock-prices-daily` 在写入成功后，会同步把对应 `stock_price_missing` 标记为 `done`。
- Stock 相关默认日期统一改为台北日历日，避免 UTC 跨日偏差。

## Cron（UTC）

- `45 1 * * 1-5`：`/api/sync-trading-calendar`（台北 09:45）
- `0 2 * * 1-5`：`/api/sync-stock-prices-missing-scan?mode=trade_date&max_stocks=0&include_inactive=1`（台北 10:00）
- `*/5 7-15 * * 1-5`：`/api/sync-stock-prices-missing?mode=date&max_dates=500&retry_failed=1&max_runtime_ms=240000`（台北 15:00-23:59）
- `0 18 * * 6,0`：`/api/sync-stock-prices-backfill?mode=stock&start_date=2025-01-01`（台北周末 02:00）

## FinMind 限流建议

- `rate_limit_per_hour` 作为全局上限来源，`sleepMs=ceil(3600000/limit)` 自动节流。
- 先以 `600/h` 起跑，观察 3-5 个交易日后再调高。
- 若频繁 `rate_limited`，优先降低 `max_dates` 或提高补录窗口频率。

## 核验指标

- 当日 `stock_prices` distinct(`stock_id`) / 应抓股票总数。
- 当日 `stock_price_missing` 中 `pending` 剩余数趋势。
- `stock_price_sync_logs` 中 `rate_limited` 与 `failed` 比例。
