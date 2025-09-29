import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { message } from 'antd';
import { authAPI } from '../services/api';

interface User {
  id: number;
  username: string;
  email?: string;
  full_name?: string;
  is_active: boolean;
  is_superuser: boolean;
  phone?: string;
  last_login?: string;
  login_count?: number;
  created_at?: string;
  updated_at?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // 🚨 新增：检查token是否过期的函数
  const checkTokenExpiry = (token: string): boolean => {
    try {
      // 解析JWT token的payload部分
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      
      // 检查是否过期
      if (payload.exp && payload.exp < currentTime) {
        console.log('🕐 Token已过期，自动登出');
        return true; // 已过期
      }
      return false; // 未过期
    } catch (error) {
      console.error('解析token失败:', error);
      return true; // 解析失败，视为过期
    }
  };

  // 🚨 新增：自动登出函数
  const autoLogout = () => {
    console.log('🚨 会话超时，自动登出');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    message.warning('会话已超时，请重新登录');
    // 跳转到登录页
    window.location.href = '/login';
  };

  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('token');
      if (savedToken) {
        // 🚨 新增：首先检查token是否过期
        if (checkTokenExpiry(savedToken)) {
          autoLogout();
          setLoading(false);
          return;
        }

        try {
          const userData: any = await authAPI.getCurrentUser();
          
          // 简化数据结构处理
          let userInfo = null;
          if (userData && userData.success && userData.data) {
            userInfo = userData.data;
          } else if (userData && typeof userData === 'object') {
            userInfo = userData;
          }
          
          if (userInfo) {
            setUser(userInfo);
          }
          setToken(savedToken);
        } catch (error: any) {
          console.error('初始化用户数据失败:', error);
          
          // 🚨 新增：如果是401错误（token过期），自动登出
          if (error.response?.status === 401) {
            autoLogout();
          } else {
            localStorage.removeItem('token');
            setToken(null);
          }
        }
      }
      setLoading(false);
    };

    initAuth();

    // 🚨 新增：定期检查token过期（每30秒检查一次）
    const tokenCheckInterval = setInterval(() => {
      const currentToken = localStorage.getItem('token');
      if (currentToken && checkTokenExpiry(currentToken)) {
        autoLogout();
      }
    }, 30000); // 30秒检查一次

    return () => {
      clearInterval(tokenCheckInterval);
    };
  }, []);

  // 🚨 新增：API请求拦截器，检查401响应
  useEffect(() => {
    const handleApiError = (error: any) => {
      if (error.response?.status === 401 && token) {
        console.log('🚨 API返回401，token可能已过期');
        autoLogout();
      }
    };

    // 这里可以添加axios拦截器，但为了简单起见，我们在每个API调用中处理
    // 实际项目中建议使用axios拦截器
  }, [token]);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      console.log('🔐 AuthContext开始登录请求:', username);
      const response: any = await authAPI.login(username, password);
      console.log('🔐 AuthContext收到登录响应:', response);
      
      if (!response) {
        throw new Error('登录响应为空');
      }
      
      // 后端现在直接返回标准格式
      const access_token = response.access_token;
      const user_info = response.user_info;
      
      if (!access_token) {
        console.error('❌ AuthContext未获取到访问令牌:', response);
        throw new Error('未获取到访问令牌');
      }
      
      console.log('✅ AuthContext获取到token，保存到localStorage');
      localStorage.setItem('token', access_token);
      setToken(access_token);
      
      // 设置用户信息
      if (user_info) {
        console.log('✅ AuthContext设置用户信息:', user_info);
        setUser(user_info);
      }
      
      // 登录成功后刷新用户数据
      try {
        console.log('🔄 AuthContext刷新用户数据...');
        const userData: any = await authAPI.getCurrentUser();
        console.log('🔄 AuthContext获取到用户数据:', userData);
        
        let userInfo = null;
        if (userData && userData.success && userData.data) {
          userInfo = userData.data;
        } else if (userData && typeof userData === 'object') {
          userInfo = userData;
        }
        
        if (userInfo) {
          console.log('✅ AuthContext更新用户信息:', userInfo);
          setUser(userInfo);
        }
      } catch (refreshError) {
        console.error('⚠️ AuthContext登录后刷新用户数据失败:', refreshError);
        // 刷新失败不影响登录成功
      }
      
      console.log('✅ AuthContext登录成功');
      return true;
    } catch (error: any) {
      console.error('❌ AuthContext登录失败:', error);
      console.error('❌ 错误详情:', error.response);
      
      // 清理可能的残留数据
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
      
      // 🚨 安全修复：正确处理后端返回的详细错误信息
      let errorMessage = '登录失败，请检查用户名和密码';
      
      if (error.response?.data?.detail) {
        // 后端返回的详细错误信息（包含剩余尝试次数、锁定信息等）
        errorMessage = error.response.data.detail;
        console.log('🔐 使用后端详细错误信息:', errorMessage);
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // 🚨 重要：将详细的错误信息抛出，让Login组件能够显示
      throw new Error(errorMessage);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    message.success('已退出登录');
  };

  const refreshUser = async () => {
    if (token) {
      try {
        const userData: any = await authAPI.getCurrentUser();
        
        // 简化数据结构处理
        let userInfo = null;
        if (userData && userData.success && userData.data) {
          userInfo = userData.data;
        } else if (userData && typeof userData === 'object') {
          userInfo = userData;
        }
        
        if (userInfo) {
          setUser(userInfo);
        }
      } catch (error) {
        console.error('刷新用户数据失败:', error);
      }
    }
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    loading,
    refreshUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
