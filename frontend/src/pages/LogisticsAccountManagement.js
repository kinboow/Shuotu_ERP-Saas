import React, { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Input, Switch, Space, message, Tag, Tooltip
} from 'antd';
import {
  PlusOutlined, EditOutlined, KeyOutlined, CheckCircleOutlined, CloseCircleOutlined
} from '@ant-design/icons';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '/api';

const LogisticsAccountManagement = () => {
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentLogistics, setCurrentLogistics] = useState(null);
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/logistics/providers`);
      if (response.data.success) {
        setDataSource(response.data.data);
      }
    } catch (error) {
      console.error('获取物流商列表失败:', error);
      message.error('获取物流商列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 开启/关闭PDA登录
  const handleTogglePDAAccess = async (record) => {
    try {
      const response = await axios.put(
        `${API_URL}/logistics/providers/${record.id}/pda-access`,
        {
          login_enabled: !record.login_enabled,
          pda_access: !record.pda_access
        }
      );

      if (response.data.success) {
        message.success(record.login_enabled ? 'PDA登录已关闭' : 'PDA登录已开启');
        fetchData();
      }
    } catch (error) {
      console.error('更新失败:', error);
      message.error('更新失败');
    }
  };

  // 设置登录账号
  const handleSetAccount = (record) => {
    setCurrentLogistics(record);
    form.setFieldsValue({
      login_username: record.login_username || '',
      login_enabled: record.login_enabled || false,
      pda_access: record.pda_access !== false
    });
    setModalVisible(true);
  };

  // 修改密码
  const handleChangePassword = (record) => {
    setCurrentLogistics(record);
    passwordForm.resetFields();
    setPasswordModalVisible(true);
  };

  // 提交账号设置
  const handleSubmitAccount = async () => {
    try {
      const values = await form.validateFields();
      
      const response = await axios.put(
        `${API_URL}/logistics/providers/${currentLogistics.id}/login-account`,
        values
      );

      if (response.data.success) {
        message.success('账号设置成功');
        setModalVisible(false);
        fetchData();
      }
    } catch (error) {
      console.error('设置失败:', error);
      message.error(error.response?.data?.message || '设置失败');
    }
  };

  // 提交密码修改
  const handleSubmitPassword = async () => {
    try {
      const values = await passwordForm.validateFields();
      
      if (values.new_password !== values.confirm_password) {
        message.error('两次输入的密码不一致');
        return;
      }

      const response = await axios.put(
        `${API_URL}/logistics/providers/${currentLogistics.id}/change-password`,
        {
          new_password: values.new_password
        }
      );

      if (response.data.success) {
        message.success('密码修改成功');
        setPasswordModalVisible(false);
        passwordForm.resetFields();
      }
    } catch (error) {
      console.error('修改失败:', error);
      message.error(error.response?.data?.message || '修改失败');
    }
  };

  const columns = [
    {
      title: '物流商名称',
      dataIndex: 'provider_name',
      key: 'provider_name',
      width: 200,
      fixed: 'left'
    },
    {
      title: '物流商代码',
      dataIndex: 'provider_code',
      key: 'provider_code',
      width: 120
    },
    {
      title: '联系人',
      dataIndex: 'contact_person',
      key: 'contact_person',
      width: 100
    },
    {
      title: '联系电话',
      dataIndex: 'contact_phone',
      key: 'contact_phone',
      width: 130
    },
    {
      title: '登录账号',
      dataIndex: 'login_username',
      key: 'login_username',
      width: 150,
      render: (text) => text || <span style={{ color: '#999' }}>未设置</span>
    },
    {
      title: 'PDA登录',
      dataIndex: 'login_enabled',
      key: 'login_enabled',
      width: 100,
      align: 'center',
      render: (enabled, record) => (
        <Tag color={enabled ? 'success' : 'default'} icon={enabled ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
          {enabled ? '已开启' : '已关闭'}
        </Tag>
      )
    },
    {
      title: 'PDA访问权限',
      dataIndex: 'pda_access',
      key: 'pda_access',
      width: 120,
      align: 'center',
      render: (access) => (
        <Tag color={access ? 'processing' : 'default'}>
          {access ? '允许' : '禁止'}
        </Tag>
      )
    },
    {
      title: '最后登录',
      dataIndex: 'last_login_at',
      key: 'last_login_at',
      width: 160,
      render: (text) => text || '-'
    },
    {
      title: '登录次数',
      dataIndex: 'login_count',
      key: 'login_count',
      width: 100,
      align: 'center',
      render: (count) => count || 0
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleSetAccount(record)}
          >
            设置账号
          </Button>
          {record.login_username && (
            <Button
              type="link"
              size="small"
              icon={<KeyOutlined />}
              onClick={() => handleChangePassword(record)}
            >
              修改密码
            </Button>
          )}
          <Switch
            checked={record.login_enabled}
            onChange={() => handleTogglePDAAccess(record)}
            checkedChildren="开启"
            unCheckedChildren="关闭"
            size="small"
          />
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>物流商PDA账号管理</h2>
        <Tooltip title="为物流商设置PDA登录账号，允许他们使用PDA进行快递报单">
          <span style={{ color: '#999', fontSize: '14px' }}>
            💡 提示：开启后物流商可使用PDA登录进行报单
          </span>
        </Tooltip>
      </div>

      <Table
        columns={columns}
        dataSource={dataSource}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1500 }}
        pagination={{
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`
        }}
      />

      {/* 设置账号弹窗 */}
      <Modal
        title="设置PDA登录账号"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmitAccount}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item label="物流商名称">
            <Input value={currentLogistics?.provider_name} disabled />
          </Form.Item>

          <Form.Item
            label="登录账号"
            name="login_username"
            rules={[
              { required: true, message: '请输入登录账号' },
              { min: 4, message: '账号至少4个字符' },
              { pattern: /^[a-zA-Z0-9_]+$/, message: '只能包含字母、数字和下划线' }
            ]}
          >
            <Input placeholder="请输入登录账号（字母、数字、下划线）" />
          </Form.Item>

          <Form.Item
            label="登录密码"
            name="login_password"
            rules={[
              { required: !currentLogistics?.login_username, message: '请输入登录密码' },
              { min: 6, message: '密码至少6个字符' }
            ]}
            extra={currentLogistics?.login_username ? '留空则不修改密码' : ''}
          >
            <Input.Password placeholder="请输入登录密码（至少6位）" />
          </Form.Item>

          <Form.Item
            label="启用PDA登录"
            name="login_enabled"
            valuePropName="checked"
          >
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>

          <Form.Item
            label="允许PDA访问"
            name="pda_access"
            valuePropName="checked"
          >
            <Switch checkedChildren="允许" unCheckedChildren="禁止" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 修改密码弹窗 */}
      <Modal
        title="修改登录密码"
        open={passwordModalVisible}
        onCancel={() => setPasswordModalVisible(false)}
        onOk={handleSubmitPassword}
        width={500}
      >
        <Form
          form={passwordForm}
          layout="vertical"
        >
          <Form.Item label="物流商名称">
            <Input value={currentLogistics?.provider_name} disabled />
          </Form.Item>

          <Form.Item label="登录账号">
            <Input value={currentLogistics?.login_username} disabled />
          </Form.Item>

          <Form.Item
            label="新密码"
            name="new_password"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少6个字符' }
            ]}
          >
            <Input.Password placeholder="请输入新密码（至少6位）" />
          </Form.Item>

          <Form.Item
            label="确认密码"
            name="confirm_password"
            rules={[
              { required: true, message: '请再次输入新密码' }
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LogisticsAccountManagement;
