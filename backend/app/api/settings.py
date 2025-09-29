"""
系统设置管理API
System settings management API
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional
import json
import logging

from ..database import get_db
from ..api.auth import get_current_user
from ..models.user import User
from ..services.settings_service import SettingsService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["系统设置"])

class SystemSettingsModel(BaseModel):
    """系统设置模型"""
    # 系统基础设置
    systemName: Optional[str] = Field(default="SMS转发管理系统", description="系统名称")
    systemDescription: Optional[str] = Field(default="专业的短信转发和验证码管理系统", description="系统描述")
    systemVersion: Optional[str] = Field(default="2.0.0", description="系统版本")
    
    # 安全设置
    sessionTimeout: Optional[int] = Field(default=30, ge=1, le=480, description="会话超时时间（分钟）")
    maxLoginAttempts: Optional[int] = Field(default=5, ge=3, le=10, description="最大登录尝试次数")
    loginLockDuration: Optional[int] = Field(default=30, ge=1, le=120, description="登录错误锁定时间（分钟）")
    passwordMinLength: Optional[int] = Field(default=8, ge=6, le=20, description="密码最小长度")
    enableTwoFactor: Optional[bool] = Field(default=False, description="启用双因素认证")
    
    # 🔐 双因素认证设置
    twoFactorMaxAttempts: Optional[int] = Field(default=3, ge=1, le=10, description="2FA最大错误次数")
    twoFactorLockDuration: Optional[int] = Field(default=15, ge=1, le=60, description="2FA错误锁定时间（分钟）")
    twoFactorIssuerName: Optional[str] = Field(default="SMS转发系统", description="2FA发行者名称")
    twoFactorBackupCodesCount: Optional[int] = Field(default=10, ge=5, le=20, description="备用恢复码数量")
    
    # 登录验证码设置
    enableLoginCaptcha: Optional[bool] = Field(default=False, description="启用登录验证码")
    captchaType: Optional[str] = Field(default="mixed", description="验证码类型：number(数字)、letter(字母)、mixed(混合)")
    captchaLength: Optional[int] = Field(default=4, ge=3, le=8, description="验证码长度")
    captchaMaxAttempts: Optional[int] = Field(default=3, ge=1, le=10, description="验证码最大错误次数")
    captchaLockDuration: Optional[int] = Field(default=5, ge=1, le=60, description="验证码错误锁定时间（分钟）")
    captchaDifficulty: Optional[str] = Field(default="medium", description="验证码难度：easy(简单)、medium(中等)、hard(困难)")
    
    # 通知设置
    enableEmailNotification: Optional[bool] = Field(default=True, description="启用邮件通知")
    enableSmsNotification: Optional[bool] = Field(default=False, description="启用短信通知")
    notificationEmail: Optional[str] = Field(default="admin@example.com", description="通知邮箱")
    
    # 数据设置
    dataRetentionDays: Optional[int] = Field(default=90, ge=30, le=365, description="数据保留天数")
    autoBackup: Optional[bool] = Field(default=True, description="启用自动备份")
    backupFrequency: Optional[str] = Field(default="daily", description="备份频率")
    
    # 界面设置
    theme: Optional[str] = Field(default="light", description="主题")
    language: Optional[str] = Field(default="zh-CN", description="语言")
    timezone: Optional[str] = Field(default="Asia/Shanghai", description="时区")
    
    # 客户浏览端设置
    customerSiteTitle: Optional[str] = Field(default="验证码获取服务", description="客户端页面标题")
    customerSiteDescription: Optional[str] = Field(default="安全便捷的验证码获取服务", description="客户端页面描述")
    customerSiteWelcomeText: Optional[str] = Field(default="<h2>欢迎使用验证码获取服务</h2>", description="客户端欢迎文本（支持HTML）")
    customerSiteFooterText: Optional[str] = Field(default="<p>如有问题，请联系客服。</p>", description="客户端页脚文本（支持HTML）")
    customerSiteBackgroundColor: Optional[str] = Field(default="linear-gradient(135deg, #667eea 0%, #764ba2 100%)", description="客户端背景色")
    customerSiteCustomCSS: Optional[str] = Field(default="", description="客户端自定义CSS")
    enableCustomerSiteCustomization: Optional[bool] = Field(default=True, description="启用客户端自定义")

@router.get("", response_model=dict)
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取系统设置
    Get system settings
    """
    try:
        logger.info(f"用户 {current_user.username} 获取系统设置")
        
        # 强制重新初始化默认设置，确保所有设置都存在
        SettingsService.initialize_default_settings(db)
        
        # 从数据库获取所有设置
        settings = SettingsService.get_all_settings(db)
        
        # 从config.py动态获取系统版本（只读）
        from ..config import settings as app_config
        
        # 如果关键设置缺失，使用默认值
        default_values = {
            "systemName": "SMS转发管理系统",
            "systemDescription": "专业的短信转发和验证码管理平台，支持多设备接入、智能验证码识别和客户端自定义设置",
            "systemVersion": app_config.app_version,  # 直接从config.py读取，只读
            "sessionTimeout": 30,
            "maxLoginAttempts": 5,
            "passwordMinLength": 8,
            "enableTwoFactor": False,
            "enableEmailNotification": True,
            "enableSmsNotification": False,
            "notificationEmail": "admin@example.com",
            "dataRetentionDays": 90,
            "autoBackup": True,
            "backupFrequency": "daily",
            "theme": "light",
            "language": "zh-CN",
            "timezone": "Asia/Shanghai",
            "customerSiteTitle": "验证码获取服务",
            "customerSiteDescription": "安全便捷的验证码获取服务",
            "customerSiteWelcomeText": "<h2>欢迎使用验证码获取服务</h2>",
            "customerSiteFooterText": "<p>如有问题，请联系客服。</p>",
            "customerSiteBackgroundColor": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            "customerSiteCustomCSS": "",
            "enableCustomerSiteCustomization": True
        }
        
        # 确保所有必需的设置都有值
        for key, default_value in default_values.items():
            if key not in settings or settings[key] is None:
                settings[key] = default_value
        
        logger.info(f"返回设置数据: systemName={settings.get('systemName')}, systemVersion={settings.get('systemVersion')}")
        
        return {
            "success": True,
            "message": "获取系统设置成功",
            "data": settings
        }
        
    except Exception as e:
        logger.error(f"获取系统设置失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取系统设置失败"
        )

