import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Typography, Row, Col, App, message } from 'antd';
import { UserOutlined, LockOutlined, SafetyOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Login.css';

const { Title } = Typography;
const { useApp } = App;

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
  const { message } = useApp();

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
      console.log('🔐 安全修复版本: v2.0.2');
      
      // 🚨 安全修复：强制检查验证码状态，不允许绕过
      if (captchaSettings.enableLoginCaptcha) {
        console.log('🔐 验证码已启用，必须使用带验证码的登录API');
        
        // 🚨 安全检查：确保验证码数据存在
        if (!captchaData || !captchaData.captcha_id) {
          message.error('验证码数据异常，请刷新页面重试！');
          setLoading(false);
          return;
        }
        
        // 🚨 安全检查：确保用户输入了验证码
        if (!values.captcha || values.captcha.trim() === '') {
          message.error('请输入验证码！');
          setLoading(false);
          return;
        }
        
        // 🚨 安全检查：验证码长度检查
        const expectedLength = captchaSettings.captchaLength || 4;
        if (values.captcha.length !== expectedLength) {
          message.error(`验证码长度应为${expectedLength}位！`);
          setLoading(false);
          return;
        }
        
        console.log('🔐 所有验证码检查通过，调用带验证码的登录API');
        
        // 调用带验证码的登录API
        const response = await axios.post('/api/auth/login-with-captcha', {
          username: values.username,
          password: values.password,
          captcha_id: captchaData.captcha_id,
          captcha_code: values.captcha.trim().toUpperCase()
        });
        
        if (response.data.access_token) {
          // 保存token到localStorage
          localStorage.setItem('token', response.data.access_token);
          localStorage.setItem('user', JSON.stringify(response.data.user_info));
          
          message.success('登录成功！');
          console.log('🔐 带验证码登录成功，跳转到dashboard');
          window.location.href = '/dashboard';
        } else {
          message.error('登录失败，请检查用户名、密码和验证码');
          // 刷新验证码
          fetchCaptchaDirectly();
        }
      } else {
        console.log('🔐 验证码未启用，使用普通登录API');
        
        // 🚨 安全修复：正确处理AuthContext login函数的错误
        try {
          const success = await login(values.username, values.password);
          console.log('🔐 普通登录结果:', success);
          
          if (success) {
            message.success('登录成功！');
            console.log('🔐 普通登录成功，跳转到dashboard');
            navigate('/dashboard');
          } else {
            console.error('❌ 普通登录失败');
            message.error('登录失败，请检查用户名和密码');
          }
        } catch (loginError: any) {
          // 🚨 关键修复：捕获AuthContext抛出的详细错误信息
          console.error('❌ 普通登录异常:', loginError);
          const errorMessage = loginError.message || '登录失败，请检查用户名和密码';
          console.log('🔐 显示错误消息给用户:', errorMessage);
          
          // 🚨 终极修复：确保用户100%能看到错误提示
          console.log('🔐 开始显示错误提示给用户:', errorMessage);
          
          // 方案1：立即显示原生alert（最可靠）
          alert(`🚨 登录失败：${errorMessage}`);
          console.log('🔐 Alert弹窗已显示');
          
          // 方案2：创建超大红色错误提示框
          const errorDiv = document.createElement('div');
          errorDiv.id = 'login-error-display';
          errorDiv.style.cssText = `
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            background: #ff4d4f !important;
            color: white !important;
            padding: 20px 30px !important;
            border-radius: 8px !important;
            z-index: 99999 !important;
            font-size: 16px !important;
            font-weight: bold !important;
            box-shadow: 0 8px 24px rgba(0,0,0,0.3) !important;
            border: 3px solid #d9363e !important;
            max-width: 400px !important;
            text-align: center !important;
            cursor: pointer !important;
          `;
          errorDiv.innerHTML = `
            <div style="margin-bottom: 10px; font-size: 18px;">⚠️ 登录失败</div>
            <div style="margin-bottom: 15px;">${errorMessage}</div>
            <div style="font-size: 12px; opacity: 0.8;">点击此处关闭</div>
          `;
          
          // 移除之前的错误提示
          const existingError = document.getElementById('login-error-display');
          if (existingError) {
            existingError.remove();
          }
          
          document.body.appendChild(errorDiv);
          console.log('🔐 大型错误提示框已显示');
          
          // 点击关闭
          errorDiv.onclick = () => {
            errorDiv.remove();
            console.log('🔐 用户点击关闭错误提示');
          };
          
          // 10秒后自动移除
          setTimeout(() => {
            if (errorDiv.parentNode) {
              errorDiv.remove();
              console.log('🔐 错误提示自动移除');
            }
          }, 10000);
          
          // 方案3：尝试使用message组件
          try {
            message.error(errorMessage);
            console.log('🔐 Message组件也已调用');
          } catch (msgError) {
            console.error('Message组件错误:', msgError);
          }
          
          // 方案4：在登录表单下方显示错误文本
          const loginCard = document.querySelector('.login-card') as HTMLElement;
          if (loginCard) {
            let errorText = loginCard.querySelector('.login-error-text') as HTMLElement;
            if (!errorText) {
              errorText = document.createElement('div') as HTMLElement;
              errorText.className = 'login-error-text';
              (errorText as any).style.cssText = `
                background: #fff2f0;
                border: 1px solid #ffccc7;
                color: #ff4d4f;
                padding: 12px;
                margin-top: 16px;
                border-radius: 6px;
                text-align: center;
                font-weight: 500;
              `;
              loginCard.appendChild(errorText);
            }
            errorText.textContent = `❌ ${errorMessage}`;
            console.log('🔐 登录卡片错误文本已显示');
            
            // 5秒后移除
            setTimeout(() => {
              if (errorText && errorText.parentNode) {
                errorText.remove();
              }
            }, 8000);
          }
        }
      }
    } catch (error: any) {
      console.error('❌ Login页面登录异常:', error);
      
      // 🚨 安全修复：更详细的错误处理
      if (captchaSettings.enableLoginCaptcha) {
        // 验证码启用时的错误处理
        if (error.response?.status === 400) {
          const errorDetail = error.response?.data?.detail || '';
          if (errorDetail.includes('验证码')) {
            message.error(errorDetail);
            // 刷新验证码
            fetchCaptchaDirectly();
          } else {
            message.error('登录失败：' + errorDetail);
          }
        } else {
          message.error('登录过程中发生错误，请重试');
          // 刷新验证码
          fetchCaptchaDirectly();
        }
      } else {
        // 普通登录的错误处理
        const errorMessage = error.response?.data?.detail || error.message || '登录失败，请检查用户名和密码';
        message.error(errorMessage);
      }
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
