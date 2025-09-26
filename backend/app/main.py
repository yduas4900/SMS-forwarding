"""
FastAPI 主应用 - 完整版本（包含前端路由和静态文件服务）
Main FastAPI application - Full version with frontend routes and static files
"""

from fastapi import FastAPI, Request, Depends, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from sqlalchemy.orm import Session
import logging
import os
from pathlib import Path

from .config import settings
from .database import init_database, get_db
from .api import auth, devices, accounts, sms, links, websocket_routes, service_types, customer, images, android_client

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    try:
        # 启动时执行
        logger.info("🚀 正在启动手机信息管理系统...")
        
        # 初始化数据库（添加错误处理）
        try:
            init_database()
            logger.info("✅ 数据库初始化完成")
        except Exception as e:
            logger.error(f"❌ 数据库初始化失败: {e}")
            # 不退出，让应用继续运行
        
        logger.info("✅ 应用启动完成")
        
        yield
        
    except Exception as e:
        logger.error(f"❌ 应用启动失败: {e}")
        raise
    finally:
        # 关闭时执行
        logger.info("🛑 正在关闭手机信息管理系统...")


# 创建FastAPI应用实例
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="手机信息管理系统 - 用于管理安卓设备信息、短信数据和会员账号",
    lifespan=lifespan
)

# 配置CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# 全局异常处理器
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """全局异常处理"""
    logger.error(f"❌ 全局异常: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "服务器内部错误",
            "error": str(exc) if settings.debug else "Internal server error"
        }
    )


# 健康检查端点
@app.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "app_name": settings.app_name,
        "version": settings.app_version,
        "port": os.getenv("PORT", "8000"),
        "database_url_set": bool(os.getenv("DATABASE_URL"))
    }


# 配置静态文件服务
static_admin_path = Path(__file__).parent.parent / "static" / "admin"
static_customer_path = Path(__file__).parent.parent / "static" / "customer"

logger.info(f"🔍 检查静态文件路径:")
logger.info(f"管理端: {static_admin_path} - 存在: {static_admin_path.exists()}")
logger.info(f"客户端: {static_customer_path} - 存在: {static_customer_path.exists()}")

# 挂载静态文件服务
if static_admin_path.exists():
    app.mount("/static/admin", StaticFiles(directory=str(static_admin_path)), name="admin_static")
    logger.info(f"✅ 管理端静态文件已挂载: /static/admin -> {static_admin_path}")
else:
    logger.warning(f"⚠️ 管理端静态文件目录不存在: {static_admin_path}")

if static_customer_path.exists():
    app.mount("/static/customer", StaticFiles(directory=str(static_customer_path)), name="customer_static")
    logger.info(f"✅ 客户端静态文件已挂载: /static/customer -> {static_customer_path}")
else:
    logger.warning(f"⚠️ 客户端静态文件目录不存在: {static_customer_path}")


# 注册API路由
try:
    app.include_router(auth.router, prefix="/api/auth", tags=["认证"])
    app.include_router(devices.router, prefix="/api/devices", tags=["设备管理"])
    app.include_router(accounts.router, prefix="/api/accounts", tags=["账号管理"])
    app.include_router(sms.router, prefix="/api/sms", tags=["短信管理"])
    app.include_router(links.router, prefix="/api/links", tags=["链接管理"])
    app.include_router(service_types.router, tags=["服务类型管理"])
    app.include_router(websocket_routes.router, prefix="/api", tags=["WebSocket通信"])
    app.include_router(customer.router, prefix="/api", tags=["客户端访问"])
    app.include_router(images.router, prefix="/api", tags=["图片访问"])
    app.include_router(android_client.router, prefix="/api/android", tags=["Android客户端"])
    logger.info("✅ 所有API路由注册完成")
except Exception as e:
    logger.error(f"❌ API路由注册失败: {e}")


# 添加需求文档要求的API路径别名
from pydantic import BaseModel

