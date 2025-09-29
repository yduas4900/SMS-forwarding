#!/usr/bin/env python3
"""
紧急修复登录500错误
Emergency fix for login 500 error
"""

import requests
import json

# 测试API端点
BASE_URL = "https://sms.yduas.edu.pl"

def test_login_endpoints():
    """测试登录端点"""
    print("🚨 紧急修复：测试登录端点...")
    
    # 1. 测试验证码设置
    try:
        response = requests.get(f"{BASE_URL}/api/auth/captcha/settings")
        print(f"验证码设置API: {response.status_code}")
        if response.status_code == 200:
            print("✅ 验证码设置API正常")
        else:
            print(f"❌ 验证码设置API异常: {response.text}")
    except Exception as e:
        print(f"❌ 验证码设置API异常: {e}")
    
    # 2. 获取验证码
    try:
        response = requests.get(f"{BASE_URL}/api/auth/captcha")
        print(f"获取验证码API: {response.status_code}")
        if response.status_code == 200:
            captcha_data = response.json()
            captcha_id = captcha_data.get('captcha_id')
            print(f"✅ 验证码获取成功: {captcha_id}")
            
            # 3. 测试带验证码登录（使用错误验证码）
            print("\n测试错误验证码登录...")
            login_data = {
                "username": "admin",
                "password": "admin123",
                "captcha_id": captcha_id,
                "captcha_code": "WRONG"
            }
            
            response = requests.post(f"{BASE_URL}/api/auth/login-with-captcha", 
                                   json=login_data,
                                   headers={"Content-Type": "application/json"})
            print(f"错误验证码登录: {response.status_code}")
            if response.status_code == 400:
                print("✅ 错误验证码被正确拒绝")
            else:
                print(f"❌ 意外响应: {response.text}")
                
        else:
            print(f"❌ 获取验证码失败: {response.text}")
    except Exception as e:
        print(f"❌ 验证码测试异常: {e}")
    
    # 4. 测试普通登录
    print("\n测试普通登录...")
    try:
        login_data = {
            "username": "admin",
            "password": "admin123"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/login", 
                               json=login_data,
                               headers={"Content-Type": "application/json"})
        print(f"普通登录: {response.status_code}")
        if response.status_code == 200:
            print("✅ 普通登录成功")
        elif response.status_code == 401:
            print("⚠️ 普通登录被拒绝（可能需要验证码）")
        else:
            print(f"❌ 普通登录异常: {response.text}")
    except Exception as e:
        print(f"❌ 普通登录测试异常: {e}")

def diagnose_500_error():
    """诊断500错误"""
    print("\n🔍 诊断500错误原因...")
    
    # 获取新的验证码进行测试
    try:
        response = requests.get(f"{BASE_URL}/api/auth/captcha")
        if response.status_code == 200:
            captcha_data = response.json()
            captcha_id = captcha_data.get('captcha_id')
            
            # 使用正确格式测试登录
            login_data = {
                "username": "admin",
                "password": "admin123",
                "captcha_id": captcha_id,
                "captcha_code": "TEST"  # 使用测试验证码
            }
            
            print(f"测试数据: {json.dumps(login_data, indent=2)}")
            
            response = requests.post(f"{BASE_URL}/api/auth/login-with-captcha", 
                                   json=login_data,
                                   headers={"Content-Type": "application/json"},
                                   timeout=30)
            
            print(f"响应状态码: {response.status_code}")
            print(f"响应头: {dict(response.headers)}")
            
            if response.status_code == 500:
                print("❌ 确认500错误")
                try:
                    error_data = response.json()
                    print(f"错误详情: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"错误文本: {response.text}")
            else:
                print(f"响应内容: {response.text}")
                
    except requests.exceptions.Timeout:
        print("❌ 请求超时")
    except Exception as e:
        print(f"❌ 诊断异常: {e}")

if __name__ == "__main__":
    print("🚨 紧急登录问题诊断开始...")
    test_login_endpoints()
    diagnose_500_error()
    print("\n🚨 诊断完成！")
