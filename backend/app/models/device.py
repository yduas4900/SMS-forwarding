"""
设备模型
Device model for storing mobile device information
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..database import Base


class Device(Base):
    """设备信息表"""
    __tablename__ = "devices"
    
    # 主键
    id = Column(Integer, primary_key=True, index=True)
    
    # 设备标识
    device_id = Column(String(255), unique=True, index=True, nullable=False, comment="设备唯一标识符")
    serial_number = Column(String(255), comment="设备序列号 (与ADB一致)")
    
    # 设备基本信息
    brand = Column(String(100), comment="手机品牌")
    model = Column(String(100), comment="手机型号")
    os_version = Column(String(50), comment="操作系统版本")
    
    # 网络信息
    network_type = Column(String(50), comment="网络类型 (Wi-Fi/蜂窝数据)")
    ip_address = Column(String(45), comment="IP地址")
    
    # 电话号码
    phone_number = Column(String(20), comment="本机电话号码")
    
    # 设备状态
    is_online = Column(Boolean, default=False, comment="是否在线")
    is_active = Column(Boolean, default=True, comment="是否活跃")
    last_heartbeat = Column(DateTime(timezone=True), comment="最后心跳时间")
    last_sms_time = Column(DateTime(timezone=True), comment="最后短信时间")
    
    # API Token
    api_token = Column(String(255), unique=True, index=True, comment="API访问令牌")
    
    # 扩展信息 (JSON格式存储其他设备信息)
    extra_info = Column(JSON, comment="扩展设备信息")
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), comment="更新时间")
    
    # 关联关系
    sms_records = relationship("SMS", back_populates="device", cascade="all, delete-orphan")
    account_links = relationship("AccountLink", back_populates="device", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Device(device_id='{self.device_id}', brand='{self.brand}', model='{self.model}')>"
    
    def to_dict(self):
        """转换为字典格式"""
        return {
            "id": self.id,
            "device_id": self.device_id,
            "serial_number": self.serial_number,
            "brand": self.brand,
            "model": self.model,
            "os_version": self.os_version,
            "network_type": self.network_type,
            "ip_address": self.ip_address,
            "phone_number": self.phone_number,
            "is_online": self.is_online,
            "is_active": self.is_active,
            "last_heartbeat": self.last_heartbeat.isoformat() if self.last_heartbeat else None,
            "last_sms_time": self.last_sms_time.isoformat() if self.last_sms_time else None,
            "extra_info": self.extra_info,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
