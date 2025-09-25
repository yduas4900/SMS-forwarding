import React, { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Button,
  Space,
  Tag,
  Input,
  Select,
  Modal,
  Form,
  message,
  Typography,
  Switch,
  Row,
  Col,
  Tooltip
} from 'antd';
import {
  SettingOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  UserOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LinkOutlined,
  CopyOutlined,
  EyeOutlined,
  MobileOutlined,
  WifiOutlined,
  DisconnectOutlined,
  SendOutlined
} from '@ant-design/icons';
import { smsRuleAPI, accountAPI, linkAPI } from '../../services/api';

const { Option } = Select;
const { TextArea } = Input;
const { Title } = Typography;

interface SmsRule {
  id: number;
  rule_name: string;
  account_id: number;
  sender_pattern: string;
  sender_match_type: 'exact' | 'fuzzy' | 'regex';
  content_pattern: string;
  content_match_type: 'exact' | 'fuzzy' | 'regex';
  is_active: boolean;
  priority: number;
  display_count: number;
  action_type: string;
  forward_target_type?: string;
  forward_target_id?: number;
  forward_config?: any;
  created_at: string;
  updated_at: string;
}

interface Account {
  id: number;
  account_name: string;
  username?: string;
  type?: string;
  status: string;
  image_url?: string;
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

interface SmsRulesProps {
  selectedAccount?: {
    id: number;
    account_name: string;
    username?: string;
    password?: string;
    type?: string;
    status: string;
    image_url?: string;
    primary_device?: {
      id: number;
      device_id: string;
      brand: string;
      model: string;
      phone_number: string;
      is_online: boolean;
    };
  } | null;
}

const SmsRules: React.FC<SmsRulesProps> = ({ selectedAccount }) => {
  const [rules, setRules] = useState<SmsRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<SmsRule | null>(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [forwardTargets, setForwardTargets] = useState<AccountLink[]>([]);
  const [accountDetailModalVisible, setAccountDetailModalVisible] = useState(false);
  const [accountLinks, setAccountLinks] = useState<AccountLink[]>([]);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const response = await smsRuleAPI.getRuleList();
      const rulesData = response.data?.rules || [];
      setRules(rulesData);
    } catch (error: any) {
      console.error('获取短信规则失败:', error);
      message.error('获取短信规则失败: ' + (error.response?.data?.detail || error.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const response = await accountAPI.getAccountList({ page: 1, page_size: 100 });
      const accountsData = response.data?.accounts || [];
      setAccounts(accountsData);
    } catch (error: any) {
      console.error('获取账号列表失败:', error);
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

  useEffect(() => {
    fetchRules();
    fetchAccounts();
    fetchForwardTargets();
  }, []);

  const handleAdd = () => {
    if (!selectedAccount) {
      message.warning('请先选择一个账号');
      return;
    }
    setEditingRule(null);
    form.resetFields();
    form.setFieldsValue({
      account_id: selectedAccount.id,
      forward_target_type: 'link',
      action_type: 'forward',
      sender_match_type: 'fuzzy',
      content_match_type: 'fuzzy'
    });
    setModalVisible(true);
  };

  // 获取账号显示名称
  const getAccountDisplayName = (account: Account) => {
    const accountName = account.account_name || '未知账号';
    const type = account.type || '未知类型';
    const status = account.status === 'active' ? '活跃' : '非活跃';
    return `${accountName} (${type}) - ${status}`;
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

  const handleEdit = (record: SmsRule) => {
    setEditingRule(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      console.log('开始删除规则:', id);
      const response = await smsRuleAPI.deleteRule(id);
      console.log('删除响应:', response);
      message.success('删除成功');
      fetchRules(); // 刷新列表
    } catch (error: any) {
      console.error('删除失败:', error);
      const errorMsg = error.response?.data?.detail || error.message || '删除失败';
      message.error('删除失败: ' + errorMsg);
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingRule) {
        await smsRuleAPI.updateRule(editingRule.id, values);
        message.success('更新成功');
      } else {
        await smsRuleAPI.createRule(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchRules();
    } catch (error: any) {
      message.error('操作失败: ' + (error.message || '未知错误'));
    }
  };

  const handleToggleActive = async (id: number, isActive: boolean) => {
    try {
      await smsRuleAPI.updateRule(id, { is_active: isActive });
      message.success('状态更新成功');
      fetchRules();
    } catch (error: any) {
      message.error('状态更新失败: ' + (error.message || '未知错误'));
    }
  };

  // 获取账号链接
  const fetchAccountLinks = async (accountId: number) => {
    try {
      const response = await linkAPI.getLinkList({ account_id: accountId, page: 1, page_size: 100 });
      const linksData = response.data?.links || [];
      setAccountLinks(linksData);
    } catch (error: any) {
      console.error('获取账号链接失败:', error);
      message.error('获取账号链接失败');
    }
  };

  // 手动发送功能
  const handleManualForward = async (ruleId: number) => {
    try {
      console.log('开始手动发送:', ruleId);
      const response: any = await smsRuleAPI.manualForwardByRule(ruleId);
      console.log('发送响应:', response);
      
      if (response.success) {
        message.success(response.message);
        // 显示转发详情
        const { data } = response;
        
        // 获取当前账号信息用于显示
        const currentAccount = selectedAccount;
        
        Modal.info({
          title: '转发成功详情',
          width: 600,
          content: (
            <div>
              {currentAccount && (
                <div style={{ marginBottom: 16 }}>
                  <strong>账号信息：</strong>
                  <div>账号名称：{currentAccount.account_name}</div>
                  <div>用户名：{currentAccount.username || '未设置'}</div>
                  <div>密码：{currentAccount.password || '未设置'}</div>
                </div>
              )}
              <div style={{ marginBottom: 16 }}>
                <strong>转发结果：</strong>
                <div>匹配短信数量：{data.matched_sms_count} 条</div>
                <div>转发链接数量：{data.forwarded_links_count} 个</div>
                <div>成功转发链接：{data.success_links_count} 个</div>
              </div>
              <div>
                <strong>转发日志：</strong>
                <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 8 }}>
                  {data.forward_logs?.map((log: any, index: number) => (
                    <div key={index} style={{ 
                      padding: 8, 
                      marginBottom: 8, 
                      backgroundColor: log.status === 'success' ? '#f6ffed' : '#fff2f0', 
                      borderRadius: 4,
                      border: `1px solid ${log.status === 'success' ? '#b7eb8f' : '#ffccc7'}`
                    }}>
                      <div><strong>链接ID：</strong>{log.link_id}</div>
                      <div><strong>短信内容：</strong>{log.sms_content}</div>
                      <div><strong>状态：</strong>
                        <Tag color={log.status === 'success' ? 'green' : 'red'}>
                          {log.status === 'success' ? '成功' : '失败'}
                        </Tag>
                      </div>
                      {log.error && (
                        <div><strong>错误：</strong><span style={{ color: 'red' }}>{log.error}</span></div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 16, padding: 12, backgroundColor: '#e6f7ff', borderRadius: 6 }}>
                <div style={{ fontSize: '14px', color: '#1890ff', marginBottom: 8 }}>
                  <CheckCircleOutlined style={{ marginRight: 8 }} />
                  转发完成提示
                </div>
                <div style={{ fontSize: '13px', color: '#0050b3' }}>
                  匹配的短信已推送到客户端，请刷新客户端页面查看最新内容。
                  最新转发的短信将显示在客户端页面的最上方。
                </div>
              </div>
            </div>
          )
        });
      } else {
        message.warning(response.message);
      }
    } catch (error: any) {
      console.error('手动发送失败:', error);
      const errorMsg = error.response?.data?.detail || error.message || '手动发送失败';
      message.error('手动发送失败: ' + errorMsg);
    }
  };

  // 显示账号详细信息
  const showAccountDetail = async () => {
    if (!selectedAccount) return;
    await fetchAccountLinks(selectedAccount.id);
    setAccountDetailModalVisible(true);
  };

  // 复制到剪贴板
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success('已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  // 生成完整链接URL
  const getFullLinkUrl = (linkId: string) => {
    // 客户端运行在3001端口，不是管理端的3000端口
    return `http://localhost:3001?link_id=${linkId}`;
  };

  // 过滤规则：只显示当前选中账号的规则
  const filteredRules = rules.filter(rule => {
    // 如果有选中的账号，只显示该账号的规则
    if (selectedAccount && rule.account_id !== selectedAccount.id) {
      return false;
    }
    
    // 搜索过滤
    return rule.rule_name.toLowerCase().includes(searchText.toLowerCase()) ||
           rule.account_id.toString().includes(searchText.toLowerCase()) ||
           rule.sender_pattern.toLowerCase().includes(searchText.toLowerCase());
  });

  const columns = [
    {
      title: '规则名称',
      dataIndex: 'rule_name',
      key: 'rule_name',
      width: 150
    },
    {
      title: '账号信息',
      key: 'account_info',
      width: 200,
      render: (_, record: SmsRule) => {
        const account = accounts.find(a => a.id === record.account_id);
        if (account) {
          return (
            <div>
              <div>{account.account_name || '未知账号'}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                {account.type || '未知类型'} 
                {account.status === 'active' ? (
                  <Tag color="green" style={{ marginLeft: 4 }}>活跃</Tag>
                ) : (
                  <Tag color="red" style={{ marginLeft: 4 }}>非活跃</Tag>
                )}
              </div>
            </div>
          );
        }
        return <span>账号ID: {record.account_id}</span>;
      }
    },
    {
      title: '发送方匹配',
      key: 'sender_match',
      width: 180,
      render: (_, record: SmsRule) => (
        <div>
          <div>{record.sender_pattern || '任意发送方'}</div>
          <Tag color="blue">
            {record.sender_match_type === 'exact' ? '精确' : 
             record.sender_match_type === 'fuzzy' ? '模糊' : '正则'}
          </Tag>
        </div>
      )
    },
    {
      title: '内容匹配',
      key: 'content_match',
      width: 200,
      render: (_, record: SmsRule) => (
        <div>
          <Tooltip title={record.content_pattern}>
            <div style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {record.content_pattern}
            </div>
          </Tooltip>
          <Tag color="green">
            {record.content_match_type === 'exact' ? '精确' : 
             record.content_match_type === 'fuzzy' ? '模糊' : '正则'}
          </Tag>
        </div>
      )
    },
    {
      title: '转发目标',
      key: 'forward_target',
      width: 180,
      render: (_, record: SmsRule) => {
        // 默认转发到所有客户链接
        if (record.forward_target_type === 'link' || !record.forward_target_type) {
          return (
            <div>
              <Tag color="cyan" icon={<LinkOutlined />}>所有客户链接</Tag>
              <div style={{ fontSize: '12px', color: '#666' }}>
                自动转发到该账号的所有客户访问链接
              </div>
            </div>
          );
        } else if (record.forward_target_type === 'webhook') {
          return (
            <div>
              <Tag color="orange" icon={<LinkOutlined />}>Webhook转发</Tag>
              <div style={{ fontSize: '12px', color: '#666' }}>
                转发到指定Webhook地址
              </div>
            </div>
          );
        } else if (record.forward_target_type === 'email') {
          return (
            <div>
              <Tag color="purple">邮件转发</Tag>
              <div style={{ fontSize: '12px', color: '#666' }}>
                转发到指定邮箱地址
              </div>
            </div>
          );
        }
        return (
          <div>
            <Tag color="cyan" icon={<LinkOutlined />}>所有客户链接</Tag>
            <div style={{ fontSize: '12px', color: '#666' }}>
              自动转发到该账号的所有客户访问链接
            </div>
          </div>
        );
      }
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: (isActive: boolean, record: SmsRule) => (
        <Switch
          checked={isActive}
          onChange={(checked) => handleToggleActive(record.id, checked)}
          size="small"
        />
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (text: string) => new Date(text).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record: SmsRule) => (
        <Space size="small">
          <Tooltip title="手动发送">
            <Button
              type="link"
              size="small"
              icon={<SendOutlined />}
              onClick={() => handleManualForward(record.id)}
              disabled={!record.is_active}
            >
              发送
            </Button>
          </Tooltip>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              Modal.confirm({
                title: '确认删除',
                content: '确定要删除这条规则吗？',
                onOk: () => handleDelete(record.id)
              });
            }}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Title level={4}>
            <SettingOutlined /> 短信规则管理
          </Title>
        </div>

        {/* 操作栏 */}
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Space>
            <Input
              placeholder="搜索规则名称、账号ID或发送方"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 300 }}
              prefix={<SearchOutlined />}
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchRules}
            >
              刷新
            </Button>
          </Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
          >
            新增规则
          </Button>
        </div>

        {/* 数据表格 */}
        <Table
          columns={columns}
          dataSource={filteredRules}
          rowKey="id"
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `第 ${range[0]}-${range[1]} 条/共 ${total} 条`
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* 新增/编辑模态框 */}
      <Modal
        title={editingRule ? '编辑短信规则' : '新增短信规则'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="rule_name"
            label="规则名称"
            rules={[{ required: true, message: '请输入规则名称' }]}
          >
            <Input placeholder="请输入规则名称" />
          </Form.Item>

          {/* 隐藏的账号ID字段 */}
          <Form.Item
            name="account_id"
            style={{ display: 'none' }}
          >
            <Input type="hidden" />
          </Form.Item>

          {/* 显示当前选中的账号信息 */}
          {selectedAccount && (
            <div style={{ 
              padding: '16px', 
              backgroundColor: '#f8fafc', 
              borderRadius: '8px', 
              marginBottom: '16px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '12px'
              }}>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b' }}>
                  当前账号详情
                </div>
                <Button
                  type="link"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={showAccountDetail}
                >
                  查看详情
                </Button>
              </div>
              
              <Row gutter={16}>
                <Col span={12}>
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {selectedAccount.image_url ? (
                        <img 
                          src={selectedAccount.image_url} 
                          alt="头像" 
                          style={{ 
                            width: '32px', 
                            height: '32px', 
                            borderRadius: '50%', 
                            marginRight: '8px',
                            objectFit: 'cover'
                          }} 
                        />
                      ) : (
                        <UserOutlined style={{ 
                          fontSize: '32px', 
                          marginRight: '8px', 
                          color: '#1890ff',
                          backgroundColor: '#f0f0f0',
                          padding: '4px',
                          borderRadius: '50%'
                        }} />
                      )}
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                          {selectedAccount.account_name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {selectedAccount.type || '未知类型'}
                        </div>
                      </div>
                    </div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ textAlign: 'right' }}>
                    <Tag 
                      color={selectedAccount.status === 'active' ? 'green' : 'red'}
                      style={{ marginBottom: '4px' }}
                    >
                      {selectedAccount.status === 'active' ? '活跃' : '非活跃'}
                    </Tag>
                    {selectedAccount.primary_device && (
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        <MobileOutlined style={{ marginRight: '4px' }} />
                        {selectedAccount.primary_device.phone_number}
                      </div>
                    )}
                  </div>
                </Col>
              </Row>
            </div>
          )}

          <Row gutter={16}>
            <Col span={16}>
              <Form.Item
                name="sender_pattern"
                label="发送方匹配模式"
              >
                <Input placeholder="请输入发送方匹配模式（可选）" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="sender_match_type"
                label="发送方匹配类型"
                rules={[{ required: true, message: '请选择匹配类型' }]}
                initialValue="fuzzy"
              >
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
              <Form.Item
                name="content_pattern"
                label="内容匹配模式"
                rules={[{ required: true, message: '请输入内容匹配模式' }]}
              >
                <TextArea
                  rows={3}
                  placeholder="请输入内容匹配模式"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="content_match_type"
                label="内容匹配类型"
                rules={[{ required: true, message: '请选择匹配类型' }]}
                initialValue="fuzzy"
              >
                <Select placeholder="匹配类型">
                  <Option value="exact">精确匹配</Option>
                  <Option value="fuzzy">模糊匹配</Option>
                  <Option value="regex">正则表达式</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* 转发目标说明 */}
          <div style={{ 
            padding: '12px', 
            backgroundColor: '#f0f9ff', 
            borderRadius: '6px', 
            marginBottom: '16px',
            border: '1px solid #bae6fd'
          }}>
            <div style={{ fontSize: '14px', color: '#0369a1', marginBottom: '4px' }}>
              <LinkOutlined style={{ marginRight: '8px' }} />
              转发规则说明：
            </div>
            <div style={{ fontSize: '13px', color: '#0c4a6e' }}>
              短信将自动转发到该账号的所有客户访问链接，无需手动选择具体链接
            </div>
          </div>

          {/* 隐藏的转发类型字段 */}
          <Form.Item
            name="forward_target_type"
            style={{ display: 'none' }}
          >
            <Input type="hidden" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="priority"
                label="优先级"
                rules={[{ required: true, message: '请输入优先级' }]}
                initialValue={0}
              >
                <Input type="number" placeholder="请输入优先级（数字越大优先级越高）" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="display_count"
                label="显示条数"
                rules={[{ required: true, message: '请输入显示条数' }]}
                initialValue={5}
                tooltip="设置客户端页面显示多少条匹配的短信，最新的短信会显示在最上面"
              >
                <Input 
                  type="number" 
                  min={1} 
                  max={50} 
                  placeholder="请输入显示条数（1-50）" 
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="is_active"
            label="启用状态"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* 账号详情模态框 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <UserOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
            账号详细信息
          </div>
        }
        open={accountDetailModalVisible}
        onCancel={() => setAccountDetailModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedAccount && (
          <div>
            {/* 设备信息 */}
            <Card 
              title={
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <MobileOutlined style={{ marginRight: '8px', color: '#52c41a' }} />
                  设备信息
                </div>
              }
              size="small"
              style={{ marginBottom: '16px' }}
            >
              {selectedAccount.primary_device ? (
                <Row gutter={16}>
                  <Col span={6}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>设备ID</div>
                      <div style={{ fontWeight: 'bold' }}>{selectedAccount.primary_device.device_id}</div>
                    </div>
                  </Col>
                  <Col span={6}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>设备信息</div>
                      <div style={{ fontWeight: 'bold' }}>
                        {selectedAccount.primary_device.brand} {selectedAccount.primary_device.model}
                      </div>
                    </div>
                  </Col>
                  <Col span={6}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>手机号码</div>
                      <div style={{ fontWeight: 'bold' }}>{selectedAccount.primary_device.phone_number}</div>
                    </div>
                  </Col>
                  <Col span={6}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>状态</div>
                      <Tag 
                        color={selectedAccount.primary_device.is_online ? 'green' : 'red'}
                        icon={selectedAccount.primary_device.is_online ? <WifiOutlined /> : <DisconnectOutlined />}
                      >
                        {selectedAccount.primary_device.is_online ? '在线' : '离线'}
                      </Tag>
                    </div>
                  </Col>
                </Row>
              ) : (
                <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                  暂无绑定设备
                </div>
              )}
            </Card>

            {/* 账号信息 */}
            <Card 
              title={
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <UserOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                  账号信息
                </div>
              }
              size="small"
              style={{ marginBottom: '16px' }}
            >
              <Row gutter={16}>
                <Col span={4}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>账号缩略图</div>
                    {selectedAccount.image_url ? (
                      <img 
                        src={selectedAccount.image_url} 
                        alt="头像" 
                        style={{ 
                          width: '60px', 
                          height: '60px', 
                          borderRadius: '8px', 
                          objectFit: 'cover',
                          border: '2px solid #f0f0f0'
                        }} 
                      />
                    ) : (
                      <div style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '8px',
                        backgroundColor: '#f0f0f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto'
                      }}>
                        <UserOutlined style={{ fontSize: '24px', color: '#999' }} />
                      </div>
                    )}
                  </div>
                </Col>
                <Col span={5}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>账号名称</div>
                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{selectedAccount.account_name}</div>
                  </div>
                </Col>
                <Col span={5}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>用户名</div>
                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                      {selectedAccount.username || '未设置'}
                    </div>
                  </div>
                </Col>
                <Col span={5}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>密码</div>
                    <div style={{ fontWeight: 'bold', fontSize: '14px', fontFamily: 'monospace' }}>
                      {selectedAccount.password || '未设置'}
                    </div>
                  </div>
                </Col>
                <Col span={5}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>服务类型</div>
                    <Tag color="blue">{selectedAccount.type || '未知类型'}</Tag>
                  </div>
                </Col>
              </Row>
            </Card>

            {/* 链接信息 */}
            <Card 
              title={
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <LinkOutlined style={{ marginRight: '8px', color: '#722ed1' }} />
                  链接信息 ({accountLinks.length} 个链接)
                </div>
              }
              size="small"
            >
              {accountLinks.length > 0 ? (
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {accountLinks.map((link, index) => {
                    const fullUrl = getFullLinkUrl(link.link_id);
                    return (
                      <div 
                        key={link.id}
                        style={{ 
                          padding: '12px',
                          marginBottom: '8px',
                          backgroundColor: '#fafafa',
                          borderRadius: '6px',
                          border: '1px solid #f0f0f0'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                              链接 #{index + 1}
                            </div>
                            <div style={{ 
                              fontFamily: 'monospace', 
                              fontSize: '13px',
                              backgroundColor: '#fff',
                              padding: '6px 8px',
                              borderRadius: '4px',
                              border: '1px solid #e8e8e8',
                              wordBreak: 'break-all'
                            }}>
                              {fullUrl}
                            </div>
                          </div>
                          <div style={{ marginLeft: '12px' }}>
                            <Space>
                              <Button
                                type="primary"
                                size="small"
                                icon={<CopyOutlined />}
                                onClick={() => copyToClipboard(fullUrl)}
                              >
                                复制
                              </Button>
                              <Button
                                size="small"
                                onClick={() => window.open(fullUrl, '_blank')}
                              >
                                打开
                              </Button>
                            </Space>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
                  <LinkOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
                  <div>该账号暂无客户访问链接</div>
                </div>
              )}
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SmsRules;
