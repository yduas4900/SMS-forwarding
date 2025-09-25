"""
设备状态监控服务
Device status monitoring service
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.device import Device
from ..config import settings
from ..websocket import manager

logger = logging.getLogger(__name__)

class DeviceMonitor:
    """设备状态监控器"""
    
    def __init__(self):
        self.running = False
        self.task = None
    
    async def start(self):
        """启动监控"""
        if self.running:
            return
        
        self.running = True
        self.task = asyncio.create_task(self._monitor_loop())
        logger.info("设备状态监控器已启动")
    
    async def stop(self):
        """停止监控"""
        self.running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        logger.info("设备状态监控器已停止")
    
    async def _monitor_loop(self):
        """监控循环"""
        while self.running:
            try:
                await self._check_device_status()
                # 每5秒检查一次，提高检测精度
                await asyncio.sleep(5)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"设备状态检查异常: {e}")
                await asyncio.sleep(10)
    
    async def _check_device_status(self):
        """检查设备状态"""
        try:
            # 获取数据库会话
            db = next(get_db())
            
            try:
                # 获取所有在线设备
                online_devices = db.query(Device).filter(Device.is_online == True).all()
                
                now = datetime.now(timezone.utc)
                offline_threshold = timedelta(seconds=settings.offline_threshold)
                
                offline_devices = []
                
                for device in online_devices:
                    if device.last_heartbeat:
                        # 确保时间有时区信息
                        last_heartbeat = device.last_heartbeat
                        if last_heartbeat.tzinfo is None:
                            last_heartbeat = last_heartbeat.replace(tzinfo=timezone.utc)
                        
                        # 计算时间差
                        time_diff = now - last_heartbeat
                        
                        # 调试日志
                        logger.info(f"设备心跳检查: {device.device_id} - 最后心跳: {last_heartbeat}, 当前时间: {now}, 时间差: {time_diff.total_seconds()}秒, 阈值: {settings.offline_threshold}秒")
                        
                        # 检查是否超时
                        if time_diff > offline_threshold:
                            device.is_online = False
                            offline_devices.append(device)
                            logger.info(f"设备离线检测: {device.device_id} - 最后心跳: {last_heartbeat}, 超时: {time_diff.total_seconds()}秒")
                
                # 批量提交更改
                if offline_devices:
                    db.commit()
                    
                    # 发送WebSocket通知
                    for device in offline_devices:
                        await manager.send_device_update({
                            "device_id": device.device_id,
                            "action": "status_changed",
                            "status": "offline",
                            "timestamp": now.isoformat()
                        })
                    
                    logger.info(f"检测到 {len(offline_devices)} 个设备离线")
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"设备状态检查失败: {e}")

# 全局监控器实例
device_monitor = DeviceMonitor()
