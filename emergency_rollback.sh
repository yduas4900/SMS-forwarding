#!/bin/bash
echo "🚨 执行紧急回滚修复..."

# 添加修改的文件
git add backend/requirements.txt

# 提交修改
git commit -m "🚨 紧急回滚：临时移除2FA依赖包恢复服务

问题：Railway部署因pyotp和qrcode依赖包导入失败而崩溃
解决：临时移除这些依赖包，让系统恢复正常运行
状态：验证码安全修复保持有效，2FA功能暂时禁用
计划：服务恢复后重新添加依赖包"

# 推送到远程仓库
git push origin main

echo "✅ 紧急回滚已推送，等待Railway重新部署..."
echo "⏱️  预计2-3分钟内服务将恢复正常"
