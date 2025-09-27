"""
图片访问和上传API
Image access and upload APIs for serving and uploading images
"""

from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File
from fastapi.responses import FileResponse
from pathlib import Path
import mimetypes
import logging
import uuid
import os
from typing import List

from ..api.auth import get_current_user
from ..models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()

# 图片存储目录
UPLOAD_DIR = Path("uploads/images")

# 确保上传目录存在
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# 允许的图片格式
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

@router.get("/images/{filename}")
async def get_image(filename: str):
    """
    获取图片文件
    
    Args:
        filename: 图片文件名
        
    Returns:
        图片文件响应
    """
    try:
        # 构建文件路径
        file_path = UPLOAD_DIR / filename
        
        # 检查文件是否存在
        if not file_path.exists() or not file_path.is_file():
            # 如果文件不存在，返回默认头像
            logger.warning(f"图片文件不存在: {filename}, 返回默认头像")
            
            # 创建一个简单的默认头像响应
            from fastapi.responses import Response
            import base64
            
            # 1x1像素的透明PNG图片的base64编码
            default_avatar = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77zgAAAABJRU5ErkJggg=="
            
            return Response(
                content=base64.b64decode(default_avatar),
                media_type="image/png",
                headers={"Cache-Control": "public, max-age=3600"}
            )
        
        # 检查文件是否在允许的目录内（安全检查）
        try:
            file_path.resolve().relative_to(UPLOAD_DIR.resolve())
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="访问被拒绝"
            )
        
        # 获取MIME类型
        mime_type, _ = mimetypes.guess_type(str(file_path))
        if not mime_type or not mime_type.startswith('image/'):
            mime_type = 'image/jpeg'  # 默认MIME类型
        
        # 返回文件响应
        return FileResponse(
            path=str(file_path),
            media_type=mime_type,
            filename=filename
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取图片文件失败: {str(e)}")
        # 返回默认头像而不是抛出异常
        from fastapi.responses import Response
        import base64
        
        default_avatar = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77zgAAAABJRU5ErkJggg=="
        
        return Response(
            content=base64.b64decode(default_avatar),
            media_type="image/png",
            headers={"Cache-Control": "public, max-age=3600"}
        )


@router.get("/images/{filename}/info")
async def get_image_info(filename: str):
    """
    获取图片文件信息
    
    Args:
        filename: 图片文件名
        
    Returns:
        图片文件信息
    """
    try:
        # 构建文件路径
        file_path = UPLOAD_DIR / filename
        
        # 检查文件是否存在
        if not file_path.exists() or not file_path.is_file():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="图片文件不存在"
            )
        
        # 获取文件信息
        stat = file_path.stat()
        mime_type, _ = mimetypes.guess_type(str(file_path))
        
        return {
            "success": True,
            "data": {
                "filename": filename,
                "size": stat.st_size,
                "mime_type": mime_type,
                "created_at": stat.st_ctime,
                "modified_at": stat.st_mtime
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取图片信息失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取图片信息失败"
        )


@router.post("/images/upload")
async def upload_image(
    image: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    上传图片文件
    
    Args:
        image: 上传的图片文件
        current_user: 当前用户
        
    Returns:
        上传结果和图片URL
    """
    try:
        # 检查文件是否为空
        if not image.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="请选择要上传的图片文件"
            )
        
        # 检查文件扩展名
        file_ext = Path(image.filename).suffix.lower()
        if file_ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"不支持的文件格式。支持的格式: {', '.join(ALLOWED_EXTENSIONS)}"
            )
        
        # 读取文件内容
        content = await image.read()
        
        # 检查文件大小
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"文件大小超过限制。最大允许: {MAX_FILE_SIZE // (1024*1024)}MB"
            )
        
        # 生成唯一文件名
        unique_filename = f"{uuid.uuid4().hex}{file_ext}"
        file_path = UPLOAD_DIR / unique_filename
        
        # 保存文件
        with open(file_path, "wb") as f:
            f.write(content)
        
        # 构建图片URL
        image_url = f"/api/images/{unique_filename}"
        
        logger.info(f"用户 {current_user.username} 上传图片成功: {unique_filename}")
        
        return {
            "success": True,
            "message": "图片上传成功",
            "data": {
                "filename": unique_filename,
                "original_filename": image.filename,
                "url": image_url,
                "size": len(content),
                "mime_type": image.content_type
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"上传图片失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="图片上传失败"
        )


@router.delete("/images/{filename}")
async def delete_image(
    filename: str,
    current_user: User = Depends(get_current_user)
):
    """
    删除图片文件
    
    Args:
        filename: 图片文件名
        current_user: 当前用户
        
    Returns:
        删除结果
    """
    try:
        # 构建文件路径
        file_path = UPLOAD_DIR / filename
        
        # 检查文件是否存在
        if not file_path.exists() or not file_path.is_file():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="图片文件不存在"
            )
        
        # 检查文件是否在允许的目录内（安全检查）
        try:
            file_path.resolve().relative_to(UPLOAD_DIR.resolve())
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="访问被拒绝"
            )
        
        # 删除文件
        os.remove(file_path)
        
        logger.info(f"用户 {current_user.username} 删除图片: {filename}")
        
        return {
            "success": True,
            "message": "图片删除成功"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除图片失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除图片失败"
        )


@router.get("/images")
async def list_images(
    current_user: User = Depends(get_current_user)
):
    """
    获取图片列表
    
    Args:
        current_user: 当前用户
        
    Returns:
        图片列表
    """
    try:
        images = []
        
        # 遍历上传目录
        for file_path in UPLOAD_DIR.iterdir():
            if file_path.is_file() and file_path.suffix.lower() in ALLOWED_EXTENSIONS:
                stat = file_path.stat()
                mime_type, _ = mimetypes.guess_type(str(file_path))
                
                images.append({
                    "filename": file_path.name,
                    "url": f"/api/images/{file_path.name}",
                    "size": stat.st_size,
                    "mime_type": mime_type,
                    "created_at": stat.st_ctime,
                    "modified_at": stat.st_mtime
                })
        
        # 按创建时间倒序排列
        images.sort(key=lambda x: x["created_at"], reverse=True)
        
        return {
            "success": True,
            "data": images,
            "total": len(images)
        }
        
    except Exception as e:
        logger.error(f"获取图片列表失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取图片列表失败"
        )