@router.post("", response_model=dict)
async def update_settings(
    settings_data: SystemSettingsModel,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    更新系统设置
    Update system settings
    """
    try:
        logger.info(f"管理员 {current_user.username} 更新系统设置")
        
        # 验证邮箱格式
        if settings_data.enableEmailNotification and not settings_data.notificationEmail:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="启用邮件通知时必须提供通知邮箱"
            )
        
        # 验证备份频率
        valid_frequencies = ["daily", "weekly", "monthly"]
        if settings_data.backupFrequency not in valid_frequencies:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"备份频率必须是以下值之一: {', '.join(valid_frequencies)}"
            )
        
        # 验证主题
        valid_themes = ["light", "dark", "auto"]
        if settings_data.theme not in valid_themes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"主题必须是以下值之一: {', '.join(valid_themes)}"
            )
        
        # 验证语言
        valid_languages = ["zh-CN", "en-US"]
        if settings_data.language not in valid_languages:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"语言必须是以下值之一: {', '.join(valid_languages)}"
            )
        
        # 将设置数据转换为字典并保存到数据库
        settings_dict = settings_data.dict()
        setting_types = {
            "systemName": "string",
            "systemDescription": "string", 
            "systemVersion": "string",
            "sessionTimeout": "integer",
            "maxLoginAttempts": "integer",
            "loginLockDuration": "integer",
            "passwordMinLength": "integer",
            "enableTwoFactor": "boolean",
            # 🔐 双因素认证设置类型
            "twoFactorMaxAttempts": "integer",
            "twoFactorLockDuration": "integer",
            "twoFactorIssuerName": "string",
            "twoFactorBackupCodesCount": "integer",
            "enableLoginCaptcha": "boolean",
            "captchaType": "string",
            "captchaLength": "integer",
            "captchaMaxAttempts": "integer",
            "captchaLockDuration": "integer",
            "captchaDifficulty": "string",
            "enableEmailNotification": "boolean",
            "enableSmsNotification": "boolean",
            "notificationEmail": "string",
            "dataRetentionDays": "integer",
            "autoBackup": "boolean",
            "backupFrequency": "string",
            "theme": "string",
            "language": "string",
            "timezone": "string",
            "customerSiteTitle": "string",
            "customerSiteDescription": "string",
            "customerSiteWelcomeText": "string",
            "customerSiteFooterText": "string",
            "customerSiteBackgroundColor": "string",
            "customerSiteLogoUrl": "string",
            "customerSiteCustomCSS": "string",
            "enableCustomerSiteCustomization": "boolean"
        }
        
        # 保存每个设置到数据库（跳过只读的系统版本）
        for key, value in settings_dict.items():
            if key == "systemVersion":
                # 系统版本是只读的，跳过更新
                logger.info(f"跳过只读设置: {key}")
                continue
            setting_type = setting_types.get(key, "string")
            SettingsService.set_setting(db, key, value, setting_type)
        
        logger.info(f"系统设置更新成功")
        
        return {
            "success": True,
            "message": "系统设置更新成功",
            "data": settings_dict
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新系统设置失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新系统设置失败"
        )

@router.post("/reset", response_model=dict)
async def reset_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    重置系统设置为默认值
    Reset system settings to default values
    """
    try:
        logger.info(f"管理员 {current_user.username} 重置系统设置")
        
        # 重新初始化默认设置
        SettingsService.initialize_default_settings(db)
        settings = SettingsService.get_all_settings(db)
        
        return {
            "success": True,
            "message": "系统设置已重置为默认值",
            "data": settings
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"重置系统设置失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="重置系统设置失败"
        )

@router.get("/export", response_model=dict)
async def export_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    导出系统设置
    Export system settings
    """
    try:
        logger.info(f"管理员 {current_user.username} 导出系统设置")
        
        settings = SettingsService.get_all_settings(db)
        
        return {
            "success": True,
            "message": "系统设置导出成功",
            "data": {
                "settings": settings,
                "export_time": "2024-01-01T12:00:00Z",
                "version": "1.0.0"
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"导出系统设置失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="导出系统设置失败"
        )

@router.post("/import", response_model=dict)
async def import_settings(
    settings_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    导入系统设置
    Import system settings
    """
    try:
        logger.info(f"管理员 {current_user.username} 导入系统设置")
        
        # 验证导入的设置数据
        try:
            imported_settings = SystemSettingsModel(**settings_data.get("settings", {}))
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"导入的设置数据格式不正确: {str(e)}"
            )
        
        # 保存导入的设置到数据库
        settings_dict = imported_settings.dict()
        setting_types = {
            "systemName": "string",
            "systemDescription": "string", 
            "systemVersion": "string",
            "sessionTimeout": "integer",
            "maxLoginAttempts": "integer",
            "passwordMinLength": "integer",
            "enableTwoFactor": "boolean",
            "enableLoginCaptcha": "boolean",
            "captchaType": "string",
            "captchaLength": "integer",
            "captchaMaxAttempts": "integer",
            "captchaLockDuration": "integer",
            "captchaDifficulty": "string",
            "enableEmailNotification": "boolean",
            "enableSmsNotification": "boolean",
            "notificationEmail": "string",
            "dataRetentionDays": "integer",
            "autoBackup": "boolean",
            "backupFrequency": "string",
            "theme": "string",
            "language": "string",
            "timezone": "string",
            "customerSiteTitle": "string",
            "customerSiteDescription": "string",
            "customerSiteWelcomeText": "string",
            "customerSiteFooterText": "string",
            "customerSiteBackgroundColor": "string",
            "customerSiteLogoUrl": "string",
            "customerSiteCustomCSS": "string",
            "enableCustomerSiteCustomization": "boolean"
        }
        
        for key, value in settings_dict.items():
            setting_type = setting_types.get(key, "string")
            SettingsService.set_setting(db, key, value, setting_type)
        
        return {
            "success": True,
            "message": "系统设置导入成功",
            "data": settings_dict
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"导入系统设置失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="导入系统设置失败"
        )

