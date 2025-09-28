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
  smart_recognition?: {
    region: string;
    best_code: {
      code: string;
      confidence: number;
      pattern_type: string;
    };
    all_candidates: Array<{
      code: string;
      confidence: number;
      pattern_type: string;
    }>;
  };
}

interface LinkInfo {
  id: number;
  link_id: string;
  access_count: number;
  max_access_count: number;
  max_verification_count: number;
  verification_count?: number;
  access_session_interval?: number;
  verification_wait_time?: number;
  created_at: string;
}

interface CustomerSiteSettings {
  customerSiteTitle: string;
  customerSiteDescription: string;
  customerSiteWelcomeText: string;
  customerSiteFooterText: string;
  customerSiteBackgroundColor: string;
  customerSiteLogoUrl?: string;
  customerSiteCustomCSS: string;
  enableCustomerSiteCustomization: boolean;
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
  
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(() => {
    try {
      const savedSms = sessionStorage.getItem('savedVerificationCodes');
      if (savedSms) {
        const parsedSms = JSON.parse(savedSms);
        console.log('🔄 从sessionStorage恢复已获取的短信:', parsedSms);
        return {
          id: 0,
          account_name: '',
          username: '',
          password: '',
          service_type: '',
          verification_codes: parsedSms
        };
      }
    } catch (error) {
      console.error('❌ 恢复已获取短信失败:', error);
    }
    return null;
  });
  
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [accessSessionCountdown, setAccessSessionCountdown] = useState<number>(0);
  const accessCountdownRef = useRef<NodeJS.Timeout | null>(null);
  
  const [customerSettings, setCustomerSettings] = useState<CustomerSiteSettings>({
    customerSiteTitle: '验证码获取服务',
    customerSiteDescription: '安全便捷的验证码获取服务',
    customerSiteWelcomeText: '<h2>欢迎使用验证码获取服务</h2><p>请按照以下步骤获取您的验证码：</p><ol><li>复制用户名和密码</li><li>点击获取验证码按钮</li><li>等待验证码到达</li></ol>',
    customerSiteFooterText: '<p>如有问题，请联系客服。</p>',
    customerSiteBackgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    customerSiteLogoUrl: undefined,
    customerSiteCustomCSS: '',
    enableCustomerSiteCustomization: true
  });
  
