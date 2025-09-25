from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from sqlalchemy.sql import func
from ..database import Base

class ServiceType(Base):
    __tablename__ = "service_types"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True, comment="服务类型名称")
    description = Column(Text, nullable=True, comment="服务类型描述")
    icon = Column(String(50), nullable=True, comment="图标名称")
    color = Column(String(20), nullable=True, comment="颜色代码")
    is_active = Column(Boolean, default=True, comment="是否启用")
    sort_order = Column(Integer, default=0, comment="排序顺序")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), comment="更新时间")
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "icon": self.icon,
            "color": self.color,
            "is_active": self.is_active,
            "sort_order": self.sort_order,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
