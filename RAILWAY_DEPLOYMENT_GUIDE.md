# Railway平台部署完整指南

## 📋 项目概述
这是一个SMS转发管理系统，包含：
- **后端**: FastAPI + PostgreSQL
- **管理端前端**: React (Ant Design)
- **客户端前端**: React (Ant Design)
- **部署方式**: Docker多阶段构建

## 🚀 Railway部署步骤

### 第一步：准备Github仓库

#### 1.1 必须上传的文件清单 ⚠️ 重要！
```
根目录文件：
✅ .gitignore
✅ Dockerfile
✅ railway.json
✅ start.sh
✅ railway-deploy.sh
✅ .env.example
✅ init.sql
✅ README.md
✅ RAILWAY_DEPLOYMENT_GUIDE.md (本文件)

后端文件：
✅ backend/
  ✅ requirements.txt
  ✅ app/
    ✅ __init__.py
    ✅ main.py
    ✅ config.py
    ✅ database.py
    ✅ websocket.py
    ✅ api/ (所有API文件)
    ✅ models/ (所有模型文件)
    ✅ services/ (所有服务文件)

前端文件：
✅ frontend/
  ✅ package.json (已配置homepage: "/static/admin")
  ✅ package-lock.json
  ✅ tsconfig.json
  ✅ public/
  ✅ src/ (所有源码文件)

客户端文件：
✅ customer-site/
  ✅ package.json (已配置homepage: "/static/customer")
  ✅ package-lock.json
  ✅ tsconfig.json
  ✅ public/
  ✅ src/ (所有源码文件)

Nginx配置（可选）：
✅ nginx/
  ✅ nginx.conf
```

#### 1.2 Git提交命令
```bash
# 添加所有文件
git add .

# 提交
git commit -m "feat: 完整的Railway部署配置"

# 推送到Github
git push origin main
```

### 第二步：Railway平台部署

#### 2.1 创建Railway项目
1. 访问 [railway.app](https://railway.app)
2. 使用Github账号登录
3. 点击 "New Project"
4. 选择 "Deploy from GitHub repo"
5. 选择您的SMS-forwarding仓库

#### 2.2 配置数据库
1. 在Railway项目中点击 "Add Service"
2. 选择 "Database" → "PostgreSQL"
3. 等待数据库创建完成
4. Railway会自动生成 `DATABASE_URL` 环境变量

#### 2.3 配置环境变量
在Railway项目的Variables标签页中添加以下环境变量：

**必需的环境变量：**
```bash
# 应用配置
APP_NAME=SMS Forwarding System
DEBUG=false

# 安全配置 - 请生成强密码
SECRET_KEY=your-super-secret-key-min-32-characters-long
ACCESS_TOKEN_EXPIRE_MINUTES=30

# CORS配置 - 添加您的域名
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com

# 服务器配置
PORT=8000
HOST=0.0.0.0

# 心跳和验证码配置
HEARTBEAT_INTERVAL=10
OFFLINE_THRESHOLD=30
VERIFICATION_CODE_INTERVAL=10
MAX_VERIFICATION_ATTEMPTS=5
MAX_ACCESS_ATTEMPTS=5
```

**注意：** `DATABASE_URL` 会由Railway自动提供，无需手动设置。

#### 2.4 部署配置
Railway会自动检测到 `railway.json` 配置文件并使用Dockerfile进行构建。

构建过程：
1. 🔨 构建React前端 (管理端)
2. 🔨 构建React前端 (客户端)
3. 🐍 安装Python依赖
4. 📦 复制静态文件
5. 🚀 启动FastAPI应用

### 第三步：域名配置 (Cloudflare)

#### 3.1 获取Railway域名
1. 部署完成后，在Railway项目的Settings → Domains中
2. 点击 "Generate Domain" 获取免费的 `.railway.app` 域名
3. 记录这个域名，例如：`your-app-name.railway.app`

#### 3.2 配置自定义域名
1. 在Railway项目中点击 "Custom Domain"
2. 输入您的域名，例如：`sms.yourdomain.com`
3. Railway会提供CNAME记录值

#### 3.3 Cloudflare DNS配置
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 选择您的域名
3. 进入 "DNS" → "Records"
4. 添加CNAME记录：
   ```
   Type: CNAME
   Name: sms (或您想要的子域名)
   Target: your-app-name.railway.app
   Proxy status: Proxied (橙色云朵)
   TTL: Auto
   ```

#### 3.4 SSL/TLS配置
1. 在Cloudflare中进入 "SSL/TLS" → "Overview"
2. 设置加密模式为 "Full (strict)"
3. 等待SSL证书生效（通常几分钟）

#### 3.5 更新CORS配置
部署完成后，更新Railway环境变量中的 `ALLOWED_ORIGINS`：
```bash
ALLOWED_ORIGINS=https://sms.yourdomain.com,https://www.yourdomain.com,https://your-app-name.railway.app
```

### 第四步：验证部署

#### 4.1 检查服务状态
访问以下URL验证部署：
- 健康检查: `https://sms.yourdomain.com/health`
- API文档: `https://sms.yourdomain.com/docs`
- 管理端: `https://sms.yourdomain.com/`
- 客户端: `https://sms.yourdomain.com/customer/test-link`

#### 4.2 预期响应
健康检查应返回：
```json
{
  "status": "healthy",
  "app_name": "SMS Forwarding System",
  "version": "1.0.0"
}
```

### 第五步：监控和维护

#### 5.1 Railway监控
- 在Railway Dashboard中查看日志
- 监控资源使用情况
- 设置部署通知

#### 5.2 Cloudflare监控
- 使用Cloudflare Analytics监控流量
- 设置安全规则和防火墙
- 配置缓存规则优化性能

## 🔧 故障排除

### 常见问题

#### 1. 构建失败
- 检查 `package.json` 中的依赖版本
- 确保 `tsconfig.json` 配置正确
- 查看Railway构建日志

#### 2. 数据库连接失败
- 确认 `DATABASE_URL` 环境变量存在
- 检查数据库服务是否正常运行
- 验证数据库连接字符串格式

#### 3. 静态文件404
- 确认前端构建成功
- 检查 `homepage` 配置是否正确
- 验证静态文件路径映射

#### 4. CORS错误
- 更新 `ALLOWED_ORIGINS` 环境变量
- 包含所有需要访问的域名
- 确保协议（http/https）正确

### 日志查看
```bash
# Railway CLI (可选安装)
railway logs

# 或在Railway Dashboard中查看实时日志
```

## 📞 技术支持

如果遇到问题：
1. 检查Railway项目日志
2. 验证环境变量配置
3. 确认域名DNS解析
4. 检查Cloudflare SSL状态

## 🎉 部署完成

恭喜！您的SMS转发系统已成功部署到Railway平台。

**访问地址：**
- 主域名: https://sms.yourdomain.com
- 管理端: https://sms.yourdomain.com/
- API文档: https://sms.yourdomain.com/docs
- 健康检查: https://sms.yourdomain.com/health

**下一步：**
1. 创建管理员账号
2. 配置SMS转发规则
3. 测试Android客户端连接
4. 设置监控和备份
