#!/usr/bin/env python3
"""
添加用户安全字段到数据库
Add user security fields to database
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.app.database import get_db, engine
from sqlalchemy import text
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def add_user_security_fields():
    """添加用户安全字段到现有的用户表"""
    print("🔧 开始添加用户安全字段...")
    print("=" * 50)
    
    db = next(get_db())
    
    try:
        # 检查字段是否已存在
        check_queries = [
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'failed_login_attempts'",
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_failed_login'",
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'locked_until'"
        ]
        
        fields_to_add = []
        field_names = ['failed_login_attempts', 'last_failed_login', 'locked_until']
        
        for i, query in enumerate(check_queries):
            result = db.execute(text(query)).fetchone()
            if not result:
                fields_to_add.append(field_names[i])
                print(f"❌ 字段 {field_names[i]} 不存在，需要添加")
            else:
                print(f"✅ 字段 {field_names[i]} 已存在")
        
        if not fields_to_add:
            print("🎉 所有安全字段都已存在，无需添加")
            return True
        
        # 添加缺失的字段
        alter_queries = []
        
        if 'failed_login_attempts' in fields_to_add:
            alter_queries.append(
                "ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0 COMMENT '登录失败次数'"
            )
        
        if 'last_failed_login' in fields_to_add:
            alter_queries.append(
                "ALTER TABLE users ADD COLUMN last_failed_login TIMESTAMP WITH TIME ZONE COMMENT '最后失败登录时间'"
            )
        
        if 'locked_until' in fields_to_add:
            alter_queries.append(
                "ALTER TABLE users ADD COLUMN locked_until TIMESTAMP WITH TIME ZONE COMMENT '锁定到期时间'"
            )
        
        # 执行ALTER TABLE语句
        for query in alter_queries:
            print(f"🔧 执行: {query}")
            db.execute(text(query))
        
        db.commit()
        
        print("\n🎉 用户安全字段添加完成！")
        print("现在支持以下安全功能：")
        print("- ✅ 登录失败次数限制")
        print("- ✅ 账户锁定功能")
        print("- ✅ 锁定时间跟踪")
        
        # 验证字段是否添加成功
        print("\n🔍 验证字段添加结果...")
        for field_name in field_names:
            result = db.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = '{field_name}'")).fetchone()
            if result:
                print(f"✅ {field_name}: 添加成功")
            else:
                print(f"❌ {field_name}: 添加失败")
        
        return True
        
    except Exception as e:
        print(f"❌ 添加用户安全字段失败: {e}")
        db.rollback()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    success = add_user_security_fields()
    if success:
        print("\n🎉 数据库迁移成功！现在登录失败次数限制功能将正常工作！")
    else:
        print("\n❌ 数据库迁移失败！请检查错误信息并重试。")
