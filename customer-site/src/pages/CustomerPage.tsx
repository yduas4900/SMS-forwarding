// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
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
  ExclamationCircleOutlined
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
}

interface LinkInfo {
  id: number;
  link_id: string;
  access_count: number;
  max_access_count: number;
  created_at: string;
}

const CustomerPage: React.FC = () => {
  const { linkId } = useParams<{ linkId: string }>();
  const [searchParams] = useSearchParams();
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
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
        // 适配后端API响应结构，但保持原有UI不变
        const accountData = response.data.data.account_info;
        const linkData = response.data.data.link_info;
        
        // 转换为原有的数据格式
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
        
        // 🔥 新增：页面加载时自动获取已有的短信
        await fetchExistingSms();
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

  // 🔥 新增：获取已有短信（不增加验证码获取次数）
  const fetchExistingSms = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/get_existing_sms`, {
        params: { link_id: currentLinkId }
      });
      
      console.log('已有短信API响应:', response.data);
      
      if (response.data.success) {
        const responseData = response.data.data;
        
        if (responseData.all_matched_sms && responseData.all_matched_sms.length > 0) {
          // 将匹配的短信转换为验证码格式
          const existingCodes = responseData.all_matched_sms.map((sms: any, index: number) => {
            const extractedCode = extractVerificationCode(sms.content);
            return {
              id: sms.id || index,
              code: extractedCode || sms.content, // 如果没有验证码就显示完整内容
              received_at: sms.sms_timestamp || new Date().toISOString(),
              is_used: false,
              full_content: sms.content, // 保存完整内容
              sender: sms.sender
            };
          });
          
          setAccountInfo(prev => prev ? {
            ...prev,
            verification_codes: existingCodes
          } : null);
          
          console.log(`页面加载时获取到 ${existingCodes.length} 条已有短信`);
        }
      }
    } catch (error: any) {
      console.error('获取已有短信失败:', error);
      // 不显示错误消息，因为这是后台获取
    }
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

  // 🔥 新的渐进式短信获取机制
  const getVerificationCodes = async () => {
    if (countdown > 0) return;
    
    try {
      setLoading(true);
      
      // 首先获取链接配置信息和短信规则
      const accountResponse = await axios.get(`${API_BASE_URL}/api/get_account_info`, {
        params: { link_id: currentLinkId }
      });
      
      if (!accountResponse.data.success) {
        message.error('获取链接配置失败');
        return;
      }
      
      const linkData = accountResponse.data.data.link_info;
      const waitTime = linkData.verification_wait_time || 10; // 默认10秒
      
      // 获取短信规则中的显示条数
      const smsRulesResponse = await axios.get(`${API_BASE_URL}/api/sms_rules`, {
        params: { account_id: accountResponse.data.data.account_info.id }
      });
      
      let displayCount = 5; // 默认显示5条
      if (smsRulesResponse.data.success && smsRulesResponse.data.data.length > 0) {
        // 取第一个规则的显示条数
        displayCount = smsRulesResponse.data.data[0].display_count || 5;
      }
      
      console.log(`开始渐进式获取 ${displayCount} 条短信，每条间隔 ${waitTime} 秒`);
      
      // 🔥 关键修正：刷新按钮倒计时 = 最后一条短信的倒计时时间
      const totalCountdown = displayCount * waitTime;
      setCountdown(totalCountdown);
      
      message.info(`开始获取 ${displayCount} 条短信，预计需要 ${totalCountdown} 秒`);
      
      // 清空现有的验证码
      setAccountInfo(prev => prev ? {
        ...prev,
        verification_codes: []
      } : null);
      
      // 启动渐进式获取
      startProgressiveRetrieval(displayCount, waitTime);
      
    } catch (error: any) {
      console.error('获取验证码失败:', error);
      message.error('获取验证码失败');
      setLoading(false);
    }
  };

  // 🔥 渐进式获取短信的核心函数
  const startProgressiveRetrieval = (totalCount: number, waitTime: number) => {
    let currentIndex = 0;
    const retrievedSmsIds = new Set<number>(); // 用于去重
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    // 立即获取第一条短信
    fetchSingleSms(currentIndex + 1, retrievedSmsIds);
    currentIndex++;
    
    // 设置定时器获取后续短信
    intervalRef.current = setInterval(() => {
      setCountdown(prev => {
        const newCountdown = prev - 1;
        
        // 检查是否到了获取下一条短信的时间
        const elapsedTime = (totalCount * waitTime) - newCountdown;
        const shouldFetchIndex = Math.floor(elapsedTime / waitTime);
        
        if (shouldFetchIndex > currentIndex && currentIndex < totalCount) {
          fetchSingleSms(currentIndex + 1, retrievedSmsIds);
          currentIndex++;
        }
        
        // 倒计时结束
        if (newCountdown <= 0) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          setLoading(false);
          message.success(`渐进式获取完成，共获取 ${currentIndex} 条短信`);
          return 0;
        }
        
        return newCountdown;
      });
    }, 1000);
  };

  // 🔥 获取单条短信（带去重）
  const fetchSingleSms = async (index: number, retrievedSmsIds: Set<number>) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/get_verification_code`, {
        params: { 
          link_id: currentLinkId,
          progressive_index: index // 传递索引用于后端处理
        }
      });
      
      console.log(`获取第 ${index} 条短信:`, response.data);
      
      if (response.data.success) {
        const responseData = response.data.data;
        
        if (responseData.all_matched_sms && responseData.all_matched_sms.length > 0) {
          // 过滤掉已经获取过的短信
          const newSms = responseData.all_matched_sms.filter((sms: any) => 
            !retrievedSmsIds.has(sms.id)
          );
          
          if (newSms.length > 0) {
            // 只取最新的一条（避免重复）
            const latestSms = newSms[0];
            retrievedSmsIds.add(latestSms.id);
            
            const extractedCode = extractVerificationCode(latestSms.content);
            const newCode = {
              id: latestSms.id,
              code: extractedCode || latestSms.content,
              received_at: latestSms.sms_timestamp || new Date().toISOString(),
              is_used: false,
              full_content: latestSms.content,
              sender: latestSms.sender,
              progressive_index: index // 标记获取顺序
            };
            
            // 添加到验证码列表
            setAccountInfo(prev => prev ? {
              ...prev,
              verification_codes: [...(prev.verification_codes || []), newCode]
            } : null);
            
            console.log(`✅ 第 ${index} 条短信获取成功: ${newCode.code}`);
          } else {
            console.log(`⚠️ 第 ${index} 条短信已存在，跳过`);
          }
        }
      }
    } catch (error: any) {
      console.error(`获取第 ${index} 条短信失败:`, error);
    }
  };

  // 实际获取验证码的函数
  const fetchVerificationCode = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/get_verification_code`, {
        params: { link_id: currentLinkId }
      });
      
      console.log('验证码API响应:', response.data);
      
      if (response.data.success) {
        // 🔥 修复：正确处理API响应数据
        const responseData = response.data.data;
        
        if (responseData.all_matched_sms && responseData.all_matched_sms.length > 0) {
          // 将匹配的短信转换为验证码格式
          const newCodes = responseData.all_matched_sms.map((sms: any, index: number) => {
            const extractedCode = extractVerificationCode(sms.content);
            return {
              id: sms.id || index,
              code: extractedCode || sms.content, // 如果没有验证码就显示完整内容
              received_at: sms.sms_timestamp || new Date().toISOString(),
              is_used: false,
              full_content: sms.content, // 保存完整内容
              sender: sms.sender
            };
          });
          
          setAccountInfo(prev => prev ? {
            ...prev,
            verification_codes: newCodes
          } : null);
          
          message.success(`获取到 ${newCodes.length} 条匹配的短信`);
        } else if (responseData.verification_code || responseData.content) {
          // 处理单条短信的情况
          const newCode = {
            id: Date.now(),
            code: responseData.verification_code || responseData.content,
            received_at: responseData.sms_timestamp || new Date().toISOString(),
            is_used: false,
            full_content: responseData.content,
            sender: responseData.sender
          };
          
          setAccountInfo(prev => prev ? {
            ...prev,
            verification_codes: [newCode]
          } : null);
          
          message.success('验证码获取成功');
        } else {
          message.warning('未找到匹配的短信内容');
        }
        
        setLastRefresh(new Date());
      } else {
        message.warning(response.data.message || '暂无新的验证码');
      }
    } catch (error: any) {
      console.error('获取验证码失败:', error);
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        message.warning(`请等待 ${retryAfter} 秒后再试`);
      } else if (error.response?.status === 403) {
        message.error('验证码获取次数已达上限');
      } else {
        message.error('获取验证码失败: ' + (error.response?.data?.detail || error.message));
      }
    }
  };

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

  // 刷新账号信息（不获取验证码）
  const refreshAccountInfo = () => {
    fetchAccountInfo();
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
                  src={accountInfo.avatar_url}
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
                    onClick={getVerificationCodes}
                    disabled={countdown > 0}
                    loading={loading}
                  >
                    {countdown > 0 ? `等待 ${countdown}s` : '获取验证码'}
                  </Button>
                </div>
              </div>
            }
            style={{ 
              borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
            }}
          >
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
                          border: `1px solid ${code.is_used ? '#d9d9d9' : '#1890ff'}`,
                          borderRadius: 8
                        }}
                      >
                        <Row align="middle" justify="space-between">
                          <Col flex="auto">
                            <Space direction="vertical" size={4}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Text
                                  strong
                                  style={{
                                    fontSize: 18,
                                    fontFamily: 'monospace',
                                    color: code.is_used ? '#999' : '#1890ff'
                                  }}
                                >
                                  {code.code}
                                </Text>
                                {code.is_used && (
                                  <Tag color="default" size="small">已使用</Tag>
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
                  验证码将在收到后自动显示在这里
                </Paragraph>
              </div>
            )}
          </Card>

          {/* 访问统计 */}
          {linkInfo && (
            <Card
              size="small"
              style={{ 
                marginTop: 16,
                borderRadius: 8,
                background: 'rgba(255,255,255,0.9)'
              }}
            >
              <Row justify="space-between" align="middle">
                <Col>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    访问次数: {linkInfo.access_count} / {linkInfo.max_access_count}
                  </Text>
                </Col>
                <Col>
                  <Progress
                    percent={Math.round((linkInfo.access_count / linkInfo.max_access_count) * 100)}
                    size="small"
                    style={{ width: 100 }}
                    strokeColor={
                      linkInfo.access_count >= linkInfo.max_access_count ? '#ff4d4f' : '#1890ff'
                    }
                  />
                </Col>
              </Row>
            </Card>
          )}
        </div>
      </div>
    </ConfigProvider>
  );
};

export default CustomerPage;
