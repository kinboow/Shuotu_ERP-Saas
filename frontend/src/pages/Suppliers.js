import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  message,
  Popconfirm,
  Row,
  Col
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined
} from '@ant-design/icons';

const { TextArea } = Input;

function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [form] = Form.useForm();
  const [searchForm] = Form.useForm();
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });
  const [searchParams, setSearchParams] = useState({});

  useEffect(() => {
    fetchSuppliers();
  }, [pagination.current, pagination.pageSize, searchParams]);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...searchParams
      });
      
      const response = await fetch(`/api/suppliers?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setSuppliers(data.data.list);
        setPagination(prev => ({
          ...prev,
          total: data.data.total
        }));
      }
    } catch (error) {
      console.error('获取厂家列表失败:', error);
      message.error('获取厂家列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingSupplier(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingSupplier(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      const response = await fetch(`/api/suppliers/${id}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      
      if (data.success) {
        message.success('删除成功');
        fetchSuppliers();
      } else {
        message.error(data.message || '删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  const handleToggleStatus = async (record) => {
    try {
      const response = await fetch(`/api/suppliers/${record.id}/toggle-status`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        message.success(data.message);
        fetchSuppliers();
      } else {
        message.error(data.message || '操作失败');
      }
    } catch (error) {
      console.error('操作失败:', error);
      message.error('操作失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      const url = editingSupplier 
        ? `/api/suppliers/${editingSupplier.id}` 
        : '/api/suppliers';
      const method = editingSupplier ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });

      const data = await response.json();

      if (data.success) {
        message.success(editingSupplier ? '更新成功' : '创建成功');
        setModalVisible(false);
        fetchSuppliers();
      } else {
        message.error(data.message || '操作失败');
      }
    } catch (error) {
      console.error('操作失败:', error);
      message.error('操作失败');
    }
  };

  const handleSearch = (values) => {
    setSearchParams(values);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleReset = () => {
    searchForm.resetFields();
    setSearchParams({});
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const columns = [
    {
      title: '厂家编码',
      dataIndex: 'supplier_code',
      key: 'supplier_code',
      width: 120
    },
    {
      title: '厂家名称',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
      width: 200
    },
    {
      title: '简称',
      dataIndex: 'short_name',
      key: 'short_name',
      width: 100
    },
    {
      title: '联系人',
      dataIndex: 'contact_name',
      key: 'contact_name',
      width: 100
    },
    {
      title: '联系电话',
      dataIndex: 'contact_phone',
      key: 'contact_phone',
      width: 130
    },
    {
      title: '主营品类',
      dataIndex: 'main_category',
      key: 'main_category',
      width: 150,
      ellipsis: true
    },
    {
      title: '结算方式',
      dataIndex: 'settlement_type',
      key: 'settlement_type',
      width: 100,
      render: (type) => {
        const typeMap = {
          1: <Tag color="blue">月结</Tag>,
          2: <Tag color="green">周结</Tag>,
          3: <Tag color="orange">现结</Tag>
        };
        return typeMap[type] || '-';
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status) => (
        <Tag color={status === 1 ? 'success' : 'default'}>
          {status === 1 ? '启用' : '禁用'}
        </Tag>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (text) => text ? new Date(text).toLocaleString('zh-CN') : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => handleToggleStatus(record)}
          >
            {record.status === 1 ? '禁用' : '启用'}
          </Button>
          <Popconfirm
            title="确定要删除这个厂家吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card
        title="厂家管理"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            添加厂家
          </Button>
        }
      >
        {/* 搜索表单 */}
        <div style={{ marginBottom: 16, background: '#fafafa', padding: 16, borderRadius: 4 }}>
          <Form
            form={searchForm}
            layout="inline"
            onFinish={handleSearch}
          >
            <Form.Item name="keyword" label="关键词">
              <Input placeholder="编码/名称/联系人/电话" style={{ width: 200 }} allowClear />
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Select placeholder="全部" style={{ width: 100 }} allowClear>
                <Select.Option value={1}>启用</Select.Option>
                <Select.Option value={2}>禁用</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                  查询
                </Button>
                <Button onClick={handleReset}>重置</Button>
              </Space>
            </Form.Item>
          </Form>
        </div>

        <Table
          columns={columns}
          dataSource={suppliers}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => {
              setPagination({ ...pagination, current: page, pageSize });
            }
          }}
          scroll={{ x: 1400 }}
        />
      </Card>

      {/* 编辑/创建弹窗 */}
      <Modal
        title={editingSupplier ? '编辑厂家' : '添加厂家'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={800}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="supplier_code"
                label="厂家编码"
                rules={[{ required: true, message: '请输入厂家编码' }]}
              >
                <Input placeholder="请输入厂家编码" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="supplier_name"
                label="厂家名称"
                rules={[{ required: true, message: '请输入厂家名称' }]}
              >
                <Input placeholder="请输入厂家名称" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="short_name" label="简称">
                <Input placeholder="请输入简称" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="contact_name" label="联系人">
                <Input placeholder="请输入联系人" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="contact_phone" label="联系电话">
                <Input placeholder="请输入联系电话" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="wechat" label="微信">
                <Input placeholder="请输入微信号" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="email" label="邮箱">
                <Input placeholder="请输入邮箱" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="settlement_type" label="结算方式">
                <Select placeholder="请选择">
                  <Select.Option value={1}>月结</Select.Option>
                  <Select.Option value={2}>周结</Select.Option>
                  <Select.Option value={3}>现结</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="settlement_cycle" label="结算周期(天)">
                <InputNumber min={1} placeholder="30" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="address" label="地址">
            <Input placeholder="请输入详细地址" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="bank_name" label="开户银行">
                <Input placeholder="请输入开户银行" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="bank_account" label="银行账号">
                <Input placeholder="请输入银行账号" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="account_name" label="账户名称">
                <Input placeholder="请输入账户名称" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="main_category" label="主营品类">
            <Input placeholder="请输入主营品类，多个用逗号分隔" />
          </Form.Item>

          <Form.Item name="remark" label="备注">
            <TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Suppliers;
