import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Select, message, Tag, Modal, Form, Input, InputNumber, Card, Statistic, Row, Col } from 'antd';
import { PlusOutlined, ImportOutlined, ExportOutlined, SearchOutlined, InboxOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const mapReferenceTypeToInboundType = (referenceType) => {
  switch ((referenceType || '').toUpperCase()) {
    case 'PURCHASE':
      return 'purchase';
    case 'RETURN':
      return 'return';
    case 'TRANSFER':
      return 'transfer';
    default:
      return 'other';
  }
};

const mapInboundTypeToReferenceType = (inboundType) => {
  switch (inboundType) {
    case 'purchase':
      return 'PURCHASE';
    case 'return':
      return 'RETURN';
    case 'transfer':
      return 'TRANSFER';
    default:
      return 'OTHER';
  }
};

const normalizeInboundRecord = (record = {}) => ({
  ...record,
  inbound_code: record.referenceNo || `IN-${record.id}`,
  inbound_type: mapReferenceTypeToInboundType(record.referenceType),
  related_order_code: record.referenceNo || '-',
  operator_name: record.operatorName || '-',
  total_quantity: Math.abs(Number(record.quantity || 0)),
  inbound_quantity: Math.abs(Number(record.quantity || 0)),
  status: 'completed'
});

function ProductInbound() {
  const [loading, setLoading] = useState(false);
  const [inboundList, setInboundList] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [form] = Form.useForm();
  const [searchForm] = Form.useForm();
  const [warehouseList, setWarehouseList] = useState([]);
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalQuantity: 0
  });

  // 获取入库单列表
  useEffect(() => {
    fetchInboundList();
    fetchWarehouses();
  }, [pagination.current, pagination.pageSize]);

  const fetchWarehouses = async () => {
    try {
      const response = await fetch('/api/inventory/warehouses');
      const data = await response.json();
      if (data.success) {
        setWarehouseList(data.data || []);
      }
    } catch (error) {
      console.error('获取仓库列表失败:', error);
    }
  };

  const fetchInboundList = async () => {
    setLoading(true);
    try {
      const searchValues = searchForm.getFieldsValue();
      const params = new URLSearchParams({
        page: pagination.current,
        pageSize: pagination.pageSize,
        operationType: 'INBOUND'
      });

      if (searchValues.reference_no) {
        params.set('referenceNo', searchValues.reference_no);
      }
      if (searchValues.inbound_type) {
        params.set('referenceType', mapInboundTypeToReferenceType(searchValues.inbound_type));
      }
      if (searchValues.warehouse_id) {
        params.set('warehouseId', searchValues.warehouse_id);
      }
      if (searchValues.sku_code) {
        params.set('skuId', searchValues.sku_code);
      }
      if (searchValues.status && searchValues.status !== 'completed') {
        setInboundList([]);
        setPagination(prev => ({ ...prev, total: 0 }));
        setStats({ totalOrders: 0, pendingOrders: 0, completedOrders: 0, totalQuantity: 0 });
        return;
      }
      
      const response = await fetch(`/api/inventory/logs?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setInboundList((data.data?.list || []).map(normalizeInboundRecord));
        setPagination(prev => ({ ...prev, total: data.data?.total || 0 }));
        setStats({
          totalOrders: data.data?.total || 0,
          pendingOrders: 0,
          completedOrders: data.data?.total || 0,
          totalQuantity: Math.abs(Number(data.data?.stats?.totalQuantity || 0))
        });
      } else {
        message.error(data.message || '获取入库单列表失败');
      }
    } catch (error) {
      console.error('获取入库单列表失败:', error);
      message.error('获取入库单列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 创建入库单
  const handleCreate = async (values) => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('user') || 'null');
      const response = await fetch('/api/inventory/inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skuId: values.sku_code,
          quantity: values.total_quantity,
          warehouseId: values.warehouse_id,
          referenceNo: values.related_order_code,
          referenceType: mapInboundTypeToReferenceType(values.inbound_type),
          operatorId: currentUser?.id,
          operatorName: currentUser?.username || currentUser?.name,
          remark: values.remark
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        message.success('入库成功');
        setModalVisible(false);
        form.resetFields();
        fetchInboundList();
      } else {
        message.error(data.message || '入库失败');
      }
    } catch (error) {
      console.error('入库失败:', error);
      message.error('入库失败: ' + error.message);
    }
  };

  // 查看详情
  const handleViewDetail = (record) => {
    setCurrentRecord(record);
    setDetailModalVisible(true);
  };

  // 获取状态标签
  const getStatusTag = (status) => {
    const statusMap = {
      'pending': { color: 'orange', text: '待入库' },
      'partial': { color: 'blue', text: '部分入库' },
      'completed': { color: 'green', text: '已完成' },
      'cancelled': { color: 'default', text: '已取消' }
    };
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 获取入库类型标签
  const getTypeTag = (type) => {
    const typeMap = {
      'purchase': { color: 'blue', text: '采购入库' },
      'return': { color: 'orange', text: '退货入库' },
      'transfer': { color: 'purple', text: '调拨入库' },
      'other': { color: 'default', text: '其他入库' }
    };
    const config = typeMap[type] || { color: 'default', text: type };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns = [
    {
      title: '入库单号',
      dataIndex: 'inbound_code',
      key: 'inbound_code',
      width: 160,
      fixed: 'left',
      render: (text, record) => (
        <a onClick={() => handleViewDetail(record)}>{text}</a>
      )
    },
    {
      title: '入库类型',
      dataIndex: 'inbound_type',
      key: 'inbound_type',
      width: 100,
      render: (type) => getTypeTag(type)
    },
    {
      title: '关联单号',
      dataIndex: 'related_order_code',
      key: 'related_order_code',
      width: 150,
      render: (text) => text || '-'
    },
    {
      title: '操作人',
      dataIndex: 'operator_name',
      key: 'operator_name',
      width: 150,
      ellipsis: true
    },
    {
      title: '商品数量',
      dataIndex: 'total_quantity',
      key: 'total_quantity',
      width: 100,
      sorter: true
    },
    {
      title: '已入库数量',
      dataIndex: 'inbound_quantity',
      key: 'inbound_quantity',
      width: 110,
      render: (val, record) => (
        <span style={{ color: val === record.total_quantity ? '#52c41a' : '#faad14' }}>
          {val || 0}
        </span>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => getStatusTag(status),
      filters: [
        { text: '待入库', value: 'pending' },
        { text: '部分入库', value: 'partial' },
        { text: '已完成', value: 'completed' },
        { text: '已取消', value: 'cancelled' }
      ]
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date) => date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 150,
      ellipsis: true,
      render: (text) => text || '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleViewDetail(record)}>
            详情
          </Button>
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
              title="入库记录总数"
              value={stats.totalOrders}
              prefix={<InboxOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待处理"
              value={stats.pendingOrders}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已入库"
              value={stats.completedOrders}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="入库商品总数"
              value={stats.totalQuantity}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 搜索栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Form form={searchForm} layout="inline" onFinish={fetchInboundList}>
          <Form.Item name="reference_no" label="关联单号">
            <Input placeholder="请输入关联单号" allowClear style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="inbound_type" label="入库类型">
            <Select placeholder="全部类型" allowClear style={{ width: 120 }}>
              <Option value="purchase">采购入库</Option>
              <Option value="return">退货入库</Option>
              <Option value="transfer">调拨入库</Option>
              <Option value="other">其他入库</Option>
            </Select>
          </Form.Item>
          <Form.Item name="sku_code" label="SKU编码">
            <Input placeholder="请输入SKU编码" allowClear style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="warehouse_id" label="仓库">
            <Select placeholder="全部仓库" allowClear style={{ width: 140 }}>
              {warehouseList.map(warehouse => (
                <Option key={warehouse.id} value={warehouse.warehouseId}>
                  {warehouse.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select placeholder="全部状态" allowClear style={{ width: 120 }}>
              <Option value="completed">已完成</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} htmlType="submit">
                搜索
              </Button>
              <Button onClick={() => { searchForm.resetFields(); fetchInboundList(); }}>
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {/* 操作按钮 */}
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
            手工入库
          </Button>
          <Button icon={<ImportOutlined />}>
            批量导入
          </Button>
          <Button icon={<ExportOutlined />}>
            导出
          </Button>
        </Space>
      </div>

      {/* 入库单列表 */}
      <Table
        columns={columns}
        dataSource={inboundList}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条记录`,
          onChange: (page, pageSize) => setPagination({ ...pagination, current: page, pageSize })
        }}
        scroll={{ x: 1500 }}
      />

      {/* 新建入库单弹窗 */}
      <Modal
        title="手工入库"
        open={modalVisible}
        onCancel={() => { setModalVisible(false); form.resetFields(); }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="sku_code"
            label="SKU编码"
            rules={[{ required: true, message: '请输入SKU编码' }]}
          >
            <Input placeholder="请输入SKU编码" />
          </Form.Item>
          <Form.Item
            name="warehouse_id"
            label="仓库"
            rules={[{ required: true, message: '请选择仓库' }]}
          >
            <Select placeholder="请选择仓库">
              {warehouseList.map(warehouse => (
                <Option key={warehouse.id} value={warehouse.warehouseId}>
                  {warehouse.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="inbound_type"
            label="入库类型"
            rules={[{ required: true, message: '请选择入库类型' }]}
          >
            <Select placeholder="请选择入库类型">
              <Option value="purchase">采购入库</Option>
              <Option value="return">退货入库</Option>
              <Option value="transfer">调拨入库</Option>
              <Option value="other">其他入库</Option>
            </Select>
          </Form.Item>
          <Form.Item name="related_order_code" label="关联单号">
            <Input placeholder="请输入关联的采购单号或其他单号" />
          </Form.Item>
          <Form.Item
            name="total_quantity"
            label="入库数量"
            rules={[{ required: true, message: '请输入入库数量' }]}
          >
            <InputNumber min={1} placeholder="请输入数量" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <TextArea rows={3} placeholder="请输入备注信息" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 入库单详情弹窗 */}
      <Modal
        title={`入库详情 - ${currentRecord?.inbound_code || ''}`}
        open={detailModalVisible}
        onCancel={() => { setDetailModalVisible(false); setCurrentRecord(null); }}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>关闭</Button>
        ]}
        width={700}
      >
        {currentRecord && (
          <div>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <div style={{ color: '#666' }}>入库单号</div>
                <div style={{ fontWeight: 500 }}>{currentRecord.inbound_code}</div>
              </Col>
              <Col span={12}>
                <div style={{ color: '#666' }}>入库类型</div>
                <div>{getTypeTag(currentRecord.inbound_type)}</div>
              </Col>
              <Col span={12}>
                <div style={{ color: '#666' }}>状态</div>
                <div>{getStatusTag(currentRecord.status)}</div>
              </Col>
              <Col span={12}>
                <div style={{ color: '#666' }}>操作人</div>
                <div style={{ fontWeight: 500 }}>{currentRecord.operator_name || '-'}</div>
              </Col>
              <Col span={12}>
                <div style={{ color: '#666' }}>关联单号</div>
                <div>{currentRecord.related_order_code || '-'}</div>
              </Col>
              <Col span={12}>
                <div style={{ color: '#666' }}>预计入库数量</div>
                <div style={{ fontWeight: 500, fontSize: 16 }}>{currentRecord.total_quantity}</div>
              </Col>
              <Col span={12}>
                <div style={{ color: '#666' }}>已入库数量</div>
                <div style={{ fontWeight: 500, fontSize: 16, color: '#52c41a' }}>{currentRecord.inbound_quantity || 0}</div>
              </Col>
              <Col span={24}>
                <div style={{ color: '#666' }}>备注</div>
                <div>{currentRecord.remark || '-'}</div>
              </Col>
              <Col span={12}>
                <div style={{ color: '#666' }}>创建时间</div>
                <div>{currentRecord.created_at ? dayjs(currentRecord.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}</div>
              </Col>
              <Col span={12}>
                <div style={{ color: '#666' }}>更新时间</div>
                <div>{currentRecord.updated_at ? dayjs(currentRecord.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'}</div>
              </Col>
            </Row>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default ProductInbound;
