import React, { useState, useEffect } from 'react';
import { Table, Tag, Space, Button, Input, DatePicker, message, Card, Statistic, Row, Col } from 'antd';
import { SearchOutlined, ReloadOutlined, DollarOutlined, RiseOutlined, FallOutlined } from '@ant-design/icons';
import { financeRecordsAPI } from '../api';

const { RangePicker } = DatePicker;

function FinanceRecords() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({ type: '', dateRange: null });
  const [stats, setStats] = useState({ total: 0, income: 0, expense: 0, balance: 0 });

  useEffect(() => {
    fetchRecords();
    fetchStats();
  }, [pagination.current, pagination.pageSize]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        type: filters.type
      };
      
      if (filters.dateRange && filters.dateRange[0] && filters.dateRange[1]) {
        const startDate = filters.dateRange[0].toDate();
        const endDate = filters.dateRange[1].toDate();
        params.startDate = startDate.toISOString().split('T')[0];
        params.endDate = endDate.toISOString().split('T')[0];
      }
      
      const response = await financeRecordsAPI.getAll(params);
      
      if (response.data.success) {
        setRecords(response.data.data);
        setPagination(prev => ({
          ...prev,
          total: response.data.total
        }));
      }
    } catch (error) {
      message.error('获取资金流水失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const params = {};
      if (filters.dateRange && filters.dateRange[0] && filters.dateRange[1]) {
        const startDate = filters.dateRange[0].toDate();
        const endDate = filters.dateRange[1].toDate();
        params.startDate = startDate.toISOString().split('T')[0];
        params.endDate = endDate.toISOString().split('T')[0];
      }
      
      const response = await financeRecordsAPI.getStats(params);
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('获取统计信息失败:', error);
    }
  };

  const handleTableChange = (newPagination) => {
    setPagination(newPagination);
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchRecords();
    fetchStats();
  };

  const columns = [
    {
      title: '账务时间',
      dataIndex: 'transaction_time',
      key: 'transaction_time',
      width: 180,
      render: (time) => {
        if (!time) return '-';
        const date = new Date(time);
        return date.toLocaleString('zh-CN', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
      }
    },
    {
      title: '账务类型',
      dataIndex: 'transaction_type',
      key: 'transaction_type',
      width: 120,
      render: (type) => <Tag color="blue">{type}</Tag>
    },
    {
      title: '收支金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 150,
      align: 'right',
      render: (amount, record) => {
        const isIncome = record.is_income;
        const color = isIncome ? '#52c41a' : '#ff4d4f';
        const prefix = isIncome ? '+' : '';
        return (
          <span style={{ color, fontWeight: 'bold', fontSize: 16 }}>
            {prefix}¥{Math.abs(amount).toFixed(2)}
          </span>
        );
      }
    },
    {
      title: '币种',
      dataIndex: 'currency',
      key: 'currency',
      width: 80
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      key: 'remarks',
      ellipsis: true,
      render: (text) => text || '-'
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 24 }}>💰 资金流水管理</h1>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总记录数"
              value={stats.total}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总收入"
              value={stats.income}
              precision={2}
              valueStyle={{ color: '#52c41a' }}
              prefix={<RiseOutlined />}
              suffix="CNY"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总支出"
              value={stats.expense}
              precision={2}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<FallOutlined />}
              suffix="CNY"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="净收益"
              value={stats.balance}
              precision={2}
              valueStyle={{ color: stats.balance >= 0 ? '#52c41a' : '#ff4d4f' }}
              prefix={<DollarOutlined />}
              suffix="CNY"
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space size="middle">
          <RangePicker
            value={filters.dateRange}
            onChange={(dates) => setFilters({ ...filters, dateRange: dates })}
            style={{ width: 300 }}
          />
          <Input
            placeholder="搜索账务类型"
            prefix={<SearchOutlined />}
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            onPressEnter={handleSearch}
            style={{ width: 200 }}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchRecords}>
            刷新
          </Button>
        </Space>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={records}
          rowKey="id"
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
        />
      </Card>
    </div>
  );
}

export default FinanceRecords;
