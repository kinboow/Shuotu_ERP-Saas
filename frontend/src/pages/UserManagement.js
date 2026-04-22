import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Space, Input, Select, Tag, Modal, Form, message, Card, 
  Popconfirm, Avatar, Tooltip, Badge
} from 'antd';
import { 
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, 
  KeyOutlined, LogoutOutlined, UserOutlined, ReloadOutlined
} from '@ant-design/icons';
import { usersAPI, rolesAPI } from '../api';

const { Option } = Select;

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({ keyword: '', roleId: '', status: '' });
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [resetPwdVisible, setResetPwdVisible] = useState(false);
  const [resetPwdUser, setResetPwdUser] = useState(null);
  const [form] = Form.useForm();
  const [resetPwdForm] = Form.useForm();

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, [pagination.current, pagination.pageSize]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        ...filters
      };
      const response = await usersAPI.getAll(params);
      if (response.data.success) {
        setUsers(response.data.data);
        setPagination(prev => ({ ...prev, total: response.data.total }));
      }
    } catch (error) {
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await rolesAPI.getAll();
      if (response.data.success) {
        setRoles(response.data.data);
      }
    } catch (error) {
      console.error('获取角色列表失败:', error);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchUsers();
  };

  const handleAdd = () => {
    setEditingUser(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingUser(record);
    form.setFieldsValue({
      username: record.username,
      realName: record.real_name,
      phone: record.phone,
      email: record.email,
      roleId: record.role_id,
      department: record.department,
      position: record.position,
      status: record.status
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      const response = await usersAPI.delete(id);
      if (response.data.success) {
        message.success('删除成功');
        fetchUsers();
      } else {
        message.error(response.data.message);
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      let response;
      if (editingUser) {
        response = await usersAPI.update(editingUser.id, values);
      } else {
        response = await usersAPI.create(values);
      }
      
      if (response.data.success) {
        message.success(editingUser ? '更新成功' : '创建成功');
        setModalVisible(false);
        fetchUsers();
      } else {
        message.error(response.data.message);
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleResetPassword = (record) => {
    setResetPwdUser(record);
    resetPwdForm.resetFields();
    setResetPwdVisible(true);
  };

  const handleResetPwdSubmit = async (values) => {
    try {
      const response = await usersAPI.resetPassword(resetPwdUser.id, values);
      if (response.data.success) {
        message.success('密码重置成功');
        setResetPwdVisible(false);
      } else {
        message.error(response.data.message);
      }
    } catch (error) {
      message.error('密码重置失败');
    }
  };

  const handleForceLogout = async (id) => {
    try {
      const response = await usersAPI.forceLogout(id);
      if (response.data.success) {
        message.success('已强制下线');
      } else {
        message.error(response.data.message);
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      width: 200,
      render: (text, record) => (
        <Space>
          <Avatar icon={<UserOutlined />} src={record.avatar} />
          <div>
            <div style={{ fontWeight: 'bold' }}>
              {text}
              {record.is_admin === 1 && <Tag color="gold" style={{ marginLeft: 8 }}>主账号</Tag>}
            </div>
            {record.real_name && <div style={{ fontSize: 12, color: '#999' }}>{record.real_name}</div>}
          </div>
        </Space>
      )
    },
    {
      title: '角色',
      dataIndex: 'role_name',
      key: 'role_name',
      width: 120,
      render: (text, record) => (
        <Tag color={record.role_code === 'super_admin' ? 'red' : record.role_code === 'admin' ? 'blue' : 'default'}>
          {text || '-'}
        </Tag>
      )
    },
    {
      title: '联系方式',
      key: 'contact',
      width: 180,
      render: (_, record) => (
        <div>
          {record.phone && <div>{record.phone}</div>}
          {record.email && <div style={{ fontSize: 12, color: '#999' }}>{record.email}</div>}
        </div>
      )
    },
    {
      title: '部门/职位',
      key: 'dept',
      width: 150,
      render: (_, record) => (
        <div>
          {record.department && <div>{record.department}</div>}
          {record.position && <div style={{ fontSize: 12, color: '#999' }}>{record.position}</div>}
        </div>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status) => (
        <Badge status={status === 'ACTIVE' ? 'success' : 'error'} text={status === 'ACTIVE' ? '启用' : '禁用'} />
      )
    },
    {
      title: '最后登录',
      key: 'lastLogin',
      width: 180,
      render: (_, record) => (
        <div>
          {record.last_login_at ? (
            <>
              <div>{record.last_login_at?.replace('T', ' ').substring(0, 19)}</div>
              {record.login_ip && <div style={{ fontSize: 12, color: '#999' }}>IP: {record.login_ip}</div>}
            </>
          ) : '-'}
        </div>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Tooltip title="重置密码">
            <Button type="link" size="small" icon={<KeyOutlined />} onClick={() => handleResetPassword(record)} />
          </Tooltip>
          <Tooltip title="强制下线">
            <Popconfirm title="确定要强制该用户下线吗？" onConfirm={() => handleForceLogout(record.id)}>
              <Button type="link" size="small" icon={<LogoutOutlined />} />
            </Popconfirm>
          </Tooltip>
          {record.is_admin !== 1 && (
            <Tooltip title="删除">
              <Popconfirm title="确定要删除该用户吗？" onConfirm={() => handleDelete(record.id)}>
                <Button type="link" size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card title="用户管理" extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增用户</Button>
      }>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="搜索用户名/姓名/手机号"
            prefix={<SearchOutlined />}
            value={filters.keyword}
            onChange={e => setFilters({ ...filters, keyword: e.target.value })}
            onPressEnter={handleSearch}
            style={{ width: 200 }}
          />
          <Select
            placeholder="选择角色"
            value={filters.roleId || undefined}
            onChange={v => setFilters({ ...filters, roleId: v })}
            style={{ width: 150 }}
            allowClear
          >
            {roles.map(r => <Option key={r.id} value={r.id}>{r.role_name}</Option>)}
          </Select>
          <Select
            placeholder="状态"
            value={filters.status || undefined}
            onChange={v => setFilters({ ...filters, status: v })}
            style={{ width: 100 }}
            allowClear
          >
            <Option value="ACTIVE">启用</Option>
            <Option value="DISABLED">禁用</Option>
          </Select>
          <Button icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
          <Button icon={<ReloadOutlined />} onClick={fetchUsers}>刷新</Button>
        </Space>

        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: total => `共 ${total} 条`
          }}
          onChange={(p) => setPagination(p)}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* 新增/编辑用户弹窗 */}
      <Modal
        title={editingUser ? '编辑用户' : '新增用户'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input disabled={!!editingUser} placeholder="请输入用户名" />
          </Form.Item>
          {!editingUser && (
            <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '密码至少6位' }]}>
              <Input.Password placeholder="请输入密码" />
            </Form.Item>
          )}
          <Form.Item name="realName" label="真实姓名">
            <Input placeholder="请输入真实姓名" />
          </Form.Item>
          <Form.Item name="phone" label="手机号">
            <Input placeholder="请输入手机号" />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input placeholder="请输入邮箱" />
          </Form.Item>
          <Form.Item name="roleId" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select placeholder="请选择角色">
              {roles.map(r => <Option key={r.id} value={r.id}>{r.role_name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="department" label="部门">
            <Input placeholder="请输入部门" />
          </Form.Item>
          <Form.Item name="position" label="职位">
            <Input placeholder="请输入职位" />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="ACTIVE">
            <Select>
              <Option value="ACTIVE">启用</Option>
              <Option value="DISABLED">禁用</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">确定</Button>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 重置密码弹窗 */}
      <Modal
        title={`重置密码 - ${resetPwdUser?.username}`}
        open={resetPwdVisible}
        onCancel={() => setResetPwdVisible(false)}
        footer={null}
        width={400}
      >
        <Form form={resetPwdForm} layout="vertical" onFinish={handleResetPwdSubmit}>
          <Form.Item name="newPassword" label="新密码" rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '密码至少6位' }]}>
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">确定</Button>
              <Button onClick={() => setResetPwdVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default UserManagement;
