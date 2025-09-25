# 手机信息管理系统

## 项目简介
一个完整的手机信息管理系统，包括管理端、客户端和安卓应用。

## 功能特性
- 账号管理
- 设备管理
- 短信规则管理
- 验证码获取
- 倍数倍计时功能
- 实时短信同步
- 验证码等待时间设置（已修复）

## 技术栈
- 后端：FastAPI + PostgreSQL
- 前端：React + TypeScript + Ant Design
- 移动端：Android + Kotlin
- 部署：Railway + Cloudflare

## 项目结构
```
📁 backend/          # 后端API服务
📁 frontend/         # 管理员前端
📁 customer-site/    # 客户浏览界面
📁 android-client/   # 安卓客户端
📄 docker-compose.yml
📄 init.sql
```

## 部署说明
请参考 `Railway + Cloudflare 新手完整部署教程.md` 进行部署。

## 环境要求
- Python 3.11+
- Node.js 18+
- PostgreSQL 15+
- Android SDK (for mobile app)

## 最新修复
- ✅ 验证码等待时间设置问题已修复
- ✅ 倍数倍计时功能完善
- ✅ 刷新页面持久化功能
- ✅ 智能短信显示逻辑
