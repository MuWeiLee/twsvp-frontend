# Vercel 环境变量

| 变量名 | 环境 | 值 | 操作 | 日期 |
|-------|------|-----|------|------|
| BACKFILL_SOURCE | All Environments | ••••••••••••••• | Updated | Jan 27 |
| BACKFILL_END_DATE | All Environments | ••••••••••••••• | Updated | Jan 26 |
| BACKFILL_AUTO_EXTEND | All Environments | ••••••••••••••• | Updated | Jan 26 |
| FINMIND_TOKEN | All Environments | ••••••••••••••• | Updated | Jan 26 |
| BACKFILL_DATASET | All Environments | ••••••••••••••• | Added | Jan 25 |
| BACKFILL_CHUNK_SIZE | All Environments | ••••••••••••••• | Added | Jan 25 |
| SUPABASE_SERVICE_ROLE_KEY | All Environments | ••••••••••••••• | Updated | Jan 25 |
| VITE_SUPABASE_ANON_KEY | All Environments | ••••••••••••••• | Updated | Jan 24 |
| VITE_API_BASE | All Environments | ••••••••••••••• | Added | Jan 17 |

## 环境变量清单（用途与必要性）

| 变量名 | 是否必须 | 用途 | 建议/默认 |
|-------|---------|------|-----------|
| FINMIND_TOKEN | 必需 | FinMind API 认证（sync-stocks / sync-stock-prices / backfill） | 必填 |
| SUPABASE_SERVICE_ROLE_KEY | 必需 | 后端任务写入 Supabase | 必填 |
| VITE_SUPABASE_ANON_KEY | 必需 | 前端 Supabase 访问 | 必填 |
| BACKFILL_SOURCE | 可选 | backfill 数据源，当前仅支持 finmind | 建议 `finmind` 或不设置 |
| BACKFILL_DATASET | 可选 | backfill 数据集 | 默认 `TaiwanStockPrice` |
| BACKFILL_CHUNK_SIZE | 可选 | backfill 单次 upsert 批量 | 默认 `500` |
| BACKFILL_END_DATE | 可选 | backfill 结束日期上限 | 留空以持续补录 |
| BACKFILL_AUTO_EXTEND | 可选 | backfill 自动延展至最新交易日 | 默认 `1`（建议保留） |
| VITE_API_BASE | 可选 | 前端 API 基址 | 当前代码未引用，可移除或保留 |

## 速率限制（建议新增）

| 变量名 | 是否必须 | 用途 | 建议/默认 |
|-------|---------|------|-----------|
| STOCK_PRICE_SYNC_RATE_LIMIT_PER_HOUR | 建议 | 行情增量速率上限 | `600` |
| BACKFILL_RATE_LIMIT_PER_HOUR | 建议 | backfill 速率上限 | `600` |
