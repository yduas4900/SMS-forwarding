// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Select,
  Table,
  Button,
  Input,
  Space,
  Tag,
  message,
  Row,
  Col,
  Statistic,
  Typography,
  Avatar,
  Tooltip,
  DatePicker,
  Empty,
  Spin,
  Tabs,
  Badge
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  UserOutlined,
  MobileOutlined,
  WifiOutlined,
  DisconnectOutlined,
  CopyOutlined,
  EyeOutlined,
  DeleteOutlined,
  MessageOutlined,
  HistoryOutlined,
  SettingOutlined,
  SendOutlined,
  SyncOutlined
} from '@ant-design/icons';
import { accountAPI, smsAPI } from '../../services/api';
import SmsForwardLogs from './SmsForwardLogs';
import SmsRules from './SmsRules';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

interface Account {
  id: number;
  account_name: string;
  username: string;
  password: string;
  type: string;
  image_url: string;
  status: string;
  primary_device_id: number;
  primary_device?: {
    id: number;
    device_id: string;
    brand: string;
    model: string;
    phone_number: string;
    is_online: boolean;
  };
}

interface SMS {
  id: number;
  sender: string;
  content: string;
  sms_timestamp: string;
  category: string;
  verification_code?: string;
  account_info?: {
    id: number;
    account_name: string;
    username: string;
    type: string;
  };
}

interface Device {
  id: number;
  device_id: string;
  brand: string;
  model: string;
  phone_number: string;
  is_online: boolean;
}

