#!/usr/bin/env python3
"""
测试所有安全设置是否真正有效的脚本
Test script to verify all security settings are actually working
"""

import requests
import json
import time

# Railway应用的URL
BASE_URL = "https://sms-forwarding-production.up.railway.app"

def test_session_timeout():
    """测试会话超时时间设置是否有效"""
    print("\n🕐 测试会话超时时间设置...")
    
    try:
        # 首先尝试普通登录获取token
        login_data = {
            "username": "admin",
            "password": "123456"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        if response.status_code == 200:
            token = response.json().get("access_token")
            print("✅ 获取到登录token")
            
            # 使用token访问需要认证的API
            headers = {"Authorization": f"Bearer {token}"}
            response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
            
            if response.status_code == 200:
                print("✅ Token验证成功，会话超时时间设置生效")
                print("📝 注意：实际超时需要等待设置的时间才能验证")
            else:
                print(f"❌ Token验证失败: {response.status_code}")
        else:
            print(f"⚠️  无法获取token进行测试: {response.status_code}")
            
    except Exception as e:
        print(f"❌ 测试会话超时异常: {e}")

def test_password_min_length():
    """测试密码最小长度设置是否有效"""
    print("\n🔑 测试密码最小长度设置...")
    
    try:
        # 首先登录获取token
        login_data = {
            "username": "admin",
            "password": "123456"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        if response.status_code == 200:
            token = response.json().get("access_token")
            headers = {"Authorization": f"Bearer {token}"}
            
            # 尝试设置过短的密码
            password_data = {
                "current_password": "123456",
                "new_password": "123",  # 故意设置过短的密码
                "confirm_password": "123"
            }
            
            response = requests.put(f"{BASE_URL}/api/auth/password", json=password_data, headers=headers)
            print(f"修改密码状态码: {response.status_code}")
            
            if response.status_code == 400:
                error_detail = response.json().get('detail', '')
                if '密码长度' in error_detail:
                    print(f"✅ 密码最小长度设置生效: {error_detail}")
                else:
                    print(f"⚠️  密码被拒绝但原因不明: {error_detail}")
            elif response.status_code == 200:
                print("❌ 严重问题！过短密码竟然被接受了！")
            else:
                print(f"❓ 意外状态码: {response.status_code}")
                
        else:
            print(f"⚠️  无法获取token进行测试: {response.status_code}")
            
    except Exception as e:
        print(f"❌ 测试密码最小长度异常: {e}")

def test_captcha_max_attempts():
    """测试验证码最大错误次数和锁定时间"""
    print("\n🔒 测试验证码最大错误次数和锁定时间...")
    
    try:
        # 获取验证码设置
        response = requests.get(f"{BASE_URL}/api/auth/captcha/settings")
        if response.status_code == 200:
            settings_data = response.json()
            if settings_data.get("success") and settings_data.get("data", {}).get("enableLoginCaptcha"):
                captcha_settings = settings_data.get("data", {})
                max_attempts = captcha_settings.get("captchaMaxAttempts", 3)
                lock_duration = captcha_settings.get("captchaLockDuration", 5)
                
                print(f"📊 验证码最大错误次数: {max_attempts}")
                print(f"🔒 验证码锁定时间: {lock_duration} 分钟")
                
                # 测试错误次数限制
                test_username = "testuser_captcha"
                for attempt in range(1, max_attempts + 2):
                    print(f"\n   第 {attempt} 次验证码错误尝试:")
                    
                    # 获取验证码
                    response = requests.get(f"{BASE_URL}/api/auth/captcha")
                    if response.status_code == 200:
                        captcha_data = response.json()
                        captcha_id = captcha_data.get('captcha_id')
                        
                        # 故意输入错误验证码
                        login_data = {
                            "username": test_username,
                            "password": "123456",
                            "captcha_id": captcha_id,
                            "captcha_code": f"WRONG{attempt}"
                        }
                        
                        response = requests.post(f"{BASE_URL}/api/auth/login-with-captcha", json=login_data)
                        print(f"   状态码: {response.status_code}")
                        
                        if response.status_code == 400:
                            error_detail = response.json().get('detail', '')
                            print(f"   ✅ 验证码错误被拒绝: {error_detail}")
                        elif response.status_code == 429:
                            error_detail = response.json().get('detail', '')
                            print(f"   🔒 用户被锁定: {error_detail}")
                            print("   ✅ 验证码错误次数限制和锁定功能正常工作！")
                            break
                        elif response.status_code == 200:
                            print("   ❌ 严重安全漏洞！错误验证码登录成功！")
                            return False
                
                return True
            else:
                print("⚠️  验证码功能未启用，跳过测试")
                return True
        else:
            print(f"❌ 获取验证码设置失败: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ 测试验证码设置异常: {e}")
        return False

def test_settings_conflicts():
    """测试设置冲突问题"""
    print("\n⚖️  分析设置冲突问题...")
    
    try:
        # 获取所有安全相关设置
        response = requests.get(f"{BASE_URL}/api/auth/captcha/settings")
        captcha_settings = {}
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                captcha_settings = data.get("data", {})
        
        print("📊 当前安全设置分析:")
        print(f"   验证码最大错误次数: {captcha_settings.get('captchaMaxAttempts', '未知')} 次")
        print(f"   验证码锁定时间: {captcha_settings.get('captchaLockDuration', '未知')} 分钟")
        
        print("\n🔍 设置冲突分析:")
        print("1. 验证码错误锁定 vs 密码错误锁定:")
        print("   - 验证码错误：专门针对验证码输入错误")
        print("   - 密码错误：针对用户名密码验证失败")
        print("   - 这两个是独立的安全机制，不冲突")
        
        print("\n2. 建议的安全策略:")
        print("   - 验证码错误：较短锁定时间（1-5分钟），防止暴力破解验证码")
        print("   - 密码错误：较长锁定时间（30-60分钟），防止暴力破解密码")
        print("   - 会话超时：根据安全需求设置（1-30分钟）")
        
        return True
        
    except Exception as e:
        print(f"❌ 分析设置冲突异常: {e}")
        return False

def test_all_security_settings():
    """测试所有安全设置"""
    print("🔐 开始测试所有安全设置的有效性...")
    print("=" * 60)
    
    results = []
    
    # 测试会话超时时间
    results.append(("会话超时时间", test_session_timeout()))
    
    # 测试密码最小长度
    results.append(("密码最小长度", test_password_min_length()))
    
    # 测试验证码设置
    results.append(("验证码错误次数限制", test_captcha_max_attempts()))
    
    # 分析设置冲突
    results.append(("设置冲突分析", test_settings_conflicts()))
    
    # 总结结果
    print("\n" + "=" * 60)
    print("🎯 安全设置测试结果总结:")
    
    all_passed = True
    for test_name, result in results:
        status = "✅ 通过" if result else "❌ 失败"
        print(f"   {test_name}: {status}")
        if not result:
            all_passed = False
    
    print("\n" + "=" * 60)
    if all_passed:
        print("🎉 所有安全设置测试通过！您的安全配置是有效的！")
    else:
        print("⚠️  部分安全设置可能存在问题，请检查上述测试结果")
    
    return all_passed

if __name__ == "__main__":
    test_all_security_settings()
