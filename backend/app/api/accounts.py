"""
账号管理API
Account management APIs
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, and_
from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel
import logging

from ..database import get_db
from ..models.account import Account
from ..models.device import Device
from ..models.user import User
from ..api.auth import get_current_user
from ..services.image_storage import image_storage

logger = logging.getLogger(__name__)
router = APIRouter()


# Pydantic 模型
class AccountCreate(BaseModel):
    """创建账号请求模型"""
    account_name: str
    username: Optional[str] = None
    password: Optional[str] = None
    type: Optional[str] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    primary_device_id: int  # 必须绑定一个设备


class AccountUpdate(BaseModel):
    """更新账号请求模型"""
    account_name: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    type: Optional[str] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    primary_device_id: Optional[int] = None  # 可选更新绑定设备


class AccountResponse(BaseModel):
    """账号响应模型"""
    id: int
    account_name: str
    username: Optional[str]
    type: Optional[str]
    image_url: Optional[str]
    description: Optional[str]
    status: str
    created_at: str
    updated_at: str


# API 端点
@router.post("/", response_model=dict)
async def create_account(
    account_data: AccountCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    创建新账号
    Create new account
    """
    try:
        # 检查账号名称是否已存在
        existing_account = db.query(Account).filter(Account.account_name == account_data.account_name).first()
        if existing_account:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="账号名称已存在"
            )
        
        # 验证设备是否存在
        device = db.query(Device).filter(Device.id == account_data.primary_device_id).first()
        if not device:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="指定的设备不存在"
            )
        
        # 注释：允许多个账号绑定同一个设备，移除唯一性检查
        # existing_binding = db.query(Account).filter(Account.primary_device_id == account_data.primary_device_id).first()
        # if existing_binding:
        #     raise HTTPException(
        #         status_code=status.HTTP_400_BAD_REQUEST,
        #         detail=f"设备已被账号 '{existing_binding.account_name}' 绑定"
        #     )
        
        # 处理图片数据
        processed_image_url = account_data.image_url
        if account_data.image_url and image_storage.is_base64_image(account_data.image_url):
            # 如果是Base64图片，转换为文件存储
            # 清理账号名称中的空白字符（治本方案）
            import re
            clean_account_name = re.sub(r'\s+', '_', account_data.account_name.strip())
            
            saved_path = image_storage.save_base64_image(
                account_data.image_url, 
                f"account_{clean_account_name}"
            )
            if saved_path:
                processed_image_url = f"http://localhost:8000/api/images/{saved_path.split('/')[-1]}"
                logger.info(f"Base64图片已转换为文件存储: {processed_image_url}")
            else:
                logger.warning("Base64图片转换失败，使用原始数据")
        
        # 创建新账号
        new_account = Account(
            account_name=account_data.account_name,
            username=account_data.username,
            password=account_data.password,
            type=account_data.type,
            image_url=processed_image_url,
            description=account_data.description,
            primary_device_id=account_data.primary_device_id,
            status="active"
        )
        
        db.add(new_account)
        db.commit()
        db.refresh(new_account)
        
        logger.info(f"账号创建成功: {account_data.account_name}, 绑定设备: {device.device_id}")
        
        return {
            "success": True,
            "message": "账号创建成功",
            "data": new_account.to_dict()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建账号失败: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="创建账号失败"
        )


