#!/bin/bash

# Railway部署启动脚本

echo "开始启动手机信息管理系统..."

# 等待数据库连接
echo "等待数据库连接..."
python -c "
import time
import psycopg2
import os
from urllib.parse import urlparse

# 从环境变量获取数据库URL
database_url = os.getenv('DATABASE_URL', 'postgresql://xianyu_user:xianyu_password@localhost:5432/xianyu_db')
parsed = urlparse(database_url)

max_retries = 30
retry_count = 0

while retry_count < max_retries:
    try:
        conn = psycopg2.connect(
            host=parsed.hostname,
            port=parsed.port or 5432,
            user=parsed.username,
            password=parsed.password,
            database=parsed.path[1:]  # 去掉开头的 /
        )
        conn.close()
        print('数据库连接成功!')
        break
    except Exception as e:
        retry_count += 1
        print(f'数据库连接失败 ({retry_count}/{max_retries}): {e}')
        time.sleep(2)

if retry_count >= max_retries:
    print('数据库连接超时，退出...')
    exit(1)
"

# 创建上传目录
mkdir -p /app/uploads

# 启动应用
echo "启动FastAPI应用..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
