"""
用户模型
User model for admin authentication
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from sqlalchemy.sql import func
from ..database import Base


class User(Base):
    """管理员用户表"""
    __tablename__ = "users"
    
    # 主键
    id = Column(Integer, primary_key=True, index=True)
    
    # 用户信息
    username = Column(String(50), unique=True, index=True, nullable=False, comment="用户名")
    email = Column(String(100), unique=True, index=True, comment="邮箱")
    hashed_password = Column(String(500), nullable=False, comment="加密密码")
    
    # 用户状态
    is_active = Column(Boolean, default=True, comment="是否激活")
    is_superuser = Column(Boolean, default=False, comment="是否超级用户")
    
    # 个人信息
    full_name = Column(String(100), comment="全名")
    phone = Column(String(20), comment="电话号码")
    
    # 登录信息
    last_login = Column(DateTime(timezone=True), comment="最后登录时间")
    login_count = Column(Integer, default=0, comment="登录次数")
    
    # 登录安全
    failed_login_attempts = Column(Integer, default=0, comment="连续登录失败次数")
    locked_until = Column(DateTime(timezone=True), comment="账户锁定到期时间")
    last_failed_login = Column(DateTime(timezone=True), comment="最后一次登录失败时间")
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), comment="更新时间")
    
    def __repr__(self):
        return f"<User(username='{self.username}', email='{self.email}')>"
    
    def to_dict(self):
        """转换为字典格式 (不包含密码) - 安全处理不存在的字段"""
        return {
            "id": getattr(self, 'id', None),
            "username": getattr(self, 'username', None),
            "email": getattr(self, 'email', None),
            "is_active": getattr(self, 'is_active', True),
            "is_superuser": getattr(self, 'is_superuser', False),
            "full_name": getattr(self, 'full_name', None),
            "phone": getattr(self, 'phone', None),
            "last_login": getattr(self, 'last_login', None).isoformat() if getattr(self, 'last_login', None) else None,
            "login_count": getattr(self, 'login_count', 0),
            "created_at": getattr(self, 'created_at', None).isoformat() if getattr(self, 'created_at', None) else None,
            "updated_at": getattr(self, 'updated_at', None).isoformat() if getattr(self, 'updated_at', None) else None
        }
