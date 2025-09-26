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
  progressive_index?: number;
  countdown?: number; // 添加倒计时字段
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
  const [smsCountdowns, setSmsCountdowns] = useState<{[key: number]: number}>({});
  const smsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // 🔥 新增：占位框状态管理
  const [placeholderBoxes, setPlaceholderBoxes] = useState<Array<{
    index: number;
    status: 'waiting' | 'fetching' | 'completed';
    countdown: number;
    message: string;
  }>>([]);

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
        
        // 🔥 修复：页面加载时不自动获取短信，必须点击"获取验证码"按钮
        // await fetchExistingSms(); // 注释掉自动获取
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

  // 🔥 修复后的渐进式短信获取机制
  const getVerificationCodes = async () => {
    if (countdown > 0) return;
    
    try {
      // 🔥 修复：不要设置loading为true，避免页面变空白
      // setLoading(true);
      
      // 获取链接配置信息
      const accountResponse = await axios.get(`${API_BASE_URL}/api/get_account_info`, {
        params: { link_id: currentLinkId }
      });
      
      if (!accountResponse.data.success) {
        message.error('获取链接配置失败');
        return;
      }
      
      const linkData = accountResponse.data.data.link_info;
      const waitTime = linkData.verification_wait_time || 10; // 🔥 使用数据库中的真实等待时间！
      
      console.log(`🔍 从数据库获取等待时间: ${waitTime}秒 (绝不硬编码！)`);
      
      // 🔥 修复：从短信规则API获取真实的显示条数
      let displayCount = 1; // 默认1条
      
      console.log('🔍 链接配置详情:', linkData);
      
      // 🔥 从短信规则API获取显示条数 - 绝不使用硬编码！
      try {
        const smsRulesResponse = await axios.get(`${API_BASE_URL}/api/sms_rules`, {
          params: { account_id: accountResponse.data.data.account_info.id }
        });
        
        console.log('🔍 短信规则API响应:', smsRulesResponse.data);
        
        if (smsRulesResponse.data.success && smsRulesResponse.data.data.length > 0) {
          // 🔥 关键修复：使用数据库中的真实显示条数
          const realDisplayCount = smsRulesResponse.data.data[0].display_count;
          displayCount = realDisplayCount;
          console.log(`✅ 从数据库获取真实显示条数: ${displayCount} (绝不硬编码！)`);
        } else {
          console.log('⚠️ 未找到短信规则，使用默认显示条数: 1');
          displayCount = 1;
        }
      } catch (error) {
        console.error('❌ 获取短信规则失败:', error);
        console.log('⚠️ 短信规则API失败，使用默认显示条数: 1');
        displayCount = 1;
      }
      
      console.log(`🔍 最终配置: waitTime=${waitTime}, displayCount=${displayCount}`);
      
      console.log(`🚀 开始渐进式获取 ${displayCount} 条短信，每条间隔 ${waitTime} 秒`);
      
      // 清空现有的验证码
      setAccountInfo(prev => prev ? {
        ...prev,
        verification_codes: []
      } : null);
      
      // 启动渐进式获取
      startProgressiveRetrieval(displayCount, waitTime);
      
    } catch (error: any) {
      console.error('获取验证码失败:', error);
      message.error('获取验证码失败: ' + (error.response?.data?.message || error.message));
    }
  };

  // 🔥 彻底简化的渐进式获取 - 清晰简单的逻辑
  const startProgressiveRetrieval = (totalCount: number, waitTime: number) => {
    const retrievedSmsIds = new Set<number>(); // 用于去重
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    // 清空占位框，使用简单的倒计时
    setPlaceholderBoxes([]);
    setCountdown(totalCount * waitTime);
    
    message.info(`开始获取 ${totalCount} 条短信，每条间隔 ${waitTime} 秒`);
    
    // 简单的定时器，每waitTime秒获取一条
    let currentIndex = 0;
    
    const fetchNext = () => {
      if (currentIndex < totalCount) {
        currentIndex++;
        console.log(`🚀 开始获取第 ${currentIndex} 条短信`);
        fetchSingleSms(currentIndex, retrievedSmsIds, totalCount, waitTime);
        
        if (currentIndex < totalCount) {
          setTimeout(fetchNext, waitTime * 1000);
        }
      }
    };
    
    // 立即获取第一条，然后按间隔获取后续
    setTimeout(fetchNext, waitTime * 1000);
    
    // 倒计时定时器
    intervalRef.current = setInterval(() => {
      setCountdown(prev => {
        const newCountdown = prev - 1;
        if (newCountdown <= 0) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          message.success(`渐进式获取完成`);
          return 0;
        }
        return newCountdown;
      });
    }, 1000);
  };

  // 🔥 修复后的单条短信获取函数 - 智能获取最新短信，添加重试机制
  const fetchSingleSms = async (index: number, retrievedSmsIds: Set<number>, totalCount: number, waitTime: number, retryCount = 0) => {
    try {
      console.log(`📱 正在获取第 ${index}/${totalCount} 条短信... (重试次数: ${retryCount})`);
      
      // 🔥 添加延迟，避免API调用过于频繁
      if (retryCount > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 重试时等待2秒
      }
      
      const response = await axios.get(`${API_BASE_URL}/api/get_verification_code`, {
        params: { 
          link_id: currentLinkId
        },
        timeout: 10000 // 10秒超时
      });
      
      console.log(`第 ${index} 条短信API响应:`, response.data);
      
      if (response.data.success) {
        const responseData = response.data.data;
        
        if (responseData.all_matched_sms && responseData.all_matched_sms.length > 0) {
          // 🔥 关键修复：按时间排序，获取最新的未获取短信
          const sortedSms = responseData.all_matched_sms
            .sort((a: any, b: any) => {
              const timeA = new Date(a.sms_timestamp || 0).getTime();
              const timeB = new Date(b.sms_timestamp || 0).getTime();
              return timeB - timeA; // 最新的在前
            });
          
          // 🔥 智能选择：优先选择最新的未获取短信
          let selectedSms = null;
          for (const sms of sortedSms) {
            if (!retrievedSmsIds.has(sms.id)) {
              selectedSms = sms;
              break; // 找到第一个（最新的）未获取短信
            }
          }
          
          if (selectedSms) {
            retrievedSmsIds.add(selectedSms.id);
            
            const extractedCode = extractVerificationCode(selectedSms.content);
            const newCode = {
              id: selectedSms.id,
              code: extractedCode || selectedSms.content,
              received_at: selectedSms.sms_timestamp || new Date().toISOString(),
              is_used: false,
              full_content: selectedSms.content,
              sender: selectedSms.sender,
              progressive_index: index, // 标记获取顺序
              countdown: waitTime // 添加倒计时
            };
            
            // 添加到验证码列表
            setAccountInfo(prev => prev ? {
              ...prev,
              verification_codes: [...(prev.verification_codes || []), newCode]
            } : null);
            
            // 🔥 为这条短信启动倒计时
            setSmsCountdowns(prev => ({
              ...prev,
              [selectedSms.id]: waitTime
            }));
            
            // 🔥 修复：获取成功后移除对应的占位框，让验证码直接显示
            setPlaceholderBoxes(prev => prev.filter(box => box.index !== index));
            
            console.log(`✅ 第 ${index} 条短信获取成功: ${newCode.code} (时间: ${selectedSms.sms_timestamp})`);
            message.success(`第 ${index} 条短信获取成功: ${newCode.code}`);
          } else {
            console.log(`⚠️ 第 ${index} 条短信：所有短信都已获取过`);
            message.info(`第 ${index} 条短信：所有短信都已获取过`);
            
            // 🔥 修复：无新短信时也移除占位框
            setPlaceholderBoxes(prev => prev.filter(box => box.index !== index));
          }
        } else {
          console.log(`📭 第 ${index} 条短信暂无匹配内容`);
          message.info(`第 ${index} 条短信暂无匹配内容`);
          
          // 🔥 修复：暂无内容时也移除占位框
          setPlaceholderBoxes(prev => prev.filter(box => box.index !== index));
        }
      } else {
        // 🔥 添加重试逻辑
        if (retryCount < 2) {
          console.log(`⚠️ 第 ${index} 条短信获取失败，准备重试: ${response.data.message}`);
          setPlaceholderBoxes(prev => prev.map(box => 
            box.index === index 
              ? { ...box, status: 'fetching', message: `第 ${index} 条短信重试中... (${retryCount + 1}/3)` }
              : box
          ));
          
          // 延迟后重试
          setTimeout(() => {
            fetchSingleSms(index, retrievedSmsIds, totalCount, waitTime, retryCount + 1);
          }, 3000);
          return;
        }
        
        console.log(`❌ 第 ${index} 条短信获取失败:`, response.data.message);
        message.warning(`第 ${index} 条短信获取失败: ${response.data.message}`);
        
        // 🔥 移除失败的占位框
        setPlaceholderBoxes(prev => prev.filter(box => box.index !== index));
      }
    } catch (error: any) {
      // 🔥 添加重试逻辑
      if (retryCount < 2 && (error.response?.status === 429 || error.code === 'ECONNABORTED')) {
        console.log(`⚠️ 第 ${index} 条短信网络错误，准备重试:`, error.message);
        setPlaceholderBoxes(prev => prev.map(box => 
          box.index === index 
            ? { ...box, status: 'fetching', message: `第 ${index} 条短信重试中... (${retryCount + 1}/3)` }
            : box
        ));
        
        // 延迟后重试
        setTimeout(() => {
          fetchSingleSms(index, retrievedSmsIds, totalCount, waitTime, retryCount + 1);
        }, 3000);
        return;
      }
      
      console.error(`获取第 ${index} 条短信失败:`, error);
      message.error(`第 ${index} 条短信获取失败: ${error.response?.data?.message || error.message}`);
      
      // 🔥 移除失败的占位框
      setPlaceholderBoxes(prev => prev.filter(box => box.index !== index));
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
      if (smsIntervalRef.current) {
        clearInterval(smsIntervalRef.current);
      }
    };
  }, [currentLinkId]);

  // 🔥 短信倒计时定时器
  useEffect(() => {
    if (Object.keys(smsCountdowns).length > 0) {
      if (smsIntervalRef.current) {
        clearInterval(smsIntervalRef.current);
      }
      
      smsIntervalRef.current = setInterval(() => {
        setSmsCountdowns(prev => {
          const newCountdowns = { ...prev };
          let hasActiveCountdown = false;
          
          for (const smsId in newCountdowns) {
            if (newCountdowns[smsId] > 0) {
              newCountdowns[smsId]--;
              hasActiveCountdown = true;
            }
          }
          
          // 如果没有活跃的倒计时，清除定时器
          if (!hasActiveCountdown && smsIntervalRef.current) {
            clearInterval(smsIntervalRef.current);
          }
          
          return newCountdowns;
        });
      }, 1000);
    }
    
    return () => {
      if (smsIntervalRef.current) {
        clearInterval(smsIntervalRef.current);
      }
    };
  }, [smsCountdowns]);

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
            {/* 🔥 优先显示占位框，然后显示验证码 */}
            {placeholderBoxes.length > 0 ? (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {placeholderBoxes.map((box) => (
                  <Card
                    key={`placeholder-${box.index}`}
                    size="small"
                    style={{
                      background: box.status === 'waiting' ? '#fff7e6' : 
                                 box.status === 'fetching' ? '#e6f7ff' : '#f6ffed',
                      border: `1px solid ${
                        box.status === 'waiting' ? '#ffd666' : 
                        box.status === 'fetching' ? '#91d5ff' : '#b7eb8f'
                      }`,
                      borderRadius: 8
                    }}
                  >
                    <Row align="middle" justify="space-between">
                      <Col flex="auto">
                        <Space direction="vertical" size={4}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Text strong style={{ fontSize: 16, color: '#666' }}>
                              {box.message}
                            </Text>
                            <Tag 
                              color={
                                box.status === 'waiting' ? 'orange' : 
                                box.status === 'fetching' ? 'blue' : 'green'
                              } 
                              size="small"
                            >
                              {box.status === 'waiting' ? `倒计时 ${box.countdown}s` :
                               box.status === 'fetching' ? '获取中...' : '已完成'}
                            </Tag>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ClockCircleOutlined style={{ color: '#faad14' }} />
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              第 {box.index} 条短信
                            </Text>
                            {box.status === 'waiting' && (
                              <Progress 
                                percent={Math.max(0, 100 - (box.countdown / (box.index * 10)) * 100)} 
                                size="small" 
                                style={{ width: 100 }}
                                strokeColor="#faad14"
                              />
                            )}
                          </div>
                        </Space>
                      </Col>
                      <Col>
                        {box.status === 'fetching' && (
                          <Spin size="small" />
                        )}
                      </Col>
                    </Row>
                  </Card>
                ))}
                
                {/* 🔥 在占位框下方显示已获取的验证码 */}
                {accountInfo.verification_codes && accountInfo.verification_codes.length > 0 && (
                  <>
                    <Divider orientation="left" style={{ margin: '16px 0' }}>
                      <Text type="secondary">已获取的验证码</Text>
                    </Divider>
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
                                    {/* 🔥 显示短信倒计时 */}
                                    {smsCountdowns[code.id] > 0 && (
                                      <Tag color="orange" size="small">
                                        倒计时 {smsCountdowns[code.id]}s
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
                                    {/* 🔥 显示获取顺序 */}
                                    {code.progressive_index && (
                                      <Tag color="blue" size="small">
                                        第{code.progressive_index}条
                                      </Tag>
                                    )}
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
                  </>
                )}
              </Space>
            ) : accountInfo.verification_codes && accountInfo.verification_codes.length > 0 ? (
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
                                {/* 🔥 显示短信倒计时 */}
                                {smsCountdowns[code.id] > 0 && (
                                  <Tag color="orange" size="small">
                                    倒计时 {smsCountdowns[code.id]}s
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
                                {/* 🔥 显示获取顺序 */}
                                {code.progressive_index && (
                                  <Tag color="blue" size="small">
                                    第{code.progressive_index}条
                                  </Tag>
                                )}
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
