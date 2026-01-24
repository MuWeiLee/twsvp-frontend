# 页面设计文档 · FeedFlow（首页）

## 0. 基本信息

- **页面名称**：观点流
- **页面英文名（Route / Key）**：FeedFlow
- **页面层级**：#1 主导航 / 一级入口
- **访问前提**：已登录
- **入口来源**：
  - 登录成功后默认进入
  - 底部 Tab「观点流」
- **页面出口**：
  - Search / FeedCard / StockFeed / PersonalViewer / CreateFeed
- **是否在底部 Tab 中**：是
- **对应核心数据对象**：Feed

## 1. 页面目标（Goal）

- 让用户持续浏览全市场 Feed
- 降低发布观点的心理门槛
- 作为所有 Feed 发现的主入口

## 2. 页面角色与权限（Roles & Permission）

- **可访问用户**：
  - 未登录
  - 已登录
- **权限说明**：
  - 本人 Feed：可编辑 / 删除
  - 他人 Feed：仅浏览与互动

## 3. 页面整体结构（Layout）

### 3.1 顶部栏（Header）
- 左侧：页面名称「观点流」
- 右侧：搜索入口（跳 Search）

### 3.2 置顶内容层（Pinned Area）
- **是否存在**：是
- **模块**：
  - 发布入口（悬浮卡片）
- **作用**：
  - 强化“这里是可以发布观点的地方”

### 3.3 内容层（Content Area）
- **内容类型**：Feed 列表
- **模块**：
  - FeedList
  - FeedFilter（全部 / 未结束 / 已结束）
  - FeedSort（时间 / 热度）
- **默认规则**：
  - 默认排序：时间倒序
  - 默认筛选：全部

### 3.4 底部操作区
- **是否存在**：否

### 3.5 底部 Tab
- **是否存在**：是
- **Tab 项**：
  - 观点流（高亮）
  - 搜索
  - 发布
  - 通知
  - 个人中心

## 4. 页面模块说明（Modules）

### 4.1 FeedList
- **模块目标**：承载 Feed 的主要浏览体验
- **模块类型**：列表
- **包含字段**：
  - 发布者头像 / 昵称
  - 标的
  - 看法 / 时效
  - 观点内容摘要
  - 发布时间
  - 互动数
- **主要交互**：
  - 点击 → FeedCard
- **状态**：
  - 空态：暂无观点，引导发布
  - Loading：骨架屏
  - Error：重试

## 5. 核心字段与数据结构（Data）

| 字段名 | 类型 | 来源 | 必需 | 说明 |
|-------|------|------|------|------|
| feed_id | string | feeds | 是 | 唯一 ID |
| user_id | string | feeds | 是 | 发布者 |
| direction | enum | feeds | 是 | 看法 |
| horizon | enum | feeds | 是 | 时效 |
| content | string | feeds | 是 | 观点内容 |
| status | enum | feeds | 是 | active/expired |

## 6. 交互流程（Interaction Flow）

1. 用户进入 FeedFlow
2. 浏览 FeedList
3. 点击某条 Feed → FeedCard
4. 点击发布入口 → CreateFeed

## 7. 状态与规则（States & Rules）

- 仅展示 public Feed
- Feed 按 status 支持筛选
- 本人 Feed 显示编辑入口

## 8. 异常与边界场景

- 无 Feed：展示引导文案
- 网络异常：保留已加载内容

## 9. 埋点与指标（Analytics）

- feedflow_view
- feed_click
- createfeed_click

## 10. 验收标准（AC）

- 已登录用户可正常浏览 Feed
- 可筛选未结束 / 已结束
- 点击 Feed 可进入 FeedCard

## 11. 关联页面

- **上游**：Login
- **下游**：FeedCard / CreateFeed / EditFeed

## 12. 备注

推荐排序后期补充
