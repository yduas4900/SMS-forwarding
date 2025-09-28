#!/usr/bin/env python3
"""
强制重新初始化系统设置
Force reinitialize system settings
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.app.database import get_database_url
from backend.app.services.settings_service import SettingsService
from backend.app.models.settings import SystemSettings

def force_reinitialize_settings():
    """强制重新初始化所有系统设置"""
    try:
        # 创建数据库连接
        database_url = get_database_url()
        engine = create_engine(database_url)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        print("🔄 开始强制重新初始化系统设置...")
        
        # 删除所有现有设置
        deleted_count = db.query(SystemSettings).delete()
        db.commit()
        print(f"✅ 已删除 {deleted_count} 个现有设置")
        
        # 重新初始化默认设置
        SettingsService.initialize_default_settings(db)
        print("✅ 默认设置重新初始化完成")
        
        # 验证设置
        all_settings = SettingsService.get_all_settings(db)
        print(f"✅ 当前设置数量: {len(all_settings)}")
        
        # 显示关键设置
        key_settings = ['systemName', 'systemVersion', 'systemDescription']
        print("\n📋 关键设置值:")
        for key in key_settings:
            value = all_settings.get(key, "未设置")
            print(f"  {key}: {value}")
        
        db.close()
        print("\n🎉 系统设置强制重新初始化完成！")
        return True
        
    except Exception as e:
        print(f"❌ 强制重新初始化失败: {str(e)}")
        return False

if __name__ == "__main__":
    success = force_reinitialize_settings()
    sys.exit(0 if success else 1)
