#!/usr/bin/env python3
"""
重置管理员密码脚本
Reset admin password script
"""

import sys
import os
sys.path.append('backend')

from passlib.context import CryptContext
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import logging

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 创建密码加密上下文
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def reset_admin_password():
    """重置管理员密码"""
    
    # 数据库URL (使用环境变量或默认值)
    database_url = os.getenv('DATABASE_URL', 'postgresql://user:password@localhost:5432/sms_forwarding_db')
    
    # 创建数据库连接
    engine = create_engine(database_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    db = SessionLocal()
    
    try:
        # 生成新的密码哈希
        password = "admin123"
        hashed_password = pwd_context.hash(password)
        
        logger.info(f"生成的密码哈希: {hashed_password}")
        logger.info(f"哈希长度: {len(hashed_password)}")
        
        # 验证哈希是否正确
        is_valid = pwd_context.verify(password, hashed_password)
        logger.info(f"哈希验证结果: {is_valid}")
        
        if not is_valid:
            logger.error("生成的哈希验证失败！")
            return False
        
        # 检查admin用户是否存在
        result = db.execute(text("SELECT id, username, hashed_password FROM users WHERE username = 'admin'"))
        admin_user = result.fetchone()
        
        if admin_user:
            logger.info(f"找到admin用户: ID={admin_user[0]}")
            logger.info(f"当前哈希: {admin_user[2]}")
            logger.info(f"当前哈希长度: {len(admin_user[2])}")
            
            # 更新密码
            db.execute(text("""
                UPDATE users 
                SET hashed_password = :hashed_password, updated_at = NOW()
                WHERE username = 'admin'
            """), {"hashed_password": hashed_password})
            
            db.commit()
            logger.info("管理员密码重置成功！")
            
            # 验证更新后的密码
            result = db.execute(text("SELECT hashed_password FROM users WHERE username = 'admin'"))
            updated_hash = result.fetchone()[0]
            logger.info(f"更新后的哈希: {updated_hash}")
            logger.info(f"更新后哈希长度: {len(updated_hash)}")
            
            # 验证更新后的哈希
            final_check = pwd_context.verify(password, updated_hash)
            logger.info(f"最终验证结果: {final_check}")
            
            return final_check
            
        else:
            logger.error("未找到admin用户！")
            return False
            
    except Exception as e:
        logger.error(f"重置密码失败: {str(e)}")
        db.rollback()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    success = reset_admin_password()
    if success:
        print("✅ 管理员密码重置成功！")
        print("用户名: admin")
        print("密码: admin123")
    else:
        print("❌ 管理员密码重置失败！")
        sys.exit(1)
