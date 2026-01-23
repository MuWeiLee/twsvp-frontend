# TWSVP 登录与注册需求说明

## 当前策略
- 仅支持 Google 账号登录与注册
- 不提供邮箱、密码、手机号等本地账号体系
- 登录与注册入口合并在同一页面，通过 Tab 切换模式
- 认证由 Supabase 承载，前端不展示或提示 Supabase 相关信息

## 页面行为
- 未登录访问 twsvp.com 时，自动定位到登录页
- 登录模式：展示“使用 Google 登录”按钮
- 注册模式：展示“使用 Google 注册”按钮
- 文案统一为中文，符合 TWSVP 产品调性
- 登录成功后默认进入 Feed 页面
- OAuth 回调统一落在 /auth/callback

## 需要接入的能力
- Google OAuth 跳转与回调处理
- 登录成功后的跳转与会话存储（如 Token/Session）
