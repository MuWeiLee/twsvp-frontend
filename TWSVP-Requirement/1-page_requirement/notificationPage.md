# 通知页面设计文档

## 0. 基本信息

- **页面名称**：通知
- **页面英文名（Route / Key）**：Notification
- **页面层级**：#1 主导航 / 一级入口
- **访问前提**：已登录
- **入口来源**：
  - 底部 Tab「通知」
- **页面出口**：
  - FeedCard
  - PersonalViewer
- **是否在底部 Tab 中**：是
- **对应核心数据对象**：
  - Notification
  - Feed
  - User

## 1. 页面目标（Goal）

- 聚合展示与用户相关的重要事件
- 提醒用户其 Feed 的互动情况与生命周期节点
- 引导用户回到 FeedCard / 个人观点管理

## 2. 页面角色与权限（Roles & Permission）

- **可访问用户**：
  - 未登录
  - 已登录
- **权限说明**：
  - 仅展示当前登录用户相关的通知
  - 不展示他人通知
  - 已删除 Feed 的通知不展示

## 3. 页面整体结构（Layout）

### 3.1 顶部栏（Header）
- 左侧：页面名称「通知」
- 右侧：无（保持专注）

### 3.2 置顶内容层（Pinned / Sticky Area）
- **是否存在**：是
- **包含模块**：
  - 通知类型 Tab
    - 点赞
    - 分享
    - 即期观点（到期提醒）
- **作用说明**：
  - 快速区分「互动类」与「生命周期类」通知

### 3.3 内容层（Content Area）
- **内容类型**：列表
- **根据当前 Tab 展示不同通知列表**
- **默认排序**：
  - 按时间倒序（最新在前）

### 3.4 底部操作区（Bottom Action Area）
- **是否存在**：否

### 3.5 底部 Tab（Bottom Tab）
- **是否存在**：是
- **Tab 项**：
  - 观点流
  - 搜索
  - 发布
  - 通知（高亮）
  - 个人中心

## 4. 页面模块说明（Modules）

### 4.1 通知类型 Tab（NotificationTypeTab）
- **模块目标**：区分不同类型的通知
- **模块类型**：Tab
- **枚举值**：
  - like（点赞）
  - share（分享）
  - expire（即期观点）
- **行为规则**：
  - 切换 Tab 不清空列表状态
  - 每个 Tab 独立维护分页

### 4.2 互动类通知列表（InteractionNotificationList）
- **对应**：点赞 / 分享
- **模块目标**：展示 Feed 的互动事件
- **模块类型**：列表
- **单条通知结构**：
  - 行为用户头像
  - 行为文案（点赞 / 分享了你的观点）
  - Feed 一句话结论摘要
  - 发生时间
- **主要交互**：
  - 点击通知 → FeedCard
  - 点击用户头像 → PersonalViewer
- **状态**：
  - 空态：暂无互动通知
  - Loading：骨架屏
  - Error：加载失败

### 4.3 到期提醒通知列表（ExpireNotificationList）
- **对应**：即期观点 / 到期观点
- **模块目标**：提醒用户 Feed 的生命周期节点
- **模块类型**：列表
- **通知类型细分**：
  - expire_soon（即将到期）
  - expired（已到期）
- **单条通知结构**：
  - 系统提示文案
    - 「你的观点将在 X 天后到期」
    - 「你的观点已到期」
  - Feed 一句话结论摘要
  - 剩余天数 / 到期时间
- **主要交互**：
  - 点击 → FeedCard
- **状态**：
  - 空态：暂无到期观点

## 5. 核心字段与数据结构（Data）

### 5.1 核心字段
| 字段名 | 类型 | 来源 | 是否必需 | 说明 |
|-------|------|------|----------|------|
| noti_id | string | notifications | 是 | 通知 ID |
| type | enum | notifications | 是 | like / share / expire_soon / expired |
| actor_user_id | string | notifications | 否 | 行为人（到期类为空） |
| target_feed_id | string | notifications | 是 | 关联 Feed |
| created_at | datetime | notifications | 是 | 通知时间 |
| read_at | datetime | notifications | 否 | 已读时间 |
| days_left | number | system | 否 | 到期剩余天数 |

### 5.2 枚举值
```
NotificationType:
- like
- share
- expire_soon
- expired
```

## 6. 交互流程（Interaction Flow）

1. 用户进入 Notification 页面
2. 默认展示「点赞」Tab
3. 用户切换通知类型
4. 点击通知项
5. 跳转至 FeedCard / PersonalViewer

## 7. 状态与规则（States & Rules）

### 7.1 页面状态
- Idle：初始加载
- Loading：请求中
- Success：展示通知
- Empty：无通知
- Error：加载失败

### 7.2 业务规则

#### 通知生成规则（MVP）
- like / share：行为发生即生成
- expire_soon：距离 expired_at = 3 天（可配置）
- expired：到期当日生成

#### 去重规则
- 同一 Feed 短时间多次互动可聚合（后期）

## 8. 异常与边界场景（Edge Cases）

- Feed 被删除：对应通知不展示
- 用户已读通知再次进入：保持已读状态
- 网络异常：支持重试

## 9. 埋点与指标（Analytics）

- notification_view
- notification_tab_switch
- notification_click
- notification_mark_read

## 10. 验收标准（Acceptance Criteria）

- 用户只能看到自己的通知
- 不同 Tab 正确展示对应通知
- 点击通知跳转正确页面
- 到期提醒按规则生成

## 11. 关联页面与依赖（Relations）

- **上游页面**：FeedFlow
- **下游页面**：FeedCard / PersonalViewer
- **依赖基础数据表**：
  - notifications
  - feeds
  - users

## 12. 备注 / 待确认事项

- 是否需要「全部标记已读」
- 是否需要通知红点 / 未读数量
