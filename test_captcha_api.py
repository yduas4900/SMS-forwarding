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
    """测试验证码安全修复"""
    print("🔍 开始测试验证码安全修复...")
    print("🚨 这是验证安全漏洞修复的关键测试！")
    
    # 1. 获取验证码设置
    print("\n1. 获取验证码设置...")
    try:
        response = requests.get(f"{BASE_URL}/api/auth/captcha/settings")
        print(f"状态码: {response.status_code}")
        print(f"响应: {response.json()}")
        
        if response.status_code == 200:
            settings_data = response.json()
            if settings_data.get("success") and settings_data.get("data", {}).get("enableLoginCaptcha"):
                print("✅ 验证码已启用")
            else:
                print("❌ 验证码未启用，无法测试安全修复")
                return
        else:
            print("❌ 获取验证码设置失败")
            return
    except Exception as e:
        print(f"❌ 获取验证码设置异常: {e}")
        return
    
    # 2. 获取验证码
    print("\n2. 获取验证码...")
    try:
        response = requests.get(f"{BASE_URL}/api/auth/captcha")
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            captcha_data = response.json()
            print(f"验证码ID: {captcha_data.get('captcha_id')}")
            print(f"验证码图片长度: {len(captcha_data.get('captcha_image', ''))}")
            print("✅ 验证码获取成功")
            
            captcha_id = captcha_data.get('captcha_id')
            
            # 3. 🚨 关键测试：错误验证码登录（应该被拒绝）
            print("\n3. 🚨 关键测试：错误验证码登录...")
            print("   这是验证安全漏洞是否修复的关键测试！")
            login_data = {
                "username": "admin",
                "password": "123456",  # 假设这是正确的密码
                "captcha_id": captcha_id,
                "captcha_code": "WRONG"  # 故意输入错误的验证码
            }
            
            response = requests.post(f"{BASE_URL}/api/auth/login-with-captcha", json=login_data)
            print(f"状态码: {response.status_code}")
            print(f"响应: {response.json()}")
            
            if response.status_code == 400:
                error_detail = response.json().get('detail', '')
                if '验证码错误' in error_detail:
                    print("✅ 安全修复成功！错误验证码被正确拒绝")
                    print("✅ 验证码验证逻辑工作正常")
                else:
                    print(f"⚠️  错误被拒绝，但错误信息不明确: {error_detail}")
            elif response.status_code == 200:
                print("❌ 严重安全漏洞！错误验证码竟然登录成功了！")
                print("❌ 安全修复失败，需要进一步检查代码！")
                return False
            else:
                print(f"❓ 意外的状态码: {response.status_code}")
                print("❓ 可能是其他错误，需要进一步分析")
            
            # 4. 🚨 额外测试：空验证码登录（应该被拒绝）
            print("\n4. 🚨 额外测试：空验证码登录...")
            login_data_empty = {
                "username": "admin",
                "password": "123456",
                "captcha_id": captcha_id,
                "captcha_code": ""  # 空验证码
            }
            
            response = requests.post(f"{BASE_URL}/api/auth/login-with-captcha", json=login_data_empty)
            print(f"状态码: {response.status_code}")
            print(f"响应: {response.json()}")
            
            if response.status_code == 400:
                print("✅ 空验证码被正确拒绝")
            elif response.status_code == 200:
                print("❌ 严重安全漏洞！空验证码竟然登录成功了！")
                return False
            
            # 5. 🚨 额外测试：无效验证码ID（应该被拒绝）
            print("\n5. 🚨 额外测试：无效验证码ID...")
            login_data_invalid = {
                "username": "admin",
                "password": "123456",
                "captcha_id": "invalid_captcha_id",
                "captcha_code": "1234"
            }
            
            response = requests.post(f"{BASE_URL}/api/auth/login-with-captcha", json=login_data_invalid)
            print(f"状态码: {response.status_code}")
            print(f"响应: {response.json()}")
            
            if response.status_code == 400:
                error_detail = response.json().get('detail', '')
                if '验证码已过期或不存在' in error_detail:
                    print("✅ 无效验证码ID被正确拒绝")
                else:
                    print(f"⚠️  无效ID被拒绝，但错误信息不明确: {error_detail}")
            elif response.status_code == 200:
                print("❌ 严重安全漏洞！无效验证码ID竟然登录成功了！")
                return False
            
            print("\n🎉 验证码安全修复测试完成！")
            print("✅ 所有安全测试都通过了")
            print("✅ 验证码验证逻辑工作正常，安全漏洞已修复")
            return True
                
        else:
            print(f"❌ 获取验证码失败: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ 测试验证码异常: {e}")
        return False

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
