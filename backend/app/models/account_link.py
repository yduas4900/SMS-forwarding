"""
账号链接模型
Account link model for storing access links and tracking usage
"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..database import Base
import uuid


class AccountLink(Base):
    """账号链接表"""
    __tablename__ = "account_links"
    
    # 主键
    id = Column(Integer, primary_key=True, index=True)
    
    # 关联账号和设备
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False, comment="关联账号ID")
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False, comment="绑定设备ID")
    
    # 链接信息
    link_id = Column(String(255), unique=True, index=True, nullable=False, comment="唯一链接标识符")
    link_url = Column(String(500), comment="完整链接URL")
    
    # 状态信息
    status = Column(String(20), default="unused", comment="链接状态 (unused/used/expired)")
    is_active = Column(Boolean, default=True, comment="是否激活")
    
    # 访问限制配置
    max_access_count = Column(Integer, default=5, comment="最大访问次数 (0为不限制)")
    max_verification_count = Column(Integer, default=5, comment="最大验证码获取次数 (0为不限制)")
    verification_interval = Column(Integer, default=10, comment="验证码间隔时间 (秒)")
    
    # 新增可配置时间间隔字段
    access_session_interval = Column(Integer, default=5, comment="访问会话间隔 (分钟)")
    verification_wait_time = Column(Integer, default=0, comment="验证码等待时间 (秒)")
    
    # 使用统计
    access_count = Column(Integer, default=0, comment="访问次数")
    verification_count = Column(Integer, default=0, comment="验证码获取次数")
    last_access_time = Column(DateTime(timezone=True), comment="最后访问时间")
    last_verification_time = Column(DateTime(timezone=True), comment="最后获取验证码时间")
    
    # 客户端信息
    last_ip = Column(String(45), comment="最后访问IP")
    last_user_agent = Column(String(500), comment="最后访问用户代理")
    
    # 有效期
    expires_at = Column(DateTime(timezone=True), comment="过期时间")
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), comment="更新时间")
    
    # 关联关系
    account = relationship("Account", back_populates="account_links")
    device = relationship("Device", back_populates="account_links")
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not self.link_id:
            self.link_id = str(uuid.uuid4())
    
    def __repr__(self):
        return f"<AccountLink(link_id='{self.link_id}', status='{self.status}', access_count={self.access_count})>"
    
    def to_dict(self):
        """转换为字典格式"""
        return {
            "id": self.id,
            "account_id": self.account_id,
            "device_id": self.device_id,
            "link_id": self.link_id,
            "link_url": self.link_url,
            "status": self.status,
            "is_active": self.is_active,
            "max_access_count": self.max_access_count,
            "max_verification_count": self.max_verification_count,
            "access_session_interval": self.access_session_interval,
            "verification_wait_time": self.verification_wait_time,
            "access_count": self.access_count,
            "verification_count": self.verification_count,
            "last_access_time": self.last_access_time.isoformat() if self.last_access_time else None,
            "last_verification_time": self.last_verification_time.isoformat() if self.last_verification_time else None,
            "last_ip": self.last_ip,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
    
    def is_access_allowed(self) -> bool:
        """检查是否允许访问"""
        if not self.is_active or self.status == "expired":
            return False
        
        if self.max_access_count > 0 and self.access_count >= self.max_access_count:
            return False
            
        if self.expires_at:
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc)
            if self.expires_at < now:
                return False
            
        return True
    
    def is_verification_allowed(self) -> bool:
        """检查是否允许获取验证码"""
        if not self.is_access_allowed():
            return False
            
        if self.max_verification_count > 0 and self.verification_count >= self.max_verification_count:
            return False
            
        # 🔥 移除时间间隔检查，让前端倒计时控制请求频率
        # 注释掉原有的冷却时间检查逻辑
        # if self.last_verification_time:
        #     from datetime import datetime, timezone, timedelta
        #     now = datetime.now(timezone.utc)
        #     time_diff = (now - self.last_verification_time).total_seconds()
        #     if time_diff < self.verification_interval:
        #         return False
                
        return True
