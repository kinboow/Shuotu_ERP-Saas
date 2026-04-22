import React, { useState, useEffect } from 'react';
import { 
  Table, Card, Input, Button, Space, Tag, Modal, message, 
  DatePicker, Select, Image, Tooltip, Row, Col, Statistic
} from 'antd';
import { 
  SearchOutlined, ReloadOutlined, PlayCircleOutlined, 
  DeleteOutlined, EyeOutlined, VideoCameraOutlined
} from '@ant-design/icons';

const { RangePicker } = DatePicker;
const { Option } = Select;

// 格式化时间
const formatTime = (timeStr) => {
  if (!timeStr) return '-';
  try {
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) return timeStr;
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Shanghai'
    }).replace(/\//g, '-');
  } catch (e) {
    return timeStr;
  }
};

function PackageVideoList() {
  const [loading, setLoading] = useState(false);
  const [videos, setVideos] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({
    order_no: '',
    sku_code: '',
    status: '',
    date_range: null
  });
  const [stats, setStats] = useState({ total: 0, today: 0, pending: 0 });
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewVideo, setPreviewVideo] = useState(null);

  useEffect(() => {
    fetchVideos();
    fetchStats();
  }, [pagination.current, pagination.pageSize]);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.current,
        limit: pagination.pageSize,
        ...filters
      });
      
      // 过滤空值
      Object.keys(filters).forEach(key => {
        if (!filters[key]) params.delete(key);
      });

      const response = await fetch(`/api/package-videos?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setVideos(data.data || []);
        setPagination(prev => ({ ...prev, total: data.total || 0 }));
      } else {
        message.error(data.message || '获取数据失败');
      }
    } catch (error) {
      message.error('获取包装录像列表失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/package-videos/stats');
      const data = await response.json();
      if (data.success) {
        setStats(data.data || { total: 0, today: 0, pending: 0 });
      }
    } catch (error) {
      console.error('获取统计信息失败:', error);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchVideos();
  };

  const handleReset = () => {
    setFilters({ order_no: '', sku_code: '', status: '', date_range: null });
    setPagination(prev => ({ ...prev, current: 1 }));
    setTimeout(fetchVideos, 0);
  };

  const handlePreview = (record) => {
    setPreviewVideo(record);
    setPreviewVisible(true);
  };

  const handleDelete = (record) => {
    Modal.confirm({
      title: '删除确认',
      content: `确定要删除订单 ${record.order_no} 的包装录像吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await fetch(`/api/package-videos/${record.id}`, {
            method: 'DELETE'
          });
          const data = await response.json();
          if (data.success) {
            message.success('删除成功');
            fetchVideos();
            fetchStats();
          } else {
            message.error(data.message || '删除失败');
          }
        } catch (error) {
          message.error('删除失败: ' + error.message);
        }
      }
    });
  };

  const columns = [
    {
      title: '订单号',
      dataIndex: 'order_no',
      key: 'order_no',
      width: 180,
      render: (text) => <span style={{ fontWeight: 500, color: '#1890ff' }}>{text}</span>
    },
    {
      title: 'SKU',
      dataIndex: 'sku_code',
      key: 'sku_code',
      width: 150
    },
    {
      title: '商品图片',
      dataIndex: 'product_image',
      key: 'product_image',
      width: 80,
      render: (url) => url ? (
        <Image width={50} height={50} src={url} style={{ objectFit: 'cover', borderRadius: 4 }} />
      ) : '-'
    },
    {
      title: '录像时长',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      render: (seconds) => {
        if (!seconds) return '-';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
      }
    },
    {
      title: '文件大小',
      dataIndex: 'file_size',
      key: 'file_size',
      width: 100,
      render: (bytes) => {
        if (!bytes) return '-';
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
      }
    },
    {
      title: '录制设备',
      dataIndex: 'device_name',
      key: 'device_name',
      width: 120
    },
    {
      title: '操作员',
      dataIndex: 'operator_name',
      key: 'operator_name',
      width: 100
    },
    {
      title: '录制时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text) => formatTime(text)
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const statusMap = {
          'pending': { color: 'orange', text: '处理中' },
          'completed': { color: 'green', text: '已完成' },
          'failed': { color: 'red', text: '失败' }
        };
        const config = statusMap[status] || { color: 'default', text: status };
        return <Tag color={config.color}>{config.text}</Tag>;
      }
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Tooltip title="播放">
            <Button 
              type="link" 
              size="small" 
              icon={<PlayCircleOutlined />}
              onClick={() => handlePreview(record)}
              disabled={!record.video_url}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button 
              type="link" 
              size="small" 
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            />
          </Tooltip>
        </Space>
      )
    }
  ];

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card>
            <Statistic 
              title="录像总数" 
              value={stats.total} 
              prefix={<VideoCameraOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic 
              title="今日录制" 
              value={stats.today}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic 
              title="处理中" 
              value={stats.pending}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 搜索区域 */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="订单号"
            value={filters.order_no}
            onChange={e => setFilters({ ...filters, order_no: e.target.value })}
            style={{ width: 180 }}
            allowClear
          />
          <Input
            placeholder="SKU编码"
            value={filters.sku_code}
            onChange={e => setFilters({ ...filters, sku_code: e.target.value })}
            style={{ width: 150 }}
            allowClear
          />
          <Select
            placeholder="状态"
            value={filters.status || undefined}
            onChange={value => setFilters({ ...filters, status: value })}
            style={{ width: 120 }}
            allowClear
          >
            <Option value="pending">处理中</Option>
            <Option value="completed">已完成</Option>
            <Option value="failed">失败</Option>
          </Select>
          <RangePicker
            value={filters.date_range}
            onChange={dates => setFilters({ ...filters, date_range: dates })}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>
      </Card>

      {/* 数据表格 */}
      <Card>
        <Table
          columns={columns}
          dataSource={videos}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
          onChange={(pag) => setPagination(pag)}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* 视频预览弹窗 */}
      <Modal
        title={`包装录像 - ${previewVideo?.order_no || ''}`}
        open={previewVisible}
        onCancel={() => {
          setPreviewVisible(false);
          setPreviewVideo(null);
        }}
        footer={null}
        width={800}
        destroyOnClose
      >
        {previewVideo?.video_url ? (
          <video
            src={previewVideo.video_url}
            controls
            autoPlay
            style={{ width: '100%', maxHeight: '500px' }}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            视频文件不存在或正在处理中
          </div>
        )}
      </Modal>
    </div>
  );
}

export default PackageVideoList;
