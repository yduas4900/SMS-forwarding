#!/usr/bin/env python3
"""
通过API修复系统设置
Fix system settings via API calls
"""

import requests
import json

def fix_system_settings():
    """通过API修复系统设置"""
    
    # 假设你的应用运行在本地或已部署的URL
    base_url = "http://localhost:8000"  # 根据实际情况修改
    
    # 这里需要有效的认证token
    # 你需要先登录获取token，或者使用现有的token
    token = "your-auth-token-here"  # 需要替换为实际的token
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # 要更新的设置
    settings_data = {
        "systemName": "SMS转发管理系统",
        "systemDescription": "专业的短信转发和验证码管理平台，支持多设备接入、智能验证码识别和客户端自定义设置",
        "systemVersion": "v2.0.0",
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
        "customerSiteWelcomeText": "<h2>欢迎使用验证码获取服务</h2><p>请按照以下步骤获取您的验证码：</p><ol><li>复制用户名和密码</li><li>点击获取验证码按钮</li><li>等待验证码到达</li></ol>",
        "customerSiteFooterText": "<p>如有问题，请联系客服。</p>",
        "customerSiteBackgroundColor": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        "customerSiteCustomCSS": "",
        "enableCustomerSiteCustomization": True
    }
    
    try:
        # 发送POST请求更新设置
        response = requests.post(
            f"{base_url}/api/settings",
            headers=headers,
            json=settings_data
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                print("✅ 系统设置更新成功！")
                print(f"系统名称: {settings_data['systemName']}")
                print(f"系统版本: {settings_data['systemVersion']}")
                print(f"系统描述: {settings_data['systemDescription']}")
                return True
            else:
                print(f"❌ 更新失败: {result.get('message', '未知错误')}")
                return False
        else:
            print(f"❌ HTTP错误: {response.status_code}")
            print(f"响应内容: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ 请求失败: {str(e)}")
        return False

if __name__ == "__main__":
    print("🔧 通过API修复系统设置")
    print("=" * 50)
    print("⚠️  注意：需要先获取有效的认证token并更新脚本中的base_url和token")
    print("💡 建议：直接在浏览器中手动修改系统设置并保存")
    print()
    
    # 显示需要更新的设置值
    print("📋 需要更新的设置值：")
    print("- 系统名称: SMS转发管理系统")
    print("- 系统版本: v2.0.0")
    print("- 系统描述: 专业的短信转发和验证码管理平台...")
    print()
    print("🎯 手动操作步骤：")
    print("1. 在浏览器中打开系统设置页面")
    print("2. 修改系统名称为: SMS转发管理系统")
    print("3. 修改系统版本为: v2.0.0")
    print("4. 修改系统描述为合适的内容")
    print("5. 点击保存设置按钮")
