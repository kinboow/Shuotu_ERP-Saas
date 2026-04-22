import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  message,
  Modal,
  Input,
  Select,
  Image,
  DatePicker,
  Descriptions,
  Empty,
  Tooltip
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ExportOutlined
} from '@ant-design/icons';

const { Search } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;

function PublishRecords() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({
    keyword: '',
    platform: '',
    status: '', // 'success', 'failed', 'pending'
    startDate: null,
    endDate: null
  });
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  useEffect(() => {
    fetchRecords();
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      // TODO: 实现API调用
      // 模拟数据
      const mockData = [
        {
          id: 1,
          productName: '夏季连衣裙',
          platform: 'shein',
          platformProductId: 'SHEIN123456',
          mainImage: 'https://via.placeholder.com/100',
          price: 99.99,
          stock: 100,
          status: 'success',
          publishType: 'platform',
          publishedAt: '2024-01-15 10:30:00',
          publishedBy: '管理员',
          errorMessage: null
        },
        {
          id: 2,
          productName: '男士T恤',
          platform: 'temu',
          platformProductId: null,
          mainImage: 'https://via.placeholder.com/100',
          price: 59.99,
          stock: 200,
          status: 'failed',
          publishType: 'erp',
          publishedAt: '2024-01-14 09:15:00',
          publishedBy: '管理员',
          errorMessage: '分类ID无效'
        },
        {
          id: 3,
          productName: '运动鞋',
          platform: 'tiktok',
          platformProductId: 'TT789012',
          mainImage: 'https://via.placeholder.com/100',
          price: 299.99,
          stock: 50,
          status: 'success',
          publishType: 'platform',
          publishedAt: '2024-01-13 14:20:00',
          publishedBy: '管理员',
          errorMessage: null
        },
        {
          id: 4,
          productName: '手提包',
          platform: 'shein',
          platformProductId: null,
          mainImage: 'https://via.placeholder.com/100',
          price: 159.99,
          stock: 80,
          status: 'pending',
          publishType: 'erp',
          publishedAt: '2024-01-12 16:45:00',
          publishedBy: '管理员',
          errorMessage: null
        }
      ];

      setRecords(mockData);
      setPagination(prev => ({ ...prev, total: mockData.length }));
    } catch (error) {
      message.error('获取发布记录失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = (record) => {
    setSelectedRecord(record);
    setDetailVisible(true);
  };

  const handleExport = () => {
    message.info('导出功能开发中...');
  };

  const handleRetry = async (record) => {
    Modal.confirm({
      title: '重新发布',
      content: `确定要重新发布"${record.productName}"吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          // TODO: 实现重新发布API
          message.success('已提交重新发布请求');
          fetchRecords();
        } catch (error) {
          message.error('重新发布失败: ' + error.message);
        }
      }
    });
  };

  const getStatusConfig = (status) => {
    const configs = {
      success: {
        color: 'success',
        icon: <CheckCircleOutlined />,
        text: '发布成功'
      },
      failed: {
        color: 'error',
        icon: <CloseCircleOutlined />,
        text: '发布失败'
      },
      pending: {
        color: 'processing',
        icon: <SyncOutlined spin />,
        text: '发布中'
      }
    };
    return configs[status] || configs.pending;
  };

  const getPlatformConfig = (platform) => {
    const configs = {
      shein: { color: 'purple', text: 'SHEIN' },
      temu: { color: 'orange', text: 'TEMU' },
      tiktok: { color: 'cyan', text: 'TikTok' }
    };
    return configs[platform] || { color: 'default', text: platform };
  };

  const columns = [
    {
      title: '商品信息',
      key: 'product',
      width: 300,
      fixed: 'left',
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 12 }}>
          {record.mainImage ? (
            <Image
              width={60}
              height={60}
              src={record.mainImage}
              style={{ objectFit: 'cover', borderRadius: 4 }}
            />
          ) : (
            <div style={{
              width: 60,
              height: 60,
              backgroundColor: '#e8e8e8',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#999',
              fontSize: 12
            }}>
              无图
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>{record.productName}</div>
            {record.platformProductId && (
              <div style={{ fontSize: 12, color: '#666' }}>
                平台ID: {record.platformProductId}
              </div>
            )}
          </div>
        </div>
      )
    },
    {
      title: '发布平台',
      dataIndex: 'platform',
      key: 'platform',
      width: 120,
      render: (platform) => {
        const { color, text } = getPlatformConfig(platform);
        return <Tag color={color}>{text}</Tag>;
      }
    },
    {
      title: '发布类型',
      dataIndex: 'publishType',
      key: 'publishType',
      width: 120,
      render: (type) => (
        <Tag color={type === 'platform' ? 'blue' : 'green'}>
          {type === 'platform' ? '按平台' : 'ERP产品'}
        </Tag>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => {
        const { color, icon, text } = getStatusConfig(status);
        return (
          <Tag color={color} icon={icon}>
            {text}
          </Tag>
        );
      }
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      width: 100,
      align: 'right',
      render: (price) => `¥${price?.toFixed(2) || '0.00'}`
    },
    {
      title: '库存',
      dataIndex: 'stock',
      key: 'stock',
      width: 80,
      align: 'right'
    },
    {
      title: '发布时间',
      dataIndex: 'publishedAt',
      key: 'publishedAt',
      width: 160
    },
    {
      title: '发布人',
      dataIndex: 'publishedBy',
      key: 'publishedBy',
      width: 100
    },
    {
      title: '错误信息',
      dataIndex: 'errorMessage',
      key: 'errorMessage',
      width: 150,
      render: (error) => error ? (
        <Tooltip title={error}>
          <span style={{ color: '#ff4d4f', cursor: 'pointer' }}>
            {error.length > 20 ? error.substring(0, 20) + '...' : error}
          </span>
        </Tooltip>
      ) : '-'
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          {record.status === 'failed' && (
            <Button
              type="link"
              size="small"
              icon={<SyncOutlined />}
              onClick={() => handleRetry(record)}
            >
              重试
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        {/* 筛选栏 */}
        <div style={{ marginBottom: 16 }}>
          <Space size="middle" wrap>
            <Search
              placeholder="搜索商品名称或平台ID"
              value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
              onSearch={fetchRecords}
              style={{ width: 250 }}
              allowClear
            />
            <Select
              placeholder="发布平台"
              value={filters.platform || undefined}
              onChange={(value) => setFilters({ ...filters, platform: value })}
              style={{ width: 120 }}
              allowClear
            >
              <Option value="">全部平台</Option>
              <Option value="shein">SHEIN</Option>
              <Option value="temu">TEMU</Option>
              <Option value="tiktok">TikTok</Option>
            </Select>
            <Select
              placeholder="发布状态"
              value={filters.status || undefined}
              onChange={(value) => setFilters({ ...filters, status: value })}
              style={{ width: 120 }}
              allowClear
            >
              <Option value="">全部状态</Option>
              <Option value="success">发布成功</Option>
              <Option value="failed">发布失败</Option>
              <Option value="pending">发布中</Option>
            </Select>
            <RangePicker
              placeholder={['开始日期', '结束日期']}
              onChange={(dates) => {
                if (dates) {
                  setFilters({
                    ...filters,
                    startDate: dates[0]?.format('YYYY-MM-DD'),
                    endDate: dates[1]?.format('YYYY-MM-DD')
                  });
                } else {
                  setFilters({
                    ...filters,
                    startDate: null,
                    endDate: null
                  });
                }
              }}
              style={{ width: 280 }}
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={fetchRecords}
            >
              搜索
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchRecords}
            >
              刷新
            </Button>
            <Button
              icon={<ExportOutlined />}
              onClick={handleExport}
            >
              导出
            </Button>
          </Space>
        </div>

        {/* 统计信息 */}
        <div style={{
          marginBottom: 16,
          padding: '12px 16px',
          backgroundColor: '#f5f5f5',
          borderRadius: 4,
          display: 'flex',
          gap: 24
        }}>
          <div>
            <span style={{ color: '#666' }}>总记录数：</span>
            <span style={{ fontWeight: 500 }}>{pagination.total}</span>
          </div>
          <div>
            <span style={{ color: '#666' }}>成功：</span>
            <span style={{ fontWeight: 500, color: '#52c41a' }}>
              {records.filter(r => r.status === 'success').length}
            </span>
          </div>
          <div>
            <span style={{ color: '#666' }}>失败：</span>
            <span style={{ fontWeight: 500, color: '#ff4d4f' }}>
              {records.filter(r => r.status === 'failed').length}
            </span>
          </div>
          <div>
            <span style={{ color: '#666' }}>进行中：</span>
            <span style={{ fontWeight: 500, color: '#1890ff' }}>
              {records.filter(r => r.status === 'pending').length}
            </span>
          </div>
        </div>

        {/* 表格 */}
        <Table
          columns={columns}
          dataSource={records}
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
          locale={{
            emptyText: (
              <Empty
                description="暂无发布记录"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )
          }}
        />
      </Card>

      {/* 详情模态框 */}
      <Modal
        title="发布记录详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
          selectedRecord?.status === 'failed' && (
            <Button
              key="retry"
              type="primary"
              icon={<SyncOutlined />}
              onClick={() => {
                setDetailVisible(false);
                handleRetry(selectedRecord);
              }}
            >
              重新发布
            </Button>
          )
        ]}
        width={800}
      >
        {selectedRecord && (
          <div>
            <div style={{ marginBottom: 16, textAlign: 'center' }}>
              {selectedRecord.mainImage && (
                <Image
                  src={selectedRecord.mainImage}
                  style={{ maxWidth: '100%', maxHeight: 300 }}
                />
              )}
            </div>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="商品名称" span={2}>
                {selectedRecord.productName}
              </Descriptions.Item>
              <Descriptions.Item label="发布平台">
                {(() => {
                  const { color, text } = getPlatformConfig(selectedRecord.platform);
                  return <Tag color={color}>{text}</Tag>;
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="发布类型">
                <Tag color={selectedRecord.publishType === 'platform' ? 'blue' : 'green'}>
                  {selectedRecord.publishType === 'platform' ? '按平台刊登' : 'ERP产品刊登'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="发布状态">
                {(() => {
                  const { color, icon, text } = getStatusConfig(selectedRecord.status);
                  return <Tag color={color} icon={icon}>{text}</Tag>;
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="平台商品ID">
                {selectedRecord.platformProductId || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="价格">
                ¥{selectedRecord.price?.toFixed(2) || '0.00'}
              </Descriptions.Item>
              <Descriptions.Item label="库存">
                {selectedRecord.stock || 0}
              </Descriptions.Item>
              <Descriptions.Item label="发布时间">
                {selectedRecord.publishedAt}
              </Descriptions.Item>
              <Descriptions.Item label="发布人">
                {selectedRecord.publishedBy}
              </Descriptions.Item>
              {selectedRecord.errorMessage && (
                <Descriptions.Item label="错误信息" span={2}>
                  <span style={{ color: '#ff4d4f' }}>{selectedRecord.errorMessage}</span>
                </Descriptions.Item>
              )}
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default PublishRecords;
