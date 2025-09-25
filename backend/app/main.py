"""
FastAPI 主应用 - 完整版本（包含静态文件服务）
Main FastAPI application - Full version with static files
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


# 前端路由处理
@app.get("/")
@app.get("/login")
@app.get("/dashboard")
@app.get("/dashboard/{path:path}")
async def serve_admin_app(path: str = ""):
    """管理端应用 - 所有管理端路由"""
    admin_index = static_admin_path / "index.html"
    if admin_index.exists():
        logger.info(f"📄 服务管理端页面: {admin_index}")
        return FileResponse(str(admin_index))
    else:
        logger.error(f"❌ 管理端文件未找到: {admin_index}")
        return JSONResponse(
            status_code=404,
            content={
                "message": "管理端页面未找到",
                "note": "前端文件可能未正确构建或部署",
                "expected_path": str(admin_index),
                "api_docs": "/docs",
                "health_check": "/health"
            }
        )

@app.get("/customer/{link_id}")
async def serve_customer_page(link_id: str):
    """客户访问页面"""
    customer_index = static_customer_path / "index.html"
    if customer_index.exists():
        logger.info(f"📄 服务客户端页面: {customer_index}")
        return FileResponse(str(customer_index))
    else:
        logger.error(f"❌ 客户端文件未找到: {customer_index}")
        return JSONResponse(
            status_code=404,
            content={
                "error": "客户端页面未找到",
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
