# Railway部署用的多阶段Dockerfile - 修复版本
FROM node:18-alpine as frontend-build

# 设置构建环境变量
ENV CI=false
ENV NODE_ENV=production

# 构建管理端前端
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN echo "📦 安装前端依赖..." && npm ci --only=production --silent
COPY frontend/ ./
RUN echo "🔨 开始构建管理端前端..." && \
    npm run build && \
    echo "✅ 管理端构建完成" && \
    ls -la build/ && \
    echo "📁 构建文件数量: $(find build -type f | wc -l)"

# 构建客户端
WORKDIR /app/customer-site
COPY customer-site/package*.json ./
RUN echo "📦 安装客户端依赖..." && npm ci --only=production --silent
COPY customer-site/ ./
RUN echo "🔨 开始构建客户端..." && \
    npm run build && \
    echo "✅ 客户端构建完成" && \
    ls -la build/ && \
    echo "📁 构建文件数量: $(find build -type f | wc -l)"

# Python后端阶段
FROM python:3.11-slim as backend

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 复制并安装Python依赖
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端代码
COPY backend/ ./

# 从前端构建阶段复制构建结果
COPY --from=frontend-build /app/frontend/build ./static/admin
COPY --from=frontend-build /app/customer-site/build ./static/customer

# 验证静态文件复制
RUN echo "🔍 验证静态文件复制..." && \
    echo "管理端静态文件:" && ls -la static/admin/ && \
    echo "客户端静态文件:" && ls -la static/customer/ && \
    echo "管理端文件数量: $(find static/admin -type f | wc -l)" && \
    echo "客户端文件数量: $(find static/customer -type f | wc -l)" && \
    echo "index.html存在检查:" && \
    ls -la static/admin/index.html && \
    ls -la static/customer/index.html

# 创建必要目录
RUN mkdir -p /app/uploads

# 复制启动脚本
COPY start.sh ./
RUN chmod +x start.sh

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["./start.sh"]
