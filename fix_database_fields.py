#!/usr/bin/env python3
"""
紧急修复数据库字段问题
Emergency fix for database field issues
"""

import requests
import json

BASE_URL = "https://sms.yduas.edu.pl"

def create_admin_via_api():
    """通过API创建管理员用户"""
    print("🔧 尝试通过API创建/修复管理员用户...")
    
    try:
        # 尝试调用管理员创建API
        admin_data = {
            "username": "admin",
            "password": "admin123",
            "email": "admin@example.com",
            "full_name": "Administrator"
        }
        
        # 检查是否有管理员创建端点
        endpoints_to_try = [
            "/api/admin/create-user",
            "/api/auth/create-admin", 
            "/api/users/create",
            "/api/admin/init"
        ]
        
        for endpoint in endpoints_to_try:
            try:
                response = requests.post(f"{BASE_URL}{endpoint}", 
                                       json=admin_data,
                                       headers={"Content-Type": "application/json"},
                                       timeout=10)
                print(f"尝试 {endpoint}: {response.status_code}")
                if response.status_code in [200, 201]:
                    print(f"✅ 成功通过 {endpoint} 创建管理员")
                    return True
                elif response.status_code != 404:
                    print(f"响应: {response.text}")
            except Exception as e:
                print(f"端点 {endpoint} 异常: {e}")
                
    except Exception as e:
        print(f"❌ API创建管理员失败: {e}")
    
    return False

def test_simple_login():
    """测试简单登录"""
    print("\n🔧 测试简化登录...")
    
    # 尝试不同的登录数据格式
    login_variants = [
        {"username": "admin", "password": "admin123"},
        {"username": "admin", "password": "123456"},  # 可能的默认密码
        {"email": "admin@example.com", "password": "admin123"},
    ]
    
    for i, login_data in enumerate(login_variants, 1):
        try:
            print(f"尝试登录变体 {i}: {login_data}")
            response = requests.post(f"{BASE_URL}/api/auth/login", 
                                   json=login_data,
                                   headers={"Content-Type": "application/json"},
                                   timeout=10)
            
            print(f"状态码: {response.status_code}")
            
            if response.status_code == 200:
                print("✅ 登录成功！")
                result = response.json()
                print(f"用户信息: {result.get('user_info', {})}")
                return True
            elif response.status_code == 401:
                print("⚠️ 认证失败（用户名或密码错误）")
            elif response.status_code == 500:
                print("❌ 服务器内部错误")
                try:
                    error_detail = response.json()
                    print(f"错误详情: {error_detail}")
                except:
                    print(f"错误文本: {response.text}")
            else:
                print(f"其他响应: {response.text}")
                
        except Exception as e:
            print(f"登录测试异常: {e}")
    
    return False

def check_api_health():
    """检查API健康状态"""
    print("\n🔧 检查API健康状态...")
    
    health_endpoints = [
        "/health",
        "/api/health", 
        "/api/status",
        "/",
        "/api/"
    ]
    
    for endpoint in health_endpoints:
        try:
            response = requests.get(f"{BASE_URL}{endpoint}", timeout=5)
            print(f"{endpoint}: {response.status_code}")
            if response.status_code == 200:
                try:
                    data = response.json()
                    print(f"  响应: {data}")
                except:
                    print(f"  文本: {response.text[:100]}...")
        except Exception as e:
            print(f"{endpoint}: 异常 - {e}")

def emergency_database_fix():
    """紧急数据库修复"""
    print("\n🚨 执行紧急数据库修复...")
    
    # 尝试调用数据库修复端点
    fix_endpoints = [
        "/api/admin/fix-database",
        "/api/admin/migrate",
        "/api/admin/init-db",
        "/api/database/migrate"
    ]
    
    for endpoint in fix_endpoints:
        try:
            response = requests.post(f"{BASE_URL}{endpoint}", 
                                   headers={"Content-Type": "application/json"},
                                   timeout=30)
            print(f"修复端点 {endpoint}: {response.status_code}")
            if response.status_code == 200:
                print(f"✅ 数据库修复成功: {response.text}")
                return True
            elif response.status_code != 404:
                print(f"响应: {response.text}")
        except Exception as e:
            print(f"修复端点 {endpoint} 异常: {e}")
    
    return False

if __name__ == "__main__":
    print("🚨 紧急登录修复开始...")
    
    # 1. 检查API健康状态
    check_api_health()
    
    # 2. 尝试数据库修复
    emergency_database_fix()
    
    # 3. 尝试创建管理员
    create_admin_via_api()
    
    # 4. 测试登录
    if test_simple_login():
        print("\n🎉 登录问题已修复！")
    else:
        print("\n❌ 登录问题仍然存在，需要进一步调查")
    
    print("\n🚨 紧急修复完成！")
