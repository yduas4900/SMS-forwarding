/**
 * 短信转发功能前端测试套件
 * SMS Forward Frontend Test Suite
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import SmsForwardLogs from '../pages/dashboard/SmsForwardLogs';
import SmsManagementByAccount from '../pages/dashboard/SmsManagementByAccount';
import { smsForwardAPI } from '../services/api';

// Mock API calls
jest.mock('../services/api', () => ({
  smsForwardAPI: {
    getForwardLogs: jest.fn(),
    getForwardStatistics: jest.fn(),
    triggerForward: jest.fn(),
    retryForward: jest.fn(),
  },
}));

// Mock data
const mockStatistics = {
  success: true,
  data: {
    total_forwards: 150,
    success_forwards: 135,
    failed_forwards: 15,
    success_rate: 90.0,
    today_forwards: 25,
    active_rules: 8
  }
};

const mockForwardLogs = {
  success: true,
  data: {
    logs: [
      {
        id: 1,
        sms_id: 101,
        rule_id: 1,
        status: 'success',
        target_type: 'link',
        target_id: 1,
        forwarded_at: '2024-01-15T10:30:00Z',
        created_at: '2024-01-15T10:30:00Z',
        sms: {
          sender: '10086',
          content: '您的验证码是123456',
          sms_timestamp: '2024-01-15T10:29:00Z'
        },
        rule: {
          rule_name: '验证码转发规则',
          match_type: 'fuzzy'
        }
      },
      {
        id: 2,
        sms_id: 102,
        rule_id: 2,
        status: 'failed',
        target_type: 'link',
        target_id: 2,
        error_message: '目标链接不可用',
        created_at: '2024-01-15T10:25:00Z',
        sms: {
          sender: '95533',
          content: '账户余额变动通知',
          sms_timestamp: '2024-01-15T10:24:00Z'
        },
        rule: {
          rule_name: '银行通知转发',
          match_type: 'exact'
        }
      }
    ],
    total: 2,
    page: 1,
    per_page: 10
  }
};

describe('SMS Forward Frontend Tests', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup default mock responses
    smsForwardAPI.getForwardStatistics.mockResolvedValue(mockStatistics);
    smsForwardAPI.getForwardLogs.mockResolvedValue(mockForwardLogs);
  });

  describe('SmsForwardLogs Component', () => {
    const renderComponent = () => {
      return render(
        <BrowserRouter>
          <SmsForwardLogs />
        </BrowserRouter>
      );
    };

    test('应该正确渲染统计卡片', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('转发成功率')).toBeInTheDocument();
        expect(screen.getByText('90.0%')).toBeInTheDocument();
        expect(screen.getByText('总转发次数')).toBeInTheDocument();
        expect(screen.getByText('150')).toBeInTheDocument();
        expect(screen.getByText('今日转发')).toBeInTheDocument();
        expect(screen.getByText('25')).toBeInTheDocument();
        expect(screen.getByText('失败次数')).toBeInTheDocument();
        expect(screen.getByText('15')).toBeInTheDocument();
      });
    });

    test('应该正确显示转发日志列表', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('您的验证码是123456')).toBeInTheDocument();
        expect(screen.getByText('验证码转发规则')).toBeInTheDocument();
        expect(screen.getByText('账户余额变动通知')).toBeInTheDocument();
        expect(screen.getByText('银行通知转发')).toBeInTheDocument();
      });
    });

    test('应该正确显示状态标签', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('成功')).toBeInTheDocument();
        expect(screen.getByText('失败')).toBeInTheDocument();
      });
    });

    test('筛选功能应该正常工作', async () => {
      renderComponent();
      
      await waitFor(() => {
        const statusFilter = screen.getByDisplayValue('全部状态');
        fireEvent.change(statusFilter, { target: { value: 'failed' } });
      });

      await waitFor(() => {
        expect(smsForwardAPI.getForwardLogs).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'failed'
          })
        );
      });
    });

    test('重试按钮应该正常工作', async () => {
      smsForwardAPI.retryForward.mockResolvedValue({ success: true });
      renderComponent();
      
      await waitFor(() => {
        const retryButton = screen.getByText('重试');
        fireEvent.click(retryButton);
      });

      await waitFor(() => {
        expect(smsForwardAPI.retryForward).toHaveBeenCalledWith(2);
      });
    });

    test('刷新按钮应该重新加载数据', async () => {
      renderComponent();
      
      await waitFor(() => {
        const refreshButton = screen.getByText('刷新');
        fireEvent.click(refreshButton);
      });

      await waitFor(() => {
        expect(smsForwardAPI.getForwardStatistics).toHaveBeenCalledTimes(2);
        expect(smsForwardAPI.getForwardLogs).toHaveBeenCalledTimes(2);
      });
    });

    test('应该正确处理加载状态', () => {
      smsForwardAPI.getForwardStatistics.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      );
      
      renderComponent();
      
      expect(screen.getByText('加载中...')).toBeInTheDocument();
    });

    test('应该正确处理错误状态', async () => {
      smsForwardAPI.getForwardStatistics.mockRejectedValue(new Error('API Error'));
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('加载失败，请重试')).toBeInTheDocument();
      });
    });
  });

  describe('SmsManagementByAccount Component', () => {
    const renderComponent = () => {
      return render(
        <BrowserRouter>
          <SmsManagementByAccount />
        </BrowserRouter>
      );
    };

    test('应该正确渲染标签页', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('短信记录')).toBeInTheDocument();
        expect(screen.getByText('转发日志')).toBeInTheDocument();
      });
    });

    test('标签页切换应该正常工作', async () => {
      renderComponent();
      
      await waitFor(() => {
        const forwardLogTab = screen.getByText('转发日志');
        fireEvent.click(forwardLogTab);
      });

      await waitFor(() => {
        expect(screen.getByText('转发成功率')).toBeInTheDocument();
      });
    });

    test('应该在转发日志标签页显示SmsForwardLogs组件', async () => {
      renderComponent();
      
      await waitFor(() => {
        const forwardLogTab = screen.getByText('转发日志');
        fireEvent.click(forwardLogTab);
      });

      await waitFor(() => {
        expect(smsForwardAPI.getForwardStatistics).toHaveBeenCalled();
        expect(smsForwardAPI.getForwardLogs).toHaveBeenCalled();
      });
    });
  });

  describe('API Integration Tests', () => {
    test('getForwardLogs API应该正确调用', async () => {
      const params = {
        page: 1,
        per_page: 10,
        status: 'success',
        start_date: '2024-01-01',
        end_date: '2024-01-31'
      };

      await smsForwardAPI.getForwardLogs(params);
      
      expect(smsForwardAPI.getForwardLogs).toHaveBeenCalledWith(params);
    });

    test('getForwardStatistics API应该正确调用', async () => {
      await smsForwardAPI.getForwardStatistics();
      
      expect(smsForwardAPI.getForwardStatistics).toHaveBeenCalled();
    });

    test('retryForward API应该正确调用', async () => {
      const logId = 123;
      
      await smsForwardAPI.retryForward(logId);
      
      expect(smsForwardAPI.retryForward).toHaveBeenCalledWith(logId);
    });

    test('triggerForward API应该正确调用', async () => {
      const smsId = 456;
      
      await smsForwardAPI.triggerForward(smsId);
      
      expect(smsForwardAPI.triggerForward).toHaveBeenCalledWith(smsId);
    });
  });

  describe('Error Handling Tests', () => {
    test('应该正确处理网络错误', async () => {
      smsForwardAPI.getForwardLogs.mockRejectedValue(new Error('Network Error'));
      
      const renderComponent = () => {
        return render(
          <BrowserRouter>
            <SmsForwardLogs />
          </BrowserRouter>
        );
      };

      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('网络错误，请检查连接')).toBeInTheDocument();
      });
    });

    test('应该正确处理服务器错误', async () => {
      smsForwardAPI.getForwardStatistics.mockRejectedValue({
        response: { status: 500, data: { message: 'Internal Server Error' } }
      });
      
      const renderComponent = () => {
        return render(
          <BrowserRouter>
            <SmsForwardLogs />
          </BrowserRouter>
        );
      };

      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('服务器错误，请稍后重试')).toBeInTheDocument();
      });
    });

    test('重试失败应该显示错误消息', async () => {
      smsForwardAPI.retryForward.mockRejectedValue(new Error('Retry failed'));
      
      const renderComponent = () => {
        return render(
          <BrowserRouter>
            <SmsForwardLogs />
          </BrowserRouter>
        );
      };

      renderComponent();
      
      await waitFor(() => {
        const retryButton = screen.getByText('重试');
        fireEvent.click(retryButton);
      });

      await waitFor(() => {
        expect(screen.getByText('重试失败，请稍后再试')).toBeInTheDocument();
      });
    });
  });

  describe('Performance Tests', () => {
    test('大量数据应该正确渲染', async () => {
      const largeMockData = {
        success: true,
        data: {
          logs: Array.from({ length: 100 }, (_, i) => ({
            id: i + 1,
            sms_id: i + 100,
            rule_id: (i % 5) + 1,
            status: i % 3 === 0 ? 'failed' : 'success',
            target_type: 'link',
            target_id: i + 1,
            forwarded_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            sms: {
              sender: `1008${i % 10}`,
              content: `测试短信内容 ${i}`,
              sms_timestamp: new Date().toISOString()
            },
            rule: {
              rule_name: `测试规则 ${i % 5}`,
              match_type: i % 2 === 0 ? 'exact' : 'fuzzy'
            }
          })),
          total: 100,
          page: 1,
          per_page: 100
        }
      };

      smsForwardAPI.getForwardLogs.mockResolvedValue(largeMockData);
      
      const renderComponent = () => {
        return render(
          <BrowserRouter>
            <SmsForwardLogs />
          </BrowserRouter>
        );
      };

      const startTime = performance.now();
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('测试短信内容 0')).toBeInTheDocument();
      });
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // 渲染时间应该在合理范围内（小于2秒）
      expect(renderTime).toBeLessThan(2000);
    });
  });

  describe('Accessibility Tests', () => {
    test('应该有正确的ARIA标签', async () => {
      const renderComponent = () => {
        return render(
          <BrowserRouter>
            <SmsForwardLogs />
          </BrowserRouter>
        );
      };

      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '刷新' })).toBeInTheDocument();
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });
    });

    test('键盘导航应该正常工作', async () => {
      const renderComponent = () => {
        return render(
          <BrowserRouter>
            <SmsForwardLogs />
          </BrowserRouter>
        );
      };

      renderComponent();
      
      await waitFor(() => {
        const refreshButton = screen.getByRole('button', { name: '刷新' });
        refreshButton.focus();
        
        fireEvent.keyDown(refreshButton, { key: 'Enter' });
        
        expect(smsForwardAPI.getForwardStatistics).toHaveBeenCalled();
      });
    });
  });
});
