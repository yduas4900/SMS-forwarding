import React, { useState, useEffect } from 'react';
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
  Form,
  Select,
  InputNumber,
  Typography,
  Row,
  Col,
  Tooltip,
  Progress,
  Alert,
  Divider
} from 'antd';
import { 
  ReloadOutlined, 
  DeleteOutlined, 
  EditOutlined,
  PlusOutlined,
  LinkOutlined,
  CopyOutlined,
  AppstoreOutlined
} from '@ant-design/icons';
import { linkAPI, accountAPI, deviceAPI } from '../../services/api';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;
const { Option } = Select;

interface Link {
  id: number;
  link_id: string;
  account_id: number;
  device_id?: string;
  max_access_count: number;
  access_count: number;
  max_verification_count: number;
  verification_count: number;
  access_session_interval: number;  // 新增：访问会话间隔（分钟）
  verification_wait_time: number;   // 新增：验证码等待时间（秒）
  status: 'active' | 'inactive' | 'expired';
  created_at: string;
  updated_at: string;
  account?: {
    id: number;
    name: string;
    username?: string;
    type: string;
    image_url?: string;
  };
  device?: {
    device_id: string;
    brand?: string;
    model?: string;
    phone_number?: string;
    is_online: boolean;
  };
}

interface LinkFormData {
  account_id: number;
  max_access_count: number;
  max_verification_count: number;
  access_session_interval: number;  // 新增：访问会话间隔（分钟）
  verification_wait_time: number;   // 新增：验证码等待时间（秒）
  count?: number;
}

interface Account {
  id: number;
  account_name: string;
  username: string;
  password: string;
  type: string;
  image_url?: string;
  primary_device?: {
    id: number;
    device_id: string;
    brand: string;
    model: string;
    phone_number: string;
    is_online: boolean;
  };
}

interface Device {
  id: number;
  device_id: string;
  brand?: string;
  model?: string;
  is_online: boolean;
}

