import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Select,
  Space,
  Divider,
  Row,
  Col,
  Checkbox,
  message,
  Upload
} from 'antd';
import { ArrowLeftOutlined, UploadOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';

const { Option } = Select;

function PublishByPlatform() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);

  // 从URL参数中获取平台信息
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const platformParam = searchParams.get('platform');
    const platformNameParam = searchParams.get('platformName');
    
    if (platformParam) {
      console.log('从URL获取到平台参数:', platformParam);
      
      // 平台名称映射
      const platformMap = {
        'shein': 'shein',
        'shein_full': 'shein',
        'shein_semi': 'shein',
        'temu': 'temu',
        'tiktok': 'tiktok',
        'amazon': 'amazon',
        'ebay': 'ebay'
      };
      
      const mappedPlatform = platformMap[platformParam];
      if (mappedPlatform) {
        setSelectedPlatforms([mappedPlatform]);
        form.setFieldsValue({ platforms: [mappedPlatform] });
        
        // 设置页面标题
        const displayName = platformNameParam || platformParam.toUpperCase();
        document.title = `协途 - ${displayName}商品刊登`;
        
        // 显示提示信息
        message.info(`已自动选择平台: ${displayName}`, 3);
      }
    } else {
      // 默认标题
      document.title = '协途 - 按平台刊登';
    }
  }, [location, form]);

  const handlePlatformChange = (platforms) => {
    setSelectedPlatforms(platforms);
  };

  const handleUpload = async (file, imageType) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('请上传图片文件');
      return false;
    }

    const isLt3M = file.size / 1024 / 1024 < 3;
    if (!isLt3M) {
      message.error('图片大小不能超过3MB');
      return false;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const imageUrl = reader.result;
        setImages([...images, {
          key: Date.now(),
          type: imageType,
          url: imageUrl,
          name: file.name,
          size: file.size
        }]);
        message.success('图片添加成功');
      } catch (error) {
        message.error('处理图片失败: ' + error.message);
      }
    };
    reader.readAsDataURL(file);
    return false;
  };

  const handleSubmit = async (values) => {
    if (selectedPlatforms.length === 0) {
      message.error('请至少选择一个发布平台');
      return;
    }

    setLoading(true);
    try {
      // TODO: 实现发布逻辑
      console.log('发布数据:', values);
      message.success('商品发布成功！');
      form.resetFields();
      setImages([]);
    } catch (error) {
      message.error('发布失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 获取页面标题
  const getPageTitle = () => {
    const searchParams = new URLSearchParams(location.search);
    const platformNameParam = searchParams.get('platformName');
    
    if (platformNameParam) {
      return `${platformNameParam} - 商品刊登`;
    }
    
    if (selectedPlatforms.length === 1) {
      const platformNames = {
        'shein': 'SHEIN',
        'temu': 'TEMU',
        'tiktok': 'TikTok',
        'amazon': 'Amazon',
        'ebay': 'eBay'
      };
      return `${platformNames[selectedPlatforms[0]]} - 商品刊登`;
    }
    
    return '按平台刊登';
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
            <span>{getPageTitle()}</span>
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

          {/* 基本信息 */}
          <Divider>基本信息</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="productNameEn"
                label="商品名称（英文）"
                rules={[{ required: true, message: '请输入商品名称' }]}
              >
                <Input placeholder="输入英文商品名称" maxLength={1000} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="productNameCn"
                label="商品名称（中文）"
              >
                <Input placeholder="输入中文商品名称（可选）" maxLength={1000} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="productDesc"
            label="商品描述"
          >
            <Input.TextArea
              placeholder="输入商品描述"
              rows={4}
              maxLength={5000}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="price"
                label="价格"
                rules={[{ required: true, message: '请输入价格' }]}
              >
                <Input type="number" placeholder="0.00" prefix="¥" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="stock"
                label="库存"
                rules={[{ required: true, message: '请输入库存' }]}
              >
                <Input type="number" placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="sku"
                label="SKU"
              >
                <Input placeholder="输入SKU编码" />
              </Form.Item>
            </Col>
          </Row>

          {/* 图片上传 */}
          <Divider>商品图片</Divider>
          <ImageUploadSection images={images} onUpload={handleUpload} />

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
                  <Form.Item name="sheinCategory" label="分类">
                    <Select placeholder="请选择分类">
                      <Option value="1">女装</Option>
                      <Option value="2">男装</Option>
                    </Select>
                  </Form.Item>
                </Card>
              )}

              {selectedPlatforms.includes('temu') && (
                <Card title="TEMU配置" size="small" style={{ marginBottom: 16 }}>
                  <Form.Item name="temuCategory" label="分类">
                    <Select placeholder="请选择分类">
                      <Option value="1">服装</Option>
                      <Option value="2">配饰</Option>
                    </Select>
                  </Form.Item>
                </Card>
              )}

              {selectedPlatforms.includes('tiktok') && (
                <Card title="TikTok配置" size="small" style={{ marginBottom: 16 }}>
                  <Form.Item name="tiktokCategory" label="分类">
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
              >
                发布到所选平台
              </Button>
              <Button
                size="large"
                onClick={() => {
                  form.resetFields();
                  setImages([]);
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

// 图片上传区域组件
function ImageUploadSection({ images, onUpload }) {
  const imageTypes = [
    { type: 1, label: '主图', icon: '🖼️' },
    { type: 2, label: '细节图', icon: '🔍' },
    { type: 5, label: '方块图', icon: '⬜' },
    { type: 6, label: '色块图', icon: '🎨' }
  ];

  return (
    <div style={{
      display: 'flex',
      gap: '12px',
      overflowX: 'auto',
      paddingBottom: '8px'
    }}>
      {imageTypes.map((typeConfig) => {
        const typeImages = images.filter(img => img.type === typeConfig.type);

        return (
          <div
            key={typeConfig.type}
            style={{
              minWidth: '140px',
              border: '1px solid #e8e8e8',
              borderRadius: '8px',
              padding: '12px',
              backgroundColor: '#fafafa'
            }}
          >
            <div style={{
              fontSize: '13px',
              fontWeight: '500',
              textAlign: 'center',
              marginBottom: '8px'
            }}>
              {typeConfig.icon} {typeConfig.label}
            </div>
            <Upload
              beforeUpload={(file) => onUpload(file, typeConfig.type)}
              accept="image/*"
              showUploadList={false}
            >
              <Button
                type="dashed"
                block
                size="small"
                icon={<UploadOutlined />}
              >
                点击上传
              </Button>
            </Upload>
            {typeImages.length > 0 && (
              <div style={{ marginTop: '8px', fontSize: '11px', color: '#999', textAlign: 'center' }}>
                已上传 {typeImages.length} 张
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default PublishByPlatform;
