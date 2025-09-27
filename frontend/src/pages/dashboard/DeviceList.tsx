// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { 
  Table, 
  Card, 
  Button, 
  Input, 
  Space, 
  Tag, 
  Popconfirm, 
  message, 
  Modal,
  Descriptions,
  Typography,
  Row,
  Col,
  Select,
  DatePicker,
  Switch,
  Tooltip
} from 'antd';
import { 
  SearchOutlined, 
  ReloadOutlined, 
  DeleteOutlined, 
  EyeOutlined,
  WifiOutlined,
  DisconnectOutlined,
  SyncOutlined
} from '@ant-design/icons';
import { deviceAPI } from '../../services/api';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;
const { RangePicker } = DatePicker;

interface Device {
  id: number;
  device_id: string;
  serial_number: string;
  brand: string;
  model: string;
  os_version: string;
  phone_number: string;
  network_type: string;
  ip_address: string;
  is_online: boolean;
  is_active: boolean;
  last_heartbeat: string;
  created_at: string;
  updated_at: string;
}

const DeviceList: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30); // 30秒
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  useEffect(() => {
    fetchDevices();
    // 🔥 禁用WebSocket连接，避免连接错误影响性能
    // connectWebSocket();
    
    return () => {
      // 清理WebSocket连接
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [pagination.current, pagination.pageSize, searchText, statusFilter]);

  // 🔥 禁用WebSocket连接函数，避免连接错误
  // const connectWebSocket = () => {
  //   // WebSocket功能已禁用，使用HTTP轮询替代
  // };

  // 🔥 禁用WebSocket设备更新处理，避免错误
  // const handleDeviceUpdate = (deviceData: any) => {
  //   // WebSocket功能已禁用
  // };

  // 实时刷新功能
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        fetchDevices();
      }, refreshInterval * 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, pagination.current, pagination.pageSize, searchText, statusFilter]);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        size: pagination.pageSize,
        search: searchText || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      };
      
      const response: any = await deviceAPI.getDeviceList(params);
      setDevices(response.data.devices);
      setPagination(prev => ({
        ...prev,
        total: response.data.total,
      }));
    } catch (error: any) {
      message.error('获取设备列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (deviceId: string) => {
    try {
      await deviceAPI.deleteDevice(deviceId);
      message.success('设备删除成功');
      fetchDevices();
    } catch (error: any) {
      message.error('删除设备失败');
    }
  };

  const handleViewDetail = async (device: Device) => {
    try {
      const response: any = await deviceAPI.getDeviceDetail(device.device_id);
      setSelectedDevice(response.data);
      setDetailModalVisible(true);
    } catch (error: any) {
      message.error('获取设备详情失败');
    }
  };

  const handleTableChange = (paginationConfig: any) => {
    setPagination({
      current: paginationConfig.current,
      pageSize: paginationConfig.pageSize,
      total: pagination.total,
    });
  };

  const handleSearch = (value: string) => {
    setSearchText(value);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const columns: ColumnsType<Device> = [
    {
      title: '设备ID',
      dataIndex: 'device_id',
      key: 'device_id',
      width: 150,
      ellipsis: true,
    },
    {
      title: '序列号',
      dataIndex: 'serial_number',
      key: 'serial_number',
      width: 150,
      ellipsis: true,
      render: (text) => text || '-',
    },
    {
      title: '设备信息',
      key: 'device_info',
      width: 200,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.brand} {record.model}</div>
          <div style={{ color: '#666', fontSize: '12px' }}>
            {record.os_version}
          </div>
        </div>
      ),
    },
    {
      title: '手机号码',
      dataIndex: 'phone_number',
      key: 'phone_number',
      width: 120,
    },
    {
      title: '网络信息',
      key: 'network_info',
      width: 150,
      render: (_, record) => (
        <div>
          <div>{record.network_type}</div>
          <div style={{ color: '#666', fontSize: '12px' }}>
            {record.ip_address}
          </div>
        </div>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 120,
      render: (_, record) => (
        <Space direction="vertical" size={4}>
          <Tag 
            color={record.is_online ? 'green' : 'red'}
            icon={record.is_online ? <WifiOutlined /> : <DisconnectOutlined />}
          >
            {record.is_online ? '在线' : '离线'}
          </Tag>
          <Tag color={record.is_active ? 'blue' : 'orange'}>
            {record.is_active ? '活跃' : '不活跃'}
          </Tag>
        </Space>
      ),
    },
    {
      title: '最后心跳',
      dataIndex: 'last_heartbeat',
      key: 'last_heartbeat',
      width: 150,
      render: (text) => text ? new Date(text).toLocaleString() : '-',
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (text) => new Date(text).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          <Popconfirm
            title="确定要删除这个设备吗？"
            description="删除后将无法恢复，相关数据也会被清除。"
            onConfirm={() => handleDelete(record.device_id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={2} style={{ marginBottom: 24 }}>
        设备管理
      </Title>

      <Card>
        {/* 搜索和筛选 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8}>
            <Input.Search
              placeholder="搜索设备ID、品牌、型号或手机号"
              allowClear
              onSearch={handleSearch}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={6}>
            <Select
              placeholder="设备状态"
              value={statusFilter}
              onChange={handleStatusFilterChange}
              style={{ width: '100%' }}
              options={[
                { label: '全部状态', value: 'all' },
                { label: '在线', value: 'online' },
                { label: '离线', value: 'offline' },
                { label: '活跃', value: 'active' },
                { label: '不活跃', value: 'inactive' },
              ]}
            />
          </Col>
          <Col xs={24} sm={10}>
            <Space>
              <Tooltip title={autoRefresh ? `每${refreshInterval}秒自动刷新` : '已关闭自动刷新'}>
                <Switch
                  checked={autoRefresh}
                  onChange={setAutoRefresh}
                  checkedChildren={<SyncOutlined />}
                  unCheckedChildren="手动"
                  style={{ marginRight: 8 }}
                />
              </Tooltip>
              <Select
                value={refreshInterval}
                onChange={setRefreshInterval}
                disabled={!autoRefresh}
                style={{ width: 80 }}
                size="small"
                options={[
                  { label: '10s', value: 10 },
                  { label: '30s', value: 30 },
                  { label: '60s', value: 60 },
                ]}
              />
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={fetchDevices}
                loading={loading}
              >
                刷新
              </Button>
            </Space>
          </Col>
        </Row>

        {/* 设备列表表格 */}
        <Table
          columns={columns}
          dataSource={devices}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* 设备详情模态框 */}
      <Modal
        title="设备详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={800}
      >
        {selectedDevice && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="设备ID" span={2}>
              {selectedDevice.device_id}
            </Descriptions.Item>
            <Descriptions.Item label="序列号" span={2}>
              {selectedDevice.serial_number || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="品牌">
              {selectedDevice.brand}
            </Descriptions.Item>
            <Descriptions.Item label="型号">
              {selectedDevice.model}
            </Descriptions.Item>
            <Descriptions.Item label="系统版本">
              {selectedDevice.os_version}
            </Descriptions.Item>
            <Descriptions.Item label="手机号码">
              {selectedDevice.phone_number || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="网络类型">
              {selectedDevice.network_type}
            </Descriptions.Item>
            <Descriptions.Item label="IP地址">
              {selectedDevice.ip_address}
            </Descriptions.Item>
            <Descriptions.Item label="在线状态">
              <Tag 
                color={selectedDevice.is_online ? 'green' : 'red'}
                icon={selectedDevice.is_online ? <WifiOutlined /> : <DisconnectOutlined />}
              >
                {selectedDevice.is_online ? '在线' : '离线'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="活跃状态">
              <Tag color={selectedDevice.is_active ? 'blue' : 'orange'}>
                {selectedDevice.is_active ? '活跃' : '不活跃'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="最后心跳">
              {selectedDevice.last_heartbeat 
                ? new Date(selectedDevice.last_heartbeat).toLocaleString()
                : '-'
              }
            </Descriptions.Item>
            <Descriptions.Item label="注册时间">
              {new Date(selectedDevice.created_at).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {new Date(selectedDevice.updated_at).toLocaleString()}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default DeviceList;
