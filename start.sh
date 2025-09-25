#!/bin/bash

# Railway部署启动脚本 - 强制8000端口

echo "🚀 开始启动手机信息管理系统..."

# 强制设置PORT为8000，覆盖Railway的设置
export PORT=8000

echo "📋 检查环境变量..."
echo "PORT: ${PORT} (强制设置为8000)"
echo "DATABASE_URL: ${DATABASE_URL:0:30}..."

# 创建必要目录
echo "📁 创建必要目录..."
mkdir -p /app/uploads

# 启动应用 - 明确指定8000端口
echo "🚀 启动FastAPI应用..."
echo "监听端口: 8000 (强制)"
echo "主机: 0.0.0.0"

# 直接指定端口8000，不依赖环境变量
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level info
