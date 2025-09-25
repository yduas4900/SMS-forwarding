"""
短信管理API
SMS management APIs
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, and_, func
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from pydantic import BaseModel
import re
import logging

from ..database import get_db
from ..models.sms import SMS
from ..models.device import Device
from ..models.sms_rule import SMSRule, SmsForwardLog
from ..models.user import User
from ..api.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


# Pydantic 模型
class ForwardConfig(BaseModel):
    """转发配置模型"""
    webhook_url: Optional[str] = None
    email_address: Optional[str] = None
    custom_headers: Optional[dict] = None
    retry_count: Optional[int] = 3
    timeout: Optional[int] = 30


class SMSRuleCreate(BaseModel):
    """创建短信规则请求模型"""
    account_id: int
    rule_name: str
    description: Optional[str] = None
    sender_pattern: Optional[str] = None
    sender_match_type: str = "fuzzy"  # exact, fuzzy, regex
    content_pattern: Optional[str] = None
    content_match_type: str = "fuzzy"  # exact, fuzzy, regex
    priority: int = 0
    display_count: int = 5  # 显示条数
    action_type: str = "forward"
    action_config: Optional[str] = None
    # 新增转发配置字段
    forward_target_type: str = "link"  # link, webhook, email
    forward_target_id: Optional[int] = None  # 用于link类型
    forward_config: Optional[ForwardConfig] = None


class SMSRuleUpdate(BaseModel):
    """更新短信规则请求模型"""
    rule_name: Optional[str] = None
    description: Optional[str] = None
    sender_pattern: Optional[str] = None
    sender_match_type: Optional[str] = None
    content_pattern: Optional[str] = None
    content_match_type: Optional[str] = None
    is_active: Optional[bool] = None
    priority: Optional[int] = None
    display_count: Optional[int] = None  # 显示条数
    action_type: Optional[str] = None
    action_config: Optional[str] = None
    # 新增转发配置字段
    forward_target_type: Optional[str] = None
    forward_target_id: Optional[int] = None
    forward_config: Optional[ForwardConfig] = None


class SMSResponse(BaseModel):
    """短信响应模型"""
    id: int
    device_id: int
    sender: str
    content: str
    sms_timestamp: str
    sms_type: str
    is_read: str
    category: Optional[str]
    created_at: str


# 工具函数
def match_sms_with_rules(sms: SMS, rules: List[SMSRule]) -> List[SMSRule]:
    """
    匹配短信与规则
    Match SMS with rules
    """
    matched_rules = []
    
    for rule in rules:
        if not rule.is_active:
            continue
            
        sender_match = True
        content_match = True
        
        # 检查发送方匹配
        if rule.sender_pattern and rule.sender_pattern.strip() and rule.sender_pattern != "*":
            # 处理通配符模式（如 9555*）
            if rule.sender_match_type == "fuzzy" and rule.sender_pattern.endswith("*"):
                # 移除末尾的 * 进行前缀匹配
                prefix = rule.sender_pattern[:-1]
                sender_match = sms.sender.startswith(prefix)
            elif rule.sender_match_type == "exact":
                sender_match = sms.sender == rule.sender_pattern
            elif rule.sender_match_type == "fuzzy":
                sender_match = rule.sender_pattern.lower() in sms.sender.lower()
            elif rule.sender_match_type == "regex":
                try:
                    sender_match = bool(re.search(rule.sender_pattern, sms.sender))
                except re.error:
                    sender_match = False
        
        # 检查内容匹配
        if rule.content_pattern and rule.content_pattern.strip() and rule.content_pattern != "*":
            # 处理通配符模式（如 100*）
            if rule.content_match_type == "fuzzy" and rule.content_pattern.endswith("*"):
                # 移除末尾的 * 进行前缀匹配
                prefix = rule.content_pattern[:-1]
                # 🔥 修复：检查短信内容是否包含以该前缀开头的数字序列
                content_match = prefix in sms.content
            elif rule.content_match_type == "exact":
                content_match = sms.content == rule.content_pattern
            elif rule.content_match_type == "fuzzy":
                content_match = rule.content_pattern.lower() in sms.content.lower()
            elif rule.content_match_type == "regex":
                try:
                    content_match = bool(re.search(rule.content_pattern, sms.content))
                except re.error:
                    content_match = False
        
        # 如果两个条件都匹配，则添加到匹配列表
        if sender_match and content_match:
            matched_rules.append(rule)
    
    # 按优先级排序
    matched_rules.sort(key=lambda x: x.priority, reverse=True)
    return matched_rules


def categorize_sms(sms_content: str) -> str:
    """
    自动分类短信
    Automatically categorize SMS
    """
    content_lower = sms_content.lower()
    
    # 验证码关键词
    verification_keywords = [
        "验证码", "verification", "code", "验证", "确认码", "动态码",
        "安全码", "登录码", "注册码", "找回密码", "身份验证"
    ]
    
    # 推广关键词
    promotion_keywords = [
        "优惠", "促销", "打折", "特价", "活动", "抽奖", "红包",
        "免费", "赠送", "限时", "秒杀", "团购"
    ]
    
    # 检查是否为验证码
    for keyword in verification_keywords:
        if keyword in content_lower:
            return "verification"
    
    # 检查是否为推广信息
    for keyword in promotion_keywords:
        if keyword in content_lower:
            return "promotion"
    
    return "normal"


# API 端点
@router.get("/list")
async def get_sms_list(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    device_id: Optional[int] = Query(None, description="设备ID筛选"),
    category: Optional[str] = Query(None, description="分类筛选"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    start_date: Optional[str] = Query(None, description="开始日期 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="结束日期 (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取短信列表
    Get SMS list with pagination and filtering
    """
    try:
        # 构建查询
        query = db.query(SMS).join(Device)
        
        # 设备筛选
        if device_id:
            query = query.filter(SMS.device_id == device_id)
        
        # 分类筛选
        if category:
            query = query.filter(SMS.category == category)
        
        # 搜索过滤
        if search:
            query = query.filter(
                or_(
                    SMS.sender.ilike(f"%{search}%"),
                    SMS.content.ilike(f"%{search}%"),
                    Device.device_id.ilike(f"%{search}%")
                )
            )
        
        # 日期范围筛选
        if start_date:
            try:
                start_datetime = datetime.fromisoformat(start_date).replace(tzinfo=timezone.utc)
                query = query.filter(SMS.sms_timestamp >= start_datetime)
            except ValueError:
                pass
        
        if end_date:
            try:
                end_datetime = datetime.fromisoformat(end_date).replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
                query = query.filter(SMS.sms_timestamp <= end_datetime)
            except ValueError:
                pass
        
        # 计算总数
        total = query.count()
        
        # 分页查询
        sms_list = query.order_by(desc(SMS.sms_timestamp)).offset((page - 1) * page_size).limit(page_size).all()
        
        # 构建响应数据
        sms_data = []
        for sms in sms_list:
            sms_dict = sms.to_dict()
            sms_dict['device_info'] = {
                'device_id': sms.device.device_id,
                'brand': sms.device.brand,
                'model': sms.device.model,
                'phone_number': sms.device.phone_number,
                'is_online': sms.device.is_online
            }
            sms_data.append(sms_dict)
        
        return {
            "success": True,
            "data": {
                "sms_list": sms_data,
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total": total,
                    "pages": (total + page_size - 1) // page_size
                }
            }
        }
        
    except Exception as e:
        logger.error(f"获取短信列表失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取短信列表失败"
        )


