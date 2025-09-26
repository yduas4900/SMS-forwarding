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
    from passlib.context import CryptContext
    from .models.user import User
    
    # 创建密码加密上下文
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    db = SessionLocal()
    try:
        # 检查是否已有管理员用户
        admin_user = db.query(User).filter(User.username == 'admin').first()
        
        if not admin_user:
            logger.info("创建默认管理员用户...")
            
            # 生成admin123的正确哈希
            password = "admin123"
            hashed_password = pwd_context.hash(password)
            
            logger.info(f"生成的密码哈希: {hashed_password}")
            logger.info(f"哈希长度: {len(hashed_password)}")
            
            # 验证哈希是否正确
            is_valid = pwd_context.verify(password, hashed_password)
            logger.info(f"哈希验证结果: {is_valid}")
            
            if not is_valid:
                logger.error("生成的哈希验证失败！")
                raise Exception("密码哈希生成失败")
            
            # 创建默认管理员用户
            admin_user = User(
                username='admin',
                email='admin@sms-forwarding.com',
                hashed_password=hashed_password,
                is_active=True,
                is_superuser=True,
                full_name='系统管理员'
            )
            
            db.add(admin_user)
            db.flush()  # 刷新以获取ID
            
            logger.info(f"默认管理员用户创建成功 (ID: {admin_user.id})")
            logger.info("登录凭据: 用户名=admin, 密码=admin123")
            
            # 验证数据库中的哈希
            db.refresh(admin_user)
            stored_hash = admin_user.hashed_password
            logger.info(f"数据库中存储的哈希: {stored_hash}")
            logger.info(f"存储哈希长度: {len(stored_hash)}")
            
            # 最终验证
            final_check = pwd_context.verify(password, stored_hash)
            logger.info(f"最终验证结果: {final_check}")
            
            if not final_check:
                logger.error("数据库中的哈希验证失败！可能被截断了")
                raise Exception("密码哈希存储验证失败")
                
        else:
            logger.info(f"管理员用户已存在 (ID: {admin_user.id})")
            # 验证现有用户的密码哈希
            stored_hash = admin_user.hashed_password
            logger.info(f"现有用户哈希长度: {len(stored_hash)}")
            
            # 测试现有密码
            test_verify = pwd_context.verify("admin123", stored_hash)
            logger.info(f"现有密码验证结果: {test_verify}")
            
            if not test_verify:
                logger.warning("现有管理员密码验证失败，重置密码...")
                new_hash = pwd_context.hash("admin123")
                admin_user.hashed_password = new_hash
                db.flush()
                
                # 重新验证
                final_verify = pwd_context.verify("admin123", admin_user.hashed_password)
                logger.info(f"密码重置后验证结果: {final_verify}")
        
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
