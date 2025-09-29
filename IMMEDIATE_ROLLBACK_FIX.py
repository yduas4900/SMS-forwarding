#!/usr/bin/env python3
"""
立即回滚修复脚本 - 临时移除2FA依赖以恢复服务
Immediate rollback fix - temporarily remove 2FA dependencies to restore service
"""

import os
import shutil

def rollback_requirements():
    """临时移除requirements.txt中的2FA依赖"""
    requirements_path = "backend/requirements.txt"
    
    if not os.path.exists(requirements_path):
        print("❌ requirements.txt文件不存在")
        return False
    
    # 备份原文件
    shutil.copy(requirements_path, f"{requirements_path}.backup")
    print(f"✅ 已备份 {requirements_path}")
    
    # 读取当前内容
    with open(requirements_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # 移除2FA相关依赖
    filtered_lines = []
    removed_deps = []
    
    for line in lines:
        line_stripped = line.strip()
        if line_stripped.startswith('pyotp') or line_stripped.startswith('qrcode'):
            removed_deps.append(line_stripped)
            print(f"🗑️  移除依赖: {line_stripped}")
        else:
            filtered_lines.append(line)
    
    # 写入修改后的内容
    with open(requirements_path, 'w', encoding='utf-8') as f:
        f.writelines(filtered_lines)
    
    print(f"✅ 已更新 {requirements_path}")
    print(f"📝 移除的依赖: {removed_deps}")
    
    return True

def create_commit_script():
    """创建提交脚本"""
    script_content = '''#!/bin/bash
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
'''
    
    with open('emergency_rollback.sh', 'w', encoding='utf-8') as f:
        f.write(script_content)
    
    # 设置执行权限（在Windows上可能不需要）
    try:
        os.chmod('emergency_rollback.sh', 0o755)
    except:
        pass
    
    print("✅ 已创建 emergency_rollback.sh 脚本")

def main():
    print("🚨 开始执行紧急回滚修复...")
    print("=" * 50)
    
    # 1. 回滚requirements.txt
    if rollback_requirements():
        print("✅ requirements.txt 回滚成功")
    else:
        print("❌ requirements.txt 回滚失败")
        return
    
    # 2. 创建提交脚本
    create_commit_script()
    
    print("=" * 50)
    print("🎯 下一步操作：")
    print("1. 运行: bash emergency_rollback.sh")
    print("2. 等待Railway重新部署（2-3分钟）")
    print("3. 验证网站恢复正常")
    print("4. 稍后重新添加2FA依赖包")
    print("=" * 50)
    print("📝 说明：")
    print("- 验证码安全修复仍然有效")
    print("- 2FA功能暂时不可用（但不影响现有登录）")
    print("- 服务恢复后可重新启用2FA功能")

if __name__ == "__main__":
    main()