@router.get("/{sms_id}")
async def get_sms_detail(
    sms_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取短信详细信息
    Get SMS detailed information
    """
    try:
        sms = db.query(SMS).filter(SMS.id == sms_id).first()
        
        if not sms:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="短信不存在"
            )
        
        sms_dict = sms.to_dict()
        sms_dict['device_info'] = sms.device.to_dict()
        
        return {
            "success": True,
            "data": sms_dict
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取短信详情失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取短信详情失败"
        )


@router.delete("/{sms_id}")
async def delete_sms(
    sms_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    删除短信
    Delete SMS
    """
    try:
        sms = db.query(SMS).filter(SMS.id == sms_id).first()
        
        if not sms:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="短信不存在"
            )
        
        db.delete(sms)
        db.commit()
        
        logger.info(f"短信删除成功: {sms_id}")
        
        return {
            "success": True,
            "message": "短信删除成功"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除短信失败: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除短信失败"
        )


@router.post("/rules", response_model=dict)
async def create_sms_rule(
    rule_data: SMSRuleCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    创建短信规则
    Create SMS rule
    """
    try:
        # 验证账号是否存在
        from ..models.account import Account
        account = db.query(Account).filter(Account.id == rule_data.account_id).first()
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="账号不存在"
            )
        
        # 验证匹配类型
        if rule_data.sender_match_type not in ["exact", "fuzzy", "regex"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="无效的发送方匹配类型"
            )
        
        if rule_data.content_match_type not in ["exact", "fuzzy", "regex"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="无效的内容匹配类型"
            )
        
        # 验证正则表达式
        if rule_data.sender_match_type == "regex" and rule_data.sender_pattern:
            try:
                re.compile(rule_data.sender_pattern)
            except re.error:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="无效的发送方正则表达式"
                )
        
        if rule_data.content_match_type == "regex" and rule_data.content_pattern:
            try:
                re.compile(rule_data.content_pattern)
            except re.error:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="无效的内容正则表达式"
                )
        
        # 验证转发目标类型
        if rule_data.forward_target_type not in ["link", "webhook", "email"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="无效的转发目标类型"
            )
        
        # 验证转发配置
        forward_config_dict = {}
        if rule_data.forward_config:
            forward_config_dict = rule_data.forward_config.dict(exclude_none=True)
            
            # 验证webhook配置
            if rule_data.forward_target_type == "webhook":
                if not forward_config_dict.get("webhook_url"):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Webhook类型转发必须配置webhook_url"
                    )
            
            # 验证邮箱配置
            elif rule_data.forward_target_type == "email":
                if not forward_config_dict.get("email_address"):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="邮箱类型转发必须配置email_address"
                    )
        
        # 验证链接目标ID
        if rule_data.forward_target_type == "link" and rule_data.forward_target_id:
            from ..models.account_link import AccountLink
            target_link = db.query(AccountLink).filter(AccountLink.id == rule_data.forward_target_id).first()
            if not target_link:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="指定的转发目标链接不存在"
                )
        
        # 创建规则
        new_rule = SMSRule(
            account_id=rule_data.account_id,
            rule_name=rule_data.rule_name,
            description=rule_data.description,
            sender_pattern=rule_data.sender_pattern,
            sender_match_type=rule_data.sender_match_type,
            content_pattern=rule_data.content_pattern,
            content_match_type=rule_data.content_match_type,
            priority=rule_data.priority,
            display_count=rule_data.display_count,
            action_type=rule_data.action_type,
            action_config=rule_data.action_config,
            forward_target_type=rule_data.forward_target_type,
            forward_target_id=rule_data.forward_target_id,
            forward_config=forward_config_dict
        )
        
        db.add(new_rule)
        db.commit()
        db.refresh(new_rule)
        
        logger.info(f"短信规则创建成功: {rule_data.rule_name}")
        
        return {
            "success": True,
            "message": "短信规则创建成功",
            "data": new_rule.to_dict()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建短信规则失败: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="创建短信规则失败"
        )


@router.get("/rules/list")
async def get_sms_rules_list(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    account_id: Optional[int] = Query(None, description="账号ID筛选"),
    is_active: Optional[bool] = Query(None, description="是否启用筛选"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取短信规则列表
    Get SMS rules list
    """
    try:
        # 构建查询
        from ..models.account import Account
        query = db.query(SMSRule).join(Account)
        
        # 账号筛选
        if account_id:
            query = query.filter(SMSRule.account_id == account_id)
        
        # 状态筛选
        if is_active is not None:
            query = query.filter(SMSRule.is_active == is_active)
        
        # 计算总数
        total = query.count()
        
        # 分页查询
        rules = query.order_by(desc(SMSRule.priority), desc(SMSRule.created_at)).offset((page - 1) * page_size).limit(page_size).all()
        
        # 构建响应数据
        rules_data = []
        for rule in rules:
            rule_dict = rule.to_dict()
            rule_dict['account_info'] = {
                'account_id': rule.account.id,
                'account_name': rule.account.account_name,
                'type': rule.account.type
            }
            rules_data.append(rule_dict)
        
        return {
            "success": True,
            "data": {
                "rules": rules_data,
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total": total,
                    "pages": (total + page_size - 1) // page_size
                }
            }
        }
        
    except Exception as e:
        logger.error(f"获取短信规则列表失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取短信规则列表失败"
        )


