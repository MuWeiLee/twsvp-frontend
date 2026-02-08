# 股票数据录入逻辑说明

本文档记录当前项目中**股票基础资料**与**股价数据**的录入/同步逻辑，包含主要入口、参数、状态表与执行流程概览。

## 涉及表

**核心数据表**
- `stocks`：个股基础资料（代码、名称、市场、产业、是否启用）。
- `stock_prices`：股价与成交量数据（按 `stock_id + trade_date` 去重）。

**状态与日志表**
- `stock_price_backfill_state`：批次回补状态与进度（`stock_offset`、`cursor_date` 等）。
- `stock_price_sync_logs`：同步日志（运行状态、参数、summary）。

**缺口补录表**
- `stock_price_missing`：按股票 + 交易日的缺口清单（`status` 用于补录状态）。
- `stock_price_missing_ranges`：按股票的连续缺口区间（`start_date`~`end_date`）。

**缺口表字段摘要**
- `stock_price_missing`：`stock_id`, `trade_date`, `status`, `created_at`, `updated_at`
- `stock_price_missing_ranges`：`stock_id`, `start_date`, `end_date`, `status`, `total_rows`, `last_error`, `created_at`, `updated_at`

## 数据来源

**FinMind API**
- 基础资料：`dataset=TaiwanStockInfo`
- 日线价格：`dataset=TaiwanStockPrice`
- 历史价格：默认 `dataset=TaiwanStockPrice`（可用环境变量覆盖）

## 入口与职责

**1) `/api/sync-stocks`**
- 功能：同步个股基础资料到 `stocks`。
- 逻辑：
  - 取 FinMind `TaiwanStockInfo` 数据。
  - 规范化市场字段（`上市/上櫃/興櫃`）。
  - 去重并 upsert 到 `stocks`，`onConflict=stock_id`。

**2) `/api/sync-stock-prices`（手动/按需）**
- 功能：按条件同步股价数据到 `stock_prices`。
- 常用参数：
  - `start_date`, `end_date`
  - `stock_id` / `stock_ids` / `stock_offset + max_stocks`
  - `markets`（默认 `上市,上櫃,興櫃`）
  - `purge`, `purge_all`
  - `incremental`（从 `stock_prices` 最新日期起算）
  - `rate_limit_per_hour`, `sleep_ms`
- 逻辑：
  - 计算日期范围（包含最小日期下限）。
  - 选股（单一、清单或分页）。
  - 逐股调用 FinMind，解析后 upsert 到 `stock_prices`。
  - 记录 `stock_price_sync_logs`。

**3) `/api/sync-stock-prices-daily`（交易日增量）**
- 功能：按交易日拉取**当天**日线价格。
- 逻辑：
  - 检查 `trading_calendar`，非交易日跳过。
  - 以 `stock_price_backfill_state` 维护当日 `stock_offset`。
  - 每次取 `max_stocks` 个股票逐一拉取并 upsert。
  - 支持 rate-limit，遇到限速写入 `rate_limited` 状态并停止。

**4) `/api/sync-stock-prices-history`（历史区间）**
- 功能：按区间抓取历史数据（默认 `2020-01-01` 至今日）。
- 逻辑：
  - 读取/更新 `stock_price_backfill_state`（dataset=`TaiwanStockPriceHistory`）。
  - 以 `stock_offset` 分批处理。
  - 每股调用 FinMind，解析后 upsert 到 `stock_prices`。
  - 支持 rate-limit 与重试。

**5) `/api/sync-stock-prices-backfill`（回补引擎）**
- 功能：更细粒度回补（按**股票**或按**日期**维度）。
- 模式：
  - `mode=stock`：对一段日期范围，按股票分批回补。
  - `mode=date`：对单一日期，按股票分批回补，并逐日回退。
- 逻辑要点：
  - 使用 `stock_price_backfill_state` 记录 `cursor_date + stock_offset`。
  - `auto_extend=1` 时会自动把 `end_date` 延伸到最新交易日。
  - 支持 `rate_limit_per_hour` 与 `sleep_ms` 控制节流。
  - 结束条件：`cursor_date` 早于 `start_date` → `idle/completed`。

**6) `/api/sync-stock-prices-missing-scan`（缺口扫描）**
- 功能：对指定股票批次扫描 `trading_calendar` 与 `stock_prices`，生成缺口记录。
- 写入：
  - `stock_price_missing`
  - `stock_price_missing_ranges`

**7) `/api/sync-stock-prices-missing`（缺口补录）**
- 功能：优先从 `stock_price_missing_ranges` 补录（按区间拉取），再补单日缺口。
- 支持：
  - `mode=range|date|auto`（默认 `auto`）
  - `max_ranges` / `max_dates`
  - `max_days_per_range`（避免一次拉取区间过大）

## 定时任务（Vercel Cron）

来源：Vercel Cron（生产环境配置）

- `/api/sync-trading-calendar`  
  `5 18 * * 1-5`（每周一至周五 18:05）
- `/api/sync-stock-prices-daily`  
  `10,30,50 18-23 * * 1-5`（周一至周五 18:10 / 18:30 / 18:50 到 23:50）
