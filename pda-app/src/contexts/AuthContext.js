import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API_URL = process.env.REACT_APP_API_URL || 'https://erp.hlsd.work:5000';

const applySessionHeaders = (token, userData = null) => {
  if (token) {
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common.Authorization;
  }

  const enterpriseId = userData?.enterprise_id;
  if (enterpriseId !== null && enterpriseId !== undefined) {
    axios.defaults.headers.common['x-enterprise-id'] = enterpriseId;
  } else {
    delete axios.defaults.headers.common['x-enterprise-id'];
  }
};

const persistSession = (token, userData) => {
  localStorage.setItem('pda_token', token);
  localStorage.setItem('pda_user', JSON.stringify(userData));
  localStorage.setItem('userInfo', JSON.stringify(userData));
  localStorage.setItem('token', token);
};

const clearSession = () => {
  localStorage.removeItem('pda_token');
  localStorage.removeItem('pda_user');
  localStorage.removeItem('userInfo');
  localStorage.removeItem('token');
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 检查本地存储的登录状态
    const token = localStorage.getItem('pda_token');
    const savedUser = localStorage.getItem('pda_user');
    if (token && savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        setIsAuthenticated(true);
        applySessionHeaders(token, userData);
        // 验证token是否有效
        verifyToken(token, userData);
      } catch (error) {
        console.error('解析用户信息失败:', error);
        logout();
      }
    }
    setLoading(false);
  }, []);

  const verifyToken = async (token, currentUser = null) => {
    try {
      const enterpriseId = currentUser?.enterprise_id;
      const response = await axios.post(
        `${API_URL}/api/pda-auth/verify-token`,
        { token },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            ...(enterpriseId !== null && enterpriseId !== undefined ? { 'x-enterprise-id': enterpriseId } : {})
          }
        }
      );
      
      if (!response.data.success) {
        logout();
        return;
      }

      if (response.data.user) {
        const nextUser = {
          ...(currentUser || {}),
          ...response.data.user
        };
        setUser(nextUser);
        persistSession(token, nextUser);
        applySessionHeaders(token, nextUser);
      }
    } catch (error) {
      console.error('Token验证失败:', error);
      // Token无效，清除登录状态
      if (error.response?.status === 401) {
        logout();
      }
    }
  };

  const login = async (username, password, userType, enterpriseCode) => {
    try {
      const response = await axios.post(`${API_URL}/api/pda-auth/pda-login`, {
        username,
        password,
        userType,
        enterpriseCode
      });
      
      if (response.data.success) {
        const { token, user: userData } = response.data;
        setUser(userData);
        setIsAuthenticated(true);
        applySessionHeaders(token, userData);
        persistSession(token, userData);
        return { success: true };
      } else {
        return { success: false, message: response.data.message || '登录失败' };
      }
    } catch (error) {
      console.error('登录错误:', error);
      
      if (error.response) {
        return { 
          success: false, 
          message: error.response.data?.message || '登录失败，请检查用户名和密码' 
        };
      }
      
      return { success: false, message: '网络错误，请检查网络连接' };
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    applySessionHeaders(null, null);
    clearSession();
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column'
      }}>
        <div style={{ fontSize: 16, color: '#1890ff' }}>加载中...</div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
