"""
设备管理API
Device management APIs
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from pydantic import BaseModel
import logging

from ..database import get_db
from ..models.device import Device
from ..models.user import User
from ..models.sms import SMS
from ..api.auth import get_current_user, get_current_device
from ..config import settings
from ..websocket import manager

logger = logging.getLogger(__name__)
router = APIRouter()


# Pydantic 模型
class DeviceUploadData(BaseModel):
    """设备数据上传模型"""
    brand: Optional[str] = None
    model: Optional[str] = None
    os_version: Optional[str] = None
    network_type: Optional[str] = None
    ip_address: Optional[str] = None
    phone_number: Optional[str] = None
    extra_info: Optional[dict] = None


class SMSData(BaseModel):
    """短信数据模型"""
    sender: str
    content: str
    timestamp: str  # ISO格式时间戳
    sms_type: str = "received"


class DeviceDataUpload(BaseModel):
    """完整设备数据上传模型"""
    device_info: Optional[DeviceUploadData] = None
    sms_list: Optional[List[SMSData]] = None


class DeviceResponse(BaseModel):
    """设备响应模型"""
    id: int
    device_id: str
    brand: Optional[str]
    model: Optional[str]
    os_version: Optional[str]
    network_type: Optional[str]
    ip_address: Optional[str]
    phone_number: Optional[str]
    is_online: bool
    is_active: bool
    last_heartbeat: Optional[str]
    last_sms_time: Optional[str]
    created_at: str
    updated_at: str


# API 端点
@router.post("/upload_data")
async def upload_device_data(
    data: DeviceDataUpload,
    current_device: Device = Depends(get_current_device),
    db: Session = Depends(get_db)
):
    """
    上传设备数据
    Upload device data including device info and SMS
    """
    try:
        updated_fields = []
        
        # 更新设备信息
        if data.device_info:
            device_info = data.device_info
            if device_info.brand and device_info.brand != current_device.brand:
                current_device.brand = device_info.brand
                updated_fields.append("brand")
            
            if device_info.model and device_info.model != current_device.model:
                current_device.model = device_info.model
                updated_fields.append("model")
            
            if device_info.os_version and device_info.os_version != current_device.os_version:
                current_device.os_version = device_info.os_version
                updated_fields.append("os_version")
            
            if device_info.network_type and device_info.network_type != current_device.network_type:
                current_device.network_type = device_info.network_type
                updated_fields.append("network_type")
            
            if device_info.ip_address and device_info.ip_address != current_device.ip_address:
                current_device.ip_address = device_info.ip_address
                updated_fields.append("ip_address")
            
            if device_info.phone_number and device_info.phone_number != current_device.phone_number:
                current_device.phone_number = device_info.phone_number
                updated_fields.append("phone_number")
            
            if device_info.extra_info:
                current_device.extra_info = device_info.extra_info
                updated_fields.append("extra_info")
        
        # 处理短信数据
        sms_count = 0
        if data.sms_list:
            for sms_data in data.sms_list:
                try:
                    # 解析时间戳
                    sms_timestamp = datetime.fromisoformat(sms_data.timestamp.replace('Z', '+00:00'))
                    
                    # 检查是否已存在相同的短信 (基于发送方、内容和时间戳)
                    existing_sms = db.query(SMS).filter(
                        SMS.device_id == current_device.id,
                        SMS.sender == sms_data.sender,
                        SMS.content == sms_data.content,
                        SMS.sms_timestamp == sms_timestamp
                    ).first()
                    
                    if not existing_sms:
                        new_sms = SMS(
                            device_id=current_device.id,
                            sender=sms_data.sender,
                            content=sms_data.content,
                            sms_timestamp=sms_timestamp,
                            sms_type=sms_data.sms_type,
                            category="normal"  # 默认分类，后续可以通过规则自动分类
                        )
                        db.add(new_sms)
                        db.flush()  # 获取新短信的ID
                        sms_count += 1
                        
                        # 触发短信转发 (异步处理，不阻塞主流程)
                        try:
                            import asyncio
                            from ..services.sms_forwarder import forward_sms
                            
                            # 创建异步任务处理转发
                            loop = asyncio.get_event_loop()
                            loop.create_task(forward_sms(db, new_sms))
                            
                        except Exception as forward_error:
                            # 转发失败不影响短信保存
                            logger.warning(f"短信转发任务创建失败: {str(forward_error)}")
                        
                        # 更新设备最后短信时间
                        if not current_device.last_sms_time or sms_timestamp > current_device.last_sms_time:
                            current_device.last_sms_time = sms_timestamp
                            updated_fields.append("last_sms_time")
                
                except Exception as e:
                    logger.warning(f"处理短信数据失败: {str(e)}")
                    continue
        
        # 更新设备状态
        current_device.is_online = True
        current_device.last_heartbeat = datetime.now(timezone.utc)
        current_device.updated_at = datetime.now(timezone.utc)
        
        db.commit()
        
        # 发送WebSocket通知
        if sms_count > 0:
            await manager.send_sms_update({
                "device_id": current_device.device_id,
                "action": "new_sms",
                "count": sms_count,
                "device_info": {
                    "brand": current_device.brand,
                    "model": current_device.model,
                    "phone_number": current_device.phone_number
                }
            })
        
        if updated_fields:
            await manager.send_device_update({
                "device_id": current_device.device_id,
                "action": "data_updated",
                "updated_fields": updated_fields,
                "device_info": current_device.to_dict()
            })
        
        logger.info(f"设备数据上传成功: {current_device.device_id}, 更新字段: {updated_fields}, 新增短信: {sms_count}")
        
        return {
            "success": True,
            "message": "数据上传成功",
            "updated_fields": updated_fields,
            "sms_count": sms_count,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"设备数据上传失败: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="数据上传失败"
        )


@router.get("/list")
async def get_devices_list(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    status_filter: Optional[str] = Query(None, description="状态筛选 (online/offline/active/inactive)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取设备列表
    Get devices list with pagination and filtering
    """
    try:
        # 构建查询
        query = db.query(Device)
        
        # 搜索过滤
        if search:
            query = query.filter(
                or_(
                    Device.device_id.ilike(f"%{search}%"),
                    Device.brand.ilike(f"%{search}%"),
                    Device.model.ilike(f"%{search}%"),
                    Device.phone_number.ilike(f"%{search}%")
                )
            )
        
        # 状态过滤
        if status_filter:
            if status_filter == "online":
                query = query.filter(Device.is_online == True)
            elif status_filter == "offline":
                query = query.filter(Device.is_online == False)
            elif status_filter == "active":
                query = query.filter(Device.is_active == True)
            elif status_filter == "inactive":
                query = query.filter(Device.is_active == False)
        
        # 计算总数
        total = query.count()
        
        # 分页查询
        devices = query.order_by(desc(Device.updated_at)).offset((page - 1) * page_size).limit(page_size).all()
        
        # 更新设备在线状态 (检查心跳时间)
        now = datetime.now(timezone.utc)
        offline_threshold = timedelta(seconds=settings.offline_threshold)
        
        for device in devices:
            if device.last_heartbeat:
                # 确保last_heartbeat有时区信息
                last_heartbeat = device.last_heartbeat
                if last_heartbeat.tzinfo is None:
                    last_heartbeat = last_heartbeat.replace(tzinfo=timezone.utc)
                
                if now - last_heartbeat > offline_threshold:
                    if device.is_online:
                        device.is_online = False
                        db.commit()
        
        return {
            "success": True,
            "data": {
                "devices": [device.to_dict() for device in devices],
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total": total,
                    "pages": (total + page_size - 1) // page_size
                }
            }
        }
        
    except Exception as e:
        logger.error(f"获取设备列表失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取设备列表失败"
        )


