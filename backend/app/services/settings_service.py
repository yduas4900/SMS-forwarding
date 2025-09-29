"""
系统设置服务
System settings service
"""

from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
import json
import logging

from ..models.settings import SystemSettings
from ..database import get_db

logger = logging.getLogger(__name__)

class SettingsService:
    """设置服务类"""
    
    @staticmethod
    def get_setting(db: Session, key: str, default_value: Any = None) -> Any:
        """获取单个设置值"""
        try:
            setting = db.query(SystemSettings).filter(SystemSettings.setting_key == key).first()
            if setting:
                return setting.get_value()
            return default_value
        except Exception as e:
            logger.error(f"获取设置 {key} 失败: {str(e)}")
            return default_value
    
    @staticmethod
    def set_setting(db: Session, key: str, value: Any, setting_type: str = "string", description: str = "") -> bool:
        """设置单个设置值"""
        try:
            setting = db.query(SystemSettings).filter(SystemSettings.setting_key == key).first()
            
            if setting:
                # 更新现有设置
                setting.set_value(value)
                setting.setting_type = setting_type
                if description:
                    setting.description = description
            else:
                # 创建新设置
                setting = SystemSettings(
                    setting_key=key,
                    setting_type=setting_type,
                    description=description
                )
                setting.set_value(value)
                db.add(setting)
            
            db.commit()
            return True
        except Exception as e:
            logger.error(f"设置 {key} 失败: {str(e)}")
            db.rollback()
            return False
    
    @staticmethod
    def get_all_settings(db: Session) -> Dict[str, Any]:
        """获取所有设置"""
        try:
            settings = db.query(SystemSettings).all()
            result = {}
            for setting in settings:
                result[setting.setting_key] = setting.get_value()
            return result
        except Exception as e:
            logger.error(f"获取所有设置失败: {str(e)}")
            return {}
    
    @staticmethod
    def get_customer_site_settings(db: Session) -> Dict[str, Any]:
        """获取客户端页面设置"""
        try:
            customer_keys = [
                "customerSiteTitle",
                "customerSiteDescription", 
                "customerSiteWelcomeText",
                "customerSiteFooterText",
                "customerSiteBackgroundColor",
                "customerSiteLogoUrl",
                "customerSiteCustomCSS",
                "enableCustomerSiteCustomization"
            ]
            
            result = {}
            for key in customer_keys:
                setting = db.query(SystemSettings).filter(SystemSettings.setting_key == key).first()
                if setting:
                    result[key] = setting.get_value()
                else:
                    # 提供默认值
                    default_values = {
                        "customerSiteTitle": "验证码获取服务",
                        "customerSiteDescription": "安全便捷的验证码获取服务",
                        "customerSiteWelcomeText": "<h2>欢迎使用验证码获取服务</h2><p>请按照以下步骤获取您的验证码：</p><ol><li>复制用户名和密码</li><li>点击获取验证码按钮</li><li>等待验证码到达</li></ol>",
                        "customerSiteFooterText": "<p>如有问题，请联系客服。</p>",
                        "customerSiteBackgroundColor": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        "customerSiteLogoUrl": None,
                        "customerSiteCustomCSS": "",
                        "enableCustomerSiteCustomization": True
                    }
                    result[key] = default_values.get(key)
            
            return result
        except Exception as e:
            logger.error(f"获取客户端设置失败: {str(e)}")
            return {}
    
    @staticmethod
    def update_customer_site_settings(db: Session, settings: Dict[str, Any]) -> bool:
        """更新客户端页面设置"""
        try:
            setting_types = {
                "customerSiteTitle": "string",
                "customerSiteDescription": "string",
                "customerSiteWelcomeText": "string",
                "customerSiteFooterText": "string", 
                "customerSiteBackgroundColor": "string",
                "customerSiteLogoUrl": "string",
                "customerSiteCustomCSS": "string",
                "enableCustomerSiteCustomization": "boolean"
            }
            
            descriptions = {
                "customerSiteTitle": "客户端页面标题",
                "customerSiteDescription": "客户端页面描述",
                "customerSiteWelcomeText": "客户端欢迎文本（支持HTML）",
                "customerSiteFooterText": "客户端页脚文本（支持HTML）",
                "customerSiteBackgroundColor": "客户端背景色",
                "customerSiteLogoUrl": "客户端Logo URL",
                "customerSiteCustomCSS": "客户端自定义CSS",
                "enableCustomerSiteCustomization": "启用客户端自定义"
            }
            
            for key, value in settings.items():
                if key in setting_types:
                    SettingsService.set_setting(
                        db, 
                        key, 
                        value, 
                        setting_types[key], 
                        descriptions.get(key, "")
                    )
            
            return True
        except Exception as e:
            logger.error(f"更新客户端设置失败: {str(e)}")
            return False
    
    @staticmethod
    def initialize_default_settings(db: Session):
        """初始化默认设置"""
        try:
            # 从config.py获取当前版本，确保动态更新
            from ..config import settings as app_config
            
            default_settings = {
                # 系统基础设置 - 使用config.py中的动态值
                "systemName": (app_config.app_name, "string", "系统名称"),
                "systemDescription": ("专业的短信转发和验证码管理平台，支持多设备接入、智能验证码识别和客户端自定义设置", "string", "系统描述"),
                "systemVersion": (app_config.app_version, "string", "系统版本"),
                
                # 安全设置
                "sessionTimeout": (30, "integer", "会话超时时间（分钟）"),
                "maxLoginAttempts": (5, "integer", "最大登录尝试次数"),
                "passwordMinLength": (8, "integer", "密码最小长度"),
                "enableTwoFactor": (False, "boolean", "启用双因素认证"),
                
                # 通知设置
                "enableEmailNotification": (True, "boolean", "启用邮件通知"),
                "enableSmsNotification": (False, "boolean", "启用短信通知"),
                "notificationEmail": ("admin@example.com", "string", "通知邮箱"),
                
                # 数据设置
                "dataRetentionDays": (90, "integer", "数据保留天数"),
                "autoBackup": (True, "boolean", "启用自动备份"),
                "backupFrequency": ("daily", "string", "备份频率"),
                
                # 界面设置
                "theme": ("light", "string", "主题"),
                "language": ("zh-CN", "string", "语言"),
                "timezone": ("Asia/Shanghai", "string", "时区"),
                
                # 客户端设置
                "customerSiteTitle": ("验证码获取服务", "string", "客户端页面标题"),
                "customerSiteDescription": ("安全便捷的验证码获取服务", "string", "客户端页面描述"),
                "customerSiteWelcomeText": ("<h2>欢迎使用验证码获取服务</h2><p>请按照以下步骤获取您的验证码：</p><ol><li>复制用户名和密码</li><li>点击获取验证码按钮</li><li>等待验证码到达</li></ol>", "string", "客户端欢迎文本（支持HTML）"),
                "customerSiteFooterText": ("<p>如有问题，请联系客服。</p>", "string", "客户端页脚文本（支持HTML）"),
                "customerSiteBackgroundColor": ("linear-gradient(135deg, #667eea 0%, #764ba2 100%)", "string", "客户端背景色"),
                "customerSiteLogoUrl": (None, "string", "客户端Logo URL"),
                "customerSiteCustomCSS": ("", "string", "客户端自定义CSS"),
                "enableCustomerSiteCustomization": (True, "boolean", "启用客户端自定义"),
            }
            
            for key, (value, setting_type, description) in default_settings.items():
                existing = db.query(SystemSettings).filter(SystemSettings.setting_key == key).first()
                if not existing:
                    # 创建新设置
                    SettingsService.set_setting(db, key, value, setting_type, description)
                elif key in ["systemVersion", "systemName"]:
                    # 强制更新系统版本和名称，确保与config.py同步
                    SettingsService.set_setting(db, key, value, setting_type, description)
                    logger.info(f"强制更新 {key} 为: {value}")
            
            logger.info("默认设置初始化完成")
        except Exception as e:
            logger.error(f"初始化默认设置失败: {str(e)}")
