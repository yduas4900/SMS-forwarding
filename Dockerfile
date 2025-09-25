# 最简单可靠的构建方案
FROM node:16-alpine as frontend-build

WORKDIR /app

# 构建前端 - 使用更稳定的方法
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci --only=production --no-audit --no-fund

COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# 构建客户端
COPY customer-site/package.json customer-site/package-lock.json ./customer-site/
RUN cd customer-site && npm ci --only=production --no-audit --no-fund

COPY customer-site/ ./customer-site/
RUN cd customer-site && npm run build

# Python后端
FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y gcc libpq-dev && rm -rf /var/lib/apt/lists/*

# 安装Python依赖
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端代码
COPY backend/ ./

# 复制构建的前端文件
COPY --from=frontend-build /app/frontend/build ./static/admin
COPY --from=frontend-build /app/customer-site/build ./static/customer

# 创建必要目录
RUN mkdir -p uploads

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