const LinkManagement: React.FC = () => {
  const [links, setLinks] = useState<Link[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [editingLink, setEditingLink] = useState<Link | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [form] = Form.useForm();
  const [batchForm] = Form.useForm();
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  useEffect(() => {
    fetchLinks();
    fetchAccounts();
    fetchDevices();
  }, [pagination.current, pagination.pageSize, searchText, statusFilter]);

  // 获取链接列表
  const fetchLinks = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        size: pagination.pageSize,
        search: searchText || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      };
      
      const response: any = await linkAPI.getLinkList(params);
      
      // 处理后端返回的数据结构，将account_info和device_info映射为account和device
      const processedLinks = (response.data.links || []).map((link: any) => ({
        ...link,
        account: link.account_info ? {
          id: link.account_info.id,
          name: link.account_info.account_name,
          username: link.account_info.username,
          type: link.account_info.type,
          image_url: link.account_info.image_url
        } : null,
        device: link.device_info ? {
          device_id: link.device_info.device_id,
          brand: link.device_info.brand,
          model: link.device_info.model,
          phone_number: link.device_info.phone_number,
          is_online: link.device_info.is_online || false
        } : null
      }));
      
      setLinks(processedLinks);
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination?.total || 0,
      }));
    } catch (error: any) {
      message.error(error.response?.data?.message || '获取链接列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取账号列表
  const fetchAccounts = async () => {
    try {
      const response: any = await accountAPI.getAccountList({ page: 1, page_size: 100 });
      setAccounts(response.data.accounts || []);
    } catch (error: any) {
      console.error('获取账号列表失败:', error);
    }
  };

  // 获取设备列表
  const fetchDevices = async () => {
    try {
      const response: any = await deviceAPI.getDeviceList({ page: 1, page_size: 100 });
      setDevices(response.data.devices || []);
    } catch (error: any) {
      console.error('获取设备列表失败:', error);
    }
  };

  // 创建单个链接
  const handleSubmit = async (values: LinkFormData) => {
    try {
      if (editingLink) {
        // 编辑时只更新基本参数，不修改设备绑定
        const updateData = {
          max_access_count: values.max_access_count,
          max_verification_count: values.max_verification_count,
          access_session_interval: values.access_session_interval,
          verification_wait_time: values.verification_wait_time
        };
        await linkAPI.updateLink(editingLink.link_id, updateData);
        message.success('链接更新成功');
      } else {
        // 创建链接时，使用账号绑定的设备
        const selectedAccount = accounts.find(acc => acc.id === values.account_id);
        const createData = { 
          ...values,
          device_id: selectedAccount?.primary_device?.id
        };
        
        if (!createData.device_id) {
          message.error('选择的账号没有绑定设备，请先在账号管理中绑定设备');
          return;
        }
        
        await linkAPI.createLink(createData);
        message.success('链接创建成功');
      }
      
      setModalVisible(false);
      setEditingLink(null);
      form.resetFields();
      fetchLinks();
    } catch (error: any) {
      console.error('链接操作失败:', error);
      message.error(error.response?.data?.detail || error.response?.data?.message || '操作失败');
    }
  };

  // 批量创建链接
  const handleBatchCreate = async (values: LinkFormData) => {
    try {
      const { count, ...linkData } = values;
      
      // 获取选择账号的绑定设备
      const selectedAccount = accounts.find(acc => acc.id === linkData.account_id);
      const createData = {
        ...linkData,
        device_id: selectedAccount?.primary_device?.id,
        count: count || 1,
      };
      
      if (!createData.device_id) {
        message.error('选择的账号没有绑定设备，请先在账号管理中绑定设备');
        return;
      }
      
      await linkAPI.createBatchLinks(createData);
      
      message.success(`成功创建 ${count} 个链接`);
      setBatchModalVisible(false);
      batchForm.resetFields();
      fetchLinks();
    } catch (error: any) {
      message.error(error.response?.data?.message || '批量创建失败');
    }
  };

  // 删除链接
  const handleDelete = async (linkId: string) => {
    try {
      await linkAPI.deleteLink(linkId);
      message.success('链接删除成功');
      fetchLinks();
    } catch (error: any) {
      message.error(error.response?.data?.message || '删除失败');
    }
  };

  // 复制链接
  const handleCopyLink = (linkId: string) => {
    // 使用当前域名，自动适配开发和生产环境
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/customer/${linkId}`;
    navigator.clipboard.writeText(url).then(() => {
      message.success('链接已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  // 打开编辑模态框
  const handleEdit = (link: Link) => {
    setEditingLink(link);
    form.setFieldsValue({
      account_id: link.account_id,
      max_access_count: link.max_access_count,
      max_verification_count: link.max_verification_count,
      access_session_interval: link.access_session_interval || 5,
      verification_wait_time: link.verification_wait_time || 0,
    });
    setModalVisible(true);
  };

  // 打开新增模态框
  const handleAdd = () => {
    setEditingLink(null);
    form.resetFields();
    form.setFieldsValue({
      max_access_count: 5,
      max_verification_count: 5,
      access_session_interval: 5,
      verification_wait_time: 0,
    });
    setModalVisible(true);
  };

  // 打开批量创建模态框
  const handleBatchAdd = () => {
    batchForm.resetFields();
    batchForm.setFieldsValue({
      max_access_count: 5,
      max_verification_count: 5,
      access_session_interval: 5,
      verification_wait_time: 0,
      count: 10,
    });
    setBatchModalVisible(true);
  };

  // 获取状态配置
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return { color: 'green', text: '活跃' };
      case 'inactive':
        return { color: 'orange', text: '不活跃' };
      case 'expired':
        return { color: 'red', text: '已过期' };
      default:
        return { color: 'default', text: '未知' };
    }
  };

  // 计算使用率
  const getUsageRate = (current: number, max: number) => {
    if (max === 0) return 0;
    return Math.round((current / max) * 100);
  };

  // 表格列定义
  const columns: ColumnsType<Link> = [
    {
      title: '链接信息',
      key: 'link_info',
      width: 200,
      render: (record: Link) => (
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
            <LinkOutlined style={{ marginRight: 4 }} />
            {record.link_id}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            ID: {record.id}
          </div>
        </div>
      ),
    },
    {
      title: '关联账号',
      key: 'account_info',
      width: 200,
      render: (record: Link) => (
        record.account ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {record.account.image_url && (
              <img 
                src={record.account.image_url} 
                alt="账号缩略图" 
                style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }}
              />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{record.account.name}</div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: 2 }}>
                用户名: {record.account.username || '未设置'}
              </div>
              <Tag color="blue" style={{ fontSize: '11px', marginTop: 2 }}>{record.account.type}</Tag>
            </div>
          </div>
        ) : (
          <Text type="secondary">未关联</Text>
        )
      ),
    },
    {
      title: '绑定设备',
      key: 'device_info',
      width: 180,
      render: (record: Link) => (
        record.device ? (
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{record.device.device_id}</div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: 2 }}>
              手机号: {record.device.phone_number || '未设置'}
            </div>
            <Tag 
              color={record.device.is_online ? 'green' : 'red'}
              style={{ fontSize: '11px', marginTop: 4 }}
            >
              {record.device.is_online ? '在线' : '离线'}
            </Tag>
          </div>
        ) : (
          <Text type="secondary">未绑定</Text>
        )
      ),
    },
    {
      title: '访问统计',
      key: 'access_stats',
      width: 120,
      render: (record: Link) => {
        const accessCount = record.access_count || 0;
        const maxAccessCount = record.max_access_count || 0;
        const rate = getUsageRate(accessCount, maxAccessCount);
        return (
          <div>
            <div style={{ marginBottom: 4 }}>
              <Text strong>{accessCount}</Text>
              <Text type="secondary"> / {maxAccessCount}</Text>
            </div>
            <Progress 
              percent={rate} 
              size="small" 
              strokeColor={rate >= 80 ? '#ff4d4f' : '#1890ff'}
              showInfo={false}
            />
            <div style={{ fontSize: '11px', color: '#666', textAlign: 'center' }}>
              {rate}%
            </div>
          </div>
        );
      },
    },
    {
      title: '验证码统计',
      key: 'verification_stats',
      width: 120,
      render: (record: Link) => {
        const verificationCount = record.verification_count || 0;
        const maxVerificationCount = record.max_verification_count || 0;
        const rate = getUsageRate(verificationCount, maxVerificationCount);
        return (
          <div>
            <div style={{ marginBottom: 4 }}>
              <Text strong>{verificationCount}</Text>
              <Text type="secondary"> / {maxVerificationCount}</Text>
            </div>
            <Progress 
              percent={rate} 
              size="small" 
              strokeColor={rate >= 80 ? '#ff4d4f' : '#52c41a'}
              showInfo={false}
            />
            <div style={{ fontSize: '11px', color: '#666', textAlign: 'center' }}>
              {rate}%
            </div>
          </div>
        );
      },
    },
    {
      title: '高级配置',
      key: 'advanced_config',
      width: 150,
      render: (record: Link) => (
        <div>
          <div style={{ fontSize: '12px', marginBottom: 2 }}>
            <Text type="secondary">会话间隔: </Text>
            <Text strong>{record.access_session_interval || 5}</Text>
            <Text type="secondary"> 分钟</Text>
          </div>
          <div style={{ fontSize: '12px' }}>
            <Text type="secondary">等待时间: </Text>
            <Text strong>{record.verification_wait_time || 0}</Text>
            <Text type="secondary"> 秒</Text>
          </div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      filters: [
        { text: '活跃', value: 'active' },
        { text: '不活跃', value: 'inactive' },
        { text: '已过期', value: 'expired' },
      ],
      render: (status: string) => {
        const config = getStatusConfig(status);
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (record: Link) => (
        <Space size="small">
          <Tooltip title="复制链接">
            <Button 
              type="link" 
              size="small" 
              icon={<CopyOutlined />}
              onClick={() => handleCopyLink(record.link_id)}
            >
              复制
            </Button>
          </Tooltip>
          <Tooltip title="编辑">
            <Button 
              type="link" 
              size="small" 
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
          </Tooltip>
          <Popconfirm
            title="确定要删除这个链接吗？"
            description="删除后将无法恢复"
            onConfirm={() => handleDelete(record.link_id)}
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

  // 搜索处理
  const handleSearch = (value: string) => {
    setSearchText(value);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  // 状态筛选处理
  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  // 表格变化处理
  const handleTableChange = (paginationConfig: any, filters: any) => {
    setPagination({
      current: paginationConfig.current,
      pageSize: paginationConfig.pageSize,
      total: pagination.total,
    });
  };

  return (
    <div>
      <Title level={2} style={{ marginBottom: 24 }}>
        链接管理
      </Title>

      <Card>
        {/* 搜索和操作 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8}>
            <Input.Search
              placeholder="搜索链接ID或账号名称"
              allowClear
              onSearch={handleSearch}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={6}>
            <Select
              placeholder="链接状态"
              value={statusFilter}
              onChange={handleStatusFilter}
              style={{ width: '100%' }}
              options={[
                { label: '全部状态', value: 'all' },
                { label: '活跃', value: 'active' },
                { label: '不活跃', value: 'inactive' },
                { label: '已过期', value: 'expired' },
              ]}
            />
          </Col>
          <Col xs={24} sm={10}>
            <Space style={{ float: 'right' }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAdd}
              >
                创建链接
              </Button>
              <Button
                icon={<AppstoreOutlined />}
                onClick={handleBatchAdd}
              >
                批量创建
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={fetchLinks}
                loading={loading}
              >
                刷新
              </Button>
            </Space>
          </Col>
        </Row>

        {/* 链接列表表格 */}
        <Table
          columns={columns}
          dataSource={links}
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
          scroll={{ x: 1670 }}
        />
      </Card>

      {/* 创建/编辑链接模态框 */}
      <Modal
        title={editingLink ? '编辑链接' : '创建链接'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="account_id"
            label="关联账号"
            rules={[{ required: true, message: '请选择关联账号' }]}
            extra={editingLink ? "编辑模式下不可更改关联账号" : "链接将自动使用所选账号绑定的设备"}
          >
            <Select
              placeholder="请选择关联账号"
              showSearch
              optionFilterProp="children"
              disabled={!!editingLink}
              optionRender={(option) => {
                const account = accounts.find(acc => acc.id === option.value);
                if (!account) return option.label;
                
                return (
                  <div style={{ padding: '8px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      {account.image_url && (
                        <img 
                          src={account.image_url} 
                          alt="头像" 
                          style={{ width: 24, height: 24, borderRadius: 4 }}
                        />
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                          📱 {account.account_name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          👤 用户名: {account.username} | 🔑 密码: {'*'.repeat(Math.min(account.password?.length || 0, 6))}
                        </div>
                      </div>
                      <Tag color="blue" style={{ fontSize: '12px' }}>
                        {account.type}
                      </Tag>
                    </div>
                    {account.primary_device && (
                      <div style={{ fontSize: '12px', color: '#1890ff', paddingLeft: '32px' }}>
                        📱 绑定设备: {account.primary_device.brand} {account.primary_device.model} 
                        <span style={{ color: '#666', marginLeft: '8px' }}>
                          ({account.primary_device.device_id})
                        </span>
                        <span style={{ marginLeft: '8px' }}>
                          📞 {account.primary_device.phone_number || '未设置'}
                        </span>
                        <Tag 
                          color={account.primary_device.is_online ? 'green' : 'red'} 
                          style={{ fontSize: '10px', marginLeft: '8px' }}
                        >
                          {account.primary_device.is_online ? '在线' : '离线'}
                        </Tag>
                      </div>
                    )}
                    {!account.primary_device && (
                      <div style={{ fontSize: '12px', color: '#ff4d4f', paddingLeft: '32px' }}>
                        ⚠️ 该账号未绑定设备，无法创建链接
                      </div>
                    )}
                  </div>
                );
              }}
            >
              {accounts.map(account => (
                <Option key={account.id} value={account.id} disabled={!account.primary_device}>
                  📱 {account.account_name} ({account.type}) - {account.username}
                  {!account.primary_device && ' [未绑定设备]'}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="max_access_count"
                label="最大访问次数"
                rules={[{ required: true, message: '请输入最大访问次数' }]}
              >
                <InputNumber
                  min={0}
                  max={1000}
                  placeholder="0表示不限制"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="max_verification_count"
                label="最大验证码次数"
                rules={[{ required: true, message: '请输入最大验证码次数' }]}
              >
                <InputNumber
                  min={0}
                  max={1000}
                  placeholder="0表示不限制"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>


          <Divider orientation="left">高级配置</Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="access_session_interval"
                label="访问会话间隔（分钟）"
                rules={[{ required: true, message: '请输入访问会话间隔' }]}
                extra="在此时间内的重复访问不会增加访问次数"
              >
                <InputNumber
                  min={1}
                  max={60}
                  placeholder="默认5分钟"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="verification_wait_time"
                label="验证码等待时间（秒）"
                rules={[{ required: true, message: '请输入验证码等待时间' }]}
                extra="客户点击获取验证码后等待的时间，确保后台已收到最新短信"
              >
                <InputNumber
                  min={0}
                  max={30}
                  placeholder="默认0秒"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                {editingLink ? '更新' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量创建链接模态框 */}
      <Modal
        title="批量创建链接"
        open={batchModalVisible}
        onCancel={() => setBatchModalVisible(false)}
        footer={null}
        width={600}
      >
        <Alert
          message="批量创建说明"
          description="将为选定的账号批量创建多个链接，每个链接使用相同的配置参数，并自动使用账号绑定的设备。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        <Form
          form={batchForm}
          layout="vertical"
          onFinish={handleBatchCreate}
        >
          <Form.Item
            name="account_id"
            label="关联账号"
            rules={[{ required: true, message: '请选择关联账号' }]}
            extra="链接将自动使用所选账号绑定的设备"
          >
            <Select
              placeholder="请选择关联账号"
              showSearch
              optionFilterProp="children"
              optionRender={(option) => {
                const account = accounts.find(acc => acc.id === option.value);
                if (!account) return option.label;
                
                return (
                  <div style={{ padding: '8px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      {account.image_url && (
                        <img 
                          src={account.image_url} 
                          alt="头像" 
                          style={{ width: 24, height: 24, borderRadius: 4 }}
                        />
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                          📱 {account.account_name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          👤 用户名: {account.username} | 🔑 密码: {'*'.repeat(Math.min(account.password?.length || 0, 6))}
                        </div>
                      </div>
                      <Tag color="blue" style={{ fontSize: '12px' }}>
                        {account.type}
                      </Tag>
                    </div>
                    {account.primary_device && (
                      <div style={{ fontSize: '12px', color: '#1890ff', paddingLeft: '32px' }}>
                        📱 绑定设备: {account.primary_device.brand} {account.primary_device.model} 
                        <span style={{ color: '#666', marginLeft: '8px' }}>
                          ({account.primary_device.device_id})
                        </span>
                        <span style={{ marginLeft: '8px' }}>
                          📞 {account.primary_device.phone_number || '未设置'}
                        </span>
                        <Tag 
                          color={account.primary_device.is_online ? 'green' : 'red'} 
                          style={{ fontSize: '10px', marginLeft: '8px' }}
                        >
                          {account.primary_device.is_online ? '在线' : '离线'}
                        </Tag>
                      </div>
                    )}
                    {!account.primary_device && (
                      <div style={{ fontSize: '12px', color: '#ff4d4f', paddingLeft: '32px' }}>
                        ⚠️ 该账号未绑定设备，无法创建链接
                      </div>
                    )}
                  </div>
                );
              }}
            >
              {accounts.map(account => (
                <Option key={account.id} value={account.id} disabled={!account.primary_device}>
                  📱 {account.account_name} ({account.type}) - {account.username}
                  {!account.primary_device && ' [未绑定设备]'}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="count"
            label="创建数量"
            rules={[{ required: true, message: '请输入创建数量' }]}
          >
            <InputNumber
              min={1}
              max={100}
              placeholder="默认10个"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Divider />

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="max_access_count"
                label="最大访问次数"
                rules={[{ required: true, message: '请输入最大访问次数' }]}
              >
                <InputNumber
                  min={0}
                  max={1000}
                  placeholder="0表示不限制"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="max_verification_count"
                label="最大验证码次数"
                rules={[{ required: true, message: '请输入最大验证码次数' }]}
              >
                <InputNumber
                  min={0}
                  max={1000}
                  placeholder="0表示不限制"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">高级配置</Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="access_session_interval"
                label="访问会话间隔（分钟）"
                rules={[{ required: true, message: '请输入访问会话间隔' }]}
                extra="在此时间内的重复访问不会增加访问次数"
              >
                <InputNumber
                  min={1}
                  max={60}
                  placeholder="默认5分钟"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="verification_wait_time"
                label="验证码等待时间（秒）"
                rules={[{ required: true, message: '请输入验证码等待时间' }]}
                extra="客户点击获取验证码后等待的时间，确保后台已收到最新短信"
              >
                <InputNumber
                  min={0}
                  max={30}
                  placeholder="默认0秒"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setBatchModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                批量创建
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LinkManagement;
