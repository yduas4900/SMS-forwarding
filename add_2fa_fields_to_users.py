#!/usr/bin/env python3
"""
添加双因素认证字段到用户表
Add Two-Factor Authentication fields to users table
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from backend.app.database import get_db
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def add_2fa_fields():
    """添加2FA字段到用户表"""
    
    # 要添加的字段
    fields_to_add = [
        {
            'name': 'totp_secret',
            'sql': 'ALTER TABLE users ADD COLUMN totp_secret VARCHAR(32);'
        },
        {
            'name': 'totp_enabled',
            'sql': 'ALTER TABLE users ADD COLUMN totp_enabled BOOLEAN DEFAULT FALSE;'
        },
        {
            'name': 'backup_codes',
            'sql': 'ALTER TABLE users ADD COLUMN backup_codes VARCHAR(1000);'
        },
        {
            'name': 'totp_failed_attempts',
            'sql': 'ALTER TABLE users ADD COLUMN totp_failed_attempts INTEGER DEFAULT 0;'
        },
        {
            'name': 'totp_locked_until',
            'sql': 'ALTER TABLE users ADD COLUMN totp_locked_until TIMESTAMP WITH TIME ZONE;'
        }
    ]
    
    db = next(get_db())
    
    try:
        logger.info("🔐 开始添加双因素认证字段到用户表...")
        
        for field in fields_to_add:
            try:
                # 检查字段是否已存在
                check_sql = """
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = :field_name
                """
                
                result = db.execute(text(check_sql), {"field_name": field['name']}).fetchone()
                
                if result:
                    logger.info(f"✅ 字段 {field['name']} 已存在，跳过")
                    continue
                
                # 添加字段
                logger.info(f"🔧 添加字段: {field['name']}")
                db.execute(text(field['sql']))
                db.commit()
                logger.info(f"✅ 字段 {field['name']} 添加成功")
                
            except Exception as e:
                logger.error(f"❌ 添加字段 {field['name']} 失败: {str(e)}")
                db.rollback()
                # 继续处理其他字段，不要因为一个字段失败就停止
                continue
        
        logger.info("🎉 双因素认证字段添加完成！")
        
        # 验证字段是否添加成功
        logger.info("🔍 验证字段添加结果...")
        for field in fields_to_add:
            check_sql = """
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = :field_name
            """
            
            result = db.execute(text(check_sql), {"field_name": field['name']}).fetchone()
            
            if result:
                logger.info(f"✅ 验证成功: {field['name']} 字段存在")
            else:
                logger.warning(f"⚠️  验证失败: {field['name']} 字段不存在")
        
        logger.info("🎯 数据库迁移完成！现有功能不受影响，2FA功能已准备就绪。")
        
    except Exception as e:
        logger.error(f"❌ 数据库迁移失败: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    try:
        add_2fa_fields()
        print("✅ 双因素认证字段添加成功！")
    except Exception as e:
        print(f"❌ 迁移失败: {str(e)}")
        sys.exit(1)
