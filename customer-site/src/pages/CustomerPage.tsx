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
  Progress
} from 'antd';
import {
  UserOutlined,
  MobileOutlined,
  CopyOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import axios from 'axios';
import API_BASE_URL from '../config/api';

const { Title, Text, Paragraph } = Typography;

interface AccountInfo {
  id: number;
  account_name: string;
  username: string;
  password: string;
  type: string;
  image_url?: string;
  status: string;
}

interface SMS {
  id: number;
  sender: string;
  content: string;
  sms_timestamp: string;
  category: string;
  verification_code?: string;
}

interface LinkInfo {
  id: number;
  link_id: string;
  access_count: number;
  max_access_count: number;
  verification_count: number;
  max_verification_count: number;
  verification_wait_time: number;
  last_verification_time: string | null;
  is_active: boolean;
  created_at: string;
}

interface SmsSlot {
  index: number;
  countdown: number;
  totalTime: number;
  sms: SMS | null;
  status: 'waiting' | 'completed' | 'failed';
}

const CustomerPage: React.FC = () => {
  const { linkId } = useParams<{ linkId: string }>();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [error, setError] = useState<string>('');
  const [accessDenied, setAccessDenied] = useState(false);
  
  // 🔥 新增：倍数倒计时短信槽位系统
  const [smsSlots, setSmsSlots] = useState<SmsSlot[]>([]);
  const [excludedSmsIds, setExcludedSmsIds] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // 定时器引用
  const timersRef = useRef<{ [key: number]: number }>({});

  const currentLinkId = linkId || searchParams.get('link_id');

  useEffect(() => {
    if (currentLinkId) {
      fetchAccountInfo();
    } else {
      setError('无效的访问链接');
      setLoading(false);
    }
  }, [currentLinkId]);

  // 清理定时器
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(timer => window.clearTimeout(timer));
    };
  }, []);

  const fetchAccountInfo = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await axios.get(`${API_BASE_URL}/api/get_account_info?link_id=${currentLinkId}`);
      
      if (response.data.success) {
        setAccountInfo(response.data.data.account_info);
        setLinkInfo(response.data.data.link_info);
        
        const linkData = response.data.data.link_info;
        if (linkData.access_count >= linkData.max_access_count) {
          setAccessDenied(true);
        }
        
        // 🔥 智能加载：检查是否之前已经获取过短信或正在进行倒计时
        const hasUserFetchedBefore = localStorage.getItem(`sms_fetched_${currentLinkId}`);
        const countdownState = localStorage.getItem(`countdown_state_${currentLinkId}`);
        
        if (countdownState) {
          // 如果有倒计时状态，恢复倒计时进程
          await restoreCountdownState(JSON.parse(countdownState));
          console.log('检测到倒计时进程，恢复倒计时状态');
        } else if (hasUserFetchedBefore === 'true') {
          // 如果用户之前已经获取过短信，刷新时恢复显示
          await loadExistingSms();
          console.log('检测到用户之前已获取过短信，刷新时恢复显示');
        } else {
          console.log('首次访问，不显示已有短信');
        }
      } else {
        setError(response.data.message || '获取账号信息失败');
      }
    } catch (error: any) {
      console.error('获取账号信息失败:', error);
      if (error.response?.status === 403) {
        setAccessDenied(true);
        setError('访问次数已达上限');
      } else if (error.response?.status === 404) {
        setError('链接不存在或已失效');
      } else {
        setError('网络错误，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  // 🔥 新增：恢复倒计时状态（刷新页面时不打断倒计时进程）
  const restoreCountdownState = async (savedState: any) => {
    try {
      const { slots, excludedIds, startTime, waitTime, displayCount } = savedState;
      const currentTime = Date.now();
      const elapsedTime = Math.floor((currentTime - startTime) / 1000);
      
      setIsProcessing(true);
      setExcludedSmsIds(excludedIds);
      excludedSmsIdsRef.current = excludedIds;
      
      // 🔥 关键修复：直接从localStorage恢复短信数据，不依赖后端API
      const restoredSlots: SmsSlot[] = [];
      
      for (let i = 0; i < displayCount; i++) {
        const originalCountdown = waitTime * (i + 1);
        const remainingCountdown = Math.max(0, originalCountdown - elapsedTime);
        const savedSlot = slots[i];
        
        // 🔥 直接使用保存的短信数据，确保完整性
        let smsData = null;
        if (savedSlot?.sms) {
          smsData = {
            id: savedSlot.sms.id,
            sender: savedSlot.sms.sender,
            content: savedSlot.sms.content,
            sms_timestamp: savedSlot.sms.sms_timestamp,
            category: savedSlot.sms.category,
            verification_code: savedSlot.sms.verification_code
          };
        }
        
        restoredSlots.push({
          index: i,
          countdown: remainingCountdown,
          totalTime: originalCountdown,
          sms: smsData,
          status: smsData ? 'completed' : (remainingCountdown > 0 ? 'waiting' : 'waiting')
        });
      }
      
      setSmsSlots(restoredSlots);
      
      // 为仍在倒计时的槽位恢复倒计时，对于已过期的槽位立即获取短信
      restoredSlots.forEach((slot) => {
        if (slot.status === 'waiting') {
          if (slot.countdown > 0) {
            startSlotCountdown(slot.index, slot.countdown);
          } else {
            // 倒计时已过期，立即获取短信
            fetchSmsForSlot(slot.index);
          }
        }
      });
      
      console.log(`恢复倒计时状态: 已过时间 ${elapsedTime}s，恢复 ${restoredSlots.length} 个槽位，已获取短信: ${restoredSlots.filter(s => s.sms).length} 条`);
      
    } catch (error) {
      console.error('恢复倒计时状态失败:', error);
      // 如果恢复失败，清除状态
      localStorage.removeItem(`countdown_state_${currentLinkId}`);
    }
  };

  // 🔥 新增：加载已有短信并显示在槽位中（不增加验证码获取次数）
  const loadExistingSms = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/get_existing_sms?link_id=${currentLinkId}`);
      
      if (response.data.success) {
        const existingData = response.data.data;
        const allMatchedSms = existingData.all_matched_sms || [];
        const displayCount = existingData.display_count || 5;
        
        if (allMatchedSms.length > 0) {
          // 创建槽位并填入已有短信
          const existingSlots: SmsSlot[] = [];
          
          for (let i = 0; i < displayCount; i++) {
            const existingSms = allMatchedSms[i];
            existingSlots.push({
              index: i,
              countdown: 0,
              totalTime: 0,
              sms: existingSms ? {
                id: existingSms.id,
                sender: existingSms.sender,
                content: existingSms.content,
                sms_timestamp: existingSms.sms_timestamp,
                category: existingSms.category,
                verification_code: extractVerificationCode(existingSms.content) || undefined
              } : null,
              status: existingSms ? 'completed' : 'waiting'
            });
          }
          
          setSmsSlots(existingSlots);
          
          // 设置已排除的短信ID
          const existingSmsIds = allMatchedSms.map((sms: any) => sms.id);
          setExcludedSmsIds(existingSmsIds);
          excludedSmsIdsRef.current = existingSmsIds;
          
          console.log(`页面加载时显示已有短信: ${allMatchedSms.length} 条，ID: [${existingSmsIds.join(', ')}]`);
        }
      }
    } catch (error) {
      console.error('加载已有短信失败:', error);
    }
  };

  // 🔥 新增：开始倍数倒计时获取
  const startMultipleCountdownFetching = async () => {
    if (!accountInfo || !linkInfo) return;
    
    try {
      setIsProcessing(true);
      setExcludedSmsIds([]);
      excludedSmsIdsRef.current = [];  // 🔥 同时重置ref
      
      // 获取显示条数设置
      const response = await axios.get(`${API_BASE_URL}/api/get_verification_code?link_id=${currentLinkId}`);
      
      if (response.data.success) {
        const verificationData = response.data.data;
        // 🔥 关键修复：使用后端返回的display_count，而不是all_matched_sms.length
        const displayCount = verificationData.display_count || 5;
        
        // 更新链接信息
        const linkInfoResponse = await axios.get(`${API_BASE_URL}/api/get_account_info?link_id=${currentLinkId}`);
        if (linkInfoResponse.data.success) {
          setLinkInfo(linkInfoResponse.data.data.link_info);
        }
        
        // 🔥 关键：使用verification_wait_time作为基础倍数时间
        const waitTime = linkInfo.verification_wait_time || 10;
        const initialSlots: SmsSlot[] = [];
        
        // 🔥 根据显示条数生成倍数倍计时：waitTime*1, waitTime*2, waitTime*3...
        for (let i = 0; i < displayCount; i++) {
          initialSlots.push({
            index: i,
            countdown: waitTime * (i + 1), // 倍数倍计时：20s, 40s, 60s, 80s, 100s...
            totalTime: waitTime * (i + 1),
            sms: null,
            status: 'waiting'
          });
        }
        
        setSmsSlots(initialSlots);
        
        // 🔥 为每个槽位启动独立的倍数倍计时
        initialSlots.forEach((slot) => {
          startSlotCountdown(slot.index, slot.countdown);
        });
        
        // 🔥 标记用户已经获取过短信，用于刷新时恢复显示
        localStorage.setItem(`sms_fetched_${currentLinkId}`, 'true');
        
        // 🔥 保存倒计时状态，用于刷新时恢复倒计时进程
        const countdownState = {
          slots: initialSlots,
          excludedIds: [],
          startTime: Date.now(),
          waitTime: waitTime,
          displayCount: displayCount
        };
        localStorage.setItem(`countdown_state_${currentLinkId}`, JSON.stringify(countdownState));
        
        // 生成倍数倍计时显示文本
        const countdownTimes = Array.from({length: displayCount}, (_, i) => `${waitTime * (i + 1)}s`).join(', ');
        message.success(`开始获取 ${displayCount} 条短信，倍数倍计时：${countdownTimes}`);
      } else {
        message.error('启动获取失败');
      }
    } catch (error: any) {
      console.error('启动获取失败:', error);
      message.error('启动获取失败');
    }
  };

  // 🔥 新增：槽位倒计时逻辑
  const startSlotCountdown = (slotIndex: number, totalCountdown: number) => {
    let currentCountdown = totalCountdown;
    
    const updateCountdown = () => {
      setSmsSlots(prev => prev.map(slot => 
        slot.index === slotIndex 
          ? { ...slot, countdown: currentCountdown }
          : slot
      ));
      
      if (currentCountdown > 0) {
        currentCountdown--;
        timersRef.current[slotIndex] = window.setTimeout(updateCountdown, 1000) as any;
      } else {
        // 🔥 倒计时结束后获取短信
        fetchSmsForSlot(slotIndex);
      }
    };
    
    updateCountdown();
  };

  // 🔥 修复：使用useRef来确保状态同步
  const excludedSmsIdsRef = useRef<number[]>([]);

  // 🔥 新增：为特定槽位获取短信（修复状态同步问题）
  const fetchSmsForSlot = async (slotIndex: number) => {
    try {
      console.log(`槽位 ${slotIndex + 1} 倒计时结束，开始获取短信...`);
      console.log(`当前已排除的短信ID: [${excludedSmsIdsRef.current.join(', ')}]`);
      
      // 🔥 关键修复：使用ref确保获取最新的排除列表
      const currentExcludedIds = excludedSmsIdsRef.current.join(',');
      
      const response = await axios.get(
        `${API_BASE_URL}/api/get_latest_sms?link_id=${currentLinkId}&exclude_ids=${currentExcludedIds}`
      );
      
      if (response.data.success && response.data.data) {
        const newSms: SMS = {
          id: response.data.data.id,
          sender: response.data.data.sender,
          content: response.data.data.content,
          sms_timestamp: response.data.data.sms_timestamp,
          category: response.data.data.category,
          verification_code: response.data.data.verification_code
        };
        
        console.log(`槽位 ${slotIndex + 1} 获取到短信: ID ${newSms.id}, 发送方: ${newSms.sender}`);
        
        // 🔥 关键修复：立即更新ref和state，确保状态同步
        excludedSmsIdsRef.current = [...excludedSmsIdsRef.current, newSms.id];
        setExcludedSmsIds(excludedSmsIdsRef.current);
        console.log(`更新排除列表: [${excludedSmsIdsRef.current.join(', ')}]`);
        
        // 更新槽位短信
        setSmsSlots(prev => {
          const updatedSlots = prev.map(slot => 
            slot.index === slotIndex 
              ? { ...slot, sms: newSms, status: 'completed' }
              : slot
          );
          
          // 🔥 实时更新localStorage中的倒计时状态，保存已获取的短信
          const countdownState = localStorage.getItem(`countdown_state_${currentLinkId}`);
          if (countdownState) {
            const state = JSON.parse(countdownState);
            state.slots = updatedSlots;
            state.excludedIds = excludedSmsIdsRef.current;
            localStorage.setItem(`countdown_state_${currentLinkId}`, JSON.stringify(state));
          }
          
          return updatedSlots;
        });
        
        message.success(`槽位 ${slotIndex + 1} 获取到新短信`);
      } else {
        setSmsSlots(prev => prev.map(slot => 
          slot.index === slotIndex 
            ? { ...slot, status: 'failed' }
            : slot
        ));
        console.log(`槽位 ${slotIndex + 1} 未找到新短信`);
      }
      
      // 检查是否所有槽位都完成了
      setSmsSlots(prev => {
        const allCompleted = prev.every(slot => slot.status !== 'waiting');
        if (allCompleted) {
          setIsProcessing(false);
          const successCount = prev.filter(slot => slot.sms).length;
          message.success(`所有短信获取完成！成功获取 ${successCount} 条短信`);
          
          // 🔥 所有倒计时完成后，清除倒计时状态，保留获取标记
          localStorage.removeItem(`countdown_state_${currentLinkId}`);
          localStorage.setItem(`sms_fetched_${currentLinkId}`, 'true');
        }
        return prev;
      });
      
    } catch (error) {
      console.error(`槽位 ${slotIndex + 1} 获取失败:`, error);
      setSmsSlots(prev => prev.map(slot => 
        slot.index === slotIndex 
          ? { ...slot, status: 'failed' }
          : slot
      ));
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success(`${label}已复制到剪贴板`);
    }).catch(() => {
      message.error('复制失败');
    });
  };

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

  // 🔥 新增：渲染短信槽位
  const renderSmsSlot = (slot: SmsSlot) => {
    const progressPercent = slot.totalTime > 0 ? ((slot.totalTime - slot.countdown) / slot.totalTime) * 100 : 100;
    
    return (
      <Card 
        key={slot.index}
        size="small" 
        style={{ 
          width: '100%', 
          marginBottom: 16,
          border: slot.status === 'waiting' ? '2px solid #1890ff' : '1px solid #d9d9d9'
        }}
        title={
          <Space>
            <MobileOutlined />
            <span>短信位置 {slot.index + 1}</span>
            {slot.status === 'waiting' && (
              <Tag color="blue">
                <ClockCircleOutlined /> {slot.countdown}s
              </Tag>
            )}
            {slot.status === 'completed' && (
              <Tag color="green">
                <CheckCircleOutlined /> 已完成
              </Tag>
            )}
            {slot.status === 'failed' && (
              <Tag color="red">
                <ExclamationCircleOutlined /> 未找到
              </Tag>
            )}
          </Space>
        }
      >
        {/* 进度条 */}
        <Progress 
          percent={progressPercent} 
          size="small" 
          status={slot.status === 'waiting' ? 'active' : slot.status === 'completed' ? 'success' : 'exception'}
          style={{ marginBottom: 16 }}
        />
        
        {slot.sms ? (
          <div>
            <div style={{ marginBottom: 8 }}>
              <Text strong>发送方：</Text>
              <Text>{slot.sms.sender}</Text>
              <Divider type="vertical" />
              <Text type="secondary">
                {new Date(slot.sms.sms_timestamp).toLocaleString()}
              </Text>
              <Divider type="vertical" />
              <Text type="secondary">ID: {slot.sms.id}</Text>
            </div>
            
            <Paragraph style={{ marginBottom: 16 }}>
              {slot.sms.content}
            </Paragraph>
            
            {slot.sms.verification_code && (
              <div style={{ 
                background: '#f6ffed', 
                border: '1px solid #b7eb8f',
                borderRadius: 8,
                padding: 16,
                textAlign: 'center'
              }}>
                <Text strong style={{ color: '#52c41a', fontSize: '18px' }}>
                  验证码: {slot.sms.verification_code}
                </Text>
                <br />
                <Button
                  type="link"
                  icon={<CopyOutlined />}
                  onClick={() => copyToClipboard(slot.sms!.verification_code!, '验证码')}
                  style={{ marginTop: 8 }}
                >
                  复制验证码
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>
            {slot.status === 'waiting' ? (
              <div>
                <ClockCircleOutlined style={{ fontSize: 24, marginBottom: 8 }} />
                <div>等待倒计时结束</div>
                <div style={{ fontSize: '12px' }}>剩余 {slot.countdown} 秒</div>
              </div>
            ) : slot.status === 'failed' ? (
              <div>
                <ExclamationCircleOutlined style={{ fontSize: 24, marginBottom: 8, color: '#ff4d4f' }} />
                <div>未找到新短信</div>
              </div>
            ) : (
              <div>
                <ClockCircleOutlined style={{ fontSize: 24, marginBottom: 8 }} />
                <div>准备获取短信</div>
              </div>
            )}
          </div>
        )}
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="customer-container">
        <div className="loading-container">
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>正在加载账号信息...</div>
        </div>
      </div>
    );
  }

  if (error || accessDenied) {
    return (
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
    );
  }

  if (!accountInfo) {
    return (
      <div className="customer-container">
        <Card className="customer-card">
          <div className="error-message">
            <Title level={4} type="danger">账号信息不存在</Title>
            <Paragraph>请检查访问链接是否正确。</Paragraph>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="customer-container">
      <Card className="customer-card">
        {/* 账号信息头部 */}
        <div className="account-info">
          <Avatar
            size={80}
            src={accountInfo.image_url}
            icon={<UserOutlined />}
            className="account-avatar"
          />
          <Title level={3} style={{ color: 'white', margin: 0 }}>
            {accountInfo.account_name}
          </Title>
          <Tag color="blue" style={{ marginTop: 8 }}>
            {accountInfo.type || '未知类型'}
          </Tag>
        </div>

        {/* 账号详细信息 */}
        <div className="verification-section">
          <Title level={4}>
            <UserOutlined /> 账号信息
          </Title>
          
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col span={12}>
              <Card size="small" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>用户名</div>
                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
                  {accountInfo.username}
                </div>
                <Button
                  type="link"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => copyToClipboard(accountInfo.username, '用户名')}
                >
                  复制
                </Button>
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>密码</div>
                <div style={{ 
                  fontWeight: 'bold', 
                  fontSize: '16px', 
                  fontFamily: 'monospace',
                  color: '#1890ff'
                }}>
                  {accountInfo.password}
                </div>
                <Button
                  type="link"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => copyToClipboard(accountInfo.password, '密码')}
                >
                  复制
                </Button>
              </Card>
            </Col>
          </Row>

          <Divider />

          {/* 🔥 倍数倒计时验证码获取 */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Title level={4}>
              <MobileOutlined /> 获取验证码
            </Title>
            <Paragraph type="secondary">
              {linkInfo && (
                <div>
                  验证码等待时间: {linkInfo.verification_wait_time} 秒 | 
                  倍数倒计时获取，避免重复短信
                </div>
              )}
            </Paragraph>
            
            <Button
              type="primary"
              size="large"
              loading={isProcessing}
              icon={<MobileOutlined />}
              disabled={(() => {
                if (!linkInfo) return true;
                const hasReachedLimit = linkInfo.max_verification_count > 0 && 
                                       linkInfo.verification_count >= linkInfo.max_verification_count;
                return hasReachedLimit || isProcessing;
              })()}
              onClick={startMultipleCountdownFetching}
              style={{ 
                minWidth: 200,
                height: 50,
                fontSize: '16px'
              }}
            >
              {isProcessing ? '获取中...' : '开始倍数倒计时获取'}
            </Button>
            
            {/* 使用统计 */}
            {linkInfo && (
              <div style={{ marginTop: 16, fontSize: '14px', color: '#666' }}>
                <Space split={<Divider type="vertical" />}>
                  <span>
                    验证码次数: {linkInfo.verification_count} / {linkInfo.max_verification_count || '∞'}
                  </span>
                  <span>
                    访问次数: {linkInfo.access_count} / {linkInfo.max_access_count || '∞'}
                  </span>
                </Space>
              </div>
            )}
          </div>

          <Divider />

          {/* 🔥 短信槽位显示区域 */}
          <div className="sms-section">
            <Title level={4}>
              <MobileOutlined /> 验证码短信
            </Title>
            
            {smsSlots.length === 0 ? (
              <Alert
                message="点击上方按钮开始倍数倒计时获取"
                description="系统将根据设置的验证码等待时间，创建倍数倒计时槽位（10s, 20s, 30s...），倒计时结束后获取不同的短信"
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
            ) : (
              <div>
                {smsSlots.map(slot => renderSmsSlot(slot))}
                
                {/* 整体状态显示 */}
                <Card size="small" style={{ marginTop: 16, background: '#fafafa' }}>
                  <div style={{ textAlign: 'center' }}>
                    <Text strong>获取状态：</Text>
                    <Space style={{ marginLeft: 16 }}>
                      <span>
                        等待中: {smsSlots.filter(slot => slot.status === 'waiting').length}
                      </span>
                      <span>
                        已完成: {smsSlots.filter(slot => slot.status === 'completed').length}
                      </span>
                      <span>
                        已获取短信: {smsSlots.filter(slot => slot.sms).length}
                      </span>
                      <span>
                        已排除ID: [{excludedSmsIds.join(', ')}]
                      </span>
                    </Space>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default CustomerPage;
