# TWSV｜台股觀點社群 MVP

## 项目简介

TWSV是一个台股投资观点记录与回溯平台，用户可以发布结构化的投资观点，并在指定时间后自动结算结果。

## 核心功能

- ✅ 可结构化发表投资观点（标的、方向、时效）
- ✅ 观点在时间到期或手动结束后自动结算
- ✅ 沉淀个人判断历史与长期可信度
- ✅ Google OAuth 登录认证

## 技术栈

- **前端**：Vue 3 + Vite + Vue Router
- **后端**：Node.js（server/）
- **数据库**：PostgreSQL（后端规划）
- **认证**：Google OAuth 2.0

## 快速开始

### 本地开发（前端）

1. 克隆仓库
```bash
git clone <repository-url>
cd TWSV
```

2. 安装依赖并启动
```bash
npm install
npm run dev
```

3. 在浏览器中访问
```
http://localhost:5173
```

## 项目结构

```
TWSV/
├── server/              # 后端服务
├── src/                 # 前端源码（Vue）
├── index.html           # Vite 入口
├── REQUIREMENTS.md      # 登录与注册需求说明
├── Requirement.md       # 完整产品需求文档
└── STYLE.md             # 设计规范
```

## 开发指南

### 前端开发

- 使用 Vue 组件化开发 + Vue Router
- 遵循 STYLE.md 中的设计规范
- 确保所有页面在移动设备上有良好的显示效果

### 后端集成

- 见 `server/README.md`

## 部署说明

待实现

## 许可证

MIT License
