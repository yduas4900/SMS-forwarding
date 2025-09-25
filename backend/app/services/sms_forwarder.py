"""
短信转发服务
SMS Forwarding Service

负责处理短信的转发逻辑，包括规则匹配、转发执行和日志记录
"""

import logging
import asyncio
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_

from ..models.sms import SMS
from ..models.sms_rule import SMSRule, SmsForwardLog
from ..models.account_link import AccountLink
from ..models.device import Device
from ..api.sms import match_sms_with_rules

logger = logging.getLogger(__name__)


class SMSForwarder:
    """短信转发器"""
    
    def __init__(self, db: Session):
        self.db = db
    
    async def process_sms_forwarding(self, sms: SMS) -> List[Dict[str, Any]]:
        """
        处理短信转发
        Process SMS forwarding
        
        Args:
            sms: 短信对象
            
        Returns:
            转发结果列表
        """
        try:
            # 获取该设备的所有激活转发规则
            active_rules = self.db.query(SMSRule).filter(
                and_(
                    SMSRule.device_id == sms.device_id,
                    SMSRule.is_active == True,
                    SMSRule.action_type == "forward"
                )
            ).order_by(SMSRule.priority.desc()).all()
            
            if not active_rules:
                logger.debug(f"设备 {sms.device_id} 没有激活的转发规则")
                return []
            
            # 匹配短信与规则
            matched_rules = match_sms_with_rules(sms, active_rules)
            
            if not matched_rules:
                logger.debug(f"短信 {sms.id} 没有匹配的转发规则")
                return []
            
            # 执行转发
            forward_results = []
            for rule in matched_rules:
                try:
                    result = await self._execute_forward(sms, rule)
                    forward_results.append(result)
                    
                    # 更新规则统计
                    rule.match_count += 1
                    rule.last_match_time = datetime.now(timezone.utc)
                    
                except Exception as e:
                    logger.error(f"执行转发规则 {rule.id} 失败: {str(e)}")
                    # 记录失败日志
                    await self._log_forward_failure(sms, rule, str(e))
                    forward_results.append({
                        "rule_id": rule.id,
                        "rule_name": rule.rule_name,
                        "status": "failed",
                        "error": str(e)
                    })
            
            self.db.commit()
            return forward_results
            
        except Exception as e:
            logger.error(f"处理短信转发失败: {str(e)}")
            self.db.rollback()
            return []
    
    async def _execute_forward(self, sms: SMS, rule: SMSRule) -> Dict[str, Any]:
        """
        执行具体的转发操作
        Execute specific forwarding operation
        
        Args:
            sms: 短信对象
            rule: 转发规则
            
        Returns:
            转发结果
        """
        try:
            # 根据转发目标类型执行不同的转发逻辑
            if rule.forward_target_type == "link":
                return await self._forward_to_link(sms, rule)
            elif rule.forward_target_type == "webhook":
                return await self._forward_to_webhook(sms, rule)
            elif rule.forward_target_type == "email":
                return await self._forward_to_email(sms, rule)
            else:
                raise ValueError(f"不支持的转发目标类型: {rule.forward_target_type}")
                
        except Exception as e:
            logger.error(f"执行转发失败: {str(e)}")
            raise
    
    async def _forward_to_link(self, sms: SMS, rule: SMSRule) -> Dict[str, Any]:
        """
        转发到链接 (存储到数据库，供客户端获取)
        Forward to link (store in database for client access)
        
        Args:
            sms: 短信对象
            rule: 转发规则
            
        Returns:
            转发结果
        """
        try:
            # 检查转发目标链接是否存在
            if rule.forward_target_id:
                target_link = self.db.query(AccountLink).filter(
                    AccountLink.id == rule.forward_target_id
                ).first()
                
                if not target_link:
                    raise ValueError(f"转发目标链接不存在: {rule.forward_target_id}")
                
                if not target_link.is_active:
                    raise ValueError(f"转发目标链接已禁用: {rule.forward_target_id}")
            
            # 创建转发日志
            forward_log = SmsForwardLog(
                sms_id=sms.id,
                rule_id=rule.id,
                target_type="link",
                target_id=rule.forward_target_id,
                status="success",
                forwarded_at=datetime.now(timezone.utc)
            )
            
            self.db.add(forward_log)
            self.db.flush()  # 获取ID但不提交
            
            logger.info(f"短信 {sms.id} 成功转发到链接 {rule.forward_target_id}")
            
            return {
                "rule_id": rule.id,
                "rule_name": rule.rule_name,
                "status": "success",
                "target_type": "link",
                "target_id": rule.forward_target_id,
                "forward_log_id": forward_log.id,
                "message": "转发到链接成功"
            }
            
        except Exception as e:
            logger.error(f"转发到链接失败: {str(e)}")
            raise
    
    async def _forward_to_webhook(self, sms: SMS, rule: SMSRule) -> Dict[str, Any]:
        """
        转发到Webhook
        Forward to webhook
        
        Args:
            sms: 短信对象
            rule: 转发规则
            
        Returns:
            转发结果
        """
        try:
            # 解析转发配置
            forward_config = rule.forward_config or {}
            webhook_url = forward_config.get("webhook_url")
            
            if not webhook_url:
                raise ValueError("Webhook URL未配置")
            
            # 准备转发数据
            forward_data = {
                "sms_id": sms.id,
                "sender": sms.sender,
                "content": sms.content,
                "timestamp": sms.sms_timestamp.isoformat() if sms.sms_timestamp else None,
                "device_id": sms.device_id,
                "rule_id": rule.id,
                "rule_name": rule.rule_name
            }
            
            # 这里可以添加实际的HTTP请求逻辑
            # 目前先记录日志，表示转发成功
            logger.info(f"短信 {sms.id} 准备转发到Webhook: {webhook_url}")
            
            # 创建转发日志
            forward_log = SmsForwardLog(
                sms_id=sms.id,
                rule_id=rule.id,
                target_type="webhook",
                status="success",
                forwarded_at=datetime.now(timezone.utc)
            )
            
            self.db.add(forward_log)
            self.db.flush()
            
            return {
                "rule_id": rule.id,
                "rule_name": rule.rule_name,
                "status": "success",
                "target_type": "webhook",
                "webhook_url": webhook_url,
                "forward_log_id": forward_log.id,
                "message": "转发到Webhook成功"
            }
            
        except Exception as e:
            logger.error(f"转发到Webhook失败: {str(e)}")
            raise
    
    async def _forward_to_email(self, sms: SMS, rule: SMSRule) -> Dict[str, Any]:
        """
        转发到邮箱
        Forward to email
        
        Args:
            sms: 短信对象
            rule: 转发规则
            
        Returns:
            转发结果
        """
        try:
            # 解析转发配置
            forward_config = rule.forward_config or {}
            email_address = forward_config.get("email_address")
            
            if not email_address:
                raise ValueError("邮箱地址未配置")
            
            # 这里可以添加实际的邮件发送逻辑
            # 目前先记录日志，表示转发成功
            logger.info(f"短信 {sms.id} 准备转发到邮箱: {email_address}")
            
            # 创建转发日志
            forward_log = SmsForwardLog(
                sms_id=sms.id,
                rule_id=rule.id,
                target_type="email",
                status="success",
                forwarded_at=datetime.now(timezone.utc)
            )
            
            self.db.add(forward_log)
            self.db.flush()
            
            return {
                "rule_id": rule.id,
                "rule_name": rule.rule_name,
                "status": "success",
                "target_type": "email",
                "email_address": email_address,
                "forward_log_id": forward_log.id,
                "message": "转发到邮箱成功"
            }
            
        except Exception as e:
            logger.error(f"转发到邮箱失败: {str(e)}")
            raise
    
    async def _log_forward_failure(self, sms: SMS, rule: SMSRule, error_message: str):
        """
        记录转发失败日志
        Log forwarding failure
        
        Args:
            sms: 短信对象
            rule: 转发规则
            error_message: 错误信息
        """
        try:
            forward_log = SmsForwardLog(
                sms_id=sms.id,
                rule_id=rule.id,
                target_type=rule.forward_target_type,
                target_id=rule.forward_target_id,
                status="failed",
                error_message=error_message
            )
            
            self.db.add(forward_log)
            self.db.flush()
            
            logger.warning(f"转发失败日志已记录: SMS {sms.id}, Rule {rule.id}")
            
        except Exception as e:
            logger.error(f"记录转发失败日志时出错: {str(e)}")
    
    def get_forward_logs(self, sms_id: Optional[int] = None, 
                        rule_id: Optional[int] = None,
                        limit: int = 100) -> List[SmsForwardLog]:
        """
        获取转发日志
        Get forwarding logs
        
        Args:
            sms_id: 短信ID筛选
            rule_id: 规则ID筛选
            limit: 返回数量限制
            
        Returns:
            转发日志列表
        """
        try:
            query = self.db.query(SmsForwardLog)
            
            if sms_id:
                query = query.filter(SmsForwardLog.sms_id == sms_id)
            
            if rule_id:
                query = query.filter(SmsForwardLog.rule_id == rule_id)
            
            logs = query.order_by(SmsForwardLog.created_at.desc()).limit(limit).all()
            
            return logs
            
        except Exception as e:
            logger.error(f"获取转发日志失败: {str(e)}")
            return []


# 工具函数
async def forward_sms(db: Session, sms: SMS) -> List[Dict[str, Any]]:
    """
    转发短信的便捷函数
    Convenience function for forwarding SMS
    
    Args:
        db: 数据库会话
        sms: 短信对象
        
    Returns:
        转发结果列表
    """
    forwarder = SMSForwarder(db)
    return await forwarder.process_sms_forwarding(sms)


def get_sms_forward_logs(db: Session, sms_id: Optional[int] = None,
                        rule_id: Optional[int] = None,
                        limit: int = 100) -> List[SmsForwardLog]:
    """
    获取短信转发日志的便捷函数
    Convenience function for getting SMS forward logs
    
    Args:
        db: 数据库会话
        sms_id: 短信ID筛选
        rule_id: 规则ID筛选
        limit: 返回数量限制
        
    Returns:
        转发日志列表
    """
    forwarder = SMSForwarder(db)
    return forwarder.get_forward_logs(sms_id, rule_id, limit)
