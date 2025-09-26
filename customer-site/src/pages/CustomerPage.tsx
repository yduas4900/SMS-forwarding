// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Card,
  Button,
  Typography,
  Avatar,
  Space,
  Tag,
  Spin,
  Alert,
  Divider,
  Row,
  Col,
  message,
  Progress,
  ConfigProvider
} from 'antd';
import {
  UserOutlined,
  MobileOutlined,
  CopyOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined
} from '@ant-design/icons';
import zhCN from 'antd/locale/zh_CN';
import 'antd/dist/reset.css';
import axios from 'axios';
import API_BASE_URL from '../config/api';

const { Title, Text, Paragraph } = Typography;

interface AccountInfo {
  id: number;
  account_name: string;
  username: string;
  password: string;
  service_type: string;
  avatar_url?: string;
  verification_codes: VerificationCode[];
}

interface VerificationCode {
  id: number;
  code: string;
  received_at: string;
  is_used: boolean;
  progressive_index?: number;
  full_content?: string;
  sender?: string;
}

interface LinkInfo {
  id: number;
  link_id: string;
  access_count: number;
  max_access_count: number;
  max_verification_count: number;
  verification_count?: number;  // 🔥 新增：服务器端的真实验证码获取次数
  access_session_interval?: number;
  verification_wait_time?: number;
  created_at: string;
}

interface SmsSlot {
  index: number;
  countdown: number;
  status: 'waiting' | 'retrieving' | 'completed';
  sms?: VerificationCode;
  message: string;
}

