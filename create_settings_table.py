"""
创建系统设置表的数据库迁移脚本
Database migration script to create system settings table
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from sqlalchemy import create_engine, text
from backend.app.database import DATABASE_URL, Base
from backend.app.models.settings import SystemSettings
from backend.app.services.settings_service import SettingsService
import logging

# 设置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_settings_table():
    """创建设置表并初始化默认数据"""
    try:
        # 创建数据库引擎
        engine = create_engine(DATABASE_URL)
        
        # 创建设置表
        logger.info("正在创建系统设置表...")
        SystemSettings.__table__.create(engine, checkfirst=True)
        logger.info("✅ 系统设置表创建成功")
        
        # 初始化默认设置
        logger.info("正在初始化默认设置...")
        from sqlalchemy.orm import sessionmaker
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        try:
            SettingsService.initialize_default_settings(db)
            logger.info("✅ 默认设置初始化成功")
        finally:
            db.close()
            
        logger.info("🎉 数据库迁移完成！")
        
    except Exception as e:
        logger.error(f"❌ 数据库迁移失败: {str(e)}")
        raise

if __name__ == "__main__":
    create_settings_table()
