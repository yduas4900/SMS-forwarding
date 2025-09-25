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
  message,
  Tooltip,
  Typography,
  Row,
  Col,
  Statistic,
  Progress
} from 'antd';
import {
  HistoryOutlined,
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  FilterOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  SendOutlined,
  LinkOutlined,
  MailOutlined,
  GlobalOutlined,
  RetweetOutlined
} from '@ant-design/icons';
import { smsForwardAPI, smsAPI, smsRuleAPI } from '../../services/api';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Title } = Typography;

interface ForwardLog {
  id: number;
  sms_id: number;
  rule_id: number;
  target_type: string;
  target_id: number;
  status: 'pending' | 'success' | 'failed';
  error_message?: string;
  forwarded_at?: string;
  created_at: string;
  updated_at: string;
  sms?: {
    id: number;
    sender: string;
    content: string;
    device_id: string;
    received_at: string;
  };
  rule?: {
    id: number;
    rule_name: string;
    device_id: number;
  };
}

interface ForwardStatistics {
  total_forwards: number;
  successful_forwards: number;
  failed_forwards: number;
  pending_forwards: number;
  success_rate: number;
}

const SmsForwardLogs: React.FC = () => {
  const [logs, setLogs] = useState<ForwardLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState<ForwardStatistics>({
    total_forwards: 0,
    successful_forwards: 0,
    failed_forwards: 0,
    pending_forwards: 0,
    success_rate: 0
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    status: '',
    target_type: '',
    date_range: null as any,
    search: ''
  });
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ForwardLog | null>(null);

  const fetchForwardLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {
        page: pagination.current,
        page_size: pagination.pageSize,
      };

      if (filters.status) {
        params.status = filters.status;
      }
      if (filters.target_type) {
        params.target_type = filters.target_type;
      }
      if (filters.search) {
        params.search = filters.search;
      }
      if (filters.date_range && filters.date_range.length === 2) {
        params.start_date = filters.date_range[0].format('YYYY-MM-DD');
        params.end_date = filters.date_range[1].format('YYYY-MM-DD');
      }

      const response = await smsForwardAPI.getForwardLogs(params);
      const logsData = response.data?.logs || [];
      const paginationData = response.data?.pagination || {};

      setLogs(logsData);
      setPagination(prev => ({
        ...prev,
        total: paginationData.total || 0
      }));
    } catch (error: any) {
      console.error('获取转发日志失败:', error);
      message.error('获取转发日志失败: ' + (error.response?.data?.detail || error.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchStatistics = async () => {
    try {
      const response = await smsForwardAPI.getForwardStatistics();
      const statsData = response.data || {};
      setStatistics(statsData);
    } catch (error: any) {
      console.error('获取转发统计失败:', error);
    }
  };

  useEffect(() => {
    fetchForwardLogs();
    fetchStatistics();
  }, [pagination.current, pagination.pageSize, fetchForwardLogs]);

  const handleTableChange = (paginationConfig: any) => {
    setPagination({
      ...pagination,
      current: paginationConfig.current,
      pageSize: paginationConfig.pageSize
    });
  };

  const handleSearch = () => {
    setPagination({ ...pagination, current: 1 });
    fetchForwardLogs();
  };

  const handleReset = () => {
    setFilters({
      status: '',
      target_type: '',
      date_range: null,
      search: ''
    });
    setPagination({ ...pagination, current: 1 });
  };

  const handleViewDetail = (record: ForwardLog) => {
    setSelectedLog(record);
    setDetailModalVisible(true);
  };

  const handleRetryForward = async (logId: number) => {
    try {
      await smsForwardAPI.retryForward(logId);
      message.success('重试转发请求已提交');
      fetchForwardLogs();
      fetchStatistics();
    } catch (error: any) {
      message.error('重试失败: ' + (error.message || '未知错误'));
    }
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'success':
        return <Tag color="success" icon={<CheckCircleOutlined />}>转发成功</Tag>;
      case 'failed':
        return <Tag color="error" icon={<CloseCircleOutlined />}>转发失败</Tag>;
      case 'pending':
        return <Tag color="processing" icon={<ClockCircleOutlined />}>等待转发</Tag>;
      default:
        return <Tag color="default">{status}</Tag>;
    }
  };

  const getTargetTypeIcon = (targetType: string) => {
    switch (targetType) {
      case 'link':
        return <LinkOutlined style={{ color: '#1890ff' }} />;
      case 'webhook':
        return <GlobalOutlined style={{ color: '#52c41a' }} />;
      case 'email':
        return <MailOutlined style={{ color: '#fa8c16' }} />;
      default:
        return <SendOutlined />;
    }
  };

  const getTargetTypeName = (targetType: string) => {
    switch (targetType) {
      case 'link':
        return '客户链接';
      case 'webhook':
        return 'Webhook';
      case 'email':
        return '邮件';
      default:
        return targetType;
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80
    },
    {
      title: '短信信息',
      key: 'sms_info',
      width: 200,
      render: (_, record: ForwardLog) => (
        <div>
          <div><strong>发送方:</strong> {record.sms?.sender || 'N/A'}</div>
          <div><strong>设备:</strong> {record.sms?.device_id || 'N/A'}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {record.sms?.content ? 
              (record.sms.content.length > 30 ? 
                record.sms.content.substring(0, 30) + '...' : 
                record.sms.content
              ) : 'N/A'
            }
          </div>
        </div>
      )
    },
    {
      title: '转发规则',
      key: 'rule_info',
      width: 150,
      render: (_, record: ForwardLog) => (
        <div>
          <div><strong>规则:</strong> {record.rule?.rule_name || 'N/A'}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            规则ID: {record.rule_id}
          </div>
        </div>
      )
    },
    {
      title: '转发目标',
      key: 'target_info',
      width: 120,
      render: (_, record: ForwardLog) => (
        <Space>
          {getTargetTypeIcon(record.target_type)}
          <span>{getTargetTypeName(record.target_type)}</span>
        </Space>
      )
    },
    {
      title: '转发状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => getStatusTag(status)
    },
    {
      title: '转发时间',
      dataIndex: 'forwarded_at',
      key: 'forwarded_at',
      width: 180,
      render: (text: string) => text ? new Date(text).toLocaleString() : '-'
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => new Date(text).toLocaleString()
    },
    {
      title: '错误信息',
      dataIndex: 'error_message',
      key: 'error_message',
      width: 200,
      ellipsis: true,
      render: (text: string) => text ? (
        <Tooltip title={text}>
          <span style={{ color: '#ff4d4f' }}>{text.substring(0, 50)}...</span>
        </Tooltip>
      ) : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record: ForwardLog) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            查看
          </Button>
          {record.status === 'failed' && (
            <Button
              type="link"
              size="small"
              icon={<RetweetOutlined />}
              onClick={() => handleRetryForward(record.id)}
            >
              重试
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总转发次数"
              value={statistics.total_forwards}
              prefix={<SendOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="成功转发"
              value={statistics.successful_forwards}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="失败转发"
              value={statistics.failed_forwards}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <div>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: '14px', color: '#666' }}>成功率</span>
              </div>
              <Progress
                type="circle"
                size={80}
                percent={Math.round(statistics.success_rate)}
                format={percent => `${percent}%`}
              />
            </div>
          </Card>
        </Col>
      </Row>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <Title level={4}>
            <HistoryOutlined /> 转发日志
          </Title>
        </div>

        {/* 搜索筛选区域 */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space wrap>
            <Input
              placeholder="搜索短信内容或发送方"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              style={{ width: 200 }}
            />
            <Select
              placeholder="转发状态"
              value={filters.status}
              onChange={(value) => setFilters({ ...filters, status: value })}
              style={{ width: 120 }}
              allowClear
            >
              <Option value="success">成功</Option>
              <Option value="failed">失败</Option>
              <Option value="pending">等待中</Option>
            </Select>
            <Select
              placeholder="目标类型"
              value={filters.target_type}
              onChange={(value) => setFilters({ ...filters, target_type: value })}
              style={{ width: 120 }}
              allowClear
            >
              <Option value="link">客户链接</Option>
              <Option value="webhook">Webhook</Option>
              <Option value="email">邮件</Option>
            </Select>
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
              onClick={() => {
                fetchForwardLogs();
                fetchStatistics();
              }}
            >
              刷新
            </Button>
          </Space>
        </Card>

        {/* 数据表格 */}
        <Table
          columns={columns}
          dataSource={logs}
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
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* 详情模态框 */}
      <Modal
        title="转发日志详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
          selectedLog?.status === 'failed' && (
            <Button
              key="retry"
              type="primary"
              icon={<RetweetOutlined />}
              onClick={() => {
                handleRetryForward(selectedLog.id);
                setDetailModalVisible(false);
              }}
            >
              重试转发
            </Button>
          )
        ].filter(Boolean)}
        width={800}
      >
        {selectedLog && (
          <div>
            <Row gutter={16}>
              <Col span={12}>
                <h4>基本信息</h4>
                <p><strong>日志ID:</strong> {selectedLog.id}</p>
                <p><strong>短信ID:</strong> {selectedLog.sms_id}</p>
                <p><strong>规则ID:</strong> {selectedLog.rule_id}</p>
                <p><strong>转发状态:</strong> {getStatusTag(selectedLog.status)}</p>
                <p><strong>目标类型:</strong> 
                  <Space>
                    {getTargetTypeIcon(selectedLog.target_type)}
                    {getTargetTypeName(selectedLog.target_type)}
                  </Space>
                </p>
                <p><strong>目标ID:</strong> {selectedLog.target_id}</p>
              </Col>
              <Col span={12}>
                <h4>时间信息</h4>
                <p><strong>创建时间:</strong> {new Date(selectedLog.created_at).toLocaleString()}</p>
                <p><strong>更新时间:</strong> {new Date(selectedLog.updated_at).toLocaleString()}</p>
                <p><strong>转发时间:</strong> {selectedLog.forwarded_at ? new Date(selectedLog.forwarded_at).toLocaleString() : '未转发'}</p>
              </Col>
            </Row>

            {selectedLog.sms && (
              <div style={{ marginTop: 16 }}>
                <h4>短信信息</h4>
                <p><strong>发送方:</strong> {selectedLog.sms.sender}</p>
                <p><strong>设备ID:</strong> {selectedLog.sms.device_id}</p>
                <p><strong>接收时间:</strong> {new Date(selectedLog.sms.received_at).toLocaleString()}</p>
                <p><strong>短信内容:</strong></p>
                <div style={{ 
                  background: '#f5f5f5', 
                  padding: '12px', 
                  borderRadius: '4px',
                  marginTop: '8px',
                  whiteSpace: 'pre-wrap'
                }}>
                  {selectedLog.sms.content}
                </div>
              </div>
            )}

            {selectedLog.rule && (
              <div style={{ marginTop: 16 }}>
                <h4>转发规则</h4>
                <p><strong>规则名称:</strong> {selectedLog.rule.rule_name}</p>
                <p><strong>设备ID:</strong> {selectedLog.rule.device_id}</p>
              </div>
            )}

            {selectedLog.error_message && (
              <div style={{ marginTop: 16 }}>
                <h4>错误信息</h4>
                <div style={{ 
                  background: '#fff2f0', 
                  border: '1px solid #ffccc7',
                  padding: '12px', 
                  borderRadius: '4px',
                  color: '#a8071a'
                }}>
                  {selectedLog.error_message}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SmsForwardLogs;
