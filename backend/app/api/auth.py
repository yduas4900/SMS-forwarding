"""
认证相关API
Authentication related APIs
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
import secrets
import logging
import random
import string
from io import BytesIO
import base64
from PIL import Image, ImageDraw, ImageFont

from ..database import get_db
from ..models.device import Device
from ..models.user import User
from ..config import settings
from ..websocket import manager
from ..services.settings_service import SettingsService

# 🚨 临时修复：优雅处理TOTP服务导入失败
try:
    from ..services.totp_service import TOTPService
    TOTP_AVAILABLE = True
    logger.info("🔐 TOTP服务导入成功")
except ImportError as e:
    logger.warning(f"🔐 TOTP服务导入失败，2FA功能将被禁用: {e}")
    TOTP_AVAILABLE = False
    
    # 创建一个临时的TOTPService类以避免错误
    class TOTPService:
        @staticmethod
        def generate_secret():
            raise HTTPException(status_code=500, detail="TOTP服务不可用，请安装pyotp依赖")
        
        @staticmethod
        def generate_qr_code(*args, **kwargs):
            raise HTTPException(status_code=500, detail="TOTP服务不可用，请安装qrcode依赖")
        
        @staticmethod
        def verify_token(*args, **kwargs):
            raise HTTPException(status_code=500, detail="TOTP服务不可用，请安装pyotp依赖")
        
        @staticmethod
        def generate_backup_codes(*args, **kwargs):
            raise HTTPException(status_code=500, detail="TOTP服务不可用，请安装pyotp依赖")

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer()

# 密码加密上下文
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# Pydantic 模型
class TokenRequest(BaseModel):
    """客户端注册请求"""
    device_id: str
    brand: str = None
    model: str = None
    os_version: str = None
    phone_number: str = None


class TokenResponse(BaseModel):
    """令牌响应"""
    access_token: str
    token_type: str = "bearer"
    device_id: str


class LoginRequest(BaseModel):
    """管理员登录请求"""
    username: str
    password: str


class LoginResponse(BaseModel):
    """登录响应"""
    access_token: str
    token_type: str = "bearer"
    user_info: dict


class UpdateProfileRequest(BaseModel):
    """更新个人资料请求"""
    username: str = None
    email: str = None
    full_name: str = None
    phone: str = None


class ChangePasswordRequest(BaseModel):
    """修改密码请求"""
    current_password: str
    new_password: str
    confirm_password: str


# 工具函数
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """获取密码哈希"""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: timedelta = None, db: Session = None):
    """创建访问令牌"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        # 从数据库获取会话超时时间设置
        session_timeout = settings.access_token_expire_minutes  # 默认值
        if db:
            try:
                session_timeout = SettingsService.get_setting(db, "sessionTimeout", settings.access_token_expire_minutes)
                logger.info(f"使用数据库中的会话超时时间: {session_timeout} 分钟")
            except Exception as e:
                logger.warning(f"获取会话超时设置失败，使用默认值: {e}")
        
        expire = datetime.now(timezone.utc) + timedelta(minutes=session_timeout)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt


