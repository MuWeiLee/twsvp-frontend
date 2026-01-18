# TWSVP OAuth + 用户数据 + Feed 数据库落地方案

本文档用于明确三件事：Google OAuth 登录、用户个人信息数据、Feed 数据库建设的现状与启动步骤。

## 1) Google OAuth 登录

### 目标
用户通过 Google 登录，后端验证并创建/更新用户，签发 JWT，前端保存会话。

### 需要的配置
- Google Cloud Console 创建 OAuth Client（Web）
- 回调地址（生产）：`https://twsvp.com/auth/callback`
- 回调地址（本地）：`http://localhost:5173/auth/callback`
- 记录以下信息：
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`

### 接入步骤（建议顺序）
1. 在 Google Cloud Console 新建 OAuth Client 并配置回调域名
2. 在后端 `.env` 配置 `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI`
3. 前端登录按钮跳转 Google 授权页
4. 前端回调页拿到 `code`，调用后端 `/auth/google` 换 JWT
5. 前端保存 JWT，跳转到 `/feed`

### 当前状态
- 后端接口已准备（`POST /auth/google`），但尚未部署并联调
- 前端 OAuth 流程尚未接入

---

## 2) 用户个人信息数据

### 数据需求（MVP）
- 账号（Google ID / email）
- 昵称（name）
- 头像（avatar）
- 发文记录（posts 关联）

### 数据结构（后端已规划）
`User`
- `id` (cuid)
- `googleId` (unique)
- `email` (unique)
- `name`
- `avatarUrl`
- `createdAt`

### 当前状态
- 后端 Prisma schema 已定义 `User`
- 需要创建数据库并运行迁移

---

## 3) Feed 数据库（帖子）

### 说明
Feed 数据库目前没有真正落地，只是前端的静态假数据。

### 数据结构（后端已规划）
`Post`
- `id` (cuid)
- `content`
- `createdAt`
- `authorId` (关联 User)

### 当前状态
- 后端 Prisma schema 已定义 `Post`
- 需要数据库实例与迁移
- 需要前端改为调用 API 获取/发布帖子

---

## 推荐启动顺序（最省时间）

1. 创建数据库（PostgreSQL）
2. 后端部署（Render），配置环境变量
3. 后端运行 Prisma 迁移
4. 前端接入 Google OAuth 回调页
5. 前端接入 Feed API（拉取/发布）

---

## 我可以帮你做的事（下一步）

1) **Google OAuth 前端接入**
- 新增 `/auth/callback` 页面
- 登录按钮跳转 + 回调处理
- 保存 JWT 与跳转

2) **数据库与后端部署**
- 帮你选 PostgreSQL（Neon / Supabase）
- 配 Render 环境变量并部署
- Prisma migrate 执行

3) **Feed 数据改为真实 API**
- `GET /posts` 拉取
- `POST /posts` 发布
- 认证与错误提示

---

## 需要你提供的信息

- 是否同意使用 PostgreSQL（Neon 或 Supabase）
- 是否由我继续直接接入 OAuth 前端流程
- 后端 API 域名确认（例如：`https://api.twsvp.com`）

