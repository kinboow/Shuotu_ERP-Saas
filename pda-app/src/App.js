import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd-mobile';
import zhCN from 'antd-mobile/es/locales/zh-CN';

// 页面组件
import Login from './pages/Login';
import Home from './pages/Home';
import ScanShip from './pages/ScanShip';
import ScanReceive from './pages/ScanReceive';
import InventoryCheck from './pages/InventoryCheck';
import OrderQuery from './pages/OrderQuery';
import Settings from './pages/Settings';
import VideoRecord from './pages/VideoRecord';
import VideoScan from './pages/VideoScan';
import CourierReport from './pages/CourierReport';

// 布局组件
import Layout from './components/Layout';

// 认证上下文
import { AuthProvider, useAuth } from './contexts/AuthContext';

// 受保护的路由
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Home />} />
        <Route path="scan-ship" element={<ScanShip />} />
        <Route path="scan-receive" element={<ScanReceive />} />
        <Route path="inventory-check" element={<InventoryCheck />} />
        <Route path="order-query" element={<OrderQuery />} />
        <Route path="video-record" element={<VideoRecord />} />
        <Route path="video-scan" element={<VideoScan />} />
        <Route path="courier-report" element={<CourierReport />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
