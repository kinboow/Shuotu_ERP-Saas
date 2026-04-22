import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Toast, Selector } from 'antd-mobile';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [userType, setUserType] = useState('employee'); // employee 或 logistics

  const userTypeOptions = [
    { label: '企业员工', value: 'employee' },
    { label: '物流商', value: 'logistics' }
  ];

  const onFinish = async (values) => {
    setLoading(true);
    const result = await login(values.username, values.password, userType);
    setLoading(false);
    
    if (result.success) {
      Toast.show({ content: '登录成功', icon: 'success' });
      navigate('/', { replace: true });
    } else {
      Toast.show({ content: result.message, icon: 'fail' });
    }
  };

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)'
    }}>
      {/* Logo区域 */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center',
        color: '#fff'
      }}>
        <div style={{ 
          width: 80, 
          height: 80, 
          background: '#fff', 
          borderRadius: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          <span style={{ fontSize: 32, fontWeight: 'bold', color: '#1890ff' }}>协途</span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>PDA移动端</h1>
        <p style={{ fontSize: 14, opacity: 0.8, marginTop: 8 }}>跨境电商ERP系统</p>
      </div>

      {/* 登录表单 */}
      <div style={{ 
        background: '#fff', 
        borderRadius: '24px 24px 0 0',
        padding: '32px 24px',
        paddingBottom: 48
      }}>
        <h2 style={{ fontSize: 20, marginBottom: 24, textAlign: 'center' }}>账号登录</h2>
        
        {/* 登录类型选择 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, color: '#333', marginBottom: 8 }}>登录类型</div>
          <Selector
            options={userTypeOptions}
            value={[userType]}
            onChange={(arr) => {
              if (arr.length > 0) {
                setUserType(arr[0]);
              }
            }}
            style={{
              '--border-radius': '8px',
              '--border': '1px solid #d9d9d9',
              '--checked-border': '1px solid #1890ff',
              '--checked-color': '#1890ff'
            }}
          />
        </div>

        <Form
          onFinish={onFinish}
          footer={
            <Button 
              block 
              type="submit" 
              color="primary" 
              size="large"
              loading={loading}
              style={{ borderRadius: 8 }}
            >
              登录
            </Button>
          }
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input 
              placeholder={userType === 'employee' ? '请输入员工账号' : '请输入物流商账号'} 
              clearable 
              style={{ fontSize: 16 }} 
            />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input 
              type="password" 
              placeholder="请输入密码" 
              clearable 
              style={{ fontSize: 16 }} 
            />
          </Form.Item>
        </Form>
        
        <div style={{ textAlign: 'center', marginTop: 16, color: '#999', fontSize: 12 }}>
          {userType === 'employee' ? '如忘记密码，请联系管理员' : '如需开通账号，请联系企业管理员'}
        </div>
      </div>
    </div>
  );
};

export default Login;
