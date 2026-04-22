import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Select, message, Tag, Modal, Form, Input, InputNumber, DatePicker, Card, Statistic, Row, Col, Upload, Tooltip } from 'antd';
import { PlusOutlined, ImportOutlined, ExportOutlined, SearchOutlined, InboxOutlined, UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

function ProductInbound() {
  const [loading, setLoading] = useState(false);
  const [inboundList, setInboundList] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [form] = Form.useForm();
  const [searchForm] = Form.useForm();
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalQuantity: 0
  });

  // 获取入库单列表
  useEffect(() => {
    fetchInboundList();
  }, [pagination.current, pagination.pageSize]);

  const fetchInboundList = async () => {
    setLoading(true);
    try {
      const searchValues = searchForm.getFieldsValue();
      const params = new URLSearchParams({
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...searchValues
      });
      
      const response = await fetch(`/api/wms/inbound?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setInboundList(data.data?.list || []);
        setPagination(prev => ({ ...prev, total: data.data?.total || 0 }));
        setStats(data.data?.stats || {
          totalOrders: 0,
          pendingOrders: 0,
          completedOrders: 0,
          totalQuantity: 0
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
      const response = await fetch('/api/wms/inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          expected_date: values.expected_date?.format('YYYY-MM-DD')
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        message.success('创建入库单成功');
        setModalVisible(false);
        form.resetFields();
        fetchInboundList();
      } else {
        message.error(data.message || '创建失败');
      }
    } catch (error) {
      console.error('创建入库单失败:', error);
      message.error('创建失败: ' + error.message);
    }
  };


  // 确认入库
  const handleConfirmInbound = async (record) => {
    Modal.confirm({
      title: '确认入库',
      content: `确定要将入库单 ${record.inbound_code} 标记为已入库吗？`,
      onOk: async () => {
        try {
          const response = await fetch(`/api/wms/inbound/${record.id}/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          
          const data = await response.json();
          
          if (data.success) {
            message.success('入库确认成功');
            fetchInboundList();
          } else {
            message.error(data.message || '操作失败');
          }
        } catch (error) {
          message.error('操作失败: ' + error.message);
        }
      }
    });
  };

  // 取消入库单
  const handleCancel = async (record) => {
    Modal.confirm({
      title: '取消入库单',
      content: `确定要取消入库单 ${record.inbound_code} 吗？`,
      onOk: async () => {
        try {
          const response = await fetch(`/api/wms/inbound/${record.id}/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          
          const data = await response.json();
          
          if (data.success) {
            message.success('入库单已取消');
            fetchInboundList();
          } else {
            message.error(data.message || '操作失败');
          }
        } catch (error) {
          message.error('操作失败: ' + error.message);
        }
      }
    });
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
      title: '供应商',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
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
      title: '预计到货日期',
      dataIndex: 'expected_date',
      key: 'expected_date',
      width: 120,
      render: (date) => date ? dayjs(date).format('YYYY-MM-DD') : '-'
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
          {record.status === 'pending' && (
            <>
              <Button type="link" size="small" onClick={() => handleConfirmInbound(record)}>
                确认入库
              </Button>
              <Button type="link" size="small" danger onClick={() => handleCancel(record)}>
                取消
              </Button>
            </>
          )}
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
              title="入库单总数"
              value={stats.totalOrders}
              prefix={<InboxOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待入库"
              value={stats.pendingOrders}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已完成"
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
          <Form.Item name="inbound_code" label="入库单号">
            <Input placeholder="请输入入库单号" allowClear style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="inbound_type" label="入库类型">
            <Select placeholder="全部类型" allowClear style={{ width: 120 }}>
              <Option value="purchase">采购入库</Option>
              <Option value="return">退货入库</Option>
              <Option value="transfer">调拨入库</Option>
              <Option value="other">其他入库</Option>
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select placeholder="全部状态" allowClear style={{ width: 120 }}>
              <Option value="pending">待入库</Option>
              <Option value="partial">部分入库</Option>
              <Option value="completed">已完成</Option>
              <Option value="cancelled">已取消</Option>
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
            新建入库单
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
        title="新建入库单"
        open={modalVisible}
        onCancel={() => { setModalVisible(false); form.resetFields(); }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
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
          <Form.Item name="supplier_name" label="供应商">
            <Input placeholder="请输入供应商名称" />
          </Form.Item>
          <Form.Item
            name="total_quantity"
            label="预计入库数量"
            rules={[{ required: true, message: '请输入预计入库数量' }]}
          >
            <InputNumber min={1} placeholder="请输入数量" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="expected_date" label="预计到货日期">
            <DatePicker style={{ width: '100%' }} placeholder="请选择预计到货日期" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <TextArea rows={3} placeholder="请输入备注信息" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 入库单详情弹窗 */}
      <Modal
        title={`入库单详情 - ${currentRecord?.inbound_code || ''}`}
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
                <div style={{ color: '#666' }}>供应商</div>
                <div style={{ fontWeight: 500 }}>{currentRecord.supplier_name || '-'}</div>
              </Col>
              <Col span={12}>
                <div style={{ color: '#666' }}>关联单号</div>
                <div>{currentRecord.related_order_code || '-'}</div>
              </Col>
              <Col span={12}>
                <div style={{ color: '#666' }}>预计到货日期</div>
                <div>{currentRecord.expected_date ? dayjs(currentRecord.expected_date).format('YYYY-MM-DD') : '-'}</div>
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
