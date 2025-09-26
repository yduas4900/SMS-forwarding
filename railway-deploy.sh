#!/bin/bash

# Railway部署前的数据库迁移脚本
echo "🚀 Railway部署 - 数据库迁移脚本"

# 检查数据库连接
echo "📋 检查数据库连接..."
python -c "
import os
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError

try:
    engine = create_engine(os.environ.get('DATABASE_URL'))
    with engine.connect() as conn:
        result = conn.execute('SELECT 1')
        print('✅ 数据库连接成功')
except OperationalError as e:
    print(f'❌ 数据库连接失败: {e}')
    exit(1)
except Exception as e:
    print(f'❌ 未知错误: {e}')
    exit(1)
"

# 运行数据库初始化
echo "🗄️ 初始化数据库表..."
python -c "
import sys
sys.path.append('/app')
from app.database import init_database
init_database()
print('✅ 数据库表初始化完成')
"

echo "✅ 数据库迁移完成，准备启动应用..."
