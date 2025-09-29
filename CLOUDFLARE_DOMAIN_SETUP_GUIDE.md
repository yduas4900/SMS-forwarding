# Cloudflare域名配置指南 - 解决国内访问问题

## 🎯 目标
将您的Railway应用绑定到Cloudflare托管的域名，解决国内访问限制问题。

## 📋 配置步骤

### 第1步：在Railway中配置自定义域名

1. **登录Railway控制台**
   - 访问 [railway.app](https://railway.app)
   - 进入您的SMS-forwarding项目

2. **添加自定义域名**
   - 点击项目设置 (Settings)
   - 找到 "Domains" 或 "Custom Domain" 选项
   - 点击 "Add Domain"
   - 输入您的域名，例如：`sms.yourdomain.com`

3. **获取Railway提供的目标地址**
   - Railway会提供一个目标地址（通常是 `xxx.railway.app`）
   - 记录这个地址，稍后在Cloudflare中使用

### 第2步：在Cloudflare中配置DNS记录

1. **登录Cloudflare控制台**
   - 访问 [cloudflare.com](https://cloudflare.com)
   - 选择您的域名

2. **添加CNAME记录**
   ```
   类型: CNAME
   名称: sms (或您想要的子域名)
   目标: [Railway提供的地址，如 xxx.railway.app]
   代理状态: 已代理 (橙色云朵图标)
   TTL: 自动
   ```

3. **启用Cloudflare代理**
   - 确保橙色云朵图标是激活状态
   - 这样流量会通过Cloudflare的CDN，有助于国内访问

### 第3步：配置Cloudflare优化设置

1. **SSL/TLS设置**
   - 进入 SSL/TLS 选项卡
   - 设置加密模式为 "完全" 或 "完全(严格)"

2. **速度优化**
   - 进入 "速度" 选项卡
   - 启用 "自动缩小" (Auto Minify)
   - 启用 "Brotli压缩"

3. **缓存设置**
   - 进入 "缓存" 选项卡
   - 设置缓存级别为 "标准"
   - 为静态文件设置适当的缓存规则

### 第4步：等待DNS传播

- DNS更改通常需要几分钟到几小时生效
- 可以使用在线DNS检查工具验证配置

## 🚀 推荐的域名配置

### 主要服务
```
sms.yourdomain.com -> Railway应用
```

### 可选的子域名
```
admin.yourdomain.com -> 管理后台
api.yourdomain.com -> API服务
customer.yourdomain.com -> 客户端页面
```

## 🔧 Cloudflare页面规则（可选）

为了更好的性能，可以设置页面规则：

1. **静态资源缓存**
   ```
   URL: sms.yourdomain.com/static/*
   设置: 缓存级别 = 缓存所有内容
   ```

2. **API请求**
   ```
   URL: sms.yourdomain.com/api/*
   设置: 缓存级别 = 绕过
   ```

## 🌍 国内访问优化

### Cloudflare中国网络
- Cloudflare在中国有CDN节点
- 启用代理后，国内用户访问速度会显著提升
- 可以绕过某些网络限制

### 备用方案
如果仍有访问问题，可以考虑：
1. **多个域名**：配置多个子域名作为备用
2. **CDN加速**：使用Cloudflare的额外加速功能
3. **地理路由**：为不同地区设置不同的路由规则

## 📞 配置完成后的测试

配置完成后，您可以通过以下方式测试：

1. **直接访问**
   ```
   https://sms.yourdomain.com/
   ```

2. **客户端链接**
   ```
   https://sms.yourdomain.com/customer/9ae8d107-3cca-4f6a-bec1-4dda5d79ed57
   ```

3. **健康检查**
   ```
   https://sms.yourdomain.com/health
   ```

## ❓ 需要的信息

为了帮您完成配置，我需要知道：
1. **您的域名是什么？** (例如：yourdomain.com)
2. **您希望使用什么子域名？** (例如：sms, app, service等)
3. **您是否已经在Railway中看到了目标地址？**

请提供这些信息，我将为您提供具体的配置步骤！