  const [progressiveRetrievalState, setProgressiveRetrievalState] = useState<{
    isActive: boolean;
    totalCount: number;
    smsSlots: SmsSlot[];
    retrievedSmsIds: Set<number>;
  }>(() => {
    try {
      const savedState = sessionStorage.getItem('progressiveRetrievalState');
      if (savedState) {
        const parsed = JSON.parse(savedState);
        console.log('🔄 从sessionStorage恢复渐进式获取状态:', parsed);
        return {
          ...parsed,
          retrievedSmsIds: new Set(parsed.retrievedSmsIds || [])
        };
      }
    } catch (error) {
      console.error('❌ 恢复渐进式获取状态失败:', error);
    }
    
    return {
      isActive: false,
      totalCount: 0,
      smsSlots: [],
      retrievedSmsIds: new Set()
    };
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentLinkId = linkId || searchParams.get('link_id');

  const fetchCustomerSettings = async () => {
    try {
      console.log('🎨 开始获取客户端设置...');
      const response = await axios.get(`${API_BASE_URL}/api/settings/customer-site/public`);
      
      if (response.data.success && response.data.data) {
        console.log('🎨 成功获取客户端设置:', response.data.data);
        setCustomerSettings(response.data.data);
        
        if (response.data.data.customerSiteTitle) {
          document.title = response.data.data.customerSiteTitle;
        }
        
        if (response.data.data.customerSiteCustomCSS) {
          const existingStyle = document.getElementById('customer-custom-css');
          if (existingStyle) {
            existingStyle.remove();
          }
          
          const style = document.createElement('style');
          style.id = 'customer-custom-css';
          style.textContent = response.data.data.customerSiteCustomCSS;
          document.head.appendChild(style);
        }
      } else {
        console.warn('⚠️ 获取客户端设置失败，使用默认设置');
      }
    } catch (error) {
      console.error('❌ 获取客户端设置失败:', error);
    }
  };

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
        
        const savedSms = sessionStorage.getItem('savedVerificationCodes');
        let existingCodes: VerificationCode[] = [];
        
        if (savedSms) {
          try {
            existingCodes = JSON.parse(savedSms);
            console.log('🔄 合并已保存的短信:', existingCodes.length, '条');
          } catch (error) {
            console.error('❌ 解析已保存短信失败:', error);
          }
        }
        
        setAccountInfo({
          id: accountData.id,
          account_name: accountData.account_name,
          username: accountData.username,
          password: accountData.password,
          service_type: accountData.type || '未知服务',
          avatar_url: accountData.image_url,
          verification_codes: existingCodes.length > 0 ? existingCodes : (accountData.verification_codes || [])
        });
        
        setLinkInfo(linkData);
        setAccessDenied(false);
        setError(null);
        setLastRefresh(new Date());
        
        if (linkData.access_session_interval) {
          if (linkData.last_access_time) {
            const lastAccessTime = new Date(linkData.last_access_time);
            const sessionIntervalMs = linkData.access_session_interval * 60 * 1000;
            const elapsedTime = Date.now() - lastAccessTime.getTime();
            const remainingTime = Math.max(0, sessionIntervalMs - elapsedTime);
            const remainingSeconds = Math.ceil(remainingTime / 1000);
            
            console.log('⏰ 访问会话倒计时计算:', {
              lastAccessTime: linkData.last_access_time,
              sessionInterval: linkData.access_session_interval,
              elapsedTime: Math.floor(elapsedTime / 1000),
              remainingSeconds
            });
            
            setAccessSessionCountdown(remainingSeconds);
          } else {
            console.log('🆕 首次访问，显示访问会话间隔信息');
            setAccessSessionCountdown(0);
          }
        }
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

  const startProgressiveRetrieval = useCallback(async () => {
    if (!accountInfo || !linkInfo || progressiveRetrievalState.isActive) return;

    console.log('🚀 开始渐进式获取短信流程');
    
    try {
      const accountId = accountInfo.id;
      console.log('🔍 使用账号ID:', accountId);
      
      if (!accountId) {
        console.error('❌ 账号ID无效:', accountId);
        setError('账号ID无效，无法获取短信规则');
        return;
      }
      
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
      const waitTime = linkInfo.verification_wait_time;
      
      if (!waitTime) {
        console.error('❌ 验证码等待时间未设置:', linkInfo);
        setError('验证码等待时间未配置，请联系管理员设置');
        return;
      }
      
      console.log('📊 从数据库获取真实显示条数:', displayCount, '(规则:', rule.rule_name, ')');
      console.log('⏰ 使用用户设置的验证码等待时间:', waitTime, '秒');

      const smsSlots: SmsSlot[] = Array.from({ length: displayCount }, (_, index) => ({
        index: index + 1,
        countdown: (index + 1) * waitTime,
        status: 'waiting',
        sms: undefined,
        message: `正在等待第 ${index + 1} 条短信`
      }));

      setProgressiveRetrievalState({
        isActive: true,
        totalCount: displayCount,
        smsSlots: smsSlots,
        retrievedSmsIds: new Set()
      });

      sessionStorage.removeItem('progressiveRetrievalState');
      sessionStorage.removeItem('savedVerificationCodes');

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

      console.log('🔍 检查API返回的完整数据结构:', JSON.stringify(data, null, 2));
      
      if (data.success && data.data) {
        if (data.data.verification_count !== undefined) {
          console.log(`📊 从API获取到验证码次数: ${data.data.verification_count}`);
          setLinkInfo(prev => {
            if (prev) {
              const updated = {
                ...prev,
                verification_count: data.data.verification_count
              };
              console.log('📊 更新前的linkInfo:', prev);
              console.log('📊 更新后的linkInfo:', updated);
              return updated;
            }
            return null;
          });
        } else {
          console.warn('⚠️ API响应中没有verification_count字段');
        }
        
        if (data.data.max_verification_count !== undefined) {
          setLinkInfo(prev => prev ? {
            ...prev,
            max_verification_count: data.data.max_verification_count
          } : null);
        }
      }

      if (data.success && data.data?.all_matched_sms?.length > 0) {
        const newSms = data.data.all_matched_sms.filter((sms: any) => 
          !progressiveRetrievalState.retrievedSmsIds.has(sms.id)
        );

        if (newSms.length > 0) {
          const latestSms = newSms[0];
          
          let extractedCode = latestSms.content;
          let smartRecognition = null;
          
          if (data.data.smart_recognition && data.data.smart_recognition.best_code) {
            extractedCode = data.data.smart_recognition.best_code.code;
            smartRecognition = data.data.smart_recognition;
            console.log('🧠 使用智能识别的验证码:', extractedCode, '置信度:', data.data.smart_recognition.best_code.confidence);
          } else {
            extractedCode = extractVerificationCode(latestSms.content) || latestSms.content;
            console.log('🔧 使用本地提取的验证码:', extractedCode);
          }
          
          const newCode: VerificationCode = {
            id: latestSms.id,
            code: extractedCode,
            received_at: latestSms.sms_timestamp || new Date().toISOString(),
            is_used: false,
            full_content: latestSms.content,
            sender: latestSms.sender,
            progressive_index: smsIndex,
            smart_recognition: smartRecognition
          };
          
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

          setAccountInfo(prev => prev ? {
            ...prev,
            verification_codes: [...(prev.verification_codes || []), newCode]
          } : null);

          console.log(`📱 第 ${smsIndex} 条短信获取成功:`, newCode.code);
          message.success(`第 ${smsIndex} 条短信获取成功: ${newCode.code}`);
        } else {
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

  useEffect(() => {
    if (!progressiveRetrievalState.isActive) return;

    const timer = setInterval(() => {
      setProgressiveRetrievalState(prev => {
        const updatedSlots = prev.smsSlots.map(slot => {
          if (slot.status === 'waiting' && slot.countdown > 0) {
            const newCountdown = slot.countdown - 1;
            
            if (newCountdown <= 0) {
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

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success(`${type}已复制到剪贴板`);
    } catch (err) {
      console.error('复制失败:', err);
      message.error('复制失败，请手动复制');
    }
  };

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

  useEffect(() => {
    if (accessSessionCountdown > 0) {
      accessCountdownRef.current = setInterval(() => {
        setAccessSessionCountdown(prev => {
          const newCountdown = prev - 1;
          
          if (newCountdown <= 0) {
            console.log('⏰ 访问会话倒计时结束，准备更新访问次数');
            
            if (currentLinkId) {
              axios.get(`${API_BASE_URL}/api/get_account_info`, {
                params: { link_id: currentLinkId }
              })
              .then(response => {
                if (response.data.success) {
                  const linkData = response.data.data.link_info;
                  console.log('✅ 访问次数更新成功:', linkData);
                  
                  setLinkInfo(prev => prev ? {
                    ...prev,
                    access_count: linkData.access_count
                  } : null);
                  
                  if (linkData.access_count >= linkData.max_access_count) {
                    console.log('🚫 访问次数已达上限，跳转到受限状态');
                    setAccessDenied(true);
                    message.warning('访问次数已达上限');
                  } else {
                    if (linkInfo?.access_session_interval) {
                      const newCountdownSeconds = linkInfo.access_session_interval * 60;
                      setAccessSessionCountdown(newCountdownSeconds);
                      console.log('🔄 重新开始访问会话倒计时:', newCountdownSeconds, '秒');
                    }
                    
                    const percentage = Math.round((linkData.access_count / linkData.max_access_count) * 100);
                    if (percentage >= 80) {
                      message.warning(`访问次数已使用 ${percentage}%，请注意访问频率`);
                    } else {
                      message.info(`访问次数已更新: ${linkData.access_count}/${linkData.max_access_count}`);
                    }
                  }
                } else {
                  console.error('❌ 访问次数更新失败:', response.data.message);
                }
              })
              .catch(error => {
                console.error('❌ 访问次数更新请求失败:', error);
                if (linkInfo?.access_session_interval) {
                  const newCountdownSeconds = linkInfo.access_session_interval * 60;
                  setAccessSessionCountdown(newCountdownSeconds);
                  console.log('🔄 API失败，仍重新开始访问会话倒计时:', newCountdownSeconds, '秒');
                }
              });
            }
            
            return 0;
          }
          
          return newCountdown;
        });
      }, 1000);
    } else {
      if (accessCountdownRef.current) {
        clearInterval(accessCountdownRef.current);
        accessCountdownRef.current = null;
      }
    }

    return () => {
      if (accessCountdownRef.current) {
        clearInterval(accessCountdownRef.current);
        accessCountdownRef.current = null;
      }
    };
  }, [accessSessionCountdown, currentLinkId, linkInfo?.access_session_interval]);

  useEffect(() => {
    if (progressiveRetrievalState.isActive || progressiveRetrievalState.smsSlots.length > 0) {
      try {
        const stateToSave = {
          ...progressiveRetrievalState,
          retrievedSmsIds: Array.from(progressiveRetrievalState.retrievedSmsIds)
        };
        sessionStorage.setItem('progressiveRetrievalState', JSON.stringify(stateToSave));
        console.log('💾 保存渐进式获取状态到sessionStorage');
      } catch (error) {
        console.error('❌ 保存渐进式获取状态失败:', error);
      }
    }
  }, [progressiveRetrievalState]);

  useEffect(() => {
    if (accountInfo?.verification_codes && accountInfo.verification_codes.length > 0) {
      try {
        sessionStorage.setItem('savedVerificationCodes', JSON.stringify(accountInfo.verification_codes));
        console.log('💾 保存已获取的短信到sessionStorage:', accountInfo.verification_codes.length, '条');
      } catch (error) {
        console.error('❌ 保存已获取短信失败:', error);
      }
    }
  }, [accountInfo?.verification_codes]);

  const clearSessionStorage = useCallback(() => {
    try {
      sessionStorage.removeItem('progressiveRetrievalState');
      sessionStorage.removeItem('savedVerificationCodes');
      console.log('🗑️ 清空sessionStorage - 重新打开页面');
    } catch (error) {
      console.error('❌ 清空sessionStorage失败:', error);
    }
  }, []);

  useEffect(() => {
    const hasProgressiveState = sessionStorage.getItem('progressiveRetrievalState');
    const hasSavedSms = sessionStorage.getItem('savedVerificationCodes');
    
    if (!hasProgressiveState && !hasSavedSms) {
      console.log('🆕 重新打开页面 - 清空所有状态');
      clearSessionStorage();
    }
    
    fetchAccountInfo();
    fetchCustomerSettings();
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [currentLinkId, clearSessionStorage]);

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
        background: customerSettings.enableCustomerSiteCustomization ? customerSettings.customerSiteBackgroundColor : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px'
      }}>
        <div style={{ 
          maxWidth: 800, 
          margin: '0 auto', 
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>
          {/* 客户端欢迎文本 */}
          {customerSettings.enableCustomerSiteCustomization && customerSettings.customerSiteWelcomeText && (
            <Card
              style={{
                borderRadius: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                background: 'rgba(255,255,255,0.95)',
                width: '100%',
                flex: '0 0 auto'
              }}
            >
              <div
                dangerouslySetInnerHTML={{ __html: customerSettings.customerSiteWelcomeText }}
                style={{ fontSize: 14, color: '#333', lineHeight: '1.6' }}
              />
            </Card>
          )}

          {/* 账号信息卡片 */}
          <Card 
            className="customer-card"
            style={{ 
              borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
              width: '100%',
              maxWidth: '100%',
              flex: '1 1 auto'
            }}
          >
            <Row gutter={[24, 24]} align="stretch">
              <Col xs={24} sm={8} style={{ display: 'flex' }}>
                <div style={{ 
                  textAlign: 'center',
                  padding: '24px 16px',
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  minHeight: '200px'
                }}>
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
                </div>
              </Col>
              
              <Col xs={24} sm={16} style={{ display: 'flex' }}>
                <div style={{ 
                  padding: '24px 16px',
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  minHeight: '200px'
                }}>
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
                </div>
              </Col>
            </Row>
          </Card>

          {/* 获取验证码按钮 - 移到独立位置，手机和电脑都明显 */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            padding: '16px 0'
          }}>
            <Button
              type="primary"
              size="large"
              icon={<CheckCircleOutlined />}
              onClick={startProgressiveRetrieval}
              disabled={
                progressiveRetrievalState.isActive || 
                (linkInfo && (linkInfo.verification_count || 0) >= linkInfo.max_verification_count)
              }
              loading={loading}
              style={{
                height: '48px',
                fontSize: '16px',
                fontWeight: 'bold',
                borderRadius: '24px',
                padding: '0 32px',
                boxShadow: '0 4px 16px rgba(24, 144, 255, 0.3)',
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

          {/* 验证码卡片 */}
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MobileOutlined style={{ color: '#1890ff' }} />
                <Text strong style={{ color: '#1890ff' }}>验证码信息</Text>
                {lastRefresh && (
                  <Text type="secondary" style={{ fontSize: 12, marginLeft: 'auto' }}>
                    最后更新: {formatTime(lastRefresh.toISOString())}
                  </Text>
                )}
              </div>
            }
            style={{ 
              borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
              width: '100%',
              flex: '0 0 auto'
            }}
          >
            {/* 渐进式获取状态显示 */}
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

            {/* 短信列表 */}
            {accountInfo.verification_codes && accountInfo.verification_codes.length > 0 ? (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {accountInfo.verification_codes
                  .sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime())
                  .map((sms) => {
                    const freshness = getCodeFreshness(sms.received_at);
                    const fullContent = sms.full_content || sms.code;
                    const extractedCode = sms.code;
                    
                    return (
                      <Card
                        key={sms.id}
                        size="small"
                        style={{
                          background: sms.is_used ? '#f5f5f5' : '#fff',
                          border: `2px solid ${sms.is_used ? '#d9d9d9' : '#1890ff'}`,
                          borderRadius: 12,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}
                      >
                        <Space direction="vertical" size={12} style={{ width: '100%' }}>
                          {/* 短信头部信息 */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              {sms.progressive_index && (
                                <Tag color="blue" size="small">
                                  第{sms.progressive_index}条
                                </Tag>
                              )}
                              {sms.is_used && (
                                <Tag color="default" size="small">已使用</Tag>
                              )}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <ClockCircleOutlined style={{ color: freshness.color }} />
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  {formatTime(sms.received_at)}
                                </Text>
                                <Tag color={freshness.color} size="small">
                                  {freshness.text}
                                </Tag>
                              </div>
                            </div>
                            {sms.sender && (
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                来自: {sms.sender}
                              </Text>
                            )}
                          </div>

                          {/* 完整短信内容 */}
                          <div style={{
                            padding: '12px 16px',
                            background: '#f8f9fa',
                            borderRadius: 8,
                            border: '1px solid #e9ecef',
                            lineHeight: '1.6',
                            maxWidth: '100%',
                            overflow: 'hidden'
                          }}>
                            <Text style={{ 
                              fontSize: 14,
                              color: '#333',
                              wordBreak: 'break-all',
                              whiteSpace: 'pre-wrap',
                              display: 'block',
                              width: '100%',
                              maxWidth: '100%'
                            }}>
                              {fullContent}
                            </Text>
                          </div>

                          {/* 提取的验证码 */}
                          {extractedCode && extractedCode !== fullContent && (
                            <div style={{
                              padding: '8px 12px',
                              background: '#e6f7ff',
                              borderRadius: 6,
                              border: '1px solid #91d5ff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Text type="secondary" style={{ fontSize: 12 }}>识别的验证码:</Text>
                                <Text
                                  strong
                                  style={{
                                    fontSize: 16,
                                    fontFamily: 'monospace',
                                    color: '#1890ff',
                                    letterSpacing: '1px'
                                  }}
                                >
                                  {extractedCode}
                                </Text>
                              </div>
                            </div>
                          )}

                          {/* 复制按钮组 */}
                          <div style={{ 
                            display: 'flex', 
                            gap: 8, 
                            justifyContent: 'flex-end',
                            paddingTop: 8,
                            borderTop: '1px solid #f0f0f0'
                          }}>
                            <Button
                              type="default"
                              icon={<CopyOutlined />}
                              size="small"
                              onClick={() => copyToClipboard(fullContent, '短信全文')}
                              disabled={sms.is_used}
                            >
                              复制全文
                            </Button>
                            {extractedCode && extractedCode !== fullContent && (
                              <Button
                                type="primary"
                                ghost
                                icon={<CopyOutlined />}
                                size="small"
                                onClick={() => copyToClipboard(extractedCode, '验证码')}
                                disabled={sms.is_used}
                              >
                                复制验证码
                              </Button>
                            )}
                          </div>
                        </Space>
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
                borderRadius: 12,
                background: 'rgba(255,255,255,0.95)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                width: '100%',
                flex: '0 0 auto'
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

                {/* 验证码获取次数统计 */}
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

                {/* 访问会话倒计时显示 */}
                {linkInfo.access_session_interval && (
                  <div style={{ 
                    padding: '12px 16px',
                    background: accessSessionCountdown > 0 ? '#fff7e6' : '#f0f9ff',
                    borderRadius: 8,
                    border: `1px solid ${accessSessionCountdown > 0 ? '#ffd591' : '#91d5ff'}`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <ClockCircleOutlined style={{ color: accessSessionCountdown > 0 ? '#fa8c16' : '#1890ff' }} />
                      <Text strong style={{ color: accessSessionCountdown > 0 ? '#fa8c16' : '#1890ff' }}>
                        {accessSessionCountdown > 0 ? '访问会话倒计时' : '访问会话间隔'}
                      </Text>
                    </div>
                    
                    {accessSessionCountdown > 0 ? (
                      <Row justify="space-between" align="middle">
                        <Col>
                          <Text style={{ color: '#fa8c16', fontSize: 12 }}>
                            会话倒计时: {Math.floor(accessSessionCountdown / 60)}分{accessSessionCountdown % 60}秒后访问次数+1
                          </Text>
                        </Col>
                        <Col>
                          <Text 
                            style={{ 
                              fontSize: 16, 
                              fontWeight: 'bold', 
                              color: '#fa8c16',
                              fontFamily: 'monospace'
                            }}
                          >
                            {accessSessionCountdown}s
                          </Text>
                        </Col>
                      </Row>
                    ) : (
                      <Text style={{ color: '#666', fontSize: 12 }}>
                        建议访问间隔：{linkInfo.access_session_interval} 分钟，避免频繁访问
                      </Text>
                    )}
                  </div>
                )}
              </Space>
            </Card>
          )}

          {/* 客户端页脚文本 */}
          {customerSettings.enableCustomerSiteCustomization && customerSettings.customerSiteFooterText && (
            <Card
              style={{
                borderRadius: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                background: 'rgba(255,255,255,0.95)',
                width: '100%',
                flex: '0 0 auto'
              }}
            >
              <div
                dangerouslySetInnerHTML={{ __html: customerSettings.customerSiteFooterText }}
                style={{ fontSize: 12, color: '#666', textAlign: 'center', lineHeight: '1.6' }}
              />
            </Card>
          )}
        </div>
      </div>
    </ConfigProvider>
  );
};

export default CustomerPage;
