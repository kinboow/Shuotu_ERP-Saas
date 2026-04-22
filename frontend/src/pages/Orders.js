import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Select, Space } from 'antd';
import { ordersAPI } from '../api';

const { Option } = Select;

function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const fetchOrders = async (page = 1) => {
    setLoading(true);
    try {
      const response = await ordersAPI.getAll({ page, limit: 20 });
      setOrders(response.data.data);
      setPagination({ ...pagination, current: page, total: response.data.total });
    } catch (error) {
      console.error('获取订单失败:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const columns = [
    { title: '订单号', dataIndex: 'order_number', key: 'order_number' },
    { title: '平台', dataIndex: 'platform', key: 'platform',
      render: (platform) => <Tag color="blue">{platform.toUpperCase()}</Tag>
    },
    { title: '客户', dataIndex: 'customer_name', key: 'customer_name' },
    { title: '金额', dataIndex: 'total_amount', key: 'total_amount',
      render: (amount) => `$${amount}`
    },
    { title: '状态', dataIndex: 'status', key: 'status',
      render: (status) => {
        const colors = { pending: 'orange', processing: 'blue', shipped: 'green', delivered: 'cyan', cancelled: 'red' };
        return <Tag color={colors[status]}>{status}</Tag>;
      }
    },
    { title: '订单日期', dataIndex: 'order_date', key: 'order_date',
      render: (date) => new Date(date).toLocaleDateString('zh-CN')
    }
  ];

  return (
    <div>
      <h1>订单管理</h1>
      <Table
        columns={columns}
        dataSource={orders}
        loading={loading}
        rowKey="id"
        pagination={pagination}
        onChange={(newPagination) => fetchOrders(newPagination.current)}
      />
    </div>
  );
}

export default Orders;
