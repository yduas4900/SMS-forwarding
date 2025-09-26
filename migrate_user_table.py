#!/usr/bin/env python3
"""
用户表迁移脚本 - 增加密码字段长度
User table migration script - increase password field length
"""

import sys
import os
sys.path.append('backend')

from sqlalchemy import create_engine, text
import logging

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate_user_table():
    """迁移用户表结构"""
    
    # 数据库URL (使用环境变量或默认值)
    database_url = os.getenv('DATABASE_URL', 'postgresql://user:password@localhost:5432/sms_forwarding_db')
    
    # 创建数据库连接
    engine = create_engine(database_url)
    
    try:
        with engine.connect() as conn:
            # 检查当前表结构
            logger.info("检查当前用户表结构...")
            
            result = conn.execute(text("""
                SELECT column_name, data_type, character_maximum_length 
                FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'hashed_password'
            """))
            
            column_info = result.fetchone()
            if column_info:
                logger.info(f"当前密码字段: {column_info[0]}, 类型: {column_info[1]}, 长度: {column_info[2]}")
                
                if column_info[2] and column_info[2] < 500:
                    logger.info("需要增加密码字段长度...")
                    
                    # 修改字段长度
                    conn.execute(text("ALTER TABLE users ALTER COLUMN hashed_password TYPE VARCHAR(500)"))
                    conn.commit()
                    
                    logger.info("密码字段长度已更新为500")
                else:
                    logger.info("密码字段长度已足够")
            else:
                logger.error("未找到密码字段")
                return False
                
        return True
        
    except Exception as e:
        logger.error(f"迁移失败: {str(e)}")
        return False

if __name__ == "__main__":
    success = migrate_user_table()
    if success:
        print("✅ 用户表迁移成功！")
    else:
        print("❌ 用户表迁移失败！")
        sys.exit(1)
