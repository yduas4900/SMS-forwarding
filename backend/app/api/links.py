"""
链接管理API
Link management APIs
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from pydantic import BaseModel
import logging

from ..database import get_db
from ..models.account_link import AccountLink
from ..models.account import Account
from ..models.device import Device
from ..models.sms import SMS
from ..models.user import User
from ..api.auth import get_current_user
from ..config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


# Pydantic 模型
class LinkCreateBatch(BaseModel):
    """批量创建链接请求模型"""
    account_id: int
    device_id: int
    count: int = 10
    max_access_count: int = 5
    max_verification_count: int = 5
    access_session_interval: int = 5  # 新增：访问会话间隔（分钟）
    verification_wait_time: int = 0   # 新增：验证码等待时间（秒）
    expires_days: Optional[int] = None


class LinkUpdate(BaseModel):
    """更新链接请求模型"""
    max_access_count: Optional[int] = None
    max_verification_count: Optional[int] = None
    access_session_interval: Optional[int] = None  # 新增：访问会话间隔（分钟）
    verification_wait_time: Optional[int] = None   # 新增：验证码等待时间（秒）
    is_active: Optional[bool] = None
    expires_at: Optional[str] = None


class VerificationRequest(BaseModel):
    """获取验证码请求模型"""
    link_id: str


# API 端点
@router.post("/batch_create")
async def create_links_batch(
    request_data: LinkCreateBatch,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    批量创建链接
    Batch create links
    """
    try:
        # 验证账号是否存在
        account = db.query(Account).filter(Account.id == request_data.account_id).first()
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="账号不存在"
            )
        
        # 验证设备是否存在
        device = db.query(Device).filter(Device.id == request_data.device_id).first()
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="设备不存在"
            )
        
        # 计算过期时间
        expires_at = None
        if request_data.expires_days:
            expires_at = datetime.now(timezone.utc) + timedelta(days=request_data.expires_days)
        
        # 批量创建链接
        created_links = []
        for i in range(request_data.count):
            new_link = AccountLink(
                account_id=request_data.account_id,
                device_id=request_data.device_id,
                max_access_count=request_data.max_access_count,
                max_verification_count=request_data.max_verification_count,
                verification_interval=10,  # 使用固定的防滥用间隔（10秒）
                access_session_interval=request_data.access_session_interval,  # 新增：访问会话间隔
                verification_wait_time=request_data.verification_wait_time,    # 新增：验证码等待时间
                expires_at=expires_at
            )
            
            # 生成完整链接URL - 使用相对路径，让前端处理域名
            new_link.link_url = f"/customer/{new_link.link_id}"
            
            db.add(new_link)
            created_links.append(new_link)
        
        db.commit()
        
        # 刷新所有创建的链接以获取完整数据
        for link in created_links:
            db.refresh(link)
        
        logger.info(f"批量创建链接成功: 账号ID {request_data.account_id}, 设备ID {request_data.device_id}, 数量 {request_data.count}")
        
        return {
            "success": True,
            "message": f"成功创建 {request_data.count} 个链接",
            "data": {
                "links": [link.to_dict() for link in created_links],
                "count": len(created_links)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"批量创建链接失败: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="批量创建链接失败"
        )


@router.get("/list")
async def get_links_list(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    account_id: Optional[int] = Query(None, description="账号ID筛选"),
    device_id: Optional[int] = Query(None, description="设备ID筛选"),
    status_filter: Optional[str] = Query(None, description="状态筛选"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取链接列表
    Get links list with pagination and filtering
    """
    try:
        # 构建查询
        query = db.query(AccountLink).join(Account).join(Device)
        
        # 账号筛选
        if account_id:
            query = query.filter(AccountLink.account_id == account_id)
        
        # 设备筛选
        if device_id:
            query = query.filter(AccountLink.device_id == device_id)
        
        # 状态筛选
        if status_filter:
            if status_filter == "active":
                query = query.filter(AccountLink.is_active == True)
            elif status_filter == "inactive":
                query = query.filter(AccountLink.is_active == False)
            elif status_filter in ["unused", "used", "expired"]:
                query = query.filter(AccountLink.status == status_filter)
        
        # 计算总数
        total = query.count()
        
        # 分页查询
        links = query.order_by(desc(AccountLink.created_at)).offset((page - 1) * page_size).limit(page_size).all()
        
        # 构建响应数据
        links_data = []
        for link in links:
            link_dict = link.to_dict()
            link_dict['account_info'] = {
                'id': link.account.id,
                'account_name': link.account.account_name,
                'username': link.account.username,
                'type': link.account.type,
                'image_url': link.account.image_url
            }
            link_dict['device_info'] = {
                'id': link.device.id,
                'device_id': link.device.device_id,
                'brand': link.device.brand,
                'model': link.device.model,
                'phone_number': link.device.phone_number,
                'is_online': link.device.is_online
            }
            links_data.append(link_dict)
        
        return {
            "success": True,
            "data": {
                "links": links_data,
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total": total,
                    "pages": (total + page_size - 1) // page_size
                }
            }
        }
        
    except Exception as e:
        logger.error(f"获取链接列表失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取链接列表失败"
        )


@router.get("/{link_id}")
async def get_link_detail(
    link_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取链接详细信息
    Get link detailed information
    """
    try:
        link = db.query(AccountLink).filter(AccountLink.link_id == link_id).first()
        
        if not link:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="链接不存在"
            )
        
        link_dict = link.to_dict()
        link_dict['account_info'] = link.account.to_dict()
        link_dict['device_info'] = link.device.to_dict()
        
        return {
            "success": True,
            "data": link_dict
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取链接详情失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取链接详情失败"
        )


@router.put("/{link_id}")
async def update_link(
    link_id: str,
    link_data: LinkUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    更新链接配置
    Update link configuration
    """
    try:
        link = db.query(AccountLink).filter(AccountLink.link_id == link_id).first()
        
        if not link:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="链接不存在"
            )
        
        # 更新字段
        update_fields = []
        if link_data.max_access_count is not None:
            link.max_access_count = link_data.max_access_count
            update_fields.append("max_access_count")
        
        if link_data.max_verification_count is not None:
            link.max_verification_count = link_data.max_verification_count
            update_fields.append("max_verification_count")
        
        # 新增：处理访问会话间隔字段
        if link_data.access_session_interval is not None:
            link.access_session_interval = link_data.access_session_interval
            update_fields.append("access_session_interval")
        
        # 新增：处理验证码等待时间字段
        if link_data.verification_wait_time is not None:
            link.verification_wait_time = link_data.verification_wait_time
            update_fields.append("verification_wait_time")
        
        if link_data.is_active is not None:
            link.is_active = link_data.is_active
            update_fields.append("is_active")
        
        if link_data.expires_at is not None:
            try:
                link.expires_at = datetime.fromisoformat(link_data.expires_at.replace('Z', '+00:00'))
                update_fields.append("expires_at")
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="无效的过期时间格式"
                )
        
        link.updated_at = datetime.now(timezone.utc)
        db.commit()
        
        logger.info(f"链接更新成功: {link_id}, 更新字段: {update_fields}")
        
        return {
            "success": True,
            "message": "链接更新成功",
            "data": link.to_dict()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新链接失败: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新链接失败"
        )


@router.delete("/{link_id}")
async def delete_link(
    link_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    删除链接
    Delete link
    """
    try:
        link = db.query(AccountLink).filter(AccountLink.link_id == link_id).first()
        
        if not link:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="链接不存在"
            )
        
        db.delete(link)
        db.commit()
        
        logger.info(f"链接删除成功: {link_id}")
        
        return {
            "success": True,
            "message": "链接删除成功"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除链接失败: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除链接失败"
        )


# 客户端访问API (不需要认证)
@router.get("/public/{link_id}/info")
async def get_account_info(
    link_id: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    客户通过链接获取账号信息 (公开API)
    Get account info through link (public API)
    """
    try:
        link = db.query(AccountLink).filter(AccountLink.link_id == link_id).first()
        
        if not link:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="链接不存在"
            )
        
        # 检查链接是否可访问
        if not link.is_access_allowed():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="链接已过期或访问次数已达上限"
            )
        
        # 更新访问统计
        link.access_count += 1
        link.last_access_time = datetime.now(timezone.utc)
        link.last_ip = request.client.host
        link.last_user_agent = request.headers.get("user-agent", "")
        
        # 更新链接状态
        if link.status == "unused":
            link.status = "used"
        
        db.commit()
        
        # 返回账号信息
        account_info = {
            "account_name": link.account.account_name,
            "type": link.account.type,
            "image_url": link.account.image_url,
            "description": link.account.description,
            "access_count": link.access_count,
            "max_access_count": link.max_access_count,
            "verification_count": link.verification_count,
            "max_verification_count": link.max_verification_count,
            "verification_wait_time": link.verification_wait_time,
            "can_get_verification": link.is_verification_allowed()
        }
        
        return {
            "success": True,
            "data": account_info
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取账号信息失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取账号信息失败"
        )


@router.post("/public/{link_id}/verification")
async def get_verification_codes(
    link_id: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    获取验证码 (公开API)
    Get verification codes (public API)
    
    按照开发计划要求：
    - 返回最多5条符合规则的最新短信
    - 次数限制和冷却机制
    """
    try:
        link = db.query(AccountLink).filter(AccountLink.link_id == link_id).first()
        
        if not link:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="链接不存在"
            )
        
        # 检查是否允许获取验证码
        if not link.is_verification_allowed():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="验证码获取次数已达上限或冷却时间未到"
            )
        
        # 导入短信规则匹配函数
        from ..models.sms_rule import SMSRule
        from ..api.sms import match_sms_with_rules
        
        # 获取该设备的所有激活短信规则
        active_rules = db.query(SMSRule).filter(
            and_(
                SMSRule.device_id == link.device_id,
                SMSRule.is_active == True
            )
        ).order_by(desc(SMSRule.priority)).all()
        
        # 获取该设备的所有短信
        all_sms = db.query(SMS).filter(
            SMS.device_id == link.device_id
        ).order_by(desc(SMS.sms_timestamp)).all()
        
        # 使用规则匹配短信，找出符合规则的短信
        matched_sms = []
        for sms in all_sms:
            matched_rules = match_sms_with_rules(sms, active_rules)
            if matched_rules:
                # 如果有匹配的规则，添加到结果中
                matched_sms.append({
                    "sms": sms,
                    "matched_rules": matched_rules
                })
        
        # 如果没有规则匹配的短信，使用默认的验证码检测逻辑
        if not matched_sms:
            verification_keywords = [
                "验证码", "verification", "code", "验证", "确认码", "动态码",
                "安全码", "登录码", "注册码", "找回密码", "身份验证"
            ]
            
            for sms in all_sms:
                content_lower = sms.content.lower()
                for keyword in verification_keywords:
                    if keyword in content_lower:
                        matched_sms.append({
                            "sms": sms,
                            "matched_rules": []
                        })
                        break
        
        # 取最多5条最新的匹配短信
        matched_sms = matched_sms[:5]
        
        # 更新验证码获取统计
        link.verification_count += 1
        link.last_verification_time = datetime.now(timezone.utc)
        db.commit()
        
        # 构建响应数据
        sms_data = []
        for item in matched_sms:
            sms = item["sms"]
            sms_data.append({
                "sender": sms.sender,
                "content": sms.content,
                "timestamp": sms.sms_timestamp.isoformat() if sms.sms_timestamp else None,
                "category": sms.category,
                "matched_rules": [rule.rule_name for rule in item["matched_rules"]]
            })
        
        return {
            "success": True,
            "data": {
                "sms_list": sms_data,
                "count": len(sms_data),
                "verification_count": link.verification_count,
                "max_verification_count": link.max_verification_count,
                "next_allowed_time": (
                    link.last_verification_time + timedelta(seconds=10)  # 使用固定的10秒间隔
                ).isoformat() if link.last_verification_time else None,
                "rules_applied": len(active_rules) > 0
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取验证码失败: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取验证码失败"
        )


@router.get("/statistics/overview")
async def get_links_statistics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取链接统计概览
    Get links statistics overview
    """
    try:
        # 基础统计
        total_links = db.query(AccountLink).count()
        active_links = db.query(AccountLink).filter(AccountLink.is_active == True).count()
        used_links = db.query(AccountLink).filter(AccountLink.status == "used").count()
        unused_links = db.query(AccountLink).filter(AccountLink.status == "unused").count()
        expired_links = db.query(AccountLink).filter(AccountLink.status == "expired").count()
        
        # 今日访问统计
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_access = db.query(AccountLink).filter(AccountLink.last_access_time >= today).count()
        
        # 验证码获取统计
        from sqlalchemy import func
        total_verifications = db.query(func.sum(AccountLink.verification_count)).scalar() or 0
        
        return {
            "success": True,
            "data": {
                "links": {
                    "total": total_links,
                    "active": active_links,
                    "inactive": total_links - active_links,
                    "used": used_links,
                    "unused": unused_links,
                    "expired": expired_links
                },
                "usage": {
                    "today_access": today_access,
                    "total_verifications": total_verifications
                }
            }
        }
        
    except Exception as e:
        logger.error(f"获取链接统计失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取链接统计失败"
        )
