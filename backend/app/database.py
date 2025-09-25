"""
数据库连接和会话管理
Database connection and session management
"""

from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from .config import settings
import logging

logger = logging.getLogger(__name__)

# 创建数据库引擎
engine = create_engine(
    settings.database_url,
    poolclass=StaticPool,
    connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {},
    echo=settings.debug
)

# 创建会话工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 创建基础模型类
Base = declarative_base()


def get_db():
    """
    获取数据库会话
    Get database session
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """
    创建所有数据库表
    Create all database tables
    """
    Base.metadata.create_all(bind=engine)


def drop_tables():
    """
    删除所有数据库表 (仅用于开发和测试)
    Drop all database tables (for development and testing only)
    """
    Base.metadata.drop_all(bind=engine)


def init_default_data():
    """
    初始化默认数据
    Initialize default data
    """
    db = SessionLocal()
    try:
        # 检查是否已有管理员用户
        result = db.execute(text("SELECT COUNT(*) FROM users WHERE username = 'admin'"))
        admin_count = result.scalar()
        
        if admin_count == 0:
            logger.info("创建默认管理员用户...")
            # 创建默认管理员用户 (密码: admin123)
            db.execute(text("""
                INSERT INTO users (username, email, hashed_password, is_active, is_superuser, full_name, created_at, updated_at)
                VALUES (
                    'admin',
                    'admin@xianyu.com',
                    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
                    true,
                    true,
                    '系统管理员',
                    NOW(),
                    NOW()
                )
            """))
            logger.info("默认管理员用户创建成功")
        else:
            logger.info("管理员用户已存在，跳过创建")
        
        # 检查是否已有服务类型数据
        result = db.execute(text("SELECT COUNT(*) FROM service_types"))
        service_type_count = result.scalar()
        
        if service_type_count == 0:
            logger.info("创建默认服务类型...")
            # 创建默认服务类型
            db.execute(text("""
                INSERT INTO service_types (name, description, icon, color, is_active, sort_order, created_at, updated_at)
                VALUES 
                    ('微信', '微信账号管理', 'wechat', '#07C160', true, 1, NOW(), NOW()),
                    ('QQ', 'QQ账号管理', 'qq', '#12B7F5', true, 2, NOW(), NOW()),
                    ('支付宝', '支付宝账号管理', 'alipay', '#1677FF', true, 3, NOW(), NOW()),
                    ('淘宝', '淘宝账号管理', 'taobao', '#FF6A00', true, 4, NOW(), NOW()),
                    ('京东', '京东账号管理', 'jd', '#E3101E', true, 5, NOW(), NOW()),
                    ('其他', '其他类型账号', 'other', '#666666', true, 99, NOW(), NOW())
            """))
            logger.info("默认服务类型创建成功")
        else:
            logger.info("服务类型数据已存在，跳过创建")
        
        # 提交事务
        db.commit()
        logger.info("默认数据初始化完成")
        
    except Exception as e:
        logger.error(f"初始化默认数据失败: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()


def init_database():
    """
    完整的数据库初始化
    Complete database initialization
    """
    logger.info("开始数据库初始化...")
    
    # 创建表结构
    create_tables()
    logger.info("数据库表结构创建完成")
    
    # 初始化默认数据
    init_default_data()
    logger.info("数据库初始化完成")
