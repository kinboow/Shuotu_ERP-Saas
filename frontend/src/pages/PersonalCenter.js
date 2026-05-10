import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Avatar, Row, Col, Divider, Tabs, Descriptions, Tag, Upload, Spin } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, PhoneOutlined, SafetyOutlined, LoadingOutlined, PlusOutlined } from '@ant-design/icons';
import { authAPI, ossAPI, usersAPI } from '../api';
import { clearAuthSession } from '../utils/authStorage';

function PersonalCenter() {
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    fetchUserInfo();
  }, []);

  const fetchUserInfo = async () => {
    setLoading(true);
    try {
      const response = await authAPI.getCurrentUser();
      if (response.data.success) {
        const userData = response.data.data.user;
        setUser(userData);
        setPermissions(response.data.data.permissions || []);
        profileForm.setFieldsValue({
          username: userData.username,
          realName: userData.realName,
          phone: userData.phone,
          email: userData.email,
          department: userData.department,
          position: userData.position
        });
      }
    } catch (error) {
      message.error('获取用户信息失败');
    } finally {
      setLoading(false);
    }
  };

  // 头像上传前检查
  const beforeUpload = (file) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('只能上传图片文件！');
      return false;
    }
    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) {
      message.error('图片大小不能超过2MB！');
      return false;
    }
    return true;
  };

  // 处理头像上传
  const handleAvatarUpload = async (info) => {
    const file = info.file;
    if (!beforeUpload(file)) return;

    setUploadingAvatar(true);
    try {
      // 上传到OSS
      const uploadRes = await ossAPI.upload(file, 'permanent');
      if (uploadRes.data.success) {
        const avatarUrl = uploadRes.data.data.url;
        
        // 更新用户头像
        const updateRes = await usersAPI.update(user.id, { avatar: avatarUrl });
        if (updateRes.data.success) {
          message.success('头像更新成功');
          // 更新本地状态
          const newUser = { ...user, avatar: avatarUrl };
          setUser(newUser);
          // 更新localStorage
          localStorage.setItem('user', JSON.stringify(newUser));
        } else {
          message.error(updateRes.data.message || '更新头像失败');
        }
      } else {
        message.error(uploadRes.data.message || '上传失败');
      }
    } catch (error) {
      console.error('头像上传失败:', error);
      message.error('头像上传失败');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangePassword = async (values) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('两次输入的密码不一致');
      return;
    }
    
    setSaving(true);
    try {
      const response = await authAPI.changePassword({
        oldPassword: values.oldPassword,
        newPassword: values.newPassword
      });
      
      if (response.data.success) {
        message.success('密码修改成功，请重新登录');
        passwordForm.resetFields();
        // 清除登录信息并跳转到登录页
        setTimeout(() => {
          clearAuthSession();
          window.location.href = '/login';
        }, 1500);
      } else {
        message.error(response.data.message);
      }
    } catch (error) {
      message.error('修改密码失败');
    } finally {
      setSaving(false);
    }
  };

  const permissionModules = {
    system: '系统管理',
    product: '商品管理',
    order: '订单管理',
    purchase: '采购管理',
    inventory: '库存管理',
    finance: '财务管理',
    platform: '平台管理'
  };

  // 按模块分组权限
  const groupedPermissions = {};
  permissions.forEach(p => {
    const parts = p.split(':');
    const module = parts[0];
    if (!groupedPermissions[module]) {
      groupedPermissions[module] = [];
    }
    groupedPermissions[module].push(p);
  });

  const items = [
    {
      key: 'profile',
      label: '基本信息',
      children: (
        <Card loading={loading}>
          <Row gutter={24}>
            <Col span={6} style={{ textAlign: 'center' }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <Avatar size={120} icon={<UserOutlined />} src={user?.avatar} style={{ backgroundColor: '#1890ff' }} />
                {uploadingAvatar && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <LoadingOutlined style={{ fontSize: 24, color: '#fff' }} />
                  </div>
                )}
              </div>
              <div style={{ marginTop: 16 }}>
                <Upload 
                  showUploadList={false} 
                  beforeUpload={() => false}
                  onChange={handleAvatarUpload}
                  accept="image/*"
                  disabled={uploadingAvatar}
                >
                  <Button size="small" loading={uploadingAvatar}>
                    {uploadingAvatar ? '上传中...' : '更换头像'}
                  </Button>
                </Upload>
                <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
                  支持 JPG、PNG，不超过2MB
                </div>
              </div>
            </Col>
            <Col span={18}>
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="用户名">{user?.username}</Descriptions.Item>
                <Descriptions.Item label="真实姓名">{user?.realName || '-'}</Descriptions.Item>
                <Descriptions.Item label="手机号">{user?.phone || '-'}</Descriptions.Item>
                <Descriptions.Item label="邮箱">{user?.email || '-'}</Descriptions.Item>
                <Descriptions.Item label="部门">{user?.department || '-'}</Descriptions.Item>
                <Descriptions.Item label="职位">{user?.position || '-'}</Descriptions.Item>
                <Descriptions.Item label="角色">
                  <Tag color={user?.roleCode === 'super_admin' ? 'red' : 'blue'}>{user?.roleName || '-'}</Tag>
                  {user?.isAdmin === 1 && <Tag color="gold">主账号</Tag>}
                </Descriptions.Item>
                <Descriptions.Item label="最后登录">
                  {user?.lastLoginAt ? (
                    <>
                      {user.lastLoginAt.replace('T', ' ').substring(0, 19)}
                      {user.loginIp && <span style={{ marginLeft: 8, color: '#999' }}>({user.loginIp})</span>}
                    </>
                  ) : '-'}
                </Descriptions.Item>
              </Descriptions>
            </Col>
          </Row>
        </Card>
      )
    },
    {
      key: 'password',
      label: '修改密码',
      children: (
        <Card style={{ maxWidth: 500 }}>
          <Form form={passwordForm} layout="vertical" onFinish={handleChangePassword}>
            <Form.Item 
              name="oldPassword" 
              label="当前密码" 
              rules={[{ required: true, message: '请输入当前密码' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="请输入当前密码" />
            </Form.Item>
            <Form.Item 
              name="newPassword" 
              label="新密码" 
              rules={[
                { required: true, message: '请输入新密码' },
                { min: 6, message: '密码至少6位' }
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="请输入新密码" />
            </Form.Item>
            <Form.Item 
              name="confirmPassword" 
              label="确认新密码" 
              rules={[
                { required: true, message: '请确认新密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'));
                  },
                }),
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="请再次输入新密码" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={saving}>
                修改密码
              </Button>
            </Form.Item>
          </Form>
        </Card>
      )
    },
    {
      key: 'permissions',
      label: '我的权限',
      children: (
        <Card>
          {Object.keys(groupedPermissions).length > 0 ? (
            Object.entries(groupedPermissions).map(([module, perms]) => (
              <div key={module} style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 'bold', marginBottom: 8 }}>
                  <SafetyOutlined style={{ marginRight: 8 }} />
                  {permissionModules[module] || module}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {perms.map(p => (
                    <Tag key={p} color="blue">{p.split(':').slice(1).join(':')}</Tag>
                  ))}
                </div>
                <Divider style={{ margin: '12px 0' }} />
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>
              暂无权限信息
            </div>
          )}
        </Card>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card title="个人中心">
        <Tabs items={items} />
      </Card>
    </div>
  );
}

export default PersonalCenter;
