import React, { useState, useEffect } from 'react';
import { 
  Table, Tag, Space, Button, Input, message, Card, DatePicker, Image, Modal, Descriptions
} from 'antd';
import { 
  SearchOutlined, ReloadOutlined, EyeOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

// 格式化日期时间
const formatDateTime = (dateStr) => {
  if (!dateStr) return '-';
  if (dateStr.includes('T') && dateStr.includes('Z')) {
    return dateStr.replace('T', ' ').replace('.000Z', '');
  }
  return dateStr;
};

function ReviewOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({ 
    skc: '', 
    supplierCode: '', 
    orderNo: '',
    startTime: undefined,
    endTime: undefined
  });
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, [pagination.current, pagination.pageSize]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const requestBody = {
        shopId: 1,
        pageNum: pagination.current,
        pageSize: pagination.pageSize
      };

      // 添加筛选条件
      if (filters.skc) {
        requestBody.skcList = [filters.skc];
      }
      if (filters.supplierCode) {
        requestBody.supplierCodeList = [filters.supplierCode];
      }
      if (filters.orderNo) {
        requestBody.orderNoList = [filters.orderNo];
      }
      if (filters.startTime) {
        requestBody.addTimeBegin = filters.startTime;
      }
      if (filters.endTime) {
        requestBody.addTimeEnd = filters.endTime;
      }

      const response = await fetch('/api/review-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (data.success) {
        setOrders(data.data);
        setPagination(prev => ({
          ...prev,
          total: data.total
        }));
      } else {
        message.error(data.message || '获取数据失败');
      }
    } catch (error) {
      message.error('获取数据失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchOrders();
  };

  const handleViewDetail = (record) => {
    setSelectedOrder(record);
    setDetailVisible(true);
  };

  const handleOrderNoClick = (record) => {
    // 根据备货类型判断是急采还是备货
    // stockType 可能的值：急采、备货等
    let orderType = '备货'; // 默认备货
    
    if (record.stockType && record.stockType.includes('急采')) {
      orderType = '急采';
    }
    
    // 跳转到采购单列表页面，并传递查询参数
    navigate('/new-orders', {
      state: {
        orderType: orderType,
        orderNumber: record.orderNo
      }
    });
  };

  const handleTableChange = (newPagination) => {
    setPagination({
      ...pagination,
      current: newPagination.current,
      pageSize: newPagination.pageSize
    });
  };

  const columns = [
    {
      title: '商品信息',
      key: 'product',
      width: 300,
      fixed: 'left',
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 10 }}>
          {record.imgPath && (
            <Image
              width={60}
              height={60}
              src={record.imgPath}
              style={{ objectFit: 'cover', borderRadius: 4 }}
            />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: '#666' }}>SKC: </span>
              <span style={{ fontSize: 12 }}>{record.skc}</span>
            </div>
            <div style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: '#666' }}>供方货号: </span>
              <span style={{ fontSize: 12 }}>{record.supplierCode || '-'}</span>
            </div>
            <div>
              <span style={{ fontSize: 12, color: '#666' }}>SKU数: </span>
              <span style={{ fontSize: 12, fontWeight: 'bold' }}>
                {record.skuList?.length || 0}
              </span>
            </div>
          </div>
        </div>
      )
    },
    {
      title: '备货单号',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 180,
      render: (text, record) => (
        text ? (
          <a 
            style={{ color: '#1890ff', fontWeight: 500, cursor: 'pointer' }}
            onClick={() => handleOrderNoClick(record)}
          >
            {text}
          </a>
        ) : '-'
      )
    },
    {
      title: '申请状态',
      dataIndex: 'applyStatus',
      key: 'applyStatus',
      width: 120,
      render: (status) => {
        const statusConfig = {
          '待审核': { color: 'orange' },
          '审核通过': { color: 'success' },
          '审核拒绝': { color: 'error' },
          '已取消': { color: 'default' }
        };
        const config = statusConfig[status] || { color: 'default' };
        return <Tag color={config.color}>{status || '-'}</Tag>;
      }
    },
    {
      title: '备货类型',
      dataIndex: 'stockType',
      key: 'stockType',
      width: 120,
      render: (text) => text || '-'
    },
    {
      title: '下单方式',
      dataIndex: 'orderMode',
      key: 'orderMode',
      width: 120,
      render: (text) => text || '-'
    },
    {
      title: '下单标识',
      dataIndex: 'orderSign',
      key: 'orderSign',
      width: 120,
      render: (text) => text || '-'
    },
    {
      title: '下单账号',
      dataIndex: 'orderAccount',
      key: 'orderAccount',
      width: 150,
      render: (text) => text || '-'
    },
    {
      title: '审核说明',
      dataIndex: 'applyNotes',
      key: 'applyNotes',
      width: 200,
      ellipsis: true,
      render: (text) => text || '-'
    },
    {
      title: '下单时间',
      dataIndex: 'addTime',
      key: 'addTime',
      width: 160,
      render: (time) => formatDateTime(time)
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button 
          type="link" 
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record)}
        >
          查看明细
        </Button>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 24 }}>备货审核列表</h1>

      {/* 筛选模块 */}
      <Card style={{ marginBottom: 16 }}>
        <Space size="middle" wrap>
          <Input
            placeholder="SKC编码"
            prefix={<SearchOutlined />}
            value={filters.skc}
            onChange={(e) => setFilters({ ...filters, skc: e.target.value })}
            onPressEnter={handleSearch}
            style={{ width: 200 }}
            allowClear
          />
          <Input
            placeholder="供方货号"
            value={filters.supplierCode}
            onChange={(e) => setFilters({ ...filters, supplierCode: e.target.value })}
            onPressEnter={handleSearch}
            style={{ width: 150 }}
            allowClear
          />
          <Input
            placeholder="备货单号"
            value={filters.orderNo}
            onChange={(e) => setFilters({ ...filters, orderNo: e.target.value })}
            onPressEnter={handleSearch}
            style={{ width: 180 }}
            allowClear
          />
          <RangePicker
            placeholder={['开始时间', '结束时间']}
            style={{ width: 280 }}
            onChange={(dates) => {
              if (dates) {
                setFilters({
                  ...filters,
                  startTime: dates[0]?.format('YYYY-MM-DD HH:mm:ss'),
                  endTime: dates[1]?.format('YYYY-MM-DD HH:mm:ss')
                });
              } else {
                setFilters({
                  ...filters,
                  startTime: undefined,
                  endTime: undefined
                });
              }
            }}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchOrders}>
            刷新
          </Button>
        </Space>
      </Card>

      {/* 列表表格 */}
      <Card>
        <Table
          columns={columns}
          dataSource={orders}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            pageSizeOptions: ['10', '20', '50', '100']
          }}
          onChange={handleTableChange}
          scroll={{ x: 1600 }}
          size="middle"
        />
      </Card>

      {/* 详情弹窗 */}
      <Modal
        title={`备货单详情 - ${selectedOrder?.orderNo || ''}`}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>
        ]}
        width={900}
      >
        {selectedOrder && (
          <div>
            {/* 基本信息 */}
            <Card size="small" title="基本信息" style={{ marginBottom: 16 }}>
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="备货单号">{selectedOrder.orderNo || '-'}</Descriptions.Item>
                <Descriptions.Item label="申请状态">
                  <Tag color={
                    selectedOrder.applyStatus === '审核通过' ? 'success' :
                    selectedOrder.applyStatus === '审核拒绝' ? 'error' :
                    selectedOrder.applyStatus === '待审核' ? 'orange' : 'default'
                  }>
                    {selectedOrder.applyStatus || '-'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="SKC">{selectedOrder.skc}</Descriptions.Item>
                <Descriptions.Item label="供方货号">{selectedOrder.supplierCode || '-'}</Descriptions.Item>
                <Descriptions.Item label="备货类型">{selectedOrder.stockType || '-'}</Descriptions.Item>
                <Descriptions.Item label="下单方式">{selectedOrder.orderMode || '-'}</Descriptions.Item>
                <Descriptions.Item label="下单标识">{selectedOrder.orderSign || '-'}</Descriptions.Item>
                <Descriptions.Item label="下单账号">{selectedOrder.orderAccount || '-'}</Descriptions.Item>
                <Descriptions.Item label="下单时间" span={2}>
                  {formatDateTime(selectedOrder.addTime)}
                </Descriptions.Item>
                <Descriptions.Item label="审核说明" span={2}>
                  {selectedOrder.applyNotes || '-'}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* SKU明细 */}
            <Card size="small" title={`SKU明细 (共 ${selectedOrder.skuList?.length || 0} 个)`}>
              <Table
                size="small"
                dataSource={selectedOrder.skuList || []}
                rowKey="skuCode"
                pagination={false}
                columns={[
                  {
                    title: '序号',
                    key: 'index',
                    width: 60,
                    render: (_, __, index) => index + 1
                  },
                  {
                    title: 'SKU编码',
                    dataIndex: 'skuCode',
                    key: 'skuCode',
                    width: 150
                  },
                  {
                    title: '属性',
                    dataIndex: 'suffixZh',
                    key: 'suffixZh',
                    width: 200
                  },
                  {
                    title: '建议下单数量',
                    dataIndex: 'adviceCount',
                    key: 'adviceCount',
                    width: 120,
                    align: 'center',
                    render: (count) => <span style={{ color: '#999' }}>{count || 0}</span>
                  },
                  {
                    title: '实际下单数量',
                    dataIndex: 'orderCount',
                    key: 'orderCount',
                    width: 120,
                    align: 'center',
                    render: (count) => (
                      <span style={{ fontWeight: 'bold', color: '#52c41a' }}>
                        {count || 0}
                      </span>
                    )
                  }
                ]}
              />
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default ReviewOrders;
