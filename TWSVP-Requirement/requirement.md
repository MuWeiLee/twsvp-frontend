# 1 级页面（主导航 / 一级入口）

## 系统定时任务（Cron）
- `/api/sync-stocks`：每小时 1 次
- `/api/sync-stock-prices-backfill`：每小时 1 次（固定使用 FinMind 数据源，历史起点固定 `2026-01-01`，覆盖上市/上柜全量）
- `/api/sync-stock-prices`：固定使用 FinMind 数据源，默认增量同步最新交易日数据（起点不早于 `2026-01-01`）；可用 `start_date` 或 `STOCK_PRICE_SYNC_START_DATE` 指定抓取起点，需要清洗误数据可传 `purge=1`，全量清空可传 `purge_all=1&purge_confirm=DELETE_ALL`

## 1) Login（登录/注册二合一，Google OAuth）

### 目标
低摩擦完成登录，首次登录自动创建用户基础记录

### 模块
- 品牌区：Logo + Slogan（可选）
- 登录区：
  - 「使用 Google 登录」按钮（唯一入口）
- 协议区：
  - 用户协议 / 隐私政策（可选，至少占位）

### 主要操作
- Google OAuth 登录
- 登录成功后路由分流：
  - profile 完整 → 进 Feed
  - profile 未完整 → 进 PersonalSetting

### 状态与规则
- loading / 授权失败 / 取消授权 / 网络错误
- 已登录访问 Login：自动跳转 Feed

### 关键字段
- auth_user_id, email, avatar_url, google_name

## 2) FeedFlow（观点流：发布 + 浏览）

### 目标
让用户持续浏览观点；随时发布观点

### 模块
- 顶部栏
  - 搜索入口（跳 Search）
  - 发布入口（按钮/悬浮按钮）
- FeedList（按时间或推荐排序）
  - 每条显示：发布者、标的、看法、时效、1句话结论、发布时间、互动数
- 空态/加载态/刷新

### 主要操作
- 发布观点（打开发布抽屉/发布页）
- 点进观点详情（FeedCard）
- 点进用户（PersonalViewer）
- 点进标的（StockFeed）/概念（SectorFeed）
- 点赞/收藏/分享（轻操作可在卡片上完成）

### 状态与规则
- 未登录不可用（强制 Login）
- 列表分页（每页 20 条）/ 下拉刷新
- 顶部筛选 Tab 置顶显示，需避开导航栏与安全区，避免被遮挡
- 置顶导航与置底 Tabbar/声明不遮挡内容，列表需预留顶部/底部空间
- 滚动触底自动加载分页，不使用“加载更多”按钮
- 更多：
  - 发布人：删除/编辑/结束自己的观点（其他用户不可操作）
  - 非发布人：隐藏观点

### 关键字段
- view_id, user_id, stock_id, sector_id(可选), direction, horizon, summary, created_at
- like_count, bookmark_count, share_count, is_liked, is_bookmarked

## 3) Search（搜索观点、个股、概念、用户）

### 目标
快速定位：标的/概念页、观点、用户

### 模块
- 搜索框（支持输入股票代码/名称、概念名、用户昵称、关键词）
- 建议区（可选）
- 搜索历史
- 热门搜索 / 热门标的 / 热门概念
- 结果区（Tab 或混排）
  - 标的（Stock）
  - 概念（Sector）
  - 观点（View）
  - 用户（User）
- 无结果态

### 主要操作
- 点击标的 → StockFeed
- 点击概念 → SectorFeed
- 点击观点 → FeedCard
- 点击用户 → PersonalViewer

### 状态与规则
- 输入联想（可选）
- 结果分页（每页 20 条）
- 结果排序（默认相关性）

### 关键字段
- query, result_type, stock(symbol,name), sector(name), user(nickname,avatar), view(summary,stock,direction)

## 4) Notification（通知：互动 + 到期提醒）

### 目标
记录与提醒：被点赞/收藏/分享、观点即将到期/到期

### 模块
- Tab（建议）
  - 互动通知
  - 到期提醒
- 通知列表
  - 互动类：谁对哪条观点做了什么、时间
  - 到期类：哪条观点何时到期、剩余多久
- 空态

### 主要操作
- 点通知 → 跳转 FeedCard
- 点用户头像 → PersonalViewer
- 标记已读（可选）
- 全部已读（可选）

### 状态与规则
- 已读/未读
- 去重（同一观点短时间多次点赞可聚合：可后期做）
- 顶部 Tab 向下滚动收起、向上滚动显示

### 关键字段
- noti_id, type(like/bookmark/share/expire_soon/expired)
- actor_user_id, target_view_id, created_at, read_at
- expire_at, days_left

## 5) PersonalUser（个人中心：本人视角）

### 目标
展示个人资料 + 观点绩效/胜率 + 管理观点

### 模块
- 资料区
  - 头像、昵称、个人介绍、感兴趣行业标签
  - 编辑资料入口（跳 PersonalSetting 或 ProfileEdit）
- 指标区（可渐进）
  - 总观点数
  - 已结束观点数
  - 胜率
  - 绩效（定义见备注）
- 列表区（强建议 Tab）
  - 全部观点
  - 未结束观点（active）
  - 已结束观点（expired/verified）
- 管理入口（可选）
  - 删除/编辑观点（最少删除）

### 主要操作
- 编辑个人资料
- 点观点 → FeedCard
- 对自己的观点：编辑/删除（若做）

### 状态与规则
- 指标计算规则需要一致（胜率/绩效口径）
- 未结束观点优先展示（你已明确要展示）

### 关键字段
- profile: nickname, bio, interested_sectors[]
- stats: views_total, views_closed, win_rate, avg_return, total_return(可选)
- views: status(active/closed)

