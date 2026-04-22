import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Select, message, Tag, Modal, Form, Input, InputNumber, Card, Statistic, Row, Col, Tooltip, Popconfirm } from 'antd';
import { SearchOutlined, InboxOutlined, ExportOutlined, EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

function WarehouseInventory() {
  const [loading, setLoading] = useState(false);
  const [inventoryList, setInventoryList] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form] = Form.useForm();
  const [searchForm] = Form.useForm();
  const [stats, setStats] = useState({
    totalSku: 0,
    totalQuantity: 0,
    lowStockCount: 0,
    outOfStockCount: 0
  });
  const [warehouseList, setWarehouseList] = useState([]);

  // 获取库存列表
  useEffect(() => {
    fetchInventoryList();
    fetchWarehouses();
  }, [pagination.current, pagination.pageSize]);

  const fetchWarehouses = async () => {
    try {
      const response = await fetch('/api/wms/warehouses');
      const data = await response.json();
      if (data.success) {
        setWarehouseList(data.data || []);
      }
    } catch (error) {
      console.error('获取仓库列表失败:', error);
    }
  };

  const fetchInventoryList = async () => {
    setLoading(true);
    try {
      const searchValues = searchForm.getFieldsValue();
      const params = new URLSearchParams({
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...searchValues
      });
      
      const response = await fetch(`/api/wms/inventory?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setInventoryList(data.data?.list || []);
        setPagination(prev => ({ ...prev, total: data.data?.total || 0 }));
        setStats(data.data?.stats || {
          totalSku: 0,
          totalQuantity: 0,
          lowStockCount: 0,
          outOfStockCount: 0
        });
      } else {
        message.error(data.message || '获取库存列表失败');
      }
    } catch (error) {
      console.error('获取库存列表失败:', error);
      message.error('获取库存列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 创建或更新库存
  const handleSave = async (values) => {
    try {
      const url = editingRecord ? `/api/wms/inventory/${editingRecord.id}` : '/api/wms/inventory';
      const method = editingRecord ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      
      const data = await response.json();
      
      if (data.success) {
        message.success(editingRecord ? '更新库存成功' : '创建库存成功');
        setModalVisible(false);
        form.resetFields();
        setEditingRecord(null);
        fetchInventoryList();
      } else {
        message.error(data.message || '操作失败');
      }
    } catch (error) {
      console.error('操作失败:', error);
      message.error('操作失败: ' + error.message);
    }
  };

  // 编辑库存
  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  // 删除库存
  const handleDelete = async (record) => {
    try {
      const response = await fetch(`/api/wms/inventory/${record.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (data.success) {
        message.success('删除成功');
        fetchInventoryList();
      } else {
        message.error(data.message || '删除失败');
      }
    } catch (error) {
      message.error('删除失败: ' + error.message);
    }
  };

  // 调整库存
  const handleAdjustStock = (record) => {
    Modal.confirm({
      title: '调整库存',
      content: (
        <Form layout="vertical">
          <Form.Item label="调整数量">
            <InputNumber min={-999999} max={999999} placeholder="输入调整数量（正数增加，负数减少）" />
          </Form.Item>
          <Form.Item label="调整原因">
            <TextArea rows={2} placeholder="请输入调整原因" />
          </Form.Item>
        </Form>
      ),
      onOk: async () => {
        // 实现调整逻辑
        message.success('库存调整成功');
        fetchInventoryList();
      }
    });
  };

  // 获取库存状态标签
  const getStockStatus = (quantity, minStock) => {
    if (quantity === 0) {
      return <Tag color="red">缺货</Tag>;
    } else if (quantity <= minStock) {
      return <Tag color="orange">库存低</Tag>;
    } else if (quantity < 50) {
      return <Tag color="blue">正常</Tag>;
    } else {
      return <Tag color="green">充足</Tag>;
    }
  };

  const columns = [
    {
      title: 'SKU编码',
      dataIndex: 'sku_code',
      key: 'sku_code',
      width: 140,
      fixed: 'left',
      render: (text) => <a>{text}</a>
    },
    {
      title: '商品名称',
      dataIndex: 'product_name',
      key: 'product_name',
      width: 200,
      ellipsis: true,
      render: (text) => (
        <Tooltip title={text}>
          {text}
        </Tooltip>
      )
    },
    {
      title: '仓库',
      dataIndex: 'warehouse_name',
      key: 'warehouse_name',
      width: 120
    },
    {
      title: '库位',
      dataIndex: 'location',
      key: 'location',
      width: 100,
      render: (text) => text || '-'
    },
    {
      title: '当前库存',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      sorter: true,
      render: (val) => (
        <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#1890ff' }}>
          {val || 0}
        </span>
      )
    },
    {
      title: '可用库存',
      dataIndex: 'available_quantity',
      key: 'available_quantity',
      width: 100,
      render: (val) => (
        <span style={{ color: '#52c41a' }}>
          {val || 0}
        </span>
      )
    },
    {
      title: '锁定库存',
      dataIndex: 'locked_quantity',
      key: 'locked_quantity',
      width: 100,
      render: (val) => (
        <span style={{ color: '#faad14' }}>
          {val || 0}
        </span>
      )
    },
    {
      title: '最低库存',
      dataIndex: 'min_stock',
      key: 'min_stock',
      width: 100
    },
    {
      title: '状态',
      dataIndex: 'quantity',
      key: 'status',
      width: 100,
      render: (quantity, record) => getStockStatus(quantity, record.min_stock),
      filters: [
        { text: '缺货', value: 'out' },
        { text: '库存低', value: 'low' },
        { text: '正常', value: 'normal' },
        { text: '充足', value: 'high' }
      ]
    },
    {
      title: '最后更新',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 160,
      render: (date) => date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="删除库存"
            description="确定要删除这条库存记录吗？"
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="SKU总数"
              value={stats.totalSku}
              prefix={<InboxOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="库存总数"
              value={stats.totalQuantity}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="库存低"
              value={stats.lowStockCount}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="缺货"
              value={stats.outOfStockCount}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 搜索栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Form form={searchForm} layout="inline" onFinish={fetchInventoryList}>
          <Form.Item name="sku_code" label="SKU编码">
            <Input placeholder="请输入SKU编码" allowClear style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="product_name" label="商品名称">
            <Input placeholder="请输入商品名称" allowClear style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="warehouse_id" label="仓库">
            <Select placeholder="全部仓库" allowClear style={{ width: 140 }}>
              {warehouseList.map(warehouse => (
                <Option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="status" label="库存状态">
            <Select placeholder="全部状态" allowClear style={{ width: 120 }}>
              <Option value="out">缺货</Option>
              <Option value="low">库存低</Option>
              <Option value="normal">正常</Option>
              <Option value="high">充足</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} htmlType="submit">
                搜索
              </Button>
              <Button onClick={() => { searchForm.resetFields(); fetchInventoryList(); }}>
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {/* 操作按钮 */}
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingRecord(null); form.resetFields(); setModalVisible(true); }}>
            新增库存
          </Button>
          <Button icon={<ExportOutlined />}>
            导出
          </Button>
        </Space>
      </div>

      {/* 库存列表 */}
      <Table
        columns={columns}
        dataSource={inventoryList}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条记录`,
          onChange: (page, pageSize) => setPagination({ ...pagination, current: page, pageSize })
        }}
        scroll={{ x: 1600 }}
      />

      {/* 新增/编辑库存弹窗 */}
      <Modal
        title={editingRecord ? '编辑库存' : '新增库存'}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); form.resetFields(); setEditingRecord(null); }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item
            name="sku_code"
            label="SKU编码"
            rules={[{ required: true, message: '请输入SKU编码' }]}
          >
            <Input placeholder="请输入SKU编码" disabled={!!editingRecord} />
          </Form.Item>
          <Form.Item
            name="product_name"
            label="商品名称"
            rules={[{ required: true, message: '请输入商品名称' }]}
          >
            <Input placeholder="请输入商品名称" />
          </Form.Item>
          <Form.Item
            name="warehouse_id"
            label="仓库"
            rules={[{ required: true, message: '请选择仓库' }]}
          >
            <Select placeholder="请选择仓库">
              {warehouseList.map(warehouse => (
                <Option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="location" label="库位">
            <Input placeholder="请输入库位（如：A-01-01）" />
          </Form.Item>
          <Form.Item
            name="quantity"
            label="当前库存"
            rules={[{ required: true, message: '请输入当前库存' }]}
          >
            <InputNumber min={0} placeholder="请输入数量" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="available_quantity"
            label="可用库存"
            rules={[{ required: true, message: '请输入可用库存' }]}
          >
            <InputNumber min={0} placeholder="请输入数量" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="locked_quantity"
            label="锁定库存"
            rules={[{ required: true, message: '请输入锁定库存' }]}
          >
            <InputNumber min={0} placeholder="请输入数量" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="min_stock"
            label="最低库存"
            rules={[{ required: true, message: '请输入最低库存' }]}
          >
            <InputNumber min={0} placeholder="请输入最低库存数量" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <TextArea rows={2} placeholder="请输入备注信息" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default WarehouseInventory;
