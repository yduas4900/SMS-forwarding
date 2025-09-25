# 最终修复版本 - 确保所有依赖正确安装
FROM node:16-alpine as build

WORKDIR /app

# 设置npm配置
RUN npm config set registry https://registry.npmjs.org/

# 构建前端
COPY frontend/ ./frontend/
WORKDIR /app/frontend
RUN npm install
RUN npm run build

# 构建客户端
WORKDIR /app
COPY customer-site/ ./customer-site/
WORKDIR /app/customer-site
RUN npm install
RUN npm run build

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
COPY --from=build /app/frontend/build ./static/admin
COPY --from=build /app/customer-site/build ./static/customer

# 创建必要目录
RUN mkdir -p uploads

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
