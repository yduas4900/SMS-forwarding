"""
WebSocket API 路由
WebSocket API routes
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from fastapi.security import HTTPBearer
from typing import Optional
import logging
import json

from ..websocket import manager
from ..database import get_db
from ..models.user import User
from ..api.auth import create_access_token
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from ..config import settings

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer()


async def get_current_user_websocket(websocket: WebSocket, token: str = None) -> Optional[dict]:
    """WebSocket认证 - 从查询参数获取token"""
    if not token:
        return None
    
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        return payload
    except JWTError as e:
        logger.error(f"WebSocket认证失败: {e}")
        return None


@router.websocket("/ws/admin")
async def websocket_admin_endpoint(
    websocket: WebSocket,
    token: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """管理员WebSocket端点"""
    
    # 验证管理员token
    user_info = None
    if token:
        user_info = await get_current_user_websocket(websocket, token)
        if not user_info:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    
    # 建立连接
    user_id = user_info.get("sub") if user_info else "anonymous"
    await manager.connect(websocket, user_id=user_id, user_type="admin")
    
    try:
        while True:
            # 接收客户端消息
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                message_type = message.get("type")
                
                # 处理不同类型的消息
                if message_type == "ping":
                    # 心跳检测
                    await manager.send_personal_message({
                        "type": "pong",
                        "timestamp": message.get("timestamp")
                    }, websocket)
                
                elif message_type == "get_status":
                    # 获取系统状态
                    status_info = {
                        "type": "system_status",
                        "data": {
                            "websocket_connections": manager.get_connection_count(),
                            "connections_info": manager.get_connections_info()
                        }
                    }
                    await manager.send_personal_message(status_info, websocket)
                
                elif message_type == "subscribe":
                    # 订阅特定事件
                    events = message.get("events", [])
                    await manager.send_personal_message({
                        "type": "subscription_confirmed",
                        "events": events
                    }, websocket)
                
                else:
                    # 未知消息类型
                    await manager.send_personal_message({
                        "type": "error",
                        "message": f"未知消息类型: {message_type}"
                    }, websocket)
                    
            except json.JSONDecodeError:
                await manager.send_personal_message({
                    "type": "error",
                    "message": "无效的JSON格式"
                }, websocket)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info(f"管理员WebSocket连接断开: user_id={user_id}")


@router.websocket("/ws/device/{device_id}")
async def websocket_device_endpoint(
    websocket: WebSocket,
    device_id: str,
    token: Optional[str] = None
):
    """设备WebSocket端点"""
    
    # 验证设备token
    if token:
        user_info = await get_current_user_websocket(websocket, token)
        if not user_info or user_info.get("sub") != device_id:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    
    # 建立连接
    await manager.connect(websocket, user_id=device_id, user_type="device")
    
    try:
        while True:
            # 接收设备消息
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                message_type = message.get("type")
                
                # 处理设备消息
                if message_type == "heartbeat":
                    # 设备心跳
                    await manager.send_heartbeat_update(device_id, "online")
                    await manager.send_personal_message({
                        "type": "heartbeat_ack",
                        "timestamp": message.get("timestamp")
                    }, websocket)
                
                elif message_type == "data_upload":
                    # 数据上传通知
                    await manager.send_device_update({
                        "device_id": device_id,
                        "action": "data_uploaded",
                        "data_type": message.get("data_type"),
                        "count": message.get("count", 0)
                    })
                
                elif message_type == "status_update":
                    # 状态更新
                    await manager.send_device_update({
                        "device_id": device_id,
                        "action": "status_update",
                        "status": message.get("status")
                    })
                
                else:
                    await manager.send_personal_message({
                        "type": "error",
                        "message": f"未知消息类型: {message_type}"
                    }, websocket)
                    
            except json.JSONDecodeError:
                await manager.send_personal_message({
                    "type": "error",
                    "message": "无效的JSON格式"
                }, websocket)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info(f"设备WebSocket连接断开: device_id={device_id}")


@router.websocket("/ws/customer/{link_id}")
async def websocket_customer_endpoint(
    websocket: WebSocket,
    link_id: str
):
    """客户端WebSocket端点"""
    
    # 建立连接
    await manager.connect(websocket, user_id=link_id, user_type="customer")
    
    try:
        while True:
            # 接收客户端消息
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                message_type = message.get("type")
                
                # 处理客户端消息
                if message_type == "ping":
                    # 心跳检测
                    await manager.send_personal_message({
                        "type": "pong",
                        "timestamp": message.get("timestamp")
                    }, websocket)
                
                elif message_type == "subscribe_push":
                    # 订阅推送消息
                    await manager.send_personal_message({
                        "type": "subscription_confirmed",
                        "message": "已订阅管理员推送消息"
                    }, websocket)
                
                else:
                    await manager.send_personal_message({
                        "type": "error",
                        "message": f"未知消息类型: {message_type}"
                    }, websocket)
                    
            except json.JSONDecodeError:
                await manager.send_personal_message({
                    "type": "error",
                    "message": "无效的JSON格式"
                }, websocket)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info(f"客户端WebSocket连接断开: link_id={link_id}")


@router.get("/ws/status")
async def get_websocket_status():
    """获取WebSocket状态"""
    return {
        "success": True,
        "data": {
            "total_connections": manager.get_connection_count(),
            "connections": manager.get_connections_info()
        }
    }
