"""
用户模型 - 紧急修复版本，移除2FA字段
User model - Emergency fix version, removed 2FA fields
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func
from ..database import Base


class User(Base):
    """管理员用户表 - 仅包含数据库中实际存在的字段"""
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
    
    # 🚨 安全字段 - 登录失败次数限制和锁定
    failed_login_attempts = Column(Integer, default=0, comment="登录失败次数")
    last_failed_login = Column(DateTime(timezone=True), comment="最后失败登录时间")
    locked_until = Column(DateTime(timezone=True), comment="锁定到期时间")
    
    # 🚨 紧急修复：移除2FA字段，避免数据库字段不存在错误
    # totp_secret = Column(String(32), comment="TOTP密钥（Base32编码）")
    # totp_enabled = Column(Boolean, default=False, comment="是否启用双因素认证")
    # backup_codes = Column(String(1000), comment="备用恢复码（JSON格式）")
    # totp_failed_attempts = Column(Integer, default=0, comment="2FA验证失败次数")
    # totp_locked_until = Column(DateTime(timezone=True), comment="2FA锁定到期时间")
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), comment="更新时间")
    
    def __repr__(self):
        return f"<User(username='{self.username}', email='{self.email}')>"
    
    def to_dict(self):
        """转换为字典格式 (不包含密码和敏感安全信息)"""
        try:
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
        except Exception as e:
            # 如果出现任何错误，返回基本信息
            return {
                "id": getattr(self, 'id', None),
                "username": getattr(self, 'username', None),
                "email": getattr(self, 'email', None),
                "is_active": getattr(self, 'is_active', True),
                "error": f"to_dict error: {str(e)}"
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
