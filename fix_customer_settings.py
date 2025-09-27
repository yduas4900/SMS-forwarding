"""
修复客户浏览端设置功能
Fix customer site settings functionality
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# 设置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def fix_customer_settings():
    """修复客户端设置功能"""
    try:
        # 从环境变量获取数据库URL
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            logger.error("❌ 未找到DATABASE_URL环境变量")
            return False
            
        logger.info(f"🔗 连接数据库: {database_url[:50]}...")
        
        # 创建数据库引擎
        engine = create_engine(database_url)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        
        # 创建设置表
        logger.info("📋 创建系统设置表...")
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS system_settings (
            id SERIAL PRIMARY KEY,
            setting_key VARCHAR(100) UNIQUE NOT NULL,
            setting_value TEXT NOT NULL,
            setting_type VARCHAR(20) DEFAULT 'string',
            description VARCHAR(500),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
        
        with engine.connect() as conn:
            conn.execute(text(create_table_sql))
            conn.commit()
            logger.info("✅ 系统设置表创建成功")
        
        # 插入默认设置
        logger.info("📝 插入默认客户端设置...")
        
        default_settings = [
            ("customerSiteTitle", "验证码获取服务", "string", "客户端页面标题"),
            ("customerSiteDescription", "安全便捷的验证码获取服务", "string", "客户端页面描述"),
            ("customerSiteWelcomeText", "<h2>欢迎使用验证码获取服务</h2><p>请按照以下步骤获取您的验证码：</p><ol><li>复制用户名和密码</li><li>点击获取验证码按钮</li><li>等待验证码到达</li></ol>", "string", "客户端欢迎文本（支持HTML）"),
            ("customerSiteFooterText", "<p>如有问题，请联系客服。</p>", "string", "客户端页脚文本（支持HTML）"),
            ("customerSiteBackgroundColor", "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", "string", "客户端背景色"),
            ("customerSiteLogoUrl", "", "string", "客户端Logo URL"),
            ("customerSiteCustomCSS", "", "string", "客户端自定义CSS"),
            ("enableCustomerSiteCustomization", "true", "boolean", "启用客户端自定义"),
        ]
        
        with engine.connect() as conn:
            for key, value, setting_type, description in default_settings:
                # 检查设置是否已存在
                check_sql = text("SELECT COUNT(*) FROM system_settings WHERE setting_key = :key")
                result = conn.execute(check_sql, {"key": key}).scalar()
                
                if result == 0:
                    # 插入新设置
                    insert_sql = text("""
                        INSERT INTO system_settings (setting_key, setting_value, setting_type, description)
                        VALUES (:key, :value, :type, :desc)
                    """)
                    conn.execute(insert_sql, {
                        "key": key,
                        "value": value,
                        "type": setting_type,
                        "desc": description
                    })
                    logger.info(f"✅ 插入设置: {key}")
                else:
                    logger.info(f"⚠️ 设置已存在: {key}")
            
            conn.commit()
        
        logger.info("🎉 客户端设置修复完成！")
        return True
        
    except Exception as e:
        logger.error(f"❌ 修复失败: {str(e)}")
        return False

if __name__ == "__main__":
    success = fix_customer_settings()
    if success:
        print("✅ 修复成功！请重启应用并测试客户端设置功能。")
    else:
        print("❌ 修复失败！请检查错误信息。")
