"""
图片存储服务
Image storage service for handling file uploads and Base64 conversion
"""

import os
import uuid
import base64
import mimetypes
from typing import Optional, Tuple
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

class ImageStorageService:
    """图片存储服务类"""
    
    def __init__(self, upload_dir: str = "/app/uploads/images"):
        """
        初始化图片存储服务
        
        Args:
            upload_dir: 图片上传目录
        """
        self.upload_dir = Path(upload_dir)
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        
        # 支持的图片格式
        self.supported_formats = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp'
        }
    
    def save_base64_image(self, base64_data: str, filename_prefix: str = "image") -> Optional[str]:
        """
        保存Base64图片数据到文件
        
        Args:
            base64_data: Base64编码的图片数据
            filename_prefix: 文件名前缀
            
        Returns:
            保存成功返回相对路径，失败返回None
        """
        try:
            # 清理文件名前缀中的空白字符（修复根本问题）
            import re
            cleaned_prefix = re.sub(r'\s+', '_', filename_prefix.strip())
            logger.info(f"文件名前缀清理: '{filename_prefix}' -> '{cleaned_prefix}'")
            
            # 解析Base64数据
            if base64_data.startswith('data:image/'):
                # 提取MIME类型和数据部分
                header, data = base64_data.split(',', 1)
                mime_type = header.split(';')[0].split(':')[1]
            else:
                # 假设是纯Base64数据，默认为PNG
                mime_type = 'image/png'
                data = base64_data
            
            # 检查是否支持该格式
            if mime_type not in self.supported_formats:
                logger.error(f"不支持的图片格式: {mime_type}")
                return None
            
            # 解码Base64数据
            try:
                image_data = base64.b64decode(data)
            except Exception as e:
                logger.error(f"Base64解码失败: {str(e)}")
                return None
            
            # 生成唯一文件名（使用清理后的前缀）
            file_extension = self.supported_formats[mime_type]
            filename = f"{cleaned_prefix}_{uuid.uuid4().hex}{file_extension}"
            file_path = self.upload_dir / filename
            
            # 保存文件
            with open(file_path, 'wb') as f:
                f.write(image_data)
            
            # 返回相对路径
            relative_path = f"uploads/images/{filename}"
            logger.info(f"图片保存成功: {relative_path}")
            return relative_path
            
        except Exception as e:
            logger.error(f"保存Base64图片失败: {str(e)}")
            return None
    
    def save_uploaded_file(self, file_data: bytes, filename: str) -> Optional[str]:
        """
        保存上传的文件
        
        Args:
            file_data: 文件二进制数据
            filename: 原始文件名
            
        Returns:
            保存成功返回相对路径，失败返回None
        """
        try:
            # 获取文件扩展名
            _, ext = os.path.splitext(filename)
            if not ext:
                ext = '.jpg'  # 默认扩展名
            
            # 生成唯一文件名
            new_filename = f"upload_{uuid.uuid4().hex}{ext}"
            file_path = self.upload_dir / new_filename
            
            # 保存文件
            with open(file_path, 'wb') as f:
                f.write(file_data)
            
            # 返回相对路径
            relative_path = f"uploads/images/{new_filename}"
            logger.info(f"文件上传成功: {relative_path}")
            return relative_path
            
        except Exception as e:
            logger.error(f"保存上传文件失败: {str(e)}")
            return None
    
    def delete_image(self, image_path: str) -> bool:
        """
        删除图片文件
        
        Args:
            image_path: 图片相对路径
            
        Returns:
            删除成功返回True，失败返回False
        """
        try:
            # 构建完整路径
            if image_path.startswith('uploads/images/'):
                filename = image_path.replace('uploads/images/', '')
                file_path = self.upload_dir / filename
            else:
                file_path = Path(image_path)
            
            # 检查文件是否存在
            if file_path.exists() and file_path.is_file():
                file_path.unlink()
                logger.info(f"图片删除成功: {image_path}")
                return True
            else:
                logger.warning(f"图片文件不存在: {image_path}")
                return False
                
        except Exception as e:
            logger.error(f"删除图片失败: {str(e)}")
            return False
    
    def get_image_info(self, image_path: str) -> Optional[dict]:
        """
        获取图片信息
        
        Args:
            image_path: 图片相对路径
            
        Returns:
            图片信息字典或None
        """
        try:
            # 构建完整路径
            if image_path.startswith('uploads/images/'):
                filename = image_path.replace('uploads/images/', '')
                file_path = self.upload_dir / filename
            else:
                file_path = Path(image_path)
            
            if not file_path.exists():
                return None
            
            # 获取文件信息
            stat = file_path.stat()
            mime_type, _ = mimetypes.guess_type(str(file_path))
            
            return {
                'path': image_path,
                'size': stat.st_size,
                'mime_type': mime_type,
                'created_at': stat.st_ctime,
                'modified_at': stat.st_mtime
            }
            
        except Exception as e:
            logger.error(f"获取图片信息失败: {str(e)}")
            return None
    
    def is_base64_image(self, data: str) -> bool:
        """
        检查字符串是否为Base64图片数据
        
        Args:
            data: 待检查的字符串
            
        Returns:
            是Base64图片返回True，否则返回False
        """
        if not data:
            return False
        
        # 检查是否以data:image/开头
        if data.startswith('data:image/'):
            return True
        
        # 检查是否为纯Base64数据（简单检查）
        try:
            if len(data) > 100:  # Base64图片数据通常很长
                base64.b64decode(data[:100])  # 尝试解码前100个字符
                return True
        except:
            pass
        
        return False


# 创建全局实例
image_storage = ImageStorageService()
