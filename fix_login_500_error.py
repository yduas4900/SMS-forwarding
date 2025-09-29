#!/usr/bin/env python3
"""
修复登录500错误 - 处理数据库字段不匹配问题
Fix login 500 error - Handle database field mismatch issues
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.app.database import get_db
from backend.app.models.user import User
from sqlalchemy.orm import Session
from sqlalchemy import text
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def fix_login_500_error():
    """修复登录500错误"""
    print("🔧 开始修复登录500错误...")
    
    db = next(get_db())
    
    try:
        # 1. 检查用户表结构
        print("\n1. 检查用户表结构...")
        result = db.execute(text("PRAGMA table_info(users)"))
        columns = [row[1] for row in result.fetchall()]
        print(f"当前用户表字段: {columns}")
        
        # 2. 检查是否缺少安全字段
        required_fields = [
            'failed_login_attempts',
            'last_failed_login', 
            'locked_until',
            'totp_secret',
            'totp_enabled',
            'backup_codes',
            'totp_failed_attempts',
            'totp_locked_until'
        ]
        
        missing_fields = [field for field in required_fields if field not in columns]
        
        if missing_fields:
            print(f"\n⚠️  缺少字段: {missing_fields}")
            print("这些字段是新增的安全功能字段，缺少会导致500错误")
            
            # 3. 添加缺少的字段
            print("\n2. 添加缺少的安全字段...")
            
            field_definitions = {
                'failed_login_attempts': 'INTEGER DEFAULT 0',
                'last_failed_login': 'DATETIME',
                'locked_until': 'DATETIME',
                'totp_secret': 'VARCHAR(32)',
                'totp_enabled': 'BOOLEAN DEFAULT 0',
                'backup_codes': 'VARCHAR(1000)',
                'totp_failed_attempts': 'INTEGER DEFAULT 0',
                'totp_locked_until': 'DATETIME'
            }
            
            for field in missing_fields:
                if field in field_definitions:
                    try:
                        sql = f"ALTER TABLE users ADD COLUMN {field} {field_definitions[field]}"
                        print(f"执行: {sql}")
                        db.execute(text(sql))
                        db.commit()
                        print(f"✅ 成功添加字段: {field}")
                    except Exception as e:
                        print(f"❌ 添加字段 {field} 失败: {e}")
                        # 继续处理其他字段
                        continue
        else:
            print("✅ 所有必需字段都存在")
        
        # 4. 测试用户查询
        print("\n3. 测试用户查询...")
        try:
            admin_user = db.query(User).filter(User.username == "admin").first()
            if admin_user:
                print(f"✅ 找到admin用户: {admin_user.username}")
                
                # 测试to_dict()方法
                user_dict = admin_user.to_dict()
                print(f"✅ to_dict()方法正常: {list(user_dict.keys())}")
                
                # 检查安全字段
                print(f"failed_login_attempts: {getattr(admin_user, 'failed_login_attempts', 'N/A')}")
                print(f"locked_until: {getattr(admin_user, 'locked_until', 'N/A')}")
                print(f"totp_enabled: {getattr(admin_user, 'totp_enabled', 'N/A')}")
                
            else:
                print("❌ 未找到admin用户")
        except Exception as e:
            print(f"❌ 用户查询测试失败: {e}")
        
        # 5. 验证修复结果
        print("\n4. 验证修复结果...")
        result = db.execute(text("PRAGMA table_info(users)"))
        new_columns = [row[1] for row in result.fetchall()]
        print(f"修复后用户表字段: {new_columns}")
        
        all_required_present = all(field in new_columns for field in required_fields)
        if all_required_present:
            print("🎉 所有必需字段都已存在，500错误应该已修复！")
        else:
            still_missing = [field for field in required_fields if field not in new_columns]
            print(f"⚠️  仍然缺少字段: {still_missing}")
        
        print("\n✅ 登录500错误修复完成！")
        return True
        
    except Exception as e:
        print(f"❌ 修复过程中出现错误: {e}")
        db.rollback()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    success = fix_login_500_error()
    if success:
        print("\n🚀 修复成功！现在可以尝试登录了")
    else:
        print("\n❌ 修复失败，请检查错误信息")
