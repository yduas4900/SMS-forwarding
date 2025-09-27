"""
系统设置数据模型
System settings data model
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import json

from ..database import Base

class SystemSettings(Base):
    """系统设置表"""
    __tablename__ = "system_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    setting_key = Column(String(100), unique=True, index=True, nullable=False)
    setting_value = Column(Text, nullable=False)
    setting_type = Column(String(20), default="string")  # string, json, boolean, integer
    description = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def get_value(self):
        """根据类型返回正确的值"""
        if self.setting_type == "json":
            return json.loads(self.setting_value)
        elif self.setting_type == "boolean":
            return self.setting_value.lower() == "true"
        elif self.setting_type == "integer":
            return int(self.setting_value)
        else:
            return self.setting_value
    
    def set_value(self, value):
        """根据类型设置值"""
        if self.setting_type == "json":
            self.setting_value = json.dumps(value, ensure_ascii=False)
        elif self.setting_type == "boolean":
            self.setting_value = str(value).lower()
        else:
            self.setting_value = str(value)