@router.get("/{device_id}")
async def get_device_detail(
    device_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取设备详细信息
    Get device detailed information
    """
    try:
        device = db.query(Device).filter(Device.device_id == device_id).first()
        
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="设备不存在"
            )
        
        # 获取设备相关统计信息
        sms_count = db.query(SMS).filter(SMS.device_id == device.id).count()
        recent_sms = db.query(SMS).filter(SMS.device_id == device.id).order_by(desc(SMS.sms_timestamp)).limit(10).all()
        
        device_info = device.to_dict()
        device_info.update({
            "statistics": {
                "sms_count": sms_count,
                "recent_sms": [sms.to_dict() for sms in recent_sms]
            }
        })
        
        return {
            "success": True,
            "data": device_info
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取设备详情失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取设备详情失败"
        )


@router.delete("/{device_id}")
async def delete_device(
    device_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    删除设备及其相关数据
    Delete device and its related data
    """
    try:
        device = db.query(Device).filter(Device.device_id == device_id).first()
        
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="设备不存在"
            )
        
        # 删除设备 (级联删除相关数据)
        db.delete(device)
        db.commit()
        
        logger.info(f"设备删除成功: {device_id}")
        
        return {
            "success": True,
            "message": "设备删除成功"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除设备失败: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除设备失败"
        )


@router.get("/statistics/overview")
async def get_devices_statistics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取设备统计概览
    Get devices statistics overview
    """
    try:
        # 基础统计
        total_devices = db.query(Device).count()
        online_devices = db.query(Device).filter(Device.is_online == True).count()
        active_devices = db.query(Device).filter(Device.is_active == True).count()
        
        # 最近24小时新增设备
        yesterday = datetime.now(timezone.utc) - timedelta(days=1)
        new_devices_24h = db.query(Device).filter(Device.created_at >= yesterday).count()
        
        # 短信统计
        total_sms = db.query(SMS).count()
        today_sms = db.query(SMS).filter(SMS.created_at >= datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)).count()
        
        return {
            "success": True,
            "data": {
                "devices": {
                    "total": total_devices,
                    "online": online_devices,
                    "offline": total_devices - online_devices,
                    "active": active_devices,
                    "inactive": total_devices - active_devices,
                    "new_24h": new_devices_24h
                },
                "sms": {
                    "total": total_sms,
                    "today": today_sms
                }
            }
        }
        
    except Exception as e:
        logger.error(f"获取设备统计失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取设备统计失败"
        )
