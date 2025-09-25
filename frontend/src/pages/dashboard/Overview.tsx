import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Typography, Spin, Alert, Button } from 'antd';
import { 
  MobileOutlined, 
  MessageOutlined, 
  UserOutlined, 
  LinkOutlined,
  WifiOutlined,
  DisconnectOutlined 
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { deviceAPI } from '../../services/api';

const { Title } = Typography;

interface DeviceStats {
  total: number;
  online: number;
  offline: number;
  active: number;
  inactive: number;
  new_24h: number;
}

interface SmsStats {
  total: number;
  today: number;
}

interface OverviewData {
  devices: DeviceStats;
  sms: SmsStats;
}

const Overview: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchOverviewData();
  }, []);

  const fetchOverviewData = async () => {
    try {
      setLoading(true);
      const response: any = await deviceAPI.getDeviceStatistics();
      setData(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || '获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="数据加载失败"
        description={error}
        type="error"
        showIcon
        style={{ marginBottom: 24 }}
      />
    );
  }

  if (!data) {
    return null;
  }

  // 统计卡片数据
  const statsCards = [
    {
      title: '设备总数',
      value: data.devices.total,
      icon: <MobileOutlined style={{ color: '#1890ff' }} />,
      color: '#1890ff',
    },
    {
      title: '在线设备',
      value: data.devices.online,
      icon: <WifiOutlined style={{ color: '#52c41a' }} />,
      color: '#52c41a',
    },
    {
      title: '离线设备',
      value: data.devices.offline,
      icon: <DisconnectOutlined style={{ color: '#ff4d4f' }} />,
      color: '#ff4d4f',
    },
    {
      title: '短信总数',
      value: data.sms.total,
      icon: <MessageOutlined style={{ color: '#722ed1' }} />,
      color: '#722ed1',
    },
  ];

  return (
    <div>
      <Title level={2} style={{ marginBottom: 24 }}>
        系统概览
      </Title>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {statsCards.map((card, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Card>
              <Statistic
                title={card.title}
                value={card.value}
                prefix={card.icon}
                valueStyle={{ color: card.color }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* 详细统计 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="设备状态详情" bordered={false}>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic
                  title="活跃设备"
                  value={data.devices.active}
                  suffix={`/ ${data.devices.total}`}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="不活跃设备"
                  value={data.devices.inactive}
                  suffix={`/ ${data.devices.total}`}
                  valueStyle={{ color: '#faad14' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="24小时新增"
                  value={data.devices.new_24h}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="在线率"
                  value={data.devices.total > 0 ? ((data.devices.online / data.devices.total) * 100).toFixed(1) : 0}
                  suffix="%"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="短信统计" bordered={false}>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic
                  title="今日短信"
                  value={data.sms.today}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="短信总数"
                  value={data.sms.total}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col span={24}>
                <div style={{ 
                  padding: '16px', 
                  background: '#f5f5f5', 
                  borderRadius: '6px',
                  marginTop: '16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>平均每设备短信数</span>
                    <Tag color="blue">
                      {data.devices.total > 0 ? Math.round(data.sms.total / data.devices.total) : 0}
                    </Tag>
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* 快速操作 */}
      <Card title="快速操作" style={{ marginTop: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Card 
              hoverable
              style={{ textAlign: 'center', cursor: 'pointer' }}
              onClick={() => navigate('/dashboard/devices')}
            >
              <MobileOutlined style={{ fontSize: '32px', color: '#1890ff', marginBottom: '12px' }} />
              <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>查看设备列表</div>
              <div style={{ color: '#666', fontSize: '12px' }}>管理所有连接的设备</div>
              <Button 
                type="primary" 
                style={{ marginTop: '12px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/dashboard/devices');
                }}
              >
                进入管理
              </Button>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card 
              hoverable
              style={{ textAlign: 'center', cursor: 'pointer' }}
              onClick={() => navigate('/dashboard/accounts')}
            >
              <UserOutlined style={{ fontSize: '32px', color: '#52c41a', marginBottom: '12px' }} />
              <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>管理会员账号</div>
              <div style={{ color: '#666', fontSize: '12px' }}>添加和管理会员信息</div>
              <Button 
                type="primary" 
                style={{ marginTop: '12px', backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/dashboard/accounts');
                }}
              >
                进入管理
              </Button>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card 
              hoverable
              style={{ textAlign: 'center', cursor: 'pointer' }}
              onClick={() => navigate('/dashboard/links')}
            >
              <LinkOutlined style={{ fontSize: '32px', color: '#722ed1', marginBottom: '12px' }} />
              <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>生成访问链接</div>
              <div style={{ color: '#666', fontSize: '12px' }}>批量生成客户访问链接</div>
              <Button 
                type="primary" 
                style={{ marginTop: '12px', backgroundColor: '#722ed1', borderColor: '#722ed1' }}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/dashboard/links');
                }}
              >
                进入管理
              </Button>
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default Overview;
