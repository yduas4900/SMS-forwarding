// @ts-nocheck
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
  Switch,
  Dropdown,
  Menu
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
  MoreOutlined
} from '@ant-design/icons';
import { smsAPI, smsRuleAPI, deviceAPI, linkAPI, smsForwardAPI } from '../../services/api';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { TextArea } = Input;
const { Title } = Typography;

interface SmsRecord {
  id: string;
  device_id: string;
  sender: string;
  content: string;
  received_at: string;
  created_at: string;
}

interface SmsRule {
  id: number;
  rule_name: string;
  device_id: number;
  sender_pattern: string;
  sender_match_type: 'exact' | 'fuzzy' | 'regex';
  content_pattern: string;
  content_match_type: 'exact' | 'fuzzy' | 'regex';
  is_active: boolean;
  priority: number;
  action_type: string;
  forward_target_type?: string;
  forward_target_id?: number;
  forward_config?: any;
  created_at: string;
  updated_at: string;
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

interface AccountLink {
  id: number;
  link_id: string;
  account_info?: {
    id: number;
    account_name: string;
    type: string;
    image_url?: string;
  };
  account?: {
    id: number;
    name: string;
    type: string;
    image_url?: string;
  };
}

const SmsManagement: React.FC = () => {
  const [smsData, setSmsData] = useState<SmsRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    device_id: '',
    sender: '',
    content: '',
    date_range: null as any
  });
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedSms, setSelectedSms] = useState<SmsRecord | null>(null);
  
  // 转发规则相关状态
  const [devices, setDevices] = useState<Device[]>([]);
  const [forwardTargets, setForwardTargets] = useState<AccountLink[]>([]);
  const [rules, setRules] = useState<SmsRule[]>([]);
  const [ruleModalVisible, setRuleModalVisible] = useState(false);
  const [quickForwardModalVisible, setQuickForwardModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<SmsRule | null>(null);
  const [ruleForm] = Form.useForm();
  const [quickForwardForm] = Form.useForm();

  // 🔥 平滑数据更新 - 避免明显的刷新感觉
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  const fetchSmsData = useCallback(async (isAutoRefresh = false) => {
    // 🔥 只在初始加载或手动刷新时显示loading
    if (!isAutoRefresh) {
      setLoading(true);
    }
    
    try {
      const params: any = {
        page: pagination.current,
        page_size: pagination.pageSize,
      };

      // 添加筛选参数
      if (filters.device_id) {
        // 确保device_id是数字类型
        const deviceId = parseInt(filters.device_id);
        if (!isNaN(deviceId)) {
          params.device_id = deviceId;
        }
      }
      
      // 合并搜索条件
      const searchTerms = [];
      if (filters.sender) {
        searchTerms.push(filters.sender);
      }
      if (filters.content) {
        searchTerms.push(filters.content);
      }
      if (searchTerms.length > 0) {
        params.search = searchTerms.join(' ');
      }
      
      if (filters.date_range && filters.date_range.length === 2) {
        params.start_date = filters.date_range[0].format('YYYY-MM-DD');
        params.end_date = filters.date_range[1].format('YYYY-MM-DD');
      }
      
      const response = await smsAPI.getSmsList(params);
      
      // 修复数据结构匹配
      const newSmsData = response.data?.sms_list || [];
      const paginationData = response.data?.pagination || {};
      
      // 🔥 平滑更新数据 - 只在数据真正变化时更新
      setSmsData(prevData => {
        // 比较新旧数据，只有真正变化时才更新
        const hasChanges = JSON.stringify(prevData) !== JSON.stringify(newSmsData);
        if (hasChanges || isInitialLoad) {
          console.log('📊 数据更新:', isAutoRefresh ? '自动刷新' : '手动刷新', '新数据条数:', newSmsData.length);
          return newSmsData;
        }
        return prevData;
      });
      
      setPagination(prev => ({
        ...prev,
        total: paginationData.total || 0
      }));
      
      if (isInitialLoad) {
        setIsInitialLoad(false);
      }
      
    } catch (error: any) {
      console.error('获取短信数据失败:', error);
      if (!isAutoRefresh) {
        message.error('获取短信数据失败: ' + (error.response?.data?.detail || error.message || '未知错误'));
      }
    } finally {
      if (!isAutoRefresh) {
        setLoading(false);
      }
    }
  }, [pagination.current, pagination.pageSize, filters, isInitialLoad]);

  const fetchDevices = async () => {
    try {
      const response = await deviceAPI.getDeviceList({ page: 1, page_size: 100 });
      const devicesData = response.data?.devices || [];
      setDevices(devicesData);
    } catch (error: any) {
      console.error('获取设备列表失败:', error);
    }
  };

  const fetchForwardTargets = async () => {
    try {
      const response = await linkAPI.getLinkList({ page: 1, page_size: 100 });
      const linksData = response.data?.links || [];
      setForwardTargets(linksData);
    } catch (error: any) {
      console.error('获取转发目标失败:', error);
    }
  };

  const fetchRules = async () => {
    try {
      const response = await smsRuleAPI.getRuleList();
      const rulesData = response.data?.rules || [];
      setRules(rulesData);
    } catch (error: any) {
      console.error('获取短信规则失败:', error);
    }
  };

  useEffect(() => {
    fetchSmsData();
    fetchDevices();
    fetchForwardTargets();
    fetchRules();
  }, [pagination.current, pagination.pageSize, fetchSmsData]);

  // 🔥 设置自动刷新定时器 - 每2秒静默刷新一次，像股票数据一样实时更新
  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const autoRefreshInterval = setInterval(() => {
      // 只在没有模态框打开时进行自动刷新
      if (!detailModalVisible && !ruleModalVisible && !quickForwardModalVisible) {
        console.log('🔄 自动刷新短信数据...');
        fetchSmsData(true); // 传入true表示是自动刷新
      }
    }, 2000); // 每2秒刷新一次，提供股票级别的实时体验

    return () => {
      clearInterval(autoRefreshInterval);
    };
  }, [autoRefreshEnabled, detailModalVisible, ruleModalVisible, quickForwardModalVisible, fetchSmsData]);

  // 获取设备显示名称
  const getDeviceDisplayName = (device: Device) => {
    const phoneNumber = device.phone_number || '未知号码';
    const deviceId = device.device_id;
    const status = device.is_online ? '在线' : '离线';
    return `${phoneNumber} (${deviceId}) - ${status}`;
  };

  // 获取账号名称的安全方法
  const getAccountName = (target: AccountLink) => {
    return target.account_info?.account_name || 
           target.account?.name || 
           '未知账号';
  };

  const getAccountType = (target: AccountLink) => {
    return target.account_info?.type || 
           target.account?.type || 
           '未知类型';
  };

  // 快速转发功能
  const handleQuickForward = (record: SmsRecord) => {
    quickForwardForm.setFieldsValue({
      rule_name: `转发_${record.sender}_${Date.now()}`,
      device_id: parseInt(record.device_id),
      sender_pattern: record.sender,
      sender_match_type: 'exact',
      content_pattern: record.content.substring(0, 50),
      content_match_type: 'fuzzy',
      forward_target_type: 'webhook',
      priority: 0,
      is_active: true
    });
    setQuickForwardModalVisible(true);
  };

  // 创建转发规则
  const handleCreateRule = (record: SmsRecord) => {
    ruleForm.resetFields();
    ruleForm.setFieldsValue({
      rule_name: `规则_${record.sender}_${Date.now()}`,
      device_id: parseInt(record.device_id),
      sender_pattern: record.sender,
      sender_match_type: 'fuzzy',
      content_pattern: record.content.substring(0, 50),
      content_match_type: 'fuzzy',
      forward_target_type: 'webhook',
      priority: 0,
      is_active: true
    });
    setEditingRule(null);
    setRuleModalVisible(true);
  };

  // 提交快速转发
  const handleQuickForwardSubmit = async (values: any) => {
    try {
      await smsRuleAPI.createRule(values);
      message.success('快速转发规则创建成功');
      setQuickForwardModalVisible(false);
      fetchRules();
    } catch (error: any) {
      message.error('创建失败: ' + (error.message || '未知错误'));
    }
  };

  // 提交转发规则
  const handleRuleSubmit = async (values: any) => {
    try {
      if (editingRule) {
        await smsRuleAPI.updateRule(editingRule.id, values);
        message.success('更新成功');
      } else {
        await smsRuleAPI.createRule(values);
        message.success('创建成功');
      }
      setRuleModalVisible(false);
      fetchRules();
    } catch (error: any) {
      message.error('操作失败: ' + (error.message || '未知错误'));
    }
  };

  // 检查短信是否有匹配的规则
  const getSmsMatchingRules = (record: SmsRecord) => {
    return rules.filter(rule => {
      if (!rule.is_active) return false;
      if (rule.device_id !== parseInt(record.device_id)) return false;
      
      // 检查发送方匹配
      let senderMatch = false;
      switch (rule.sender_match_type) {
        case 'exact':
          senderMatch = rule.sender_pattern === record.sender;
          break;
        case 'fuzzy':
          senderMatch = record.sender.includes(rule.sender_pattern);
          break;
        case 'regex':
          try {
            senderMatch = new RegExp(rule.sender_pattern).test(record.sender);
          } catch {
            senderMatch = false;
          }
          break;
      }
      
      if (!senderMatch) return false;
      
      // 检查内容匹配
      let contentMatch = false;
      switch (rule.content_match_type) {
        case 'exact':
          contentMatch = rule.content_pattern === record.content;
          break;
        case 'fuzzy':
          contentMatch = record.content.includes(rule.content_pattern);
          break;
        case 'regex':
          try {
            contentMatch = new RegExp(rule.content_pattern).test(record.content);
          } catch {
            contentMatch = false;
          }
          break;
      }
      
      return contentMatch;
    });
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
      sender: '',
      content: '',
      date_range: null
    });
    setPagination({ ...pagination, current: 1 });
  };

  const handleViewDetail = (record: SmsRecord) => {
    setSelectedSms(record);
    setDetailModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await smsAPI.deleteSms(parseInt(id));
      message.success('删除成功');
      fetchSmsData();
    } catch (error: any) {
      message.error('删除失败: ' + (error.message || '未知错误'));
    }
  };

  const columns = [
    {
      title: '设备ID',
      dataIndex: 'device_id',
      key: 'device_id',
      width: 120,
      ellipsis: true
    },
    {
      title: '发送方',
      dataIndex: 'sender',
      key: 'sender',
      width: 150,
      ellipsis: true
    },
    {
      title: '短信内容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <span>{text.length > 50 ? text.substring(0, 50) + '...' : text}</span>
        </Tooltip>
      )
    },
    {
      title: '接收时间',
      dataIndex: 'received_at',
      key: 'received_at',
      width: 180,
      render: (text: string) => new Date(text).toLocaleString()
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => new Date(text).toLocaleString()
    },
    {
      title: '转发状态',
      key: 'forward_status',
      width: 120,
      render: (_, record: SmsRecord) => {
        const matchingRules = getSmsMatchingRules(record);
        if (matchingRules.length > 0) {
          return (
            <Space direction="vertical" size="small">
              {matchingRules.map(rule => {
                const target = forwardTargets.find(t => t.id === rule.forward_target_id);
                return (
                  <Tag key={rule.id} color="green" icon={<CheckCircleOutlined />}>
                    已转发到{target ? getAccountName(target) : '未知目标'}
                  </Tag>
                );
              })}
            </Space>
          );
        }
        return <Tag color="default">未设置转发</Tag>;
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      render: (_, record: SmsRecord) => {
        const matchingRules = getSmsMatchingRules(record);
        
        const actionMenu = (
          <Menu>
            <Menu.Item
              key="quick-forward"
              icon={<SendOutlined />}
              onClick={() => handleQuickForward(record)}
            >
              快速转发
            </Menu.Item>
            <Menu.Item
              key="create-rule"
              icon={<SettingOutlined />}
              onClick={() => handleCreateRule(record)}
            >
              创建转发规则
            </Menu.Item>
            {matchingRules.length > 0 && (
              <Menu.SubMenu key="edit-rules" title="编辑匹配规则" icon={<EditOutlined />}>
                {matchingRules.map(rule => (
                  <Menu.Item
                    key={`edit-${rule.id}`}
                    onClick={() => {
                      setEditingRule(rule);
                      ruleForm.setFieldsValue(rule);
                      setRuleModalVisible(true);
                    }}
                  >
                    编辑: {rule.rule_name}
                  </Menu.Item>
                ))}
              </Menu.SubMenu>
            )}
          </Menu>
        );

        return (
          <Space size="small">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
            >
              查看
            </Button>
            <Button
              type="primary"
              size="small"
              icon={<SendOutlined />}
              onClick={() => handleQuickForward(record)}
            >
              快速转发
            </Button>
            <Dropdown overlay={actionMenu} trigger={['click']}>
              <Button size="small" icon={<MoreOutlined />}>
                更多
              </Button>
            </Dropdown>
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                Modal.confirm({
                  title: '确认删除',
                  content: '确定要删除这条短信记录吗？',
                  onOk: () => handleDelete(record.id)
                });
              }}
            >
              删除
            </Button>
          </Space>
        );
      }
    }
  ];

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4} style={{ margin: 0 }}>
            <MessageOutlined /> 短信管理
          </Title>
          <Space>
            <span style={{ fontSize: 12, color: '#666' }}>
              {autoRefreshEnabled ? '🔄 实时更新中 (每2秒)' : '⏸️ 自动刷新已暂停'}
            </span>
            <Switch
              checked={autoRefreshEnabled}
              onChange={setAutoRefreshEnabled}
              checkedChildren="实时"
              unCheckedChildren="手动"
              size="small"
            />
          </Space>
        </div>

        {/* 搜索筛选区域 */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space wrap>
            <Input
              placeholder="设备ID"
              value={filters.device_id}
              onChange={(e) => setFilters({ ...filters, device_id: e.target.value })}
              style={{ width: 150 }}
            />
            <Input
              placeholder="发送方"
              value={filters.sender}
              onChange={(e) => setFilters({ ...filters, sender: e.target.value })}
              style={{ width: 150 }}
            />
            <Input
              placeholder="短信内容"
              value={filters.content}
              onChange={(e) => setFilters({ ...filters, content: e.target.value })}
              style={{ width: 200 }}
            />
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
        </Card>

        {/* 数据表格 */}
        <Table
          columns={columns}
          dataSource={smsData}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `第 ${range[0]}-${range[1]} 条/共 ${total} 条`
          }}
          onChange={handleTableChange}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* 短信详情模态框 */}
      <Modal
        title="短信详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={600}
      >
        {selectedSms && (
          <div>
            <p><strong>设备ID:</strong> {selectedSms.device_id}</p>
            <p><strong>发送方:</strong> {selectedSms.sender}</p>
            <p><strong>接收时间:</strong> {new Date(selectedSms.received_at).toLocaleString()}</p>
            <p><strong>创建时间:</strong> {new Date(selectedSms.created_at).toLocaleString()}</p>
            <p><strong>短信内容:</strong></p>
            <TextArea
              value={selectedSms.content}
              readOnly
              rows={6}
              style={{ marginTop: 8 }}
            />
          </div>
        )}
      </Modal>

      {/* 快速转发模态框 */}
      <Modal
        title="快速转发设置"
        open={quickForwardModalVisible}
        onCancel={() => setQuickForwardModalVisible(false)}
        onOk={() => quickForwardForm.submit()}
        width={600}
      >
        <Form form={quickForwardForm} layout="vertical" onFinish={handleQuickForwardSubmit}>
          <Form.Item name="rule_name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
            <Input placeholder="请输入规则名称" />
          </Form.Item>
          
          <Form.Item name="forward_target_type" label="转发目标类型" rules={[{ required: true, message: '请选择转发目标类型' }]} initialValue="webhook">
            <Select placeholder="请选择转发目标类型">
              <Option value="webhook">Webhook转发</Option>
              <Option value="email">邮件转发</Option>
            </Select>
          </Form.Item>

          <Form.Item name="forward_target_id" label="转发到客户访问链接" rules={[{ required: true, message: '请选择要转发的客户访问链接' }]}>
            <Select placeholder="选择要转发到的客户访问链接">
              {forwardTargets.map(target => (
                <Option key={target.id} value={target.id}>
                  <Space>
                    <LinkOutlined />
                    {getAccountName(target)} - {getAccountType(target)}服务
                    <span style={{ color: '#666' }}>({target.link_id})</span>
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="is_active" label="立即启用" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* 转发规则详细设置模态框 */}
      <Modal
        title={editingRule ? '编辑转发规则' : '创建转发规则'}
        open={ruleModalVisible}
        onCancel={() => setRuleModalVisible(false)}
        onOk={() => ruleForm.submit()}
        width={800}
      >
        <Form form={ruleForm} layout="vertical" onFinish={handleRuleSubmit}>
          <Form.Item name="rule_name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
            <Input placeholder="请输入规则名称" />
          </Form.Item>
          
          <Form.Item name="device_id" label="选择设备" rules={[{ required: true, message: '请选择设备' }]}>
            <Select placeholder="请选择要监听的设备" disabled>
              {devices.map(device => (
                <Option key={device.id} value={device.id}>
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
          </Form.Item>

          <Row gutter={16}>
            <Col span={16}>
              <Form.Item name="sender_pattern" label="发送方匹配模式" rules={[{ required: true, message: '请输入发送方匹配模式' }]}>
                <Input placeholder="请输入发送方匹配模式" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="sender_match_type" label="发送方匹配类型" rules={[{ required: true, message: '请选择匹配类型' }]} initialValue="fuzzy">
                <Select placeholder="匹配类型">
                  <Option value="exact">精确匹配</Option>
                  <Option value="fuzzy">模糊匹配</Option>
                  <Option value="regex">正则表达式</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={16}>
              <Form.Item name="content_pattern" label="内容匹配模式" rules={[{ required: true, message: '请输入内容匹配模式' }]}>
                <TextArea rows={3} placeholder="请输入内容匹配模式" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="content_match_type" label="内容匹配类型" rules={[{ required: true, message: '请选择匹配类型' }]} initialValue="fuzzy">
                <Select placeholder="匹配类型">
                  <Option value="exact">精确匹配</Option>
                  <Option value="fuzzy">模糊匹配</Option>
                  <Option value="regex">正则表达式</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="forward_target_type" label="转发目标类型" rules={[{ required: true, message: '请选择转发目标类型' }]} initialValue="webhook">
            <Select placeholder="请选择转发目标类型">
              <Option value="webhook">Webhook转发</Option>
              <Option value="email">邮件转发</Option>
            </Select>
          </Form.Item>

          <Form.Item name="forward_target_id" label="转发到客户访问链接" rules={[{ required: true, message: '请选择要转发的客户访问链接' }]}>
            <Select placeholder="选择要转发到的客户访问链接">
              {forwardTargets.map(target => (
                <Option key={target.id} value={target.id}>
                  <Space>
                    <LinkOutlined />
                    {getAccountName(target)} - {getAccountType(target)}服务
                    <span style={{ color: '#666' }}>({target.link_id})</span>
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="priority" label="优先级" rules={[{ required: true, message: '请输入优先级' }]} initialValue={0}>
            <Input type="number" placeholder="请输入优先级（数字越大优先级越高）" />
          </Form.Item>

          <Form.Item name="is_active" label="启用状态" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SmsManagement;
