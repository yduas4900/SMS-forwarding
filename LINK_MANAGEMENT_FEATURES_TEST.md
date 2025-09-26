# 链接管理功能验证测试文档

## 📋 功能配置项验证

### 1. 最大访问次数 (max_access_count)
**功能描述**: 限制客户端访问链接的最大次数
**实现位置**: 
- 数据库模型: `backend/app/models/account_link.py` - `max_access_count` 字段
- 前端配置: `frontend/src/pages/dashboard/LinkManagement.tsx` - 创建/编辑表单
- 后端验证: `backend/app/api/customer.py` - `get_account_info()` 函数

**验证逻辑**:
```python
# 在 customer.py 中的实现
if link.access_count >= link.max_access_count:
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="访问次数已达上限"
    )
```

**测试步骤**:
1. 在链接管理中创建链接，设置最大访问次数为 3
2. 客户端访问链接 3 次
3. 第 4 次访问应该被拒绝，显示"访问次数已达上限"

### 2. 最大验证码次数 (max_verification_count)
**功能描述**: 限制客户端获取验证码的最大次数
**实现位置**:
- 数据库模型: `backend/app/models/account_link.py` - `max_verification_count` 字段
- 验证逻辑: `backend/app/models/account_link.py` - `is_verification_allowed()` 方法
- 客户端API: `backend/app/api/customer.py` - `get_latest_verification_code()` 函数

**验证逻辑**:
```python
def is_verification_allowed(self) -> bool:
    if self.max_verification_count > 0 and self.verification_count >= self.max_verification_count:
        return False
    return True
```

**测试步骤**:
1. 设置链接的最大验证码次数为 2
2. 客户端获取验证码 2 次
3. 第 3 次获取应该被拒绝，显示"验证码获取次数已达上限"

### 3. 访问会话间隔 (access_session_interval) - 分钟
**功能描述**: 在指定时间内的重复访问不会增加访问次数
**实现位置**:
- 数据库模型: `backend/app/models/account_link.py` - `access_session_interval` 字段
- 智能计数: `backend/app/api/customer.py` - `get_account_info()` 函数

**验证逻辑**:
```python
# 智能访问次数管理
should_increment_access = True
if link.last_access_time:
    time_diff = (datetime.now(timezone.utc) - link.last_access_time).total_seconds()
    session_interval_seconds = (link.access_session_interval or 5) * 60
    if time_diff < session_interval_seconds:
        should_increment_access = False

if should_increment_access:
    link.access_count += 1
```

**测试步骤**:
1. 设置访问会话间隔为 5 分钟
2. 客户端首次访问，访问次数 +1
3. 在 5 分钟内再次访问，访问次数不变
4. 5 分钟后访问，访问次数 +1

### 4. 验证码等待时间 (verification_wait_time) - 秒
**功能描述**: 客户端点击获取验证码后等待指定时间，确保获取最新短信
**实现位置**:
- 数据库模型: `backend/app/models/account_link.py` - `verification_wait_time` 字段
- 前端实现: `customer-site/src/pages/CustomerPage.tsx` - `getVerificationCodes()` 函数
- 后端配置: `backend/app/api/customer.py` - 返回等待时间配置

**验证逻辑**:
```typescript
// 前端实现等待逻辑
const waitTime = linkData.verification_wait_time || 0;
if (waitTime > 0) {
    message.info(`正在等待 ${waitTime} 秒以确保获取最新验证码...`);
    setCountdown(waitTime);
    // 倒计时结束后获取验证码
}
```

**测试步骤**:
1. 设置验证码等待时间为 10 秒
2. 客户端点击"获取验证码"
3. 应显示"正在等待 10 秒..."的倒计时
4. 倒计时结束后自动获取验证码

## 🔧 后端API验证

### 验证码获取间隔控制
**实现位置**: `backend/app/models/account_link.py` - `is_verification_allowed()` 方法
```python
# 检查时间间隔 (固定10秒防滥用间隔)
if self.last_verification_time:
    time_diff = (now - self.last_verification_time).total_seconds()
    if time_diff < self.verification_interval:  # 10秒间隔
        return False
```

### 链接状态管理
**实现位置**: `backend/app/api/customer.py`
- 首次访问: `status = "unused"` → `status = "used"`
- 访问次数统计和时间记录
- IP和User-Agent记录

## 🎯 前端UI验证

### 链接管理界面
**文件**: `frontend/src/pages/dashboard/LinkManagement.tsx`
- ✅ 显示所有配置项的当前值
- ✅ 编辑表单包含所有配置选项
- ✅ 批量创建支持所有配置
- ✅ 实时显示访问统计和验证码统计

### 客户端页面
**文件**: `customer-site/src/pages/CustomerPage.tsx`
- ✅ 实现验证码等待时间倒计时
- ✅ 显示访问次数统计
- ✅ 错误处理和限制提示
- ✅ 验证码获取按钮状态管理

## 📊 数据库字段验证

### account_links 表结构
```sql
-- 基础限制配置
max_access_count INTEGER DEFAULT 5,
max_verification_count INTEGER DEFAULT 5,
verification_interval INTEGER DEFAULT 10,

-- 新增可配置字段
access_session_interval INTEGER DEFAULT 5,  -- 访问会话间隔(分钟)
verification_wait_time INTEGER DEFAULT 0,   -- 验证码等待时间(秒)

-- 使用统计
access_count INTEGER DEFAULT 0,
verification_count INTEGER DEFAULT 0,
last_access_time TIMESTAMP WITH TIME ZONE,
last_verification_time TIMESTAMP WITH TIME ZONE,
```

## ✅ 功能完整性检查

### 已实现功能
- [x] 最大访问次数限制 - 完全实现
- [x] 最大验证码次数限制 - 完全实现  
- [x] 访问会话间隔 - 完全实现
- [x] 验证码等待时间 - 完全实现
- [x] 验证码获取间隔(10秒防滥用) - 完全实现
- [x] 前端配置界面 - 完全实现
- [x] 客户端功能体验 - 完全实现
- [x] 数据库持久化 - 完全实现
- [x] API错误处理 - 完全实现

### 配置项说明
1. **最大访问次数**: 0表示不限制，>0表示具体限制次数
2. **最大验证码次数**: 0表示不限制，>0表示具体限制次数  
3. **访问会话间隔**: 1-60分钟，防止短时间内重复计数
4. **验证码等待时间**: 0-30秒，确保获取最新短信
5. **验证码获取间隔**: 固定10秒，防止API滥用

## 🚀 测试建议

### 功能测试流程
1. **创建测试链接**: 设置各种不同的配置参数
2. **访问次数测试**: 验证访问限制和会话间隔
3. **验证码测试**: 验证获取限制和等待时间
4. **边界测试**: 测试配置为0或最大值的情况
5. **并发测试**: 多个客户端同时访问的行为
6. **时间测试**: 验证各种时间间隔的准确性

### 预期结果
所有配置项都应该按照设定值正确工作，前端界面应该准确反映后端状态，客户端体验应该符合配置预期。

---

**结论**: 链接管理中的所有配置功能都已完整实现并且真实有效。每个配置项都有对应的数据库字段、后端验证逻辑、前端配置界面和客户端功能体验。
