"""
TOTP (Time-based One-Time Password) 服务
TOTP Service for Two-Factor Authentication
"""

import pyotp
import qrcode
import io
import base64
import secrets
import string
from typing import Tuple, Optional
import logging

logger = logging.getLogger(__name__)

class TOTPService:
    """TOTP双因素认证服务"""
    
    @staticmethod
    def generate_secret() -> str:
        """生成TOTP密钥"""
        return pyotp.random_base32()
    
    @staticmethod
    def generate_qr_code(secret: str, username: str, issuer: str = "SMS转发系统") -> str:
        """
        生成QR码用于Google Authenticator等应用
        返回base64编码的PNG图片
        """
        try:
            # 创建TOTP对象
            totp = pyotp.TOTP(secret)
            
            # 生成provisioning URI
            provisioning_uri = totp.provisioning_uri(
                name=username,
                issuer_name=issuer
            )
            
            # 生成QR码
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            qr.add_data(provisioning_uri)
            qr.make(fit=True)
            
            # 创建图片
            img = qr.make_image(fill_color="black", back_color="white")
            
            # 转换为base64
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            img_str = base64.b64encode(buffer.getvalue()).decode()
            
            return f"data:image/png;base64,{img_str}"
            
        except Exception as e:
            logger.error(f"生成QR码失败: {str(e)}")
            raise
    
    @staticmethod
    def verify_token(secret: str, token: str, window: int = 1) -> bool:
        """
        验证TOTP令牌
        window: 允许的时间窗口（默认1，允许前后30秒的误差）
        """
        try:
            if not secret or not token:
                return False
            
            totp = pyotp.TOTP(secret)
            return totp.verify(token, valid_window=window)
            
        except Exception as e:
            logger.error(f"验证TOTP令牌失败: {str(e)}")
            return False
    
    @staticmethod
    def get_current_token(secret: str) -> str:
        """获取当前时间的TOTP令牌（用于测试）"""
        try:
            totp = pyotp.TOTP(secret)
            return totp.now()
        except Exception as e:
            logger.error(f"获取当前令牌失败: {str(e)}")
            return ""
    
    @staticmethod
    def generate_backup_codes(count: int = 10) -> list:
        """生成备用恢复码"""
        codes = []
        for _ in range(count):
            # 生成8位随机码
            code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
            # 格式化为 XXXX-XXXX
            formatted_code = f"{code[:4]}-{code[4:]}"
            codes.append(formatted_code)
        
        return codes
    
    @staticmethod
    def verify_backup_code(stored_codes: list, input_code: str) -> Tuple[bool, list]:
        """
        验证备用恢复码
        返回 (是否验证成功, 更新后的备用码列表)
        """
        try:
            if not stored_codes or not input_code:
                return False, stored_codes
            
            # 标准化输入码格式
            normalized_input = input_code.strip().upper().replace('-', '')
            
            # 查找匹配的备用码
            for i, stored_code in enumerate(stored_codes):
                normalized_stored = stored_code.replace('-', '')
                if normalized_stored == normalized_input:
                    # 找到匹配的码，移除它（一次性使用）
                    updated_codes = stored_codes.copy()
                    updated_codes.pop(i)
                    return True, updated_codes
            
            return False, stored_codes
            
        except Exception as e:
            logger.error(f"验证备用码失败: {str(e)}")
            return False, stored_codes
