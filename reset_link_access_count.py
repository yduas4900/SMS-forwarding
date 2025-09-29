#!/usr/bin/env python3
"""
重置链接访问次数脚本
Reset link access count script
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from backend.app.config import settings
from backend.app.models.account_link import AccountLink
from backend.app.database import get_db_engine
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def reset_link_access_count(link_id: str):
    """重置指定链接的访问次数"""
    try:
        # 创建数据库连接
        engine = get_db_engine()
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        # 查找链接
        link = db.query(AccountLink).filter(AccountLink.link_id == link_id).first()
        
        if not link:
            logger.error(f"❌ 链接不存在: {link_id}")
            return False
        
        # 重置访问次数和验证码次数
        old_access_count = link.access_count
        old_verification_count = link.verification_count
        
        link.access_count = 0
        link.verification_count = 0
        link.last_access_time = None
        link.last_verification_time = None
        
        db.commit()
        
        logger.info(f"✅ 链接访问次数重置成功:")
        logger.info(f"   链接ID: {link_id}")
        logger.info(f"   访问次数: {old_access_count} → 0")
        logger.info(f"   验证码次数: {old_verification_count} → 0")
        logger.info(f"   最大访问次数: {link.max_access_count}")
        logger.info(f"   最大验证码次数: {link.max_verification_count}")
        
        db.close()
        return True
        
    except Exception as e:
        logger.error(f"❌ 重置链接访问次数失败: {str(e)}")
        if 'db' in locals():
            db.rollback()
            db.close()
        return False

def reset_all_links():
    """重置所有链接的访问次数"""
    try:
        # 创建数据库连接
        engine = get_db_engine()
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        # 获取所有链接
        links = db.query(AccountLink).all()
        
        if not links:
            logger.info("📭 没有找到任何链接")
            return True
        
        reset_count = 0
        for link in links:
            old_access_count = link.access_count
            old_verification_count = link.verification_count
            
            link.access_count = 0
            link.verification_count = 0
            link.last_access_time = None
            link.last_verification_time = None
            
            logger.info(f"🔄 重置链接: {link.link_id} (访问: {old_access_count}→0, 验证码: {old_verification_count}→0)")
            reset_count += 1
        
        db.commit()
        
        logger.info(f"✅ 成功重置 {reset_count} 个链接的访问次数")
        
        db.close()
        return True
        
    except Exception as e:
        logger.error(f"❌ 重置所有链接访问次数失败: {str(e)}")
        if 'db' in locals():
            db.rollback()
            db.close()
        return False

if __name__ == "__main__":
    print("🔧 链接访问次数重置工具")
    print("=" * 50)
    
    if len(sys.argv) > 1:
        # 重置指定链接
        link_id = sys.argv[1]
        print(f"🎯 重置指定链接: {link_id}")
        
        if reset_link_access_count(link_id):
            print("✅ 重置成功！现在可以重新访问链接了。")
        else:
            print("❌ 重置失败！请检查链接ID是否正确。")
    else:
        # 重置所有链接
        print("🌍 重置所有链接的访问次数")
        confirm = input("⚠️  确认要重置所有链接吗？(y/N): ")
        
        if confirm.lower() in ['y', 'yes']:
            if reset_all_links():
                print("✅ 所有链接重置成功！")
            else:
                print("❌ 重置失败！")
        else:
            print("❌ 操作已取消")
    
    print("\n📋 使用说明:")
    print("  重置指定链接: python reset_link_access_count.py <link_id>")
    print("  重置所有链接: python reset_link_access_count.py")
    print(f"  示例: python reset_link_access_count.py 9ae8d107-3cca-4f6a-bec1-4dda5d79ed57")
