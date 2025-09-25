"""
会员账号模型
Account model for storing member account information
"""

from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..database import Base


class Account(Base):
    """会员账号表"""
    __tablename__ = "accounts"
    
    # 主键
    id = Column(Integer, primary_key=True, index=True)
    
    # 账号信息
    account_name = Column(String(255), nullable=False, comment="账号名称")
    username = Column(String(100), comment="用户名")
    password = Column(String(255), comment="密码")
    
    # 服务类型和图片 (新增字段)
    type = Column(String(100), comment="服务类型")
    image_url = Column(Text, comment="账号图片URL或Base64数据")
    
    # 账号描述
    description = Column(Text, comment="账号描述")
    
    # 账号状态
    status = Column(String(20), default="active", comment="账号状态 (active/inactive/suspended)")
    
    # 主设备绑定 (新增字段)
    primary_device_id = Column(Integer, ForeignKey("devices.id", ondelete="SET NULL"), comment="主设备ID")
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), comment="更新时间")
    
    # 关联关系
    primary_device = relationship("Device", foreign_keys=[primary_device_id], post_update=True)
    account_links = relationship("AccountLink", back_populates="account", cascade="all, delete-orphan")
    sms_rules = relationship("SMSRule", back_populates="account", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Account(account_name='{self.account_name}', type='{self.type}')>"
    
    def to_dict(self):
        """转换为字典格式"""
        return {
            "id": self.id,
            "account_name": self.account_name,
            "username": self.username,
            "password": self.password,  # 添加缺失的password字段
            "type": self.type,
            "image_url": self.image_url,
            "description": self.description,
            "status": self.status,
            "primary_device_id": self.primary_device_id,
            "primary_device": self.primary_device.to_dict() if self.primary_device else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
