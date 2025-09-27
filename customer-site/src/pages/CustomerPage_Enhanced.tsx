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
  verification_count?: number;
  max_verification_count?: number;
  created_at: string;
  verification_wait_time?: number;
  account_id?: number;
  access_session_interval?: number;
  last_access_time?: string;
}

interface CustomerSiteSettings {
  customerSiteTitle: string;
  customerSiteDescription: string;
  customerSiteWelcomeText: string;
  customerSiteFooterText: string;
  customerSiteBackgroundColor: string;
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
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [customerSettings, setCustomerSettings] = useState<CustomerSiteSettings | null>(null);
  
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

  // 🔥 新增：访问会话间隔倒计时状态
  const [accessSessionCountdown, setAccessSessionCountdown] = useState<number>(0);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const accessCountdownRef = useRef<NodeJS.Timeout | null>(null);

  // 获取链接ID（从URL参数或查询参数）
  const currentLinkId = linkId || searchParams.get('link_id');

  // 获取客户端设置
  const fetchCustomerSettings = async () => {
    try {
      console.log('🔧 开始获取客户端设置...');
      console.log('🔗 API URL:', `${API_BASE_URL}/api/settings/customer-site/public`);
      
      // 使用公开API端点，无需认证
      const response = await axios.get(`${API_BASE_URL}/api/settings/customer-site/public`);
      
      console.log('📥 客户端设置API响应:', response.data);
      
      if (response.data.success) {
        console.log('✅ 客户端设置获取成功:', response.data.data);
        setCustomerSettings(response.data.data);
        
        // 动态设置页面标题
        if (response.data.data.customerSiteTitle) {
          document.title = response.data.data.customerSiteTitle;
          console.log('📄 页面标题已更新为:', response.data.data.customerSiteTitle);
        }
        
        // 检查欢迎文本
        if (response.data.data.customerSiteWelcomeText) {
          console.log('🎉 欢迎文本内容:', response.data.data.customerSiteWelcomeText);
        }
      } else {
        console.warn('⚠️ 客户端设置API返回失败:', response.data);
        throw new Error('API返回失败');
      }
    } catch (error) {
      console.error('❌ 获取客户端设置失败，使用默认设置:', error);
      // 使用默认设置
      const defaultSettings = {
        customerSiteTitle: '验证码获取服务',
        customerSiteDescription: '安全便捷的验证码获取服务',
        customerSiteWelcomeText: '<h2>欢迎使用验证码获取服务</h2><p>请按照以下步骤获取您的验证码：</p><ol><li>复制用户名和密码</li><li>点击获取验证码按钮</li><li>等待验证码到达</li></ol>',
        customerSiteFooterText: '<p>如有问题，请联系客服。</p>',
        customerSiteBackgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        customerSiteCustomCSS: '',
        enableCustomerSiteCustomization: true
      };
      console.log('🔄 使用默认设置:', defaultSettings);
      setCustomerSettings(defaultSettings);
    }
  };

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
        setLastRefresh(new Date());

        // 🔥 关键修复：页面加载时立即检查访问次数是否已达上限
        console.log('🔍 页面加载时检查访问次数限制:', {
          current: linkData.access_count,
          max: linkData.max_access_count,
          isLimitReached: linkData.access_count >= linkData.max_access_count
        });

        // 🔥 新增：页面加载时也检查验证码次数限制
        console.log('🔍 页面加载时检查验证码次数限制:', {
          verificationCurrent: linkData.verification_count,
          verificationMax: linkData.max_verification_count,
          isVerificationLimitReached: linkData.verification_count !== undefined && linkData.max_verification_count !== undefined && linkData.verification_count >= linkData.max_verification_count
        });

        if (linkData.access_count >= linkData.max_access_count) {
          console.log('🚫 页面加载时发现访问次数已达上限，立即跳转到访问受限页面');
          setAccessDenied(true);
          setError('此链接的访问次数已达上限，无法继续访问，请联系管理员。');
          setLoading(false);
          return; // 停止后续处理
        }

        // 如果没有达到上限，继续正常流程
        setAccessDenied(false);
        setError(null);

