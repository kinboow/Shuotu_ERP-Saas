import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Select, message, Tag, Spin, Card, Statistic, Row, Col } from 'antd';
import { SyncOutlined, InboxOutlined } from '@ant-design/icons';

function ProductInventory() {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [shops, setShops] = useState([]);
  const [selectedShopId, setSelectedShopId] = useState(null);
  const [warehouseType, setWarehouseType] = useState('1');
  const [inventoryData, setInventoryData] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalInventory: 0,
    totalUsable: 0,
    totalLocked: 0
  });

  // 获取店铺列表
  useEffect(() => {
    fetchShops();
  }, []);

  useEffect(() => {
    if (selectedShopId) {
      fetchInventoryList();
    }
  }, [selectedShopId, warehouseType, pagination.current, pagination.pageSize]);

  const fetchShops = async () => {
    try {
      const response = await fetch('/api/shein-full-auth/shops');
      const data = await response.json();
      if (data.success && data.data) {
        const activeShops = data.data.filter(shop => shop.is_active !== false);
        setShops(activeShops);
        if (activeShops.length > 0) {
          setSelectedShopId(activeShops[0].id);
        }
      }
    } catch (error) {
      console.error('获取店铺列表失败:', error);
      message.error('获取店铺列表失败');
    }
  };

  const applyInventoryList = (list = [], total = list.length) => {
    setInventoryData(list);
    const nextStats = list.reduce((acc, product) => {
      if (product.inventory) {
        acc.totalInventory += product.inventory.totalInventoryQuantity || 0;
        acc.totalUsable += product.inventory.totalUsableInventory || 0;
        acc.totalLocked += product.inventory.totalLockedQuantity || 0;
      }
      return acc;
    }, {
      totalProducts: total,
      totalInventory: 0,
      totalUsable: 0,
      totalLocked: 0
    });
    setStats(nextStats);
  };

  const fetchInventoryList = async (nextPage = pagination.current, nextPageSize = pagination.pageSize) => {
    if (!selectedShopId) {
      setInventoryData([]);
      setPagination(prev => ({ ...prev, total: 0 }));
      setStats({ totalProducts: 0, totalInventory: 0, totalUsable: 0, totalLocked: 0 });
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        shopId: selectedShopId,
        warehouseType,
        page: nextPage,
        pageSize: nextPageSize
      });
      const response = await fetch(`/api/shein-full/inventory/list?${params}`);
      const data = await response.json();

      if (data.success) {
        const list = data.data?.list || [];
        applyInventoryList(list, data.data?.total || 0);
        setPagination(prev => ({
          ...prev,
          current: data.data?.page || nextPage,
          pageSize: data.data?.pageSize || nextPageSize,
          total: data.data?.total || 0
        }));
      } else {
        message.error(data.message || '获取库存列表失败');
      }
    } catch (error) {
      console.error('获取库存列表失败:', error);
      message.error('获取库存列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 同步在线商品库存
  const handleSyncInventory = async () => {
    if (!selectedShopId) {
      message.error('请先选择店铺');
      return;
    }

    setSyncing(true);
    try {
      const response = await fetch('/api/shein-full/sync/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: selectedShopId,
          warehouseType
        })
      });

      const data = await response.json();

      if (data.success) {
        setPagination(prev => ({ ...prev, current: 1 }));
        await fetchInventoryList(1, pagination.pageSize);
        message.success(`库存同步完成：成功 ${data.data?.successCount || 0}，失败 ${data.data?.failCount || 0}`);
      } else {
        message.error(data.message || '同步失败');
      }
    } catch (error) {
      console.error('同步库存失败:', error);
      message.error('同步失败: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  // 获取库存状态标签
  const getInventoryStatus = (inventory) => {
    if (!inventory) {
      return <Tag color="default">无数据</Tag>;
    }

    const usable = inventory.totalUsableInventory || 0;
    
    if (usable === 0) {
      return <Tag color="red">缺货</Tag>;
    } else if (usable < 10) {
      return <Tag color="orange">库存低</Tag>;
    } else if (usable < 50) {
      return <Tag color="blue">正常</Tag>;
    } else {
      return <Tag color="green">充足</Tag>;
    }
  };

  const columns = [
    {
      title: 'SKU编码',
      dataIndex: 'sku_code',
      key: 'sku_code',
      width: 150,
      fixed: 'left'
    },
    {
      title: 'SPU编码',
      dataIndex: 'spu_name',
      key: 'spu_name',
      width: 150
    },
    {
      title: 'SKC编码',
      dataIndex: 'skc_name',
      key: 'skc_name',
      width: 150
    },
    {
      title: '商品名称',
      dataIndex: 'product_name_cn',
      key: 'product_name_cn',
      width: 200,
      ellipsis: true
    },
    {
      title: '总库存',
      key: 'totalInventory',
      width: 100,
      render: (_, record) => record.inventory?.totalInventoryQuantity || 0,
      sorter: (a, b) => (a.inventory?.totalInventoryQuantity || 0) - (b.inventory?.totalInventoryQuantity || 0)
    },
    {
      title: '可用库存',
      key: 'usableInventory',
      width: 120,
      render: (_, record) => {
        const usable = record.inventory?.totalUsableInventory || 0;
        return (
          <span style={{
            color: usable === 0 ? '#ff4d4f' : usable < 10 ? '#faad14' : '#52c41a',
            fontWeight: 'bold',
            fontSize: '14px'
          }}>
            {usable}
          </span>
        );
      },
      sorter: (a, b) => (a.inventory?.totalUsableInventory || 0) - (b.inventory?.totalUsableInventory || 0)
    },
    {
      title: '锁定库存',
      key: 'lockedInventory',
      width: 100,
      render: (_, record) => record.inventory?.totalLockedQuantity || 0
    },
    {
      title: '在途库存',
      key: 'transitInventory',
      width: 100,
      render: (_, record) => record.inventory?.totalTransitQuantity || 0
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, record) => getInventoryStatus(record.inventory),
      filters: [
        { text: '缺货', value: 'out' },
        { text: '库存低', value: 'low' },
        { text: '正常', value: 'normal' },
        { text: '充足', value: 'high' }
      ],
      onFilter: (value, record) => {
        const usable = record.inventory?.totalUsableInventory || 0;
        if (value === 'out') return usable === 0;
        if (value === 'low') return usable > 0 && usable < 10;
        if (value === 'normal') return usable >= 10 && usable < 50;
        if (value === 'high') return usable >= 50;
        return false;
      }
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Select
            style={{ width: 200 }}
            placeholder="选择店铺"
            value={selectedShopId}
            onChange={setSelectedShopId}
            options={shops.map(shop => ({
              label: shop.shop_name || `店铺 ${shop.id}`,
              value: shop.id
            }))}
          />
          <Select
            style={{ width: 150 }}
            placeholder="仓库类型"
            value={warehouseType}
            onChange={setWarehouseType}
            options={[
              { label: 'SHEIN仓', value: '1' },
              { label: '虚拟库存(半托管)', value: '2' },
              { label: '虚拟库存(全托管)', value: '3' }
            ]}
          />
          <Button
            type="primary"
            icon={<SyncOutlined />}
            onClick={handleSyncInventory}
            loading={syncing}
          >
            同步库存
          </Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      {inventoryData.length > 0 && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="商品总数"
                value={stats.totalProducts}
                prefix={<InboxOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="总库存"
                value={stats.totalInventory}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="可用库存"
                value={stats.totalUsable}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="锁定库存"
                value={stats.totalLocked}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Spin size="large" tip="正在加载库存数据..." />
        </div>
      ) : (
        <Table
          columns={columns}
          dataSource={inventoryData}
          rowKey={(record) => `${record.sku_code}-${record.warehouse_code || ''}`}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个商品`,
            onChange: (page, pageSize) => setPagination(prev => ({ ...prev, current: page, pageSize }))
          }}
          scroll={{ x: 1200 }}
        />
      )}
    </div>
  );
}

export default ProductInventory;