@router.get("/list")
async def get_accounts_list(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    type_filter: Optional[str] = Query(None, description="类型筛选"),
    status_filter: Optional[str] = Query(None, description="状态筛选"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取账号列表
    Get accounts list with pagination and filtering
    """
    try:
        # 构建查询
        query = db.query(Account)
        
        # 搜索过滤
        if search:
            query = query.filter(
                or_(
                    Account.account_name.ilike(f"%{search}%"),
                    Account.username.ilike(f"%{search}%"),
                    Account.type.ilike(f"%{search}%"),
                    Account.description.ilike(f"%{search}%")
                )
            )
        
        # 类型过滤
        if type_filter:
            query = query.filter(Account.type == type_filter)
        
        # 状态过滤
        if status_filter:
            query = query.filter(Account.status == status_filter)
        
        # 计算总数
        total = query.count()
        
        # 分页查询
        accounts = query.order_by(desc(Account.created_at)).offset((page - 1) * page_size).limit(page_size).all()
        
        return {
            "success": True,
            "data": {
                "accounts": [account.to_dict() for account in accounts],
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total": total,
                    "pages": (total + page_size - 1) // page_size
                }
            }
        }
        
    except Exception as e:
        logger.error(f"获取账号列表失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取账号列表失败"
        )


@router.get("/types/list")
async def get_account_types(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取所有账号类型
    Get all account types
    """
    try:
        # 获取所有不同的账号类型
        types = db.query(Account.type).filter(Account.type.isnot(None)).distinct().all()
        type_list = [t[0] for t in types if t[0]]
        
        return {
            "success": True,
            "data": type_list
        }
        
    except Exception as e:
        logger.error(f"获取账号类型失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取账号类型失败"
        )


@router.get("/available-devices")
async def get_available_devices(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取所有设备列表（包含绑定统计信息）
    Get all devices list with binding statistics
    """
    try:
        # 获取所有设备（不再过滤已绑定的设备）
        all_devices = db.query(Device).order_by(desc(Device.created_at)).all()
        
        devices_data = []
        for device in all_devices:
            device_dict = device.to_dict()
            
            # 计算绑定到此设备的账号数量
            bound_accounts_count = db.query(Account).filter(Account.primary_device_id == device.id).count()
            device_dict["bound_accounts_count"] = bound_accounts_count
            
            # 获取绑定到此设备的账号列表（用于显示详细信息）
            bound_accounts = db.query(Account).filter(Account.primary_device_id == device.id).all()
            device_dict["bound_accounts"] = [{"id": acc.id, "account_name": acc.account_name} for acc in bound_accounts]
            
            # 添加状态描述
            if device.is_online:
                device_dict["status_text"] = "在线"
                device_dict["status_color"] = "green"
            else:
                device_dict["status_text"] = "离线"
                device_dict["status_color"] = "red"
            
            # 添加最后活跃时间描述
            if device.last_heartbeat:
                from datetime import datetime, timezone
                now = datetime.now(timezone.utc)
                time_diff = now - device.last_heartbeat
                if time_diff.total_seconds() < 60:
                    device_dict["last_active_text"] = "刚刚"
                elif time_diff.total_seconds() < 3600:
                    minutes = int(time_diff.total_seconds() / 60)
                    device_dict["last_active_text"] = f"{minutes}分钟前"
                elif time_diff.total_seconds() < 86400:
                    hours = int(time_diff.total_seconds() / 3600)
                    device_dict["last_active_text"] = f"{hours}小时前"
                else:
                    days = int(time_diff.total_seconds() / 86400)
                    device_dict["last_active_text"] = f"{days}天前"
            else:
                device_dict["last_active_text"] = "从未活跃"
            
            devices_data.append(device_dict)
        
        return {
            "success": True,
            "data": devices_data
        }
        
    except Exception as e:
        logger.error(f"获取设备列表失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取设备列表失败"
        )


@router.get("/{account_id}/sms")
async def get_account_sms(
    account_id: int,
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    category: Optional[str] = Query(None, description="分类筛选"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    start_date: Optional[str] = Query(None, description="开始日期"),
    end_date: Optional[str] = Query(None, description="结束日期"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取指定账号的短信列表
    Get SMS list for specific account
    """
    try:
        # 验证账号是否存在
        account = db.query(Account).filter(Account.id == account_id).first()
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="账号不存在"
            )
        
        # 验证账号是否绑定了设备
        if not account.primary_device_id:
            return {
                "success": True,
                "data": {
                    "account_info": account.to_dict(),
                    "device_info": None,
                    "sms_list": [],
                    "pagination": {
                        "page": page,
                        "page_size": page_size,
                        "total": 0,
                        "pages": 0
                    }
                }
            }
        
        # 获取设备信息
        device = db.query(Device).filter(Device.id == account.primary_device_id).first()
        
        # 构建短信查询
        from ..models.sms import SMS
        query = db.query(SMS).filter(SMS.device_id == account.primary_device_id)
        
        # 分类筛选
        if category:
            query = query.filter(SMS.category == category)
        
        # 搜索过滤
        if search:
            query = query.filter(
                or_(
                    SMS.sender.ilike(f"%{search}%"),
                    SMS.content.ilike(f"%{search}%")
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
            sms_dict['account_info'] = {
                'id': account.id,
                'account_name': account.account_name,
                'username': account.username,
                'type': account.type
            }
            sms_data.append(sms_dict)
        
        return {
            "success": True,
            "data": {
                "account_info": account.to_dict(),
                "device_info": device.to_dict() if device else None,
                "sms_list": sms_data,
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total": total,
                    "pages": (total + page_size - 1) // page_size
                }
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取账号短信失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取账号短信失败"
        )


@router.get("/{account_id}/latest-verification-code")
async def get_account_latest_verification_code(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取指定账号的最新验证码
    Get latest verification code for specific account
    """
    try:
        # 验证账号是否存在
        account = db.query(Account).filter(Account.id == account_id).first()
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="账号不存在"
            )
        
        if not account.primary_device_id:
            return {
                "success": True,
                "data": {
                    "account_info": account.to_dict(),
                    "verification_code": None,
                    "message": "账号未绑定设备"
                }
            }
        
        # 查询最新的验证码短信
        from ..models.sms import SMS
        latest_verification_sms = db.query(SMS).filter(
            and_(
                SMS.device_id == account.primary_device_id,
                SMS.category == "verification"
            )
        ).order_by(desc(SMS.sms_timestamp)).first()
        
        if not latest_verification_sms:
            return {
                "success": True,
                "data": {
                    "account_info": account.to_dict(),
                    "verification_code": None,
                    "message": "暂无验证码短信"
                }
            }
        
        # 提取验证码
        import re
        verification_patterns = [
            r'验证码[：:\s]*(\d{4,8})',
            r'verification code[：:\s]*(\d{4,8})',
            r'code[：:\s]*(\d{4,8})',
            r'(\d{4,8})[^0-9]*验证码',
            r'【.*】.*?(\d{4,8})',
            r'(?:验证码|code|密码)[^0-9]*(\d{4,8})'
        ]
        
        extracted_code = None
        for pattern in verification_patterns:
            match = re.search(pattern, latest_verification_sms.content, re.IGNORECASE)
            if match:
                extracted_code = match.group(1)
                break
        
        return {
            "success": True,
            "data": {
                "account_info": account.to_dict(),
                "verification_code": {
                    "code": extracted_code,
                    "sms_content": latest_verification_sms.content,
                    "sender": latest_verification_sms.sender,
                    "received_at": latest_verification_sms.sms_timestamp.isoformat() if latest_verification_sms.sms_timestamp else None,
                    "sms_id": latest_verification_sms.id
                }
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取账号最新验证码失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取账号最新验证码失败"
        )


@router.get("/statistics/overview")
async def get_accounts_statistics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取账号统计概览
    Get accounts statistics overview
    """
    try:
        # 基础统计
        total_accounts = db.query(Account).count()
        active_accounts = db.query(Account).filter(Account.status == "active").count()
        inactive_accounts = db.query(Account).filter(Account.status == "inactive").count()
        suspended_accounts = db.query(Account).filter(Account.status == "suspended").count()
        
        # 按类型统计
        from sqlalchemy import func
        type_stats = db.query(
            Account.type,
            func.count(Account.id).label('count')
        ).filter(Account.type.isnot(None)).group_by(Account.type).all()
        
        type_distribution = {stat.type: stat.count for stat in type_stats}
        
        return {
            "success": True,
            "data": {
                "total": total_accounts,
                "active": active_accounts,
                "inactive": inactive_accounts,
                "suspended": suspended_accounts,
                "type_distribution": type_distribution
            }
        }
        
    except Exception as e:
        logger.error(f"获取账号统计失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取账号统计失败"
        )


@router.get("/{account_id}")
async def get_account_detail(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取账号详细信息
    Get account detailed information
    """
    try:
        account = db.query(Account).filter(Account.id == account_id).first()
        
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="账号不存在"
            )
        
        # 获取账号相关统计信息
        from ..models.account_link import AccountLink
        links_count = db.query(AccountLink).filter(AccountLink.account_id == account.id).count()
        active_links = db.query(AccountLink).filter(
            AccountLink.account_id == account.id,
            AccountLink.is_active == True
        ).count()
        
        account_info = account.to_dict()
        account_info.update({
            "statistics": {
                "total_links": links_count,
                "active_links": active_links
            }
        })
        
        return {
            "success": True,
            "data": account_info
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取账号详情失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取账号详情失败"
        )


@router.put("/{account_id}")
async def update_account(
    account_id: int,
    account_data: AccountUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    更新账号信息
    Update account information
    """
    try:
        account = db.query(Account).filter(Account.id == account_id).first()
        
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="账号不存在"
            )
        
        # 检查账号名称是否重复
        if account_data.account_name and account_data.account_name != account.account_name:
            existing_account = db.query(Account).filter(
                Account.account_name == account_data.account_name,
                Account.id != account_id
            ).first()
            if existing_account:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="账号名称已存在"
                )
        
        # 更新字段
        update_fields = []
        if account_data.account_name is not None:
            account.account_name = account_data.account_name
            update_fields.append("account_name")
        
        if account_data.username is not None:
            account.username = account_data.username
            update_fields.append("username")
        
        if account_data.password is not None:
            account.password = account_data.password
            update_fields.append("password")
        
        if account_data.type is not None:
            account.type = account_data.type
            update_fields.append("type")
        
        if account_data.image_url is not None:
            # 处理图片数据
            processed_image_url = account_data.image_url
            if account_data.image_url and image_storage.is_base64_image(account_data.image_url):
                # 如果是Base64图片，转换为文件存储
                # 清理账号名称中的空白字符（治本方案）
                import re
                clean_account_name = re.sub(r'\s+', '_', account.account_name.strip())
                
                saved_path = image_storage.save_base64_image(
                    account_data.image_url, 
                    f"account_{clean_account_name}"
                )
                if saved_path:
                    # 删除旧的图片文件（如果存在）
                    if account.image_url and account.image_url.startswith('/api/images/'):
                        old_filename = account.image_url.split('/')[-1]
                        image_storage.delete_image(f"uploads/images/{old_filename}")
                    
                    processed_image_url = f"http://localhost:8000/api/images/{saved_path.split('/')[-1]}"
                    logger.info(f"Base64图片已转换为文件存储: {processed_image_url}")
                else:
                    logger.warning("Base64图片转换失败，使用原始数据")
            
            account.image_url = processed_image_url
            update_fields.append("image_url")
        
        if account_data.description is not None:
            account.description = account_data.description
            update_fields.append("description")
        
        if account_data.status is not None:
            account.status = account_data.status
            update_fields.append("status")
        
        if account_data.primary_device_id is not None:
            # 验证设备是否存在
            device = db.query(Device).filter(Device.id == account_data.primary_device_id).first()
            if not device:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="指定的设备不存在"
                )
            
            # 注释：允许多个账号绑定同一个设备，移除唯一性检查
            # existing_binding = db.query(Account).filter(
            #     Account.primary_device_id == account_data.primary_device_id,
            #     Account.id != account_id
            # ).first()
            # if existing_binding:
            #     raise HTTPException(
            #         status_code=status.HTTP_400_BAD_REQUEST,
            #         detail=f"设备已被账号 '{existing_binding.account_name}' 绑定"
            #     )
            
            account.primary_device_id = account_data.primary_device_id
            update_fields.append("primary_device_id")
        
        account.updated_at = datetime.now(timezone.utc)
        db.commit()
        
        logger.info(f"账号更新成功: {account.account_name}, 更新字段: {update_fields}")
        
        return {
            "success": True,
            "message": "账号更新成功",
            "data": account.to_dict()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新账号失败: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新账号失败"
        )


@router.delete("/{account_id}")
async def delete_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    删除账号（级联删除关联数据）
    Delete account with cascade deletion of related data
    """
    try:
        account = db.query(Account).filter(Account.id == account_id).first()
        
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="账号不存在"
            )
        
        # 获取关联的链接数量（用于日志记录）
        from ..models.account_link import AccountLink
        linked_count = db.query(AccountLink).filter(AccountLink.account_id == account.id).count()
        
        account_name = account.account_name
        
        # 级联删除：先删除所有关联的链接
        if linked_count > 0:
            logger.info(f"开始删除账号 {account_name} 的 {linked_count} 个关联链接")
            db.query(AccountLink).filter(AccountLink.account_id == account.id).delete()
            logger.info(f"成功删除 {linked_count} 个关联链接")
        
        # 删除账号
        db.delete(account)
        db.commit()
        
        if linked_count > 0:
            logger.info(f"账号删除成功: {account_name}，同时删除了 {linked_count} 个关联链接")
            success_message = f"账号删除成功，同时删除了 {linked_count} 个关联链接"
        else:
            logger.info(f"账号删除成功: {account_name}")
            success_message = "账号删除成功"
        
        return {
            "success": True,
            "message": success_message,
            "deleted_links_count": linked_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除账号失败: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除账号失败"
        )
