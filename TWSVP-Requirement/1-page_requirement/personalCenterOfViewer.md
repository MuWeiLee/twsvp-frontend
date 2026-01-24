# 页面设计文档 · PersonalViewer（个人主页）

## 0. 基本信息

- **页面名称**：个人主页
- **页面英文名（Route / Key）**：PersonalViewer
- **页面层级**：#2 二级聚合 / 详情类页面
- **访问前提**：已登录
- **入口来源**：
  - FeedCard（点击发布者头像 / 昵称）
  - Search（用户搜索结果）
  - StockFeed / SectorFeed（点击发布者）
- **页面出口**：
  - FeedCard
  - StockFeed
  - SectorFeed
- **是否在底部 Tab 中**：否
- **对应核心数据对象**：
  - User / Profile
  - Feed
  - FeedStats（聚合数据）

## 1. 页面目标（Goal）

- 帮助用户判断这个人是否值得信任
- 聚合展示某个用户的历史 Feed 表现
- 强化“观点是长期记录”的产品心智

## 2. 页面角色与权限（Roles & Permission）

- **可访问用户**：
  - 未登录
  - 已登录（他人视角）
- **权限说明**：
  - 不允许编辑 / 删除 Feed
  - 仅展示 public Feed
  - 不展示私密 / 已删除 Feed

## 3. 页面整体结构（Layout）

### 3.1 顶部栏（Header）
- 左侧：返回
- 中间：页面名称「个人主页」
- 右侧：无（避免干扰）

### 3.2 置顶内容层（Pinned / Sticky Area）
- **是否存在**：是
- **包含模块**：
  - 用户资料摘要（ProfileSummary）
- **作用说明**：
  - 第一屏建立“这个人是谁、靠不靠谱”的判断基础

### 3.3 内容层（Content Area）
- **内容类型**：混合（统计 + 列表）
- **包含模块**：
  - 观点核心指标（StatsSummary）
  - Feed 状态 Tab（全部 / 未结束 / 已结束）
  - 用户 FeedFlow（ViewerFeedList）
- **默认规则**：
  - 默认 Tab：全部
  - 未结束 Feed 优先展示

### 3.4 底部操作区（Bottom Action Area）
- **是否存在**：否
  - MVP 不提供关注 / 私信等社交操作

### 3.5 底部 Tab（Bottom Tab）
- **是否存在**：否
  - 避免与 PersonalCenter 心智混淆

## 4. 页面模块说明（Modules）

### 4.1 ProfileSummary（用户资料摘要）
- **模块目标**：展示用户的长期身份属性
- **模块类型**：信息卡
- **包含字段**：
  - 头像
  - 昵称
  - 个人介绍
  - 感兴趣行业标签
  - 首次登录时间
- **主要交互**：
  - 无（纯展示）
- **状态**：
  - 空态：无（Profile 必填）

### 4.2 StatsSummary（观点统计摘要）
- **模块目标**：量化该用户的历史表现
- **模块类型**：统计卡
- **包含指标（MVP）**：
  - Feed 总数
  - 已结束 Feed 数
- **扩展指标（后期）**：
  - 胜率
  - 累计绩效
  - 平均收益
- **状态**：
  - 暂无结算数据时显示占位说明

**产品原则**：
PersonalViewer 与 PersonalCenter 的统计口径 必须完全一致。

### 4.3 FeedStatusTab（Feed 状态切换）
- **模块目标**：按生命周期筛选 Feed
- **模块类型**：Tab
- **枚举值**：
  - 全部
  - 未结束（active）
  - 已结束（expired / verified）
- **行为规则**：
  - 切换 Tab 不清空分页状态

### 4.4 ViewerFeedList（他人观点流）
- **模块目标**：展示该用户的所有 Feed
- **模块类型**：列表
- **包含字段**：
  - FeedCard（精简版）
  - Feed 状态标签
- **主要交互**：
  - 点击 → FeedCard
  - 点击标的 → StockFeed
- **权限规则**：
  - 不显示编辑 / 删除入口
- **状态**：
  - **空态**：
    - 全部：该用户暂无观点
    - 未结束：暂无未结束观点
    - 已结束：暂无已结束观点

## 5. 核心字段与数据结构（Data）

### 5.1 核心字段
| 字段名 | 类型 | 来源 | 是否必需 | 说明 |
|-------|------|------|----------|------|
| user_id | string | users | 是 | 被查看用户 |
| nickname | string | profile | 是 | 昵称 |
| bio | string | profile | 否 | 介绍 |
| interested_industries | array | profile | 是 | 行业标签 |
| feeds_total | number | stats | 是 | Feed 总数 |
| feeds_closed | number | stats | 是 | 已结束 |
| win_rate | number | stats | 否 | 后期 |
| feed_list | Feed[] | feeds | 是 | 列表 |

## 6. 交互流程（Interaction Flow）

1. 用户从 FeedCard / Search 进入 PersonalViewer
2. 系统加载 Profile + Stats + Feed 列表
3. 用户切换 Feed 状态 Tab
4. 点击某条 Feed → FeedCard
5. 点击标的 → StockFeed

## 7. 状态与规则（States & Rules）

### 7.1 页面状态
- Loading：首次加载
- Success：展示内容
- Empty：无 Feed
- Error：加载失败

### 7.2 业务规则
- 仅展示 public Feed
- 已删除 Feed 不展示
- Feed 顺序与 PersonalCenter 保持一致逻辑

## 8. 异常与边界场景（Edge Cases）

- 用户被删除 / 不存在：展示错误页
- Feed 数据异常：仅隐藏异常 Feed，不影响整体
- 网络异常：允许重试

## 9. 埋点与指标（Analytics）

- personalviewer_view
- feed_tab_switch
- feed_click
- stock_click

## 10. 验收标准（Acceptance Criteria）

- 正确展示他人资料与 Feed
- 不出现编辑 / 删除入口
- Feed 状态筛选生效
- 点击跳转正确页面

## 11. 关联页面与依赖（Relations）

- **上游页面**：
  - FeedCard
  - Search
- **下游页面**：
  - FeedCard
  - StockFeed
  - SectorFeed
- **依赖基础数据表**：
  - users
  - profiles
  - feeds
  - feed_stats

## 12. 备注 / 待确认事项

- 是否在后期增加「关注」能力
- 是否对新用户标注“新手 / 观点数较少”提示
