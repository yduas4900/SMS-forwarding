import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { message } from 'antd';

// API基础配置
const API_BASE_URL = '';

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
};

// 设备相关API
export const deviceAPI = {
  getDeviceList: (params?: any) =>
    apiClient.get('/api/devices/list', { params }),
  
  getDeviceDetail: (deviceId: string) =>
    apiClient.get(`/api/devices/${deviceId}`),
  
  deleteDevice: (deviceId: string) =>
    apiClient.delete(`/api/devices/${deviceId}`),
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
};

// 链接相关API
export const linkAPI = {
  createLink: (data: any) =>
    apiClient.post('/api/links/batch_create', { ...data, count: 1 }),
  
  getLinkList: (params?: any) =>
    apiClient.get('/api/links/list', { params }),
  
  deleteLink: (linkId: string) =>
    apiClient.delete(`/api/links/${linkId}`),
};

// 短信相关API
export const smsAPI = {
  getSmsList: (params?: any) =>
    apiClient.get('/api/sms/list', { params }),
  
  deleteSms: (smsId: number) =>
    apiClient.delete(`/api/sms/${smsId}`),
};
export default apiClient;
