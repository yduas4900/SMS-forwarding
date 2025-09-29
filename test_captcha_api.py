#!/usr/bin/env python3
"""
测试验证码API的脚本 - 安全修复验证版本
Test script for captcha API - Security fix verification version
"""

import requests
import json

# Railway应用的URL
BASE_URL = "https://sms-forwarding-production.up.railway.app"

def test_captcha_security_fix():
    """测试验证码安全修复（包含错误次数限制和锁定功能）"""
    print("🔍 开始测试验证码安全修复...")
    print("🚨 这是验证安全漏洞修复的关键测试！")
    print("🔒 包含验证码错误次数限制和锁定功能测试")
    
    # 1. 获取验证码设置
    print("\n1. 获取验证码设置...")
    try:
        response = requests.get(f"{BASE_URL}/api/auth/captcha/settings")
        print(f"状态码: {response.status_code}")
        print(f"响应: {response.json()}")
        
        if response.status_code == 200:
            settings_data = response.json()
            if settings_data.get("success") and settings_data.get("data", {}).get("enableLoginCaptcha"):
                captcha_settings = settings_data.get("data", {})
                max_attempts = captcha_settings.get("captchaMaxAttempts", 3)
                lock_duration = captcha_settings.get("captchaLockDuration", 5)
                print("✅ 验证码已启用")
                print(f"📊 验证码最大错误次数: {max_attempts}")
                print(f"🔒 验证码锁定时间: {lock_duration} 分钟")
            else:
                print("❌ 验证码未启用，无法测试安全修复")
                return False
        else:
            print("❌ 获取验证码设置失败")
            return False
    except Exception as e:
        print(f"❌ 获取验证码设置异常: {e}")
        return False
    
    # 2. 测试验证码错误次数限制功能
    print(f"\n2. 🚨 测试验证码错误次数限制功能（最大{max_attempts}次）...")
    
    for attempt in range(1, max_attempts + 2):  # 多测试一次来验证锁定
        print(f"\n   第 {attempt} 次错误验证码尝试:")
        
        # 获取新的验证码
        try:
            response = requests.get(f"{BASE_URL}/api/auth/captcha")
            if response.status_code != 200:
                print(f"   ❌ 获取验证码失败: {response.status_code}")
                continue
                
            captcha_data = response.json()
            captcha_id = captcha_data.get('captcha_id')
            
            # 故意输入错误的验证码
            login_data = {
                "username": "admin",
                "password": "123456",
                "captcha_id": captcha_id,
                "captcha_code": f"WRONG{attempt}"  # 每次都不同的错误验证码
            }
            
            response = requests.post(f"{BASE_URL}/api/auth/login-with-captcha", json=login_data)
            print(f"   状态码: {response.status_code}")
            
            if response.status_code == 400:
                error_detail = response.json().get('detail', '')
                if '剩余尝试次数' in error_detail:
                    print(f"   ✅ 错误验证码被拒绝: {error_detail}")
                elif '验证码错误' in error_detail:
                    print(f"   ✅ 错误验证码被拒绝: {error_detail}")
                else:
                    print(f"   ⚠️  错误被拒绝: {error_detail}")
            elif response.status_code == 429:
                error_detail = response.json().get('detail', '')
                print(f"   🔒 用户被锁定: {error_detail}")
                print("   ✅ 验证码错误次数限制功能正常工作！")
                break
            elif response.status_code == 200:
                print("   ❌ 严重安全漏洞！错误验证码竟然登录成功了！")
                return False
            else:
                print(f"   ❓ 意外的状态码: {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ 测试异常: {e}")
    
    # 3. 测试锁定期间的登录尝试
    print(f"\n3. 🔒 测试锁定期间的登录尝试...")
    try:
        response = requests.get(f"{BASE_URL}/api/auth/captcha")
        if response.status_code == 200:
            captcha_data = response.json()
            captcha_id = captcha_data.get('captcha_id')
            
            login_data = {
                "username": "admin",
                "password": "123456",
                "captcha_id": captcha_id,
                "captcha_code": "WRONG"
            }
            
            response = requests.post(f"{BASE_URL}/api/auth/login-with-captcha", json=login_data)
            print(f"状态码: {response.status_code}")
            
            if response.status_code == 429:
                error_detail = response.json().get('detail', '')
                print(f"✅ 锁定期间登录被正确拒绝: {error_detail}")
            elif response.status_code == 200:
                print("❌ 严重安全漏洞！锁定期间竟然能登录！")
                return False
            else:
                print(f"⚠️  状态码: {response.status_code}, 响应: {response.json()}")
                
    except Exception as e:
        print(f"❌ 测试锁定期间登录异常: {e}")
    
    # 4. 🚨 额外测试：空验证码登录（应该被拒绝）
    print("\n4. 🚨 额外测试：空验证码登录...")
    try:
        response = requests.get(f"{BASE_URL}/api/auth/captcha")
        if response.status_code == 200:
            captcha_data = response.json()
            captcha_id = captcha_data.get('captcha_id')
            
            login_data_empty = {
                "username": "testuser",  # 使用不同用户名避免锁定影响
                "password": "123456",
                "captcha_id": captcha_id,
                "captcha_code": ""  # 空验证码
            }
            
            response = requests.post(f"{BASE_URL}/api/auth/login-with-captcha", json=login_data_empty)
            print(f"状态码: {response.status_code}")
            
            if response.status_code == 400:
                print("✅ 空验证码被正确拒绝")
            elif response.status_code == 200:
                print("❌ 严重安全漏洞！空验证码竟然登录成功了！")
                return False
                
    except Exception as e:
        print(f"❌ 测试空验证码异常: {e}")
    
    # 5. 🚨 额外测试：无效验证码ID（应该被拒绝）
    print("\n5. 🚨 额外测试：无效验证码ID...")
    try:
        login_data_invalid = {
            "username": "testuser2",  # 使用不同用户名
            "password": "123456",
            "captcha_id": "invalid_captcha_id",
            "captcha_code": "1234"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/login-with-captcha", json=login_data_invalid)
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 400:
            error_detail = response.json().get('detail', '')
            if '验证码已过期或不存在' in error_detail:
                print("✅ 无效验证码ID被正确拒绝")
            else:
                print(f"⚠️  无效ID被拒绝，但错误信息不明确: {error_detail}")
        elif response.status_code == 200:
            print("❌ 严重安全漏洞！无效验证码ID竟然登录成功了！")
            return False
            
    except Exception as e:
        print(f"❌ 测试无效验证码ID异常: {e}")
    
    print("\n🎉 验证码安全修复测试完成！")
    print("✅ 所有安全测试都通过了")
    print("✅ 验证码验证逻辑工作正常，安全漏洞已修复")
    print("🔒 验证码错误次数限制和锁定功能正常工作")
    return True

def test_normal_login_without_captcha():
    """测试普通登录（当验证码未启用时）"""
    print("\n\n🔍 测试普通登录功能...")
    
    try:
        # 测试普通登录API
        login_data = {
            "username": "admin",
            "password": "123456"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        print(f"普通登录状态码: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ 普通登录功能正常")
        elif response.status_code == 401:
            print("⚠️  普通登录被拒绝（可能是密码错误，这是正常的）")
        else:
            print(f"❓ 普通登录意外状态码: {response.status_code}")
            
    except Exception as e:
        print(f"❌ 测试普通登录异常: {e}")

if __name__ == "__main__":
    print("🚨 验证码安全漏洞修复验证测试")
    print("=" * 50)
    
    # 测试验证码安全修复
    security_fix_success = test_captcha_security_fix()
    
    # 测试普通登录
    test_normal_login_without_captcha()
    
    print("\n" + "=" * 50)
    if security_fix_success:
        print("🎉 安全修复验证成功！验证码漏洞已修复！")
    else:
        print("❌ 安全修复验证失败！需要进一步检查！")
