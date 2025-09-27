# 📱 SMS转发管理系统

<div align="center">

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.11+-green.svg)
![React](https://img.shields.io/badge/react-18.0+-blue.svg)
![FastAPI](https://img.shields.io/badge/fastapi-0.104+-green.svg)
![PostgreSQL](https://img.shields.io/badge/postgresql-13+-blue.svg)

**一个功能强大的短信转发管理系统，支持多设备管理、智能规则配置和实时监控**

[🚀 快速开始](#-快速开始) • [📖 文档](#-文档) • [🎯 功能特性](#-功能特性) • [🛠️ 技术栈](#️-技术栈) • [📦 部署指南](#-部署指南)

</div>

## 📋 项目简介

SMS转发管理系统是一个基于Web的短信转发和管理平台，专为需要集中管理多个Android设备短信的用户设计。系统支持智能短信分类、自定义转发规则、实时设备监控等功能，特别适用于验证码接收、短信营销管理等场景。

### 🎯 主要用途

- **验证码管理**: 集中接收和管理各种平台的验证码短信
- **短信转发**: 根据自定义规则自动转发短信到指定目标
- **设备监控**: 实时监控Android设备状态和短信接收情况
- **账号管理**: 为不同客户创建独立的访问链接和账号管理
- **数据分析**: 短信接收统计和转发日志分析

## ✨ 功能特性

### 🔧 核心功能

- **📱 多设备管理**
  - 支持多个Android设备同时接入
  - 实时设备状态监控（在线/离线）
  - 设备信息展示（品牌、型号、手机号等）
  - 设备心跳检测和自动重连

- **📨 智能短信管理**
  - 自动短信分类（验证码、通知、广告等）
  - 短信内容搜索和筛选
  - 验证码自动提取和一键复制
  - 短信转发历史记录

- **⚙️ 灵活规则配置**
  - 基于发送方的匹配规则
  - 基于短信内容的匹配规则
  - 支持精确匹配、模糊匹配、正则表达式
  - 规则优先级设置

- **🔗 客户访问管理**
  - 为每个客户生成独立访问链接
  - 客户端实时查看短信和验证码
  - 账号信息展示和管理
  - 访问权限控制

- **📊 实时监控**
  - 实时短信接收通知
  - 设备状态变化提醒
  - 转发成功/失败统计
  - 系统运行状态监控

### 🎨 用户界面

- **管理员后台**
  - 现代化的React + Ant Design界面
  - 响应式设计，支持移动端访问
  - 实时数据更新（每2秒轮询）
  - 直观的数据可视化

- **客户端页面**
  - 简洁的客户访问界面
  - 实时短信和验证码展示
  - 一键复制验证码功能
  - 自动刷新机制

## 🛠️ 技术栈

### 后端技术

- **🐍 Python 3.11+**
- **⚡ FastAPI** - 现代化的Web框架
- **🗄️ PostgreSQL** - 主数据库
- **🔄 SQLAlchemy** - ORM框架
- **🔐 JWT** - 身份认证
- **📝 Alembic** - 数据库迁移
- **🔍 Pydantic** - 数据验证

### 前端技术

- **⚛️ React 18** - 用户界面框架
- **📘 TypeScript** - 类型安全
- **🎨 Ant Design** - UI组件库
- **🌐 Axios** - HTTP客户端
- **📱 响应式设计** - 移动端适配

### 部署技术

- **🐳 Docker** - 容器化部署
- **🚄 Railway** - 云平台部署
- **🌐 Nginx** - 反向代理（可选）
- **📦 多阶段构建** - 优化镜像大小

## 📁 项目结构

```
SMS-forwarding/
├── 📁 backend/                 # 后端代码
│   ├── 📁 app/
│   │   ├── 📁 api/             # API路由
│   │   ├── 📁 models/          # 数据模型
│   │   ├── 📁 services/        # 业务逻辑
│   │   ├── 📄 main.py          # 应用入口
│   │   ├── 📄 config.py        # 配置文件
│   │   └── 📄 database.py      # 数据库连接
│   └── 📄 requirements.txt     # Python依赖
├── 📁 frontend/                # 管理员前端
│   ├── 📁 src/
│   │   ├── 📁 components/      # React组件
│   │   ├── 📁 pages/           # 页面组件
│   │   ├── 📁 services/        # API服务
│   │   └── 📄 App.tsx          # 应用入口
│   └── 📄 package.json         # 前端依赖
├── 📁 customer-site/           # 客户端前端
│   ├── 📁 src/
│   │   ├── 📁 pages/           # 客户页面
│   │   └── 📁 config/          # 配置文件
│   └── 📄 package.json         # 前端依赖
├── 📁 nginx/                   # Nginx配置
├── 📄 Dockerfile               # Docker构建文件
├── 📄 railway.json             # Railway部署配置
├── 📄 docker-compose.yml       # 本地开发配置
└── 📄 README.md                # 项目文档
```

## 🚀 快速开始

### 环境要求

- **Python**: 3.11 或更高版本
- **Node.js**: 18.0 或更高版本
- **PostgreSQL**: 13 或更高版本
- **Docker**: 20.0 或更高版本（可选）

### 本地开发部署

#### 1. 克隆项目

```bash
git clone https://github.com/yduas4900/SMS-forwarding.git
cd SMS-forwarding
```

#### 2. 后端设置

```bash
# 进入后端目录
cd backend

# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置数据库连接等信息

# 初始化数据库
python -c "from app.database import init_database; init_database()"

# 启动后端服务
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 3. 前端设置

```bash
# 新开终端，进入前端目录
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm start
```

#### 4. 客户端设置

```bash
# 新开终端，进入客户端目录
cd customer-site

# 安装依赖
npm install

# 启动开发服务器
npm start
```

### 🐳 Docker部署

#### 使用Docker Compose（推荐）

```bash
# 克隆项目
git clone https://github.com/yduas4900/SMS-forwarding.git
cd SMS-forwarding

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

#### 使用单个Docker镜像

```bash
# 构建镜像
docker build -t sms-forwarding .

# 运行容器
docker run -d \
  --name sms-forwarding \
  -p 8000:8000 \
  -e DATABASE_URL="postgresql://user:password@host:5432/dbname" \
  sms-forwarding
```

## 📦 部署指南

### 🚄 Railway部署（推荐）

Railway是一个现代化的云平台，支持自动部署和扩展。

#### 1. 准备工作

- 注册Railway账号：https://railway.app
- 安装Railway CLI（可选）

#### 2. 部署步骤

1. **Fork项目到您的GitHub**
2. **在Railway中创建新项目**
3. **连接GitHub仓库**
4. **配置环境变量**：
   ```
   DATABASE_URL=postgresql://...  # Railway会自动提供
   SECRET_KEY=your-secret-key
   ALLOWED_ORIGINS=https://your-domain.railway.app
   ```
5. **部署完成**

详细部署教程请参考：[RAILWAY_DEPLOYMENT_GUIDE.md](RAILWAY_DEPLOYMENT_GUIDE.md)

### 🌐 其他云平台部署

- **Heroku**: 支持，需要配置Procfile
- **Vercel**: 支持前端部署
- **AWS/阿里云**: 支持Docker部署
- **VPS服务器**: 支持Docker或直接部署

## ⚙️ 配置说明

### 环境变量配置

创建 `.env` 文件并配置以下变量：

```env
# 应用配置
APP_NAME=SMS转发管理系统
DEBUG=false

# 数据库配置
DATABASE_URL=postgresql://user:password@localhost:5432/sms_db

# 安全配置
SECRET_KEY=your-super-secret-key-min-32-characters
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# 服务器配置
HOST=0.0.0.0
PORT=8000

# CORS配置
ALLOWED_ORIGINS=http://localhost:3000,https://your-domain.com
```

### 数据库配置

系统支持PostgreSQL数据库，推荐使用以下配置：

```sql
-- 创建数据库
CREATE DATABASE sms_forwarding_db;

-- 创建用户
CREATE USER sms_user WITH PASSWORD 'your_password';

-- 授权
GRANT ALL PRIVILEGES ON DATABASE sms_forwarding_db TO sms_user;
```

## 📖 使用说明

### 管理员操作

1. **访问管理后台**: `http://localhost:3000`
2. **默认登录**: 用户名 `admin`，密码 `admin123`
3. **设备管理**: 添加和监控Android设备
4. **账号管理**: 创建客户账号和访问链接
5. **规则配置**: 设置短信转发规则
6. **数据监控**: 查看短信接收和转发统计

### 客户端使用

1. **获取访问链接**: 管理员为您提供专属链接
2. **查看短信**: 实时查看接收到的短信
3. **复制验证码**: 一键复制验证码到剪贴板
4. **账号信息**: 查看绑定的账号信息

### Android客户端

Android客户端需要单独开发，主要功能：

- 短信监听和上传
- 设备状态报告
- 心跳保持连接
- 权限管理

## 🔧 开发指南

### 本地开发环境

1. **后端开发**:
   ```bash
   cd backend
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **前端开发**:
   ```bash
   cd frontend
   npm start
   ```

3. **API文档**: 访问 `http://localhost:8000/docs`

### 代码贡献

1. Fork项目
2. 创建功能分支: `git checkout -b feature/new-feature`
3. 提交更改: `git commit -am 'Add new feature'`
4. 推送分支: `git push origin feature/new-feature`
5. 创建Pull Request

### 代码规范

- **Python**: 遵循PEP 8规范
- **TypeScript**: 使用ESLint和Prettier
- **提交信息**: 使用约定式提交格式

## 🐛 故障排除

### 常见问题

#### 1. 数据库连接失败
```bash
# 检查数据库服务状态
sudo systemctl status postgresql

# 检查连接字符串
echo $DATABASE_URL
```

#### 2. 前端构建失败
```bash
# 清除缓存
npm cache clean --force

# 重新安装依赖
rm -rf node_modules package-lock.json
npm install
```

#### 3. Docker构建问题
```bash
# 清理Docker缓存
docker system prune -a

# 重新构建
docker build --no-cache -t sms-forwarding .
```

### 性能优化

- **数据库索引**: 为常用查询字段添加索引
- **缓存策略**: 使用Redis缓存热点数据
- **负载均衡**: 使用Nginx进行负载均衡
- **CDN加速**: 静态资源使用CDN

## 📊 更新日志

### v1.0.0 (2024-12-XX)

#### ✨ 新功能
- 完整的短信转发管理系统
- 多设备管理和监控
- 智能短信分类和规则配置
- 客户端访问页面
- 实时数据更新机制

#### 🔧 技术改进
- 禁用WebSocket连接，消除连接错误
- 优化数据比较算法，提升页面性能
- 添加TypeScript类型检查
- 完善Docker部署配置

#### 🐛 问题修复
- 修复短信页面刷新停顿问题
- 解决WebSocket连接错误
- 优化Railway部署配置
- 修复前端路由问题

## 🤝 贡献者

感谢所有为这个项目做出贡献的开发者！

- [@yduas4900](https://github.com/yduas4900) - 项目创建者和主要维护者

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE)。

## 🙏 致谢

- [FastAPI](https://fastapi.tiangolo.com/) - 现代化的Python Web框架
- [React](https://reactjs.org/) - 用户界面库
- [Ant Design](https://ant.design/) - 企业级UI设计语言
- [Railway](https://railway.app/) - 现代化的部署平台

## 📞 支持与反馈

- **GitHub Issues**: [提交问题](https://github.com/yduas4900/SMS-forwarding/issues)
- **讨论区**: [GitHub Discussions](https://github.com/yduas4900/SMS-forwarding/discussions)
- **邮箱**: your-email@example.com

---

<div align="center">

**如果这个项目对您有帮助，请给个 ⭐ Star 支持一下！**

Made with ❤️ by [yduas4900](https://github.com/yduas4900)

</div>
