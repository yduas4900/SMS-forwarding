import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, message, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Login.css';

const { Title } = Typography;

interface LoginForm {
  username: string;
  password: string;
}

interface SystemSettings {
  systemName: string;
  systemDescription: string;
  systemVersion: string;
}

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  // 获取系统设置（无需认证）
  useEffect(() => {
    const fetchSystemSettings = async () => {
      try {
        // 尝试获取公开的系统设置
        const response = await axios.get('/api/settings/public');
        if (response.data.success) {
          setSystemSettings(response.data.data);
        }
      } catch (error) {
        console.log('获取系统设置失败，使用默认值');
        // 使用默认值
        setSystemSettings({
          systemName: '系统管理',
          systemDescription: '管理员登录',
          systemVersion: '1.0.0'
        });
      }
    };
    
    fetchSystemSettings();
  }, []);

  const onFinish = async (values: LoginForm) => {
    setLoading(true);
    try {
      console.log('🔐 Login页面开始登录:', values.username);
      const success = await login(values.username, values.password);
      console.log('🔐 Login页面登录结果:', success);
      
      if (success) {
        message.success('登录成功！');
        console.log('🔐 Login页面跳转到dashboard');
        navigate('/dashboard');
      } else {
        console.error('❌ Login页面登录失败: 返回false');
        message.error('登录失败，请检查用户名和密码');
      }
    } catch (error: any) {
      console.error('❌ Login页面登录异常:', error);
      const errorMessage = error.message || '登录失败，请检查用户名和密码';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <Card className="login-card">
        <div className="login-header">
          <Title level={2}>{systemSettings?.systemName || '系统管理'}</Title>
          <p>{systemSettings?.systemDescription || '管理员登录'}</p>
        </div>
        
        <Form
          name="login"
          onFinish={onFinish}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[
              { required: true, message: '请输入用户名！' },
              { min: 3, message: '用户名至少3个字符！' }
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码！' },
              { min: 6, message: '密码至少6个字符！' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
            >
              登录
            </Button>
          </Form.Item>
        </Form>
        
        <div className="login-footer">
          <p>{systemSettings?.systemName || '系统管理'} {systemSettings?.systemVersion || 'v1.0.0'}</p>
        </div>
      </Card>
    </div>
  );
};

export default Login;
