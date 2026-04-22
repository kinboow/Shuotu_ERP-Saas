import React, { useState } from 'react';
import { NavBar, SearchBar, List, Tag, Card, Empty, InfiniteScroll, PullToRefresh } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';

const OrderQuery = () => {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const searchOrders = async (searchKeyword) => {
    if (!searchKeyword.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/pda/orders?keyword=${encodeURIComponent(searchKeyword)}`);
      const data = await response.json();
      if (data.success) {
        setOrders(data.data || []);
        setHasMore(data.hasMore || false);
      }
    } catch (error) {
      // 模拟数据
      setOrders([
        { id: 1, orderNo: 'ORD202411001', status: 'pending', productName: '测试商品A', quantity: 2, createTime: '2024-11-28 10:00' },
        { id: 2, orderNo: 'ORD202411002', status: 'shipped', productName: '测试商品B', quantity: 1, createTime: '2024-11-28 09:30' },
        { id: 3, orderNo: 'ORD202411003', status: 'completed', productName: '测试商品C', quantity: 3, createTime: '2024-11-27 15:00' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusTag = (status) => {
    const statusMap = {
      pending: { text: '待发货', color: 'warning' },
      shipped: { text: '已发货', color: 'primary' },
      completed: { text: '已完成', color: 'success' },
      cancelled: { text: '已取消', color: 'default' },
    };
    const config = statusMap[status] || { text: status, color: 'default' };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const onRefresh = async () => {
    if (keyword) {
      await searchOrders(keyword);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
      <NavBar onBack={() => navigate(-1)}>订单查询</NavBar>
      
      <div style={{ padding: 12, background: '#fff' }}>
        <SearchBar
          placeholder="输入订单号/SKU搜索"
          value={keyword}
          onChange={setKeyword}
          onSearch={searchOrders}
          showCancelButton
        />
      </div>

      <PullToRefresh onRefresh={onRefresh}>
        <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
          {orders.length === 0 ? (
            <Empty description="暂无订单数据" style={{ padding: 40 }} />
          ) : (
            orders.map(order => (
              <Card key={order.id} style={{ marginBottom: 12, borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 500 }}>{order.orderNo}</span>
                  {getStatusTag(order.status)}
                </div>
                <div style={{ fontSize: 14, color: '#333', marginBottom: 4 }}>
                  {order.productName}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#999' }}>
                  <span>数量: {order.quantity}</span>
                  <span>{order.createTime}</span>
                </div>
              </Card>
            ))
          )}
        </div>
      </PullToRefresh>
    </div>
  );
};

export default OrderQuery;
