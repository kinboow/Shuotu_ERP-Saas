import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { TabBar } from 'antd-mobile';
import { 
  AppOutline, 
  ScanningOutline, 
  UnorderedListOutline, 
  SetOutline 
} from 'antd-mobile-icons';

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { key: '/', title: '首页', icon: <AppOutline /> },
    { key: '/scan-ship', title: '扫码发货', icon: <ScanningOutline /> },
    { key: '/order-query', title: '订单查询', icon: <UnorderedListOutline /> },
    { key: '/settings', title: '设置', icon: <SetOutline /> },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 主内容区 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </div>
      
      {/* 底部导航栏 */}
      <TabBar 
        activeKey={location.pathname} 
        onChange={(key) => navigate(key)}
        style={{ borderTop: '1px solid #eee' }}
      >
        {tabs.map(tab => (
          <TabBar.Item key={tab.key} icon={tab.icon} title={tab.title} />
        ))}
      </TabBar>
    </div>
  );
};

export default Layout;