const CustomerPage: React.FC = () => {
  const { linkId } = useParams<{ linkId: string }>();
  const [searchParams] = useSearchParams();
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  
  // 🔥 新增：渐进式获取短信的状态 - 每条短信独立倒计时
  const [progressiveRetrievalState, setProgressiveRetrievalState] = useState<{
    isActive: boolean;
    totalCount: number;
    smsSlots: SmsSlot[];
    retrievedSmsIds: Set<number>;
  }>({
    isActive: false,
    totalCount: 0,
    smsSlots: [],
    retrievedSmsIds: new Set()
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 获取链接ID（从URL参数或查询参数）
  const currentLinkId = linkId || searchParams.get('link_id');

  // 获取账号信息
  const fetchAccountInfo = async () => {
    if (!currentLinkId) {
      setError('缺少链接ID参数');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/get_account_info`, {
        params: { link_id: currentLinkId }
      });

      if (response.data.success) {
        const accountData = response.data.data.account_info;
        const linkData = response.data.data.link_info;
        
        console.log('🔍 API返回的完整响应:', response.data);
        console.log('🔍 API返回的账号数据:', accountData);
        console.log('🔍 API返回的链接数据:', linkData);
        console.log('🔍 账号ID:', accountData.id);
        
        if (!accountData.id) {
          console.error('❌ 账号ID为空或undefined:', accountData);
          setError('账号数据异常：缺少账号ID');
          return;
        }
        
        setAccountInfo({
          id: accountData.id,
          account_name: accountData.account_name,
          username: accountData.username,
          password: accountData.password,
          service_type: accountData.type || '未知服务',
          avatar_url: accountData.image_url,
          verification_codes: accountData.verification_codes || []
        });
        
        setLinkInfo(linkData);
        setAccessDenied(false);
        setError(null);
        setLastRefresh(new Date());
      } else {
        if (response.data.error === 'access_limit_exceeded') {
          setAccessDenied(true);
          setLinkInfo(response.data.link_info);
        } else {
          setError(response.data.message || '获取账号信息失败');
        }
      }
    } catch (err: any) {
      console.error('获取账号信息失败:', err);
      if (err.response?.status === 403) {
        setAccessDenied(true);
        if (err.response.data?.link_info) {
          setLinkInfo(err.response.data.link_info);
        }
      } else {
        setError(err.response?.data?.message || '网络请求失败');
      }
    } finally {
      setLoading(false);
    }
  };

  // 🔥 开始渐进式获取短信 - 为每条短信创建独立倒计时
  const startProgressiveRetrieval = useCallback(async () => {
    if (!accountInfo || !linkInfo || progressiveRetrievalState.isActive) return;

    console.log('🚀 开始渐进式获取短信流程');
    
    try {
      // 🔥 修复：使用accountInfo.id而不是linkInfo.account_id
      const accountId = accountInfo.id;
      console.log('🔍 使用账号ID:', accountId);
      
      if (!accountId) {
        console.error('❌ 账号ID无效:', accountId);
        setError('账号ID无效，无法获取短信规则');
        return;
      }
      
      // 获取短信规则配置
      const rulesResponse = await fetch(`${API_BASE_URL}/api/sms_rules?account_id=${accountId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('📋 短信规则API响应状态:', rulesResponse.status);
      const rulesData = await rulesResponse.json();
      console.log('📋 短信规则API完整响应:', JSON.stringify(rulesData, null, 2));

      if (!rulesData.success || !rulesData.data || rulesData.data.length === 0) {
        console.error('❌ 短信规则API返回失败或无数据:', rulesData);
        setError('获取短信规则失败');
        return;
      }

      const rule = rulesData.data[0];
      const displayCount = rule.display_count || 5;
      
      // 🔥 修复：完全使用用户设置的验证码等待时间，不使用任何硬编码默认值
      const waitTime = linkInfo.verification_wait_time;
      
      if (!waitTime) {
        console.error('❌ 验证码等待时间未设置:', linkInfo);
        setError('验证码等待时间未配置，请联系管理员设置');
        return;
      }
      
      console.log('📊 从数据库获取真实显示条数:', displayCount, '(规则:', rule.rule_name, ')');
      console.log('⏰ 使用用户设置的验证码等待时间:', waitTime, '秒');

      // 🔥 为每条短信创建独立的倒计时槽位 - 完全使用用户设置的时间间隔
      // 第1条短信：waitTime秒，第2条短信：waitTime*2秒，第3条短信：waitTime*3秒...
      const smsSlots: SmsSlot[] = Array.from({ length: displayCount }, (_, index) => ({
        index: index + 1,
        countdown: (index + 1) * waitTime, // 递增倒计时：使用用户设置的时间间隔
        status: 'waiting',
        sms: undefined,
        message: `正在等待第 ${index + 1} 条短信`
      }));

      // 初始化渐进式获取状态
      setProgressiveRetrievalState({
        isActive: true,
        totalCount: displayCount,
        smsSlots: smsSlots,
        retrievedSmsIds: new Set()
      });

      // 清空现有验证码
      setAccountInfo(prev => prev ? {
        ...prev,
        verification_codes: []
      } : null);

      console.log('⏰ 创建', displayCount, '个短信槽位，每个都有独立倒计时');
      message.success(`开始获取 ${displayCount} 条短信，每条都有独立倒计时`);

    } catch (error) {
      console.error('❌ 启动渐进式获取失败:', error);
      setError('启动获取流程失败');
    }
  }, [accountInfo, linkInfo, progressiveRetrievalState.isActive]);

  // 🔥 获取指定序号的短信
  const retrieveSpecificSms = useCallback(async (smsIndex: number) => {
    if (!currentLinkId) return;

    console.log(`🔍 正在获取第 ${smsIndex} 条短信...`);

    try {
      const response = await fetch(`${API_BASE_URL}/api/get_verification_code?link_id=${currentLinkId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log(`✅ 第 ${smsIndex} 条短信API响应:`, data);

      if (data.success && data.data?.all_matched_sms?.length > 0) {
        // 过滤掉已经获取过的短信，获取最新的
        const newSms = data.data.all_matched_sms.filter((sms: any) => 
          !progressiveRetrievalState.retrievedSmsIds.has(sms.id)
        );

        if (newSms.length > 0) {
          const latestSms = newSms[0]; // 获取最新的一条
          
          // 提取验证码
          const extractedCode = extractVerificationCode(latestSms.content);
          const newCode: VerificationCode = {
            id: latestSms.id,
            code: extractedCode || latestSms.content,
            received_at: latestSms.sms_timestamp || new Date().toISOString(),
            is_used: false,
            full_content: latestSms.content,
            sender: latestSms.sender,
            progressive_index: smsIndex
          };
          
          // 更新对应槽位的状态
          setProgressiveRetrievalState(prev => ({
            ...prev,
            smsSlots: prev.smsSlots.map(slot => 
              slot.index === smsIndex 
                ? { 
                    ...slot, 
                    status: 'completed', 
                    sms: newCode,
                    message: `第 ${smsIndex} 条短信已获取`
                  }
                : slot
            ),
            retrievedSmsIds: new Set([...prev.retrievedSmsIds, latestSms.id])
          }));

          // 添加到短信列表
          setAccountInfo(prev => prev ? {
            ...prev,
            verification_codes: [...(prev.verification_codes || []), newCode]
          } : null);

          console.log(`📱 第 ${smsIndex} 条短信获取成功:`, newCode.code);
          message.success(`第 ${smsIndex} 条短信获取成功: ${newCode.code}`);
        } else {
          // 没有新短信，标记为完成但无内容
          setProgressiveRetrievalState(prev => ({
            ...prev,
            smsSlots: prev.smsSlots.map(slot => 
              slot.index === smsIndex 
                ? { 
                    ...slot, 
                    status: 'completed',
                    message: `第 ${smsIndex} 条短信：无新内容`
                  }
                : slot
            )
          }));
          console.log(`⚠️ 第 ${smsIndex} 条短信: 没有新的短信`);
        }
      } else {
        // API失败，标记为完成
        setProgressiveRetrievalState(prev => ({
          ...prev,
          smsSlots: prev.smsSlots.map(slot => 
            slot.index === smsIndex 
              ? { 
                  ...slot, 
                  status: 'completed',
                  message: `第 ${smsIndex} 条短信获取失败`
                }
              : slot
          )
        }));
        console.log(`⚠️ 第 ${smsIndex} 条短信获取失败:`, data.message);
      }

    } catch (error) {
      // 错误处理，标记为完成
      setProgressiveRetrievalState(prev => ({
        ...prev,
        smsSlots: prev.smsSlots.map(slot => 
          slot.index === smsIndex 
            ? { 
                ...slot, 
                status: 'completed',
                message: `第 ${smsIndex} 条短信获取失败`
              }
            : slot
        )
      }));
      console.error(`❌ 第 ${smsIndex} 条短信获取失败:`, error);
    }
  }, [currentLinkId, progressiveRetrievalState.retrievedSmsIds]);

  // 🔥 独立倒计时效果 - 每个短信槽位都有自己的倒计时
  useEffect(() => {
    if (!progressiveRetrievalState.isActive) return;

    const timer = setInterval(() => {
      setProgressiveRetrievalState(prev => {
        const updatedSlots = prev.smsSlots.map(slot => {
          if (slot.status === 'waiting' && slot.countdown > 0) {
            const newCountdown = slot.countdown - 1;
            
            if (newCountdown <= 0) {
              // 倒计时结束，开始获取这条短信
              console.log(`⏰ 第${slot.index}条短信倒计时结束，开始获取`);
              retrieveSpecificSms(slot.index);
              return {
                ...slot,
                countdown: 0,
                status: 'retrieving',
                message: `正在获取第 ${slot.index} 条短信...`
              };
            }
            
            return {
              ...slot,
              countdown: newCountdown,
              message: `第 ${slot.index} 条短信倒计时: ${newCountdown}秒`
            };
          }
          return slot;
        });

        // 检查是否所有短信都已完成
        const allCompleted = updatedSlots.every(slot => slot.status === 'completed');
        
        return {
          ...prev,
          smsSlots: updatedSlots,
          isActive: !allCompleted
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [progressiveRetrievalState.isActive, retrieveSpecificSms]);

  // 提取验证码的辅助函数
  const extractVerificationCode = (content: string): string | null => {
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

  // 复制到剪贴板
  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success(`${type}已复制到剪贴板`);
    } catch (err) {
      console.error('复制失败:', err);
      message.error('复制失败，请手动复制');
    }
  };

  // 格式化时间
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // 计算验证码新鲜度
  const getCodeFreshness = (receivedAt: string) => {
    const now = new Date();
    const received = new Date(receivedAt);
    const diffMinutes = Math.floor((now.getTime() - received.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return { text: '刚刚', color: '#52c41a' };
    if (diffMinutes < 5) return { text: `${diffMinutes}分钟前`, color: '#52c41a' };
    if (diffMinutes < 30) return { text: `${diffMinutes}分钟前`, color: '#faad14' };
    if (diffMinutes < 60) return { text: `${diffMinutes}分钟前`, color: '#ff4d4f' };
    
    const diffHours = Math.floor(diffMinutes / 60);
    return { text: `${diffHours}小时前`, color: '#ff4d4f' };
  };

  // 组件挂载时获取数据
  useEffect(() => {
    fetchAccountInfo();
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [currentLinkId]);

  // 在所有return语句中包装ConfigProvider
  if (loading) {
    return (
      <ConfigProvider locale={zhCN}>
        <div className="customer-container">
          <div className="loading-container">
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>正在加载账号信息...</div>
          </div>
        </div>
      </ConfigProvider>
    );
  }

  if (error || accessDenied) {
    return (
      <ConfigProvider locale={zhCN}>
        <div className="customer-container">
          <Card className="customer-card">
            <div className="error-message">
              <ExclamationCircleOutlined style={{ fontSize: 48, color: '#ff4d4f', marginBottom: 16 }} />
              <Title level={4} type="danger">访问受限</Title>
              <Paragraph>
                {accessDenied ? '此链接的访问次数已达上限，无法继续访问。' : error}
              </Paragraph>
              {linkInfo && (
                <div style={{ marginTop: 16, padding: 16, background: '#fff2f0', borderRadius: 8 }}>
                  <Text type="secondary">
                    访问次数: {linkInfo.access_count} / {linkInfo.max_access_count}
                  </Text>
                </div>
              )}
            </div>
          </Card>
        </div>
      </ConfigProvider>
    );
  }

  if (!accountInfo) {
    return (
      <ConfigProvider locale={zhCN}>
        <div className="customer-container">
          <Card className="customer-card">
            <div className="error-message">
              <Title level={4} type="danger">账号信息不存在</Title>
              <Paragraph>请检查访问链接是否正确。</Paragraph>
            </div>
          </Card>
        </div>
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider locale={zhCN}>
      <div className="customer-container" style={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px'
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          {/* 账号信息卡片 */}
          <Card 
            className="customer-card"
            style={{ 
              marginBottom: 24,
              borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
            }}
          >
            <Row gutter={[24, 24]} align="middle">
              <Col xs={24} sm={8} style={{ textAlign: 'center' }}>
                <Avatar
                  size={80}
                  src={accountInfo.avatar_url ? (
                    accountInfo.avatar_url.startsWith('http') 
                      ? accountInfo.avatar_url 
                      : `${API_BASE_URL}${accountInfo.avatar_url}`
                  ) : undefined}
                  icon={<UserOutlined />}
                  style={{ marginBottom: 16 }}
                />
                <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
                  {accountInfo.account_name}
                </Title>
                <Tag color="blue" style={{ marginTop: 8 }}>
                  {accountInfo.service_type}
                </Tag>
              </Col>
              
              <Col xs={24} sm={16}>
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  {/* 用户名 */}
                  <div>
                    <Text strong style={{ color: '#666' }}>用户名</Text>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      marginTop: 4,
                      padding: '8px 12px',
                      background: '#f5f5f5',
                      borderRadius: 6,
                      border: '1px solid #d9d9d9'
                    }}>
                      <Text copyable={{ text: accountInfo.username }} style={{ flex: 1 }}>
                        {accountInfo.username}
                      </Text>
                      <Button
                        type="text"
                        icon={<CopyOutlined />}
                        size="small"
                        onClick={() => copyToClipboard(accountInfo.username, '用户名')}
                      />
                    </div>
                  </div>
                  
                  {/* 密码 */}
                  <div>
                    <Text strong style={{ color: '#666' }}>密码</Text>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      marginTop: 4,
                      padding: '8px 12px',
                      background: '#f5f5f5',
                      borderRadius: 6,
                      border: '1px solid #d9d9d9'
                    }}>
                      <Text copyable={{ text: accountInfo.password }} style={{ flex: 1 }}>
                        {accountInfo.password}
                      </Text>
                      <Button
                        type="text"
                        icon={<CopyOutlined />}
                        size="small"
                        onClick={() => copyToClipboard(accountInfo.password, '密码')}
                      />
                    </div>
                  </div>
                </Space>
              </Col>
            </Row>
          </Card>

          {/* 验证码卡片 */}
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>
                  <MobileOutlined style={{ marginRight: 8 }} />
                  验证码信息
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {lastRefresh && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      最后更新: {formatTime(lastRefresh.toISOString())}
                    </Text>
                  )}
                  <Button
                    type="primary"
                    size="small"
                    icon={<CheckCircleOutlined />}
                    onClick={startProgressiveRetrieval}
                    disabled={
                      progressiveRetrievalState.isActive || 
                      (linkInfo && (linkInfo.verification_count || 0) >= linkInfo.max_verification_count)
                    }
                    loading={loading}
                    style={{
                      opacity: (linkInfo && (linkInfo.verification_count || 0) >= linkInfo.max_verification_count) ? 0.5 : 1
                    }}
                  >
                    {progressiveRetrievalState.isActive 
                      ? '获取中...' 
                      : (linkInfo && (linkInfo.verification_count || 0) >= linkInfo.max_verification_count)
                        ? '已达上限'
                        : '获取验证码'
                    }
                  </Button>
                </div>
              </div>
            }
            style={{ 
              borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
            }}
          >
            {/* 🔥 渐进式获取状态显示 - 显示每条短信的独立倒计时 */}
            {progressiveRetrievalState.isActive && (
              <div style={{ 
                marginBottom: '24px',
                padding: '16px',
                backgroundColor: '#f0f9ff',
                borderRadius: '8px',
                border: '1px solid #bae6fd'
              }}>
                <div style={{ 
                  fontSize: '14px',
                  color: '#0369a1',
                  marginBottom: '12px',
                  textAlign: 'center',
                  fontWeight: 'bold'
                }}>
                  📱 正在获取 {progressiveRetrievalState.totalCount} 条短信
                </div>
                
                {/* 显示每条短信的状态 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {progressiveRetrievalState.smsSlots.map((slot) => (
                    <div 
                      key={slot.index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        backgroundColor: slot.status === 'completed' ? '#dcfce7' : 
                                       slot.status === 'retrieving' ? '#fef3c7' : '#f8fafc',
                        borderRadius: '8px',
                        border: `2px solid ${slot.status === 'completed' ? '#bbf7d0' : 
                                            slot.status === 'retrieving' ? '#fde68a' : '#e2e8f0'}`,
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <div style={{ 
                        fontSize: '14px', 
                        fontWeight: '600',
                        color: slot.status === 'completed' ? '#166534' : 
                               slot.status === 'retrieving' ? '#92400e' : '#475569'
                      }}>
                        {slot.message}
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {slot.status === 'waiting' && (
                          <>
                            <div style={{
                              fontSize: '18px',
                              fontWeight: 'bold',
                              color: '#3b82f6',
                              minWidth: '40px',
                              textAlign: 'center',
                              fontFamily: 'monospace'
                            }}>
                              {slot.countdown}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>秒后获取</div>
                          </>
                        )}
                        
                        {slot.status === 'retrieving' && (
                          <div style={{ 
                            fontSize: '12px', 
                            color: '#92400e',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                            <Spin 
                              indicator={<LoadingOutlined style={{ fontSize: 16, color: '#f59e0b' }} spin />} 
                            />
                            正在获取...
                          </div>
                        )}
                        
                        {slot.status === 'completed' && (
                          <div style={{ 
                            fontSize: '12px', 
                            color: '#166534',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                            <CheckCircleOutlined style={{ color: '#22c55e', fontSize: 16 }} />
                            {slot.sms ? '已获取' : '无新短信'}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 验证码列表 */}
            {accountInfo.verification_codes && accountInfo.verification_codes.length > 0 ? (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {accountInfo.verification_codes
                  .sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime())
                  .map((code) => {
                    const freshness = getCodeFreshness(code.received_at);
                    return (
                      <Card
                        key={code.id}
                        size="small"
                        style={{
                          background: code.is_used ? '#f5f5f5' : '#fff',
                          border: `2px solid ${code.is_used ? '#d9d9d9' : '#1890ff'}`,
                          borderRadius: 12,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}
                      >
                        <Row align="middle" justify="space-between">
                          <Col flex="auto">
                            <Space direction="vertical" size={6}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <Text
                                  strong
                                  style={{
                                    fontSize: 20,
                                    fontFamily: 'monospace',
                                    color: code.is_used ? '#999' : '#1890ff',
                                    letterSpacing: '2px'
                                  }}
                                >
                                  {code.code}
                                </Text>
                                {code.is_used && (
                                  <Tag color="default" size="small">已使用</Tag>
                                )}
                                {code.progressive_index && (
                                  <Tag color="blue" size="small">
                                    第{code.progressive_index}条
                                  </Tag>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <ClockCircleOutlined style={{ color: freshness.color }} />
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  {formatTime(code.received_at)}
                                </Text>
                                <Tag color={freshness.color} size="small">
                                  {freshness.text}
                                </Tag>
                              </div>
                            </Space>
                          </Col>
                          <Col>
                            <Button
                              type="primary"
                              ghost
                              icon={<CopyOutlined />}
                              size="small"
                              onClick={() => copyToClipboard(code.code, '验证码')}
                              disabled={code.is_used}
                            >
                              复制
                            </Button>
                          </Col>
                        </Row>
                      </Card>
                    );
                  })}
              </Space>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <MobileOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
                <Title level={4} type="secondary">暂无验证码</Title>
                <Paragraph type="secondary">
                  点击"获取验证码"按钮开始获取短信验证码
                </Paragraph>
              </div>
            )}
          </Card>

          {/* 使用统计和限制信息 */}
          {linkInfo && (
            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ClockCircleOutlined style={{ color: '#1890ff' }} />
                  <Text strong style={{ color: '#1890ff' }}>使用限制信息</Text>
                </div>
              }
              size="small"
              style={{ 
                marginTop: 16,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.95)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
              }}
            >
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {/* 访问次数统计 */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text strong style={{ color: '#666' }}>页面访问次数</Text>
                    <Text 
                      style={{ 
                        color: linkInfo.access_count >= linkInfo.max_access_count ? '#ff4d4f' : '#52c41a',
                        fontWeight: 'bold'
                      }}
                    >
                      {linkInfo.access_count} / {linkInfo.max_access_count}
                    </Text>
                  </div>
                  <Progress
                    percent={Math.round((linkInfo.access_count / linkInfo.max_access_count) * 100)}
                    size="small"
                    strokeColor={
                      linkInfo.access_count >= linkInfo.max_access_count ? '#ff4d4f' : '#52c41a'
                    }
                    trailColor="#f0f0f0"
                  />
                  {linkInfo.access_count >= linkInfo.max_access_count && (
                    <Alert
                      message="访问次数已达上限"
                      description="此链接的访问次数已用完，无法继续访问"
                      type="error"
                      size="small"
                      style={{ marginTop: 8 }}
                      showIcon
                    />
                  )}
                </div>

                {/* 验证码获取次数统计 - 🔥 修复：使用服务器端的真实次数 */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text strong style={{ color: '#666' }}>验证码获取次数</Text>
                    <Text 
                      style={{ 
                        color: (linkInfo.verification_count || 0) >= linkInfo.max_verification_count ? '#ff4d4f' : '#52c41a',
                        fontWeight: 'bold'
                      }}
                    >
                      {linkInfo.verification_count || 0} / {linkInfo.max_verification_count}
                    </Text>
                  </div>
                  <Progress
                    percent={Math.round(((linkInfo.verification_count || 0) / linkInfo.max_verification_count) * 100)}
                    size="small"
                    strokeColor={
                      (linkInfo.verification_count || 0) >= linkInfo.max_verification_count ? '#ff4d4f' : '#52c41a'
                    }
                    trailColor="#f0f0f0"
                  />
                  {(linkInfo.verification_count || 0) >= linkInfo.max_verification_count && (
                    <Alert
                      message="🚫 验证码获取次数已达上限"
                      description={
                        <div>
                          <p style={{ margin: 0, marginBottom: 8 }}>您已达到最大验证码获取次数限制。</p>
                          <p style={{ margin: 0, color: '#1890ff', fontWeight: 'bold' }}>
                            📞 如需继续使用，请联系管理员重置次数限制
                          </p>
                        </div>
                      }
                      type="error"
                      size="small"
                      style={{ marginTop: 8 }}
                      showIcon
                    />
                  )}
                </div>

                {/* 验证码等待时间配置 */}
                {linkInfo.verification_wait_time && (
                  <div style={{ 
                    padding: '12px 16px',
                    background: '#f6ffed',
                    borderRadius: 8,
                    border: '1px solid #b7eb8f'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <ClockCircleOutlined style={{ color: '#52c41a' }} />
                      <Text strong style={{ color: '#389e0d' }}>验证码等待间隔</Text>
                    </div>
                    <Text style={{ color: '#666', fontSize: 12 }}>
                      每条短信按递增间隔获取：第1条 {linkInfo.verification_wait_time}秒，第2条 {linkInfo.verification_wait_time * 2}秒，第3条 {linkInfo.verification_wait_time * 3}秒...
                    </Text>
                  </div>
                )}

                {/* 访问会话间隔信息 */}
                {linkInfo.access_session_interval && (
                  <div style={{ 
                    padding: '12px 16px',
                    background: '#f0f9ff',
                    borderRadius: 8,
                    border: '1px solid #91d5ff'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <ExclamationCircleOutlined style={{ color: '#1890ff' }} />
                      <Text strong style={{ color: '#1890ff' }}>访问会话间隔</Text>
                    </div>
                    <Text style={{ color: '#666', fontSize: 12 }}>
                      建议访问间隔：{linkInfo.access_session_interval} 分钟，避免频繁访问
                    </Text>
                  </div>
                )}
              </Space>
            </Card>
          )}
        </div>
      </div>
    </ConfigProvider>
  );
};

export default CustomerPage;