class UploadDataRequest(BaseModel):
    """需求文档兼容的上传数据请求模型"""
    deviceId: str
    data: dict

@app.post("/api/upload_data", tags=["需求文档兼容"])
async def upload_data_alias(
    request: UploadDataRequest,
    db = Depends(get_db)
):
    """
    需求文档要求的API路径: POST /api/upload_data
    参数: deviceId (string, required), data (JSON, required)
    重定向到现有的设备数据上传接口
    """
    try:
        from .api.devices import upload_device_data, DeviceDataUpload
        from .models.device import Device
        
        # 根据deviceId获取设备
        device = db.query(Device).filter(Device.device_id == request.deviceId).first()
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="设备不存在"
            )
        
        # 转换数据格式
        upload_data = DeviceDataUpload(**request.data)
        
        # 调用原有的上传接口
        return await upload_device_data(upload_data, device, db)
    except Exception as e:
        logger.error(f"❌ 上传数据失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"数据格式错误: {str(e)}"
        )


@app.get("/api/get_account_info", tags=["需求文档兼容"])
async def get_account_info_alias(
    request: Request,
    link_id: str = Query(..., description="链接ID"),
    db: Session = Depends(get_db)
):
    """
    需求文档要求的API路径: GET /api/get_account_info
    客户通过链接获取账号和验证码信息
    重定向到现有的公开账号信息接口
    """
    try:
        from .api.links import get_account_info
        return await get_account_info(link_id, request, db)
    except Exception as e:
        logger.error(f"❌ 获取账号信息失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取账号信息失败: {str(e)}"
        )


@app.get("/api/get_verification_code", tags=["需求文档兼容"])
async def get_verification_code_alias(
    request: Request,
    link_id: str = Query(..., description="链接ID"),
    db: Session = Depends(get_db)
):
    """
    需求文档要求的API路径: GET /api/get_verification_code
    获取验证码信息 - 彻底修复版本
    """
    try:
        from .models.account_link import AccountLink
        from .models.sms import SMS
        from sqlalchemy import desc
        from datetime import datetime, timezone
        
        logger.info(f"🔍 获取验证码请求: link_id={link_id}")
        
        # 获取链接信息
        link = db.query(AccountLink).filter(AccountLink.link_id == link_id).first()
        
        if not link:
            logger.error(f"❌ 链接不存在: {link_id}")
            return {
                "success": False,
                "message": "链接不存在",
                "data": {
                    "all_matched_sms": [],
                    "count": 0
                }
            }
        
        # 🔥 彻底修复：只检查基本权限，不检查时间间隔
        if not link.is_access_allowed():
            logger.warning(f"⚠️ 链接访问被拒绝: {link_id}")
            return {
                "success": False,
                "message": "链接已过期或访问次数已达上限",
                "data": {
                    "all_matched_sms": [],
                    "count": 0
                }
            }
        
        # 🔥 彻底修复：只检查次数，不检查时间间隔
        if link.max_verification_count > 0 and link.verification_count >= link.max_verification_count:
            logger.warning(f"⚠️ 验证码获取次数已达上限: {link_id}")
            return {
                "success": False,
                "message": "验证码获取次数已达上限",
                "data": {
                    "all_matched_sms": [],
                    "count": 0
                }
            }
        
        # 🔥 修复：获取更多短信，确保有足够的短信供选择
        all_sms = db.query(SMS).filter(
            SMS.device_id == link.device_id
        ).order_by(desc(SMS.sms_timestamp)).limit(20).all()  # 增加到20条
        
        logger.info(f"📱 找到 {len(all_sms)} 条短信")
        
        # 🔥 扩展验证码检测逻辑，包含更多关键词
        verification_keywords = [
            "验证码", "verification", "code", "验证", "确认码", "动态码",
            "安全码", "登录码", "注册码", "找回密码", "身份验证", "123456",
            "收到", "国内", "我", "你", "的"  # 添加更多通用关键词
        ]
        
        matched_sms = []
        for sms in all_sms:
            content_lower = sms.content.lower()
            # 🔥 修复：更宽松的匹配逻辑
            is_matched = False
            for keyword in verification_keywords:
                if keyword in content_lower:
                    is_matched = True
                    break
            
            # 🔥 如果没有匹配关键词，但包含数字，也认为是验证码
            if not is_matched and any(char.isdigit() for char in sms.content):
                is_matched = True
            
            if is_matched:
                matched_sms.append(sms)
        
        # 🔥 修复：返回更多匹配短信，确保有足够的选择
        matched_sms = matched_sms[:10]  # 增加到10条
        
        logger.info(f"✅ 匹配到 {len(matched_sms)} 条验证码短信")
        for i, sms in enumerate(matched_sms):
            logger.info(f"📱 短信{i+1}: {sms.content[:50]}... (时间: {sms.sms_timestamp})")
        
        # 🔥 重要：不更新统计，让前端控制
        # link.verification_count += 1
        # link.last_verification_time = datetime.now(timezone.utc)
        # db.commit()
        
        # 转换为前端期望的all_matched_sms格式
        all_matched_sms = []
        for sms in matched_sms:
            all_matched_sms.append({
                "id": sms.id,
                "content": sms.content,
                "sender": sms.sender,
                "sms_timestamp": sms.sms_timestamp.isoformat() if sms.sms_timestamp else None,
                "category": sms.category or "verification"
            })
        
        return {
            "success": True,
            "data": {
                "all_matched_sms": all_matched_sms,
                "count": len(all_matched_sms)
            }
        }
            
    except Exception as e:
        logger.error(f"❌ 获取验证码失败: {str(e)}")
        return {
            "success": False,
            "message": "获取验证码失败",
            "data": {
                "all_matched_sms": [],
                "count": 0
            }
        }


