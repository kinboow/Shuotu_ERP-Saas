import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Spin, Table, Select, Button, Progress, Tag } from 'antd';
import { 
  ShoppingOutlined, CheckCircleOutlined, SettingOutlined, 
  SafetyOutlined, RightOutlined, ReloadOutlined,
  GlobalOutlined, DatabaseOutlined
} from '@ant-design/icons';

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pendingOrders: 0,
    waitingShip: 10,
    waitingOut: 0,
    waitingDown: 0,
    waitingOrder: 0,
    shipping: 0
  });
  const [salesStats, setSalesStats] = useState({
    orderCount: 452,
    salesAmount: 0,
    refundAmount: 0,
    orderAmount: 287,
    avgPrice: 0,
    cancelOrders: 0
  });
  const [inventoryStats, setInventoryStats] = useState({
    totalValue: 9254.51,
    skuCount: 534
  });

  useEffect(() => {
    document.title = '协途 - 数据概览';
    // 模拟加载
    setTimeout(() => setLoading(false), 500);
  }, []);

  // 排行榜数据
  const rankingData = [
    { key: 1, rank: 1, image: '', name: '女式冬季毛呢...', msku: 'MSKU: A11...', platform: 'temu全托', shop: '依曼环球', sales: 56, orders: 15, orderAmount: 0, netProfit: 0, avgPrice: 0 },
    { key: 2, rank: 2, image: '', name: '氨纶网纱上衣', msku: 'MSKU: A6-2...', platform: 'temu全托管', shop: '厦门建', sales: 46, orders: 14, orderAmount: 0, netProfit: 0, avgPrice: 0 },
    { key: 3, rank: 3, image: '', name: '女士冬季毛呢裙...', msku: 'MSKU: A11...', platform: 'temu全托', shop: '依曼环球', sales: 44, orders: 13, orderAmount: 0, netProfit: 0, avgPrice: 0 },
    { key: 4, rank: 4, image: '', name: '', msku: 'MSKU: A12-...', platform: 'temu全托管', shop: '厦黑', sales: 44, orders: 14, orderAmount: 0, netProfit: 0, avgPrice: 0 },
    { key: 5, rank: 5, image: '', name: '立领冬季毛呢裙', msku: 'MSKU: 12 4...', platform: 'temu', shop: '', sales: 34, orders: 13, orderAmount: 0, netProfit: 0, avgPrice: 0 },
    { key: 6, rank: 6, image: '', name: '重工刺绣连衣裙', msku: 'MSKU: A12-...', platform: 'temu全托', shop: '厦黑', sales: 33, orders: 13, orderAmount: 0, netProfit: 0, avgPrice: 0 },
  ];

  const rankingColumns = [
    { title: '序号', dataIndex: 'rank', width: 50, render: (v) => <span style={{ color: v <= 3 ? '#1890ff' : '#666' }}>{v}</span> },
    { title: '商品', dataIndex: 'name', width: 120, render: (_, r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 40, height: 40, background: '#f5f5f5', borderRadius: 4 }}></div>
        <div>
          <div style={{ fontSize: 12, color: '#333' }}>{r.name || '-'}</div>
          <div style={{ fontSize: 11, color: '#999' }}>{r.msku}</div>
        </div>
      </div>
    )},
    { title: '平台', dataIndex: 'platform', width: 80, render: (v) => <Tag color="blue" style={{ fontSize: 11 }}>{v}</Tag> },
    { title: '店铺', dataIndex: 'shop', width: 70 },
    { title: '销量↓', dataIndex: 'sales', width: 60 },
    { title: '订单量↓', dataIndex: 'orders', width: 70 },
    { title: '销售额%', dataIndex: 'orderAmount', width: 70, render: (v) => `$${v}` },
    { title: '净利润%', dataIndex: 'netProfit', width: 70, render: (v) => `$${v}` },
    { title: '平均销价↓', dataIndex: 'avgPrice', width: 80, render: (v) => v.toFixed(2) },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ background: '#f0f2f5', minHeight: '100vh', padding: '0' }}>
      {/* 顶部筛选栏 */}
      <div style={{ background: '#fff', padding: '12px 24px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Select defaultValue="all" style={{ width: 100 }} options={[{ value: 'all', label: '全部平台' }]} />
        <Select defaultValue="all" style={{ width: 100 }} options={[{ value: 'all', label: '全部店铺' }]} />
        <Select defaultValue="all" style={{ width: 100 }} options={[{ value: 'all', label: '全部站点' }]} />
        <Select defaultValue="USD" style={{ width: 80 }} options={[{ value: 'USD', label: 'USD' }]} />
        <Button type="primary">筛选</Button>
        <div style={{ flex: 1 }}></div>
        <span style={{ color: '#999', fontSize: 12 }}>数据时间: {new Date().toLocaleString()}</span>
      </div>

      {/* 新版化引导 */}
      <Card size="small" style={{ margin: '0 0 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#666' }}>新版化引导 <RightOutlined style={{ fontSize: 10 }} /></span>
          <span style={{ color: '#999', fontSize: 12 }}>收起 <RightOutlined /></span>
        </div>
        <div style={{ display: 'flex', gap: 24, marginTop: 12 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#f6ffed', borderRadius: 8, border: '1px solid #b7eb8f' }}>
            <CheckCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} />
            <div>
              <div style={{ fontWeight: 500 }}>基础资料授权 <Tag color="success" style={{ marginLeft: 8 }}>已完成</Tag></div>
              <div style={{ fontSize: 12, color: '#999' }}>完成店铺首次授权等操作，开启数字化旅程</div>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#fff7e6', borderRadius: 8, border: '1px solid #ffd591' }}>
            <SettingOutlined style={{ fontSize: 24, color: '#fa8c16' }} />
            <div>
              <div style={{ fontWeight: 500 }}>跨境仓储配置</div>
              <div style={{ fontSize: 12, color: '#999' }}>仓配置及仓库等配置，便于大规模商品工作</div>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#f0f5ff', borderRadius: 8, border: '1px solid #adc6ff' }}>
            <SafetyOutlined style={{ fontSize: 24, color: '#1890ff' }} />
            <div>
              <div style={{ fontWeight: 500 }}>产品信息维护</div>
              <div style={{ fontSize: 12, color: '#999' }}>录入本地产品并搭配平台商品，实现数据联动</div>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#fff0f6', borderRadius: 8, border: '1px solid #ffadd2' }}>
            <DatabaseOutlined style={{ fontSize: 24, color: '#eb2f96' }} />
            <div>
              <div style={{ fontWeight: 500 }}>仓货物管理</div>
              <div style={{ fontSize: 12, color: '#999' }}>仓发货流程打下一站，高效发货</div>
            </div>
          </div>
        </div>
      </Card>

      <Row gutter={16}>
        {/* 左侧区域 */}
        <Col span={16}>
          {/* 自发货订单 */}
          <Card size="small" title="自发货订单" extra={<a href="/orders">查看全部发货订单 <RightOutlined /></a>} style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={4}><Statistic title="未付款" value={stats.pendingOrders} valueStyle={{ color: '#1890ff', fontSize: 28 }} /></Col>
              <Col span={4}><Statistic title="待确认发货" value={stats.waitingShip} valueStyle={{ color: '#1890ff', fontSize: 28 }} /></Col>
              <Col span={4}><Statistic title="待仓库出库" value={stats.waitingOut} valueStyle={{ color: '#333', fontSize: 28 }} /></Col>
              <Col span={4}><Statistic title="待物流下单" value={stats.waitingDown} valueStyle={{ color: '#333', fontSize: 28 }} /></Col>
              <Col span={4}><Statistic title="待订单" value={stats.waitingOrder} valueStyle={{ color: '#333', fontSize: 28 }} /></Col>
              <Col span={4}><Statistic title="发货中" value={stats.shipping} valueStyle={{ color: '#333', fontSize: 28 }} /></Col>
            </Row>
          </Card>

          {/* 业绩走势 */}
          <Card size="small" title="业绩走势" extra={
            <div style={{ display: 'flex', gap: 8 }}>
              <Button size="small">今天</Button>
              <Button size="small">近7天</Button>
              <Button size="small" type="primary">近30天</Button>
              <Button size="small">上月</Button>
              <Button size="small">今年</Button>
              <Button size="small">自定义</Button>
            </div>
          } style={{ marginBottom: 16 }}>
            <Row gutter={24} style={{ marginBottom: 16 }}>
              <Col span={4}>
                <div style={{ color: '#999', fontSize: 12 }}>销量</div>
                <div style={{ fontSize: 24, fontWeight: 500, color: '#1890ff' }}>1,397</div>
                <div style={{ fontSize: 11, color: '#52c41a' }}>+69/50.00%</div>
              </Col>
              <Col span={4}>
                <div style={{ color: '#999', fontSize: 12 }}>订单量</div>
                <div style={{ fontSize: 24, fontWeight: 500 }}>890</div>
                <div style={{ fontSize: 11, color: '#52c41a' }}>+44/90.00%</div>
              </Col>
              <Col span={4}>
                <div style={{ color: '#999', fontSize: 12 }}>销售额</div>
                <div style={{ fontSize: 24, fontWeight: 500 }}>$0.00</div>
                <div style={{ fontSize: 11, color: '#999' }}>100.00%</div>
              </Col>
              <Col span={4}>
                <div style={{ color: '#999', fontSize: 12 }}>净利润额</div>
                <div style={{ fontSize: 24, fontWeight: 500 }}>$0.00</div>
                <div style={{ fontSize: 11, color: '#999' }}>0.00%</div>
              </Col>
              <Col span={4}>
                <div style={{ color: '#999', fontSize: 12 }}>平均销价</div>
                <div style={{ fontSize: 24, fontWeight: 500 }}>$0.00</div>
                <div style={{ fontSize: 11, color: '#999' }}>100.00%</div>
              </Col>
            </Row>
            {/* 图表区域 - 简化显示 */}
            <div style={{ height: 200, background: '#fafafa', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
              图表区域（销量趋势）
            </div>
          </Card>

          {/* 排行榜 TOP 50 */}
          <Card size="small" title="排行榜 TOP 50" extra={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Button size="small" type="primary">销量</Button>
              <Button size="small">销售额</Button>
              <span style={{ color: '#999' }}>|</span>
              <Button size="small">MSKU</Button>
              <Button size="small">店铺</Button>
              <Button size="small">平台</Button>
              <Button size="small">SKU</Button>
            </div>
          }>
            <Table 
              columns={rankingColumns} 
              dataSource={rankingData} 
              size="small" 
              pagination={false}
              scroll={{ y: 300 }}
            />
          </Card>
        </Col>

        {/* 右侧区域 */}
        <Col span={8}>
          {/* 实时报告 */}
          <Card size="small" title="实时报告" style={{ marginBottom: 16 }}>
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <div style={{ color: '#999', fontSize: 12 }}>销量</div>
                <div style={{ fontSize: 20, fontWeight: 500 }}>452</div>
                <div style={{ fontSize: 11, color: '#999' }}>昨日 503</div>
                <div style={{ fontSize: 11, color: '#999' }}>上周同日 0</div>
              </Col>
              <Col span={8}>
                <div style={{ color: '#999', fontSize: 12 }}>销售额</div>
                <div style={{ fontSize: 20, fontWeight: 500, color: '#1890ff' }}>$0</div>
                <div style={{ fontSize: 11, color: '#999' }}>昨日 $0</div>
                <div style={{ fontSize: 11, color: '#999' }}>上周同日 $0</div>
              </Col>
              <Col span={8}>
                <div style={{ color: '#999', fontSize: 12 }}>净利润额</div>
                <div style={{ fontSize: 20, fontWeight: 500 }}>$0</div>
                <div style={{ fontSize: 11, color: '#999' }}>昨日 $0</div>
                <div style={{ fontSize: 11, color: '#999' }}>上周同日 $0</div>
              </Col>
              <Col span={8}>
                <div style={{ color: '#999', fontSize: 12 }}>订单量</div>
                <div style={{ fontSize: 20, fontWeight: 500 }}>287</div>
                <div style={{ fontSize: 11, color: '#999' }}>昨日 306</div>
                <div style={{ fontSize: 11, color: '#999' }}>上周同日 $0</div>
              </Col>
              <Col span={8}>
                <div style={{ color: '#999', fontSize: 12 }}>平均销价</div>
                <div style={{ fontSize: 20, fontWeight: 500 }}>$0</div>
                <div style={{ fontSize: 11, color: '#999' }}>昨日 $0</div>
                <div style={{ fontSize: 11, color: '#999' }}>上周同日 $0</div>
              </Col>
              <Col span={8}>
                <div style={{ color: '#999', fontSize: 12 }}>取消订单数</div>
                <div style={{ fontSize: 20, fontWeight: 500 }}>0</div>
                <div style={{ fontSize: 11, color: '#999' }}>昨日 0</div>
                <div style={{ fontSize: 11, color: '#999' }}>上周同日 0</div>
              </Col>
            </Row>
          </Card>

          {/* 订单分布 */}
          <Card size="small" title="订单分布" extra={
            <div style={{ display: 'flex', gap: 8 }}>
              <Button size="small">近7天</Button>
              <Button size="small" type="primary">近14天</Button>
              <Button size="small">近28天</Button>
            </div>
          } style={{ marginBottom: 16 }}>
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GlobalOutlined style={{ fontSize: 120, color: '#e6f7ff' }} />
            </div>
          </Card>

          {/* 库存概览 */}
          <Card size="small" title="库存概览" extra={<a>实时 | 离线</a>}>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <DatabaseOutlined style={{ fontSize: 32, color: '#1890ff' }} />
                  <div>
                    <div style={{ color: '#999', fontSize: 12 }}>在库</div>
                    <div style={{ fontSize: 20, fontWeight: 500, color: '#1890ff' }}>9,254.51万</div>
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShoppingOutlined style={{ fontSize: 32, color: '#722ed1' }} />
                  <div>
                    <div style={{ color: '#999', fontSize: 12 }}>在途</div>
                    <div style={{ fontSize: 20, fontWeight: 500, color: '#722ed1' }}>534</div>
                  </div>
                </div>
              </Col>
            </Row>
            <div style={{ height: 120, background: '#fafafa', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Progress type="circle" percent={75} size={80} />
            </div>
            <Table 
              size="small"
              pagination={false}
              columns={[
                { title: '', dataIndex: 'type', width: 60 },
                { title: 'FBA仓', dataIndex: 'fba', width: 60 },
                { title: '海外仓', dataIndex: 'overseas', width: 70 },
                { title: '本地仓库', dataIndex: 'local', width: 80 },
                { title: 'AWD仓', dataIndex: 'awd', width: 70 },
              ]}
              dataSource={[
                { key: 1, type: '在库', fba: 0, overseas: '1,002.45万', local: '8,252.05万', awd: '-' },
                { key: 2, type: '在途', fba: 0, overseas: 288, local: 246, awd: '-' },
                { key: 3, type: '合计', fba: 0, overseas: '1,002.4...', local: '8,252.0...', awd: '-' },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Dashboard;
