```dockerfile
# 简化的Railway部署Dockerfile
FROM node:18-alpine as build

# 设置工作目录
WORKDIR /app

# 复制前端项目
COPY frontend/ ./frontend/
COPY customer-site/ ./customer-site/

# 构建前端项目
RUN cd frontend && \
    npm install --legacy-peer-deps && \
    npm run build

# 构建客户端项目
RUN cd customer-site && \
    npm install --legacy-peer-deps && \
    npm run build

# Python运行时
FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && \
    apt-get install -y gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# 安装Python依赖
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端代码
COPY backend/ ./

# 复制构建的前端文件
COPY --from=build /app/frontend/build ./static/admin
COPY --from=build /app/customer-site/build ./static/customer

# 创建必要目录
RUN mkdir -p uploads

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```
