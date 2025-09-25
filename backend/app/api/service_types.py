from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import logging

from ..database import get_db
from ..models.service_type import ServiceType
from .auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/service-types", tags=["service-types"])

# Pydantic 模型
class ServiceTypeCreate(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    is_active: bool = True
    sort_order: int = 0

class ServiceTypeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None

class ServiceTypeResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    icon: Optional[str]
    color: Optional[str]
    is_active: bool
    sort_order: int
    created_at: str
    updated_at: str

@router.post("/", response_model=dict)
async def create_service_type(
    service_type_data: ServiceTypeCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """创建服务类型"""
    try:
        # 检查名称是否已存在
        existing = db.query(ServiceType).filter(ServiceType.name == service_type_data.name).first()
        if existing:
            raise HTTPException(status_code=400, detail="服务类型名称已存在")
        
        # 创建新的服务类型
        service_type = ServiceType(
            name=service_type_data.name,
            description=service_type_data.description,
            icon=service_type_data.icon,
            color=service_type_data.color,
            is_active=service_type_data.is_active,
            sort_order=service_type_data.sort_order
        )
        
        db.add(service_type)
        db.commit()
        db.refresh(service_type)
        
        # 重新查询以确保数据完整
        service_type = db.query(ServiceType).filter(ServiceType.id == service_type.id).first()
        
        logger.info(f"创建服务类型成功: {service_type.name}")
        
        return {
            "success": True,
            "message": "服务类型创建成功",
            "data": service_type.to_dict()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建服务类型失败: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="创建服务类型失败")

@router.get("/list", response_model=dict)
async def get_service_types(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(10, ge=1, le=100, description="每页数量"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    is_active: Optional[bool] = Query(None, description="是否启用"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """获取服务类型列表"""
    try:
        query = db.query(ServiceType)
        
        # 搜索过滤
        if search:
            query = query.filter(ServiceType.name.contains(search))
        
        # 状态过滤
        if is_active is not None:
            query = query.filter(ServiceType.is_active == is_active)
        
        # 排序
        query = query.order_by(ServiceType.sort_order.asc(), ServiceType.created_at.desc())
        
        # 分页
        total = query.count()
        service_types = query.offset((page - 1) * page_size).limit(page_size).all()
        
        return {
            "success": True,
            "data": {
                "service_types": [st.to_dict() for st in service_types],
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total": total,
                    "pages": (total + page_size - 1) // page_size
                }
            }
        }
        
    except Exception as e:
        logger.error(f"获取服务类型列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取服务类型列表失败")

@router.get("/all", response_model=dict)
async def get_all_active_service_types(
    db: Session = Depends(get_db)
):
    """获取所有启用的服务类型（用于下拉选择）"""
    try:
        service_types = db.query(ServiceType).filter(
            ServiceType.is_active == True
        ).order_by(ServiceType.sort_order.asc(), ServiceType.name.asc()).all()
        
        return {
            "success": True,
            "data": [st.to_dict() for st in service_types]
        }
        
    except Exception as e:
        logger.error(f"获取服务类型失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取服务类型失败")

@router.get("/{service_type_id}", response_model=dict)
async def get_service_type(
    service_type_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """获取服务类型详情"""
    try:
        service_type = db.query(ServiceType).filter(ServiceType.id == service_type_id).first()
        if not service_type:
            raise HTTPException(status_code=404, detail="服务类型不存在")
        
        return {
            "success": True,
            "data": service_type.to_dict()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取服务类型详情失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取服务类型详情失败")

@router.put("/{service_type_id}", response_model=dict)
async def update_service_type(
    service_type_id: int,
    service_type_data: ServiceTypeUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """更新服务类型"""
    try:
        service_type = db.query(ServiceType).filter(ServiceType.id == service_type_id).first()
        if not service_type:
            raise HTTPException(status_code=404, detail="服务类型不存在")
        
        # 检查名称是否已存在（排除当前记录）
        if service_type_data.name:
            existing = db.query(ServiceType).filter(
                ServiceType.name == service_type_data.name,
                ServiceType.id != service_type_id
            ).first()
            if existing:
                raise HTTPException(status_code=400, detail="服务类型名称已存在")
        
        # 更新字段
        update_data = service_type_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(service_type, field, value)
        
        db.commit()
        db.refresh(service_type)
        
        logger.info(f"更新服务类型成功: {service_type.name}")
        
        return {
            "success": True,
            "message": "服务类型更新成功",
            "data": service_type.to_dict()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新服务类型失败: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="更新服务类型失败")

@router.delete("/{service_type_id}", response_model=dict)
async def delete_service_type(
    service_type_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """删除服务类型"""
    try:
        service_type = db.query(ServiceType).filter(ServiceType.id == service_type_id).first()
        if not service_type:
            raise HTTPException(status_code=404, detail="服务类型不存在")
        
        # 检查是否有账号在使用此服务类型
        from ..models.account import Account
        account_count = db.query(Account).filter(Account.type == service_type.name).count()
        if account_count > 0:
            raise HTTPException(status_code=400, detail=f"无法删除，有 {account_count} 个账号正在使用此服务类型")
        
        db.delete(service_type)
        db.commit()
        
        logger.info(f"删除服务类型成功: {service_type.name}")
        
        return {
            "success": True,
            "message": "服务类型删除成功"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除服务类型失败: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="删除服务类型失败")

class BatchDeleteRequest(BaseModel):
    ids: List[int]

@router.post("/batch-delete", response_model=dict)
async def batch_delete_service_types(
    request_data: BatchDeleteRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """批量删除服务类型"""
    try:
        if not request_data.ids:
            raise HTTPException(status_code=400, detail="请提供要删除的服务类型ID列表")
        
        # 查找所有要删除的服务类型
        service_types = db.query(ServiceType).filter(ServiceType.id.in_(request_data.ids)).all()
        
        if len(service_types) != len(request_data.ids):
            missing_ids = set(request_data.ids) - {st.id for st in service_types}
            raise HTTPException(status_code=404, detail=f"以下服务类型不存在: {list(missing_ids)}")
        
        # 检查是否有账号在使用这些服务类型
        from ..models.account import Account
        used_service_types = []
        for service_type in service_types:
            account_count = db.query(Account).filter(Account.type == service_type.name).count()
            if account_count > 0:
                used_service_types.append(f"{service_type.name}({account_count}个账号)")
        
        if used_service_types:
            raise HTTPException(
                status_code=400, 
                detail=f"以下服务类型正在被使用，无法删除: {', '.join(used_service_types)}"
            )
        
        # 执行批量删除
        deleted_names = [st.name for st in service_types]
        for service_type in service_types:
            db.delete(service_type)
        
        db.commit()
        
        logger.info(f"批量删除服务类型成功: {', '.join(deleted_names)}")
        
        return {
            "success": True,
            "message": f"成功删除 {len(service_types)} 个服务类型",
            "deleted_count": len(service_types),
            "deleted_names": deleted_names
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"批量删除服务类型失败: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="批量删除服务类型失败")