def generate_device_token() -> str:
    """生成设备API令牌"""
    return secrets.token_urlsafe(32)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """获取当前用户"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(credentials.credentials, settings.secret_key, algorithms=[settings.algorithm])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user


async def get_current_device(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """获取当前设备"""
    device = db.query(Device).filter(Device.api_token == credentials.credentials).first()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的设备令牌"
        )
    return device


# API 端点
@router.post("/token", response_model=TokenResponse)
async def register_device(request: TokenRequest, db: Session = Depends(get_db)):
    """
    客户端注册并获取令牌
    Device registration and token acquisition
    """
    try:
        # 检查设备是否已存在
        existing_device = db.query(Device).filter(Device.device_id == request.device_id).first()
        
        if existing_device:
            # 更新现有设备信息
            if request.brand:
                existing_device.brand = request.brand
            if request.model:
                existing_device.model = request.model
            if request.os_version:
                existing_device.os_version = request.os_version
            if request.phone_number:
                existing_device.phone_number = request.phone_number
            
            existing_device.updated_at = datetime.now(timezone.utc)
            db.commit()
            
            logger.info(f"设备更新: {request.device_id}")
            return TokenResponse(
                access_token=existing_device.api_token,
                device_id=existing_device.device_id
            )
        else:
            # 创建新设备
            api_token = generate_device_token()
            new_device = Device(
                device_id=request.device_id,
                brand=request.brand,
                model=request.model,
                os_version=request.os_version,
                phone_number=request.phone_number,
                api_token=api_token,
                is_online=True
            )
            
            db.add(new_device)
            db.commit()
            db.refresh(new_device)
            
            logger.info(f"新设备注册: {request.device_id}")
            return TokenResponse(
                access_token=api_token,
                device_id=new_device.device_id
            )
            
    except Exception as e:
        logger.error(f"设备注册失败: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="设备注册失败"
        )


@router.post("/login")
async def login_admin(request: LoginRequest, db: Session = Depends(get_db)):
    """
    管理员登录 - 完整安全版本（包含登录失败次数限制和锁定）
    Admin login - Complete security version (with login failure limit and locking)
    """
    try:
        logger.info(f"🔐 普通登录尝试: {request.username}")
        
        user = db.query(User).filter(User.username == request.username).first()
        
        if not user:
            logger.warning(f"用户不存在: {request.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户名或密码错误"
            )
        
        # 🚨 新增：检查用户是否被锁定
        if hasattr(user, 'locked_until') and user.locked_until:
            current_time = datetime.now(timezone.utc)
            if current_time < user.locked_until:
                remaining_time = (user.locked_until - current_time).total_seconds() / 60
                logger.error(f"🔒 用户 {request.username} 仍在锁定期内，剩余时间: {remaining_time:.1f} 分钟")
                raise HTTPException(
                    status_code=status.HTTP_423_LOCKED,
                    detail=f"账户已被锁定，请等待 {remaining_time:.1f} 分钟后再试"
                )
            else:
                # 锁定期已过，清除锁定状态
                logger.info(f"🔓 用户 {request.username} 锁定期已过，清除锁定状态")
                user.locked_until = None
                if hasattr(user, 'failed_login_attempts'):
                    user.failed_login_attempts = 0
                db.commit()
        
        logger.info(f"找到用户: {user.username}, 验证密码...")
        
        if not verify_password(request.password, user.hashed_password):
            logger.warning(f"🚨 密码验证失败: {request.username}")
            # 🚨 新增：处理登录失败，增加失败计数和锁定检查
            await handle_login_failure(user, db)
            
            # 检查是否需要立即锁定
            if hasattr(user, 'failed_login_attempts') and hasattr(user, 'locked_until'):
                max_attempts = SettingsService.get_setting(db, "maxLoginAttempts", 5)
                current_attempts = user.failed_login_attempts or 0
                
                if current_attempts >= max_attempts and user.locked_until:
                    lock_duration = SettingsService.get_setting(db, "loginLockDuration", 30)
                    logger.error(f"🔒 用户 {request.username} 登录失败次数达到上限，已被锁定 {lock_duration} 分钟")
                    raise HTTPException(
                        status_code=status.HTTP_423_LOCKED,
                        detail=f"登录失败次数过多，账户已被锁定 {lock_duration} 分钟"
                    )
                else:
                    remaining_attempts = max_attempts - current_attempts
                    logger.warning(f"🚨 用户 {request.username} 密码错误，剩余尝试次数: {remaining_attempts}")
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail=f"用户名或密码错误，剩余尝试次数: {remaining_attempts}"
                    )
            else:
                # 用户表没有安全字段，返回普通错误
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="用户名或密码错误"
                )
        
        if not user.is_active:
            logger.warning(f"用户账号已被禁用: {request.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户账号已被禁用"
            )
        
        # 🚨 新增：登录成功，重置失败计数和锁定状态
        if hasattr(user, 'failed_login_attempts'):
            user.failed_login_attempts = 0
        if hasattr(user, 'locked_until'):
            user.locked_until = None
        
        # 更新登录信息
        user.last_login = datetime.now(timezone.utc)
        if user.login_count is None:
            user.login_count = 0
        user.login_count += 1
        db.commit()
        
        # 🚨 修复：使用数据库中的会话超时时间设置
        try:
            session_timeout = SettingsService.get_setting(db, "sessionTimeout", 30)
            logger.info(f"普通登录使用数据库中的会话超时时间: {session_timeout} 分钟")
        except Exception as e:
            logger.warning(f"获取会话超时设置失败，使用默认值30分钟: {e}")
            session_timeout = 30
        
        access_token = create_access_token(
            data={"sub": user.username},
            expires_delta=timedelta(minutes=session_timeout)
        )
        
        logger.info(f"🔐 普通登录成功: {user.username}")
        
        # 返回标准格式，与前端期望一致
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user_info": user.to_dict()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"登录过程中发生错误: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="登录过程中发生错误"
        )


async def handle_login_failure(user: User, db: Session):
    """处理登录失败"""
    try:
        # 如果用户表没有安全字段，跳过登录失败处理
        if not hasattr(user, 'failed_login_attempts'):
            logger.info(f"用户表缺少安全字段，跳过登录失败处理: {user.username}")
            return
        
        # 获取最大登录尝试次数设置
        max_attempts = 5  # 默认值
        try:
            max_attempts = SettingsService.get_setting(db, "maxLoginAttempts", 5)
            logger.info(f"使用数据库中的最大登录尝试次数: {max_attempts}")
        except Exception as e:
            logger.warning(f"获取最大登录尝试次数设置失败，使用默认值: {e}")
        
        # 增加失败计数
        if user.failed_login_attempts is None:
            user.failed_login_attempts = 0
        user.failed_login_attempts += 1
        
        if hasattr(user, 'last_failed_login'):
            user.last_failed_login = datetime.now(timezone.utc)
        
        logger.warning(f"用户 {user.username} 登录失败，当前失败次数: {user.failed_login_attempts}/{max_attempts}")
        
        # 🚨 修复：检查是否需要锁定账户，使用数据库设置
        if user.failed_login_attempts >= max_attempts and hasattr(user, 'locked_until'):
            # 🚨 修复：使用数据库中的锁定时间设置，而不是硬编码
            try:
                lock_duration_minutes = SettingsService.get_setting(db, "loginLockDuration", 30)
                logger.info(f"使用数据库中的登录锁定时间: {lock_duration_minutes} 分钟")
            except Exception as e:
                logger.warning(f"获取登录锁定时间设置失败，使用默认值30分钟: {e}")
                lock_duration_minutes = 30
            
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=lock_duration_minutes)
            logger.warning(f"用户 {user.username} 达到最大失败次数，锁定 {lock_duration_minutes} 分钟")
        
        db.commit()
        
    except Exception as e:
        logger.error(f"处理登录失败时出错: {e}")
        db.rollback()


@router.get("/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """
    获取当前用户信息
    Get current user information
    """
    return {
        "success": True,
        "data": current_user.to_dict()
    }


@router.put("/profile")
async def update_profile(
    request: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    更新个人资料
    Update user profile
    """
    try:
        username_changed = False
        old_username = current_user.username
        
        # 检查用户名是否已被其他用户使用
        if request.username and request.username != current_user.username:
            existing_user = db.query(User).filter(
                User.username == request.username,
                User.id != current_user.id
            ).first()
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="用户名已被使用"
                )
            username_changed = True
        
        # 检查邮箱是否已被其他用户使用
        if request.email and request.email != current_user.email:
            existing_user = db.query(User).filter(
                User.email == request.email,
                User.id != current_user.id
            ).first()
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="邮箱已被使用"
                )
        
        # 更新用户信息
        if request.username:
            current_user.username = request.username
        if request.email:
            current_user.email = request.email
        if request.full_name:
            current_user.full_name = request.full_name
        if request.phone:
            current_user.phone = request.phone
        
        current_user.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(current_user)
        
        # 如果用户名发生变化，生成新的JWT token
        new_token = None
        if username_changed:
            access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
            new_token = create_access_token(
                data={"sub": current_user.username}, 
                expires_delta=access_token_expires
            )
            logger.info(f"用户名从 {old_username} 更改为 {current_user.username}，生成新token")
        
        response_data = {
            "success": True,
            "message": "个人资料更新成功",
            "data": current_user.to_dict()
        }
        
        # 如果生成了新token，添加到响应中
        if new_token:
            response_data["new_token"] = new_token
            response_data["token_type"] = "bearer"
            response_data["message"] = "个人资料更新成功，用户名已更改，请使用新凭据登录"
        
        logger.info(f"用户资料更新成功: {current_user.username}")
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新个人资料失败: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新个人资料失败"
        )


