"""
Android客户端专用API端点
Android client specific API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Any, Optional
import time
import logging

from ..database import get_db
from ..models.device import Device
from ..models.sms import SMS

logger = logging.getLogger(__name__)

router = APIRouter()

# 数据模型
class AuthTokenRequest(BaseModel):
    device_id: str
    device_info: Optional[Dict[str, Any]] = None

class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 3600

class HeartbeatRequest(BaseModel):
    device_id: str
    timestamp: int
    status: str = "online"

class ApiResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    message: Optional[str] = None

@router.post("/auth/token")
async def get_auth_token(
    request: AuthTokenRequest,
    db: Session = Depends(get_db)
):
    """
    客户端注册并获取令牌
    Client registration and token acquisition
    """
    try:
        # 查找或创建设备
        device = db.query(Device).filter(Device.device_id == request.device_id).first()
        
        if not device:
            # 创建新设备
            device_info = request.device_info or {}
            device = Device(
                device_id=request.device_id,
                serial_number=device_info.get('serial_number', 'Unknown'),
                brand=device_info.get('brand', 'Unknown'),
                model=device_info.get('model', 'Unknown'),
                os_version=device_info.get('os_version', 'Unknown'),
                phone_number=device_info.get('phone_number', ''),
                network_type=device_info.get('network_type', 'Unknown'),
                ip_address=device_info.get('ip_address', ''),
                extra_info=device_info,
                is_active=True
            )
            db.add(device)
            db.commit()
            db.refresh(device)
            logger.info(f"创建新设备: {request.device_id}")
        else:
            # 更新设备状态
            device.is_active = True
            if request.device_info:
                device.extra_info = request.device_info
                # 更新基本信息
                device.serial_number = request.device_info.get('serial_number', device.serial_number)
                device.brand = request.device_info.get('brand', device.brand)
                device.model = request.device_info.get('model', device.model)
                device.os_version = request.device_info.get('os_version', device.os_version)
                device.phone_number = request.device_info.get('phone_number', device.phone_number)
                device.network_type = request.device_info.get('network_type', device.network_type)
                device.ip_address = request.device_info.get('ip_address', device.ip_address)
            db.commit()
            logger.info(f"更新设备状态: {request.device_id}")
        
        # 生成简单的令牌（实际项目中应使用JWT）
        token = f"token_{request.device_id}_{int(time.time())}"
        
        response_data = AuthTokenResponse(
            access_token=token,
            token_type="bearer",
            expires_in=3600
        )
        
        return ApiResponse(
            success=True,
            data=response_data.dict(),
            message="令牌获取成功"
        )
        
    except Exception as e:
        logger.error(f"获取令牌失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取令牌失败: {str(e)}"
        )

@router.post("/heartbeat")
async def send_heartbeat(
    request: HeartbeatRequest,
    db: Session = Depends(get_db)
):
    """
    发送心跳包
    Send heartbeat
    """
    try:
        # 查找设备
        device = db.query(Device).filter(Device.device_id == request.device_id).first()
        
        if not device:
            # 如果设备不存在，自动创建
            device = Device(
                device_id=request.device_id,
                brand="Unknown",
                model="Unknown",
                os_version="Unknown",
                extra_info={},
                is_active=True
            )
            db.add(device)
            logger.info(f"自动创建设备: {request.device_id}")
        
        # 检查设备之前是否离线
        was_offline = not device.is_online
        
        # 更新设备状态和最后心跳时间
        device.is_active = True
        device.is_online = True
        # 将时间戳转换为datetime对象（处理毫秒时间戳）
        from datetime import datetime
        if request.timestamp > 1000000000000:  # 毫秒时间戳
            device.last_heartbeat = datetime.fromtimestamp(request.timestamp / 1000.0)
        else:  # 秒时间戳
            device.last_heartbeat = datetime.fromtimestamp(request.timestamp)
        
        db.commit()
        
        # 如果设备从离线变为在线，发送WebSocket通知
        if was_offline:
            try:
                from ..websocket import manager
                import asyncio
                
                # 发送设备上线通知
                await manager.send_device_update({
                    "device_id": device.device_id,
                    "action": "status_changed",
                    "status": "online",
                    "timestamp": datetime.now().isoformat()
                })
                
                logger.info(f"设备上线通知已发送: {request.device_id}")
                
            except Exception as ws_error:
                logger.warning(f"发送设备上线通知失败: {ws_error}")
        
        logger.info(f"收到心跳: {request.device_id}, 时间戳: {request.timestamp}, 状态变化: {'离线→在线' if was_offline else '保持在线'}")
        
        return ApiResponse(
            success=True,
            message="心跳接收成功"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"心跳处理失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"心跳处理失败: {str(e)}"
        )

@router.get("/server_time")
async def get_server_time():
    """
    获取服务器时间（用于时间同步）
    Get server time for synchronization
    """
    try:
        current_time = int(time.time())
        
        return ApiResponse(
            success=True,
            data={"timestamp": current_time},
            message="服务器时间获取成功"
        )
        
    except Exception as e:
        logger.error(f"获取服务器时间失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取服务器时间失败: {str(e)}"
        )

@router.get("/device/{device_id}/status")
async def get_device_status(
    device_id: str,
    db: Session = Depends(get_db)
):
    """
    检查设备状态
    Check device status
    """
    try:
        device = db.query(Device).filter(Device.device_id == device_id).first()
        
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="设备不存在"
            )
        
        status_data = {
            "device_id": device.device_id,
            "is_active": device.is_active,
            "created_at": device.created_at.isoformat() if device.created_at else None,
            "updated_at": device.updated_at.isoformat() if device.updated_at else None
        }
        
        return ApiResponse(
            success=True,
            data=status_data,
            message="设备状态获取成功"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取设备状态失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取设备状态失败: {str(e)}"
        )

@router.post("/sms/upload")
async def upload_sms(
    sms_data: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """
    上传单条短信
    Upload single SMS
    """
    try:
        # 这里可以添加短信数据处理逻辑
        logger.info(f"收到短信上传: {sms_data}")
        
        return ApiResponse(
            success=True,
            message="短信上传成功"
        )
        
    except Exception as e:
        logger.error(f"短信上传失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"短信上传失败: {str(e)}"
        )

@router.post("/sms/batch_upload")
async def batch_upload_sms(
    request: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """
    批量上传短信
    Batch upload SMS
    """
    try:
        device_id = request.get('device_id')
        sms_list = request.get('sms_list', [])
        
        if not device_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="缺少device_id参数"
            )
        
        if not sms_list:
            return ApiResponse(
                success=True,
                message="没有短信数据需要上传"
            )
        
        # 查找设备
        device = db.query(Device).filter(Device.device_id == device_id).first()
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="设备不存在"
            )
        
        logger.info(f"开始处理批量短信上传: 设备 {device_id}, 短信数量 {len(sms_list)}")
        
        # 批量处理短信数据
        saved_count = 0
        duplicate_count = 0
        error_count = 0
        
        for sms_data in sms_list:
            try:
                # 提取短信数据
                sms_id = sms_data.get('id')
                sender = sms_data.get('sender', '')
                content = sms_data.get('content', '')
                sms_timestamp = sms_data.get('smsTimestamp')
                sms_type = sms_data.get('smsType', 'received')
                is_read = sms_data.get('isRead', '0')
                category = sms_data.get('category', 'normal')
                
                # 验证必要字段
                if not sender or not content:
                    logger.warning(f"跳过无效短信数据: sender={sender}, content={content}")
                    error_count += 1
                    continue
                
                # 检查是否已存在相同的短信（基于设备ID、发送方、内容和时间戳）
                existing_sms = db.query(SMS).filter(
                    SMS.device_id == device.id,
                    SMS.sender == sender,
                    SMS.content == content
                ).first()
                
                if existing_sms:
                    duplicate_count += 1
                    continue
                
                # 处理时间戳
                from datetime import datetime, timezone
                if sms_timestamp:
                    if sms_timestamp > 1000000000000:  # 毫秒时间戳
                        sms_datetime = datetime.fromtimestamp(sms_timestamp / 1000.0, tz=timezone.utc)
                    else:  # 秒时间戳
                        sms_datetime = datetime.fromtimestamp(sms_timestamp, tz=timezone.utc)
                else:
                    sms_datetime = datetime.now(timezone.utc)
                
                # 自动分类短信
                if category == 'normal':
                    category = categorize_sms(content)
                
                # 创建短信记录
                new_sms = SMS(
                    device_id=device.id,
                    sender=sender,
                    content=content,
                    sms_timestamp=sms_datetime,
                    sms_type=sms_type,
                    is_read=is_read,
                    category=category
                )
                
                db.add(new_sms)
                saved_count += 1
                
            except Exception as sms_error:
                logger.error(f"处理单条短信失败: {sms_error}")
                error_count += 1
                continue
        
        # 提交所有更改
        db.commit()
        
        # 如果有新短信保存成功，发送WebSocket实时通知
        if saved_count > 0:
            try:
                from ..websocket import manager
                
                # 发送短信更新通知到管理端
                await manager.send_sms_update({
                    "action": "new_sms_uploaded",
                    "device_id": device_id,
                    "device_internal_id": device.id,
                    "saved_count": saved_count,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
                
                logger.info(f"WebSocket短信更新通知已发送: 设备 {device_id}, 新增 {saved_count} 条短信")
                
            except Exception as ws_error:
                logger.warning(f"发送WebSocket短信更新通知失败: {ws_error}")
        
        logger.info(f"批量短信上传完成: 设备 {device_id}, 保存 {saved_count} 条, 重复 {duplicate_count} 条, 错误 {error_count} 条")
        
        return ApiResponse(
            success=True,
            message=f"批量短信上传成功: 保存 {saved_count} 条, 重复 {duplicate_count} 条, 错误 {error_count} 条",
            data={
                "saved_count": saved_count,
                "duplicate_count": duplicate_count,
                "error_count": error_count,
                "total_processed": len(sms_list)
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"批量短信上传失败: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"批量短信上传失败: {str(e)}"
        )


def categorize_sms(content: str) -> str:
    """
    自动分类短信
    Automatically categorize SMS
    """
    content_lower = content.lower()
    
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

@router.post("/contacts/upload")
async def upload_contacts(
    request: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """
    上传联系人列表
    Upload contacts list
    """
    try:
        logger.info(f"收到联系人上传: {len(request.get('contacts', []))} 个")
        
        return ApiResponse(
            success=True,
            message="联系人上传成功"
        )
        
    except Exception as e:
        logger.error(f"联系人上传失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"联系人上传失败: {str(e)}"
        )

@router.post("/call_logs/upload")
async def upload_call_logs(
    request: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """
    上传通话记录
    Upload call logs
    """
    try:
        logger.info(f"收到通话记录上传: {len(request.get('call_logs', []))} 条")
        
        return ApiResponse(
            success=True,
            message="通话记录上传成功"
        )
        
    except Exception as e:
        logger.error(f"通话记录上传失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"通话记录上传失败: {str(e)}"
        )

@router.post("/apps/upload")
async def upload_apps(
    request: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """
    上传应用列表
    Upload applications list
    """
    try:
        logger.info(f"收到应用列表上传: {len(request.get('apps', []))} 个")
        
        return ApiResponse(
            success=True,
            message="应用列表上传成功"
        )
        
    except Exception as e:
        logger.error(f"应用列表上传失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"应用列表上传失败: {str(e)}"
        )

@router.post("/location/upload")
async def upload_location(
    request: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """
    上传位置信息
    Upload location information
    """
    try:
        logger.info(f"收到位置信息上传: {request}")
        
        return ApiResponse(
            success=True,
            message="位置信息上传成功"
        )
        
    except Exception as e:
        logger.error(f"位置信息上传失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"位置信息上传失败: {str(e)}"
        )

@router.get("/config")
async def get_config():
    """
    获取配置信息
    Get configuration
    """
    try:
        config_data = {
            "heartbeat_interval": 30,
            "upload_interval": 60,
            "max_retry_count": 3,
            "server_version": "1.0.0"
        }
        
        return ApiResponse(
            success=True,
            data=config_data,
            message="配置信息获取成功"
        )
        
    except Exception as e:
        logger.error(f"获取配置信息失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取配置信息失败: {str(e)}"
        )

@router.post("/error/report")
async def report_error(
    error_report: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """
    报告错误
    Report error
    """
    try:
        logger.error(f"客户端错误报告: {error_report}")
        
        return ApiResponse(
            success=True,
            message="错误报告提交成功"
        )
        
    except Exception as e:
        logger.error(f"错误报告提交失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"错误报告提交失败: {str(e)}"
        )
