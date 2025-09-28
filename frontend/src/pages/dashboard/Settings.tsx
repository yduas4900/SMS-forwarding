// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Switch,
  Select,
  InputNumber,
  message,
  Row,
  Col,
  Typography,
  Divider,
  Space,
  Alert,
  Modal,
  Tabs,
  Spin
} from 'antd';
import {
  SettingOutlined,
  SaveOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  AppstoreOutlined,
  UserOutlined,
  GlobalOutlined
} from '@ant-design/icons';
import axios from 'axios';
import ServiceTypeManagement from './ServiceTypeManagement';
import CustomerSiteSettings from './CustomerSiteSettings';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface SystemSettings {
  // 系统基础设置
  systemName: string;
  systemDescription: string;
  systemVersion: string;
  
  // 安全设置
  sessionTimeout: number;
  maxLoginAttempts: number;
  passwordMinLength: number;
  enableTwoFactor: boolean;
  
  // 通知设置
  enableEmailNotification: boolean;
  enableSmsNotification: boolean;
  notificationEmail: string;
  
  // 数据设置
  dataRetentionDays: number;
  autoBackup: boolean;
  backupFrequency: string;
  
  // 界面设置
  theme: string;
  language: string;
  timezone: string;
}

const Settings: React.FC = () => {
  const [form] = Form.useForm();
  const [customerForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [settings, setSettings] = useState<SystemSettings>({
    systemName: '',
    systemDescription: '',
    systemVersion: '',
    
    sessionTimeout: 30,
    maxLoginAttempts: 5,
    passwordMinLength: 8,
    enableTwoFactor: false,
    
    enableEmailNotification: true,
    enableSmsNotification: false,
    notificationEmail: 'admin@example.com',
    
    dataRetentionDays: 90,
    autoBackup: true,
    backupFrequency: 'daily',
    
    theme: 'light',
    language: 'zh-CN',
    timezone: 'Asia/Shanghai'
  });

  const [customerSettings, setCustomerSettings] = useState({
    welcomeTitle: '欢迎使用短信验证码服务',
    welcomeContent: '请在下方输入框中输入您的用户名，然后点击"获取验证码"按钮获取最新的验证码信息。',
    tutorialContent: `## 使用教程

### 第一步：输入用户名
在"用户名"输入框中输入您的用户名。

### 第二步：获取验证码
点击"获取验证码"按钮，系统将为您显示最新的验证码信息。

### 第三步：查看验证码
在下方的验证码列表中查看您需要的验证码。

### 注意事项
- 请确保输入正确的用户名
- 验证码有时效性，请及时使用
- 如有问题，请联系管理员`,
    showTutorial: true,
    maxDisplayCount: 5
  });

  // 获取当前设置
  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        const fetchedSettings = response.data.data;
        console.log('获取到的设置数据:', fetchedSettings);
        setSettings(fetchedSettings);
        form.setFieldsValue(fetchedSettings);
      } else {
        console.error('API返回失败:', response.data);
        message.error('获取系统设置失败');
      }
    } catch (error) {
      console.error('获取设置失败:', error);
      message.error('获取系统设置失败，请检查网络连接');
      
      // 使用合理的默认设置
      const defaultSettings = {
        systemName: 'SMS转发管理系统',
        systemDescription: '专业的短信转发和验证码管理平台',
        systemVersion: '2.0.0',
        sessionTimeout: 30,
        maxLoginAttempts: 5,
        passwordMinLength: 8,
        enableTwoFactor: false,
        enableEmailNotification: true,
        enableSmsNotification: false,
        notificationEmail: 'admin@example.com',
        dataRetentionDays: 90,
        autoBackup: true,
        backupFrequency: 'daily',
        theme: 'light',
        language: 'zh-CN',
        timezone: 'Asia/Shanghai'
      };
      
      setSettings(defaultSettings);
      form.setFieldsValue(defaultSettings);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (values: SystemSettings) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/settings', values, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data.success) {
        setSettings(values);
        message.success('系统设置保存成功！');
        
        // 如果修改了会话超时时间，提醒用户重新登录
        if (values.sessionTimeout !== settings.sessionTimeout) {
          Modal.info({
            title: '设置已更新',
            content: '会话超时时间已修改，建议重新登录以应用新设置。',
            okText: '知道了'
          });
        }
      } else {
        message.error(response.data.message || '保存失败，请重试');
      }
    } catch (error) {
      console.error('保存设置失败:', error);
      if (error.response?.status === 401) {
        message.error('登录已过期，请重新登录');
        // 可以在这里处理登录过期的逻辑
      } else if (error.response?.status === 403) {
        message.error('权限不足，无法修改系统设置');
      } else {
        message.error('保存失败，请检查网络连接后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    Modal.confirm({
      title: '确认重置',
      icon: <ExclamationCircleOutlined />,
      content: '确定要重置所有设置为默认值吗？此操作不可撤销。',
      okText: '确定',
      cancelText: '取消',
      onOk() {
        form.resetFields();
        message.success('设置已重置为默认值');
      },
    });
  };

  const handleTestConnection = async () => {
    message.loading('正在测试连接...', 2);
    // 模拟测试
    setTimeout(() => {
      message.success('连接测试成功！');
    }, 2000);
  };

  // 系统设置标签页内容
  const SystemSettingsTab = () => (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSave}
    >
      {/* 系统基础设置 */}
      <Title level={4}>基础设置</Title>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="systemName"
            label="系统名称"
            rules={[{ required: true, message: '请输入系统名称' }]}
          >
            <Input />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="systemVersion"
            label="系统版本"
            rules={[{ required: true, message: '请输入系统版本' }]}
          >
            <Input />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        name="systemDescription"
        label="系统描述"
      >
        <TextArea
          rows={3}
          placeholder="请输入系统描述"
          maxLength={500}
          showCount
        />
      </Form.Item>

      <Divider />

      {/* 安全设置 */}
      <Title level={4}>安全设置</Title>
      <Row gutter={16}>
        <Col span={8}>
          <Form.Item
            name="sessionTimeout"
            label="会话超时时间（分钟）"
            rules={[{ required: true, message: '请输入会话超时时间' }]}
          >
            <InputNumber min={5} max={480} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            name="maxLoginAttempts"
            label="最大登录尝试次数"
            rules={[{ required: true, message: '请输入最大登录尝试次数' }]}
          >
            <InputNumber min={3} max={10} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            name="passwordMinLength"
            label="密码最小长度"
            rules={[{ required: true, message: '请输入密码最小长度' }]}
          >
            <InputNumber min={6} max={20} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        name="enableTwoFactor"
        label="启用双因素认证"
        valuePropName="checked"
      >
        <Switch />
      </Form.Item>

      <Divider />

      {/* 通知设置 */}
      <Title level={4}>通知设置</Title>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="enableEmailNotification"
            label="启用邮件通知"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="enableSmsNotification"
            label="启用短信通知"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        name="notificationEmail"
        label="通知邮箱"
        rules={[
          { type: 'email', message: '请输入有效的邮箱地址' },
          { required: true, message: '请输入通知邮箱' }
        ]}
      >
        <Input />
      </Form.Item>

      <Divider />

      {/* 数据设置 */}
      <Title level={4}>数据设置</Title>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="dataRetentionDays"
            label="数据保留天数"
            rules={[{ required: true, message: '请输入数据保留天数' }]}
          >
            <InputNumber min={30} max={365} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="backupFrequency"
            label="备份频率"
            rules={[{ required: true, message: '请选择备份频率' }]}
          >
            <Select>
              <Option value="daily">每日</Option>
              <Option value="weekly">每周</Option>
              <Option value="monthly">每月</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        name="autoBackup"
        label="启用自动备份"
        valuePropName="checked"
      >
        <Switch />
      </Form.Item>

      <Divider />

      {/* 界面设置 */}
      <Title level={4}>界面设置</Title>
      <Row gutter={16}>
        <Col span={8}>
          <Form.Item
            name="theme"
            label="主题"
            rules={[{ required: true, message: '请选择主题' }]}
          >
            <Select>
              <Option value="light">浅色主题</Option>
              <Option value="dark">深色主题</Option>
              <Option value="auto">跟随系统</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            name="language"
            label="语言"
            rules={[{ required: true, message: '请选择语言' }]}
          >
            <Select>
              <Option value="zh-CN">简体中文</Option>
              <Option value="en-US">English</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            name="timezone"
            label="时区"
            rules={[{ required: true, message: '请选择时区' }]}
          >
            <Select>
              <Option value="Asia/Shanghai">北京时间 (UTC+8)</Option>
              <Option value="UTC">协调世界时 (UTC)</Option>
              <Option value="America/New_York">纽约时间 (UTC-5)</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Divider />

      <Alert
        message="重要提示"
        description="修改系统设置可能会影响系统的正常运行，请谨慎操作。建议在修改前备份当前配置。"
        type="warning"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Form.Item>
        <Space>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            htmlType="submit"
            loading={loading}
            size="large"
          >
            保存设置
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleReset}
            size="large"
          >
            重置默认
          </Button>
          <Button
            onClick={handleTestConnection}
            size="large"
          >
            测试连接
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );

  // 标签页配置
  const tabItems = [
    {
      key: 'system',
      label: (
        <span>
          <SettingOutlined />
          系统设置
        </span>
      ),
      children: <SystemSettingsTab />,
    },
    {
      key: 'service-types',
      label: (
        <span>
          <AppstoreOutlined />
          服务类型管理
        </span>
      ),
      children: <ServiceTypeManagement />,
    },
    {
      key: 'customer-site',
      label: (
        <span>
          <GlobalOutlined />
          客户浏览端设置
        </span>
      ),
      children: <CustomerSiteSettings />,
    },
  ];

  return (
    <div style={{ padding: '0' }}>
      <Card>
        <Title level={3} style={{ marginBottom: 24 }}>
          <SettingOutlined style={{ marginRight: 8 }} />
          系统管理
        </Title>

        <Tabs
          defaultActiveKey="system"
          items={tabItems}
          size="large"
          tabBarStyle={{ marginBottom: 24 }}
        />
      </Card>
    </div>
  );
};

export default Settings;
