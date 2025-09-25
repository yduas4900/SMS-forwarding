import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Avatar,
  message,
  Row,
  Col,
  Typography,
  Divider,
  Space,
  Modal,
  Spin
} from 'antd';
import {
  UserOutlined,
  EditOutlined,
  SaveOutlined,
  LockOutlined,
  KeyOutlined
} from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI } from '../../services/api';

const { Title, Text } = Typography;

interface UserProfile {
  id: number;
  username: string;
  email?: string;
  phone?: string;
  full_name?: string;
  is_superuser: boolean;
  created_at: string;
  last_login?: string;
  login_count: number;
}

const Profile: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  // 获取用户信息
  const fetchUserProfile = useCallback(async () => {
    try {
      setInitialLoading(true);
      const response: any = await authAPI.getCurrentUser();
      
      if (response.success && response.data) {
        setUserProfile(response.data);
        profileForm.setFieldsValue({
          username: response.data.username || '',
          email: response.data.email || '',
          phone: response.data.phone || '',
          full_name: response.data.full_name || '',
        });
      } else {
        message.error('获取用户信息失败：响应格式错误');
      }
    } catch (error: any) {
      console.error('获取用户信息失败:', error);
      const errorMessage = error.response?.data?.detail || error.message || '获取用户信息失败';
      message.error(errorMessage);
    } finally {
      setInitialLoading(false);
    }
  }, [profileForm]);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  // 编辑按钮点击处理
  const handleEditClick = useCallback(() => {
    setEditing(true);
  }, []);

  // 取消编辑
  const handleCancel = useCallback(() => {
    setEditing(false);
    if (userProfile) {
      profileForm.setFieldsValue({
        username: userProfile.username || '',
        email: userProfile.email || '',
        phone: userProfile.phone || '',
        full_name: userProfile.full_name || '',
      });
    }
  }, [userProfile, profileForm]);

  // 更新个人资料
  const handleProfileSave = useCallback(async (values: any) => {
    setLoading(true);
    try {
      const updateData: any = {};
      const usernameChanged = values.username !== userProfile?.username;
      
      // 只发送有变化的字段
      if (usernameChanged) {
        updateData.username = values.username;
      }
      if (values.email !== userProfile?.email) {
        updateData.email = values.email;
      }
      if (values.phone !== userProfile?.phone) {
        updateData.phone = values.phone;
      }
      if (values.full_name !== userProfile?.full_name) {
        updateData.full_name = values.full_name;
      }

      if (Object.keys(updateData).length === 0) {
        message.info('没有需要更新的内容');
        setEditing(false);
        return;
      }

      const response: any = await authAPI.updateProfile(updateData);
      
      if (response.success) {
        setUserProfile(response.data);
        setEditing(false);
        
        // 检查是否有新的token（用户名修改时）
        if (response.new_token) {
          localStorage.setItem('token', response.new_token);
          message.success({
            content: '个人资料更新成功！用户名已更改，系统已自动更新您的登录凭据。',
            duration: 5
          });
        } else {
          message.success('个人资料更新成功！');
        }
        
        // 刷新用户数据
        await refreshUser();
      } else {
        throw new Error(response.message || '更新失败');
      }
    } catch (error: any) {
      console.error('更新个人资料失败:', error);
      const errorMessage = error.response?.data?.detail || error.message || '更新失败，请重试';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [userProfile, refreshUser]);

  // 修改密码
  const handlePasswordChange = useCallback(async (values: any) => {
    setPasswordLoading(true);
    try {
      const response: any = await authAPI.changePassword({
        current_password: values.currentPassword,
        new_password: values.newPassword,
        confirm_password: values.confirmPassword
      });
      
      if (response.success) {
        message.success('密码修改成功！');
        setPasswordModalVisible(false);
        passwordForm.resetFields();
      } else {
        throw new Error(response.message || '密码修改失败');
      }
    } catch (error: any) {
      console.error('修改密码失败:', error);
      const errorMessage = error.response?.data?.detail || error.message || '修改密码失败，请重试';
      message.error(errorMessage);
    } finally {
      setPasswordLoading(false);
    }
  }, [passwordForm]);

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '未知';
    try {
      return new Date(dateString).toLocaleString('zh-CN');
    } catch {
      return dateString;
    }
  };

  if (initialLoading) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>加载用户信息中...</div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center', padding: '100px 0' }}>
        <Text type="danger">无法加载用户信息，请刷新页面重试</Text>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Card>
        <Title level={3} style={{ marginBottom: 24, textAlign: 'center' }}>
          <UserOutlined style={{ marginRight: 8 }} />
          个人资料
        </Title>

        <Row gutter={24}>
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <Avatar
                size={120}
                icon={<UserOutlined />}
                style={{ marginBottom: 16, backgroundColor: '#1890ff' }}
              />
              
              <div style={{ marginTop: 16 }}>
                <Text strong style={{ fontSize: 16, display: 'block' }}>
                  {userProfile.full_name || userProfile.username}
                </Text>
                <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
                  {userProfile.is_superuser ? '超级管理员' : '管理员'}
                </Text>
              </div>
            </div>
          </Col>

          <Col span={16}>
            <Form
              form={profileForm}
              layout="vertical"
              onFinish={handleProfileSave}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="username"
                    label={<span><span style={{ color: 'red' }}>*</span> 用户名</span>}
                    rules={[{ required: true, message: '请输入用户名' }]}
                  >
                    <Input 
                      placeholder="请输入用户名" 
                      disabled={!editing}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="full_name"
                    label="真实姓名"
                  >
                    <Input 
                      placeholder="请输入真实姓名" 
                      disabled={!editing}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="email"
                    label="邮箱"
                    rules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
                  >
                    <Input 
                      placeholder="请输入邮箱地址" 
                      disabled={!editing}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="phone"
                    label="手机号"
                  >
                    <Input 
                      placeholder="请输入手机号" 
                      disabled={!editing}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item>
                <Space>
                  {!editing ? (
                    <>
                      <Button
                        type="primary"
                        icon={<EditOutlined />}
                        onClick={handleEditClick}
                      >
                        编辑资料
                      </Button>
                      <Button
                        icon={<LockOutlined />}
                        onClick={() => setPasswordModalVisible(true)}
                      >
                        修改密码
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        htmlType="submit"
                        loading={loading}
                      >
                        保存修改
                      </Button>
                      <Button onClick={handleCancel}>
                        取消
                      </Button>
                    </>
                  )}
                </Space>
              </Form.Item>
            </Form>
          </Col>
        </Row>

        <Divider />

        <Title level={4}>账号信息</Title>
        <Row gutter={16}>
          <Col span={12}>
            <Text strong>账号ID：</Text>
            <Text>{userProfile.id}</Text>
          </Col>
          <Col span={12}>
            <Text strong>角色：</Text>
            <Text>{userProfile.is_superuser ? '超级管理员' : '管理员'}</Text>
          </Col>
        </Row>
        <Row gutter={16} style={{ marginTop: 8 }}>
          <Col span={12}>
            <Text strong>创建时间：</Text>
            <Text>{formatDateTime(userProfile.created_at)}</Text>
          </Col>
          <Col span={12}>
            <Text strong>最后登录：</Text>
            <Text>{formatDateTime(userProfile.last_login)}</Text>
          </Col>
        </Row>
        <Row gutter={16} style={{ marginTop: 8 }}>
          <Col span={12}>
            <Text strong>登录次数：</Text>
            <Text>{userProfile.login_count} 次</Text>
          </Col>
        </Row>
      </Card>

      {/* 修改密码模态框 */}
      <Modal
        title={
          <span>
            <KeyOutlined style={{ marginRight: 8 }} />
            修改密码
          </span>
        }
        open={passwordModalVisible}
        onCancel={() => {
          setPasswordModalVisible(false);
          passwordForm.resetFields();
        }}
        footer={null}
        width={500}
        destroyOnClose
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handlePasswordChange}
        >
          <Form.Item
            name="currentPassword"
            label="当前密码"
            rules={[{ required: true, message: '请输入当前密码' }]}
          >
            <Input.Password placeholder="请输入当前密码" />
          </Form.Item>

          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码长度至少为6位' }
            ]}
          >
            <Input.Password placeholder="请输入新密码（至少6位）" />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button 
                onClick={() => {
                  setPasswordModalVisible(false);
                  passwordForm.resetFields();
                }}
              >
                取消
              </Button>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={passwordLoading}
              >
                确认修改
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Profile;
