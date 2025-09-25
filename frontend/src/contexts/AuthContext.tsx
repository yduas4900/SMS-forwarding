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

  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('token');
      if (savedToken) {
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
        } catch (error) {
          console.error('初始化用户数据失败:', error);
          localStorage.removeItem('token');
          setToken(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

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
      
      // 清理可能的残留数据
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
      
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          '登录失败，请检查用户名和密码';
      
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