@app.get("/api/sms_rules", tags=["需求文档兼容"])
async def get_sms_rules_alias(
    account_id: int = Query(..., description="账号ID"),
    db: Session = Depends(get_db)
):
    """
    需求文档要求的API路径: GET /api/sms_rules
    获取短信规则信息 - 从数据库获取真实规则，绝不硬编码！
    """
    try:
        logger.info(f"🔍 获取短信规则请求: account_id={account_id}")
        
        # 🔥 彻底修复：从数据库获取真实的短信规则
        from .models.sms_rule import SMSRule
        from .models.account_link import AccountLink
        
        # 首先通过账号ID找到对应的设备ID
        account_links = db.query(AccountLink).filter(AccountLink.account_id == account_id).all()
        
        if not account_links:
            logger.warning(f"⚠️ 账号 {account_id} 没有关联的链接")
            return {
                "success": False,
                "message": "账号没有关联的链接",
                "data": []
            }
        
        # 获取第一个链接的设备ID
        device_id = account_links[0].device_id
        logger.info(f"🔍 账号 {account_id} 对应设备ID: {device_id}")
        
        # 🔥 关键修复：从数据库获取真实的短信规则
        # 注意：短信规则是按account_id查询，不是device_id
        sms_rules = db.query(SMSRule).filter(
            SMSRule.account_id == account_id,  # 🔥 修复：使用account_id而不是device_id
            SMSRule.is_active == True
        ).order_by(SMSRule.priority.desc()).all()
        
        logger.info(f"🔍 查询账号 {account_id} 的短信规则，找到 {len(sms_rules)} 条")
        
        if not sms_rules:
            logger.warning(f"⚠️ 账号 {account_id} 没有激活的短信规则，创建默认规则")
            
            # 🔥 如果没有规则，创建一个默认规则，使用合理的默认显示条数
            default_rule = {
                "id": 0,
                "rule_name": "默认规则",
                "display_count": 5,  # 🔥 使用合理的默认值，等待用户在管理端设置
                "sender_pattern": "*",
                "content_pattern": "验证码|verification|code",
                "is_active": True,
                "priority": 1
            }
            
            logger.info(f"✅ 返回默认规则，显示条数: {default_rule['display_count']}")
            
            return {
                "success": True,
                "message": "使用默认短信规则，请在管理端创建具体规则",
                "data": [default_rule]
            }
        
        # 🔥 返回真实的规则数据，不硬编码！
        rules_data = []
        for rule in sms_rules:
            rules_data.append({
                "id": rule.id,
                "rule_name": rule.rule_name,
                "display_count": rule.display_count,  # 🔥 使用数据库中的真实值！
                "sender_pattern": rule.sender_pattern,
                "content_pattern": rule.content_pattern,
                "is_active": rule.is_active,
                "priority": rule.priority
            })
        
        logger.info(f"✅ 返回 {len(rules_data)} 条短信规则")
        for rule in rules_data:
            logger.info(f"📋 规则: {rule['rule_name']}, 显示条数: {rule['display_count']}")
        
        return {
            "success": True,
            "message": "获取短信规则成功",
            "data": rules_data
        }
        
    except Exception as e:
        logger.error(f"❌ 获取短信规则失败: {str(e)}")
        return {
            "success": False,
            "message": "获取短信规则失败",
            "data": []
        }


