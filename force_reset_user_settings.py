#!/usr/bin/env python3
"""
强制重置用户安全设置
Force reset user security settings to ensure they take effect
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.app.database import get_db
from backend.app.services.settings_service import SettingsService
from backend.app.models.settings import SystemSettings

def force_reset_user_settings():
    """强制重置用户安全设置"""
    print("🚨 强制重置用户安全设置...")
    print("=" * 50)
    
    db = next(get_db())
    
    try:
        # 用户的实际设置（从截图中看到的）
        user_settings = {
            "sessionTimeout": 1,  # 用户设置的1分钟
            "maxLoginAttempts": 5,  # 用户设置的5次
            "passwordMinLength": 6,  # 用户设置的6位
            "enableLoginCaptcha": True,  # 用户启用了验证码
            "captchaMaxAttempts": 3,  # 用户设置的3次
            "captchaLockDuration": 1,  # 用户设置的1分钟
        }
        
        print("🔧 强制设置用户的安全配置...")
        
        for key, value in user_settings.items():
            # 强制更新设置
            success = SettingsService.set_setting(
                db, 
                key, 
                value, 
                "integer" if isinstance(value, int) else "boolean",
                f"用户设置的{key}"
            )
            
            if success:
                print(f"✅ {key} = {value}")
            else:
                print(f"❌ 设置 {key} 失败")
        
        # 验证设置是否生效
        print("\n🔍 验证设置是否生效...")
        for key, expected_value in user_settings.items():
            actual_value = SettingsService.get_setting(db, key)
            if actual_value == expected_value:
                print(f"✅ {key}: {actual_value} (正确)")
            else:
                print(f"❌ {key}: 期望 {expected_value}, 实际 {actual_value} (错误)")
        
        print("\n🎉 用户安全设置强制重置完成！")
        print("现在您的设置应该真正生效了：")
        print("- 会话超时时间: 1分钟")
        print("- 最大登录尝试次数: 5次")
        print("- 密码最小长度: 6位")
        print("- 验证码最大错误次数: 3次")
        print("- 验证码错误锁定时间: 1分钟")
        
    except Exception as e:
        print(f"❌ 强制重置设置失败: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    force_reset_user_settings()
