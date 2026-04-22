import React from 'react';
import { NavBar, List, Switch, Dialog, Toast } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import { 
  UserOutline, 
  SetOutline, 
  InformationCircleOutline,
  CloseCircleOutline
} from 'antd-mobile-icons';
import { useAuth } from '../contexts/AuthContext';

const Settings = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    const result = await Dialog.confirm({
      content: '确定要退出登录吗？',
    });
    if (result) {
      logout();
      Toast.show({ content: '已退出登录', icon: 'success' });
      navigate('/login', { replace: true });
    }
  };

  return (
    <div style={{ height: '100%', background: '#f5f5f5' }}>
      <NavBar back={null}>设置</NavBar>
      
      {/* 用户信息 */}
      <List header="账号信息" style={{ marginTop: 12 }}>
        <List.Item
          prefix={<UserOutline />}
          description={user?.phone || '未绑定'}
        >
          {user?.name || '用户'}
        </List.Item>
      </List>

      {/* 应用设置 */}
      <List header="应用设置" style={{ marginTop: 12 }}>
        <List.Item
          prefix={<SetOutline />}
          extra={<Switch defaultChecked />}
        >
          扫码声音
        </List.Item>
        <List.Item
          prefix={<SetOutline />}
          extra={<Switch defaultChecked />}
        >
          扫码震动
        </List.Item>
        <List.Item
          prefix={<SetOutline />}
          extra={<Switch />}
        >
          自动提交
        </List.Item>
      </List>

      {/* 关于 */}
      <List header="关于" style={{ marginTop: 12 }}>
        <List.Item
          prefix={<InformationCircleOutline />}
          extra="1.0.0"
        >
          版本号
        </List.Item>
        <List.Item
          prefix={<InformationCircleOutline />}
          onClick={() => Toast.show({ content: '已是最新版本' })}
        >
          检查更新
        </List.Item>
      </List>

      {/* 退出登录 */}
      <List style={{ marginTop: 12 }}>
        <List.Item
          prefix={<CloseCircleOutline style={{ color: '#ff4d4f' }} />}
          onClick={handleLogout}
          arrow={false}
        >
          <span style={{ color: '#ff4d4f' }}>退出登录</span>
        </List.Item>
      </List>

      {/* 底部信息 */}
      <div style={{ textAlign: 'center', padding: 24, color: '#999', fontSize: 12 }}>
        <div>协途跨境电商ERP系统</div>
        <div style={{ marginTop: 4 }}>© 2024 All Rights Reserved</div>
      </div>
    </div>
  );
};

export default Settings;
