import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, message, Typography, Row, Col } from 'antd';
import { UserOutlined, LockOutlined, SafetyOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Login.css';

const { Title } = Typography;

interface LoginForm {
  username: string;
  password: string;
  captcha?: string;
}

interface SystemSettings {
  systemName: string;
  systemDescription: string;
  systemVersion: string;
}

interface CaptchaSettings {
  enableLoginCaptcha: boolean;
  captchaType?: string;
  captchaLength?: number;
  captchaMaxAttempts?: number;
  captchaLockDuration?: number;
  captchaDifficulty?: string;
}

interface CaptchaData {
  captcha_id: string;
  captcha_image: string;
}

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [captchaSettings, setCaptchaSettings] = useState<CaptchaSettings>({ enableLoginCaptcha: false });
  const [captchaData, setCaptchaData] = useState<CaptchaData | null>(null);
  const [captchaLoading, setCaptchaLoading] = useState(false);
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

  // 获取验证码设置
  useEffect(() => {
    const fetchCaptchaSettings = async () => {
      try {
        console.log('🔍 开始获取验证码设置...');
        const response = await axios.get('/api/auth/captcha/settings');
        console.log('🔍 验证码设置响应:', response.data);
        
        if (response.data.success) {
          setCaptchaSettings(response.data.data);
          console.log('🔍 验证码设置已更新:', response.data.data);
          
          // 如果启用了验证码，自动获取验证码
          if (response.data.data.enableLoginCaptcha) {
            console.log('🔍 验证码已启用，开始获取验证码图片...');
            // 直接调用获取验证码，不依赖状态
            fetchCaptchaDirectly();
          } else {
            console.log('🔍 验证码未启用');
          }
        }
      } catch (error) {
        console.error('❌ 获取验证码设置失败:', error);
        setCaptchaSettings({ enableLoginCaptcha: false });
      }
    };
    
    fetchCaptchaSettings();
  }, []);

  // 直接获取验证码（不检查状态）
  const fetchCaptchaDirectly = async () => {
    setCaptchaLoading(true);
    try {
      const response = await axios.get('/api/auth/captcha');
      if (response.data) {
        setCaptchaData({
          captcha_id: response.data.captcha_id,
          captcha_image: response.data.captcha_image
        });
      }
    } catch (error) {
      console.error('获取验证码失败:', error);
      message.error('获取验证码失败');
    } finally {
      setCaptchaLoading(false);
    }
  };

  // 获取验证码（带状态检查）
  const fetchCaptcha = async () => {
    if (!captchaSettings.enableLoginCaptcha) return;
    
    setCaptchaLoading(true);
    try {
      const response = await axios.get('/api/auth/captcha');
      if (response.data) {
        setCaptchaData({
          captcha_id: response.data.captcha_id,
          captcha_image: response.data.captcha_image
        });
      }
    } catch (error) {
      console.error('获取验证码失败:', error);
      message.error('获取验证码失败');
    } finally {
      setCaptchaLoading(false);
    }
  };

  // 刷新验证码
  const refreshCaptcha = () => {
    fetchCaptcha();
  };

  const onFinish = async (values: LoginForm) => {
    setLoading(true);
    try {
      console.log('🔐 Login页面开始登录:', values.username);
      console.log('🔐 验证码设置状态:', captchaSettings);
      console.log('🔐 验证码数据:', captchaData);
      console.log('🔐 强制部署标记: v2.0.1');
      
      // 如果启用了验证码，使用带验证码的登录API
      if (captchaSettings.enableLoginCaptcha && captchaData) {
        console.log('🔐 使用带验证码的登录API');
        
        if (!values.captcha) {
          message.error('请输入验证码！');
          setLoading(false);
          return;
        }
        
        // 调用带验证码的登录API
        const response = await axios.post('/api/auth/login-with-captcha', {
          username: values.username,
          password: values.password,
          captcha_id: captchaData.captcha_id,
          captcha_code: values.captcha
        });
        
        if (response.data.access_token) {
          // 保存token到localStorage
          localStorage.setItem('token', response.data.access_token);
          localStorage.setItem('user', JSON.stringify(response.data.user_info));
          
          // 强制刷新页面以更新AuthContext状态
          message.success('登录成功！');
          console.log('🔐 Login页面跳转到dashboard');
          window.location.href = '/dashboard';
        } else {
          message.error('登录失败，请检查用户名、密码和验证码');
          // 刷新验证码
          fetchCaptchaDirectly();
        }
      } else {
        console.log('🔐 使用普通登录API');
        // 使用普通登录
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
      }
    } catch (error: any) {
      console.error('❌ Login页面登录异常:', error);
      
      // 如果是验证码相关错误，刷新验证码
      if (captchaSettings.enableLoginCaptcha && captchaData) {
        fetchCaptchaDirectly();
      }
      
      const errorMessage = error.response?.data?.detail || error.message || '登录失败，请检查用户名、密码和验证码';
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

          {/* 验证码输入框 */}
          {captchaSettings.enableLoginCaptcha && captchaData && (
            <Form.Item
              name="captcha"
              rules={[
                { required: true, message: '请输入验证码！' },
                { len: captchaSettings.captchaLength || 4, message: `验证码长度为${captchaSettings.captchaLength || 4}位！` }
              ]}
            >
              <Row gutter={8}>
                <Col span={12}>
                  <Input
                    prefix={<SafetyOutlined />}
                    placeholder="验证码"
                    maxLength={captchaSettings.captchaLength || 4}
                    style={{ textTransform: 'uppercase' }}
                  />
                </Col>
                <Col span={8}>
                  <div 
                    style={{ 
                      height: 40, 
                      border: '1px solid #d9d9d9', 
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      backgroundColor: '#fafafa'
                    }}
                    onClick={refreshCaptcha}
                  >
                    {captchaLoading ? (
                      <ReloadOutlined spin />
                    ) : (
                      <img 
                        src={captchaData.captcha_image} 
                        alt="验证码" 
                        style={{ 
                          maxWidth: '100%', 
                          maxHeight: '100%',
                          objectFit: 'contain'
                        }} 
                      />
                    )}
                  </div>
                </Col>
                <Col span={4}>
                  <Button 
                    icon={<ReloadOutlined />} 
                    onClick={refreshCaptcha}
                    loading={captchaLoading}
                    style={{ height: 40 }}
                  />
                </Col>
              </Row>
            </Form.Item>
          )}

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
