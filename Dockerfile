# Railway部署用的多阶段Dockerfile
# 这个文件用于在Railway平台上部署整个应用

FROM node:18-alpine as frontend-build

# 构建管理端前端
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --only=production
COPY frontend/ ./
RUN npm run build

# 构建客户端
WORKDIR /app/customer-site
COPY customer-site/package*.json ./
RUN npm ci --only=production
COPY customer-site/ ./
RUN npm run build

# Python后端阶段
FROM python:3.11-slim as backend

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# 复制并安装Python依赖
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端代码
COPY backend/ ./

# 从前端构建阶段复制构建结果
COPY --from=frontend-build /app/frontend/build ./static/admin
COPY --from=frontend-build /app/customer-site/build ./static/customer

# 创建必要目录
RUN mkdir -p /app/uploads

# 暴露端口
EXPOSE 8000

# 复制启动脚本
COPY start.sh ./
RUN chmod +x start.sh

# 启动命令
CMD ["./start.sh"]
