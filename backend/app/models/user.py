"""
用户模型 - 简化版本，匹配Railway数据库实际结构
User model for admin authentication - Simplified to match actual Railway DB structure
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func
from ..database import Base


class User(Base):
    """管理员用户表 - 仅包含Railway数据库中实际存在的字段"""
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
    
    # 🚨 新增：安全字段 - 登录失败次数限制和锁定
    failed_login_attempts = Column(Integer, default=0, comment="登录失败次数")
    last_failed_login = Column(DateTime(timezone=True), comment="最后失败登录时间")
    locked_until = Column(DateTime(timezone=True), comment="锁定到期时间")
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), comment="更新时间")
    
    def __repr__(self):
        return f"<User(username='{self.username}', email='{self.email}')>"
    
    def to_dict(self):
        """转换为字典格式 (不包含密码和敏感安全信息)"""
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "is_active": self.is_active,
            "is_superuser": self.is_superuser,
            "full_name": self.full_name,
            "phone": self.phone,
            "last_login": self.last_login.isoformat() if self.last_login else None,
            "login_count": self.login_count or 0,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            # 🚨 注意：不返回敏感的安全字段（failed_login_attempts, locked_until等）
        }
    
    def is_locked(self):
        """检查用户是否被锁定"""
        if not self.locked_until:
            return False
        
        from datetime import datetime, timezone
        return datetime.now(timezone.utc) < self.locked_until
    
    def get_remaining_lock_time(self):
        """获取剩余锁定时间（分钟）"""
        if not self.is_locked():
            return 0
        
        from datetime import datetime, timezone
        remaining_seconds = (self.locked_until - datetime.now(timezone.utc)).total_seconds()
        return max(0, remaining_seconds / 60)