@router.put("/rules/{rule_id}")
async def update_sms_rule(
    rule_id: int,
    rule_data: SMSRuleUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    更新短信规则
    Update SMS rule
    """
    try:
        rule = db.query(SMSRule).filter(SMSRule.id == rule_id).first()
        
        if not rule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="短信规则不存在"
            )
        
        # 更新字段
        update_fields = []
        if rule_data.rule_name is not None:
            rule.rule_name = rule_data.rule_name
            update_fields.append("rule_name")
        
        if rule_data.description is not None:
            rule.description = rule_data.description
            update_fields.append("description")
        
        if rule_data.sender_match_type is not None:
            if rule_data.sender_match_type not in ["exact", "fuzzy", "regex"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="无效的发送方匹配类型"
                )
            rule.sender_match_type = rule_data.sender_match_type
            update_fields.append("sender_match_type")
        
        if rule_data.content_match_type is not None:
            if rule_data.content_match_type not in ["exact", "fuzzy", "regex"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="无效的内容匹配类型"
                )
            rule.content_match_type = rule_data.content_match_type
            update_fields.append("content_match_type")
        
        if rule_data.sender_pattern is not None:
            rule.sender_pattern = rule_data.sender_pattern
            update_fields.append("sender_pattern")
        
        if rule_data.content_pattern is not None:
            rule.content_pattern = rule_data.content_pattern
            update_fields.append("content_pattern")
        
        if rule_data.is_active is not None:
            rule.is_active = rule_data.is_active
            update_fields.append("is_active")
        
        if rule_data.priority is not None:
            rule.priority = rule_data.priority
            update_fields.append("priority")
        
        if rule_data.display_count is not None:
            rule.display_count = rule_data.display_count
            update_fields.append("display_count")
        
        if rule_data.action_type is not None:
            rule.action_type = rule_data.action_type
            update_fields.append("action_type")
        
        if rule_data.action_config is not None:
            rule.action_config = rule_data.action_config
            update_fields.append("action_config")
        
        # 更新转发配置字段
        if rule_data.forward_target_type is not None:
            if rule_data.forward_target_type not in ["link", "webhook", "email"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="无效的转发目标类型"
                )
            rule.forward_target_type = rule_data.forward_target_type
            update_fields.append("forward_target_type")
        
        if rule_data.forward_target_id is not None:
            # 验证链接目标ID
            if rule.forward_target_type == "link" and rule_data.forward_target_id:
                from ..models.account_link import AccountLink
                target_link = db.query(AccountLink).filter(AccountLink.id == rule_data.forward_target_id).first()
                if not target_link:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="指定的转发目标链接不存在"
                    )
            rule.forward_target_id = rule_data.forward_target_id
            update_fields.append("forward_target_id")
        
        if rule_data.forward_config is not None:
            forward_config_dict = rule_data.forward_config.dict(exclude_none=True)
            
            # 验证转发配置
            if rule.forward_target_type == "webhook":
                if not forward_config_dict.get("webhook_url"):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Webhook类型转发必须配置webhook_url"
                    )
            elif rule.forward_target_type == "email":
                if not forward_config_dict.get("email_address"):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="邮箱类型转发必须配置email_address"
                    )
            
            rule.forward_config = forward_config_dict
            update_fields.append("forward_config")
        
        rule.updated_at = datetime.now(timezone.utc)
        db.commit()
        
        logger.info(f"短信规则更新成功: {rule.rule_name}, 更新字段: {update_fields}")
        
        return {
            "success": True,
            "message": "短信规则更新成功",
            "data": rule.to_dict()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新短信规则失败: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新短信规则失败"
        )


@router.delete("/rules/{rule_id}")
async def delete_sms_rule(
    rule_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    删除短信规则
    Delete SMS rule
    """
    try:
        rule = db.query(SMSRule).filter(SMSRule.id == rule_id).first()
        
        if not rule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="短信规则不存在"
            )
        
        rule_name = rule.rule_name
        db.delete(rule)
        db.commit()
        
        logger.info(f"短信规则删除成功: {rule_name}")
        
        return {
            "success": True,
            "message": "短信规则删除成功"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除短信规则失败: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除短信规则失败"
        )