const SmsManagementByAccount: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<Device | null>(null);
  const [smsData, setSmsData] = useState<SMS[]>([]);
  const [loading, setLoading] = useState(false);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  // WebSocket相关状态
  const [wsConnected, setWsConnected] = useState(false);
  const [newSmsCount, setNewSmsCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 轮询机制状态
  const [pollingEnabled, setPollingEnabled] = useState(true);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 加载账号列表
  const loadAccounts = async () => {
    setAccountsLoading(true);
    try {
      const response: any = await accountAPI.getAccountList({ 
        page: 1, 
        page_size: 100 
      });
      if (response.success) {
        setAccounts(response.data.accounts);
      }
    } catch (error) {
      console.error('加载账号列表失败:', error);
      message.error('加载账号列表失败');
    } finally {
      setAccountsLoading(false);
    }
  };

  // 加载账号短信数据
  const loadAccountSms = async (accountId: number, page = 1) => {
    setLoading(true);
    try {
      const params: any = {
        page,
        page_size: pagination.pageSize,
      };

      if (searchText) params.search = searchText;
      if (categoryFilter) params.category = categoryFilter;
      if (dateRange) {
        params.start_date = dateRange[0].format('YYYY-MM-DD');
        params.end_date = dateRange[1].format('YYYY-MM-DD');
      }

      const response: any = await accountAPI.getAccountSms(accountId, params);
      if (response.success) {
        setSmsData(response.data.sms_list);
        setDeviceInfo(response.data.device_info);
        setPagination(prev => ({
          ...prev,
          current: response.data.pagination.page,
          total: response.data.pagination.total,
        }));
      }
    } catch (error) {
      console.error('加载短信数据失败:', error);
      message.error('加载短信数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理账号选择
  const handleAccountChange = (accountId: number) => {
    const account = accounts.find(acc => acc.id === accountId);
    if (account) {
      setSelectedAccount(account);
      loadAccountSms(accountId);
    }
  };

  // 处理搜索
  const handleSearch = () => {
    if (selectedAccount) {
      loadAccountSms(selectedAccount.id, 1);
    }
  };

  // 处理重置
  const handleReset = () => {
    setSearchText('');
    setCategoryFilter('');
    setDateRange(null);
    if (selectedAccount) {
      loadAccountSms(selectedAccount.id, 1);
    }
  };

  // 复制验证码
  const copyVerificationCode = (code: string) => {
    navigator.clipboard.writeText(code);
    message.success('验证码已复制到剪贴板');
  };

  // WebSocket连接管理
  const connectWebSocket = () => {
    try {
      // 获取认证token（尝试多个可能的存储key）
      const token = localStorage.getItem('token') || 
                   localStorage.getItem('access_token') || 
                   localStorage.getItem('authToken') ||
                   sessionStorage.getItem('token');
      
      // 简化WebSocket连接，不使用认证（因为后端支持匿名连接）
      const wsUrl = `ws://localhost:8000/api/ws/admin`;
      
      console.log('正在连接WebSocket:', wsUrl);
      console.log('使用token:', token ? '有token' : '无token');
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('WebSocket连接已建立');
        setWsConnected(true);
        setNewSmsCount(0);
        
        // 清除重连定时器
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        
        // 发送订阅消息
        ws.send(JSON.stringify({
          type: 'subscribe',
          events: ['sms_update', 'device_update']
        }));
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('收到WebSocket消息:', data);
          
          // 处理不同类型的消息
          switch (data.type) {
            case 'sms_update':
              handleSmsUpdate(data.data);
              break;
            case 'device_update':
              handleDeviceUpdate(data.data);
              break;
            default:
              console.log('未知的WebSocket消息类型:', data.type);
          }
        } catch (error) {
          console.error('解析WebSocket消息失败:', error);
        }
      };
      
      ws.onclose = () => {
        console.log('WebSocket连接已断开');
        setWsConnected(false);
        
        // 自动重连
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('尝试重新连接WebSocket...');
          connectWebSocket();
        }, 3000);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket连接错误:', error);
        setWsConnected(false);
      };
      
      wsRef.current = ws;
    } catch (error) {
      console.error('创建WebSocket连接失败:', error);
    }
  };

  // 处理短信更新
  const handleSmsUpdate = (data: any) => {
    console.log('处理短信更新:', data);
    
    // 检查是否是当前选中账号的设备
    if (selectedAccount && deviceInfo && data.device_internal_id === deviceInfo.id) {
      // 显示通知
      message.info(`收到 ${data.saved_count || 1} 条新短信`, 2);
      
      // 立即自动刷新数据，无论当前页面状态如何
      setTimeout(() => {
        loadAccountSms(selectedAccount.id, pagination.current);
        console.log('✅ 短信列表已自动刷新');
      }, 500);
    }
  };

  // 处理设备状态更新
  const handleDeviceUpdate = (data: any) => {
    console.log('处理设备状态更新:', data);
    
    // 更新设备在线状态
    if (deviceInfo && data.device_id === deviceInfo.device_id) {
      setDeviceInfo(prev => prev ? { ...prev, is_online: data.status === 'online' } : null);
    }
    
    // 更新账号列表中的设备状态
    setAccounts(prev => prev.map(account => {
      if (account.primary_device && account.primary_device.device_id === data.device_id) {
        return {
          ...account,
          primary_device: {
            ...account.primary_device,
            is_online: data.status === 'online'
          }
        };
      }
      return account;
    }));
  };

  // 断开WebSocket连接
  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    setWsConnected(false);
  };

  // 删除短信
  const handleDeleteSms = async (smsId: number) => {
    try {
      await smsAPI.deleteSms(smsId);
      message.success('短信删除成功');
      if (selectedAccount) {
        loadAccountSms(selectedAccount.id, pagination.current);
      }
    } catch (error) {
      console.error('删除短信失败:', error);
      message.error('删除短信失败');
    }
  };

  // 手动发送短信
  const handleManualForward = async (smsId: number) => {
    try {
      const response: any = await smsAPI.manualForward(smsId);
      if (response.success) {
        message.success(response.message);
        // 显示转发详情
        const { data } = response;
        message.info(
          `转发内容：账号 ${data.forward_content.account_name}，用户名 ${data.forward_content.username}，密码 ${data.forward_content.password}，短信内容：${data.forward_content.sms_content}`,
          10
        );
      } else {
        message.warning(response.message);
      }
    } catch (error) {
      console.error('手动发送失败:', error);
      message.error('手动发送失败');
    }
  };

  // 获取分类标签颜色
  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'verification': 'orange',
      'notification': 'blue',
      'advertisement': 'green',
      'other': 'default'
    };
    return colors[category] || 'default';
  };

  // 获取分类标签文本
  const getCategoryText = (category: string) => {
    const texts: { [key: string]: string } = {
      'verification': '验证码',
      'notification': '通知',
      'advertisement': '广告',
      'other': '其他'
    };
    return texts[category] || category;
  };

  // 提取验证码
  const extractVerificationCode = (content: string) => {
    const patterns = [
      /验证码[：:\s]*(\d{4,8})/,
      /verification code[：:\s]*(\d{4,8})/i,
      /code[：:\s]*(\d{4,8})/i,
      /(\d{4,8})[^0-9]*验证码/,
      /【.*】.*?(\d{4,8})/,
      /(?:验证码|code|密码)[^0-9]*(\d{4,8})/i
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return null;
  };

  // 表格列定义
  const columns: ColumnsType<SMS> = [
    {
      title: '发送方',
      dataIndex: 'sender',
      key: 'sender',
      width: 150,
      render: (sender: string) => (
        <Text strong>{sender}</Text>
      ),
    },
    {
      title: '短信内容',
      dataIndex: 'content',
      key: 'content',
      render: (content: string, record: SMS) => {
        const verificationCode = extractVerificationCode(content);
        return (
          <div>
            <div style={{ marginBottom: 8 }}>
              {content}
            </div>
            {verificationCode && (
              <Tag
                color="orange"
                style={{ cursor: 'pointer' }}
                onClick={() => copyVerificationCode(verificationCode)}
                icon={<CopyOutlined />}
              >
                验证码: {verificationCode}
              </Tag>
            )}
          </div>
        );
      },
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (category: string) => (
        <Tag color={getCategoryColor(category)}>
          {getCategoryText(category)}
        </Tag>
      ),
    },
    {
      title: '接收时间',
      dataIndex: 'sms_timestamp',
      key: 'sms_timestamp',
      width: 180,
      render: (timestamp: string) => (
        <Text>{dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss')}</Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, record: SMS) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              size="small"
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteSms(record.id);
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // 启动轮询机制
  const startPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    if (selectedAccount && pollingEnabled) {
      pollingIntervalRef.current = setInterval(() => {
        loadAccountSms(selectedAccount.id, pagination.current);
        console.log('🔄 自动轮询刷新短信列表');
      }, 2000); // 每2秒轮询一次，更快响应
      
      console.log('✅ 启动自动轮询机制（每2秒刷新）');
    }
  };

  // 停止轮询机制
  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log('⏹️ 停止自动轮询机制');
    }
  };

  // 组件生命周期管理
  useEffect(() => {
    loadAccounts();
    // 🔥 禁用WebSocket连接，避免连接错误影响性能
    // connectWebSocket();
    
    // 组件卸载时清理WebSocket连接和轮询
    return () => {
      // disconnectWebSocket();
      stopPolling();
    };
  }, []);

  // 当选中账号变化时，重置新短信计数并启动轮询
  useEffect(() => {
    setNewSmsCount(0);
    
    if (selectedAccount) {
      // 启动轮询机制确保实时更新
      startPolling();
    } else {
      // 停止轮询
      stopPolling();
    }
    
    // 清理函数
    return () => {
      stopPolling();
    };
  }, [selectedAccount, pollingEnabled]);

  return (
    <div style={{ padding: '24px' }}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card>
            <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
              <Col>
                <Space align="center">
                  <Title level={4} style={{ margin: 0 }}>
                    短信管理（账号维度）
                  </Title>
                  <Badge 
                    status={pollingEnabled ? "success" : "error"} 
                    text={pollingEnabled ? "自动刷新" : "手动模式"}
                  />
                  {wsConnected && (
                    <Badge 
                      status="processing" 
                      text="WebSocket连接"
                    />
                  )}
                  {newSmsCount > 0 && (
                    <Badge 
                      count={newSmsCount} 
                      style={{ backgroundColor: '#52c41a' }}
                    >
                      <Tag color="green">新短信</Tag>
                    </Badge>
                  )}
                </Space>
              </Col>
              <Col>
                <Space>
                  {newSmsCount > 0 && (
                    <Button
                      type="primary"
                      icon={<SyncOutlined />}
                      onClick={() => {
                        if (selectedAccount) {
                          loadAccountSms(selectedAccount.id, 1);
                          setNewSmsCount(0);
                        }
                      }}
                    >
                      查看新短信 ({newSmsCount})
                    </Button>
                  )}
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => {
                      loadAccounts();
                      if (selectedAccount) {
                        loadAccountSms(selectedAccount.id);
                        setNewSmsCount(0);
                      }
                    }}
                  >
                    手动刷新
                  </Button>
                  <Button
                    type={pollingEnabled ? "default" : "primary"}
                    icon={<SyncOutlined />}
                    onClick={() => {
                      setPollingEnabled(!pollingEnabled);
                      if (!pollingEnabled) {
                        console.log('✅ 启用自动刷新模式');
                      } else {
                        console.log('⏹️ 切换到手动模式');
                      }
                    }}
                  >
                    {pollingEnabled ? "关闭自动刷新" : "开启自动刷新"}
                  </Button>
                </Space>
              </Col>
            </Row>

            {/* 账号选择器 */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col span={8}>
                <Text strong>选择账号：</Text>
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  placeholder="请选择要查看短信的账号"
                  loading={accountsLoading}
                  onChange={handleAccountChange}
                  value={selectedAccount?.id}
                  showSearch
                  filterOption={(input, option) =>
                    (option?.children as unknown as string)
                      ?.toLowerCase()
                      .includes(input.toLowerCase())
                  }
                >
                  {accounts.map(account => (
                    <Option key={account.id} value={account.id}>
                      <Space>
                        <Avatar
                          size="small"
                          src={account.image_url}
                          icon={<UserOutlined />}
                        />
                        <span>{account.account_name}</span>
                        <Text type="secondary">({account.username})</Text>
                        {account.primary_device && (
                          <Tag
                            color={account.primary_device.is_online ? 'green' : 'red'}
                          >
                            {account.primary_device.is_online ? '在线' : '离线'}
                          </Tag>
                        )}
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Col>
            </Row>

            {/* 账号信息卡片 */}
            {selectedAccount && (
              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col span={24}>
                  <Card size="small" style={{ backgroundColor: '#f8f9fa' }}>
                    <Row gutter={[16, 16]} align="middle">
                      <Col>
                        <Avatar
                          size={48}
                          src={selectedAccount.image_url}
                          icon={<UserOutlined />}
                        />
                      </Col>
                      <Col flex={1}>
                        <Row gutter={[24, 8]}>
                          <Col>
                            <Statistic
                              title="账号名称"
                              value={selectedAccount.account_name}
                              valueStyle={{ fontSize: 16 }}
                            />
                          </Col>
                          <Col>
                            <Statistic
                              title="用户名"
                              value={selectedAccount.username || '-'}
                              valueStyle={{ fontSize: 16 }}
                            />
                          </Col>
                          <Col>
                            <Statistic
                              title="服务类型"
                              value={selectedAccount.type || '-'}
                              valueStyle={{ fontSize: 16 }}
                            />
                          </Col>
                          {deviceInfo && (
                            <>
                              <Col>
                                <Statistic
                                  title="绑定设备"
                                  value={`${deviceInfo.brand} ${deviceInfo.model}`}
                                  valueStyle={{ fontSize: 16 }}
                                  prefix={<MobileOutlined />}
                                />
                              </Col>
                              <Col>
                                <Statistic
                                  title="设备状态"
                                  value={deviceInfo.is_online ? '在线' : '离线'}
                                  valueStyle={{
                                    fontSize: 16,
                                    color: deviceInfo.is_online ? '#52c41a' : '#ff4d4f'
                                  }}
                                  prefix={deviceInfo.is_online ? <WifiOutlined /> : <DisconnectOutlined />}
                                />
                              </Col>
                              <Col>
                                <Statistic
                                  title="手机号码"
                                  value={deviceInfo.phone_number || '-'}
                                  valueStyle={{ fontSize: 16 }}
                                />
                              </Col>
                            </>
                          )}
                        </Row>
                      </Col>
                    </Row>
                  </Card>
                </Col>
              </Row>
            )}

            {/* 筛选条件 */}
            {selectedAccount && (
              <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col span={6}>
                  <Input
                    placeholder="搜索发送方或内容"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    onPressEnter={handleSearch}
                    prefix={<SearchOutlined />}
                  />
                </Col>
                <Col span={4}>
                  <Select
                    placeholder="分类筛选"
                    value={categoryFilter}
                    onChange={setCategoryFilter}
                    style={{ width: '100%' }}
                    allowClear
                  >
                    <Option value="verification">验证码</Option>
                    <Option value="notification">通知</Option>
                    <Option value="advertisement">广告</Option>
                    <Option value="other">其他</Option>
                  </Select>
                </Col>
                <Col span={6}>
                  <RangePicker
                    value={dateRange}
                    onChange={setDateRange}
                    style={{ width: '100%' }}
                  />
                </Col>
                <Col span={8}>
                  <Space>
                    <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                      搜索
                    </Button>
                    <Button onClick={handleReset}>
                      重置
                    </Button>
                  </Space>
                </Col>
              </Row>
            )}

            {/* 标签页内容 */}
            {selectedAccount ? (
              <Tabs
                defaultActiveKey="sms"
                items={[
                  {
                    key: 'sms',
                    label: (
                      <span>
                        <MessageOutlined />
                        短信记录
                      </span>
                    ),
                    children: (
                      <Table
                        columns={columns}
                        dataSource={smsData}
                        rowKey="id"
                        loading={loading}
                        pagination={{
                          current: pagination.current,
                          pageSize: pagination.pageSize,
                          total: pagination.total,
                          showSizeChanger: true,
                          showQuickJumper: true,
                          showTotal: (total, range) =>
                            `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
                          onChange: (page, pageSize) => {
                            setPagination(prev => ({ ...prev, pageSize }));
                            loadAccountSms(selectedAccount.id, page);
                          },
                        }}
                        scroll={{ x: 1000 }}
                      />
                    ),
                  },
                  {
                    key: 'sms-rules',
                    label: (
                      <span>
                        <SettingOutlined />
                        短信规则
                      </span>
                    ),
                    children: <SmsRules selectedAccount={selectedAccount} />,
                  },
                  {
                    key: 'forward-logs',
                    label: (
                      <span>
                        <HistoryOutlined />
                        转发日志
                      </span>
                    ),
                    children: <SmsForwardLogs />,
                  },
                ]}
              />
            ) : (
              <Empty
                description="请先选择一个账号查看其短信记录"
                style={{ margin: '60px 0' }}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default SmsManagementByAccount;
