"""
管理员专用API - 数据库迁移和维护
Admin-only APIs for database migration and maintenance
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, timezone
import logging

from ..database import get_db
from ..models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/migrate-user-security-fields")
async def migrate_user_security_fields(db: Session = Depends(get_db)):
    """
    添加用户安全字段到数据库（无需认证的紧急迁移API）
    Add user security fields to database (emergency migration API without auth)
    """
    try:
        logger.info("🔧 开始执行用户安全字段迁移...")
        
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
                logger.info(f"❌ 字段 {field_names[i]} 不存在，需要添加")
            else:
                logger.info(f"✅ 字段 {field_names[i]} 已存在")
        
        if not fields_to_add:
            logger.info("🎉 所有安全字段都已存在，无需添加")
            return {
                "success": True,
                "message": "所有安全字段都已存在，无需添加",
                "fields_added": [],
                "existing_fields": field_names
            }
        
        # 添加缺失的字段
        alter_queries = []
        
        if 'failed_login_attempts' in fields_to_add:
            alter_queries.append(
                "ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0"
            )
        
        if 'last_failed_login' in fields_to_add:
            alter_queries.append(
                "ALTER TABLE users ADD COLUMN last_failed_login TIMESTAMP WITH TIME ZONE"
            )
        
        if 'locked_until' in fields_to_add:
            alter_queries.append(
                "ALTER TABLE users ADD COLUMN locked_until TIMESTAMP WITH TIME ZONE"
            )
        
        # 执行ALTER TABLE语句
        for query in alter_queries:
            logger.info(f"🔧 执行: {query}")
            db.execute(text(query))
        
        db.commit()
        
        logger.info("🎉 用户安全字段添加完成！")
        
        # 验证字段是否添加成功
        verification_results = {}
        for field_name in field_names:
            result = db.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = '{field_name}'")).fetchone()
            verification_results[field_name] = bool(result)
            if result:
                logger.info(f"✅ {field_name}: 添加成功")
            else:
                logger.error(f"❌ {field_name}: 添加失败")
        
        return {
            "success": True,
            "message": "用户安全字段迁移完成",
            "fields_added": fields_to_add,
            "verification_results": verification_results,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ 添加用户安全字段失败: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"数据库迁移失败: {str(e)}"
        )

@router.get("/check-user-security-fields")
async def check_user_security_fields(db: Session = Depends(get_db)):
    """
    检查用户安全字段是否存在
    Check if user security fields exist
    """
    try:
        field_names = ['failed_login_attempts', 'last_failed_login', 'locked_until']
        field_status = {}
        
        for field_name in field_names:
            result = db.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = '{field_name}'")).fetchone()
            field_status[field_name] = bool(result)
        
        all_fields_exist = all(field_status.values())
        
        return {
            "success": True,
            "all_fields_exist": all_fields_exist,
            "field_status": field_status,
            "message": "所有安全字段都存在" if all_fields_exist else "部分安全字段缺失"
        }
        
    except Exception as e:
        logger.error(f"检查用户安全字段失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"检查失败: {str(e)}"
        )

@router.get("/database-info")
async def get_database_info(db: Session = Depends(get_db)):
    """
    获取数据库信息
    Get database information
    """
    try:
        # 获取用户表结构
        result = db.execute(text("""
            SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default
            FROM information_schema.columns 
            WHERE table_name = 'users'
            ORDER BY ordinal_position
        """)).fetchall()
        
        columns = []
        for row in result:
            columns.append({
                "column_name": row[0],
                "data_type": row[1],
                "is_nullable": row[2],
                "column_default": row[3]
            })
        
        return {
            "success": True,
            "table_name": "users",
            "columns": columns,
            "total_columns": len(columns)
        }
        
    except Exception as e:
        logger.error(f"获取数据库信息失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取数据库信息失败: {str(e)}"
        )
