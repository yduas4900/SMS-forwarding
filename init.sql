-- 初始化数据库脚本
-- Database initialization script

-- 创建数据库 (如果不存在)
-- CREATE DATABASE IF NOT EXISTS xianyu_db;

-- 使用数据库
-- \c xianyu_db;

-- 创建默认管理员用户 (密码: admin123)
-- 注意: 生产环境中应该修改默认密码
INSERT INTO users (username, email, hashed_password, is_active, is_superuser, full_name, created_at, updated_at)
VALUES (
    'admin',
    'admin@xianyu.com',
    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', -- admin123 (正确的bcrypt哈希)
    true,
    true,
    '系统管理员',
    NOW(),
    NOW()
) ON CONFLICT (username) DO NOTHING;

-- 创建示例账号类型数据
INSERT INTO accounts (account_name, username, type, image_url, description, status, created_at, updated_at)
VALUES 
    ('微信账号示例', 'wechat_demo', '微信', 'https://example.com/wechat.png', '微信账号示例', 'active', NOW(), NOW()),
    ('QQ账号示例', 'qq_demo', 'QQ', 'https://example.com/qq.png', 'QQ账号示例', 'active', NOW(), NOW()),
    ('支付宝账号示例', 'alipay_demo', '支付宝', 'https://example.com/alipay.png', '支付宝账号示例', 'active', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);
CREATE INDEX IF NOT EXISTS idx_devices_is_online ON devices(is_online);
CREATE INDEX IF NOT EXISTS idx_devices_last_heartbeat ON devices(last_heartbeat);

CREATE INDEX IF NOT EXISTS idx_sms_device_id ON sms(device_id);
CREATE INDEX IF NOT EXISTS idx_sms_timestamp ON sms(sms_timestamp);
CREATE INDEX IF NOT EXISTS idx_sms_category ON sms(category);
CREATE INDEX IF NOT EXISTS idx_sms_sender ON sms(sender);

CREATE INDEX IF NOT EXISTS idx_sms_rules_device_id ON sms_rules(device_id);
CREATE INDEX IF NOT EXISTS idx_sms_rules_is_active ON sms_rules(is_active);

CREATE INDEX IF NOT EXISTS idx_account_links_link_id ON account_links(link_id);
CREATE INDEX IF NOT EXISTS idx_account_links_account_id ON account_links(account_id);
CREATE INDEX IF NOT EXISTS idx_account_links_device_id ON account_links(device_id);
CREATE INDEX IF NOT EXISTS idx_account_links_status ON account_links(status);

-- 创建触发器函数用于自动更新 updated_at 字段
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为所有表创建更新时间触发器
CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON devices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sms_updated_at BEFORE UPDATE ON sms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sms_rules_updated_at BEFORE UPDATE ON sms_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_account_links_updated_at BEFORE UPDATE ON account_links
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 创建视图用于统计查询
CREATE OR REPLACE VIEW device_statistics AS
SELECT 
    COUNT(*) as total_devices,
    COUNT(CASE WHEN is_online = true THEN 1 END) as online_devices,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_devices,
    COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as today_new_devices
FROM devices;

CREATE OR REPLACE VIEW sms_statistics AS
SELECT 
    COUNT(*) as total_sms,
    COUNT(CASE WHEN category = 'verification' THEN 1 END) as verification_sms,
    COUNT(CASE WHEN category = 'promotion' THEN 1 END) as promotion_sms,
    COUNT(CASE WHEN category = 'normal' THEN 1 END) as normal_sms,
    COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as today_sms
FROM sms;

-- 插入一些示例数据 (仅用于开发测试)
-- 注意: 生产环境中应该删除这些示例数据

-- 示例设备数据
-- INSERT INTO devices (device_id, brand, model, os_version, phone_number, api_token, is_online, is_active, created_at, updated_at)
-- VALUES 
--     ('test_device_001', 'Samsung', 'Galaxy S21', 'Android 12', '13800138000', 'test_token_001', true, true, NOW(), NOW()),
--     ('test_device_002', 'Huawei', 'P40 Pro', 'Android 11', '13900139000', 'test_token_002', false, true, NOW(), NOW())
-- ON CONFLICT (device_id) DO NOTHING;

-- 提交事务
COMMIT;
