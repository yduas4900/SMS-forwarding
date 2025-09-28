#!/usr/bin/env python3
"""
强制更新系统设置到数据库
Force update system settings to database
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from backend.app.models.settings import SystemSettings
from backend.app.database import get_database_url
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def force_update_system_settings():
    """强制更新系统设置"""
    try:
        # 创建数据库连接
        database_url = get_database_url()
        engine = create_engine(database_url)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        # 要强制更新的设置
        force_updates = {
            "systemName": "SMS转发管理系统",
            "systemDescription": "专业的短信转发和验证码管理平台，支持多设备接入、智能验证码识别和客户端自定义设置",
            "systemVersion": "v2.0.0"
        }
        
        logger.info("🔧 开始强制更新系统设置...")
        
        for key, value in force_updates.items():
            try:
                # 查找现有记录
                setting = db.query(SystemSettings).filter(SystemSettings.setting_key == key).first()
                
                if setting:
                    # 更新现有记录
                    old_value = setting.get_value()
                    setting.set_value(value)
                    db.commit()
                    logger.info(f"✅ 更新 {key}: '{old_value}' → '{value}'")
                else:
                    # 创建新记录
                    new_setting = SystemSettings(
                        setting_key=key,
                        setting_type="string",
                        description=f"系统{key.replace('system', '').lower()}"
                    )
                    new_setting.set_value(value)
                    db.add(new_setting)
                    db.commit()
                    logger.info(f"✅ 创建 {key}: '{value}'")
                    
            except Exception as e:
                logger.error(f"❌ 更新 {key} 失败: {str(e)}")
                db.rollback()
        
        # 验证更新结果
        logger.info("\n📋 验证更新结果:")
        for key in force_updates.keys():
            setting = db.query(SystemSettings).filter(SystemSettings.setting_key == key).first()
            if setting:
                current_value = setting.get_value()
                logger.info(f"  {key}: {current_value}")
            else:
                logger.warning(f"  {key}: 未找到记录")
        
        db.close()
        logger.info("\n🎉 系统设置强制更新完成！")
        return True
        
    except Exception as e:
        logger.error(f"❌ 强制更新失败: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 强制更新系统设置脚本")
    print("=" * 50)
    
    success = force_update_system_settings()
    
    if success:
        print("\n✅ 更新成功！请刷新浏览器页面查看效果。")
    else:
        print("\n❌ 更新失败！请检查数据库连接和权限。")