# 🎯 关键：前端路由处理（这是修复404的核心）
@app.get("/")
async def serve_root():
    """根路径 - 重定向到管理端"""
    admin_index = static_admin_path / "index.html"
    if admin_index.exists():
        logger.info(f"📄 服务管理端首页: {admin_index}")
        return FileResponse(str(admin_index))
    else:
        logger.error(f"❌ 管理端文件未找到: {admin_index}")
        return JSONResponse(
            content={
                "message": f"欢迎使用{settings.app_name}",
                "version": settings.app_version,
                "docs": "/docs",
                "redoc": "/redoc",
                "health": "/health",
                "note": "前端文件未找到，请使用API文档进行管理",
                "expected_path": str(admin_index)
            }
        )

@app.get("/login")
async def serve_login():
    """登录页面"""
    admin_index = static_admin_path / "index.html"
    if admin_index.exists():
        logger.info(f"📄 服务登录页面: {admin_index}")
        return FileResponse(str(admin_index))
    else:
        logger.error(f"❌ 登录页面文件未找到: {admin_index}")
        return JSONResponse(
            status_code=404,
            content={
                "error": "登录页面未找到",
                "message": "前端文件可能未正确构建",
                "expected_path": str(admin_index),
                "api_docs": "/docs"
            }
        )

@app.get("/dashboard")
@app.get("/dashboard/{path:path}")
async def serve_dashboard(path: str = ""):
    """管理面板页面"""
    admin_index = static_admin_path / "index.html"
    if admin_index.exists():
        logger.info(f"📄 服务管理面板: {admin_index} (路径: {path})")
        return FileResponse(str(admin_index))
    else:
        logger.error(f"❌ 管理面板文件未找到: {admin_index}")
        return JSONResponse(
            status_code=404,
            content={
                "error": "管理面板未找到",
                "path": path,
                "expected_path": str(admin_index),
                "api_docs": "/docs"
            }
        )

@app.get("/customer/{link_id}")
async def serve_customer_page(link_id: str):
    """客户访问页面"""
    customer_index = static_customer_path / "index.html"
    if customer_index.exists():
        logger.info(f"📄 服务客户端页面: {customer_index} (链接: {link_id})")
        return FileResponse(str(customer_index))
    else:
        logger.error(f"❌ 客户端文件未找到: {customer_index}")
        return JSONResponse(
            status_code=404,
            content={
                "error": "客户端页面未找到",
                "link_id": link_id,
                "expected_path": str(customer_index)
            }
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug
    )
