# 搜索页面设计文档

## 0. 基本信息

- **页面名称**：搜索
- **页面英文名（Route / Key）**：Search
- **页面层级**：#1 主导航 / 一级入口
- **访问前提**：已登录
- **入口来源**：
  - FeedFlow 顶部搜索入口
  - 底部 Tab「搜索」
- **页面出口**：
  - FeedCard
  - StockFeed
  - SectorFeed
  - PersonalViewer
- **是否在底部 Tab 中**：是
- **对应核心数据对象**：
  - Feed
  - Stock
  - Sector（Theme / Industry）
  - User

## 1. 页面目标（Goal）

- 让用户快速定位目标对象（观点 / 个股 / 话题 / 用户）
- 承担「探索入口」角色，而不仅是工具型搜索
- 为 StockFeed / SectorFeed / PersonalViewer 提供入口

## 2. 页面角色与权限（Roles & Permission）

- **可访问用户**：
  - 未登录
  - 已登录
- **权限说明**：
  - 所有搜索结果均为 public 内容
  - 不展示被删除 / 不可见 Feed

## 3. 页面整体结构（Layout）

### 3.1 顶部栏（Header）
- 左侧：页面名称「搜索」
- 右侧：无（保持简洁）

### 3.2 置顶内容层（Pinned / Sticky Area）
- **是否存在**：是
- **包含模块**：
  - 搜索框（Input）
  - 搜索结果类型 Tab
    - 观点
    - 个股
    - 话题
    - 用户
- **作用说明**：
  - 快速输入
  - 快速切换搜索维度

### 3.3 内容层（Content Area）
- **内容类型**：列表
- **根据当前 Tab 展示不同结果**：
  - FeedList（观点）
  - StockList（个股）
  - SectorList（话题 / 行业）
  - UserList（用户）
- **默认规则**：
  - 首次进入：展示搜索历史 / 热门内容
  - 输入关键词后：展示搜索结果

### 3.4 底部操作区（Bottom Action Area）
- **是否存在**：否

### 3.5 底部 Tab（Bottom Tab）
- **是否存在**：是
- **Tab 项**：
  - 观点流
  - 搜索（高亮）
  - 发布
  - 通知
  - 个人中心

## 4. 页面模块说明（Modules）

### 4.1 搜索框（SearchInput）
- **模块目标**：承载所有搜索行为的统一入口
- **模块类型**：输入
- **包含字段**：
  - query（关键词）
- **主要交互**：
  - 输入关键词即触发搜索（可防抖）
  - 点击清空输入
- **状态**：
  - Idle：展示占位文案
  - Typing：输入中
  - Searching：loading
  - Error：搜索失败提示

### 4.2 搜索类型 Tab（SearchTypeTab）
- **模块目标**：切换搜索结果类型
- **模块类型**：Tab
- **枚举值**：
  - Feed（观点）
  - Stock（个股）
  - Sector（话题 / 行业）
  - User（用户）
- **行为规则**：
  - 切换 Tab 不清空 query
  - 每个 Tab 独立维护分页状态

### 4.3 Feed 搜索结果列表（FeedSearchList）
- **模块目标**：展示匹配的 Feed
- **模块类型**：列表
- **包含字段**：
  - summary
  - direction / horizon
  - 标的
  - 发布者
  - 发布时间
- **排序规则**：
  - 默认：匹配度优先
  - 次级：时间倒序
- **主要交互**：
  - 点击 → FeedCard
- **状态**：
  - 空态：未找到相关观点

### 4.4 Stock 搜索结果列表（StockList）
- **模块目标**：展示匹配的股票
- **模块类型**：列表
- **包含字段**：
  - 股票代码
  - 股票名称
- **排序规则**：
  - 完全匹配优先
- **主要交互**：
  - 点击 → StockFeed

### 4.5 Sector 搜索结果列表（SectorList）
- **模块目标**：展示匹配的话题 / 行业
- **模块类型**：列表
- **包含字段**：
  - 名称
  - 类型（Theme / Industry）
- **主要交互**：
  - 点击 → SectorFeed

### 4.6 User 搜索结果列表（UserList）
- **模块目标**：展示匹配的用户
- **模块类型**：列表
- **包含字段**：
  - 头像
  - 昵称
  - 观点数 / 胜率（可选）
- **主要交互**：
  - 点击 → PersonalViewer

## 5. 核心字段与数据结构（Data）

### 5.1 核心字段
| 字段名 | 类型 | 来源 | 是否必需 | 说明 |
|-------|------|------|----------|------|
| query | string | SearchInput | 是 | 搜索关键词 |
| result_type | enum | UI State | 是 | feed / stock / sector / user |
| feed_id | string | feeds | 否 | Feed 搜索结果 |
| stock_id | string | stocks | 否 | 个股 |
| sector_id | string | sectors | 否 | 话题/行业 |
| user_id | string | users | 否 | 用户 |

### 5.2 枚举值
```
SearchResultType:
- feed
- stock
- sector
- user
```

## 6. 交互流程（Interaction Flow）

1. 用户进入 Search 页面
2. 默认展示搜索历史 / 热门内容
3. 用户输入关键词
4. 系统根据当前 Tab 返回结果
5. 用户点击结果，进入对应页面

## 7. 状态与规则（States & Rules）

### 7.1 页面状态
- Idle：未输入关键词
- Loading：搜索中
- Success：展示结果
- Empty：无匹配结果
- Error：搜索失败

### 7.2 业务规则
- 搜索结果仅包含 public Feed
- 已删除 / 不可见 Feed 不进入结果
- 不同 Tab 使用不同搜索策略

## 8. 异常与边界场景（Edge Cases）

- 输入空字符串：不触发搜索
- 搜索结果过多：分页加载
- 网络异常：提示重试

## 9. 埋点与指标（Analytics）

- search_view
- search_input
- search_tab_switch
- search_result_click

## 10. 验收标准（Acceptance Criteria）

- 输入关键词可正确返回结果
- Tab 切换不清空关键词
- 点击结果跳转正确页面
- 无结果态展示正常

## 11. 关联页面与依赖（Relations）

- **上游页面**：FeedFlow
- **下游页面**：FeedCard / StockFeed / SectorFeed / PersonalViewer
- **依赖基础数据表**：
  - feeds
  - stocks
  - sectors
  - users

## 12. 备注 / 待确认事项

- 搜索联想是否在 MVP 实现
- 热门搜索 / 历史是否持久化