@router.put("/password")
async def change_password(
    request: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    修改密码
    Change password
    """
    try:
        # 验证当前密码
        if not verify_password(request.current_password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="当前密码错误"
            )
        
        # 验证新密码确认
        if request.new_password != request.confirm_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="新密码与确认密码不匹配"
            )
        
        # 验证新密码强度 - 使用数据库中的密码最小长度设置
        min_password_length = 6  # 默认值
        try:
            min_password_length = SettingsService.get_setting(db, "passwordMinLength", 6)
            logger.info(f"使用数据库中的密码最小长度: {min_password_length}")
        except Exception as e:
            logger.warning(f"获取密码最小长度设置失败，使用默认值: {e}")
        
        if len(request.new_password) < min_password_length:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"新密码长度至少为{min_password_length}位"
            )
        
        # 更新密码
        current_user.hashed_password = get_password_hash(request.new_password)
        current_user.updated_at = datetime.now(timezone.utc)
        db.commit()
        
        logger.info(f"用户密码修改成功: {current_user.username}")
        return {
            "success": True,
            "message": "密码修改成功"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"修改密码失败: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="修改密码失败"
        )


@router.post("/heartbeat")
async def device_heartbeat(
    current_device: Device = Depends(get_current_device),
    db: Session = Depends(get_db)
):
    """
    设备心跳
    Device heartbeat
    """
    try:
        # 更新设备心跳时间和在线状态
        current_device.last_heartbeat = datetime.now(timezone.utc)
        current_device.is_online = True
        db.commit()
        
        # 发送WebSocket心跳通知
        await manager.send_heartbeat_update(current_device.device_id, "online")
        
        return {
            "success": True,
            "message": "心跳更新成功",
            "timestamp": current_device.last_heartbeat.isoformat()
        }
        
    except Exception as e:
        logger.error(f"心跳更新失败: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="心跳更新失败"
        )


# 验证码相关功能
captcha_store = {}  # 临时存储验证码，生产环境建议使用Redis
captcha_attempts = {}  # 存储验证码错误尝试次数，格式: {username: {"attempts": count, "locked_until": datetime}}

class CaptchaRequest(BaseModel):
    """验证码请求"""
    pass

class CaptchaResponse(BaseModel):
    """验证码响应"""
    captcha_id: str
    captcha_image: str  # base64编码的图片

class LoginWithCaptchaRequest(BaseModel):
    """带验证码的登录请求"""
    username: str
    password: str
    captcha_id: str
    captcha_code: str

def generate_captcha_code(captcha_type: str, length: int) -> str:
    """生成验证码字符串"""
    if captcha_type == "number":
        chars = string.digits
    elif captcha_type == "letter":
        chars = string.ascii_uppercase
    else:  # mixed
        chars = string.ascii_uppercase + string.digits
    
    return ''.join(random.choice(chars) for _ in range(length))

def check_captcha_attempts(username: str, db: Session) -> bool:
    """
    检查验证码错误尝试次数是否超限
    Check if captcha error attempts exceed limit
    """
    try:
        # 获取验证码设置
        max_attempts = SettingsService.get_setting(db, "captchaMaxAttempts", 3)
        lock_duration = SettingsService.get_setting(db, "captchaLockDuration", 5)  # 分钟
        
        current_time = datetime.now(timezone.utc)
        
        # 检查用户是否存在错误记录
        if username in captcha_attempts:
            user_attempts = captcha_attempts[username]
            
            # 检查是否仍在锁定期内
            if "locked_until" in user_attempts and current_time < user_attempts["locked_until"]:
                remaining_time = (user_attempts["locked_until"] - current_time).total_seconds() / 60
                logger.warning(f"🔒 用户 {username} 仍在验证码锁定期内，剩余时间: {remaining_time:.1f} 分钟")
                return False
            
            # 如果锁定期已过，重置计数
            if "locked_until" in user_attempts and current_time >= user_attempts["locked_until"]:
                logger.info(f"🔓 用户 {username} 验证码锁定期已过，重置错误计数")
                captcha_attempts[username] = {"attempts": 0}
        
        return True
        
    except Exception as e:
        logger.error(f"检查验证码尝试次数失败: {e}")
        return True  # 出错时允许尝试


def handle_captcha_error(username: str, db: Session) -> None:
    """
    处理验证码错误，增加错误计数并检查是否需要锁定
    Handle captcha error, increment error count and check if locking is needed
    """
    try:
        # 获取验证码设置
        max_attempts = SettingsService.get_setting(db, "captchaMaxAttempts", 3)
        lock_duration = SettingsService.get_setting(db, "captchaLockDuration", 5)  # 分钟
        
        current_time = datetime.now(timezone.utc)
        
        # 初始化用户错误记录
        if username not in captcha_attempts:
            captcha_attempts[username] = {"attempts": 0}
        
        # 增加错误计数
        captcha_attempts[username]["attempts"] += 1
        attempts = captcha_attempts[username]["attempts"]
        
        logger.warning(f"🚨 用户 {username} 验证码错误，当前错误次数: {attempts}/{max_attempts}")
        
        # 检查是否达到最大错误次数
        if attempts >= max_attempts:
            # 锁定用户
            lock_until = current_time + timedelta(minutes=lock_duration)
            captcha_attempts[username]["locked_until"] = lock_until
            
            logger.error(f"🔒 用户 {username} 验证码错误次数达到上限，锁定 {lock_duration} 分钟至 {lock_until}")
        
    except Exception as e:
        logger.error(f"处理验证码错误失败: {e}")


def reset_captcha_attempts(username: str) -> None:
    """
    重置验证码错误计数（登录成功时调用）
    Reset captcha error attempts (called on successful login)
    """
    try:
        if username in captcha_attempts:
            logger.info(f"🔓 重置用户 {username} 的验证码错误计数")
            del captcha_attempts[username]
    except Exception as e:
        logger.error(f"重置验证码错误计数失败: {e}")


def create_captcha_image(code: str, difficulty: str = "medium") -> str:
    """创建验证码图片并返回base64编码"""
    try:
        # 图片尺寸
        width, height = 120, 40
        
        # 创建图片
        image = Image.new('RGB', (width, height), color='white')
        draw = ImageDraw.Draw(image)
        
        # 根据难度设置干扰程度
        if difficulty == "easy":
            noise_lines = 0
            noise_points = 0
        elif difficulty == "medium":
            noise_lines = 2
            noise_points = 50
        else:  # hard
            noise_lines = 5
            noise_points = 100
        
        # 绘制干扰线
        for _ in range(noise_lines):
            x1 = random.randint(0, width)
            y1 = random.randint(0, height)
            x2 = random.randint(0, width)
            y2 = random.randint(0, height)
            draw.line([(x1, y1), (x2, y2)], fill='gray', width=1)
        
        # 绘制干扰点
        for _ in range(noise_points):
            x = random.randint(0, width)
            y = random.randint(0, height)
            draw.point((x, y), fill='gray')
        
        # 绘制验证码文字
        try:
            # 尝试使用系统字体
            font_size = 24
            font = ImageFont.load_default()
        except:
            font = ImageFont.load_default()
        
        # 计算文字位置
        char_width = width // len(code)
        for i, char in enumerate(code):
            x = char_width * i + random.randint(5, 15)
            y = random.randint(5, 15)
            # 随机颜色
            color = (
                random.randint(0, 100),
                random.randint(0, 100),
                random.randint(0, 100)
            )
            draw.text((x, y), char, font=font, fill=color)
        
        # 转换为base64
        buffer = BytesIO()
        image.save(buffer, format='PNG')
        img_str = base64.b64encode(buffer.getvalue()).decode()
        
        return f"data:image/png;base64,{img_str}"
        
    except Exception as e:
        logger.error(f"创建验证码图片失败: {e}")
        # 返回简单的文本验证码
        return f"data:text/plain;base64,{base64.b64encode(code.encode()).decode()}"

@router.get("/captcha", response_model=CaptchaResponse)
async def get_captcha(db: Session = Depends(get_db)):
    """
    获取登录验证码
    Get login captcha
    """
    try:
        # 检查是否启用验证码
        enable_captcha = SettingsService.get_setting(db, "enableLoginCaptcha", False)
        if not enable_captcha:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="验证码功能未启用"
            )
        
        # 获取验证码设置
        captcha_type = SettingsService.get_setting(db, "captchaType", "mixed")
        captcha_length = SettingsService.get_setting(db, "captchaLength", 4)
        captcha_difficulty = SettingsService.get_setting(db, "captchaDifficulty", "medium")
        
        # 生成验证码
        captcha_id = secrets.token_urlsafe(16)
        captcha_code = generate_captcha_code(captcha_type, captcha_length)
        
        # 创建验证码图片
        captcha_image = create_captcha_image(captcha_code, captcha_difficulty)
        
        # 存储验证码（5分钟过期）
        captcha_store[captcha_id] = {
            "code": captcha_code.upper(),
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=5)
        }
        
        logger.info(f"生成验证码: {captcha_id}, 类型: {captcha_type}, 长度: {captcha_length}")
        
        return CaptchaResponse(
            captcha_id=captcha_id,
            captcha_image=captcha_image
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"生成验证码失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="生成验证码失败"
        )

@router.post("/login-with-captcha")
async def login_admin_with_captcha(request: LoginWithCaptchaRequest, db: Session = Depends(get_db)):
    """
    带验证码的管理员登录 - 完整安全版本（包含错误次数限制和锁定）
    Admin login with captcha - Complete security version (with error limit and locking)
    """
    try:
        logger.info(f"🔐 带验证码登录尝试: {request.username}")
        logger.info(f"🔐 收到的验证码ID: {request.captcha_id}")
        logger.info(f"🔐 收到的验证码: {request.captcha_code}")
        
        # 🚨 新增：检查验证码错误次数限制
        if not check_captcha_attempts(request.username, db):
            # 获取锁定时间信息
            lock_duration = SettingsService.get_setting(db, "captchaLockDuration", 5)
            if request.username in captcha_attempts and "locked_until" in captcha_attempts[request.username]:
                remaining_time = (captcha_attempts[request.username]["locked_until"] - datetime.now(timezone.utc)).total_seconds() / 60
                logger.error(f"🔒 用户 {request.username} 验证码错误次数过多，仍在锁定期内")
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"验证码错误次数过多，请等待 {remaining_time:.1f} 分钟后再试"
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"验证码错误次数过多，请等待 {lock_duration} 分钟后再试"
                )
        
        # 🚨 安全修复：检查是否启用验证码
        enable_captcha = SettingsService.get_setting(db, "enableLoginCaptcha", False)
        logger.info(f"🔐 验证码启用状态: {enable_captcha}")
        
        if not enable_captcha:
            logger.error("🔐 验证码未启用，拒绝带验证码的登录请求")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="验证码功能未启用"
            )
        
        # 🚨 安全修复：强制验证验证码，不允许绕过
        logger.info(f"🔐 当前验证码存储: {list(captcha_store.keys())}")
        
        if request.captcha_id not in captcha_store:
            logger.error(f"🔐 验证码ID不存在: {request.captcha_id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="验证码已过期或不存在"
            )
        
        stored_captcha = captcha_store[request.captcha_id]
        current_time = datetime.now(timezone.utc)
        
        logger.info(f"🔐 存储的验证码: {stored_captcha['code']}")
        logger.info(f"🔐 输入的验证码: {request.captcha_code.upper()}")
        logger.info(f"🔐 验证码过期时间: {stored_captcha['expires_at']}")
        logger.info(f"🔐 当前时间: {current_time}")
        
        # 🚨 安全修复：检查验证码是否过期
        if current_time > stored_captcha["expires_at"]:
            logger.error(f"🔐 验证码已过期")
            del captcha_store[request.captcha_id]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="验证码已过期"
            )
        
        # 🚨 安全修复：严格验证验证码是否正确
        if request.captcha_code.upper() != stored_captcha["code"]:
            logger.error(f"🔐 验证码错误: 输入'{request.captcha_code.upper()}' != 存储'{stored_captcha['code']}'")
            
            # 🚨 新增：处理验证码错误，增加错误计数
            handle_captcha_error(request.username, db)
            
            # 检查是否需要立即锁定
            max_attempts = SettingsService.get_setting(db, "captchaMaxAttempts", 3)
            current_attempts = captcha_attempts.get(request.username, {}).get("attempts", 0)
            
            if current_attempts >= max_attempts:
                lock_duration = SettingsService.get_setting(db, "captchaLockDuration", 5)
                logger.error(f"🔒 用户 {request.username} 验证码错误次数达到上限，已被锁定 {lock_duration} 分钟")
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"验证码错误次数过多，已被锁定 {lock_duration} 分钟"
                )
            else:
                remaining_attempts = max_attempts - current_attempts
                logger.warning(f"🚨 用户 {request.username} 验证码错误，剩余尝试次数: {remaining_attempts}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"验证码错误，剩余尝试次数: {remaining_attempts}"
                )
        
        logger.info("🔐 验证码验证成功！")
        # 验证码正确，删除已使用的验证码
        del captcha_store[request.captcha_id]
        
        # 🚨 新增：验证码验证成功，重置错误计数
        reset_captcha_attempts(request.username)
        
        # 🚨 安全修复：只有验证码验证成功后才执行用户名密码验证
        logger.info("🔐 验证码验证通过，开始执行用户名密码验证")
        
        # 手动执行用户名密码验证，而不是调用login_admin函数
        user = db.query(User).filter(User.username == request.username).first()
        
        if not user:
            logger.warning(f"用户不存在: {request.username}")
            # 处理登录失败
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户名或密码错误"
            )
        
        if not verify_password(request.password, user.hashed_password):
            logger.warning(f"密码验证失败: {request.username}")
            # 处理登录失败
            await handle_login_failure(user, db)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户名或密码错误"
            )
        
        if not user.is_active:
            logger.warning(f"用户账号已被禁用: {request.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户账号已被禁用"
            )
        
        # 更新登录信息
        user.last_login = datetime.now(timezone.utc)
        if user.login_count is None:
            user.login_count = 0
        user.login_count += 1
        
        # 重置失败登录计数（如果存在安全字段）
        if hasattr(user, 'failed_login_attempts'):
            user.failed_login_attempts = 0
        
        db.commit()
        
        # 🚨 修复：使用数据库中的会话超时时间设置
        try:
            session_timeout = SettingsService.get_setting(db, "sessionTimeout", 30)
            logger.info(f"带验证码登录使用数据库中的会话超时时间: {session_timeout} 分钟")
        except Exception as e:
            logger.warning(f"获取会话超时设置失败，使用默认值30分钟: {e}")
            session_timeout = 30
        
        access_token = create_access_token(
            data={"sub": user.username},
            expires_delta=timedelta(minutes=session_timeout)
        )
        
        logger.info(f"🔐 带验证码登录成功: {user.username}")
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user_info": user.to_dict()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"🔐 带验证码登录异常: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="登录过程中发生错误"
        )

@router.get("/captcha/settings")
async def get_captcha_settings(db: Session = Depends(get_db)):
    """
    获取验证码设置（公开API）
    Get captcha settings (public API)
    """
    try:
        enable_captcha = SettingsService.get_setting(db, "enableLoginCaptcha", False)
        
        if not enable_captcha:
            return {
                "success": True,
                "data": {
                    "enableLoginCaptcha": False
                }
            }
        
        captcha_settings = {
            "enableLoginCaptcha": enable_captcha,
            "captchaType": SettingsService.get_setting(db, "captchaType", "mixed"),
            "captchaLength": SettingsService.get_setting(db, "captchaLength", 4),
            "captchaMaxAttempts": SettingsService.get_setting(db, "captchaMaxAttempts", 3),
            "captchaLockDuration": SettingsService.get_setting(db, "captchaLockDuration", 5),
            "captchaDifficulty": SettingsService.get_setting(db, "captchaDifficulty", "medium")
        }
        
        return {
            "success": True,
            "data": captcha_settings
        }
        
    except Exception as e:
        logger.error(f"获取验证码设置失败: {str(e)}")
        return {
            "success": True,
            "data": {
                "enableLoginCaptcha": False
            }
        }


# 🔐 双因素认证相关API
class TwoFactorSetupRequest(BaseModel):
    """2FA设置请求"""
    password: str  # 需要当前密码确认

class TwoFactorVerifyRequest(BaseModel):
    """2FA验证请求"""
    totp_code: str

class TwoFactorLoginRequest(BaseModel):
    """2FA登录请求"""
    username: str
    password: str
    totp_code: str
    captcha_id: str = None
    captcha_code: str = None

class BackupCodeRequest(BaseModel):
    """备用码请求"""
    backup_code: str

@router.post("/2fa/setup")
async def setup_two_factor(
    request: TwoFactorSetupRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    设置双因素认证
    Setup Two-Factor Authentication
    """
    try:
        logger.info(f"🔐 用户 {current_user.username} 开始设置2FA")
        
        # 🚨 检查TOTP服务是否可用
        if not TOTP_AVAILABLE:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="双因素认证服务暂时不可用，请联系管理员安装相关依赖"
            )
        
        # 验证当前密码
        if not verify_password(request.password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="当前密码错误"
            )
        
        # 检查是否已启用2FA
        if hasattr(current_user, 'totp_enabled') and current_user.totp_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="双因素认证已启用"
            )
        
        # 生成TOTP密钥
        secret = TOTPService.generate_secret()
        
        # 获取发行者名称
        issuer_name = SettingsService.get_setting(db, "twoFactorIssuerName", "SMS转发系统")
        
        # 生成QR码
        qr_code = TOTPService.generate_qr_code(secret, current_user.username, issuer_name)
        
        # 生成备用恢复码
        backup_codes_count = SettingsService.get_setting(db, "twoFactorBackupCodesCount", 10)
        backup_codes = TOTPService.generate_backup_codes(backup_codes_count)
        
        # 暂时存储密钥（等待用户验证）
        if not hasattr(current_user, 'totp_secret'):
            logger.warning("用户表缺少2FA字段，请先运行数据库迁移")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="系统尚未支持双因素认证，请联系管理员"
            )
        
        current_user.totp_secret = secret
        current_user.set_backup_codes(backup_codes)
        # 注意：此时还不启用2FA，需要用户验证后才启用
        db.commit()
        
        logger.info(f"🔐 用户 {current_user.username} 2FA密钥生成成功")
        
        return {
            "success": True,
            "message": "2FA设置准备完成，请使用Google Authenticator扫描二维码",
            "data": {
                "qr_code": qr_code,
                "secret": secret,  # 也提供文本密钥供手动输入
                "backup_codes": backup_codes,
                "issuer": issuer_name
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"设置2FA失败: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="设置双因素认证失败"
        )

@router.post("/2fa/verify-setup")
async def verify_two_factor_setup(
    request: TwoFactorVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    验证并启用双因素认证
    Verify and enable Two-Factor Authentication
    """
    try:
        logger.info(f"🔐 用户 {current_user.username} 验证2FA设置")
        
        # 检查是否有待验证的密钥
        if not hasattr(current_user, 'totp_secret') or not current_user.totp_secret:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="请先设置双因素认证"
            )
        
        # 验证TOTP令牌
        if not TOTPService.verify_token(current_user.totp_secret, request.totp_code):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="验证码错误，请检查您的认证器应用"
            )
        
        # 验证成功，启用2FA
        current_user.totp_enabled = True
        if hasattr(current_user, 'totp_failed_attempts'):
            current_user.totp_failed_attempts = 0
        db.commit()
        
        logger.info(f"🔐 用户 {current_user.username} 2FA启用成功")
        
        return {
            "success": True,
            "message": "双因素认证启用成功！请妥善保存备用恢复码",
            "data": {
                "enabled": True,
                "backup_codes": current_user.get_backup_codes()
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"验证2FA设置失败: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="验证双因素认证失败"
        )

@router.post("/2fa/disable")
async def disable_two_factor(
    request: TwoFactorSetupRequest,  # 复用，需要密码确认
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    禁用双因素认证
    Disable Two-Factor Authentication
    """
    try:
        logger.info(f"🔐 用户 {current_user.username} 禁用2FA")
        
        # 验证当前密码
        if not verify_password(request.password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="当前密码错误"
            )
        
        # 检查是否已启用2FA
        if not hasattr(current_user, 'totp_enabled') or not current_user.totp_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="双因素认证未启用"
            )
        
        # 禁用2FA并清除相关数据
        current_user.totp_enabled = False
        current_user.totp_secret = None
        current_user.backup_codes = None
        if hasattr(current_user, 'totp_failed_attempts'):
            current_user.totp_failed_attempts = 0
        if hasattr(current_user, 'totp_locked_until'):
            current_user.totp_locked_until = None
        
        db.commit()
        
        logger.info(f"🔐 用户 {current_user.username} 2FA禁用成功")
        
        return {
            "success": True,
            "message": "双因素认证已禁用",
            "data": {
                "enabled": False
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"禁用2FA失败: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="禁用双因素认证失败"
        )

@router.get("/2fa/status")
async def get_two_factor_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取2FA状态
    Get Two-Factor Authentication status
    """
    try:
        # 检查系统是否启用2FA
        system_2fa_enabled = SettingsService.get_setting(db, "enableTwoFactor", False)
        
        # 检查用户是否启用2FA
        user_2fa_enabled = False
        backup_codes_count = 0
        
        if hasattr(current_user, 'totp_enabled') and current_user.totp_enabled:
            user_2fa_enabled = True
            backup_codes_count = len(current_user.get_backup_codes())
        
        return {
            "success": True,
            "data": {
                "system_enabled": system_2fa_enabled,
                "user_enabled": user_2fa_enabled,
                "backup_codes_remaining": backup_codes_count,
                "can_setup": system_2fa_enabled and not user_2fa_enabled
            }
        }
        
    except Exception as e:
        logger.error(f"获取2FA状态失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取双因素认证状态失败"
        )

@router.post("/2fa/regenerate-backup-codes")
async def regenerate_backup_codes(
    request: TwoFactorSetupRequest,  # 需要密码确认
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    重新生成备用恢复码
    Regenerate backup recovery codes
    """
    try:
        logger.info(f"🔐 用户 {current_user.username} 重新生成备用恢复码")
        
        # 验证当前密码
        if not verify_password(request.password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="当前密码错误"
            )
        
        # 检查是否已启用2FA
        if not hasattr(current_user, 'totp_enabled') or not current_user.totp_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="请先启用双因素认证"
            )
        
        # 生成新的备用恢复码
        backup_codes_count = SettingsService.get_setting(db, "twoFactorBackupCodesCount", 10)
        new_backup_codes = TOTPService.generate_backup_codes(backup_codes_count)
        
        # 更新备用恢复码
        current_user.set_backup_codes(new_backup_codes)
        db.commit()
        
        logger.info(f"🔐 用户 {current_user.username} 备用恢复码重新生成成功")
        
        return {
            "success": True,
            "message": "备用恢复码重新生成成功，请妥善保存",
            "data": {
                "backup_codes": new_backup_codes
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"重新生成备用恢复码失败: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="重新生成备用恢复码失败"
        )
