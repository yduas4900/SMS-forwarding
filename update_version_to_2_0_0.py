#!/usr/bin/env python3
"""
更新系统版本到2.0.0
Update system version to 2.0.0
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from backend.app.database import get_db, init_database
from backend.app.services.settings_service import SettingsService

def update_version():
    """更新系统版本到2.0.0"""
    print("🔄 正在更新系统版本到2.0.0...")
    
    try:
        # 初始化数据库
        init_database()
        
        # 获取数据库会话
        db = next(get_db())
        
        # 更新系统版本相关设置
        version_settings = {
            "systemVersion": "2.0.0",
            "systemName": "SMS转发管理系统", 
            "systemDescription": "专业的短信转发和验证码管理平台，支持多设备接入、智能验证码识别和客户端自定义设置"
        }
        
        print("📝 更新以下设置:")
        for key, value in version_settings.items():
            SettingsService.set_setting(db, key, value, "string")
            print(f"   ✅ {key}: {value}")
        
        # 验证更新结果
        print("\n🔍 验证更新结果:")
        all_settings = SettingsService.get_all_settings(db)
        
        for key in version_settings.keys():
            current_value = all_settings.get(key, "未设置")
            print(f"   📋 {key}: {current_value}")
        
        print("\n🎉 系统版本已成功更新到2.0.0！")
        print("💡 现在您可以在设置页面看到正确的版本信息了。")
        
        return True
        
    except Exception as e:
        print(f"❌ 更新失败: {str(e)}")
        return False
    finally:
        if 'db' in locals():
            db.close()

if __name__ == "__main__":
    print("=" * 60)
    print("🚀 SMS转发系统版本更新工具")
    print("   将系统版本从1.0.0更新到2.0.0")
    print("=" * 60)
    
    success = update_version()
    
    if success:
        print("\n✅ 更新完成！请刷新设置页面查看最新版本信息。")
    else:
        print("\n❌ 更新失败！请检查错误信息并重试。")
