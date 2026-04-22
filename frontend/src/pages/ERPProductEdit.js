import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Button,
  Space,
  Select,
  Row,
  Col,
  Upload,
  Image,
  message,
  Divider,
  Tabs,
  Table,
  Modal,
  Spin
} from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  PlusOutlined,
  DeleteOutlined,
  UploadOutlined,
  EditOutlined
} from '@ant-design/icons';

const { TextArea } = Input;
const { TabPane } = Tabs;

function ERPProductEdit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const isEdit = !!id;
  
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState([]);
  const [skcList, setSkcList] = useState([]); // SKC列表（包含SKU）
  const [skuList, setSkuList] = useState([]);
  const [skuModalVisible, setSkuModalVisible] = useState(false);
  const [editingSku, setEditingSku] = useState(null);
  const [skuForm] = Form.useForm();
  
  // 货源相关状态
  const [sourceType, setSourceType] = useState(1); // 1-自生产 2-厂家调货
  const [suppliers, setSuppliers] = useState([]); // 厂家列表

  useEffect(() => {
    fetchSuppliers();
    if (isEdit) {
      fetchProductDetail();
    }
  }, [id]);

  // 获取厂家列表
  const fetchSuppliers = async () => {
    try {
      const response = await fetch('/api/suppliers/active');
      const data = await response.json();
      if (data.success) {
        setSuppliers(data.data || []);
      }
    } catch (error) {
      console.error('获取厂家列表失败:', error);
    }
  };

  const fetchProductDetail = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/erp-products/${id}`);
      const data = await response.json();
      
      if (data.success) {
        const product = data.data;
        form.setFieldsValue({
          product_code: product.product_code,
          product_name_cn: product.product_name_cn,
          product_name_en: product.product_name_en,
          product_desc: product.product_desc,
          brand: product.brand,
          brand_code: product.brand_code,
          brand_id: product.brand_id,
          category: product.category,
          category_id: product.category_id,
          warehouse_id: product.warehouse_id,
          warehouse_name: product.warehouse_name,
          weight: product.weight,
          length: product.length,
          width: product.width,
          height: product.height,
          package_length: product.package_length,
          package_width: product.package_width,
          package_height: product.package_height,
          package_weight: product.package_weight,
          cost_price: product.cost_price,
          suggested_price: product.suggested_price,
          currency: product.currency || 'CNY',
          supplier_code: product.supplier_code,
          // 货源相关
          source_type: product.source_type || 1,
          supplier_id: product.supplier_id,
          purchase_price: product.purchase_price,
          production_cost: product.production_cost
        });
        
        // 设置货源类型状态
        setSourceType(product.source_type || 1);
        
        // 加载图片
        if (product.main_images) {
          try {
            const imgs = typeof product.main_images === 'string' 
              ? JSON.parse(product.main_images) 
              : product.main_images;
            setImages(imgs.map((url, index) => ({
              key: index,
              url,
              imageType: 1
            })));
          } catch (e) {
            console.error('解析图片失败:', e);
          }
        }
        
        // 加载SKC列表（包含SKU）
        if (product.skcs && product.skcs.length > 0) {
          setSkcList(product.skcs.map(skc => ({
            ...skc,
            key: skc.id || Date.now() + Math.random(),
            skus: skc.skus?.map(sku => ({
              ...sku,
              key: sku.id || Date.now() + Math.random()
            })) || []
          })));
        }
        
        // 加载孤立SKU列表（兼容旧数据）
        if (product.orphanSkus && product.orphanSkus.length > 0) {
          setSkuList(product.orphanSkus.map(sku => ({
            ...sku,
            key: sku.id || Date.now() + Math.random()
          })));
        } else if (product.skus && product.skus.length > 0) {
          setSkuList(product.skus.map(sku => ({
            ...sku,
            key: sku.id || Date.now() + Math.random()
          })));
        }
      } else {
        message.error(data.message || '获取商品详情失败');
      }
    } catch (error) {
      console.error('获取商品详情失败:', error);
      message.error('获取商品详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    setSaving(true);
    try {
      // 构建提交数据
      const submitData = {
        ...values,
        main_images: images.map(img => img.url),
        skus: skuList.map(sku => ({
          sku_code: sku.sku_code,
          supplier_sku: sku.supplier_sku,
          color: sku.color,
          size: sku.size,
          stock_quantity: sku.stock_quantity,
          cost_price: sku.cost_price,
          sale_price: sku.sale_price,
          supply_price: sku.supply_price,
          weight: sku.weight,
          barcode: sku.barcode,
          sku_image: sku.sku_image
        }))
      };

      const url = isEdit ? `/api/erp-products/${id}` : '/api/erp-products';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submitData)
      });

      const data = await response.json();

      if (data.success) {
        if (isEdit) {
          message.success('更新成功');
        } else {
          // 创建成功，显示生成的编号
          const productCode = data.data?.product_code;
          message.success(`创建成功！商品编号: ${productCode}`);
        }
        navigate('/erp-products');
      } else {
        message.error(data.message || '操作失败');
      }
    } catch (error) {
      console.error('操作失败:', error);
      message.error('操作失败');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    navigate('/erp-products');
  };

  // SKU相关操作
  const handleAddSku = () => {
    setEditingSku(null);
    skuForm.resetFields();
    setSkuModalVisible(true);
  };

  const handleEditSku = (record) => {
    setEditingSku(record);
    skuForm.setFieldsValue(record);
    setSkuModalVisible(true);
  };

  const handleDeleteSku = (key) => {
    setSkuList(skuList.filter(sku => sku.key !== key));
  };

  const handleSkuSubmit = (values) => {
    if (editingSku) {
      // 编辑
      setSkuList(skuList.map(sku => 
        sku.key === editingSku.key ? { ...sku, ...values } : sku
      ));
    } else {
      // 新增
      setSkuList([...skuList, { ...values, key: Date.now() }]);
    }
    setSkuModalVisible(false);
  };

  const skuColumns = [
    {
      title: 'SKU编码',
      dataIndex: 'sku_code',
      key: 'sku_code',
      width: 150
    },
    {
      title: '商家SKU',
      dataIndex: 'supplier_sku',
      key: 'supplier_sku',
      width: 150
    },
    {
      title: '颜色',
      dataIndex: 'color',
      key: 'color',
      width: 100
    },
    {
      title: '尺码',
      dataIndex: 'size',
      key: 'size',
      width: 80
    },
    {
      title: '库存',
      dataIndex: 'stock_quantity',
      key: 'stock_quantity',
      width: 80
    },
    {
      title: '成本价',
      dataIndex: 'cost_price',
      key: 'cost_price',
      width: 100,
      render: (text) => text ? `¥${text}` : '-'
    },
    {
      title: '销售价',
      dataIndex: 'sale_price',
      key: 'sale_price',
      width: 100,
      render: (text) => text ? `¥${text}` : '-'
    },
    {
      title: '供货价',
      dataIndex: 'supply_price',
      key: 'supply_price',
      width: 100,
      render: (text) => text ? `¥${text}` : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditSku(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteSku(record.key)}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '0' }}>
      {/* 顶部操作栏 */}
      <div style={{ 
        marginBottom: '16px', 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
            返回列表
          </Button>
          <span style={{ fontSize: '18px', fontWeight: 'bold', marginLeft: '16px' }}>
            {isEdit ? '编辑ERP商品' : '创建ERP商品'}
          </span>
        </Space>
        <Space>
          <Button onClick={handleBack}>取消</Button>
          <Button 
            type="primary" 
            icon={<SaveOutlined />}
            loading={saving}
            onClick={() => form.submit()}
          >
            {isEdit ? '保存修改' : '创建商品'}
          </Button>
        </Space>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{ currency: 'CNY' }}
      >
        <Tabs defaultActiveKey="basic" type="card">
          {/* 基本信息 */}
          <TabPane tab="基本信息" key="basic">
            <Card title="商品基本信息" style={{ marginBottom: '16px' }}>
              <Row gutter={24}>
                <Col span={8}>
                  <Form.Item
                    name="product_code"
                    label="商品编码"
                    tooltip={isEdit ? '编码不可修改' : '创建时自动生成XT开头的唯一编号'}
                  >
                    <Input 
                      placeholder={isEdit ? '' : '自动生成(XT开头)'} 
                      disabled 
                      style={{ backgroundColor: '#f5f5f5' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="supplier_code"
                    label="商家编码"
                  >
                    <Input placeholder="请输入商家/供应商编码" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="currency"
                    label="币种"
                  >
                    <Select>
                      <Select.Option value="CNY">CNY (人民币)</Select.Option>
                      <Select.Option value="USD">USD (美元)</Select.Option>
                      <Select.Option value="EUR">EUR (欧元)</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item
                    name="product_name_cn"
                    label="商品名称（中文）"
                    rules={[{ required: true, message: '请输入中文名称' }]}
                  >
                    <Input placeholder="请输入中文名称" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="product_name_en"
                    label="商品名称（英文）"
                    rules={[{ required: true, message: '请输入英文名称' }]}
                  >
                    <Input placeholder="请输入英文名称" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="product_desc"
                label="商品描述"
              >
                <TextArea rows={4} placeholder="请输入商品描述" />
              </Form.Item>
            </Card>

            <Card title="品牌与分类" style={{ marginBottom: '16px' }}>
              <Row gutter={24}>
                <Col span={8}>
                  <Form.Item name="brand" label="品牌名称">
                    <Input placeholder="请输入品牌名称" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="brand_code" label="品牌编码(SHEIN)">
                    <Input placeholder="SHEIN品牌编码" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="brand_id" label="品牌ID(TikTok)">
                    <Input placeholder="TikTok品牌ID" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item name="category" label="分类名称">
                    <Input placeholder="请输入分类名称" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="category_id" label="分类ID">
                    <Input placeholder="末级分类ID" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item name="warehouse_id" label="仓库ID">
                    <Input placeholder="仓库ID" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="warehouse_name" label="仓库名称">
                    <Input placeholder="仓库名称" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* 货源设置 */}
            <Card title="货源设置" style={{ marginBottom: '16px' }}>
              <Row gutter={24}>
                <Col span={8}>
                  <Form.Item 
                    name="source_type" 
                    label="货源类型"
                    rules={[{ required: true, message: '请选择货源类型' }]}
                  >
                    <Select 
                      placeholder="请选择货源类型"
                      onChange={(value) => setSourceType(value)}
                    >
                      <Select.Option value={1}>🏭 自生产</Select.Option>
                      <Select.Option value={2}>🚚 厂家调货</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                
                {sourceType === 2 && (
                  <Col span={8}>
                    <Form.Item 
                      name="supplier_id" 
                      label="选择厂家"
                      rules={[{ required: sourceType === 2, message: '请选择厂家' }]}
                    >
                      <Select 
                        placeholder="请选择厂家"
                        showSearch
                        optionFilterProp="children"
                        filterOption={(input, option) =>
                          (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                      >
                        {suppliers.map(supplier => (
                          <Select.Option key={supplier.id} value={supplier.id}>
                            {supplier.supplier_name} ({supplier.supplier_code})
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                )}
                
                {sourceType === 2 && (
                  <Col span={8}>
                    <Form.Item name="purchase_price" label="采购成本价">
                      <InputNumber 
                        min={0} 
                        step={0.01} 
                        placeholder="从厂家采购的价格" 
                        style={{ width: '100%' }}
                        prefix="¥"
                      />
                    </Form.Item>
                  </Col>
                )}
                
                {sourceType === 1 && (
                  <Col span={8}>
                    <Form.Item name="production_cost" label="生产成本价">
                      <InputNumber 
                        min={0} 
                        step={0.01} 
                        placeholder="自生产的成本" 
                        style={{ width: '100%' }}
                        prefix="¥"
                      />
                    </Form.Item>
                  </Col>
                )}
              </Row>
              
              {sourceType === 2 && suppliers.length === 0 && (
                <div style={{ 
                  padding: '12px', 
                  background: '#fff7e6', 
                  border: '1px solid #ffd591', 
                  borderRadius: '4px',
                  marginTop: '8px'
                }}>
                  <span style={{ color: '#d46b08' }}>
                    ⚠️ 暂无厂家数据，请先到 <a href="/suppliers" target="_blank">厂家管理</a> 添加厂家信息
                  </span>
                </div>
              )}
            </Card>

            <Card title="价格信息">
              <Row gutter={24}>
                <Col span={8}>
                  <Form.Item name="cost_price" label="综合成本价">
                    <InputNumber 
                      min={0} 
                      step={0.01} 
                      placeholder="综合成本价" 
                      style={{ width: '100%' }}
                      prefix="¥"
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="suggested_price" label="建议零售价">
                    <InputNumber 
                      min={0} 
                      step={0.01} 
                      placeholder="建议零售价" 
                      style={{ width: '100%' }}
                      prefix="¥"
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </TabPane>


          {/* 规格尺寸 */}
          <TabPane tab="规格尺寸" key="dimensions">
            <Card title="商品尺寸" style={{ marginBottom: '16px' }}>
              <Row gutter={24}>
                <Col span={6}>
                  <Form.Item name="weight" label="重量(g)">
                    <InputNumber min={0} placeholder="重量" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="length" label="长度(cm)">
                    <InputNumber min={0} step={0.1} placeholder="长度" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="width" label="宽度(cm)">
                    <InputNumber min={0} step={0.1} placeholder="宽度" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="height" label="高度(cm)">
                    <InputNumber min={0} step={0.1} placeholder="高度" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card title="包裹尺寸">
              <Row gutter={24}>
                <Col span={6}>
                  <Form.Item name="package_weight" label="包裹重量(g)">
                    <InputNumber min={0} placeholder="包裹重量" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="package_length" label="包裹长度(cm)">
                    <InputNumber min={0} step={0.1} placeholder="包裹长度" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="package_width" label="包裹宽度(cm)">
                    <InputNumber min={0} step={0.1} placeholder="包裹宽度" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="package_height" label="包裹高度(cm)">
                    <InputNumber min={0} step={0.1} placeholder="包裹高度" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </TabPane>

          {/* 商品图片 */}
          <TabPane tab="商品图片" key="images">
            <Card title="商品图片">
              <ImageUploadSection images={images} setImages={setImages} />
            </Card>
          </TabPane>

          {/* SKC/SKU管理 */}
          <TabPane tab="SKC/SKU管理" key="skus">
            {/* SKC列表 */}
            {skcList.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                {skcList.map((skc, skcIndex) => (
                  <Card 
                    key={skc.key}
                    title={
                      <Space>
                        <span>SKC: {skc.skc_code}</span>
                        {skc.color && <span style={{ color: '#666' }}>({skc.color})</span>}
                      </Space>
                    }
                    style={{ marginBottom: 16 }}
                    size="small"
                  >
                    {/* SKC图片展示 */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontWeight: 500, marginBottom: 8 }}>SKC图片:</div>
                      <Space wrap>
                        {skc.main_image && (
                          <div style={{ textAlign: 'center' }}>
                            <Image
                              src={skc.main_image}
                              alt="主图"
                              width={80}
                              height={80}
                              style={{ objectFit: 'cover', borderRadius: 4 }}
                            />
                            <div style={{ fontSize: 12, color: '#999' }}>主图</div>
                          </div>
                        )}
                        {skc.images && Array.isArray(skc.images) && skc.images.map((img, imgIndex) => (
                          <div key={imgIndex} style={{ textAlign: 'center' }}>
                            <Image
                              src={typeof img === 'string' ? img : img.imageUrl || img.image_url}
                              alt={`图片${imgIndex + 1}`}
                              width={80}
                              height={80}
                              style={{ objectFit: 'cover', borderRadius: 4 }}
                            />
                            <div style={{ fontSize: 12, color: '#999' }}>图{imgIndex + 1}</div>
                          </div>
                        ))}
                      </Space>
                    </div>
                    
                    {/* SKC下的SKU列表 */}
                    <Table
                      columns={[
                        { title: 'SKU编码', dataIndex: 'sku_code', width: 150 },
                        { title: '商家SKU', dataIndex: 'supplier_sku', width: 120 },
                        { title: '尺码', dataIndex: 'size', width: 80 },
                        { title: '成本价', dataIndex: 'cost_price', width: 100, render: (v) => v ? `¥${v}` : '-' },
                        { title: '销售价', dataIndex: 'sale_price', width: 100, render: (v) => v ? `¥${v}` : '-' },
                        { 
                          title: 'SKU图片', 
                          dataIndex: 'sku_image', 
                          width: 100,
                          render: (img) => img ? (
                            <Image src={img} alt="SKU图" width={50} height={50} style={{ objectFit: 'cover' }} />
                          ) : '-'
                        }
                      ]}
                      dataSource={skc.skus}
                      rowKey="key"
                      pagination={false}
                      size="small"
                    />
                  </Card>
                ))}
              </div>
            )}
            
            {/* 孤立SKU列表（兼容旧数据） */}
            <Card 
              title="SKU列表"
              extra={
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAddSku}>
                  添加SKU
                </Button>
              }
            >
              <Table
                columns={skuColumns}
                dataSource={skuList}
                rowKey="key"
                pagination={false}
                scroll={{ x: 1000 }}
                locale={{ emptyText: '暂无独立SKU' }}
              />
            </Card>
          </TabPane>
        </Tabs>
      </Form>

      {/* SKU编辑弹窗 */}
      <Modal
        title={editingSku ? '编辑SKU' : '添加SKU'}
        open={skuModalVisible}
        onCancel={() => setSkuModalVisible(false)}
        onOk={() => skuForm.submit()}
        width={700}
        destroyOnClose
      >
        <Form
          form={skuForm}
          layout="vertical"
          onFinish={handleSkuSubmit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="sku_code"
                label="SKU编码"
                rules={[{ required: true, message: '请输入SKU编码' }]}
              >
                <Input placeholder="请输入SKU编码" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="supplier_sku" label="商家SKU">
                <Input placeholder="商家SKU编码" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="color" label="颜色">
                <Input placeholder="颜色" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="size" label="尺码">
                <Input placeholder="尺码" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="stock_quantity" label="库存数量">
                <InputNumber min={0} placeholder="库存" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="cost_price" label="成本价">
                <InputNumber min={0} step={0.01} placeholder="成本价" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="sale_price" label="销售价">
                <InputNumber min={0} step={0.01} placeholder="销售价" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="supply_price" label="供货价">
                <InputNumber min={0} step={0.01} placeholder="供货价" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="weight" label="重量(g)">
                <InputNumber min={0} placeholder="重量" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="barcode" label="条码">
                <Input placeholder="商品条码" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="sku_image" label="SKU图片URL">
                <Input placeholder="SKU图片URL" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}

// 图片上传组件
function ImageUploadSection({ images, setImages }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file, imageType) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('imageType', imageType);

      const response = await fetch('/api/images/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setImages([...images, {
          ...data.data,
          key: Date.now(),
          imageType
        }]);
        message.success('上传成功');
      } else {
        message.error(data.message || '上传失败');
      }
    } catch (error) {
      console.error('上传失败:', error);
      message.error('上传失败');
    } finally {
      setUploading(false);
    }

    return false;
  };

  const handleDelete = async (image) => {
    try {
      if (image.filename) {
        const response = await fetch(`/api/images/${image.filename}`, {
          method: 'DELETE'
        });
        const data = await response.json();
        if (!data.success) {
          console.warn('删除服务器图片失败:', data.message);
        }
      }
      setImages(images.filter(img => img.key !== image.key));
      message.success('删除成功');
    } catch (error) {
      console.error('删除失败:', error);
      setImages(images.filter(img => img.key !== image.key));
    }
  };

  const imageTypes = [
    { type: 1, label: '主图', icon: '🖼️', desc: '商品主图/轮播图' },
    { type: 2, label: '细节图', icon: '🔍', desc: '商品细节展示' },
    { type: 5, label: '方块图', icon: '⬜', desc: '1:1比例图片' },
    { type: 6, label: '色块图', icon: '🎨', desc: '颜色展示图' }
  ];

  return (
    <div>
      <Row gutter={16}>
        {imageTypes.map((typeConfig) => {
          const typeImages = images.filter(img => img.imageType === typeConfig.type);

          return (
            <Col span={6} key={typeConfig.type}>
              <div
                style={{
                  border: '1px solid #e8e8e8',
                  borderRadius: '8px',
                  padding: '16px',
                  backgroundColor: '#fafafa',
                  minHeight: '300px'
                }}
              >
                <div style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#333',
                  textAlign: 'center',
                  marginBottom: '8px'
                }}>
                  {typeConfig.icon} {typeConfig.label}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#999',
                  textAlign: 'center',
                  marginBottom: '12px'
                }}>
                  {typeConfig.desc}
                </div>

                <Upload
                  beforeUpload={(file) => handleUpload(file, typeConfig.type)}
                  accept="image/*"
                  showUploadList={false}
                  disabled={uploading}
                >
                  <Button
                    type="dashed"
                    block
                    icon={<UploadOutlined />}
                    loading={uploading}
                  >
                    点击上传
                  </Button>
                </Upload>

                <div style={{
                  marginTop: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  {typeImages.map((img) => (
                    <div
                      key={img.key}
                      style={{
                        position: 'relative',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        border: '1px solid #d9d9d9',
                        backgroundColor: '#fff'
                      }}
                    >
                      <Image
                        src={img.thumbnailUrl || img.url}
                        alt="商品图片"
                        style={{
                          width: '100%',
                          height: '80px',
                          objectFit: 'cover',
                          display: 'block'
                        }}
                        preview={{ src: img.url }}
                      />
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          backgroundColor: 'rgba(0, 0, 0, 0.5)',
                          color: '#fff',
                          border: 'none'
                        }}
                        onClick={() => handleDelete(img)}
                      />
                    </div>
                  ))}
                </div>

                {typeImages.length > 0 && (
                  <div style={{
                    fontSize: '12px',
                    color: '#999',
                    textAlign: 'center',
                    marginTop: '8px'
                  }}>
                    已上传 {typeImages.length} 张
                  </div>
                )}
              </div>
            </Col>
          );
        })}
      </Row>

      <div style={{
        marginTop: '16px',
        fontSize: '12px',
        color: '#999',
        textAlign: 'center'
      }}>
        支持jpg、png、gif、webp格式，单张图片最大10MB
      </div>
    </div>
  );
}

export default ERPProductEdit;
