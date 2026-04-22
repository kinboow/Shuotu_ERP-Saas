import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Button,
  Select,
  Space,
  Divider,
  Checkbox,
  message,
  Table,
  Image,
  Tag,
  Row,
  Col,
  Descriptions
} from 'antd';
import { ArrowLeftOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Option } = Select;

function PublishFromERP() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erpProducts, setErpProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    fetchERPProducts();
  }, []);

  const fetchERPProducts = async () => {
    try {
      const response = await fetch('/api/erp-products');
      const data = await response.json();
      if (data.success) {
        // 确保data.data是数组
        const products = Array.isArray(data.data) ? data.data : [];
        setErpProducts(products);
      } else {
        setErpProducts([]);
      }
    } catch (error) {
      console.error('获取ERP产品失败:', error);
      message.error('获取ERP产品列表失败');
      setErpProducts([]);
    }
  };

  const handlePlatformChange = (platforms) => {
    setSelectedPlatforms(platforms);
  };

  const handleProductChange = (productId) => {
    const product = erpProducts.find(p => p.id === productId);
    setSelectedProduct(product);
  };

  const handleSubmit = async (values) => {
    if (selectedPlatforms.length === 0) {
      message.error('请至少选择一个发布平台');
      return;
    }

    if (!values.erpProductId) {
      message.error('请选择ERP产品');
      return;
    }

    setLoading(true);
    try {
      // TODO: 实现发布逻辑
      console.log('发布数据:', {
        ...values,
        product: selectedProduct
      });
      message.success('商品发布成功！');
      form.resetFields();
      setSelectedProduct(null);
    } catch (error) {
      message.error('发布失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title={
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/publish-product')}
            >
              返回
            </Button>
            <span>从ERP产品刊登</span>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          {/* 平台选择 */}
          <Divider>选择发布平台</Divider>
          <Form.Item
            name="platforms"
            label="发布平台"
            rules={[{ required: true, message: '请选择至少一个平台' }]}
          >
            <Checkbox.Group onChange={handlePlatformChange}>
              <Checkbox value="shein">SHEIN</Checkbox>
              <Checkbox value="temu">TEMU</Checkbox>
              <Checkbox value="tiktok">TikTok</Checkbox>
            </Checkbox.Group>
          </Form.Item>

          {/* ERP产品选择 */}
          <Divider>选择ERP产品</Divider>
          <Form.Item
            name="erpProductId"
            label="ERP产品"
            rules={[{ required: true, message: '请选择ERP产品' }]}
          >
            <Select
              placeholder="请选择要刊登的ERP产品"
              showSearch
              onChange={handleProductChange}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={(erpProducts || []).map(product => ({
                label: `${product.product_name || product.name} - ${product.sku || product.id}`,
                value: product.id
              }))}
            />
          </Form.Item>

          {/* 显示选中的产品信息 */}
          {selectedProduct && (
            <Card
              title="产品预览"
              size="small"
              style={{ marginBottom: 24, backgroundColor: '#fafafa' }}
            >
              <Row gutter={16}>
                <Col span={6}>
                  {selectedProduct.main_image ? (
                    <Image
                      src={selectedProduct.main_image}
                      alt={selectedProduct.product_name}
                      style={{ width: '100%', borderRadius: 4 }}
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: 150,
                      backgroundColor: '#e8e8e8',
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#999'
                    }}>
                      无图片
                    </div>
                  )}
                </Col>
                <Col span={18}>
                  <Descriptions column={2} size="small">
                    <Descriptions.Item label="产品名称" span={2}>
                      {selectedProduct.product_name || selectedProduct.name}
                    </Descriptions.Item>
                    <Descriptions.Item label="SKU">
                      {selectedProduct.sku || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="价格">
                      ¥{selectedProduct.price || '0.00'}
                    </Descriptions.Item>
                    <Descriptions.Item label="库存">
                      {selectedProduct.stock || 0}
                    </Descriptions.Item>
                    <Descriptions.Item label="状态">
                      <Tag color={selectedProduct.status === 'active' ? 'green' : 'default'}>
                        {selectedProduct.status === 'active' ? '启用' : '禁用'}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="描述" span={2}>
                      {selectedProduct.description || '-'}
                    </Descriptions.Item>
                  </Descriptions>
                </Col>
              </Row>
            </Card>
          )}

          <div style={{
            padding: '16px',
            backgroundColor: '#e6f7ff',
            borderRadius: '4px',
            marginBottom: '16px',
            border: '1px solid #91d5ff'
          }}>
            <p style={{ margin: 0, color: '#0050b3' }}>
              💡 提示：选择ERP产品后，系统会自动使用产品的名称、描述、图片、价格等信息进行刊登
            </p>
          </div>

          {/* 平台特定配置 */}
          {selectedPlatforms.length > 0 && (
            <>
              <Divider>平台配置</Divider>
              <div style={{
                padding: '16px',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                marginBottom: '16px'
              }}>
                <p style={{ margin: 0, color: '#666' }}>
                  💡 已选择平台: {selectedPlatforms.map(p => {
                    const names = { shein: 'SHEIN', temu: 'TEMU', tiktok: 'TikTok' };
                    return names[p];
                  }).join(', ')}
                </p>
              </div>

              {selectedPlatforms.includes('shein') && (
                <Card title="SHEIN配置" size="small" style={{ marginBottom: 16 }}>
                  <Form.Item name="sheinCategory" label="分类" rules={[{ required: true }]}>
                    <Select placeholder="请选择分类">
                      <Option value="1">女装</Option>
                      <Option value="2">男装</Option>
                    </Select>
                  </Form.Item>
                  <Form.Item name="sheinBrand" label="品牌">
                    <Select placeholder="请选择品牌（可选）" allowClear>
                      <Option value="1">品牌A</Option>
                      <Option value="2">品牌B</Option>
                    </Select>
                  </Form.Item>
                </Card>
              )}

              {selectedPlatforms.includes('temu') && (
                <Card title="TEMU配置" size="small" style={{ marginBottom: 16 }}>
                  <Form.Item name="temuCategory" label="分类" rules={[{ required: true }]}>
                    <Select placeholder="请选择分类">
                      <Option value="1">服装</Option>
                      <Option value="2">配饰</Option>
                    </Select>
                  </Form.Item>
                </Card>
              )}

              {selectedPlatforms.includes('tiktok') && (
                <Card title="TikTok配置" size="small" style={{ marginBottom: 16 }}>
                  <Form.Item name="tiktokCategory" label="分类" rules={[{ required: true }]}>
                    <Select placeholder="请选择分类">
                      <Option value="1">Fashion</Option>
                      <Option value="2">Accessories</Option>
                    </Select>
                  </Form.Item>
                </Card>
              )}
            </>
          )}

          {/* 提交按钮 */}
          <Form.Item style={{ marginTop: '24px' }}>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                size="large"
                disabled={!selectedProduct}
              >
                发布到所选平台
              </Button>
              <Button
                size="large"
                onClick={() => {
                  form.resetFields();
                  setSelectedProduct(null);
                }}
              >
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

export default PublishFromERP;
