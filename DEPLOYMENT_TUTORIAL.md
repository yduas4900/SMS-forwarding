# 🚀 SMS转发管理系统 - 完整部署教程

## 📋 目录

- [🎯 部署概述](#-部署概述)
- [🔧 环境准备](#-环境准备)
- [🐳 Docker部署](#-docker部署)
- [🚄 Railway云部署](#-railway云部署)
- [🌐 域名配置](#-域名配置)
- [⚙️ 环境变量配置](#️-环境变量配置)
- [🔍 部署验证](#-部署验证)
- [🐛 故障排除](#-故障排除)

## 🎯 部署概述

SMS转发管理系统支持多种部署方式：

| 部署方式 | 适用场景 | 难度 | 成本 |
|---------|---------|------|------|
| **Railway云部署** | 生产环境，快速上线 | ⭐⭐ | 免费额度 |
| **Docker本地部署** | 开发测试，私有部署 | ⭐⭐⭐ | 服务器成本 |
| **VPS手动部署** | 完全控制，定制化 | ⭐⭐⭐⭐ | 服务器成本 |

**推荐部署方式**: Railway云部署（简单、快速、免费）

## 🔧 环境准备

### 必需工具

- **Git**: 版本控制
- **Node.js 18+**: 前端构建
- **Python 3.11+**: 后端运行
- **PostgreSQL 13+**: 数据库
- **Docker**: 容器化部署（可选）

### 账号准备

- **GitHub账号**: 代码托管
- **Railway账号**: 云部署平台
- **Cloudflare账号**: 域名管理（可选）

## 🚄 Railway云部署（推荐）

### 步骤1: 准备GitHub仓库

```bash
# 1. Fork项目到您的GitHub账号
# 访问: https://github.com/yduas4900/SMS-forwarding
# 点击右上角 "Fork" 按钮

# 2. 克隆到本地（可选，用于自定义修改）
git clone https://github.com/YOUR_USERNAME/SMS-forwarding.git
cd SMS-forwarding
```

### 步骤2: 注册Railway账号

1. 访问 [Railway官网](https://railway.app)
2. 点击 "Start a New Project"
3. 使用GitHub账号登录
4. 授权Railway访问您的GitHub仓库

### 步骤3: 创建Railway项目

1. **选择部署方式**:
   - 点击 "Deploy from GitHub repo"
   - 选择您Fork的 `SMS-forwarding` 仓库

2. **添加数据库**:
   - 在项目中点击 "Add Service"
   - 选择 "Database" → "PostgreSQL"
   - Railway会自动创建数据库并提供连接信息

3. **配置环境变量**:
   ```env
   # Railway会自动设置DATABASE_URL，无需手动配置
   
   # 必需配置的环境变量：
   SECRET_KEY=your-super-secret-key-change-this-in-production-min-32-chars
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=30
   DEBUG=false
   
   # CORS配置（部署后获得域名后更新）
   ALLOWED_ORIGINS=https://your-app-name.railway.app
   ```

### 步骤4: 部署配置

Railway会自动检测到项目中的 `railway.json` 配置文件：

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "numReplicas": 1,
    "sleepApplication": false,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### 步骤5: 监控部署过程

1. **查看构建日志**:
   - 在Railway项目页面点击 "Deployments"
   - 查看实时构建日志

2. **常见构建阶段**:
   ```
   ✅ 1. 前端构建 (frontend build)
   ✅ 2. 客户端构建 (customer-site build)  
   ✅ 3. Python环境准备
   ✅ 4. 依赖安装
   ✅ 5. 应用启动
   ```

3. **获取访问域名**:
   - 构建成功后，Railway会提供一个 `.railway.app` 域名
   - 例如: `https://sms-forwarding-production.railway.app`

### 步骤6: 验证部署

1. **访问应用**:
   ```
   管理后台: https://your-app.railway.app
   API文档: https://your-app.railway.app/docs
   健康检查: https://your-app.railway.app/health
   ```

2. **默认登录信息**:
   ```
   用户名: admin
   密码: admin123
   ```

3. **首次登录后务必修改密码**！

## 🌐 域名配置

### 使用Cloudflare配置自定义域名

#### 步骤1: 在Railway添加自定义域名

1. 在Railway项目中点击 "Settings"
2. 找到 "Domains" 部分
3. 点击 "Add Domain"
4. 输入您的域名，如: `sms.yourdomain.com`

#### 步骤2: 配置Cloudflare DNS

1. 登录Cloudflare控制台
2. 选择您的域名
3. 进入 "DNS" 设置
4. 添加CNAME记录:
   ```
   类型: CNAME
   名称: sms (或您想要的子域名)
   目标: your-app-name.railway.app
   代理状态: 已代理（橙色云朵）
   ```

#### 步骤3: 更新环境变量

在Railway中更新CORS配置：
```env
ALLOWED_ORIGINS=https://sms.yourdomain.com,https://your-app-name.railway.app
```

#### 步骤4: 配置SSL证书

Cloudflare会自动处理SSL证书，确保：
1. SSL/TLS模式设置为 "Full (strict)"
2. 启用 "Always Use HTTPS"
3. 启用 "HTTP Strict Transport Security (HSTS)"

## 🐳 Docker部署

### 本地Docker部署

#### 步骤1: 准备环境

```bash
# 克隆项目
git clone https://github.com/yduas4900/SMS-forwarding.git
cd SMS-forwarding

# 创建环境变量文件
cp .env.example .env
```

#### 步骤2: 配置环境变量

编辑 `.env` 文件：
```env
# 数据库配置
DATABASE_URL=postgresql://sms_user:sms_password@db:5432/sms_db

# 安全配置
SECRET_KEY=your-super-secret-key-min-32-characters
DEBUG=false

# 服务器配置
HOST=0.0.0.0
PORT=8000

# CORS配置
ALLOWED_ORIGINS=http://localhost:8000,http://127.0.0.1:8000
```

#### 步骤3: 使用Docker Compose部署

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f app

# 停止服务
docker-compose down
```

#### 步骤4: 单独Docker部署

```bash
# 构建镜像
docker build -t sms-forwarding .

# 启动PostgreSQL数据库
docker run -d \
  --name sms-postgres \
  -e POSTGRES_DB=sms_db \
  -e POSTGRES_USER=sms_user \
  -e POSTGRES_PASSWORD=sms_password \
  -p 5432:5432 \
  postgres:13

# 启动应用
docker run -d \
  --name sms-app \
  --link sms-postgres:db \
  -p 8000:8000 \
  -e DATABASE_URL="postgresql://sms_user:sms_password@db:5432/sms_db" \
  -e SECRET_KEY="your-secret-key" \
  sms-forwarding
```

### VPS服务器部署

#### 系统要求

- **操作系统**: Ubuntu 20.04+ / CentOS 8+ / Debian 11+
- **内存**: 最低2GB，推荐4GB+
- **存储**: 最低20GB
- **网络**: 公网IP，开放80/443端口

#### 步骤1: 服务器准备

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 启动Docker服务
sudo systemctl start docker
sudo systemctl enable docker
```

#### 步骤2: 部署应用

```bash
# 克隆项目
git clone https://github.com/yduas4900/SMS-forwarding.git
cd SMS-forwarding

# 配置环境变量
cp .env.example .env
nano .env  # 编辑配置

# 启动服务
docker-compose up -d

# 配置Nginx反向代理（可选）
sudo apt install nginx
sudo nano /etc/nginx/sites-available/sms-forwarding
```

Nginx配置示例：
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## ⚙️ 环境变量配置详解

### 必需环境变量

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `DATABASE_URL` | 数据库连接字符串 | `postgresql://user:pass@host:5432/db` |
| `SECRET_KEY` | JWT签名密钥（至少32字符） | `your-super-secret-key-min-32-chars` |

### 可选环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `DEBUG` | `false` | 调试模式 |
| `HOST` | `0.0.0.0` | 监听地址 |
| `PORT` | `8000` | 监听端口 |
| `ALGORITHM` | `HS256` | JWT算法 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Token过期时间 |
| `ALLOWED_ORIGINS` | `*` | CORS允许的源 |

### 生产环境安全配置

```env
# 生产环境推荐配置
DEBUG=false
SECRET_KEY=生成一个强密码-至少32个字符-包含数字字母特殊字符
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
ACCESS_TOKEN_EXPIRE_MINUTES=60

# 数据库连接池配置
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
```

## 🔍 部署验证

### 健康检查

```bash
# 检查应用状态
curl https://your-domain.com/health

# 预期响应
{
  "status": "healthy",
  "app_name": "Mobile Information Management System",
  "version": "1.0.0"
}
```

### 功能测试

1. **管理后台访问**:
   - 访问: `https://your-domain.com`
   - 登录: `admin` / `admin123`
   - 检查各个页面是否正常加载

2. **API接口测试**:
   ```bash
   # 测试登录接口
   curl -X POST "https://your-domain.com/api/auth/login" \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"admin123"}'
   ```

3. **数据库连接测试**:
   ```bash
   # 查看设备列表（需要先登录获取token）
   curl -X GET "https://your-domain.com/api/devices" \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

### 性能测试

```bash
# 使用ab进行简单压力测试
ab -n 100 -c 10 https://your-domain.com/health

# 使用curl测试响应时间
curl -w "@curl-format.txt" -o /dev/null -s https://your-domain.com/
```

## 🐛 故障排除

### 常见部署问题

#### 1. Railway部署失败

**问题**: 构建过程中出现错误
```
Error: Failed to build frontend
```

**解决方案**:
```bash
# 检查Node.js版本
node --version  # 需要18+

# 清理缓存重新构建
rm -rf frontend/node_modules frontend/package-lock.json
npm install --legacy-peer-deps
```

#### 2. 数据库连接失败

**问题**: 应用启动时数据库连接错误
```
sqlalchemy.exc.OperationalError: could not connect to server
```

**解决方案**:
```bash
# 检查数据库URL格式
echo $DATABASE_URL

# 测试数据库连接
psql $DATABASE_URL -c "SELECT 1;"

# Railway中检查数据库服务状态
```

#### 3. CORS错误

**问题**: 前端无法访问API
```
Access to fetch at 'https://api.domain.com' from origin 'https://app.domain.com' has been blocked by CORS policy
```

**解决方案**:
```env
# 更新ALLOWED_ORIGINS环境变量
ALLOWED_ORIGINS=https://app.domain.com,https://api.domain.com
```

#### 4. 静态文件404错误

**问题**: 前端页面无法加载
```
GET /static/admin/index.html 404 Not Found
```

**解决方案**:
```bash
# 检查Docker构建是否包含静态文件
docker exec -it container_name ls -la /app/static/

# 重新构建确保静态文件复制
docker build --no-cache -t sms-forwarding .
```

### 日志调试

#### Railway日志查看

1. 在Railway项目页面点击 "Deployments"
2. 选择最新的部署
3. 查看 "Build Logs" 和 "Deploy Logs"

#### Docker日志查看

```bash
# 查看应用日志
docker logs sms-app -f

# 查看数据库日志
docker logs sms-postgres -f

# 查看所有服务日志
docker-compose logs -f
```

#### 应用内日志

```bash
# 进入容器查看日志文件
docker exec -it sms-app bash
tail -f /var/log/app.log
```

### 性能优化

#### 数据库优化

```sql
-- 添加常用查询索引
CREATE INDEX idx_sms_created_at ON sms(created_at);
CREATE INDEX idx_sms_device_id ON sms(device_id);
CREATE INDEX idx_devices_status ON devices(status);
```

#### 应用优化

```python
# 在config.py中调整数据库连接池
DATABASE_POOL_SIZE = 20
DATABASE_MAX_OVERFLOW = 30
```

#### 前端优化

```bash
# 启用生产构建优化
npm run build -- --production

# 启用gzip压缩
# 在Nginx配置中添加
gzip on;
gzip_types text/plain text/css application/json application/javascript;
```

## 📞 获取帮助

如果遇到部署问题，可以通过以下方式获取帮助：

1. **GitHub Issues**: [提交问题](https://github.com/yduas4900/SMS-forwarding/issues)
2. **查看文档**: [项目文档](README.md)
3. **社区讨论**: [GitHub Discussions](https://github.com/yduas4900/SMS-forwarding/discussions)

---

**部署成功后，记得修改默认密码并定期备份数据！**