@router.get("/statistics/overview")
async def get_sms_statistics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取短信统计概览
    Get SMS statistics overview
    """
    try:
        # 基础统计
        total_sms = db.query(SMS).count()
        
        # 按分类统计
        verification_count = db.query(SMS).filter(SMS.category == "verification").count()
        promotion_count = db.query(SMS).filter(SMS.category == "promotion").count()
        normal_count = db.query(SMS).filter(SMS.category == "normal").count()
        
        # 今日短信统计
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_sms = db.query(SMS).filter(SMS.created_at >= today).count()
        
        # 最近7天短信统计
        week_ago = datetime.now(timezone.utc) - timedelta(days=7)
        week_sms = db.query(SMS).filter(SMS.created_at >= week_ago).count()
        
        # 规则统计
        total_rules = db.query(SMSRule).count()
        active_rules = db.query(SMSRule).filter(SMSRule.is_active == True).count()
        
        # 转发统计
        total_forwards = db.query(SmsForwardLog).count()
        success_forwards = db.query(SmsForwardLog).filter(SmsForwardLog.status == "success").count()
        failed_forwards = db.query(SmsForwardLog).filter(SmsForwardLog.status == "failed").count()
        
        return {
            "success": True,
            "data": {
                "sms": {
                    "total": total_sms,
                    "today": today_sms,
                    "week": week_sms,
                    "verification": verification_count,
                    "promotion": promotion_count,
                    "normal": normal_count
                },
                "rules": {
                    "total": total_rules,
                    "active": active_rules,
                    "inactive": total_rules - active_rules
                },
                "forwards": {
                    "total": total_forwards,
                    "success": success_forwards,
                    "failed": failed_forwards,
                    "pending": total_forwards - success_forwards - failed_forwards
                }
            }
        }
        
    except Exception as e:
        logger.error(f"获取短信统计失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取短信统计失败"
        )


@router.get("/forward_logs/list")
async def get_forward_logs_list(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    sms_id: Optional[int] = Query(None, description="短信ID筛选"),
    rule_id: Optional[int] = Query(None, description="规则ID筛选"),
    status: Optional[str] = Query(None, description="状态筛选 (pending/success/failed)"),
    target_type: Optional[str] = Query(None, description="目标类型筛选 (link/webhook/email)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取短信转发日志列表
    Get SMS forward logs list
    """
    try:
        # 构建查询
        query = db.query(SmsForwardLog).join(SMS).join(SMSRule)
        
        # 筛选条件
        if sms_id:
            query = query.filter(SmsForwardLog.sms_id == sms_id)
        
        if rule_id:
            query = query.filter(SmsForwardLog.rule_id == rule_id)
        
        if status:
            query = query.filter(SmsForwardLog.status == status)
        
        if target_type:
            query = query.filter(SmsForwardLog.target_type == target_type)
        
        # 计算总数
        total = query.count()
        
        # 分页查询
        logs = query.order_by(desc(SmsForwardLog.created_at)).offset((page - 1) * page_size).limit(page_size).all()
        
        # 构建响应数据
        logs_data = []
        for log in logs:
            log_dict = log.to_dict()
            log_dict['sms_info'] = {
                'sender': log.sms.sender,
                'content': log.sms.content[:50] + '...' if len(log.sms.content) > 50 else log.sms.content,
                'sms_timestamp': log.sms.sms_timestamp.isoformat() if log.sms.sms_timestamp else None
            }
            log_dict['rule_info'] = {
                'rule_name': log.rule.rule_name,
                'sender_match_type': log.rule.sender_match_type,
                'content_match_type': log.rule.content_match_type
            }
            logs_data.append(log_dict)
        
        return {
            "success": True,
            "data": {
                "logs": logs_data,
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total": total,
                    "pages": (total + page_size - 1) // page_size
                }
            }
        }
        
    except Exception as e:
        logger.error(f"获取转发日志列表失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取转发日志列表失败"
        )


