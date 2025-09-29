#!/usr/bin/env python3
"""
使用管理员API修复登录问题
Fix login issues using admin APIs
"""

import requests
import json

BASE_URL = "https://sms.yduas.edu.pl"

def fix_database_fields():
    """修复数据库字段"""
    print("🔧 使用管理员API修复数据库字段...")
    
    try:
        # 1. 检查用户安全字段
        print("\n1. 检查用户安全字段...")
        response = requests.get(f"{BASE_URL}/api/admin/check-user-security-fields")
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"检查结果: {json.dumps(result, indent=2)}")
            
            if not result.get("all_fields_exist", False):
                print("❌ 部分安全字段缺失，开始添加...")
                
                # 2. 添加缺失的安全字段
                print("\n2. 添加用户安全字段...")
                response = requests.post(f"{BASE_URL}/api/admin/migrate-user-security-fields")
                print(f"迁移状态码: {response.status_code}")
                
                if response.status_code == 200:
                    result = response.json()
                    print(f"迁移结果: {json.dumps(result, indent=2)}")
                    print("✅ 数据库字段迁移成功！")
                    return True
                else:
                    print(f"❌ 迁移失败: {response.text}")
                    return False
            else:
                print("✅ 所有安全字段都存在")
                return True
        else:
            print(f"❌ 检查字段失败: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ 修复数据库字段异常: {e}")
        return False

def get_database_info():
    """获取数据库信息"""
    print("\n🔍 获取数据库信息...")
    
    try:
        response = requests.get(f"{BASE_URL}/api/admin/database-info")
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ 数据库表结构:")
            for column in result.get("columns", []):
                print(f"  - {column['column_name']}: {column['data_type']} ({'NULL' if column['is_nullable'] == 'YES' else 'NOT NULL'})")
            return True
        else:
            print(f"❌ 获取数据库信息失败: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ 获取数据库信息异常: {e}")
        return False

def unlock_admin_user():
    """解锁管理员用户"""
    print("\n🔓 解锁管理员用户...")
    
    try:
        unlock_data = {"username": "admin"}
        response = requests.post(f"{BASE_URL}/api/admin/unlock-user", 
                               json=unlock_data,
                               headers={"Content-Type": "application/json"})
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"解锁结果: {json.dumps(result, indent=2)}")
            print("✅ 管理员用户解锁成功！")
            return True
        else:
            print(f"❌ 解锁失败: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ 解锁用户异常: {e}")
        return False

def test_login_after_fix():
    """修复后测试登录"""
    print("\n🧪 修复后测试登录...")
    
    try:
        login_data = {
            "username": "admin",
            "password": "admin123"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/login", 
                               json=login_data,
                               headers={"Content-Type": "application/json"})
        print(f"登录状态码: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("🎉 登录成功！")
            print(f"用户信息: {result.get('user_info', {})}")
            return True
        elif response.status_code == 401:
            print("⚠️ 认证失败（用户名或密码错误）")
            return False
        elif response.status_code == 500:
            print("❌ 仍然出现500错误")
            try:
                error_detail = response.json()
                print(f"错误详情: {error_detail}")
            except:
                print(f"错误文本: {response.text}")
            return False
        else:
            print(f"其他响应: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ 测试登录异常: {e}")
        return False

def test_captcha_login_after_fix():
    """修复后测试验证码登录"""
    print("\n🧪 修复后测试验证码登录...")
    
    try:
        # 获取验证码
        response = requests.get(f"{BASE_URL}/api/auth/captcha")
        if response.status_code != 200:
            print("❌ 获取验证码失败")
            return False
            
        captcha_data = response.json()
        captcha_id = captcha_data.get('captcha_id')
        print(f"获取验证码ID: {captcha_id}")
        
        # 使用错误验证码测试（应该被拒绝）
        login_data = {
            "username": "admin",
            "password": "admin123",
            "captcha_id": captcha_id,
            "captcha_code": "WRONG"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/login-with-captcha", 
                               json=login_data,
                               headers={"Content-Type": "application/json"})
        print(f"错误验证码登录状态码: {response.status_code}")
        
        if response.status_code == 400:
            print("✅ 错误验证码被正确拒绝")
            return True
        elif response.status_code == 500:
            print("❌ 验证码登录仍然出现500错误")
            return False
        else:
            print(f"意外响应: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ 测试验证码登录异常: {e}")
        return False

if __name__ == "__main__":
    print("🚨 使用管理员API修复登录问题...")
    
    success_count = 0
    
    # 1. 获取数据库信息
    if get_database_info():
        success_count += 1
    
    # 2. 修复数据库字段
    if fix_database_fields():
        success_count += 1
    
    # 3. 解锁管理员用户
    if unlock_admin_user():
        success_count += 1
    
    # 4. 测试普通登录
    if test_login_after_fix():
        success_count += 1
        print("\n🎉 普通登录修复成功！")
    
    # 5. 测试验证码登录
    if test_captcha_login_after_fix():
        success_count += 1
        print("\n🎉 验证码登录正常工作！")
    
    print(f"\n📊 修复结果: {success_count}/5 项成功")
    
    if success_count >= 4:
        print("🎉 登录问题修复成功！")
    else:
        print("❌ 登录问题仍需进一步调查")
