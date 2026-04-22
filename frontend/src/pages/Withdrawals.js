import React, { useState, useEffect } from 'react';
import { Table, Tag, Space, Button, Input, DatePicker, message, Card, Statistic, Row, Col } from 'antd';
import { SearchOutlined, ReloadOutlined, DollarOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { withdrawalsAPI } from '../api';

const { RangePicker } = DatePicker;

function Withdrawals() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({ status: '', dateRange: null });
  const [stats, setStats] = useState({ total: 0, totalAmount: 0, successCount: 0, pendingCount: 0 });

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
        status: filters.status
      };
      
      if (filters.dateRange && filters.dateRange[0] && filters.dateRange[1]) {
        const startDate = filters.dateRange[0].toDate();
        const endDate = filters.dateRange[1].toDate();
        params.startDate = startDate.toISOString().split('T')[0];
        params.endDate = endDate.toISOString().split('T')[0];
      }
      
      const response = await withdrawalsAPI.getAll(params);
      
      if (response.data.success) {
        setRecords(response.data.data);
        setPagination(prev => ({
          ...prev,
          total: response.data.total
        }));
      }
    } catch (error) {
      message.error('获取提现记录失败: ' + error.message);
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
      
      const response = await withdrawalsAPI.getStats(params);
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

  const getStatusTag = (status) => {
    const statusMap = {
      '银行受理成功': { color: 'success', icon: <CheckCircleOutlined /> },
      '处理中': { color: 'processing', icon: <ClockCircleOutlined /> },
      '待审核': { color: 'warning', icon: <ClockCircleOutlined /> },
      '失败': { color: 'error', icon: null }
    };
    
    const config = statusMap[status] || { color: 'default', icon: null };
    
    return (
      <Tag color={config.color} icon={config.icon}>
        {status}
      </Tag>
    );
  };

  const columns = [
    {
      title: '序号',
      dataIndex: 'sequence_number',
      key: 'sequence_number',
      width: 80,
      align: 'center'
    },
    {
      title: '资金账户',
      dataIndex: 'account_type',
      key: 'account_type',
      width: 120,
      render: (type) => <Tag color="blue">{type}</Tag>
    },
    {
      title: '创建时间',
      dataIndex: 'created_time',
      key: 'created_time',
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
      title: '提现金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 150,
      align: 'right',
      render: (amount) => {
        const numAmount = parseFloat(amount) || 0;
        return (
          <span style={{ color: '#1890ff', fontWeight: 'bold', fontSize: 16 }}>
            ¥{numAmount.toFixed(2)}
          </span>
        );
      },
      sorter: (a, b) => {
        const amountA = parseFloat(a.amount) || 0;
        const amountB = parseFloat(b.amount) || 0;
        return amountA - amountB;
      }
    },
    {
      title: '提现状态',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status) => getStatusTag(status),
      filters: [
        { text: '银行受理成功', value: '银行受理成功' },
        { text: '处理中', value: '处理中' },
        { text: '待审核', value: '待审核' },
        { text: '失败', value: '失败' }
      ],
      onFilter: (value, record) => record.status === value
    },
    {
      title: '收款账户',
      dataIndex: 'bank_account',
      key: 'bank_account',
      ellipsis: true,
      render: (text) => text || '-'
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 24 }}>💳 提现记录管理</h1>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总记录数"
              value={stats.total || 0}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="提现总额"
              value={parseFloat(stats.totalAmount) || 0}
              precision={2}
              valueStyle={{ color: '#1890ff' }}
              prefix="¥"
              suffix="CNY"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="成功笔数"
              value={stats.successCount || 0}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待处理"
              value={stats.pendingCount || 0}
              valueStyle={{ color: '#faad14' }}
              prefix={<ClockCircleOutlined />}
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
            placeholder={['开始日期', '结束日期']}
          />
          <Input
            placeholder="搜索状态"
            prefix={<SearchOutlined />}
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
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
          summary={(pageData) => {
            let totalAmount = 0;
            pageData.forEach(({ amount }) => {
              // 确保amount是数字类型
              const numAmount = parseFloat(amount) || 0;
              totalAmount += numAmount;
            });
            
            return (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={3}>
                    <strong>当前页合计</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">
                    <strong style={{ color: '#1890ff', fontSize: 16 }}>
                      ¥{totalAmount.toFixed(2)}
                    </strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} colSpan={2} />
                </Table.Summary.Row>
              </Table.Summary>
            );
          }}
        />
      </Card>
    </div>
  );
}

export default Withdrawals;
