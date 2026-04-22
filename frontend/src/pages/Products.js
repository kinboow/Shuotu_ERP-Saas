import React, { useEffect, useState } from 'react';
import { Table, Button, InputNumber, Space, message, Tag, Card, Row, Col, Statistic } from 'antd';
import { ShoppingOutlined, DollarOutlined, InboxOutlined } from '@ant-design/icons';
import { productsAPI } from '../api';

function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // 获取所有产品，设置一个大的limit值
      const response = await productsAPI.getAll({ page: 1, limit: 10000 });
      setProducts(response.data.data);
    } catch (error) {
      console.error('获取产品失败:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleStockUpdate = async (id, stock) => {
    try {
      await productsAPI.updateStock(id, stock);
      message.success('库存更新成功');
      fetchProducts();
    } catch (error) {
      message.error('库存更新失败');
    }
  };

  const columns = [
    { 
      title: '图片', 
      dataIndex: 'image_url', 
      key: 'image_url',
      width: 80,
      render: (image_url, record) => {
        const imgUrl = image_url || record.main_image || 
                      (record.images && record.images[0]?.imageUrl);
        return imgUrl ? (
          <img 
            src={imgUrl} 
            alt={record.name}
            style={{ 
              width: '60px', 
              height: '60px', 
              objectFit: 'cover',
              borderRadius: '4px',
              cursor: 'pointer',
              border: '1px solid #e8e8e8'
            }}
            onClick={() => setPreviewImage({
              url: imgUrl,
              name: record.name,
              sku: record.sku
            })}
            title="点击预览"
          />
        ) : (
          <div style={{ 
            width: '60px', 
            height: '60px', 
            background: '#f0f0f0',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            color: '#999'
          }}>
            无图片
          </div>
        );
      }
    },
    { 
      title: 'SKU', 
      dataIndex: 'sku', 
      key: 'sku',
      width: 150
    },
    { 
      title: '产品名称', 
      dataIndex: 'name', 
      key: 'name',
      render: (name, record) => (
        <div>
          <div style={{ marginBottom: '4px' }}>{name}</div>
          {record.source_platform === 'shein' && (
            <Tag color="blue" style={{ fontSize: '11px' }}>
              SHEIN
            </Tag>
          )}
          {record.supplier_sku && (
            <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
              供应商SKU: {record.supplier_sku}
            </div>
          )}
        </div>
      )
    },
    { 
      title: '成本/价格', 
      dataIndex: 'cost', 
      key: 'cost',
      width: 120,
      render: (cost, record) => {
        const currency = record.currency || 'CNY';
        return (
          <div>
            <div style={{ fontWeight: '600' }}>{currency} {cost || 0}</div>
            {record.price && (
              <div style={{ fontSize: '12px', color: '#999' }}>
                价格: {currency} {record.price}
              </div>
            )}
          </div>
        );
      }
    },
    { 
      title: '库存', 
      dataIndex: 'stock', 
      key: 'stock',
      width: 150,
      render: (stock, record) => (
        <Space>
          <span style={{ fontWeight: '500' }}>{stock}</span>
          <InputNumber
            min={0}
            defaultValue={stock}
            size="small"
            onPressEnter={(e) => handleStockUpdate(record.id, e.target.value)}
          />
        </Space>
      )
    },
    { 
      title: '分类', 
      dataIndex: 'category', 
      key: 'category',
      width: 100
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status) => (
        <Tag color={status === 'active' ? 'success' : 'error'}>
          {status === 'active' ? '在售' : '停售'}
        </Tag>
      )
    }
  ];

  // 计算统计信息
  const stats = {
    total: products.length,
    active: products.filter(p => p.status === 'active').length,
    shein: products.filter(p => p.source_platform === 'shein').length,
    totalValue: products.reduce((sum, p) => sum + (parseFloat(p.price) || 0) * (p.stock || 0), 0)
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1 style={{ marginBottom: '20px' }}>📦 产品管理</h1>
      
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: '20px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总商品数"
              value={stats.total}
              prefix={<ShoppingOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="在售商品"
              value={stats.active}
              prefix={<InboxOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="SHEIN商品"
              value={stats.shein}
              suffix={`/ ${stats.total}`}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="库存总值"
              value={stats.totalValue.toFixed(2)}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 图片预览模态框 */}
      {previewImage && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000
          }}
          onClick={() => setPreviewImage(null)}
        >
          <div 
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              background: 'white',
              borderRadius: '12px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                width: '40px',
                height: '40px',
                border: 'none',
                background: 'rgba(0, 0, 0, 0.5)',
                color: 'white',
                fontSize: '28px',
                cursor: 'pointer',
                borderRadius: '50%',
                zIndex: 10
              }}
              onClick={() => setPreviewImage(null)}
            >
              ×
            </button>
            <div style={{ padding: '20px 60px 20px 20px', borderBottom: '1px solid #e8e8e8', background: '#fafafa' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>{previewImage.name}</h3>
              <span style={{ fontSize: '12px', color: '#999' }}>SKU: {previewImage.sku}</span>
            </div>
            <div style={{ 
              flex: 1, 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              padding: '20px',
              background: '#f5f5f5',
              minHeight: '400px',
              maxHeight: 'calc(90vh - 180px)',
              overflow: 'auto'
            }}>
              <img 
                src={previewImage.url} 
                alt={previewImage.name}
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '100%', 
                  objectFit: 'contain',
                  borderRadius: '8px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                  background: 'white'
                }}
              />
            </div>
            <div style={{ 
              padding: '20px', 
              borderTop: '1px solid #e8e8e8',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <Button onClick={() => window.open(previewImage.url, '_blank')}>
                在新窗口打开
              </Button>
              <Button type="primary" onClick={() => setPreviewImage(null)}>
                关闭
              </Button>
            </div>
          </div>
        </div>
      )}

      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h1 style={{ margin: 0 }}>产品管理</h1>
        <div>
          <Tag color="blue">SHEIN商品: {products.filter(p => p.source_platform === 'shein').length}</Tag>
          <Tag>总计: {products.length}</Tag>
        </div>
      </div>
      <Table
        columns={columns}
        dataSource={products}
        loading={loading}
        rowKey="id"
        pagination={{
          defaultPageSize: 20,
          pageSize: 20,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100', '200'],
          showTotal: (total) => `共 ${total} 个商品`,
          showQuickJumper: true
        }}
      />
    </div>
  );
}

export default Products;
