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
  - 成功写入后会把 `stock_price_missing` 对应记录更新为 `done`，未写入则保留/写回 `pending`。
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
- 新增模式：
  - `mode=trade_date`：按单一交易日批量种下 `pending`（适合交易日 10:00 初始化）。
- 写入：
  - `stock_price_missing`
  - `stock_price_missing_ranges`

**7) `/api/sync-stock-prices-missing`（缺口补录）**
- 功能：优先从 `stock_price_missing_ranges` 补录（按区间拉取），再补单日缺口。
- 支持：
  - `mode=range|date|auto`（默认 `auto`）
  - `max_ranges` / `max_dates`
  - `max_days_per_range`（避免一次拉取区间过大）
  - `trade_date` / `start_date` / `end_date`（限定待补范围）
  - `retry_failed=1`（默认开启，把 failed 也纳入重试）

**8) `/api/sync-ptt-stock-board`（PTT Stock 板抓取）**
- 功能：抓取 `Stock` 板近 `since_hours`（默认 24）内文章，筛 `net_push >= min_net_push`（默认 20），并写入 `ptt_articles`。
- 支持：
  - `since_hours`（默认 24）
  - `max_pages` / `max_articles`
  - `min_net_push`（默认 20）
  - `require_content=1`（默认，只写有内文文章）
  - `dry_run=1`（只抓不写）
- 去重与增量：
  - `on conflict (board, article_id)` upsert
  - 支持热度更新（`net_push`, `net_push_peak`, `last_seen_at`）

**9) `/api/sync-ptt-stock-links`（PTT 标题绑定股票）**
- 功能：读取 `ptt_articles` 热门文，按标题中的股票名称匹配写入 `ptt_stock_links`。
- 支持：
  - `since_hours`（默认 24）
  - `min_net_push`（默认 20）
  - `article_limit`
  - `dry_run=1`
- 绑定规则：
  - `title_stock_name`：标题出现股票名称（去空白后比对）
- 去重键：
  - `board, article_id, stock_id, match_method`

## 定时任务（Vercel Cron）

来源：Vercel Cron（生产环境配置）

- `/api/sync-trading-calendar`  
  `45 1 * * 1-5`（台北周一至周五 09:45）
- `/api/sync-stock-prices-daily`  
  `0 4 * * 6,0`（周末巡检补跑）
- `/api/sync-stock-prices-backfill?mode=stock`  
  `0 18 * * 6,0`（台北周末 02:00 历史回补）
- `/api/sync-stock-prices-history`  
  `*/20 * * * 6,0`（周六、周日每 20 分钟）
- `/api/sync-stock-prices-missing-scan?mode=trade_date&max_stocks=0&include_inactive=1`  
  `0 2 * * 1-5`（台北交易日 10:00，按交易日初始化 pending）
- `/api/sync-stock-prices-missing?mode=date&max_dates=500&retry_failed=1&max_runtime_ms=240000`  
  `*/5 7-15 * * 1-5`（台北交易日 15:00-23:59，持续补录 pending）
- `/api/sync-feed-expiry-notifications`  
  `0 16 * * *`（每天 16:00）
- `/api/sync-feed-performance`  
  `0 16 * * *`（每天 16:00）
- `/api/sync-user-performance`  
  `0 17 * * *`（每天 17:00）
- `/api/sync-newsdata`  
  `*/30 * * * *`（每 30 分钟）
- `/api/sync-news-stock-links`  
  `*/10 * * * *`（每 10 分钟）
- `/api/sync-ptt-stock-board`  
  `5 */4 * * *`（每 4 小时，整点后 5 分）
- `/api/sync-ptt-stock-links`  
  `20 */4 * * *`（每 4 小时，抓取后 15 分）

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
- `STOCK_PRICE_MISSING_SCAN_MAX_STOCKS`

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
- `active_only`（默认 `1`，仅计算进行中观点）

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
