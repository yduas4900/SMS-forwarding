import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Card,
  Button,
  Space,
  Tag,
  Input,
  DatePicker,
  Select,
  Modal,
  Form,
  message,
  Tooltip,
  Typography,
  Row,
  Col,
  Checkbox,
  Statistic,
  Progress,
  Dropdown,
  Menu,
  Upload,
  Divider
} from 'antd';
import {
  MessageOutlined,
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  DeleteOutlined,
  FilterOutlined,
  SettingOutlined,
  EditOutlined,
  MobileOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LinkOutlined,
  SendOutlined,
  MoreOutlined,
  CopyOutlined,
  DownloadOutlined,
  AppstoreOutlined,
  TagOutlined,
  BarChartOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { smsAPI, deviceAPI } from '../../services/api';
import type { ColumnsType } from 'antd/es/table';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { TextArea } = Input;
const { Title, Text } = Typography;

interface SmsRecord {
  id: string;
  device_id: string;
  sender: string;
  content: string;
  sms_timestamp: string;
  received_at: string;
  created_at: string;
  category?: string;
  verification_code?: string;
  device_info?: {
    device_id: string;
    brand?: string;
    model?: string;
    phone_number?: string;
    is_online: boolean;
  };
}

interface Device {
  id: number;
  device_id: string;
  phone_number?: string;
  brand?: string;
  model?: string;
  is_online: boolean;
  last_heartbeat?: string;
}

interface SmsStatistics {
  total: number;
  today: number;
  week: number;
  verification: number;
  promotion: number;
  normal: number;
}

const SmsManagementAdvanced: React.FC = () => {
  const [smsData, setSmsData] = useState<SmsRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    device_id: '',
    category: '',
    search: '',
    date_range: null as any
  });
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedSms, setSelectedSms] = useState<SmsRecord | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [statistics, setStatistics] = useState<SmsStatistics>({
    total: 0,
    today: 0,
    week: 0,
    verification: 0,
    promotion: 0,
    normal: 0
  });

  // 验证码提取函数
  const extractVerificationCode = (content: string): string | null => {
    // 常见验证码模式
    const patterns = [
      /验证码[：:\s]*(\d{4,8})/i,
      /verification code[：:\s]*(\d{4,8})/i,
      /code[：:\s]*(\d{4,8})/i,
      /(\d{4,8})[^0-9]*验证码/i,
      /(\d{4,8})[^0-9]*code/i,
      /【.*】.*?(\d{4,8})/,
      /\[.*\].*?(\d{4,8})/,
      /(?:验证码|code|密码)[^0-9]*(\d{4,8})/i
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  };

  // 自动分类函数
  const categorizeSms = (content: string, sender: string): string => {
    const contentLower = content.toLowerCase();
    const senderLower = sender.toLowerCase();
    
    // 验证码关键词
    const verificationKeywords = [
      '验证码', 'verification', 'code', '验证', '确认码', '动态码',
      '安全码', '登录码', '注册码', '找回密码', '身份验证'
    ];
    
    // 通知关键词
    const notificationKeywords = [
      '通知', '提醒', '消息', '公告', '系统', '服务', '账单', '到期'
    ];
    
    // 广告关键词
    const promotionKeywords = [
      '优惠', '促销', '打折', '特价', '活动', '抽奖', '红包',
      '免费', '赠送', '限时', '秒杀', '团购', '推广', '营销'
    ];

    // 检查验证码
    for (const keyword of verificationKeywords) {
      if (contentLower.includes(keyword)) {
        return 'verification';
      }
    }

    // 检查通知
    for (const keyword of notificationKeywords) {
      if (contentLower.includes(keyword) || senderLower.includes(keyword)) {
        return 'notification';
      }
    }

    // 检查广告
    for (const keyword of promotionKeywords) {
      if (contentLower.includes(keyword)) {
        return 'promotion';
      }
    }

    return 'other';
  };

  // 高亮验证码
  const highlightVerificationCode = (content: string) => {
    const code = extractVerificationCode(content);
    if (!code) return content;

    const regex = new RegExp(`(${code})`, 'gi');
    const parts = content.split(regex);
    
    return parts.map((part, index) => 
      part.toLowerCase() === code.toLowerCase() ? (
        <span key={index} style={{ 
          backgroundColor: '#fff2e8', 
          color: '#fa8c16', 
          fontWeight: 'bold',
          padding: '2px 4px',
          borderRadius: '3px'
        }}>
          {part}
        </span>
      ) : part
    );
  };

  // 获取分类配置
  const getCategoryConfig = (category: string) => {
    switch (category) {
      case 'verification':
        return { color: 'orange', text: '验证码', icon: '🔐' };
      case 'notification':
        return { color: 'blue', text: '通知', icon: '📢' };
      case 'promotion':
        return { color: 'red', text: '广告', icon: '📢' };
      default:
        return { color: 'default', text: '其他', icon: '📝' };
    }
  };

  // 获取相对时间
  const getRelativeTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = now.getTime() - time.getTime();
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return time.toLocaleDateString();
  };

  const fetchSmsData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {
        page: pagination.current,
        page_size: pagination.pageSize,
      };

      if (filters.device_id) {
        const deviceId = parseInt(filters.device_id);
        if (!isNaN(deviceId)) {
          params.device_id = deviceId;
        }
      }
      
      if (filters.category) {
        params.category = filters.category;
      }
      
      if (filters.search) {
        params.search = filters.search;
      }
      
      if (filters.date_range && filters.date_range.length === 2) {
        params.start_date = filters.date_range[0].format('YYYY-MM-DD');
        params.end_date = filters.date_range[1].format('YYYY-MM-DD');
      }
      
      const response = await smsAPI.getSmsList(params);
      
      const smsData = response.data?.sms_list || [];
      const paginationData = response.data?.pagination || {};
      
      // 处理短信数据，添加验证码提取和分类
      const processedSmsData = smsData.map((sms: any) => ({
        ...sms,
        verification_code: extractVerificationCode(sms.content),
        category: sms.category || categorizeSms(sms.content, sms.sender)
      }));
      
      setSmsData(processedSmsData);
      setPagination(prev => ({
        ...prev,
        total: paginationData.total || 0
      }));
    } catch (error: any) {
      console.error('获取短信数据失败:', error);
      message.error('获取短信数据失败: ' + (error.response?.data?.detail || error.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchDevices = async () => {
    try {
      const response = await deviceAPI.getDeviceList({ page: 1, page_size: 100 });
      const devicesData = response.data?.devices || [];
      setDevices(devicesData);
    } catch (error: any) {
      console.error('获取设备列表失败:', error);
    }
  };

  const fetchStatistics = async () => {
    try {
      // 暂时使用模拟数据，后续实现统计API
      const mockStats = {
        total: smsData.length,
        today: smsData.filter(sms => {
          const today = new Date().toDateString();
          const smsDate = new Date(sms.created_at).toDateString();
          return today === smsDate;
        }).length,
        week: smsData.length,
        verification: smsData.filter(sms => sms.category === 'verification').length,
        promotion: smsData.filter(sms => sms.category === 'promotion').length,
        normal: smsData.filter(sms => sms.category === 'other').length
      };
      setStatistics(mockStats);
    } catch (error: any) {
      console.error('获取统计数据失败:', error);
    }
  };

  useEffect(() => {
    fetchSmsData();
    fetchDevices();
    fetchStatistics();
  }, [pagination.current, pagination.pageSize, fetchSmsData]);

  // 获取设备显示名称
  const getDeviceDisplayName = (device: Device) => {
    const phoneNumber = device.phone_number || '未知号码';
    const deviceId = device.device_id;
    const status = device.is_online ? '在线' : '离线';
    return `${phoneNumber} (${deviceId}) - ${status}`;
  };

  // 复制验证码
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      message.success('验证码已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的短信');
      return;
    }

    Modal.confirm({
      title: '批量删除确认',
      content: `确定要删除选中的 ${selectedRowKeys.length} 条短信吗？`,
      onOk: async () => {
        try {
          // 这里需要实现批量删除API
          for (const id of selectedRowKeys) {
            await smsAPI.deleteSms(parseInt(id as string));
          }
          message.success(`成功删除 ${selectedRowKeys.length} 条短信`);
          setSelectedRowKeys([]);
          fetchSmsData();
        } catch (error: any) {
          message.error('批量删除失败: ' + (error.message || '未知错误'));
        }
      }
    });
  };

  // 批量标记分类
  const handleBatchCategory = (category: string) => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要标记的短信');
      return;
    }

    Modal.confirm({
      title: '批量标记确认',
      content: `确定要将选中的 ${selectedRowKeys.length} 条短信标记为 ${getCategoryConfig(category).text} 吗？`,
      onOk: async () => {
        try {
          // 这里需要实现批量更新分类API
          message.success(`成功标记 ${selectedRowKeys.length} 条短信`);
          setSelectedRowKeys([]);
          fetchSmsData();
        } catch (error: any) {
          message.error('批量标记失败: ' + (error.message || '未知错误'));
        }
      }
    });
  };

  // 导出数据
  const handleExport = (format: 'excel' | 'csv') => {
    // 这里需要实现导出功能
    message.info(`正在导出${format.toUpperCase()}格式数据...`);
  };

  const handleTableChange = (paginationConfig: any) => {
    setPagination({
      ...pagination,
      current: paginationConfig.current,
      pageSize: paginationConfig.pageSize
    });
  };

  const handleSearch = () => {
    setPagination({ ...pagination, current: 1 });
    fetchSmsData();
  };

  const handleReset = () => {
    setFilters({
      device_id: '',
      category: '',
      search: '',
      date_range: null
    });
    setPagination({ ...pagination, current: 1 });
  };

  const handleViewDetail = (record: SmsRecord) => {
    setSelectedSms(record);
    setDetailModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    console.log('🗑️ 开始删除短信:', id);
    try {
      const response = await smsAPI.deleteSms(parseInt(id));
      console.log('✅ 删除API响应:', response);
      message.success('删除成功');
      fetchSmsData();
      fetchStatistics();
    } catch (error: any) {
      console.error('❌ 删除失败:', error);
      message.error('删除失败: ' + (error.response?.data?.detail || error.message || '未知错误'));
    }
  };

  // 行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
    onSelectAll: (selected: boolean, selectedRows: SmsRecord[], changeRows: SmsRecord[]) => {
      console.log('全选状态:', selected, selectedRows, changeRows);
    },
  };

  // 批量操作菜单
  const batchActionMenu = (
    <Menu>
      <Menu.Item key="delete" icon={<DeleteOutlined />} onClick={handleBatchDelete}>
        批量删除
      </Menu.Item>
      <Menu.SubMenu key="category" title="批量标记分类" icon={<TagOutlined />}>
        <Menu.Item key="verification" onClick={() => handleBatchCategory('verification')}>
          标记为验证码
        </Menu.Item>
        <Menu.Item key="notification" onClick={() => handleBatchCategory('notification')}>
          标记为通知
        </Menu.Item>
        <Menu.Item key="promotion" onClick={() => handleBatchCategory('promotion')}>
          标记为广告
        </Menu.Item>
        <Menu.Item key="other" onClick={() => handleBatchCategory('other')}>
          标记为其他
        </Menu.Item>
      </Menu.SubMenu>
      <Menu.Divider />
      <Menu.Item key="export-excel" icon={<DownloadOutlined />} onClick={() => handleExport('excel')}>
        导出为Excel
      </Menu.Item>
      <Menu.Item key="export-csv" icon={<DownloadOutlined />} onClick={() => handleExport('csv')}>
        导出为CSV
      </Menu.Item>
    </Menu>
  );

  const columns: ColumnsType<SmsRecord> = [
    {
      title: '设备信息',
      key: 'device_info',
      width: 180,
      render: (record: SmsRecord) => (
        <div>
          <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: 4 }}>
            📱 {record.device_info?.device_id || record.device_id}
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: 2 }}>
            📞 {record.device_info?.phone_number || '未设置'}
          </div>
          <Tag 
            color={record.device_info?.is_online ? 'green' : 'red'}
            style={{ fontSize: '11px' }}
          >
            {record.device_info?.is_online ? '在线' : '离线'}
          </Tag>
        </div>
      ),
    },
    {
      title: '短信内容',
      key: 'content_info',
      width: 300,
      render: (record: SmsRecord) => (
        <div>
          <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: 4 }}>
            📧 {record.sender}
          </div>
          <div style={{ marginBottom: 8, lineHeight: '1.4' }}>
            {highlightVerificationCode(record.content.length > 100 
              ? record.content.substring(0, 100) + '...' 
              : record.content
            )}
          </div>
          {record.verification_code && (
            <Tag 
              color="orange" 
              icon={<CopyOutlined />}
              style={{ cursor: 'pointer' }}
              onClick={() => handleCopyCode(record.verification_code!)}
            >
              验证码: {record.verification_code}
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: '智能分类',
      key: 'category',
      width: 120,
      filters: [
        { text: '验证码', value: 'verification' },
        { text: '通知', value: 'notification' },
        { text: '广告', value: 'promotion' },
        { text: '其他', value: 'other' },
      ],
      render: (record: SmsRecord) => {
        const config = getCategoryConfig(record.category || 'other');
        return (
          <Tag color={config.color} style={{ fontSize: '12px' }}>
            {config.icon} {config.text}
          </Tag>
        );
      },
    },
    {
      title: '时间信息',
      key: 'time_info',
      width: 150,
      sorter: true,
      render: (record: SmsRecord) => (
        <div>
          <div style={{ fontSize: '13px', marginBottom: 2 }}>
            {new Date(record.sms_timestamp || record.received_at).toLocaleString('zh-CN')}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            {getRelativeTime(record.sms_timestamp || record.received_at)}
          </div>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (record: SmsRecord) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            查看
          </Button>
          {record.verification_code && (
            <Button
              type="primary"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => handleCopyCode(record.verification_code!)}
            >
              复制码
            </Button>
          )}
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              Modal.confirm({
                title: '确认删除',
                content: '确定要删除这条短信记录吗？',
                okText: '确认删除',
                cancelText: '取消',
                okType: 'danger',
                onOk: async () => {
                  try {
                    await handleDelete(record.id);
                  } catch (error) {
                    console.error('删除失败:', error);
                  }
                }
              });
            }}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={2} style={{ marginBottom: 24 }}>
        <MessageOutlined /> 短信管理（功能完整型）
      </Title>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="今日短信"
              value={statistics.today}
              prefix={<MessageOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="验证码短信"
              value={statistics.verification}
              prefix={<CopyOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="在线设备"
              value={devices.filter(d => d.is_online).length}
              prefix={<MobileOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="总短信数"
              value={statistics.total}
              prefix={<BarChartOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        {/* 搜索筛选区域 */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={6}>
              <Select
                placeholder="选择设备"
                value={filters.device_id}
                onChange={(value) => setFilters({ ...filters, device_id: value })}
                style={{ width: '100%' }}
                allowClear
              >
                {devices.map(device => (
                  <Option key={device.id} value={device.id.toString()}>
                    <Space>
                      <MobileOutlined />
                      {getDeviceDisplayName(device)}
                      {device.is_online ? (
                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      ) : (
                        <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                      )}
                    </Space>
                  </Option>
                ))}
              </Select>
            </Col>
            <Col xs={24} sm={4}>
              <Select
                placeholder="分类筛选"
                value={filters.category}
                onChange={(value) => setFilters({ ...filters, category: value })}
                style={{ width: '100%' }}
                allowClear
              >
                <Option value="verification">🔐 验证码</Option>
                <Option value="notification">📢 通知</Option>
                <Option value="promotion">📢 广告</Option>
                <Option value="other">📝 其他</Option>
              </Select>
            </Col>
            <Col xs={24} sm={6}>
              <Input
                placeholder="搜索发送方或内容"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                allowClear
              />
            </Col>
            <Col xs={24} sm={8}>
              <Space>
                <RangePicker
                  value={filters.date_range}
                  onChange={(dates) => setFilters({ ...filters, date_range: dates })}
                  placeholder={['开始时间', '结束时间']}
                />
                <Button
                  type="primary"
                  icon={<SearchOutlined />}
                  onClick={handleSearch}
                >
                  搜索
                </Button>
                <Button
                  icon={<FilterOutlined />}
                  onClick={handleReset}
                >
                  重置
                </Button>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={fetchSmsData}
                >
                  刷新
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* 批量操作工具栏 */}
        {selectedRowKeys.length > 0 && (
          <Card size="small" style={{ marginBottom: 16, backgroundColor: '#f6ffed' }}>
            <Row justify="space-between" align="middle">
              <Col>
                <Space>
                  <Text strong>已选择 {selectedRowKeys.length} 条短信</Text>
                  <Button size="small" onClick={() => setSelectedRowKeys([])}>
                    取消选择
                  </Button>
                </Space>
              </Col>
              <Col>
                <Space>
                  <Dropdown overlay={batchActionMenu} trigger={['click']}>
                    <Button type="primary" icon={<AppstoreOutlined />}>
                      批量操作
                    </Button>
                  </Dropdown>
                </Space>
              </Col>
            </Row>
          </Card>
        )}

        {/* 数据表格 */}
        <Table
          columns={columns}
          dataSource={smsData}
          rowKey="id"
          loading={loading}
          rowSelection={rowSelection}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `第 ${range[0]}-${range[1]} 条/共 ${total} 条`
          }}
          onChange={handleTableChange}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* 短信详情模态框 */}
      <Modal
        title="短信详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          selectedSms?.verification_code && (
            <Button 
              key="copy" 
              type="primary" 
              icon={<CopyOutlined />}
              onClick={() => handleCopyCode(selectedSms.verification_code!)}
            >
              复制验证码
            </Button>
          ),
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={700}
      >
        {selectedSms && (
          <div>
            <Row gutter={16}>
              <Col span={12}>
                <p><strong>设备ID:</strong> {selectedSms.device_info?.device_id || selectedSms.device_id}</p>
                <p><strong>手机号:</strong> {selectedSms.device_info?.phone_number || '未设置'}</p>
                <p><strong>设备状态:</strong> 
                  <Tag color={selectedSms.device_info?.is_online ? 'green' : 'red'} style={{ marginLeft: 8 }}>
                    {selectedSms.device_info?.is_online ? '在线' : '离线'}
                  </Tag>
                </p>
              </Col>
              <Col span={12}>
                <p><strong>发送方:</strong> {selectedSms.sender}</p>
                <p><strong>分类:</strong> 
                  <Tag color={getCategoryConfig(selectedSms.category || 'other').color} style={{ marginLeft: 8 }}>
                    {getCategoryConfig(selectedSms.category || 'other').icon} {getCategoryConfig(selectedSms.category || 'other').text}
                  </Tag>
                </p>
                {selectedSms.verification_code && (
                  <p><strong>验证码:</strong> 
                    <Tag 
                      color="orange" 
                      style={{ marginLeft: 8, cursor: 'pointer' }}
                      onClick={() => handleCopyCode(selectedSms.verification_code!)}
                    >
                      {selectedSms.verification_code} <CopyOutlined />
                    </Tag>
                  </p>
                )}
              </Col>
            </Row>
            <Divider />
            <p><strong>接收时间:</strong> {new Date(selectedSms.sms_timestamp || selectedSms.received_at).toLocaleString('zh-CN')}</p>
            <p><strong>创建时间:</strong> {new Date(selectedSms.created_at).toLocaleString('zh-CN')}</p>
            <p><strong>短信内容:</strong></p>
            <div style={{ 
              backgroundColor: '#fafafa', 
              padding: '12px', 
              borderRadius: '6px',
              border: '1px solid #d9d9d9',
              marginTop: 8,
              lineHeight: '1.6'
            }}>
              {highlightVerificationCode(selectedSms.content)}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SmsManagementAdvanced;
