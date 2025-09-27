# 📚 SMS转发管理系统 - API文档

## 📋 目录

- [🔗 基础信息](#-基础信息)
- [🔐 身份认证](#-身份认证)
- [📱 设备管理](#-设备管理)
- [📨 短信管理](#-短信管理)
- [👥 账号管理](#-账号管理)
- [🔗 链接管理](#-链接管理)
- [⚙️ 规则管理](#️-规则管理)
- [🔍 监控接口](#-监控接口)
- [❌ 错误处理](#-错误处理)

## 🔗 基础信息

### 服务器地址

- **开发环境**: `http://localhost:8000`
- **生产环境**: `https://your-domain.com`

### API版本

- **当前版本**: `v1.0.0`
- **API前缀**: `/api`

### 请求格式

- **Content-Type**: `application/json`
- **字符编码**: `UTF-8`
- **时间格式**: `ISO 8601` (例: `2024-01-01T12:00:00Z`)

### 响应格式

所有API响应都遵循统一格式：

```json
{
  "success": true,
  "message": "操作成功",
  "data": {
    // 具体数据
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

错误响应格式：

```json
{
  "success": false,
  "message": "错误描述",
  "error_code": "ERROR_CODE",
  "details": {
    // 错误详情
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 🔐 身份认证

### 登录

**POST** `/api/auth/login`

获取访问令牌。

#### 请求参数

```json
{
  "username": "admin",
  "password": "admin123"
}
```

#### 响应示例

```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "expires_in": 1800,
    "user": {
      "id": 1,
      "username": "admin",
      "role": "admin",
      "created_at": "2024-01-01T12:00:00Z"
    }
  }
}
```

### 令牌验证

**GET** `/api/auth/me`

验证当前用户令牌并获取用户信息。

#### 请求头

```
Authorization: Bearer <access_token>
```

#### 响应示例

```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin",
    "role": "admin",
    "created_at": "2024-01-01T12:00:00Z"
  }
}
```

### 刷新令牌

**POST** `/api/auth/refresh`

刷新访问令牌。

#### 请求头

```
Authorization: Bearer <access_token>
```

#### 响应示例

```json
{
  "success": true,
  "data": {
    "access_token": "new_token_here",
    "token_type": "bearer",
    "expires_in": 1800
  }
}
```

## 📱 设备管理

### 获取设备列表

**GET** `/api/devices`

获取所有设备列表。

#### 查询参数

| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `page` | integer | 否 | 页码，默认1 |
| `size` | integer | 否 | 每页数量，默认20 |
| `status` | string | 否 | 设备状态筛选 |
| `search` | string | 否 | 搜索关键词 |

#### 响应示例

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "device_id": "device_001",
        "name": "小米手机",
        "brand": "Xiaomi",
        "model": "Mi 11",
        "phone_number": "13800138000",
        "status": "online",
        "last_heartbeat": "2024-01-01T12:00:00Z",
        "created_at": "2024-01-01T10:00:00Z",
        "updated_at": "2024-01-01T12:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20,
    "pages": 1
  }
}
```

### 获取设备详情

**GET** `/api/devices/{device_id}`

获取指定设备的详细信息。

#### 路径参数

| 参数 | 类型 | 描述 |
|------|------|------|
| `device_id` | string | 设备ID |

#### 响应示例

```json
{
  "success": true,
  "data": {
    "id": 1,
    "device_id": "device_001",
    "name": "小米手机",
    "brand": "Xiaomi",
    "model": "Mi 11",
    "phone_number": "13800138000",
    "status": "online",
    "last_heartbeat": "2024-01-01T12:00:00Z",
    "system_info": {
      "android_version": "11",
      "api_level": 30,
      "battery_level": 85
    },
    "statistics": {
      "total_sms": 1250,
      "today_sms": 45,
      "success_rate": 98.5
    },
    "created_at": "2024-01-01T10:00:00Z",
    "updated_at": "2024-01-01T12:00:00Z"
  }
}
```

### 添加设备

**POST** `/api/devices`

添加新设备。

#### 请求参数

```json
{
  "device_id": "device_002",
  "name": "华为手机",
  "brand": "Huawei",
  "model": "P40",
  "phone_number": "13900139000"
}
```

#### 响应示例

```json
{
  "success": true,
  "message": "设备添加成功",
  "data": {
    "id": 2,
    "device_id": "device_002",
    "name": "华为手机",
    "brand": "Huawei",
    "model": "P40",
    "phone_number": "13900139000",
    "status": "offline",
    "created_at": "2024-01-01T12:30:00Z"
  }
}
```

### 更新设备

**PUT** `/api/devices/{device_id}`

更新设备信息。

#### 请求参数

```json
{
  "name": "华为P40 Pro",
  "phone_number": "13900139001"
}
```

### 删除设备

**DELETE** `/api/devices/{device_id}`

删除指定设备。

#### 响应示例

```json
{
  "success": true,
  "message": "设备删除成功"
}
```

### 设备心跳

**POST** `/api/devices/{device_id}/heartbeat`

设备心跳上报。

#### 请求参数

```json
{
  "status": "online",
  "battery_level": 85,
  "signal_strength": -65,
  "system_info": {
    "android_version": "11",
    "api_level": 30,
    "app_version": "1.0.0"
  }
}
```

## 📨 短信管理

### 获取短信列表

**GET** `/api/sms`

获取短信列表。

#### 查询参数

| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `page` | integer | 否 | 页码，默认1 |
| `size` | integer | 否 | 每页数量，默认20 |
| `device_id` | string | 否 | 设备ID筛选 |
| `sender` | string | 否 | 发送方筛选 |
| `content` | string | 否 | 内容搜索 |
| `start_date` | string | 否 | 开始日期 |
| `end_date` | string | 否 | 结束日期 |
| `sms_type` | string | 否 | 短信类型 |

#### 响应示例

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "device_id": "device_001",
        "sender": "10086",
        "content": "您的验证码是123456，请在5分钟内使用。",
        "sms_type": "verification",
        "verification_code": "123456",
        "received_at": "2024-01-01T12:00:00Z",
        "forwarded": true,
        "forwarded_at": "2024-01-01T12:00:05Z",
        "device": {
          "name": "小米手机",
          "phone_number": "13800138000"
        }
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20,
    "pages": 1
  }
}
```

### 获取短信详情

**GET** `/api/sms/{sms_id}`

获取指定短信的详细信息。

#### 响应示例

```json
{
  "success": true,
  "data": {
    "id": 1,
    "device_id": "device_001",
    "sender": "10086",
    "content": "您的验证码是123456，请在5分钟内使用。",
    "sms_type": "verification",
    "verification_code": "123456",
    "received_at": "2024-01-01T12:00:00Z",
    "forwarded": true,
    "forwarded_at": "2024-01-01T12:00:05Z",
    "forward_rules": [
      {
        "id": 1,
        "name": "验证码转发规则",
        "target": "webhook_url"
      }
    ],
    "device": {
      "id": 1,
      "name": "小米手机",
      "phone_number": "13800138000"
    }
  }
}
```

### 上传短信

**POST** `/api/sms/upload`

设备上传短信数据。

#### 请求参数

```json
{
  "device_id": "device_001",
  "messages": [
    {
      "sender": "10086",
      "content": "您的验证码是123456，请在5分钟内使用。",
      "received_at": "2024-01-01T12:00:00Z",
      "message_id": "msg_001"
    }
  ]
}
```

#### 响应示例

```json
{
  "success": true,
  "message": "短信上传成功",
  "data": {
    "processed": 1,
    "duplicates": 0,
    "errors": 0
  }
}
```

### 批量删除短信

**DELETE** `/api/sms/batch`

批量删除短信。

#### 请求参数

```json
{
  "sms_ids": [1, 2, 3, 4, 5]
}
```

## 👥 账号管理

### 获取账号列表

**GET** `/api/accounts`

获取所有账号列表。

#### 响应示例

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "name": "测试账号1",
        "phone_number": "13800138000",
        "platform": "微信",
        "status": "active",
        "device_id": "device_001",
        "created_at": "2024-01-01T10:00:00Z",
        "device": {
          "name": "小米手机",
          "status": "online"
        }
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20,
    "pages": 1
  }
}
```

### 添加账号

**POST** `/api/accounts`

添加新账号。

#### 请求参数

```json
{
  "name": "测试账号2",
  "phone_number": "13900139000",
  "platform": "支付宝",
  "device_id": "device_001",
  "description": "用于支付宝验证码接收"
}
```

### 更新账号

**PUT** `/api/accounts/{account_id}`

更新账号信息。

### 删除账号

**DELETE** `/api/accounts/{account_id}`

删除指定账号。

## 🔗 链接管理

### 获取链接列表

**GET** `/api/links`

获取所有访问链接。

#### 响应示例

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "link_id": "abc123def456",
        "name": "客户A访问链接",
        "account_id": 1,
        "status": "active",
        "access_count": 25,
        "last_access": "2024-01-01T11:30:00Z",
        "expires_at": "2024-12-31T23:59:59Z",
        "created_at": "2024-01-01T10:00:00Z",
        "account": {
          "name": "测试账号1",
          "phone_number": "13800138000"
        }
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20,
    "pages": 1
  }
}
```

### 创建访问链接

**POST** `/api/links`

为账号创建访问链接。

#### 请求参数

```json
{
  "name": "客户B访问链接",
  "account_id": 1,
  "expires_at": "2024-12-31T23:59:59Z",
  "max_access_count": 1000,
  "description": "客户B专用访问链接"
}
```

#### 响应示例

```json
{
  "success": true,
  "message": "链接创建成功",
  "data": {
    "id": 2,
    "link_id": "xyz789uvw012",
    "name": "客户B访问链接",
    "account_id": 1,
    "status": "active",
    "access_url": "https://your-domain.com/customer/xyz789uvw012",
    "expires_at": "2024-12-31T23:59:59Z",
    "created_at": "2024-01-01T12:30:00Z"
  }
}
```

### 获取链接详情

**GET** `/api/links/{link_id}`

获取指定链接的详细信息。

### 更新链接

**PUT** `/api/links/{link_id}`

更新链接信息。

### 删除链接

**DELETE** `/api/links/{link_id}`

删除指定链接。

## 🌐 客户端接口

### 获取账号信息

**GET** `/api/get_account_info`

客户端通过链接获取账号信息。

#### 查询参数

| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `link_id` | string | 是 | 访问链接ID |

#### 响应示例

```json
{
  "success": true,
  "data": {
    "account": {
      "name": "测试账号1",
      "phone_number": "13800138000",
      "platform": "微信"
    },
    "recent_sms": [
      {
        "id": 1,
        "sender": "10086",
        "content": "您的验证码是123456，请在5分钟内使用。",
        "verification_code": "123456",
        "received_at": "2024-01-01T12:00:00Z"
      }
    ],
    "device_status": "online"
  }
}
```

## ⚙️ 规则管理

### 获取转发规则

**GET** `/api/sms-rules`

获取所有短信转发规则。

#### 响应示例

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "name": "验证码转发规则",
        "match_type": "content",
        "match_value": "验证码",
        "target_type": "webhook",
        "target_value": "https://api.example.com/webhook",
        "enabled": true,
        "priority": 1,
        "created_at": "2024-01-01T10:00:00Z"
      }
    ],
    "total": 1
  }
}
```

### 创建转发规则

**POST** `/api/sms-rules`

创建新的转发规则。

#### 请求参数

```json
{
  "name": "支付宝验证码转发",
  "match_type": "sender",
  "match_value": "支付宝",
  "target_type": "webhook",
  "target_value": "https://api.example.com/alipay-webhook",
  "enabled": true,
  "priority": 2
}
```

### 更新转发规则

**PUT** `/api/sms-rules/{rule_id}`

更新转发规则。

### 删除转发规则

**DELETE** `/api/sms-rules/{rule_id}`

删除转发规则。

## 🔍 监控接口

### 健康检查

**GET** `/health`

检查系统健康状态。

#### 响应示例

```json
{
  "status": "healthy",
  "app_name": "Mobile Information Management System",
  "version": "1.0.0",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 系统统计

**GET** `/api/stats`

获取系统统计信息。

#### 响应示例

```json
{
  "success": true,
  "data": {
    "devices": {
      "total": 5,
      "online": 3,
      "offline": 2
    },
    "sms": {
      "total": 12500,
      "today": 145,
      "this_week": 980,
      "this_month": 4200
    },
    "accounts": {
      "total": 25,
      "active": 20
    },
    "links": {
      "total": 15,
      "active": 12
    }
  }
}
```

### 实时监控

**GET** `/api/monitor/realtime`

获取实时监控数据。

#### 响应示例

```json
{
  "success": true,
  "data": {
    "current_time": "2024-01-01T12:00:00Z",
    "active_devices": 3,
    "recent_sms": [
      {
        "id": 1001,
        "device_name": "小米手机",
        "sender": "10086",
        "content": "您的验证码是654321",
        "received_at": "2024-01-01T11:59:30Z"
      }
    ],
    "system_load": {
      "cpu_usage": 25.5,
      "memory_usage": 68.2,
      "disk_usage": 45.8
    }
  }
}
```

## ❌ 错误处理

### HTTP状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 403 | 禁止访问 |
| 404 | 资源不存在 |
| 422 | 数据验证失败 |
| 500 | 服务器内部错误 |

### 错误代码

| 错误代码 | 说明 |
|----------|------|
| `INVALID_CREDENTIALS` | 登录凭据无效 |
| `TOKEN_EXPIRED` | 访问令牌已过期 |
| `DEVICE_NOT_FOUND` | 设备不存在 |
| `ACCOUNT_NOT_FOUND` | 账号不存在 |
| `LINK_EXPIRED` | 访问链接已过期 |
| `VALIDATION_ERROR` | 数据验证错误 |
| `DATABASE_ERROR` | 数据库操作错误 |
| `PERMISSION_DENIED` | 权限不足 |

### 错误响应示例

```json
{
  "success": false,
  "message": "设备不存在",
  "error_code": "DEVICE_NOT_FOUND",
  "details": {
    "device_id": "device_999",
    "requested_at": "2024-01-01T12:00:00Z"
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 📝 使用示例

### Python示例

```python
import requests
import json

# 基础配置
BASE_URL = "https://your-domain.com/api"
USERNAME = "admin"
PASSWORD = "admin123"

class SMSForwardingAPI:
    def __init__(self, base_url, username, password):
        self.base_url = base_url
        self.token = None
        self.login(username, password)
    
    def login(self, username, password):
        """登录获取token"""
        response = requests.post(
            f"{self.base_url}/auth/login",
            json={"username": username, "password": password}
        )
        if response.status_code == 200:
            data = response.json()
            self.token = data["data"]["access_token"]
        else:
            raise Exception("登录失败")
    
    def get_headers(self):
        """获取请求头"""
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def get_devices(self):
        """获取设备列表"""
        response = requests.get(
            f"{self.base_url}/devices",
            headers=self.get_headers()
        )
        return response.json()
    
    def get_sms_list(self, device_id=None, page=1, size=20):
        """获取短信列表"""
        params = {"page": page, "size": size}
        if device_id:
            params["device_id"] = device_id
        
        response = requests.get(
            f"{self.base_url}/sms",
            headers=self.get_headers(),
            params=params
        )
        return response.json()

# 使用示例
api = SMSForwardingAPI(BASE_URL, USERNAME, PASSWORD)

# 获取设备列表
devices = api.get_devices()
print("设备列表:", json.dumps(devices, indent=2, ensure_ascii=False))

# 获取短信列表
sms_list = api.get_sms_list(page=1, size=10)
print("短信列表:", json.dumps(sms_list, indent=2, ensure_ascii=False))
```

### JavaScript示例

```javascript
class SMSForwardingAPI {
    constructor(baseUrl, username, password) {
        this.baseUrl = baseUrl;
        this.token = null;
        this.login(username, password);
    }
    
    async login(username, password) {
        const response = await fetch(`${this.baseUrl}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        if (response.ok) {
            const data = await response.json();
            this.token = data.data.access_token;
        } else {
            throw new Error('登录失败');
        }
    }
    
    getHeaders() {
        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        };
    }
    
    async getDevices() {
        const response = await fetch(`${this.baseUrl}/devices`, {
            headers: this.getHeaders()
        });
        return await response.json();
    }
    
    async getSMSList(deviceId = null, page = 1, size = 20) {
        const params = new URLSearchParams({ page, size });
        if (deviceId) params.append('device_id', deviceId);
        
        const response = await fetch(`${this.baseUrl}/sms?${params}`, {
            headers: this.getHeaders()
        });
        return await response.json();
    }
}

// 使用示例
const api = new SMSForwardingAPI('https://your-domain.com/api', 'admin', 'admin123');

// 获取设备列表
api.getDevices().then(devices => {
    console.log('设备列表:', devices);
});

// 获取短信列表
api.getSMSList(null, 1, 10).then(smsList => {
    console.log('短信列表:', smsList);
});
```

## 📞 技术支持

如果您在使用API过程中遇到问题：

1. **查看错误响应** - 检查返回的错误代码和详细信息
2. **检查请求格式** - 确保请求参数和格式正确
3. **验证权限** - 确保有足够的权限访问相关接口
4. **联系支持** - 通过GitHub Issues或邮件联系技术支持

---

**API文档版本**: v1.0.0  
**最后更新**: 2024-01-01  
**维护者**: SMS转发管理系统开发团队
