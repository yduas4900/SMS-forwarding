"""
短信模型
SMS model for storing SMS records
"""

from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..database import Base


class SMS(Base):
    """短信记录表"""
    __tablename__ = "sms"
    
    # 主键
    id = Column(Integer, primary_key=True, index=True)
    
    # 关联设备
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False, comment="关联设备ID")
    
    # 短信基本信息
    sender = Column(String(50), comment="发送方号码")
    content = Column(Text, comment="短信内容")
    sms_timestamp = Column(DateTime(timezone=True), comment="短信时间戳")
    
    # 短信类型
    sms_type = Column(String(20), default="received", comment="短信类型 (received/sent)")
    
    # 短信状态
    is_read = Column(String(10), default="unread", comment="是否已读 (read/unread)")
    
    # 分类标签 (用于验证码识别等)
    category = Column(String(50), comment="短信分类 (verification/promotion/normal)")
    
    # 原始数据 (JSON格式存储完整的短信数据)
    raw_data = Column(Text, comment="原始短信数据")
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), comment="更新时间")
    
    # 关联关系
    device = relationship("Device", back_populates="sms_records")
    
    def __repr__(self):
        return f"<SMS(sender='{self.sender}', content='{self.content[:50]}...', timestamp='{self.sms_timestamp}')>"
    
    def to_dict(self):
        """转换为字典格式"""
        return {
            "id": self.id,
            "device_id": self.device_id,
            "sender": self.sender,
            "content": self.content,
            "sms_timestamp": self.sms_timestamp.isoformat() if self.sms_timestamp else None,
            "sms_type": self.sms_type,
            "is_read": self.is_read,
            "category": self.category,
            "raw_data": self.raw_data,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
