#!/usr/bin/env python3
"""
添加登录安全字段到用户表
Add login security fields to users table
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from backend.app.database import get_db_engine
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def add_login_security_fields():
    """添加登录安全相关字段"""
    engine = get_db_engine()
    
    # 要添加的字段
    fields_to_add = [
        "failed_login_attempts INTEGER DEFAULT 0",
        "locked_until TIMESTAMP WITH TIME ZONE",
        "last_failed_login TIMESTAMP WITH TIME ZONE"
    ]
    
    try:
        with engine.connect() as connection:
            # 检查表是否存在
            result = connection.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'users'
                );
            """))
            
            if not result.scalar():
                logger.error("❌ users表不存在")
                return False
            
            # 检查字段是否已存在并添加缺失的字段
            for field_def in fields_to_add:
                field_name = field_def.split()[0]
                
                # 检查字段是否存在
                result = connection.execute(text("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_name = 'users' AND column_name = :field_name
                    );
                """), {"field_name": field_name})
                
                if result.scalar():
                    logger.info(f"✅ 字段 {field_name} 已存在，跳过")
                    continue
                
                # 添加字段
                try:
                    alter_sql = f"ALTER TABLE users ADD COLUMN {field_def};"
                    connection.execute(text(alter_sql))
                    connection.commit()
                    logger.info(f"✅ 成功添加字段: {field_name}")
                except Exception as e:
                    logger.error(f"❌ 添加字段 {field_name} 失败: {e}")
                    connection.rollback()
                    return False
            
            # 添加注释
            comments = [
                ("failed_login_attempts", "连续登录失败次数"),
                ("locked_until", "账户锁定到期时间"),
                ("last_failed_login", "最后一次登录失败时间")
            ]
            
            for field_name, comment in comments:
                try:
                    comment_sql = f"COMMENT ON COLUMN users.{field_name} IS '{comment}';"
                    connection.execute(text(comment_sql))
                    connection.commit()
                    logger.info(f"✅ 添加字段注释: {field_name}")
                except Exception as e:
                    logger.warning(f"⚠️  添加字段注释失败 {field_name}: {e}")
            
            logger.info("🎉 登录安全字段添加完成！")
            return True
            
    except Exception as e:
        logger.error(f"❌ 数据库操作失败: {e}")
        return False

def verify_fields():
    """验证字段是否添加成功"""
    engine = get_db_engine()
    
    try:
        with engine.connect() as connection:
            result = connection.execute(text("""
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_name = 'users' 
                AND column_name IN ('failed_login_attempts', 'locked_until', 'last_failed_login')
                ORDER BY column_name;
            """))
            
            fields = result.fetchall()
            
            if len(fields) == 3:
                logger.info("✅ 验证成功，所有登录安全字段都已添加：")
                for field in fields:
                    logger.info(f"   - {field[0]}: {field[1]} (默认值: {field[3]})")
                return True
            else:
                logger.error(f"❌ 验证失败，只找到 {len(fields)} 个字段")
                return False
                
    except Exception as e:
        logger.error(f"❌ 验证失败: {e}")
        return False

if __name__ == "__main__":
    logger.info("🔧 开始添加登录安全字段...")
    
    if add_login_security_fields():
        logger.info("🔍 验证字段添加结果...")
        if verify_fields():
            logger.info("🎉 登录安全字段迁移完成！")
        else:
            logger.error("❌ 字段验证失败")
            sys.exit(1)
    else:
        logger.error("❌ 字段添加失败")
        sys.exit(1)
