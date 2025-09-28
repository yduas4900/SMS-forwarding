#!/usr/bin/env python3
"""
更新系统设置到v2.0.0
Update system settings to v2.0.0
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.app.database import get_database_url
from backend.app.models.settings import SystemSettings
from backend.app.services.settings_service import SettingsService

def update_system_settings():
    """更新系统设置到v2.0.0版本"""
    try:
        # 创建数据库连接
        database_url = get_database_url()
        engine = create_engine(database_url)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        print("🔄 开始更新系统设置...")
        
        # 更新系统基础设置
        updates = {
            "systemName": ("SMS转发管理系统", "系统名称"),
            "systemDescription": ("专业的短信转发和验证码管理平台，支持多设备接入、智能验证码识别和客户端自定义设置", "系统描述"),
            "systemVersion": ("v2.0.0", "系统版本")
        }
        
        for key, (value, description) in updates.items():
            success = SettingsService.set_setting(db, key, value, "string", description)
            if success:
                print(f"✅ 更新 {key}: {value}")
            else:
                print(f"❌ 更新 {key} 失败")
        
        # 确保所有默认设置都存在
        print("\n🔄 检查并初始化默认设置...")
        SettingsService.initialize_default_settings(db)
        
        # 验证更新结果
        print("\n📋 当前系统设置:")
        current_settings = SettingsService.get_all_settings(db)
        for key in ["systemName", "systemDescription", "systemVersion"]:
            if key in current_settings:
                print(f"  {key}: {current_settings[key]}")
        
        db.close()
        print("\n🎉 系统设置更新完成！")
        
    except Exception as e:
        print(f"❌ 更新系统设置失败: {str(e)}")
        return False
    
    return True

if __name__ == "__main__":
    print("📝 SMS转发管理系统 - 系统设置更新工具")
    print("=" * 50)
    
    success = update_system_settings()
    
    if success:
        print("\n✅ 更新完成！现在系统设置页面应该显示正确的信息。")
        print("💡 建议：重启应用服务以确保所有更改生效。")
    else:
        print("\n❌ 更新失败！请检查数据库连接和权限。")
        sys.exit(1)
