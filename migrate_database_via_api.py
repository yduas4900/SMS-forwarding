#!/usr/bin/env python3
"""
通过API执行数据库迁移 - 添加用户安全字段
Execute database migration via API - Add user security fields
"""

import requests
import json

# Railway应用的URL
BASE_URL = "https://sms-forwarding-production.up.railway.app"

def migrate_database():
    """通过API执行数据库迁移"""
    print("🔧 开始通过API执行数据库迁移...")
    print("=" * 50)
    
    try:
        # 调用迁移API
        response = requests.post(f"{BASE_URL}/api/admin/migrate-user-security-fields")
        
        print(f"状态码: {response.status_code}")
        print(f"响应: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                print("✅ 数据库迁移成功！")
                print("现在登录失败次数限制功能将正常工作！")
                return True
            else:
                print(f"❌ 迁移失败: {result.get('message', '未知错误')}")
                return False
        else:
            print(f"❌ API调用失败: HTTP {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ 迁移过程中发生错误: {e}")
        return False

if __name__ == "__main__":
    success = migrate_database()
    if success:
        print("\n🎉 现在您可以测试登录失败次数限制功能了！")
        print("尝试输入错误密码3次，应该会看到账户被锁定的提示。")
    else:
        print("\n❌ 迁移失败，请检查错误信息。")