@router.get("/customer-site", response_model=dict)
async def get_customer_site_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取客户端页面设置（需要认证）
    Get customer site settings (authenticated)
    """
    try:
        logger.info(f"用户 {current_user.username} 获取客户端页面设置")
        
        customer_settings = SettingsService.get_customer_site_settings(db)
        
        return {
            "success": True,
            "message": "获取客户端页面设置成功",
            "data": customer_settings
        }
        
    except Exception as e:
        logger.error(f"获取客户端页面设置失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取客户端页面设置失败"
        )

class CustomerSiteSettingsModel(BaseModel):
    """客户端页面设置模型"""
    customerSiteTitle: str = Field(description="客户端页面标题")
    customerSiteDescription: str = Field(description="客户端页面描述")
    customerSiteWelcomeText: str = Field(description="客户端欢迎文本（支持HTML）")
    customerSiteFooterText: str = Field(description="客户端页脚文本（支持HTML）")
    customerSiteBackgroundColor: str = Field(description="客户端背景色")
    customerSiteLogoUrl: Optional[str] = Field(default=None, description="客户端Logo URL")
    customerSiteCustomCSS: str = Field(default="", description="客户端自定义CSS")
    enableCustomerSiteCustomization: bool = Field(description="启用客户端自定义")

@router.post("/customer-site", response_model=dict)
async def update_customer_site_settings(
    customer_settings: CustomerSiteSettingsModel,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    更新客户端页面设置
    Update customer site settings
    """
    try:
        logger.info(f"管理员 {current_user.username} 更新客户端页面设置")
        
        # 更新客户端相关设置到数据库
        success = SettingsService.update_customer_site_settings(db, customer_settings.dict())
        
        if success:
            logger.info(f"客户端页面设置更新成功")
            return {
                "success": True,
                "message": "客户端页面设置更新成功",
                "data": customer_settings.dict()
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="更新客户端页面设置失败"
            )
        
    except Exception as e:
        logger.error(f"更新客户端页面设置失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新客户端页面设置失败"
        )

