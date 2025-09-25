"""
WebSocket 实时通信模块
WebSocket real-time communication module
"""

from fastapi import WebSocket, WebSocketDisconnect
from typing import List, Dict, Any
import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class ConnectionManager:
    """WebSocket连接管理器"""
    
    def __init__(self):
        # 存储活跃的WebSocket连接
        self.active_connections: List[WebSocket] = []
        # 存储连接的用户信息
        self.connection_info: Dict[WebSocket, Dict[str, Any]] = {}
    
    async def connect(self, websocket: WebSocket, user_id: str = None, user_type: str = "admin"):
        """接受WebSocket连接"""
        await websocket.accept()
        self.active_connections.append(websocket)
        self.connection_info[websocket] = {
            "user_id": user_id,
            "user_type": user_type,
            "connected_at": datetime.utcnow(),
        }
        logger.info(f"WebSocket连接已建立: user_id={user_id}, user_type={user_type}")
        
        # 发送连接成功消息
        await self.send_personal_message({
            "type": "connection_established",
            "message": "WebSocket连接已建立",
            "timestamp": datetime.utcnow().isoformat()
        }, websocket)
    
    def disconnect(self, websocket: WebSocket):
        """断开WebSocket连接"""
        if websocket in self.active_connections:
            user_info = self.connection_info.get(websocket, {})
            self.active_connections.remove(websocket)
            if websocket in self.connection_info:
                del self.connection_info[websocket]
            logger.info(f"WebSocket连接已断开: user_id={user_info.get('user_id')}")
    
    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """发送个人消息"""
        try:
            await websocket.send_text(json.dumps(message, ensure_ascii=False))
        except Exception as e:
            logger.error(f"发送个人消息失败: {e}")
            self.disconnect(websocket)
    
    async def broadcast(self, message: dict, user_type: str = None):
        """广播消息给所有连接或特定类型用户"""
        disconnected_connections = []
        
        for connection in self.active_connections:
            try:
                # 如果指定了用户类型，只发送给该类型用户
                if user_type:
                    conn_info = self.connection_info.get(connection, {})
                    if conn_info.get("user_type") != user_type:
                        continue
                
                await connection.send_text(json.dumps(message, ensure_ascii=False))
            except Exception as e:
                logger.error(f"广播消息失败: {e}")
                disconnected_connections.append(connection)
        
        # 清理断开的连接
        for connection in disconnected_connections:
            self.disconnect(connection)
    
    async def send_device_update(self, device_data: dict):
        """发送设备状态更新"""
        message = {
            "type": "device_update",
            "data": device_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        await self.broadcast(message, user_type="admin")
    
    async def send_sms_update(self, sms_data: dict):
        """发送短信数据更新"""
        message = {
            "type": "sms_update",
            "data": sms_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        await self.broadcast(message, user_type="admin")
    
    async def send_heartbeat_update(self, device_id: str, status: str):
        """发送心跳状态更新"""
        message = {
            "type": "heartbeat_update",
            "data": {
                "device_id": device_id,
                "status": status,
                "timestamp": datetime.utcnow().isoformat()
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        await self.broadcast(message, user_type="admin")
    
    async def send_link_access_update(self, link_data: dict):
        """发送链接访问更新"""
        message = {
            "type": "link_access_update",
            "data": link_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        await self.broadcast(message, user_type="admin")
    
    async def send_admin_push_sms(self, push_data: dict):
        """发送管理员推送的短信到客户端"""
        message = {
            "type": "admin_push_sms",
            "data": push_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        await self.broadcast(message, user_type="customer")
    
    def get_connection_count(self) -> int:
        """获取当前连接数"""
        return len(self.active_connections)
    
    def get_connections_info(self) -> List[Dict[str, Any]]:
        """获取所有连接信息"""
        return [
            {
                "user_id": info.get("user_id"),
                "user_type": info.get("user_type"),
                "connected_at": info.get("connected_at").isoformat() if info.get("connected_at") else None
            }
            for info in self.connection_info.values()
        ]


# 全局连接管理器实例
manager = ConnectionManager()
