import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * 私有路由组件
 * 用于保护需要登录才能访问的页面
 */
function PrivateRoute({ children }) {
  // 检查是否有token
  const token = localStorage.getItem('token');

  if (!token) {
    // 未登录，跳转到登录页
    return <Navigate to="/login" replace />;
  }

  // 已登录，渲染子组件
  return children;
}

export default PrivateRoute;
