import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Space, Tag, Modal, Form, Input, message, Card, 
  Popconfirm, Checkbox, Collapse, Divider
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, SafetyOutlined
} from '@ant-design/icons';
import { rolesAPI } from '../api';

const { Panel } = Collapse;
const { TextArea } = Input;

function RoleManagement() {
  const [roles, setRoles] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, []);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const response = await rolesAPI.getAll();
      if (response.data.success) {
        setRoles(response.data.data);
      }
    } catch (error) {
      message.error('获取角色列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await rolesAPI.getAllPermissions();
      if (response.data.success) {
        setAllPermissions(response.data.data);
      }
    } catch (error) {
      console.error('获取权限列表失败:', error);
    }
  };

  const handleAdd = () => {
    setEditingRole(null);
    setSelectedPermissions([]);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = async (record) => {
    try {
      const response = await rolesAPI.getById(record.id);
      if (response.data.success) {
        const roleData = response.data.data;
        setEditingRole(roleData);
        setSelectedPermissions(roleData.permissions || []);
        form.setFieldsValue({
          roleCode: roleData.role_code,
          roleName: roleData.role_name,
          description: roleData.description
        });
        setModalVisible(true);
      }
    } catch (error) {
      message.error('获取角色详情失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      const response = await rolesAPI.delete(id);
      if (response.data.success) {
        message.success('删除成功');
        fetchRoles();
      } else {
        message.error(response.data.message);
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      const data = {
        ...values,
        permissions: selectedPermissions
      };
      
      let response;
      if (editingRole) {
        response = await rolesAPI.update(editingRole.id, data);
      } else {
        response = await rolesAPI.create(data);
      }
      
      if (response.data.success) {
        message.success(editingRole ? '更新成功' : '创建成功');
        setModalVisible(false);
        fetchRoles();
      } else {
        message.error(response.data.message);
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handlePermissionChange = (modulePermissions, checked) => {
    if (checked) {
      setSelectedPermissions([...new Set([...selectedPermissions, ...modulePermissions])]);
    } else {
      setSelectedPermissions(selectedPermissions.filter(p => !modulePermissions.includes(p)));
    }
  };

  const handleSinglePermissionChange = (permissionCode, checked) => {
    if (checked) {
      setSelectedPermissions([...selectedPermissions, permissionCode]);
    } else {
      setSelectedPermissions(selectedPermissions.filter(p => p !== permissionCode));
    }
  };

  const columns = [
    {
      title: '角色编码',
      dataIndex: 'role_code',
      key: 'role_code',
      width: 150
    },
    {
      title: '角色名称',
      dataIndex: 'role_name',
      key: 'role_name',
      width: 150,
      render: (text, record) => (
        <Space>
          {text}
          {record.is_system === 1 && <Tag color="blue">系统</Tag>}
        </Space>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '用户数',
      dataIndex: 'user_count',
      key: 'user_count',
      width: 80,
      render: (count) => <Tag>{count || 0}</Tag>
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status) => (
        <Tag color={status === 1 ? 'green' : 'red'}>{status === 1 ? '启用' : '禁用'}</Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          {record.is_system !== 1 && (
            <Popconfirm title="确定要删除该角色吗？" onConfirm={() => handleDelete(record.id)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card title="角色管理" extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增角色</Button>
      }>
        <Table
          columns={columns}
          dataSource={roles}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>

      {/* 新增/编辑角色弹窗 */}
      <Modal
        title={editingRole ? '编辑角色' : '新增角色'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="roleCode" label="角色编码" rules={[{ required: true, message: '请输入角色编码' }]}>
            <Input disabled={!!editingRole} placeholder="请输入角色编码，如：operator" />
          </Form.Item>
          <Form.Item name="roleName" label="角色名称" rules={[{ required: true, message: '请输入角色名称' }]}>
            <Input placeholder="请输入角色名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="请输入角色描述" />
          </Form.Item>
          
          <Divider orientation="left"><SafetyOutlined /> 权限配置</Divider>
          
          <Collapse defaultActiveKey={allPermissions.map((_, i) => i.toString())}>
            {allPermissions.map((group, index) => {
              const groupPermissionCodes = group.permissions.map(p => p.permission_code);
              const allChecked = groupPermissionCodes.every(code => selectedPermissions.includes(code));
              const someChecked = groupPermissionCodes.some(code => selectedPermissions.includes(code));
              
              return (
                <Panel 
                  key={index.toString()} 
                  header={
                    <Checkbox
                      checked={allChecked}
                      indeterminate={someChecked && !allChecked}
                      onChange={e => handlePermissionChange(groupPermissionCodes, e.target.checked)}
                      onClick={e => e.stopPropagation()}
                    >
                      {group.moduleName}
                    </Checkbox>
                  }
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                    {group.permissions.map(p => (
                      <Checkbox
                        key={p.permission_code}
                        checked={selectedPermissions.includes(p.permission_code)}
                        onChange={e => handleSinglePermissionChange(p.permission_code, e.target.checked)}
                      >
                        {p.permission_name}
                      </Checkbox>
                    ))}
                  </div>
                </Panel>
              );
            })}
          </Collapse>
          
          <Form.Item style={{ marginTop: 24 }}>
            <Space>
              <Button type="primary" htmlType="submit">确定</Button>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default RoleManagement;
