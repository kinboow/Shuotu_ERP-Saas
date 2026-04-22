import React, { useState, useEffect } from 'react';
import { Table, Card, Space, Input, Select, DatePicker, Button, Tag, message } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { logsAPI } from '../api';

const { RangePicker } = DatePicker;
const { Option } = Select;

function LoginLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({ username: '', status: '', dateRange: null });

  useEffect(() => {
    fetchLogs();
  }, [pagination.current, pagination.pageSize]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        username: filters.username,
        status: filters.status
      };
      
      if (filters.dateRange && filters.dateRange.length === 2) {
        params.startDate = filters.dateRange[0].format('YYYY-MM-DD');
        params.endDate = filters.dateRange[1].format('YYYY-MM-DD');
      }
      
      const response = await logsAPI.getLoginLogs(params);
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

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchLogs();
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
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 150
    },
    {
      title: '登录方式',
      dataIndex: 'login_type',
      key: 'login_type',
      width: 100,
      render: (type) => {
        const typeMap = {
          password: '密码登录',
          token: 'Token登录',
          sms: '短信登录'
        };
        return typeMap[type] || type;
      }
    },
    {
      title: '设备类型',
      dataIndex: 'device_type',
      key: 'device_type',
      width: 100,
      render: (type) => {
        const typeMap = {
          web: 'Web端',
          mobile: '移动端',
          pda: 'PDA'
        };
        return <Tag>{typeMap[type] || type || '-'}</Tag>;
      }
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 130
    },
    {
      title: '登录地点',
      dataIndex: 'location',
      key: 'location',
      width: 150,
      render: (text) => text || '-'
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
      title: '失败原因',
      dataIndex: 'fail_reason',
      key: 'fail_reason',
      ellipsis: true,
      render: (text) => text || '-'
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card title="登录日志">
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="搜索用户名"
            prefix={<SearchOutlined />}
            value={filters.username}
            onChange={e => setFilters({ ...filters, username: e.target.value })}
            onPressEnter={handleSearch}
            style={{ width: 150 }}
          />
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
          scroll={{ x: 1100 }}
        />
      </Card>
    </div>
  );
}

export default LoginLogs;
