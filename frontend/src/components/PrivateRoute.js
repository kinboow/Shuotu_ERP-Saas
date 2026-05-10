import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getStoredAuthState } from '../utils/authStorage';

/**
 * 私有路由组件
 * 用于保护需要登录才能访问的页面
 */
function PrivateRoute({ children }) {
  const location = useLocation();
  // 检查是否有token
  const token = localStorage.getItem('token');
  const authState = getStoredAuthState();
  const requiresEnterpriseSelection = Boolean(authState.requiresEnterpriseSelection);

  if (!token) {
    // 未登录，跳转到登录页
    return <Navigate to="/login" replace />;
  }

  if (requiresEnterpriseSelection && location.pathname !== '/enterprise-onboarding') {
    return <Navigate to="/enterprise-onboarding" replace />;
  }

  if (!requiresEnterpriseSelection && location.pathname === '/enterprise-onboarding') {
    return <Navigate to="/" replace />;
  }

  // 已登录，渲染子组件
  return children;
}

export default PrivateRoute;
