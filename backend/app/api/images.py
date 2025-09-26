"""
图片访问API
Image access APIs for serving uploaded images
"""

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse
from pathlib import Path
import mimetypes
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# 图片存储目录
UPLOAD_DIR = Path("uploads/images")

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
