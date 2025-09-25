"""
短信规则模型
SMS rule model for storing SMS forwarding rules
"""

from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Boolean, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..database import Base


class SMSRule(Base):
    """短信转发规则表"""
    __tablename__ = "sms_rules"
    
    # 主键
    id = Column(Integer, primary_key=True, index=True)
    
    # 关联账号
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False, comment="绑定账号ID")
    
    # 规则基本信息
    rule_name = Column(String(100), nullable=False, comment="规则名称")
    description = Column(Text, comment="规则描述")
    
    # 匹配条件
    sender_pattern = Column(String(255), comment="发件人号码匹配模式")
    sender_match_type = Column(String(20), default="fuzzy", comment="发送方匹配类型 (exact/fuzzy/regex)")
    content_pattern = Column(Text, comment="短信内容匹配模式")
    content_match_type = Column(String(20), default="fuzzy", comment="内容匹配类型 (exact/fuzzy/regex)")
    
    # 规则配置
    is_active = Column(Boolean, default=True, comment="是否启用")
    priority = Column(Integer, default=0, comment="优先级 (数字越大优先级越高)")
    display_count = Column(Integer, default=5, comment="客户端显示条数")
    
    # 动作配置
    action_type = Column(String(50), default="forward", comment="动作类型 (forward/store/ignore)")
    action_config = Column(Text, comment="动作配置 (JSON格式)")
    
    # 新增转发相关字段
    forward_target_type = Column(String(20), default="link", nullable=False, comment="转发目标类型 (link/webhook/email)")
    forward_target_id = Column(Integer, ForeignKey("account_links.id", ondelete="SET NULL"), nullable=True, comment="转发目标ID")
    forward_config = Column(JSON, default=dict, nullable=False, comment="转发配置 (JSON格式)")
    
    # 统计信息
    match_count = Column(Integer, default=0, comment="匹配次数")
    last_match_time = Column(DateTime(timezone=True), comment="最后匹配时间")
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), comment="更新时间")
    
    # 关联关系
    account = relationship("Account", back_populates="sms_rules")
    forward_target_link = relationship("AccountLink", foreign_keys=[forward_target_id])
    
    def __repr__(self):
        return f"<SMSRule(rule_name='{self.rule_name}', sender_match_type='{self.sender_match_type}', content_match_type='{self.content_match_type}', account_id={self.account_id})>"
    
    def to_dict(self):
        """转换为字典格式"""
        return {
            "id": self.id,
            "account_id": self.account_id,
            "rule_name": self.rule_name,
            "description": self.description,
            "sender_pattern": self.sender_pattern,
            "sender_match_type": self.sender_match_type,
            "content_pattern": self.content_pattern,
            "content_match_type": self.content_match_type,
            "is_active": self.is_active,
            "priority": self.priority,
            "display_count": self.display_count,
            "action_type": self.action_type,
            "action_config": self.action_config,
            "forward_target_type": self.forward_target_type,
            "forward_target_id": self.forward_target_id,
            "forward_config": self.forward_config,
            "match_count": self.match_count,
            "last_match_time": self.last_match_time.isoformat() if self.last_match_time else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class SmsForwardLog(Base):
    """短信转发日志表"""
    __tablename__ = "sms_forward_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    sms_id = Column(Integer, ForeignKey("sms.id", ondelete="CASCADE"), nullable=False, comment="短信ID")
    rule_id = Column(Integer, ForeignKey("sms_rules.id", ondelete="CASCADE"), nullable=False, comment="规则ID")
    target_type = Column(String(20), nullable=False, default="link", comment="转发目标类型")
    target_id = Column(Integer, nullable=True, comment="转发目标ID")
    status = Column(String(20), nullable=False, default="pending", comment="转发状态 (pending/success/failed)")
    error_message = Column(Text, nullable=True, comment="错误信息")
    forwarded_at = Column(DateTime(timezone=True), nullable=True, comment="转发时间")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), comment="更新时间")
    
    # 关联关系
    sms = relationship("SMS", foreign_keys=[sms_id])
    rule = relationship("SMSRule", foreign_keys=[rule_id])
    
    def __repr__(self):
        return f"<SmsForwardLog(sms_id={self.sms_id}, rule_id={self.rule_id}, status='{self.status}')>"
    
    def to_dict(self):
        """转换为字典格式"""
        return {
            "id": self.id,
            "sms_id": self.sms_id,
            "rule_id": self.rule_id,
            "target_type": self.target_type,
            "target_id": self.target_id,
            "status": self.status,
            "error_message": self.error_message,
            "forwarded_at": self.forwarded_at.isoformat() if self.forwarded_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