        // 🔥 新增：计算访问会话间隔倒计时
        if (linkData.last_access_time && linkData.access_session_interval) {
          const lastAccessTime = new Date(linkData.last_access_time);
          const sessionIntervalMs = linkData.access_session_interval * 60 * 1000; // 分钟转毫秒
          const elapsedTime = Date.now() - lastAccessTime.getTime();
          const remainingTime = Math.max(0, sessionIntervalMs - elapsedTime);
          const remainingSeconds = Math.ceil(remainingTime / 1000);
          
          console.log('⏰ 访问会话间隔倒计时计算:', {
            lastAccessTime: linkData.last_access_time,
            sessionInterval: linkData.access_session_interval,
            elapsedMs: elapsedTime,
            remainingMs: remainingTime,
            remainingSeconds
          });

          setAccessSessionCountdown(remainingSeconds);
        }

        // 🔥 关键修复：只在页面刷新时保留短信，新打开页面时不保留
        // 检测是否为页面刷新：通过检查performance.navigation.type
        const isPageRefresh = performance.navigation && performance.navigation.type === 1;
        const isBackForward = performance.navigation && performance.navigation.type === 2;
        
        console.log('🔍 页面加载类型检测:', {
          navigationType: performance.navigation?.type,
          isPageRefresh,
          isBackForward,
          userAgent: navigator.userAgent
        });

