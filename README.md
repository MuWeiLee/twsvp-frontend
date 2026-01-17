# TWSV｜台股觀點社群 MVP

## 项目简介

TWSV是一个台股投资观点记录与回溯平台，用户可以发布结构化的投资观点，并在指定时间后自动结算结果。

## 核心功能

- ✅ 可结构化发表投资观点（标的、方向、时效）
- ✅ 观点在时间到期或手动结束后自动结算
- ✅ 沉淀个人判断历史与长期可信度
- ✅ Google OAuth 登录认证

## 技术栈

- **前端**：原生 HTML/CSS/JavaScript + Vue.js
- **后端**：待实现
- **数据库**：待实现
- **认证**：Google OAuth 2.0

## 快速开始

### 本地开发

1. 克隆仓库
```bash
git clone <repository-url>
cd TWSV
```

2. 启动本地服务器
```bash
python3 -m http.server 8080
```

3. 在浏览器中访问
```
http://localhost:8080/login.html
```

## 项目结构

```
TWSV/
├── REQUIREMENTS.md      # 登录与注册需求说明
├── Requirement.md       # 完整产品需求文档
├── STYLE.md             # 设计规范
├── feed.html            # 广场页（主页面）
├── login.html           # 登录页
├── notifications.html   # 通知页
├── profile.html         # 个人页
├── search.html          # 搜索页
└── settings.html        # 设置页
```

## 开发指南

### 前端开发

- 使用 Vue.js 进行组件化开发
- 遵循 STYLE.md 中的设计规范
- 确保所有页面在移动设备上有良好的显示效果

### 后端集成

- 待实现：API 接口开发
- 待实现：数据库集成
- 待实现：Google OAuth 回调处理

## 部署说明

待实现

## 许可证

MIT License