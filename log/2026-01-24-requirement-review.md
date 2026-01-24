# 需求对照确认与改动总结 (2026-01-24)

来源需求文档:
- /Users/leemuwei/Desktop/TWSVP-All/TWSV/TWSVP-Requirement/requirement.md
- /Users/leemuwei/Desktop/TWSVP-All/TWSV/TWSVP-Requirement/1-page_requirement/
- /Users/leemuwei/Desktop/TWSVP-All/TWSV/TWSVP-Requirement/2-data_requirement/

## 总体结论
- 页面层级与路由结构已覆盖主流程 (Login, FeedFlow, Search, Notification, Personal, Stock/Sector, FeedCard, PersonalSetting)。
- 目前大多数页面为静态样例数据，交互与数据流未接入真实后端或数据库。
- Google OAuth 采用 Supabase 方式接入，并增加 profile 完整度检查与引导，但缺少显式错误态/加载态展示。
- 数据库结构与 API 需求仍停留在文档层，尚未在代码中落地迁移或接口调用。

## 逐项对照 (按 requirement.md)
1) Login (Google OAuth)
- 已有: Google 登录按钮, 登录后根据 profile 完整度分流 (router guard + PersonalSetting)。
- 缺失: 授权失败/取消/网络错误的 UI 状态提示。

2) FeedFlow
- 已有: 顶部栏, 发布入口, 列表筛选/排序 UI, 卡片展示字段。
- 缺失: 列表分页/刷新, 点赞/收藏/分享, 编辑/删除/结束观点, 数据来自 API。

3) Search
- 已有: 搜索框, Tab 切换, 热门/推荐/空态 UI。
- 缺失: 搜索历史/联想, 真实搜索结果与分页。

4) Notification
- 已有: Tab + 列表 UI。
- 缺失: 已读/未读, 标记已读/全部已读, 跳转详情。

5) PersonalUser
- 已有: 资料区/指标区/Tab UI。
- 缺失: 真实统计口径, 编辑资料跳转, 观点管理动作。

6) PersonalViewer
- 已有: 他人主页 UI + 筛选。
- 缺失: 真实数据读取与隐私过滤。

7) StockFeed
- 已有: 标的头部/看法比例/筛选 UI。
- 缺失: 真实行情或汇总数据, 列表分页。

8) SectorFeed
- 已有: 概念页 UI。
- 缺失: 概念/行业区分与真实数据读取。

9) PersonalSetting
- 已有: 昵称/简介/行业选择表单, 必填校验, Supabase upsert 与 user_industries 写入。
- 缺失: 头像更换, 错误态细化, 成功提示。

10) FeedCard
- 已有: 详情 UI 占位。
- 缺失: 结构化观点字段 (summary/reasons/risks), 互动操作, 状态流转展示。

全局规则 (Feed 生命周期/编辑规则)
- 已有: active/expired 的展示与筛选 (UI 层)。
- 缺失: 后端状态流转, 编辑窗口限制与校验。

## 数据与 API 需求 (2-data_requirement)
- 前端已使用 Supabase 客户端并读取/写入 profiles, industries, user_industries。
- 缺少: 数据库建表 SQL/迁移脚本集成, 以及 Feed/通知/搜索的数据表与 API 接入。
- supabase 连接使用环境变量占位, 需配置 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY。

## 改动摘要 (相对当前工作区)
- 新增页面: CreateFeedView, FeedCardView, PersonalSettingView, PersonalViewerView, StockFeedView, SectorFeedView。
- 认证改造: 引入 Supabase OAuth, 增加 auth callback 与 profile 完整度检查。
- 新增服务: profile 数据读写 (profiles, industries, user_industries)。
- UI 更新: Feed/Search/Notification/Profile/Settings/Login 视觉与结构调整。
- 文档变更: 根目录 Requirement.md / REQUIREMENTS.md 已同步回最新版, 需求仍以 TWSVP-Requirement 为准。

## 待补关键项 (简要)
- 后端与数据库: Feed/Notification/Search 真实数据与 API。
- 互动行为: like/bookmark/share, 以及编辑/删除/结束观点。
- 交互状态: loading/empty/error 细化与提示。
