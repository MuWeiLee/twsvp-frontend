# PTT Stock 热门文抓取 API（Board 模式）

## 设计结论
- 以 `Stock` 板为来源，每 4 小时抓近 24 小时文章。
- 对 `net_push >= 20` 且有内文的文章写入 `ptt_articles`。
- 再以标题中的股票代码/名称绑定到 `ptt_stock_links`。
- 流程对齐 NewsData：`抓原文 -> 入文章表 -> 建股票关联表`。

## 你已完成的表（A/B/C）
- `ptt_articles`：文章主表（board + article_id 唯一，含 net_push / net_push_peak / first_seen / last_seen / qualified_at）
- `ptt_stock_links`：标题绑定表（board + article_id + stock_id + match_method 唯一）
- `ptt_sync_runs`：同步运行日志

## API

### 1) `GET/POST /api/sync-ptt-stock-board`
用途：
- 抓 `Stock` 板近 `since_hours` 内文章
- 计算 `net_push`
- 仅写入 `net_push >= min_net_push` 且（默认）有内文的文章
- upsert 去重键：`board,article_id`

参数：
- `since_hours`：默认 `24`
- `min_net_push`：默认 `20`
- `max_pages`：默认 `60`
- `max_articles`：默认 `1000`
- `require_content`：默认 `1`
- `dry_run`：`1` 时只抓不写

示例：
```bash
curl "https://<your-domain>/api/sync-ptt-stock-board?since_hours=24&min_net_push=20&require_content=1&secret=<CRON_SECRET>"
```

### 2) `GET/POST /api/sync-ptt-stock-links`
用途：
- 读取 `ptt_articles`（近 24 小时、net_push 达阈值、有内文）
- 标题匹配股票：
  - `title_stock_id`：标题中出现 4 位股票代码
  - `title_stock_name`：标题中出现股票名称（去空白后比对）
- upsert 到 `ptt_stock_links`

参数：
- `since_hours`：默认 `24`
- `min_net_push`：默认 `20`
- `article_limit`：默认 `1200`
- `title_only`：默认 `1`
- `dry_run`：`1` 时只匹配不写

示例：
```bash
curl "https://<your-domain>/api/sync-ptt-stock-links?since_hours=24&min_net_push=20&title_only=1&secret=<CRON_SECRET>"
```

### 3) `GET /api/ptt/hot`（读取）
用途：
- 通过 `ptt_stock_links` 查某股票关联文章
- 再回 `ptt_articles` 热门文（含内文）

参数：
- `stock_id` 或 `stock_name`（至少一项）
- `limit`：默认 `3`
- `since_hours`：默认 `24`
- `min_net_push`：默认 `20`

示例：
```bash
curl "https://<your-domain>/api/ptt/hot?stock_id=2330&limit=3&since_hours=24&min_net_push=20"
```

## 定时任务（建议）
- `5 */4 * * *`  
  `/api/sync-ptt-stock-board?since_hours=24&min_net_push=20&require_content=1`
- `20 */4 * * *`  
  `/api/sync-ptt-stock-links?since_hours=24&min_net_push=20&title_only=1`

## RLS
- `ptt_articles`：执行 `sql/ptt_articles_rls.sql`（前端只读，后端 service role 写）
- `ptt_stock_links`：建议同样策略（前端只读）
- `ptt_sync_runs`：建议仅 service role 访问
