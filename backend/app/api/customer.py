"""
客户端访问API
Customer access APIs
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_
from datetime import datetime, timezone
from typing import Optional
import logging

from ..database import get_db
from ..models.account_link import AccountLink
from ..models.account import Account
from ..models.sms import SMS

logger = logging.getLogger(__name__)
router = APIRouter()


def match_sms_with_rule(sms, rule):
    """
    检查短信是否匹配规则
    """
    import re
    
    # 检查发送方匹配
    if rule.sender_pattern and rule.sender_pattern.strip() and rule.sender_pattern != "*":
        sender_match = False
        
        if rule.sender_match_type == 'exact':
            sender_match = sms.sender == rule.sender_pattern
        elif rule.sender_match_type == 'fuzzy':
            # 🔥 重大修复：正确处理所有类型的模糊匹配和通配符
            if '*' in rule.sender_pattern:
                # 处理包含通配符的模式
                if rule.sender_pattern.startswith('*') and rule.sender_pattern.endswith('*'):
                    # 两端都有通配符，如 "*191*" 匹配 "+8619162317587"
                    middle_part = rule.sender_pattern[1:-1]
                    sender_match = middle_part.lower() in sms.sender.lower()
                elif rule.sender_pattern.endswith('*'):
                    # 前缀匹配，如 "+86191*" 匹配 "+8619162317587"
                    prefix = rule.sender_pattern[:-1]
                    sender_match = sms.sender.startswith(prefix)
                elif rule.sender_pattern.startswith('*'):
                    # 后缀匹配，如 "*123"
                    suffix = rule.sender_pattern[1:]
                    sender_match = sms.sender.endswith(suffix)
                else:
                    # 中间有通配符的复杂情况，转换为正则表达式
                    pattern_regex = rule.sender_pattern.replace('*', '.*')
                    try:
                        sender_match = bool(re.search(pattern_regex, sms.sender, re.IGNORECASE))
                    except re.error:
                        sender_match = False
            else:
                # 没有通配符，直接包含匹配
                sender_match = rule.sender_pattern.lower() in sms.sender.lower()
        elif rule.sender_match_type == 'regex':
            try:
                sender_match = bool(re.search(rule.sender_pattern, sms.sender))
            except re.error:
                sender_match = False
        
        if not sender_match:
            return False
    
    # 检查内容匹配
    if rule.content_pattern and rule.content_pattern.strip() and rule.content_pattern != "*":
        content_match = False
        
        if rule.content_match_type == 'exact':
            content_match = sms.content == rule.content_pattern
        elif rule.content_match_type == 'fuzzy':
            # 🔥 重大修复：正确处理所有类型的内容模糊匹配和通配符
            if '*' in rule.content_pattern:
                # 处理包含通配符的模式
                if rule.content_pattern.startswith('*') and rule.content_pattern.endswith('*'):
                    # 两端都有通配符，如 "*验证码*" 匹配包含"验证码"的内容
                    middle_part = rule.content_pattern[1:-1]
                    content_match = middle_part.lower() in sms.content.lower()
                elif rule.content_pattern.endswith('*'):
                    # 前缀匹配
                    prefix = rule.content_pattern[:-1]
                    content_match = prefix in sms.content
                elif rule.content_pattern.startswith('*'):
                    # 后缀匹配
                    suffix = rule.content_pattern[1:]
                    content_match = sms.content.endswith(suffix)
                else:
                    # 中间有通配符的复杂情况，转换为正则表达式
                    pattern_regex = rule.content_pattern.replace('*', '.*')
                    try:
                        content_match = bool(re.search(pattern_regex, sms.content, re.IGNORECASE))
                    except re.error:
                        content_match = False
            else:
                # 没有通配符，直接包含匹配
                content_match = rule.content_pattern.lower() in sms.content.lower()
        elif rule.content_match_type == 'regex':
            try:
                content_match = bool(re.search(rule.content_pattern, sms.content))
            except re.error:
                content_match = False
        
        if not content_match:
            return False
    
    return True


@router.get("/get_account_info")
async def get_account_info(
    link_id: str = Query(..., description="链接ID"),
    db: Session = Depends(get_db)
):
    """
    通过链接ID获取账号信息（智能访问次数管理）
    Get account info by link ID (smart access count management)
    """
    try:
        # 查找链接
        link = db.query(AccountLink).filter(AccountLink.link_id == link_id).first()
        
        if not link:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="链接不存在或已失效"
            )
        
        # 检查链接是否有效
        if not link.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="链接已失效"
            )
        
        # 检查访问次数限制
        if link.access_count >= link.max_access_count:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="访问次数已达上限"
            )
        
        # 获取账号信息
        account = db.query(Account).filter(Account.id == link.account_id).first()
        
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="关联账号不存在"
            )
        
        # 🔥 重大修复：可配置的智能访问次数管理
        # 使用数据库中配置的访问会话间隔，而不是硬编码的5分钟
        should_increment_access = True
        if link.last_access_time:
            time_diff = (datetime.now(timezone.utc) - link.last_access_time).total_seconds()
            # 使用可配置的访问会话间隔（分钟转换为秒）
            session_interval_seconds = (link.access_session_interval or 5) * 60
            if time_diff < session_interval_seconds:
                should_increment_access = False
        
        if should_increment_access:
            # 增加访问次数
            link.access_count += 1
            link.last_access_time = datetime.now(timezone.utc)
            db.commit()
            logger.info(f"客户端首次访问: Link ID {link_id}, 访问次数增加到 {link.access_count}/{link.max_access_count}")
        else:
            logger.info(f"客户端重复访问: Link ID {link_id}, 访问次数保持 {link.access_count}/{link.max_access_count}")
        
        # 构建响应数据
        account_data = {
            "id": account.id,
            "account_name": account.account_name,
            "username": account.username,
            "password": account.password,  # 明文密码
            "type": account.type,
            "image_url": account.image_url,
            "status": account.status
        }
        
        link_data = {
            "id": link.id,
            "link_id": link.link_id,
            "access_count": link.access_count,
            "max_access_count": link.max_access_count,
            "verification_count": link.verification_count,
            "max_verification_count": link.max_verification_count,
            "verification_wait_time": link.verification_wait_time,  # 验证码等待时间
            "access_session_interval": link.access_session_interval,  # 访问会话间隔
            "last_verification_time": link.last_verification_time.isoformat() if link.last_verification_time else None,
            "is_active": link.is_active,
            "created_at": link.created_at.isoformat() if link.created_at else None
        }
        
        # 不返回短信数据，短信由前端状态管理
        sms_data = []
        
        return {
            "success": True,
            "data": {
                "account_info": account_data,
                "link_info": link_data,
                "sms_data": sms_data
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取账号信息失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取账号信息失败"
        )


@router.get("/get_verification_code")
async def get_latest_verification_code(
    link_id: str = Query(..., description="链接ID"),
    db: Session = Depends(get_db)
):
    """
    获取最新验证码
    Get latest verification code
    """
    try:
        # 验证链接权限
        link = db.query(AccountLink).filter(
            and_(
                AccountLink.link_id == link_id,
                AccountLink.is_active == True
            )
        ).first()
        
        if not link:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权限访问此账号信息"
            )
        
        # 检查验证码获取是否被允许（包括时间间隔和次数限制）
        if not link.is_verification_allowed():
            # 计算剩余等待时间
            remaining_time = 0
            if link.last_verification_time:
                time_diff = (datetime.now(timezone.utc) - link.last_verification_time).total_seconds()
                remaining_time = max(0, link.verification_interval - int(time_diff))
            
            # 检查是否是次数限制
            if link.max_verification_count > 0 and link.verification_count >= link.max_verification_count:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="验证码获取次数已达上限"
                )
            
            # 如果是时间间隔限制
            if remaining_time > 0:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"请等待 {remaining_time} 秒后再试",
                    headers={"Retry-After": str(remaining_time)}
                )
        
        # 获取账号信息
        account = db.query(Account).filter(Account.id == link.account_id).first()
        
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="账号不存在"
            )
        
        # 根据短信规则获取匹配的验证码短信
        from ..models.sms_rule import SMSRule
        
        # 获取该账号的所有活跃规则
        active_rules = db.query(SMSRule).filter(
            and_(
                SMSRule.account_id == account.id,
                SMSRule.is_active == True
            )
        ).all()
        
        # 🔥 新功能：根据规则的显示条数设置返回多条匹配的短信
        # 这样可以完全覆盖客户端显示的短信内容
        matched_sms_list = []
        display_count = 5  # 默认显示条数
        
        if active_rules:
            # 获取最大显示条数（取所有活跃规则中的最大值，用于客户端倍数倍计时）
            display_count = max((rule.display_count for rule in active_rules if hasattr(rule, 'display_count') and rule.display_count), default=5)
            
            # 根据规则匹配所有短信，不限制category
            all_sms = db.query(SMS).filter(
                SMS.device_id == account.primary_device_id
            ).order_by(desc(SMS.sms_timestamp)).all()
            
            # 对每条短信检查是否匹配任何规则
            for sms in all_sms:
                for rule in active_rules:
                    if match_sms_with_rule(sms, rule):
                        matched_sms_list.append(sms)
                        break  # 匹配到一个规则就够了，避免重复
                
                # 如果已经达到显示条数，停止匹配
                if len(matched_sms_list) >= display_count:
                    break
            
            # 确保短信按时间倒序排列（最新的在最上面）
            matched_sms_list = sorted(matched_sms_list, key=lambda x: x.sms_timestamp, reverse=True)
        else:
            # 如果没有活跃规则，使用默认显示条数
            display_count = 3
            latest_sms_list = db.query(SMS).filter(
                SMS.device_id == account.primary_device_id
            ).order_by(desc(SMS.sms_timestamp)).limit(display_count).all()
            matched_sms_list = latest_sms_list
        
        if not matched_sms_list:
            return {
                "success": False,
                "message": "未找到匹配的短信"
            }
        
        # 🔥 重大修复：不再要求必须包含验证码，只要匹配规则就返回短信
        # 从匹配的短信中尝试提取验证码（可选）
        verification_code = None
        verification_sms = matched_sms_list[0]  # 使用第一条匹配的短信
        
        # 尝试提取验证码（如果有的话）
        import re
        patterns = [
            r'验证码[：:\s]*(\d{4,8})',
            r'verification code[：:\s]*(\d{4,8})',
            r'code[：:\s]*(\d{4,8})',
            r'(\d{4,8})[^0-9]*验证码',
            r'【.*】.*?(\d{4,8})',
            r'(?:验证码|code|密码)[^0-9]*(\d{4,8})'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, verification_sms.content, re.IGNORECASE)
            if match:
                verification_code = match.group(1)
                break
        
        # 🔥 新功能：动态获取最新短信，支持实时更新
        # 不在这里等待，而是返回当前匹配的短信，让前端处理倒计时和动态获取
        import asyncio
        if link.verification_wait_time and link.verification_wait_time > 0:
            logger.info(f"验证码等待时间: {link.verification_wait_time}秒，将在前端处理动态获取...")
        
        # 🔥 关键修复：即使没有找到验证码也要返回匹配的短信
        # 更新验证码获取记录
        link.verification_count += 1
        link.last_verification_time = datetime.now(timezone.utc)
        db.commit()
        
        # 记录日志
        if verification_code:
            logger.info(f"客户端获取验证码: Account ID {account.id}, Link ID {link_id}, Code: {verification_code}, 获取次数: {link.verification_count}/{link.max_verification_count}, 返回短信数: {len(matched_sms_list)}")
        else:
            logger.info(f"客户端获取匹配短信: Account ID {account.id}, Link ID {link_id}, 无验证码, 获取次数: {link.verification_count}/{link.max_verification_count}, 返回短信数: {len(matched_sms_list)}")
        
        # 🔥 关键修复：确保返回verification_count字段，解决前端次数不更新问题
        logger.info(f"🔥 customer.py API返回数据: verification_count={link.verification_count}, max_verification_count={link.max_verification_count}")
        
        # 🔥 新功能：返回所有匹配的短信，用于完全覆盖客户端显示
        return {
            "success": True,
            "data": {
                "verification_code": verification_code,  # 可能为None
                "sender": verification_sms.sender,
                "content": verification_sms.content,  # 返回完整的短信内容
                "sms_timestamp": verification_sms.sms_timestamp.isoformat() if verification_sms.sms_timestamp else None,
                "display_count": display_count,  # 🔥 新增：返回显示条数，用于客户端倍数倍计时
                "verification_count": link.verification_count,  # 🔥 关键修复：返回更新后的验证码次数
                "max_verification_count": link.max_verification_count,  # 🔥 关键修复：返回最大次数
                # 新增：返回所有匹配的短信列表
                "all_matched_sms": [
                    {
                        "id": sms.id,
                        "sender": sms.sender,
                        "content": sms.content,  # 这里返回完整的短信内容
                        "sms_timestamp": sms.sms_timestamp.isoformat() if sms.sms_timestamp else None,
                        "category": sms.category
                    }
                    for sms in matched_sms_list
                ]
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取验证码失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取验证码失败"
        )


@router.get("/get_existing_sms")
async def get_existing_sms(
    link_id: str = Query(..., description="链接ID"),
    db: Session = Depends(get_db)
):
    """
    获取已有的匹配短信（不增加验证码获取次数，用于页面刷新时显示）
    Get existing matched SMS (without incrementing verification count, for page refresh display)
    """
    try:
        # 验证链接权限
        link = db.query(AccountLink).filter(
            and_(
                AccountLink.link_id == link_id,
                AccountLink.is_active == True
            )
        ).first()
        
        if not link:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权限访问此账号信息"
            )
        
        # 获取账号信息
        account = db.query(Account).filter(Account.id == link.account_id).first()
        
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="账号不存在"
            )
        
        # 根据短信规则获取匹配的短信
        from ..models.sms_rule import SMSRule
        
        # 获取该账号的所有活跃规则
        active_rules = db.query(SMSRule).filter(
            and_(
                SMSRule.account_id == account.id,
                SMSRule.is_active == True
            )
        ).all()
        
        # 获取匹配的短信和显示条数
        matched_sms_list = []
        display_count = 5  # 默认显示条数
        
        if active_rules:
            # 获取最大显示条数
            display_count = max((rule.display_count for rule in active_rules if hasattr(rule, 'display_count') and rule.display_count), default=5)
            
            # 根据规则匹配所有短信
            all_sms = db.query(SMS).filter(
                SMS.device_id == account.primary_device_id
            ).order_by(desc(SMS.sms_timestamp)).all()
            
            # 对每条短信检查是否匹配任何规则
            for sms in all_sms:
                for rule in active_rules:
                    if match_sms_with_rule(sms, rule):
                        matched_sms_list.append(sms)
                        break  # 匹配到一个规则就够了，避免重复
                
                # 如果已经达到显示条数，停止匹配
                if len(matched_sms_list) >= display_count:
                    break
            
            # 确保短信按时间倒序排列（最新的在最上面）
            matched_sms_list = sorted(matched_sms_list, key=lambda x: x.sms_timestamp, reverse=True)
        else:
            # 如果没有活跃规则，使用默认显示条数
            display_count = 3
            latest_sms_list = db.query(SMS).filter(
                SMS.device_id == account.primary_device_id
            ).order_by(desc(SMS.sms_timestamp)).limit(display_count).all()
            matched_sms_list = latest_sms_list
        
        # 🔥 关键：不增加验证码获取次数，只返回已有短信
        logger.info(f"获取已有短信: Link ID {link_id}, 返回短信数: {len(matched_sms_list)}, 显示条数: {display_count}")
        
        # 返回已有短信和显示条数
        return {
            "success": True,
            "data": {
                "display_count": display_count,
                "all_matched_sms": [
                    {
                        "id": sms.id,
                        "sender": sms.sender,
                        "content": sms.content,
                        "sms_timestamp": sms.sms_timestamp.isoformat() if sms.sms_timestamp else None,
                        "category": sms.category
                    }
                    for sms in matched_sms_list
                ]
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取已有短信失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取已有短信失败"
        )


@router.get("/get_latest_sms")
async def get_latest_sms(
    link_id: str = Query(..., description="链接ID"),
    exclude_ids: str = Query("", description="排除的短信ID列表，用逗号分隔"),
    after_timestamp: str = Query("", description="获取此时间之后的短信"),
    db: Session = Depends(get_db)
):
    """
    获取最新的匹配短信（排除已获取的短信，支持时间过滤）
    Get latest matched SMS (excluding already fetched SMS, with timestamp filtering)
    """
    try:
        # 验证链接权限
        link = db.query(AccountLink).filter(
            and_(
                AccountLink.link_id == link_id,
                AccountLink.is_active == True
            )
        ).first()
        
        if not link:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权限访问此账号信息"
            )
        
        # 获取账号信息
        account = db.query(Account).filter(Account.id == link.account_id).first()
        
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="账号不存在"
            )
        
        # 解析排除的短信ID列表
        exclude_sms_ids = []
        if exclude_ids.strip():
            try:
                exclude_sms_ids = [int(id_str.strip()) for id_str in exclude_ids.split(',') if id_str.strip()]
            except ValueError:
                pass  # 忽略无效的ID
        
        # 解析时间过滤条件
        after_time = None
        if after_timestamp.strip():
            try:
                from datetime import datetime
                after_time = datetime.fromisoformat(after_timestamp.replace('Z', '+00:00'))
            except ValueError:
                pass  # 忽略无效的时间格式
        
        # 根据短信规则获取匹配的验证码短信
        from ..models.sms_rule import SMSRule
        
        # 获取该账号的所有活跃规则
        active_rules = db.query(SMSRule).filter(
            and_(
                SMSRule.account_id == account.id,
                SMSRule.is_active == True
            )
        ).all()
        
        # 🔥 新功能：动态获取最新短信，支持时间过滤和排除已获取的短信
        matched_sms_list = []
        
        if active_rules:
            # 构建查询条件
            query_conditions = [
                SMS.device_id == account.primary_device_id
            ]
            
            # 排除已获取的短信
            if exclude_sms_ids:
                query_conditions.append(~SMS.id.in_(exclude_sms_ids))
            
            # 时间过滤条件
            if after_time:
                query_conditions.append(SMS.sms_timestamp > after_time)
            
            # 根据规则匹配所有短信
            all_sms = db.query(SMS).filter(
                and_(*query_conditions)
            ).order_by(desc(SMS.sms_timestamp)).all()
            
            # 对每条短信检查是否匹配任何规则
            for sms in all_sms:
                for rule in active_rules:
                    if match_sms_with_rule(sms, rule):
                        matched_sms_list.append(sms)
                        break  # 匹配到一个规则就够了，避免重复
                
                # 只获取一条最新的匹配短信
                if len(matched_sms_list) >= 1:
                    break
            
            # 确保短信按时间倒序排列（最新的在最上面）
            matched_sms_list = sorted(matched_sms_list, key=lambda x: x.sms_timestamp, reverse=True)
        else:
            # 如果没有活跃规则，获取最新的短信（排除已获取的）
            query_conditions = [SMS.device_id == account.primary_device_id]
            
            if exclude_sms_ids:
                query_conditions.append(~SMS.id.in_(exclude_sms_ids))
            
            if after_time:
                query_conditions.append(SMS.sms_timestamp > after_time)
            
            latest_sms = db.query(SMS).filter(
                and_(*query_conditions)
            ).order_by(desc(SMS.sms_timestamp)).first()
            
            if latest_sms:
                matched_sms_list = [latest_sms]
        
        if not matched_sms_list:
            return {
                "success": False,
                "message": "未找到新的匹配短信",
                "data": None
            }
        
        # 获取最新的一条短信
        latest_sms = matched_sms_list[0]
        
        # 尝试提取验证码
        verification_code = None
        import re
        patterns = [
            r'验证码[：:\s]*(\d{4,8})',
            r'verification code[：:\s]*(\d{4,8})',
            r'code[：:\s]*(\d{4,8})',
            r'(\d{4,8})[^0-9]*验证码',
            r'【.*】.*?(\d{4,8})',
            r'(?:验证码|code|密码)[^0-9]*(\d{4,8})'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, latest_sms.content, re.IGNORECASE)
            if match:
                verification_code = match.group(1)
                break
        
        logger.info(f"实时获取最新短信: Link ID {link_id}, SMS ID {latest_sms.id}, 排除ID: {exclude_sms_ids}, 时间过滤: {after_timestamp}")
        
        # 返回最新的短信
        return {
            "success": True,
            "data": {
                "id": latest_sms.id,
                "sender": latest_sms.sender,
                "content": latest_sms.content,
                "sms_timestamp": latest_sms.sms_timestamp.isoformat() if latest_sms.sms_timestamp else None,
                "category": latest_sms.category,
                "verification_code": verification_code
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取最新短信失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取最新短信失败"
        )