- `/api/sync-stock-prices-backfill?mode=stock`  
  `*/10 0-18 * * 1-5`（周一至周五 00:00-18:59 每 10 分钟）
- `/api/sync-stock-prices-backfill?mode=stock`  
  `0 0 * * *`（每天 00:00）
- `/api/sync-stock-prices-history`  
  `*/20 * * * 6,0`（周六、周日每 20 分钟）
- `/api/sync-feed-expiry-notifications`  
  `0 16 * * *`（每天 16:00）
- `/api/sync-feed-performance`  
  `20 14 * * *`（每天 14:20）
- `/api/sync-newsdata`  
  `*/30 * * * *`（每 30 分钟）
- `/api/sync-news-stock-links`  
  `10,40 * * * *`（每小时 10 与 40 分）

## 关键环境变量

**来自 Vercel 环境变量（已配置）- 分组**

**Supabase / 前端**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BASE`

**FinMind / 股价同步**
- `FINMIND_TOKEN`
- `FINMIND_ENDPOINT`
- `STOCK_PRICE_MIN_START_DATE`
- `STOCK_PRICE_DAILY_MAX_STOCKS`
- `STOCK_PRICE_SYNC_RATE_LIMIT_PER_HOUR`
- `STOCK_PRICE_SYNC_INCLUDE_INACTIVE`
- `STOCK_PRICE_SYNC_INCREMENTAL`
- `STOCK_PRICE_CONFLICT_STALE_MINUTES`
- `STOCK_PRICE_DAILY_MAX_RUNTIME_MS`
- `STOCK_PRICE_DAILY_REQUEST_OVERHEAD_MS`
- `STOCK_PRICE_HISTORY_DATASET`
- `STOCK_PRICE_HISTORY_MAX_RUNTIME_MS`
- `STOCK_PRICE_HISTORY_REQUEST_OVERHEAD_MS`
- `STOCK_PRICE_SYNC_MAX_RUNTIME_MS`
- `STOCK_PRICE_SYNC_REQUEST_OVERHEAD_MS`

**回补（Backfill）**
- `BACKFILL_SOURCE`
- `BACKFILL_DATASET`
- `BACKFILL_MODE`
- `BACKFILL_START_DATE`
- `BACKFILL_END_DATE`
- `BACKFILL_MARKETS`
- `BACKFILL_MAX_STOCKS`
- `BACKFILL_CHUNK_SIZE`
- `BACKFILL_RATE_LIMIT_PER_HOUR`
- `BACKFILL_SLEEP_MS`
- `BACKFILL_MAX_RUNTIME_MS`
- `BACKFILL_REQUEST_OVERHEAD_MS`
- `BACKFILL_AUTO_EXTEND`
- `BACKFILL_INCLUDE_INACTIVE`
- `BACKFILL_USE_MISSING`
- `BACKFILL_MISSING_LIMIT`

**Newsdata**
- `NEWSDATA_API_KEY`
- `NEWSDATA_BASE_URL`
- `NEWSDATA_Q`
- `NEWSDATA_CATEGORY`
- `NEWSDATA_COUNTRY`
- `NEWSDATA_LANGUAGE`
- `NEWSDATA_SIZE`

**清理/安全**
- `CRON_SECRET`
- `PURGE_REQUIRE_POST`
- `PURGE_SECRET`
- `active_only`

**代码中使用的核心变量**
- `SUPABASE_URL`（服务端必须）
- `SUPABASE_SERVICE_ROLE_KEY`（服务端必须）
- `FINMIND_TOKEN`（服务端必须）
- `CRON_SECRET`（保护 Cron API）

**常用可调（代码支持）**
- `STOCK_PRICE_DAILY_MAX_STOCKS`
- `STOCK_PRICE_HISTORY_MAX_STOCKS`
- `STOCK_PRICE_SYNC_RATE_LIMIT_PER_HOUR`
- `STOCK_PRICE_SYNC_INCLUDE_INACTIVE`
- `STOCK_PRICE_SYNC_INCREMENTAL`
- `STOCK_PRICE_MIN_START_DATE`
- `STOCK_PRICE_DAILY_MAX_RUNTIME_MS`
- `STOCK_PRICE_HISTORY_DATASET`
- `STOCK_PRICE_HISTORY_MAX_RUNTIME_MS`
- `STOCK_PRICE_SYNC_MAX_RUNTIME_MS`
- `BACKFILL_*`（见 `api/sync-stock-prices-backfill.js`）
- `FINMIND_ENDPOINT`

## 常见数据写入路径

- `stocks`：`/api/sync-stocks`
- `stock_prices`：`/api/sync-stock-prices*` + `/api/sync-stock-prices-backfill`
- `stock_price_sync_logs`：所有股价同步入口
- `stock_price_backfill_state`：daily/history/backfill 入口
- `stock_price_missing`：`/api/sync-stock-prices-missing-scan` + `/api/sync-stock-prices-missing`
- `stock_price_missing_ranges`：`/api/sync-stock-prices-missing-scan` + `/api/sync-stock-prices-missing`

## 备注

- `stock_price_missing` / `stock_price_missing_ranges` 用于**缺口扫描与补录**。
- `stock_price_sync_logs` 与 `stock_price_backfill_state` 是排查超时与进度的关键表。
