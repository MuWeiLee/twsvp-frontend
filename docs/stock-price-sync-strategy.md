# Stock Prices 完整性策略（FinMind）

## 现况确认（基于当前代码）

1. **FinMind 速率限制默认按每小时 600 次设计**
   - `sync-stock-prices-daily` 默认 `rate_limit_per_hour = 600`，并用 `sleepMs = ceil(3600000 / limit)` 控制每支股票请求间隔。 
   - `sync-stock-prices-backfill` 默认 `BACKFILL_RATE_LIMIT_PER_HOUR = 600`，同样通过 `sleepMs` 节流。
   - 以 600/h 推算，理论上每小时最多约 600 支股票请求。

2. **日增量不是一次抓完，而是分批推进**
   - `sync-stock-prices-daily` 默认每次最多处理 `STOCK_PRICE_DAILY_MAX_STOCKS`（默认 200），并用 `stock_price_backfill_state` 的 `stock_offset` 续跑。
   - 若当日排程总触发次数不足，或发生限流/失败，可能只写入几百支（例如 381、56、580 这种分批未跑完的特征）。

3. **已存在“优先最新日”的机制（在 backfill stock 模式）**
   - `sync-stock-prices-backfill` 在 `autoExtend=1` 时，如发现最新日期前移，会把 `cursor_date` 重置到最新日并 `stock_offset=0`，优先补最新日。
   - 这符合“优先关注增量数据”的目标。

## 为什么会出现 02-03 之后明显变少

- 代码设计是“按股票逐支请求 FinMind”，不是单次全市场批量接口。600/h 下，若只跑少数 cron 次数，覆盖会不足。
- `vercel.json` 当前 `sync-stock-prices-daily` 在交易日只跑 **18:10~23:50 共 18 次**；若每次上限 200，则理论上可覆盖 3600 支（足够），但前提是每次都成功执行且不超时/不中断。
- 你提供的数量（381、56、580）像是：
  - 某些批次中断（超时、429、网络错误）
  - 或状态被重置、重复跑到同一段 offset
  - 或有效股票集合（is_active/market）变更导致分批股票池缩小

## 建议方案（先保近期增量完整，再补历史）

### A. 增量优先：把 daily 任务当成“同一天持续推进到 done”

1. 保持 `sync-stock-prices-daily` 为交易日主任务。
2. 将 `STOCK_PRICE_DAILY_MAX_STOCKS` 调整到与限额匹配，例如 120~180（留裕量给重试与其他 API）。
3. 把交易日 cron 频率提高（例如每 10 分钟一次），直到 `stock_price_backfill_state.status=done`。
4. 增加一个“守门补跑”逻辑：
   - 若当天 `done` 前仍是 `running/rate_limited`，在下一时段自动继续。

### B. backfill 仅做历史，不与 daily 抢配额

1. `sync-stock-prices-backfill?mode=stock` 放在离峰（周末/深夜）执行。
2. 给 backfill 单独更低速率（如 200~300/h），避免影响 daily 的近期完整率。
3. 保留 `auto_extend=1`，确保新交易日优先回到最新日期。

### C. 数据完整性监控（必须）

1. 每日检查 `stock_prices` 当日 distinct stock 数量。
2. 对照 `stocks` 表当日应抓取总数（market + is_active 条件一致）。
3. 若低于阈值（如 < 95%），自动触发重跑（指定 tradeDate）。

## 推荐执行顺序

1. 先确认生产环境变量：
   - `STOCK_PRICE_SYNC_RATE_LIMIT_PER_HOUR`
   - `STOCK_PRICE_DAILY_MAX_STOCKS`
   - `BACKFILL_RATE_LIMIT_PER_HOUR`
2. 调整交易日 cron 频率，确保当天能跑到 `done`。
3. 增加“当天完整率告警 + 自动补跑”。
4. 观察 3~5 个交易日，再细调 `max_stocks` 与限速。

## 备注

- 若 FinMind 帐号实际可用额度不是 600/h（例如更低），要按真实额度反推 `sleepMs` 与每次批量大小。
- 若要“近实时完整”，可改为：交易时段每 5~10 分钟推进一次；收盘后再高频补齐到 `done`。


## backfill_state 清理（防重复任务）

- 新增维护接口：`/api/cleanup-stock-price-backfill-state`
  - 支持 `dry_run=1` 先预览清理结果。
  - 默认会将重复或过期的 `running` 状态标记为 `superseded`。
- daily/backfill 运行时也会自动清理同流中的重复 `running` 记录，降低并发任务互相覆盖风险。