@router.get("/public", response_model=dict)
async def get_system_settings_public(db: Session = Depends(get_db)):
    """
    获取系统基础设置（公开API，无需认证）
    Get basic system settings (public API, no authentication required)
    """
    try:
        logger.info("公开API获取系统基础设置")
        
        # 强制重新初始化默认设置，确保所有设置都存在
        SettingsService.initialize_default_settings(db)
        
        # 从数据库获取基础系统设置
        settings = SettingsService.get_all_settings(db)
        
        # 只返回公开的基础设置，不包含敏感信息
        public_settings = {
            "systemName": settings.get("systemName", "系统管理"),
            "systemDescription": settings.get("systemDescription", "管理员登录"),
            "systemVersion": settings.get("systemVersion", "1.0.0")
        }
        
        logger.info(f"返回公开设置数据: {public_settings}")
        
        return {
            "success": True,
            "message": "获取系统基础设置成功",
            "data": public_settings
        }
        
    except Exception as e:
        logger.error(f"公开API获取系统基础设置失败: {str(e)}")
        # 返回默认设置而不是错误，确保登录页面始终能正常工作
        default_settings = {
            "systemName": "系统管理",
            "systemDescription": "管理员登录",
            "systemVersion": "1.0.0"
        }
        
        return {
            "success": True,
            "message": "使用默认系统基础设置",
            "data": default_settings
        }

@router.get("/customer-site/public", response_model=dict)
async def get_customer_site_settings_public_new(db: Session = Depends(get_db)):
    """
    获取客户端页面设置（公开API，无需认证）
    Get customer site settings (public API, no authentication required)
    """
    try:
        logger.info("公开API获取客户端页面设置")
        
        # 从数据库获取客户端设置
        customer_settings = SettingsService.get_customer_site_settings(db)
        
        return {
            "success": True,
            "message": "获取客户端页面设置成功",
            "data": customer_settings
        }
        
    except Exception as e:
        logger.error(f"公开API获取客户端页面设置失败: {str(e)}")
        # 返回默认设置而不是错误，确保客户端始终能正常工作
        default_settings = {
            "customerSiteTitle": "验证码获取服务",
            "customerSiteDescription": "安全便捷的验证码获取服务",
            "customerSiteWelcomeText": "<h2>欢迎使用验证码获取服务</h2><p>请按照以下步骤获取您的验证码：</p><ol><li>复制用户名和密码</li><li>点击获取验证码按钮</li><li>等待验证码到达</li></ol>",
            "customerSiteFooterText": "<p>如有问题，请联系客服。</p>",
            "customerSiteBackgroundColor": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            "customerSiteLogoUrl": None,
            "customerSiteCustomCSS": "",
            "enableCustomerSiteCustomization": True
        }
        
        return {
            "success": True,
            "message": "使用默认客户端页面设置",
            "data": default_settings
        }
