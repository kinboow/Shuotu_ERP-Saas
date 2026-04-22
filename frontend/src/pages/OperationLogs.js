import React, { useState, useEffect } from 'react';
import { Table, Card, Space, Input, Select, DatePicker, Button, Tag, Modal, Descriptions, message } from 'antd';
import { SearchOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import { logsAPI } from '../api';

const { RangePicker } = DatePicker;
const { Option } = Select;

function OperationLogs() {
  const [logs, setLogs] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({ module: '', status: '', dateRange: null });
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    fetchLogs();
    fetchModules();
  }, [pagination.current, pagination.pageSize]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        module: filters.module,
        status: filters.status
      };
      
      if (filters.dateRange && filters.dateRange.length === 2) {
        params.startDate = filters.dateRange[0].format('YYYY-MM-DD');
        params.endDate = filters.dateRange[1].format('YYYY-MM-DD');
      }
      
      const response = await logsAPI.getOperationLogs(params);
      if (response.data.success) {
        setLogs(response.data.data);
        setPagination(prev => ({ ...prev, total: response.data.total }));
      }
    } catch (error) {
      message.error('获取日志失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchModules = async () => {
    try {
      const response = await logsAPI.getModules();
      if (response.data.success) {
        setModules(response.data.data);
      }
    } catch (error) {
      console.error('获取模块列表失败:', error);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchLogs();
  };

  const handleViewDetail = async (record) => {
    try {
      const response = await logsAPI.getOperationDetail(record.id);
      if (response.data.success) {
        setSelectedLog(response.data.data);
        setDetailVisible(true);
      }
    } catch (error) {
      message.error('获取详情失败');
    }
  };

  const moduleNames = {
    auth: '认证',
    system: '系统管理',
    product: '商品管理',
    order: '订单管理',
    purchase: '采购管理',
    inventory: '库存管理',
    finance: '财务管理',
    platform: '平台管理'
  };

  const columns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text) => text?.replace('T', ' ').substring(0, 19)
    },
    {
      title: '用户',
      key: 'user',
      width: 150,
      render: (_, record) => (
        <div>
          <div>{record.username}</div>
          {record.real_name && <div style={{ fontSize: 12, color: '#999' }}>{record.real_name}</div>}
        </div>
      )
    },
    {
      title: '模块',
      dataIndex: 'module',
      key: 'module',
      width: 100,
      render: (text) => <Tag>{moduleNames[text] || text}</Tag>
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 100
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 130
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status) => (
        <Tag color={status === 'SUCCESS' ? 'green' : 'red'}>{status === 'SUCCESS' ? '成功' : '失败'}</Tag>
      )
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      width: 80,
      render: (ms) => ms ? `${ms}ms` : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
          详情
        </Button>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card title="操作日志">
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            placeholder="选择模块"
            value={filters.module || undefined}
            onChange={v => setFilters({ ...filters, module: v })}
            style={{ width: 150 }}
            allowClear
          >
            {modules.map(m => <Option key={m.value} value={m.value}>{m.label}</Option>)}
          </Select>
          <Select
            placeholder="状态"
            value={filters.status || undefined}
            onChange={v => setFilters({ ...filters, status: v })}
            style={{ width: 100 }}
            allowClear
          >
            <Option value="SUCCESS">成功</Option>
            <Option value="FAILED">失败</Option>
          </Select>
          <RangePicker
            value={filters.dateRange}
            onChange={v => setFilters({ ...filters, dateRange: v })}
          />
          <Button icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
          <Button icon={<ReloadOutlined />} onClick={fetchLogs}>刷新</Button>
        </Space>

        <Table
          columns={columns}
          dataSource={logs}
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

      {/* 详情弹窗 */}
      <Modal
        title="日志详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={700}
      >
        {selectedLog && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="时间">{selectedLog.created_at?.replace('T', ' ').substring(0, 19)}</Descriptions.Item>
            <Descriptions.Item label="用户">{selectedLog.username} {selectedLog.real_name && `(${selectedLog.real_name})`}</Descriptions.Item>
            <Descriptions.Item label="模块">{moduleNames[selectedLog.module] || selectedLog.module}</Descriptions.Item>
            <Descriptions.Item label="操作">{selectedLog.action}</Descriptions.Item>
            <Descriptions.Item label="目标类型">{selectedLog.target_type || '-'}</Descriptions.Item>
            <Descriptions.Item label="目标ID">{selectedLog.target_id || '-'}</Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>{selectedLog.description || '-'}</Descriptions.Item>
            <Descriptions.Item label="请求方法">{selectedLog.request_method || '-'}</Descriptions.Item>
            <Descriptions.Item label="请求URL">{selectedLog.request_url || '-'}</Descriptions.Item>
            <Descriptions.Item label="IP地址">{selectedLog.ip_address || '-'}</Descriptions.Item>
            <Descriptions.Item label="耗时">{selectedLog.duration ? `${selectedLog.duration}ms` : '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={selectedLog.status === 'SUCCESS' ? 'green' : 'red'}>
                {selectedLog.status === 'SUCCESS' ? '成功' : '失败'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="错误信息">{selectedLog.error_message || '-'}</Descriptions.Item>
            {selectedLog.request_params && (
              <Descriptions.Item label="请求参数" span={2}>
                <pre style={{ maxHeight: 200, overflow: 'auto', margin: 0 }}>
                  {JSON.stringify(selectedLog.request_params, null, 2)}
                </pre>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}

export default OperationLogs;
