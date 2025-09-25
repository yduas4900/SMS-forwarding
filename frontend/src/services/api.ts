import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { message } from 'antd';

// API基础配置
const API_BASE_URL = process.env.REACT_APP_API_URL || '';

// 创建axios实例
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response.data;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
      message.error('登录已过期，请重新登录');
    } else if (error.response?.status >= 500) {
      message.error('服务器错误，请稍后重试');
    } else if (error.response?.status >= 400) {
      const errorMsg = error.response?.data?.detail || error.response?.data?.message || '请求失败';
      message.error(errorMsg);
    }
    return Promise.reject(error);
  }
);

// 认证相关API
export const authAPI = {
  login: (username: string, password: string) =>
    apiClient.post('/api/auth/login', { username, password }),
  
  getCurrentUser: () =>
    apiClient.get('/api/auth/me'),
  
  updateProfile: (data: any) =>
    apiClient.put('/api/auth/profile', data),
  
  changePassword: (data: any) =>
    apiClient.put('/api/auth/password', data),
};

// 设备相关API
export const deviceAPI = {
  getDeviceList: (params?: any) =>
    apiClient.get('/api/devices/list', { params }),
  
  getDeviceDetail: (deviceId: string) =>
    apiClient.get(`/api/devices/${deviceId}`),
  
  deleteDevice: (deviceId: string) =>
    apiClient.delete(`/api/devices/${deviceId}`),
  
  getDeviceStatistics: () =>
    apiClient.get('/api/devices/statistics/overview'),
  
  getDeviceSms: (deviceId: string, params?: any) =>
    apiClient.get(`/api/devices/${deviceId}/sms`, { params }),
  
  deleteDeviceSms: (deviceId: string) =>
    apiClient.delete(`/api/devices/${deviceId}/sms`),
};

// 账号相关API
export const accountAPI = {
  createAccount: (data: any) =>
    apiClient.post('/api/accounts/', data),
  
  getAccountList: (params?: any) =>
    apiClient.get('/api/accounts/list', { params }),
  
  getAccountDetail: (accountId: number) =>
    apiClient.get(`/api/accounts/${accountId}`),
  
  updateAccount: (accountId: number, data: any) =>
    apiClient.put(`/api/accounts/${accountId}`, data),
  
  deleteAccount: (accountId: number) =>
    apiClient.delete(`/api/accounts/${accountId}`),
  
  getAvailableDevices: () =>
    apiClient.get('/api/accounts/available-devices'),
  
  getAccountSms: (accountId: number, params?: any) =>
    apiClient.get(`/api/accounts/${accountId}/sms`, { params }),
  
  getAccountLatestVerificationCode: (accountId: number) =>
    apiClient.get(`/api/accounts/${accountId}/latest-verification-code`),
};

// 链接相关API
export const linkAPI = {
  createLink: (data: any) =>
    apiClient.post('/api/links/batch_create', { ...data, count: 1 }),
  
  getLinkList: (params?: any) =>
    apiClient.get('/api/links/list', { params }),
  
  getLinkDetail: (linkId: string) =>
    apiClient.get(`/api/links/${linkId}`),
  
  updateLink: (linkId: string, data: any) =>
    apiClient.put(`/api/links/${linkId}`, data),
  
  deleteLink: (linkId: string) =>
    apiClient.delete(`/api/links/${linkId}`),
  
  createBatchLinks: (data: any) =>
    apiClient.post('/api/links/batch_create', data),
};

// 短信相关API
export const smsAPI = {
  getSmsList: (params?: any) =>
    apiClient.get('/api/sms/list', { params }),
  
  getSmsDetail: (smsId: number) =>
    apiClient.get(`/api/sms/${smsId}`),
  
  deleteSms: (smsId: number) =>
    apiClient.delete(`/api/sms/${smsId}`),
  
  searchSms: (params?: any) =>
    apiClient.get('/api/sms/search', { params }),
  
  manualForward: (smsId: number) =>
    apiClient.post(`/api/sms/manual_forward/${smsId}`),
};

// 短信规则相关API
export const smsRuleAPI = {
  createRule: (data: any) =>
    apiClient.post('/api/sms/rules', data),
  
  getRuleList: (params?: any) =>
    apiClient.get('/api/sms/rules/list', { params }),
  
  getRuleDetail: (ruleId: number) =>
    apiClient.get(`/api/sms/rules/${ruleId}`),
  
  updateRule: (ruleId: number, data: any) =>
    apiClient.put(`/api/sms/rules/${ruleId}`, data),
  
  deleteRule: (ruleId: number) =>
    apiClient.delete(`/api/sms/rules/${ruleId}`),
  
  manualForwardByRule: (ruleId: number) =>
    apiClient.post(`/api/sms/rules/${ruleId}/manual_forward`),
};

// 短信转发相关API
export const smsForwardAPI = {
  getForwardLogs: (params?: any) =>
    apiClient.get('/api/sms/forward-logs', { params }),
  
  getForwardStatistics: () =>
    apiClient.get('/api/sms/forward-statistics'),
  
  triggerForward: (smsId: number) =>
    apiClient.post(`/api/sms/${smsId}/forward`),
  
  retryForward: (logId: number) =>
    apiClient.post(`/api/sms/forward-logs/${logId}/retry`),
};

// 服务类型相关API
export const serviceTypeAPI = {
  createServiceType: (data: any) =>
    apiClient.post('/api/service-types/', data),
  
  getServiceTypeList: (params?: any) =>
    apiClient.get('/api/service-types/list', { params }),
  
  getAllActiveServiceTypes: () =>
    apiClient.get('/api/service-types/all'),
  
  getServiceTypeDetail: (serviceTypeId: number) =>
    apiClient.get(`/api/service-types/${serviceTypeId}`),
  
  updateServiceType: (serviceTypeId: number, data: any) =>
    apiClient.put(`/api/service-types/${serviceTypeId}`, data),
  
  deleteServiceType: (serviceTypeId: number) =>
    apiClient.delete(`/api/service-types/${serviceTypeId}`),
  
  batchDeleteServiceTypes: (ids: number[]) =>
    apiClient.post('/api/service-types/batch-delete', { ids }),
};

// WebSocket相关API
export const websocketAPI = {
  getStatus: () =>
    apiClient.get('/api/ws/status'),
};

export default apiClient;
