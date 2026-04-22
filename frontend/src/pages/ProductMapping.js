import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Select, message, Popconfirm, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, LinkOutlined } from '@ant-design/icons';

function ProductMapping() {
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMapping, setEditingMapping] = useState(null);
  const [form] = Form.useForm();
  const [onlineProducts, setOnlineProducts] = useState([]);
  const [erpProducts, setErpProducts] = useState([]);

  useEffect(() => {
    fetchMappings();
    fetchProducts();
  }, []);

  const fetchMappings = async () => {
    setLoading(true);
    try {
      // TODO: 调用API获取映射列表
      // const response = await fetch('/api/product-mappings');
      // const data = await response.json();
      // setMappings(data);
      setMappings([]);
    } catch (error) {
      message.error('获取映射列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      // TODO: 调用API获取在线商品和ERP商品
      // const onlineRes = await fetch('/api/online-products');
      // const erpRes = await fetch('/api/erp-products');
      // setOnlineProducts(await onlineRes.json());
      // setErpProducts(await erpRes.json());
    } catch (error) {
      console.error('获取商品列表失败:', error);
    }
  };

  const columns = [
    {
      title: '在线商品',
      dataIndex: 'onlineProductName',
      key: 'onlineProductName',
      width: 200,
    },
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      width: 100,
      render: (platform) => {
        const platformMap = {
          shein: <Tag color="green">SHEIN</Tag>,
          amazon: <Tag color="blue">Amazon</Tag>,
          ebay: <Tag color="orange">eBay</Tag>,
        };
        return platformMap[platform] || platform;
      },
    },
    {
      title: 'ERP商品',
      dataIndex: 'erpProductName',
      key: 'erpProductName',
      width: 200,
    },
    {
      title: '映射状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const statusMap = {
          active: <Tag color="green">已映射</Tag>,
          inactive: <Tag color="red">未映射</Tag>,
        };
        return statusMap[status] || status;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm
            title="删除映射"
            description="确定要删除这个映射吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const handleEdit = (record) => {
    setEditingMapping(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      // TODO: 调用API删除映射
      message.success('删除成功');
      fetchMappings();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      // TODO: 调用API保存映射
      message.success(editingMapping ? '更新成功' : '添加成功');
      setModalVisible(false);
      form.resetFields();
      setEditingMapping(null);
      fetchMappings();
    } catch (error) {
      console.error('验证失败:', error);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <Button type="primary" icon={<LinkOutlined />} onClick={() => {
          setEditingMapping(null);
          form.resetFields();
          setModalVisible(true);
        }}>
          创建映射
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={mappings}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title={editingMapping ? '编辑映射' : '创建映射'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setEditingMapping(null);
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="onlineProductId" label="在线商品" rules={[{ required: true, message: '请选择在线商品' }]}>
            <Select
              placeholder="选择在线商品"
              options={onlineProducts.map(p => ({ label: p.name, value: p.id }))}
            />
          </Form.Item>
          <Form.Item name="platform" label="平台" rules={[{ required: true, message: '请选择平台' }]}>
            <Select options={[
              { label: 'SHEIN', value: 'shein' },
              { label: 'Amazon', value: 'amazon' },
              { label: 'eBay', value: 'ebay' },
            ]} />
          </Form.Item>
          <Form.Item name="erpProductId" label="ERP商品" rules={[{ required: true, message: '请选择ERP商品' }]}>
            <Select
              placeholder="选择ERP商品"
              options={erpProducts.map(p => ({ label: p.name, value: p.id }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default ProductMapping;
