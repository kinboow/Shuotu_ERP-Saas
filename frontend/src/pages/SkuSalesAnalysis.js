import React, { useState, useEffect } from 'react';
import { Card, Statistic, Row, Col, Spin, message, Button, Space, Empty } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, ReloadOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';

function SkuSalesAnalysis() {
  const location = useLocation();
  const navigate = useNavigate();
  const [salesData, setSalesData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [skuCode, setSkuCode] = useState('');
  const [skuName, setSkuName] = useState('');

  useEffect(() => {
    // 从路由参数获取SKU信息
    if (location.state) {
      const { skuCode: code, skuName: name } = location.state;
      setSkuCode(code);
      setSkuName(name);
      if (code) {
        fetchSalesData(code);
      }
    }
  }, [location]);

  const fetchSalesData = async (code) => {
    setLoading(true);
    try {
      const response = await fetch('/api/sku-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: 1,
          skuCodeList: [code]
        })
      });

      const data = await response.json();

      if (data.success && data.data && data.data.length > 0) {
        setSalesData(data.data[0]);
      } else {
        message.error(data.message || '获取销量数据失败');
      }
    } catch (error) {
      message.error('获取销量数据失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    if (skuCode) {
      fetchSalesData(skuCode);
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  if (!skuCode) {
    return (
      <div style={{ padding: 24 }}>
        <Empty description="未找到SKU信息" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ marginBottom: 8 }}>SKU销量分析</h1>
          <div style={{ color: '#666', fontSize: 14 }}>
            <span>SKU编码: {skuCode}</span>
            {skuName && <span style={{ marginLeft: 16 }}>商品名称: {skuName}</span>}
          </div>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
            刷新
          </Button>
          <Button onClick={handleBack}>
            返回
          </Button>
        </Space>
      </div>

      <Spin spinning={loading}>
        {salesData ? (
          <div>
            {/* 销量统计卡片 */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="当日销量"
                    value={salesData.realTimeSaleCnt || 0}
                    prefix={<ArrowUpOutlined style={{ color: '#52c41a' }} />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="昨日销量"
                    value={salesData.cydSaleCnt || 0}
                    prefix={<ArrowDownOutlined style={{ color: '#faad14' }} />}
                    valueStyle={{ color: '#faad14' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="7日销量"
                    value={salesData.c7dSaleCnt || 0}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="30日销量"
                    value={salesData.c30dSaleCnt || 0}
                    valueStyle={{ color: '#722ed1' }}
                  />
                </Card>
              </Col>
            </Row>

            {/* 详细信息 */}
            <Card title="销量详情" style={{ marginBottom: 24 }}>
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
                    <div style={{ color: '#999', marginBottom: 8, fontSize: 12 }}>数据统计截止日期</div>
                    <div style={{ fontSize: 16, fontWeight: 'bold' }}>
                      {salesData.dt ? `${salesData.dt.substring(0, 4)}-${salesData.dt.substring(4, 6)}-${salesData.dt.substring(6, 8)}` : '-'}
                    </div>
                  </div>
                </Col>
                <Col xs={24} sm={12}>
                  <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
                    <div style={{ color: '#999', marginBottom: 8, fontSize: 12 }}>SKU编码</div>
                    <div style={{ fontSize: 16, fontWeight: 'bold' }}>{salesData.skuCode}</div>
                  </div>
                </Col>
              </Row>
            </Card>

            {/* 销量趋势分析 */}
            <Card title="销量趋势分析">
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  <div style={{ padding: 12, background: '#e6f7ff', borderRadius: 4 }}>
                    <div style={{ color: '#0050b3', marginBottom: 8, fontSize: 12 }}>7日平均日销量</div>
                    <div style={{ fontSize: 18, fontWeight: 'bold', color: '#0050b3' }}>
                      {salesData.c7dSaleCnt ? Math.round(salesData.c7dSaleCnt / 7) : 0}
                    </div>
                  </div>
                </Col>
                <Col xs={24} sm={12}>
                  <div style={{ padding: 12, background: '#f9f0ff', borderRadius: 4 }}>
                    <div style={{ color: '#531dab', marginBottom: 8, fontSize: 12 }}>30日平均日销量</div>
                    <div style={{ fontSize: 18, fontWeight: 'bold', color: '#531dab' }}>
                      {salesData.c30dSaleCnt ? Math.round(salesData.c30dSaleCnt / 30) : 0}
                    </div>
                  </div>
                </Col>
                <Col xs={24} sm={12}>
                  <div style={{ padding: 12, background: '#f6ffed', borderRadius: 4 }}>
                    <div style={{ color: '#274e2b', marginBottom: 8, fontSize: 12 }}>7日环比增长</div>
                    <div style={{ fontSize: 18, fontWeight: 'bold', color: '#274e2b' }}>
                      {salesData.cydSaleCnt && salesData.c7dSaleCnt ? 
                        `${((salesData.realTimeSaleCnt - salesData.cydSaleCnt) / (salesData.cydSaleCnt || 1) * 100).toFixed(1)}%` 
                        : '-'}
                    </div>
                  </div>
                </Col>
                <Col xs={24} sm={12}>
                  <div style={{ padding: 12, background: '#fff7e6', borderRadius: 4 }}>
                    <div style={{ color: '#ad6800', marginBottom: 8, fontSize: 12 }}>30日销量占比</div>
                    <div style={{ fontSize: 18, fontWeight: 'bold', color: '#ad6800' }}>
                      {salesData.c30dSaleCnt && salesData.c7dSaleCnt ? 
                        `${(salesData.c7dSaleCnt / salesData.c30dSaleCnt * 100).toFixed(1)}%` 
                        : '-'}
                    </div>
                  </div>
                </Col>
              </Row>
            </Card>
          </div>
        ) : (
          <Empty description="暂无销量数据" />
        )}
      </Spin>
    </div>
  );
}

export default SkuSalesAnalysis;
