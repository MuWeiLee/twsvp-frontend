# 页面设计文档 · PersonalCenter（个人中心）

## 0. 基本信息

- **页面名称**：个人中心
- **页面英文名（Route / Key）**：PersonalCenter
- **页面层级**：#1 主导航 / 一级入口
- **访问前提**：已登录
- **入口来源**：
  - 底部 Tab「个人中心」
- **页面出口**：
  - FeedCard
  - EditFeed
  - Setting
  - PersonalViewer（点击自己头像昵称）
- **是否在底部 Tab 中**：是
- **对应核心数据对象**：
  - User / Profile
  - Feed
  - FeedStats（聚合数据）

## 1. 页面目标（Goal）

- 让用户清楚认识自己的历史观点表现
- 提供统一入口管理个人 Feed
- 建立「长期记录」而不是短期发帖的心智

## 2. 页面角色与权限（Roles & Permission）

- **可访问用户**：
  - 未登录
  - 已登录（本人）
- **权限说明**：
  - 仅本人可访问 PersonalCenter
  - 本人 Feed 可编辑 / 删除（受 EditFeed 规则约束）

## 3. 页面整体结构（Layout）

### 3.1 顶部栏（Header）
- 左侧：页面名称「个人中心」
- 右侧：设置入口（⚙️，跳 Setting）

### 3.2 置顶内容层（Pinned / Sticky Area）
- **是否存在**：是
- **包含模块**：
  - 个人基础信息区（ProfileSummary）
- **作用说明**：
  - 快速建立「这是我」的身份认知

### 3.3 内容层（Content Area）
- **内容类型**：混合（统计 + 列表）
- **包含模块**：
  - 观点核心指标（StatsSummary）
  - Feed 状态 Tab（全部 / 未结束 / 已结束）
  - 个人 FeedFlow（PersonalFeedList）
- **默认规则**：
  - 默认 Tab：全部
  - 未结束 Feed 优先展示在列表顶部

### 3.4 底部操作区（Bottom Action Area）
- **是否存在**：否

### 3.5 底部 Tab（Bottom Tab）
- **是否存在**：是
- **Tab 项**：
  - 观点流
  - 搜索
  - 发布
  - 通知
  - 个人中心（高亮）

## 4. 页面模块说明（Modules）

### 4.1 ProfileSummary（个人资料摘要）
- **模块目标**：展示用户身份与长期属性
- **模块类型**：信息卡
- **包含字段**：
  - 头像
  - 昵称
  - 个人介绍
  - 感兴趣行业标签
  - 首次登录时间
- **主要交互**：
  - 点击头像 / 昵称 → PersonalViewer（他人视角）
- **状态**：
  - 空态：无（首次登录必填）

### 4.2 StatsSummary（观点统计摘要）
- **模块目标**：建立观点可信度与自我反馈
- **模块类型**：统计卡
- **包含指标（MVP）**：
  - 总 Feed 数
  - 已结束 Feed 数
- **扩展指标（后期）**：
  - 胜率
  - 累计绩效
  - 平均收益
- **状态**：
  - 指标计算中 / 暂未开放（占位）

**产品建议**：
MVP 可以显示「胜率待结算」，但模块要提前占位。

### 4.3 FeedStatusTab（Feed 状态切换）
- **模块目标**：快速筛选个人 Feed
- **模块类型**：Tab
- **枚举值**：
  - 全部
  - 未结束（active）
  - 已结束（expired / verified）
- **行为规则**：
  - 切换 Tab 不清空滚动位置
  - 列表分页状态独立

### 4.4 PersonalFeedList（个人观点流）
- **模块目标**：管理个人 Feed
- **模块类型**：列表
- **包含字段**：
  - FeedCard（精简）
  - Feed 状态标签
- **主要交互**：
  - 点击 → FeedCard
  - 编辑 → EditFeed（符合规则时）
  - 删除 → 删除确认
- **状态**：
  - **空态**：
    - 全部：暂无观点，引导发布
    - 未结束：暂无未结束观点
    - 已结束：暂无已结束观点

## 5. 核心字段与数据结构（Data）

### 5.1 核心字段
| 字段名 | 类型 | 来源 | 是否必需 | 说明 |
|-------|------|------|----------|------|
| user_id | string | users | 是 | 当前用户 |
| nickname | string | profile | 是 | 昵称 |
| bio | string | profile | 否 | 介绍 |
| interested_industries | array | profile | 是 | 行业标签 |
| feeds_total | number | stats | 是 | Feed 总数 |
| feeds_closed | number | stats | 是 | 已结束 |
| win_rate | number | stats | 否 | 后期 |
| feed_list | Feed[] | feeds | 是 | 列表 |

## 6. 交互流程（Interaction Flow）

1. 用户进入 PersonalCenter
2. 系统加载 Profile + Stats + Feed 列表
3. 用户切换 Feed 状态 Tab
4. 点击某条 Feed → FeedCard
5. 点击编辑 → EditFeed

## 7. 状态与规则（States & Rules）

### 7.1 页面状态
- Loading：首次加载
- Success：展示内容
- Empty：无 Feed
- Error：加载失败

### 7.2 业务规则
- 仅本人可编辑 / 删除 Feed
- 已到期 Feed 不允许编辑
- 删除 Feed 采用软删除

## 8. 异常与边界场景（Edge Cases）

- 用户无 Feed：引导发布
- Stats 数据延迟：显示占位提示
- 网络异常：允许重试

## 9. 埋点与指标（Analytics）

- personalcenter_view
- feed_tab_switch
- feed_edit_click
- feed_delete_click

## 10. 验收标准（Acceptance Criteria）

- 正确展示个人资料
- Feed 状态筛选生效
- 编辑 / 删除权限正确
- 空态展示合理

## 11. 关联页面与依赖（Relations）

- **上游页面**：FeedFlow
- **下游页面**：
  - FeedCard
  - EditFeed
  - Setting
- **依赖基础数据表**：
  - users
  - profiles
  - feeds
  - feed_stats（或视图）

## 12. 备注 / 待确认事项

- 胜率 / 绩效计算口径
- 是否展示「关注 / 被关注」（当前你有字段，后期可用）