**备注**：绩效/胜率需要“观点如何结算”机制支撑；MVP 可以先展示「已到期/未到期」+「后续上线结算」。

# 2 级页面（二级聚合 / 详情类）

## 6) PersonalViewer（他人视角的个人页）

### 目标
建立信任：看这个人靠不靠谱

### 模块
- 资料区（同 PersonalUser，但无编辑）
- 指标区（同口径）
- 观点列表（全部观点，包含已结束、未结束）
  - 筛选：全部/未结束/已结束

### 主要操作
- 点观点 → FeedCard
- 点标的 → StockFeed
- 点概念 → SectorFeed

### 状态与规则
- 隐私：如后期允许“仅自己可见”的观点，需要过滤

### 关键字段
同 PersonalUser，但少了管理权限字段

## 7) StockFeed（个股观点汇总 + 近期看法总结）

### 目标
围绕单一标的聚合观点，并给出“近期市场看法摘要”

### 模块
- 标的头部
  - 股票代码 + 名称
  - （可选）现价/涨跌幅（若接行情）
- 近期看法总结（Summary）
  - 看多/看空比例
- 观点列表（按时间/热度）
  - 支持筛选：看法（多/空/中性）、时效、未结束优先

### 主要操作
- 点观点 → FeedCard
- 点发布观点（默认带入 stock_id）
- （可选）加入关注自选

### 状态与规则
- 总结模块：无数据时展示引导（“暂无总结，先看最新观点”）
- 观点列表分页

### 关键字段
- stock_id, symbol, name
- summary: long_ratio, short_ratio, neutral_ratio, key_points[]
- views list

## 8) SectorFeed（概念观点汇总 + 近期看法总结）

### 目标
围绕概念/行业聚合观点（注意：你这页叫 SectorFeed，但概念与行业可能不同）

### 模块
- 概念/行业头部
  - 名称 + 简介（可选）
- 近期看法总结（Summary）
  - 主流观点方向
  - 关联热门标的（可选）
- 观点列表
  - 支持筛选：看法、时效、标的

### 主要操作
- 点观点 → FeedCard
- 点标的 → StockFeed
- 点概念 → SectorFeed

### 状态与规则
- 需要明确：Sector 是“概念”还是“行业”
- 你同时提到：Search 支持概念、PersonalSetting 用行业枚举
- 建议：Industry(行业) 与 Theme(概念) 分表，页面可以先统一叫 SectorFeed，但底层要分清

### 关键字段
- sector_id, sector_type(industry/theme), name
- summary, views list

# 3 级页面（内容详情 / 表单流程）

## 9) PersonalSetting（首次登录后完善资料）

### 目标
完成可用的个人画像：昵称、介绍、感兴趣行业

### 模块
- 头像（展示 Google 头像，可选更换）
- 昵称（默认 Google name，可编辑，必填）
- 个人介绍（多行文本，可换行）
- 感兴趣行业（枚举多选/单选你决定）
  - 建议：多选，上限 3~5 个（产品更合理）
- 保存按钮（完成后进入 Feed）

### 主要操作
- 保存资料
- 跳过（可选，若跳过则 Profile 不完整；你目前需求是“需要让用户设置”，建议不提供跳过）

### 状态与规则
- 校验：
  - 昵称必填、长度限制
  - 介绍长度限制
  - 行业至少选 1 个（如果你要强制画像）
- 保存失败重试

### 关键字段
- nickname, bio, interested_industry_ids[]

### 依赖基础表
- industry(id, name, order)

## 10) FeedCard（观点详情）

### 目标
完整展示观点内容 + 互动

### 模块
- 发布者区
  - 头像、昵称（跳 PersonalViewer）
  - 发布时间
- 标的区
  - 股票（跳 StockFeed）
  - 概念/行业标签（若绑定）
- 观点区（结构化展示）
  - 看法（看多/看空/中性）
  - 时效（剩余天数）
  - 1 句话结论
  - 2-3 条依据（列表）
  - 风险提示（可选）
- 互动区
  - 点赞、收藏、分享
  - 互动数
  - （可选）评论区（你未提，MVP 可不做）

### 主要操作
- 点赞/取消点赞
- 收藏/取消收藏
- 分享（复制链接/系统分享）
- （本人）删除/编辑（若做）

### 状态与规则
- 到期状态展示：
  - active：显示“剩余 X 天”
  - expired：显示“已到期”
  - verified：显示“已验证结果”（后期）
- 互动防重复（幂等）

### 关键字段
- view: direction, horizon, expired_at, status
- content: summary, reasons[], risks
- interactions: is_liked, is_bookmarked, counts

## Feed 生命周期与状态定义（全局）

### Feed Status
- active：未到期观点
- expired：已到期但未验证结果
- verified：已完成结果验证（后期）

### 状态流转规则
- 创建 Feed → status = active
- 到达 expired_at → status = expired（系统自动）
- 完成结果验证 → status = verified（系统/人工）

### 状态影响范围
- FeedFlow / StockFeed / PersonalUser：用于筛选
- FeedCard：用于展示“剩余天数 / 已到期 / 已验证”
- Notification：用于生成到期提醒
- EditFeed：仅 active 状态可编辑

## Feed 编辑规则（EditFeed，全局）

### 可编辑条件
- Feed 发布者本人
- Feed 状态 = active
- 发布后 10 分钟内

### 可编辑字段
- summary
- reasons
- risks

### 不可编辑字段
- 标的（stock / sector）
- 看法（direction）
- 时效（horizon）
- expired_at
- status

### 设计原则
- 防止“事后改观点”
- 保证胜率 / 绩效统计可信