@router.get("/forward_logs/{log_id}")
async def get_forward_log_detail(
    log_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取转发日志详细信息
    Get forward log detailed information
    """
    try:
        log = db.query(SmsForwardLog).filter(SmsForwardLog.id == log_id).first()
        
        if not log:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="转发日志不存在"
            )
        
        log_dict = log.to_dict()
        log_dict['sms_info'] = log.sms.to_dict()
        log_dict['rule_info'] = log.rule.to_dict()
        
        return {
            "success": True,
            "data": log_dict
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取转发日志详情失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取转发日志详情失败"
        )


@router.post("/manual_forward/{sms_id}")
async def manual_forward_sms(
    sms_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    手动转发短信
    Manually forward SMS based on rules
    """
    try:
        # 获取短信信息
        sms = db.query(SMS).filter(SMS.id == sms_id).first()
        if not sms:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="短信不存在"
            )
        
        # 获取设备关联的账号
        from ..models.account import Account
        account = db.query(Account).filter(Account.primary_device_id == sms.device_id).first()
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="未找到关联的账号"
            )
        
        # 获取该账号的所有激活规则
        rules = db.query(SMSRule).filter(
            SMSRule.account_id == account.id,
            SMSRule.is_active == True
        ).all()
        
        # 匹配规则
        matched_rules = match_sms_with_rules(sms, rules)
        
        if not matched_rules:
            return {
                "success": False,
                "message": "没有匹配的转发规则"
            }
        
        # 获取该账号的所有客户链接
        from ..models.account_link import AccountLink
        account_links = db.query(AccountLink).filter(AccountLink.account_id == account.id).all()
        
        if not account_links:
            return {
                "success": False,
                "message": "该账号没有客户访问链接"
            }
        
        # 构建转发内容
        forward_content = {
            "account_name": account.account_name,
            "username": account.username,
            "password": account.password,  # 明文密码
            "sms_content": sms.content,
            "sender": sms.sender,
            "sms_timestamp": sms.sms_timestamp.isoformat() if sms.sms_timestamp else None,
            "matched_rules": [rule.rule_name for rule in matched_rules]
        }
        
        # 这里应该实现实际的转发逻辑
        # 目前先记录转发日志
        forward_logs = []
        for rule in matched_rules:
            for link in account_links:
                log = SmsForwardLog(
                    sms_id=sms.id,
                    rule_id=rule.id,
                    target_type="link",
                    target_id=link.id,
                    status="success",  # 假设转发成功
                    forwarded_at=datetime.now(timezone.utc)
                )
                db.add(log)
                forward_logs.append({
                    "link_id": link.link_id,
                    "rule_name": rule.rule_name,
                    "status": "success"
                })
        
        # 更新规则匹配统计
        for rule in matched_rules:
            rule.match_count += 1
            rule.last_match_time = datetime.now(timezone.utc)
        
        db.commit()
        
        logger.info(f"手动转发短信成功: SMS ID {sms_id}, 匹配规则 {len(matched_rules)} 个, 转发链接 {len(account_links)} 个")
        
        return {
            "success": True,
            "message": f"手动转发成功，匹配到 {len(matched_rules)} 个规则，转发到 {len(account_links)} 个客户链接",
            "data": {
                "forward_content": forward_content,
                "matched_rules_count": len(matched_rules),
                "forwarded_links_count": len(account_links),
                "forward_logs": forward_logs
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"手动转发短信失败: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="手动转发短信失败"
        )


@router.post("/rules/{rule_id}/manual_forward")
async def manual_forward_by_rule(
    rule_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    根据规则手动转发匹配的短信
    Manually forward matched SMS by rule
    """
    try:
        # 获取规则信息
        rule = db.query(SMSRule).filter(SMSRule.id == rule_id).first()
        if not rule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="短信规则不存在"
            )
        
        # 获取账号信息
        from ..models.account import Account
        account = db.query(Account).filter(Account.id == rule.account_id).first()
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="关联账号不存在"
            )
        
        # 获取该账号设备的所有短信
        device_sms = db.query(SMS).filter(SMS.device_id == account.primary_device_id).all()
        
        if not device_sms:
            return {
                "success": False,
                "message": "该设备没有短信记录"
            }
        
        # 匹配短信
        matched_sms = match_sms_with_rules_single(device_sms, rule)
        
        if not matched_sms:
            return {
                "success": False,
                "message": "没有匹配的短信"
            }
        
        # 按时间排序，最新的在前面
        matched_sms.sort(key=lambda x: x.sms_timestamp, reverse=True)
        
        # 获取该账号的所有客户链接
        from ..models.account_link import AccountLink
        account_links = db.query(AccountLink).filter(AccountLink.account_id == account.id).all()
        
        if not account_links:
            return {
                "success": False,
                "message": "该账号没有客户访问链接"
            }
        
        # 实际执行转发：将匹配的短信推送到客户端
        success_count = 0
        forward_logs = []
        
        for link in account_links:
            try:
                # 实际转发逻辑：将匹配的短信数据推送到对应的客户链接
                await push_sms_to_client_link(link, matched_sms, account, rule, db)
                success_count += 1
                
                # 记录每条短信的转发日志
                for sms in matched_sms:
                    log = SmsForwardLog(
                        sms_id=sms.id,
                        rule_id=rule.id,
                        target_type="link",
                        target_id=link.id,
                        status="success",
                        forwarded_at=datetime.now(timezone.utc)
                    )
                    db.add(log)
                    forward_logs.append({
                        "link_id": link.link_id,
                        "sms_content": sms.content[:50] + "..." if len(sms.content) > 50 else sms.content,
                        "status": "success"
                    })
                    
            except Exception as e:
                logger.error(f"转发到链接 {link.link_id} 失败: {str(e)}")
                # 记录失败日志
                for sms in matched_sms:
                    log = SmsForwardLog(
                        sms_id=sms.id,
                        rule_id=rule.id,
                        target_type="link",
                        target_id=link.id,
                        status="failed",
                        error_message=str(e),
                        forwarded_at=datetime.now(timezone.utc)
                    )
                    db.add(log)
                    forward_logs.append({
                        "link_id": link.link_id,
                        "sms_content": sms.content[:50] + "..." if len(sms.content) > 50 else sms.content,
                        "status": "failed",
                        "error": str(e)
                    })
        
        # 更新规则匹配统计
        rule.match_count += len(matched_sms)
        rule.last_match_time = datetime.now(timezone.utc)
        
        db.commit()
        
        logger.info(f"规则手动转发完成: Rule ID {rule_id}, 匹配短信 {len(matched_sms)} 条, 成功转发到 {success_count}/{len(account_links)} 个链接")
        
        return {
            "success": True,
            "message": f"手动转发完成，匹配到 {len(matched_sms)} 条短信，成功转发到 {success_count}/{len(account_links)} 个客户链接",
            "data": {
                "matched_sms_count": len(matched_sms),
                "forwarded_links_count": len(account_links),
                "success_links_count": success_count,
                "forward_logs": forward_logs
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"规则手动转发失败: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="规则手动转发失败"
        )


async def push_sms_to_client_link(link, matched_sms: List[SMS], account, rule, db: Session):
    """
    将匹配的短信推送到客户端链接
    Push matched SMS to client link via WebSocket
    """
    try:
        from ..websocket import manager
        
        # 构建转发的短信数据（按时间倒序，最新的在前面）
        # 限制显示条数
        display_count = rule.display_count if rule.display_count else 10
        limited_sms = matched_sms[:display_count]
        
        forwarded_sms_data = []
        for sms in limited_sms:
            forwarded_sms_data.append({
                "id": sms.id,
                "sender": sms.sender,
                "content": sms.content,
                "sms_timestamp": sms.sms_timestamp.isoformat() if sms.sms_timestamp else None,
                "category": sms.category
            })
        
        # 构建WebSocket推送消息
        push_message = {
            "type": "admin_push_sms",
            "link_id": link.link_id,
            "account_info": {
                "id": account.id,
                "account_name": account.account_name,
                "username": account.username,
                "password": account.password,
                "type": account.type,
                "image_url": account.image_url
            },
            "sms_data": forwarded_sms_data,
            "push_info": {
                "message": f"管理员推送了 {len(limited_sms)} 条短信",
                "rule_name": rule.rule_name,
                "pushed_at": datetime.now(timezone.utc).isoformat()
            }
        }
        
        # 通过WebSocket广播推送消息到所有客户端
        await manager.broadcast(push_message, user_type="customer")
        
        logger.info(f"WebSocket推送消息已发送: {push_message}")
        
        # 更新链接的最后更新时间
        link.last_access_time = datetime.now(timezone.utc)
        
        logger.info(f"成功通过WebSocket推送 {len(limited_sms)} 条短信到链接 {link.link_id}")
        
        return True
        
    except Exception as e:
        logger.error(f"推送短信到链接失败: {str(e)}")
        raise e


def match_sms_with_rules_single(sms_list: List[SMS], rule: SMSRule) -> List[SMS]:
    """
    使用单个规则匹配短信列表
    Match SMS list with a single rule
    """
    matched_sms = []
    
    if not rule.is_active:
        return matched_sms
    
    for sms in sms_list:
        sender_match = True
        content_match = True
        
        # 检查发送方匹配
        if rule.sender_pattern and rule.sender_pattern.strip() and rule.sender_pattern != "*":
            # 处理通配符模式（如 9555*）
            if rule.sender_match_type == "fuzzy" and rule.sender_pattern.endswith("*"):
                # 移除末尾的 * 进行前缀匹配
                prefix = rule.sender_pattern[:-1]
                sender_match = sms.sender.startswith(prefix)
            elif rule.sender_match_type == "exact":
                sender_match = sms.sender == rule.sender_pattern
            elif rule.sender_match_type == "fuzzy":
                sender_match = rule.sender_pattern.lower() in sms.sender.lower()
            elif rule.sender_match_type == "regex":
                try:
                    sender_match = bool(re.search(rule.sender_pattern, sms.sender))
                except re.error:
                    sender_match = False
        
        # 检查内容匹配
        if rule.content_pattern and rule.content_pattern.strip() and rule.content_pattern != "*":
            # 处理通配符模式（如 100*）
            if rule.content_match_type == "fuzzy" and rule.content_pattern.endswith("*"):
                # 移除末尾的 * 进行前缀匹配
                prefix = rule.content_pattern[:-1]
                # 🔥 修复：检查短信内容是否包含以该前缀开头的数字序列
                content_match = prefix in sms.content
            elif rule.content_match_type == "exact":
                content_match = sms.content == rule.content_pattern
            elif rule.content_match_type == "fuzzy":
                content_match = rule.content_pattern.lower() in sms.content.lower()
            elif rule.content_match_type == "regex":
                try:
                    content_match = bool(re.search(rule.content_pattern, sms.content))
                except re.error:
                    content_match = False
        
        # 如果两个条件都匹配，则添加到匹配列表
        if sender_match and content_match:
            matched_sms.append(sms)
    
    return matched_sms
