#!/bin/bash

# Railway部署启动脚本 - 简化版本

echo "🚀 开始启动手机信息管理系统..."

# 检查环境变量
echo "📋 检查环境变量..."
echo "PORT: ${PORT:-8000}"
echo "DATABASE_URL: ${DATABASE_URL:0:30}..."

# 创建必要目录
echo "📁 创建必要目录..."
mkdir -p /app/uploads

# 简化启动 - 让FastAPI处理数据库连接
echo "🚀 启动FastAPI应用..."
echo "监听端口: ${PORT:-8000}"
echo "主机: 0.0.0.0"

# 直接启动，让应用内部处理数据库连接
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --log-level info