        if (isPageRefresh || isBackForward) {
          console.log('🔄 检测到页面刷新或前进后退，保留已有短信');
          await fetchExistingSms();
        } else {
          console.log('🆕 检测到新打开页面，不保留短信，从空白状态开始');
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

  // 🔥 恢复功能：获取已有的短信（页面刷新时保留验证码）
  const fetchExistingSms = async () => {
    if (!currentLinkId) return;

    try {
      console.log('🔄 获取已有短信，保留页面刷新前的验证码...');
      console.log('🔗 API URL:', `${API_BASE_URL}/api/get_existing_sms?link_id=${currentLinkId}`);
      
      const response = await fetch(`${API_BASE_URL}/api/get_existing_sms?link_id=${currentLinkId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('📡 API响应状态:', response.status);

      if (!response.ok) {
        console.warn('获取已有短信失败，继续正常流程，状态码:', response.status);
        return;
      }

      const data = await response.json();
      console.log('📥 已有短信API响应:', data);

      if (data.success && data.data?.all_matched_sms?.length > 0) {
        // 将已有短信转换为验证码格式
        const existingCodes: VerificationCode[] = data.data.all_matched_sms.map((sms: any, index: number) => {
          const extractedCode = extractVerificationCode(sms.content);
          return {
            id: sms.id,
            code: extractedCode || sms.content,
            received_at: sms.sms_timestamp || new Date().toISOString(),
            is_used: false,
            full_content: sms.content,
            sender: sms.sender,
            progressive_index: index + 1
          };
        });

        console.log('🔄 转换后的验证码数据:', existingCodes);

        // 更新账号信息，保留已有的验证码
        setAccountInfo(prev => {
          const updated = prev ? {
            ...prev,
            verification_codes: existingCodes
          } : null;
          console.log('📱 更新后的accountInfo:', updated);
          return updated;
        });

        console.log(`✅ 页面刷新保留了 ${existingCodes.length} 条已有验证码`);
        message.success(`页面刷新保留了 ${existingCodes.length} 条已有验证码`);
      } else {
        console.log('📭 没有已有短信需要保留');
      }
    } catch (error) {
      console.error('❌ 获取已有短信失败:', error);
      // 不影响主流程，继续正常运行
    }
  };

  // 🔥 开始渐进式获取短信 - 为每条短信创建独立倒计时
  const startProgressiveRetrieval = useCallback(async () => {
    if (!linkInfo || progressiveRetrievalState.isActive) return;

    console.log('🚀 开始渐进式获取短信流程');
    
    try {
      // 获取短信规则配置
      const rulesResponse = await fetch(`${API_BASE_URL}/api/sms_rules?account_id=${linkInfo.account_id}`, {
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
      const waitTime = linkInfo.verification_wait_time || 10;
      
      console.log('📊 从数据库获取真实显示条数:', displayCount, '(规则:', rule.rule_name, ')');

      // 🔥 为每条短信创建独立的倒计时槽位
      const smsSlots: SmsSlot[] = Array.from({ length: displayCount }, (_, index) => ({
        index: index + 1,
        countdown: (index + 1) * waitTime, // 递增倒计时：第1条10秒，第2条20秒，第3条30秒...
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
  }, [linkInfo, progressiveRetrievalState.isActive]);

  // 🔥 获取指定序号的短信（优化版本，增加重试机制）
  const retrieveSpecificSms = useCallback(async (smsIndex: number, retryCount: number = 0) => {
    if (!currentLinkId) return;

    const maxRetries = 3; // 最大重试次数
    const retryDelay = 2000; // 重试延迟2秒

    console.log(`🔍 正在获取第 ${smsIndex} 条短信... (尝试 ${retryCount + 1}/${maxRetries + 1})`);

    try {
      const response = await fetch(`${API_BASE_URL}/api/get_verification_code?link_id=${currentLinkId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // 🔥 优化：处理429错误（频率限制）
      if (response.status === 429) {
        console.warn(`⚠️ 第 ${smsIndex} 条短信获取遇到频率限制 (HTTP 429)`);
        
        if (retryCount < maxRetries) {
          console.log(`🔄 将在 ${retryDelay/1000} 秒后重试第 ${smsIndex} 条短信...`);
          
          // 更新槽位状态为等待重试
          setProgressiveRetrievalState(prev => ({
            ...prev,
            smsSlots: prev.smsSlots.map(slot => 
              slot.index === smsIndex 
                ? { 
                    ...slot, 
                    status: 'waiting',
                    countdown: Math.ceil(retryDelay / 1000),
                    message: `第 ${smsIndex} 条短信重试中... (${retryCount + 1}/${maxRetries + 1})`
                  }
                : slot
            )
          }));

          // 延迟后重试
          setTimeout(() => {
            retrieveSpecificSms(smsIndex, retryCount + 1);
          }, retryDelay);
          
          return;
        } else {
          console.error(`❌ 第 ${smsIndex} 条短信重试次数已达上限`);
          throw new Error(`频率限制，重试失败`);
        }
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log(`✅ 第 ${smsIndex} 条短信API响应:`, data);

      if (data.success) {
        // 🔥 关键修复：无论是否有短信都要更新统计数据
        if (data.data?.verification_count !== undefined && data.data?.max_verification_count !== undefined) {
          console.log(`📊 API返回统计数据: ${data.data.verification_count}/${data.data.max_verification_count}`);
          
          setLinkInfo(prev => {
            const updated = prev ? {
              ...prev,
              verification_count: data.data.verification_count,
              max_verification_count: data.data.max_verification_count
            } : null;
            console.log(`📊 更新后的linkInfo:`, updated);
            return updated;
          });
          
          // 🔥 友好提示：检查是否达到阈值
          if (data.data.verification_count >= data.data.max_verification_count) {
            message.warning({
              content: '验证码获取次数已达上限！如需继续使用，请联系管理员。',
              duration: 8,
              style: {
                marginTop: '20vh',
              },
            });
          } else if (data.data.verification_count >= data.data.max_verification_count * 0.8) {
            // 达到80%时提醒
            const remaining = data.data.max_verification_count - data.data.verification_count;
            message.info({
              content: `提醒：验证码获取次数即将达到上限，还剩 ${remaining} 次。`,
              duration: 5,
            });
          }
        }

        if (data.data?.all_matched_sms?.length > 0) {
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
          // 没有匹配的短信，标记为完成
          setProgressiveRetrievalState(prev => ({
            ...prev,
            smsSlots: prev.smsSlots.map(slot => 
              slot.index === smsIndex 
                ? { 
                    ...slot, 
                    status: 'completed',
                    message: `第 ${smsIndex} 条短信：无匹配短信`
                  }
                : slot
            )
          }));
          console.log(`⚠️ 第 ${smsIndex} 条短信: 无匹配短信`);
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
      console.error(`❌ 第 ${smsIndex} 条短信获取失败:`, error);
      
      // 🔥 优化：对于网络错误或其他错误，也尝试重试
      if (retryCount < maxRetries && error.message.includes('HTTP')) {
        console.log(`🔄 网络错误，将在 ${retryDelay/1000} 秒后重试第 ${smsIndex} 条短信...`);
        
        // 更新槽位状态为等待重试
        setProgressiveRetrievalState(prev => ({
          ...prev,
          smsSlots: prev.smsSlots.map(slot => 
            slot.index === smsIndex 
              ? { 
                  ...slot, 
                  status: 'waiting',
                  countdown: Math.ceil(retryDelay / 1000),
                  message: `第 ${smsIndex} 条短信重试中... (${retryCount + 1}/${maxRetries + 1})`
                }
              : slot
          )
        }));

        // 延迟后重试
        setTimeout(() => {
          retrieveSpecificSms(smsIndex, retryCount + 1);
        }, retryDelay);
        
        return;
      }
      
      // 错误处理，标记为完成
      setProgressiveRetrievalState(prev => ({
        ...prev,
        smsSlots: prev.smsSlots.map(slot => 
          slot.index === smsIndex 
            ? { 
                ...slot, 
                status: 'completed',
                message: retryCount > 0 ? `第 ${smsIndex} 条短信重试失败` : `第 ${smsIndex} 条短信获取失败`
              }
            : slot
        )
      }));
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

  // 🔥 新增：访问会话间隔倒计时效果
  useEffect(() => {
    if (accessSessionCountdown <= 0) return;

    accessCountdownRef.current = setInterval(() => {
      setAccessSessionCountdown(prev => {
        const newCountdown = prev - 1;
        
        if (newCountdown <= 0) {
          console.log('⏰ 访问会话间隔倒计时结束，访问次数即将增加');
          
          // 🔥 关键修复：倒计时结束时主动调用API更新访问次数
          const updateAccessCount = async () => {
            try {
              console.log('🔄 倒计时结束，调用API更新访问次数...');
              const response = await axios.get(`${API_BASE_URL}/api/get_account_info`, {
                params: { link_id: currentLinkId }
              });

              if (response.data.success) {
                const updatedLinkData = response.data.data.link_info;
                console.log('📊 API返回更新后的访问次数:', updatedLinkData.access_count);
                
                // 实时更新linkInfo状态
                setLinkInfo(prev => prev ? {
                  ...prev,
                  access_count: updatedLinkData.access_count,
                  last_access_time: updatedLinkData.last_access_time
                } : null);

                // 🔥 关键修复：检查访问次数是否达到上限，如果达到则跳转到访问受限页面
                console.log('🔍 检查访问次数限制:', {
                  current: updatedLinkData.access_count,
                  max: updatedLinkData.max_access_count,
                  isLimitReached: updatedLinkData.access_count >= updatedLinkData.max_access_count
                });

                if (updatedLinkData.access_count >= updatedLinkData.max_access_count) {
                  console.log('🚫 访问次数已达上限，立即跳转到访问受限页面');
                  
                  // 立即设置访问受限状态
                  setAccessDenied(true);
                  setError('此链接的访问次数已达上限，无法继续访问，请联系管理员。');
                  
                  // 清除倒计时
                  setAccessSessionCountdown(0);
                  if (accessCountdownRef.current) {
                    clearInterval(accessCountdownRef.current);
                  }
                  
                  // 显示跳转提示
                  message.warning({
                    content: '访问次数已达上限！页面正在跳转到访问受限状态。',
                    duration: 3,
                    style: {
                      marginTop: '20vh',
                    },
                  });
                  
                  // 强制重新渲染
                  setTimeout(() => {
                    console.log('🔄 强制重新渲染页面状态');
                    setLoading(false); // 确保不在加载状态
                  }, 100);
                  
                  return; // 停止后续处理
                }

                // 🔥 友好提示：根据新的访问次数提醒用户
                const newPercent = Math.round((updatedLinkData.access_count / updatedLinkData.max_access_count) * 100);
                
                if (newPercent >= 80) {
                  const remaining = updatedLinkData.max_access_count - updatedLinkData.access_count;
                  message.info({
                    content: `访问次数已增加！还剩 ${remaining} 次访问机会。`,
                    duration: 5,
                  });
                } else {
                  message.success({
                    content: `访问次数已增加至 ${updatedLinkData.access_count}/${updatedLinkData.max_access_count}`,
                    duration: 3,
                  });
                }

                // 重新计算下一次倒计时
                if (updatedLinkData.last_access_time && updatedLinkData.access_session_interval) {
                  const newLastAccessTime = new Date(updatedLinkData.last_access_time);
                  const sessionIntervalMs = updatedLinkData.access_session_interval * 60 * 1000;
                  const elapsedTime = Date.now() - newLastAccessTime.getTime();
                  const remainingTime = Math.max(0, sessionIntervalMs - elapsedTime);
                  const remainingSeconds = Math.ceil(remainingTime / 1000);
                  
                  console.log('⏰ 重新计算下一次访问会话倒计时:', remainingSeconds, '秒');
                  setAccessSessionCountdown(remainingSeconds);
                }
              }
            } catch (error) {
              console.error('❌ 更新访问次数失败:', error);
              message.error('更新访问次数失败，请刷新页面查看最新状态');
            }
          };

          // 异步更新访问次数
          updateAccessCount();
          
          return 0;
        }
        
        return newCountdown;
      });
    }, 1000);

    return () => {
      if (accessCountdownRef.current) {
        clearInterval(accessCountdownRef.current);
      }
    };
  }, [accessSessionCountdown, linkInfo, currentLinkId]);

  // 组件挂载时获取数据
  useEffect(() => {
    fetchAccountInfo();
    fetchCustomerSettings();
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (accessCountdownRef.current) {
        clearInterval(accessCountdownRef.current);
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
                {accessDenied ? '此链接的访问次数已达上限，无法继续访问，请联系管理员。' : error}
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
        background: customerSettings?.customerSiteBackgroundColor || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px',
        position: 'relative'
      }}>
        {/* 美化背景装饰 */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `
            radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 40% 40%, rgba(120, 119, 198, 0.2) 0%, transparent 50%)
          `,
          pointerEvents: 'none',
          zIndex: 0
        }} />
        
        {/* 自定义CSS样式 */}
        {customerSettings?.customerSiteCustomCSS && (
          <style dangerouslySetInnerHTML={{ __html: customerSettings.customerSiteCustomCSS }} />
        )}
        
        <div style={{ maxWidth: 800, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          {/* 自定义欢迎内容 */}
          {customerSettings?.enableCustomerSiteCustomization && customerSettings?.customerSiteWelcomeText && (
            <Card 
              style={{ 
                marginBottom: 24,
                borderRadius: 16,
                boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(10px)'
              }}
            >
              <div 
                dangerouslySetInnerHTML={{ __html: customerSettings.customerSiteWelcomeText }}
                style={{ 
                  textAlign: 'center',
                  lineHeight: '1.8',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}
              />
            </Card>
          )}

          {/* 账号信息卡片 */}
          <Card 
            className="customer-card"
            style={{ 
              marginBottom: 24,
              borderRadius: 16,
              boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(10px)',
              overflow: 'hidden'
            }}
          >
            {/* 卡片顶部装饰条 */}
            <div style={{
              height: '4px',
              background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
              margin: '-24px -24px 20px -24px'
            }} />
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
                <span style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#1890ff'
                }}>
                  <MobileOutlined style={{ marginRight: 8, fontSize: '18px' }} />
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
                      (linkInfo && linkInfo.verification_count !== undefined && linkInfo.max_verification_count !== undefined && 
                       linkInfo.verification_count >= linkInfo.max_verification_count)
                    }
                    loading={loading}
                    style={{
                      borderRadius: '8px',
                      background: progressiveRetrievalState.isActive ? '#faad14' : 
                                 (linkInfo && linkInfo.verification_count !== undefined && linkInfo.max_verification_count !== undefined && 
                                  linkInfo.verification_count >= linkInfo.max_verification_count) ? '#ff4d4f' : '#1890ff',
                      borderColor: 'transparent',
                      boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)',
                      fontWeight: '600'
                    }}
                  >
                    {progressiveRetrievalState.isActive ? '获取中...' : 
                     (linkInfo && linkInfo.verification_count !== undefined && linkInfo.max_verification_count !== undefined && 
                      linkInfo.verification_count >= linkInfo.max_verification_count) ? '已达上限' : '获取验证码'}
                  </Button>
                </div>
              </div>
            }
            style={{ 
              borderRadius: 16,
              boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(10px)',
              overflow: 'hidden'
            }}
          >
            {/* 卡片顶部装饰条 */}
            <div style={{
              height: '4px',
              background: 'linear-gradient(90deg, #52c41a 0%, #1890ff 100%)',
              margin: '-24px -24px 20px -24px'
            }} />
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
                  .map((code, index) => {
                    const freshness = getCodeFreshness(code.received_at);
                    const isLimitReached = linkInfo && linkInfo.verification_count !== undefined && linkInfo.max_verification_count !== undefined && linkInfo.verification_count >= linkInfo.max_verification_count;
                    
                    return (
                      <Card
                        key={code.id}
                        size="small"
                        style={{
                          background: code.is_used ? 'rgba(245,245,245,0.8)' : 'rgba(255,255,255,0.95)',
                          border: `2px solid ${code.is_used ? '#d9d9d9' : '#1890ff'}`,
                          borderRadius: 16,
                          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                          backdropFilter: 'blur(8px)',
                          overflow: 'hidden',
                          transition: 'all 0.3s ease',
                          position: 'relative'
                        }}
                      >
                        {/* 验证码卡片装饰条 */}
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '3px',
                          background: code.is_used ? 
                            'linear-gradient(90deg, #d9d9d9 0%, #f0f0f0 100%)' : 
                            'linear-gradient(90deg, #52c41a 0%, #1890ff 100%)'
                        }} />
                        
                        {/* 🔥 修复：在第一个验证码卡片顶部显示限制提示，不影响布局 */}
                        {index === 0 && isLimitReached && (
                          <div style={{
                            padding: '10px 16px',
                            marginTop: '8px',
                            marginBottom: '16px',
                            backgroundColor: 'rgba(255, 247, 230, 0.9)',
                            borderRadius: '8px',
                            border: '1px solid #ffd591',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            backdropFilter: 'blur(4px)'
                          }}>
                            <ExclamationCircleOutlined style={{ color: '#faad14', fontSize: 18 }} />
                            <Text style={{ fontSize: 13, color: '#d46b08', fontWeight: '500' }}>
                              验证码获取次数已达上限，无法继续获取新的验证码
                            </Text>
                          </div>
                        )}
                        
                        <div style={{ padding: index === 0 && isLimitReached ? '8px 16px 16px' : '16px' }}>
                          <Space direction="vertical" size={12} style={{ width: '100%' }}>
                            {/* 验证码显示区域 */}
                            <Row align="middle" justify="space-between">
                              <Col flex="auto">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <Text
                                    strong
                                    style={{
                                      fontSize: 24,
                                      fontFamily: 'SF Mono, Monaco, Consolas, monospace',
                                      color: code.is_used ? '#999' : '#1890ff',
                                      letterSpacing: '3px',
                                      textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}
                                  >
                                    {code.code}
                                  </Text>
                                  {code.is_used && (
                                    <Tag color="default" size="small" style={{ borderRadius: '12px' }}>已使用</Tag>
                                  )}
                                  {code.progressive_index && (
                                    <Tag color="blue" size="small" style={{ borderRadius: '12px' }}>
                                      第{code.progressive_index}条
                                    </Tag>
                                  )}
                                </div>
                              </Col>
                              <Col>
                                <Button
                                  type="primary"
                                  ghost
                                  icon={<CopyOutlined />}
                                  size="small"
                                  onClick={() => copyToClipboard(code.code, '验证码')}
                                  disabled={code.is_used}
                                  style={{
                                    borderRadius: '10px',
                                    fontWeight: '500',
                                    boxShadow: '0 2px 8px rgba(24, 144, 255, 0.2)'
                                  }}
                                >
                                  复制验证码
                                </Button>
                              </Col>
                            </Row>

                            {/* 🔥 强制显示完整短信内容区域 - 总是显示，不管是否有full_content */}
                            <div style={{
                              padding: '12px',
                              backgroundColor: 'rgba(240, 249, 255, 0.6)',
                              borderRadius: '8px',
                              border: '1px solid rgba(186, 230, 253, 0.8)',
                              position: 'relative'
                            }}>
                              <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'flex-start',
                                marginBottom: '8px'
                              }}>
                                <Text style={{ 
                                  fontSize: 12, 
                                  color: '#0369a1', 
                                  fontWeight: '600'
                                }}>
                                  完整短信内容
                                </Text>
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<CopyOutlined />}
                                  onClick={() => copyToClipboard(code.full_content || code.code || '', '短信全文')}
                                  style={{
                                    fontSize: '11px',
                                    height: '24px',
                                    padding: '0 8px',
                                    borderRadius: '6px',
                                    color: '#0369a1'
                                  }}
                                >
                                  复制全文
                                </Button>
                              </div>
                              <Text style={{ 
                                fontSize: 13, 
                                color: '#1e40af',
                                lineHeight: '1.5',
                                display: 'block',
                                wordBreak: 'break-all',
                                whiteSpace: 'pre-wrap'
                              }}>
                                {code.full_content || code.code || '短信内容获取中...'}
                              </Text>
                              {code.sender && (
                                <div style={{ 
                                  marginTop: '8px',
                                  paddingTop: '8px',
                                  borderTop: '1px solid rgba(186, 230, 253, 0.5)'
                                }}>
                                  <Text style={{ 
                                    fontSize: 11, 
                                    color: '#64748b',
                                    fontWeight: '500'
                                  }}>
                                    发送方: {code.sender}
                                  </Text>
                                </div>
                              )}
                              
                            </div>

                            {/* 时间信息 */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <ClockCircleOutlined style={{ color: freshness.color, fontSize: 14 }} />
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {formatTime(code.received_at)}
                              </Text>
                              <Tag color={freshness.color} size="small" style={{ borderRadius: '10px' }}>
                                {freshness.text}
                              </Tag>
                            </div>
                          </Space>
                        </div>
                      </Card>
                    );
                  })}
              </Space>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                {/* 🔥 修复：验证码次数达到上限时的提示 - 在空状态中显示，避免布局变化 */}
                {linkInfo && linkInfo.verification_count !== undefined && linkInfo.max_verification_count !== undefined && 
                 linkInfo.verification_count >= linkInfo.max_verification_count ? (
                  <div>
                    <ExclamationCircleOutlined style={{ fontSize: 48, color: '#faad14', marginBottom: 16 }} />
                    <Title level={4} style={{ color: '#faad14' }}>验证码获取次数已达上限</Title>
                    <Paragraph type="secondary">
                      您已达到验证码获取次数的上限，无法继续获取新的验证码。如需继续使用，请联系管理员。
                    </Paragraph>
                  </div>
                ) : (
                  <div>
                    <MobileOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
                    <Title level={4} type="secondary">暂无验证码</Title>
                    <Paragraph type="secondary">
                      点击"获取验证码"按钮开始获取短信验证码
                    </Paragraph>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* 访问和验证码统计 */}
          {linkInfo && (
            <Card
              size="small"
              style={{ 
                marginTop: 20,
                borderRadius: 16,
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.2)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                overflow: 'hidden'
              }}
            >
              {/* 统计卡片装饰条 */}
              <div style={{
                height: '3px',
                background: 'linear-gradient(90deg, #faad14 0%, #1890ff 50%, #52c41a 100%)',
                margin: '-16px -16px 16px -16px'
              }} />
              
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {/* 访问次数统计 */}
                <Row justify="space-between" align="middle" style={{
                  padding: '8px 12px',
                  backgroundColor: 'rgba(24, 144, 255, 0.05)',
                  borderRadius: '8px',
                  border: '1px solid rgba(24, 144, 255, 0.1)'
                }}>
                  <Col>
                    <Text style={{ fontSize: 13, fontWeight: '500', color: '#1890ff' }}>
                      访问次数: {linkInfo.access_count} / {linkInfo.max_access_count}
                    </Text>
                  </Col>
                  <Col>
                    <Progress
                      percent={Math.round((linkInfo.access_count / linkInfo.max_access_count) * 100)}
                      size="small"
                      style={{ width: 120 }}
                      strokeColor={{
                        '0%': '#1890ff',
                        '100%': linkInfo.access_count >= linkInfo.max_access_count ? '#ff4d4f' : '#52c41a'
                      }}
                      trailColor="rgba(24, 144, 255, 0.1)"
                    />
                  </Col>
                </Row>

                {/* 🔥 新增：访问会话间隔倒计时 */}
                {linkInfo.access_session_interval && accessSessionCountdown > 0 && (
                  <Row justify="space-between" align="middle" style={{ 
                    padding: '10px 14px',
                    backgroundColor: 'rgba(250, 173, 20, 0.1)',
                    borderRadius: '8px',
                    border: '1px solid rgba(250, 173, 20, 0.2)',
                    background: 'linear-gradient(135deg, rgba(255, 247, 230, 0.8) 0%, rgba(255, 247, 230, 0.4) 100%)'
                  }}>
                    <Col>
                      <Text style={{ fontSize: 13, fontWeight: '500', color: '#fa8c16' }}>
                        会话倒计时: {Math.floor(accessSessionCountdown / 60)}分{accessSessionCountdown % 60}秒后访问次数+1
                      </Text>
                    </Col>
                    <Col>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '10px',
                        padding: '4px 8px',
                        backgroundColor: 'rgba(250, 173, 20, 0.15)',
                        borderRadius: '6px'
                      }}>
                        <ClockCircleOutlined style={{ color: '#fa8c16', fontSize: 16 }} />
                        <Text 
                          style={{ 
                            fontSize: 16, 
                            fontWeight: 'bold', 
                            color: '#fa8c16',
                            fontFamily: 'SF Mono, Monaco, Consolas, monospace',
                            minWidth: '45px',
                            textAlign: 'center'
                          }}
                        >
                          {accessSessionCountdown}s
                        </Text>
                      </div>
                    </Col>
                  </Row>
                )}

                {/* 验证码获取统计 */}
                <Row justify="space-between" align="middle" style={{
                  padding: '8px 12px',
                  backgroundColor: 'rgba(82, 196, 26, 0.05)',
                  borderRadius: '8px',
                  border: '1px solid rgba(82, 196, 26, 0.1)'
                }}>
                  <Col>
                    <Text style={{ fontSize: 13, fontWeight: '500', color: '#52c41a' }}>
                      验证码次数: {linkInfo.verification_count || 0} / {linkInfo.max_verification_count || 0}
                    </Text>
                  </Col>
                  <Col>
                    <Progress
                      percent={linkInfo.max_verification_count ? Math.round(((linkInfo.verification_count || 0) / linkInfo.max_verification_count) * 100) : 0}
                      size="small"
                      style={{ width: 120 }}
                      strokeColor={{
                        '0%': '#52c41a',
                        '100%': (linkInfo.verification_count || 0) >= (linkInfo.max_verification_count || 0) ? '#ff4d4f' : '#52c41a'
                      }}
                      trailColor="rgba(82, 196, 26, 0.1)"
                    />
                  </Col>
                </Row>

                {/* 总体使用情况 */}
                <Row justify="space-between" align="middle" style={{ 
                  paddingTop: 12, 
                  borderTop: '1px solid rgba(0,0,0,0.06)',
                  marginTop: 8
                }}>
                  <Col>
                    <Text type="secondary" style={{ fontSize: 12, fontWeight: '500' }}>
                      总使用率: {Math.round(((linkInfo.access_count + (linkInfo.verification_count || 0)) / (linkInfo.max_access_count + (linkInfo.max_verification_count || 0))) * 100)}%
                    </Text>
                  </Col>
                  <Col>
                    <Text type="secondary" style={{ fontSize: 12, fontWeight: '500' }}>
                      创建时间: {new Date(linkInfo.created_at).toLocaleDateString('zh-CN')}
                    </Text>
                  </Col>
                </Row>
              </Space>
            </Card>
          )}

          {/* 自定义页脚内容 */}
          {customerSettings?.enableCustomerSiteCustomization && customerSettings?.customerSiteFooterText && (
            <Card 
              size="small"
              style={{ 
                marginTop: 24,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.9)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.2)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                textAlign: 'center'
              }}
            >
              <div 
                dangerouslySetInnerHTML={{ __html: customerSettings.customerSiteFooterText }}
                style={{ 
                  fontSize: '14px',
                  color: '#666',
                  lineHeight: '1.6'
                }}
              />
            </Card>
          )}
        </div>
      </div>
    </ConfigProvider>
  );
};

export default CustomerPage;
