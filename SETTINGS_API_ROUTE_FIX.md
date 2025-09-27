# 系统设置API路由修复

## 🚨 问题描述

用户点击"保存设置"按钮后出现500错误，API调用失败。

**错误信息：**
- POST `/api/settings` 返回500 Internal Server Error
- 前端显示"更新系统设置失败"
- 开发者工具显示AxiosError和ERR_BAD_RESPONSE

## 🔍 问题分析

API路由配置存在冲突：

1. **重复prefix问题**：
   - `backend/app/api/settings.py` 中设置了 `prefix="/api/settings"`
   - `backend/app/main.py` 中注册时没有指定prefix
   - 导致路由路径配置错误

2. **路由注册问题**：
   - 实际路径变成了 `/api/settings/api/settings`
   - 前端调用 `/api/settings` 无法匹配到正确的路由

## ✅ 修复方案

### 1. 修复API路由定义
```python
# backend/app/api/settings.py
# 修复前
router = APIRouter(prefix="/api/settings", tags=["系统设置"])

# 修复后  
router = APIRouter(tags=["系统设置"])
```

### 2. 修复主应用路由注册
```python
# backend/app/main.py
# 修复前
app.include_router(settings_api.router, tags=["系统设置"])

# 修复后
app.include_router(settings_api.router, prefix="/api/settings", tags=["系统设置"])
```

## 🔧 修复文件

- `backend/app/api/settings.py` - 移除重复的prefix
- `backend/app/main.py` - 在路由注册时添加正确的prefix

## 📋 API路由结构

修复后的正确路由：
- `GET /api/settings` - 获取系统设置
- `POST /api/settings` - 更新系统设置
- `POST /api/settings/reset` - 重置设置
- `GET /api/settings/export` - 导出设置
- `POST /api/settings/import` - 导入设置

## 🎯 修复验证

修复后应该能够：
- ✅ 正确访问 `/api/settings` 端点
- ✅ 成功保存系统设置
- ✅ 前端显示保存成功提示
- ✅ 设置数据正确持久化

## 📝 经验教训

1. **避免重复prefix**：不要在APIRouter和include_router中重复设置prefix
2. **统一路由管理**：在主应用中统一管理所有路由的prefix
3. **测试API端点**：确保API路径配置正确
4. **检查路由冲突**：避免路由路径重复或冲突

## 🔄 最佳实践

**推荐的路由配置模式：**
```python
# API模块中
router = APIRouter(tags=["模块名"])

# 主应用中
app.include_router(module.router, prefix="/api/module", tags=["模块名"])
```

这样可以确保路由路径清晰、一致且易于维护。
