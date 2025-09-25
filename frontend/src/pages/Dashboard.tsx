import React, { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Typography, theme } from 'antd';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  MobileOutlined,
  UserOutlined,
  LinkOutlined,
  MessageOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

// 导入页面组件
import Overview from './dashboard/Overview';
import DeviceList from './dashboard/DeviceList';
import AccountManagement from './dashboard/AccountManagement';
import LinkManagement from './dashboard/LinkManagement';
import SmsManagementByAccount from './dashboard/SmsManagementByAccount';
import SmsRules from './dashboard/SmsRules';
import Profile from './dashboard/Profile';
import Settings from './dashboard/Settings';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const Dashboard: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // 修复theme.useToken()的null检查
  const { token } = theme.useToken();
  const colorBgContainer = token?.colorBgContainer || '#ffffff';

  // 菜单项配置
  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '概览',
    },
    {
      key: '/dashboard/devices',
      icon: <MobileOutlined />,
      label: '设备管理',
    },
    {
      key: '/dashboard/accounts',
      icon: <UserOutlined />,
      label: '账号管理',
    },
    {
      key: '/dashboard/links',
      icon: <LinkOutlined />,
      label: '链接管理',
    },
    {
      key: '/dashboard/sms',
      icon: <MessageOutlined />,
      label: '短信管理',
    },
  ];

  // 处理用户菜单点击
  const handleUserMenuClick = ({ key }: { key: string }) => {
    switch (key) {
      case 'profile':
        navigate('/dashboard/profile');
        break;
      case 'settings':
        navigate('/dashboard/settings');
        break;
      case 'logout':
        logout();
        break;
      default:
        break;
    }
  };

  // 用户下拉菜单
  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '系统设置',
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  // 获取当前选中的菜单项
  const getSelectedKey = () => {
    const path = location.pathname;
    if (path === '/dashboard' || path === '/dashboard/') {
      return '/dashboard';
    }
    return path;
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed}
        style={{
          background: colorBgContainer,
          boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
        }}
      >
        <div style={{ 
          height: 64, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          borderBottom: '1px solid #f0f0f0'
        }}>
          <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
            {collapsed ? '手机' : '手机信息管理系统'}
          </Title>
        </div>
        
        <Menu
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ borderRight: 0, marginTop: 16 }}
        />
      </Sider>
      
      <Layout>
        <Header style={{ 
          padding: '0 24px', 
          background: colorBgContainer,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {React.createElement(collapsed ? MenuUnfoldOutlined : MenuFoldOutlined, {
              className: 'trigger',
              onClick: () => setCollapsed(!collapsed),
              style: { fontSize: '18px', cursor: 'pointer' },
            })}
          </div>
          
          <Dropdown menu={{ items: userMenuItems, onClick: handleUserMenuClick }} placement="bottomRight">
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              cursor: 'pointer',
              padding: '8px 12px',
              borderRadius: '6px',
              transition: 'background-color 0.3s',
            }}>
              <Avatar 
                size="small" 
                icon={<UserOutlined />} 
                style={{ marginRight: 8 }}
              />
              <span>{user?.full_name || user?.username}</span>
            </div>
          </Dropdown>
        </Header>
        
        <Content style={{ 
          margin: '24px',
          padding: '24px',
          background: colorBgContainer,
          borderRadius: '8px',
          minHeight: 'calc(100vh - 112px)',
        }}>
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/devices/*" element={<DeviceList />} />
            <Route path="/accounts/*" element={<AccountManagement />} />
            <Route path="/links/*" element={<LinkManagement />} />
            <Route path="/sms/*" element={<SmsManagementByAccount />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Dashboard;
