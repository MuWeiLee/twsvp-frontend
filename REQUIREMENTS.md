# TWSVP — 页面规格说明（标准格式）
## 全局设置
1) 默认语言：繁体中文（zh-Hant）。

## 页面：Login（登录/注册二合一，Google OAuth）
- 页面层级：#1（主导航 / 一级入口）
- 页面路由：`/login`
- 适用端：Web / Mobile Web（响应式）
- 权限：未登录可访问；已登录访问自动跳转
- 关联页面：Feed（`/feed`）、PersonalSetting（`/personal-setting`）

---

## 1. 页面目标（Goal）
1) 以最低摩擦完成登录（仅 Google OAuth）。  
2) 首次登录自动创建用户基础记录（User/Profile 的基础行）。  
3) 登录成功后根据 Profile 完整度分流：
- Profile 完整 → 进入 Feed  
- Profile 未完整 → 进入 PersonalSetting  

---

## 2. 页面组成（Modules）
### 2.1 品牌区（Brand Area，可选）
- Logo（必选其一：Logo 图形）
- Slogan（让你的观点价值被看见）

### 2.2 登录区（Auth Area）
- 主按钮：`使用 Google 登录`（唯一登录入口）
- 辅助文案（可选）：说明“登录即代表同意协议”等

### 2.3 协议区（Legal Area，可选但建议占位）
- 用户协议（链接）
- 隐私政策（链接）

---

## 3. 字段定义（Fields）
> 本页面不包含用户手动输入字段，核心是“OAuth 结果字段”与“路由分流判定字段”。

### 3.1 OAuth 返回字段（从 Auth Provider / Supabase Auth 获取）
| 字段名 | 类型 | 来源 | 必填 | 示例 | 用途 |
|---|---|---|---|---|---|
| auth_user_id | string | OAuth / Supabase Auth | 是 | `uuid` | 用户唯一标识（后续所有数据关联键） |
| email | string | OAuth | 是 | `xxx@gmail.com` | 账号标识、通知、风控等 |
| avatar_url | string(URL) | OAuth | 否 | `https://...` | 头像默认值 |
| google_name | string | OAuth | 否 | `王小明` | 默认昵称候选值 |

### 3.2 系统判定字段（用于分流）
| 字段名 | 类型 | 来源 | 必填 | 说明 |
|---|---|---|---|---|
| is_authenticated | boolean | 客户端会话 / Supabase Session | 是 | 当前是否已登录 |
| profile_is_complete | boolean | profiles 表或后端计算 | 是 | 资料是否完整（用于分流到 Feed 或 PersonalSetting） |

> **Profile 完整度判定建议（MVP）**：`nickname != null && nickname != "" && interested_industries_count >= 1`  
>（是否强制 bio 由你产品策略决定）

---

## 4. 布局与位置（Layout）
> 标准布局：居中卡片 + 顶部品牌 + 底部协议。灰底/电子纸风格也可兼容。

### 4.1 页面结构（自上而下）
1) **顶部留白 / 状态栏区域**（可选）
2) **品牌区**（居中）
   - Logo（上）
   - Slogan（下，可选）
3) **登录区**（居中卡片的主内容）
   - Google 登录主按钮（全宽，主 CTA）
   - 错误提示（按钮下方，默认隐藏）
4) **协议区**（页面底部固定或卡片下方）
   - “继续表示你同意 …” + 协议链接（可选）

### 4.2 栅格与间距（建议值，可被设计系统覆盖）
- 容器最大宽度：360–420px（移动优先）
- 主按钮高度：44–48px
- 模块间距：16–24px
- 错误提示与按钮间距：8–12px

---

## 5. 交互与流程（Interaction Flow）
### 5.1 初次进入页面
- 若 `is_authenticated = true` → **立即跳转** `/feed`
- 否则显示 Login 页面 UI

### 5.2 点击「使用 Google 登录」
1) 进入 loading 状态（按钮禁用 + loading）
2) 发起 Google OAuth
3) OAuth 成功：
   - 获取会话 `session`
   - 若用户为首次登录：创建基础 Profile（自动落库）
   - 查询 `profile_is_complete`
   - 分流跳转：
     - `profile_is_complete = true` → `/feed`
     - `profile_is_complete = false` → `/personal-setting`
4) OAuth 失败 / 取消：
   - 展示错误提示（不离开页面）
   - 解除 loading，可再次点击

---

## 6. 状态与规则（States & Rules）
### 6.1 状态列表
| 状态 | 触发条件 | UI 表现 | 用户可操作 |
|---|---|---|---|
| Idle | 初始未登录 | 正常显示按钮 | 点击登录 |
| Loading | 发起 OAuth | 按钮 loading + 禁用 | 不能重复点击 |
| AuthFailed | 授权失败 | 展示错误提示 | 重新尝试 |
| AuthCanceled | 用户取消 | 轻提示或不提示 | 重新尝试 |
| NetworkError | 网络异常 | 错误提示 | 重试 |
| AutoRedirect | 已登录访问 | 无 UI 或短暂闪屏 | 自动跳转 |

### 6.2 规则
- **单入口**：仅允许 Google OAuth 登录
- **幂等**：重复登录不应重复创建用户基础记录（以 auth_user_id 唯一）
- **已登录访问 Login**：必须自动跳转 Feed（避免“登录态还看到登录页”）

---

## 7. 错误提示文案（建议）
| 场景 | 提示文案（示例） |
|---|---|
| 授权失败 | 登录失败，请稍后重试 |
| 用户取消 | 已取消登录 |
| 网络异常 | 网络异常，请检查网络后重试 |
| 未知错误 | 出现问题，请稍后再试 |

---

## 8. 数据与接口（Data & API）
> 以 Supabase 为例；若你用其他后端亦可映射。

### 8.1 必须调用
1) `supabase.auth.signInWithOAuth({ provider: 'google' })`
2) `supabase.auth.getSession()` / 监听 auth state
3) `profiles` 查询（判断 profile_is_complete）
4) 首次登录：`profiles` upsert（幂等）

### 8.2 profiles 最小字段建议（用于本页分流）
| 字段 | 说明 |
|---|---|
| user_id（=auth_user_id） | 主键/唯一键 |
| nickname | 默认 google_name |
| avatar_url | 默认 avatar_url |
| bio | 可空 |
| interested_industries | 数组/关系表（至少 1 个则完整） |
| profile_completed_at | 完成时间（可选但很有用） |

---

## 9. 埋点（Analytics，可选但建议）
| 事件名 | 触发时机 | 关键参数 |
|---|---|---|
| login_view | 页面曝光 | referrer |
| login_click_google | 点击登录按钮 |  |
| login_oauth_success | OAuth 成功 | auth_user_id(脱敏) |
| login_oauth_fail | OAuth 失败 | error_code |
| login_redirect_feed | 分流到 Feed |  |
| login_redirect_personal_setting | 分流到 PersonalSetting |  |

---

## 10. 验收标准（Acceptance Criteria）
1) 未登录用户打开 `/login` 可正常看到 Google 登录按钮。  
2) 点击登录后进入 loading，且不能重复触发。  
3) OAuth 成功：
   - 必须获得 session
   - 首次登录必须创建基础 profile（幂等）
   - profile 完整 → 跳 `/feed`
   - profile 未完整 → 跳 `/personal-setting`
4) 已登录用户访问 `/login` 必须自动跳 `/feed`。  
5) 授权失败/取消/网络错误均能回到可重试状态，并显示合理提示。  
