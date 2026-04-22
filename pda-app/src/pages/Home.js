import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Grid, Card } from 'antd-mobile';
import { 
  ScanningOutline, 
  ReceivePaymentOutline, 
  FileOutline,
  CheckShieldOutline,
  UnorderedListOutline,
  HistogramOutline,
  VideoOutline,
  EyeOutline
} from 'antd-mobile-icons';
import { useAuth } from '../contexts/AuthContext';

const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const menuItems = [
    { icon: <ScanningOutline />, title: '扫码发货', path: '/scan-ship', color: '#1890ff' },
    { icon: <ReceivePaymentOutline />, title: '扫码收货', path: '/scan-receive', color: '#52c41a' },
    { icon: <CheckShieldOutline />, title: '库存盘点', path: '/inventory-check', color: '#faad14' },
    { icon: <UnorderedListOutline />, title: '订单查询', path: '/order-query', color: '#722ed1' },
    { icon: <FileOutline />, title: '快递报单', path: '/courier-report', color: '#eb2f96' },
    { icon: <VideoOutline />, title: '录像端', path: '/video-record', color: '#ff4d4f' },
    { icon: <EyeOutline />, title: '扫描端', path: '/video-scan', color: '#13c2c2' },
  ];

  return (
    <div style={{ padding: 16, background: '#f5f5f5', minHeight: '100%' }}>
      {/* 用户信息卡片 */}
      <Card style={{ marginBottom: 16, borderRadius: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ 
            width: 48, 
            height: 48, 
            borderRadius: 24, 
            background: '#1890ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 20,
            fontWeight: 'bold',
            marginRight: 12
          }}>
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>{user?.name || '用户'}</div>
            <div style={{ fontSize: 12, color: '#999' }}>欢迎使用协途PDA</div>
          </div>
        </div>
      </Card>

      {/* 快捷功能 */}
      <Card title="快捷功能" style={{ borderRadius: 12 }}>
        <Grid columns={3} gap={16}>
          {menuItems.map((item, index) => (
            <Grid.Item key={index}>
              <div 
                onClick={() => navigate(item.path)}
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center',
                  padding: '16px 0',
                  cursor: 'pointer'
                }}
              >
                <div style={{ 
                  width: 48, 
                  height: 48, 
                  borderRadius: 12,
                  background: `${item.color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 8
                }}>
                  <span style={{ fontSize: 24, color: item.color }}>{item.icon}</span>
                </div>
                <span style={{ fontSize: 13, color: '#333' }}>{item.title}</span>
              </div>
            </Grid.Item>
          ))}
        </Grid>
      </Card>

      {/* 今日统计 */}
      <Card title="今日统计" style={{ marginTop: 16, borderRadius: 12 }}>
        <Grid columns={3} gap={8}>
          <Grid.Item>
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>0</div>
              <div style={{ fontSize: 12, color: '#999' }}>待发货</div>
            </div>
          </Grid.Item>
          <Grid.Item>
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>0</div>
              <div style={{ fontSize: 12, color: '#999' }}>已发货</div>
            </div>
          </Grid.Item>
          <Grid.Item>
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#faad14' }}>0</div>
              <div style={{ fontSize: 12, color: '#999' }}>待收货</div>
            </div>
          </Grid.Item>
        </Grid>
      </Card>
    </div>
  );
};

export default Home;
