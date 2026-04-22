import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { message, Steps, Button, Form, Input, Select, InputNumber, Upload, Card, Space, Divider, Spin, Modal } from 'antd';
import { PlusOutlined, DeleteOutlined, UploadOutlined, SaveOutlined, SendOutlined } from '@ant-design/icons';
import axios from 'axios';
import CryptoJS from 'crypto-js';

const { Step } = Steps;
const { TextArea } = Input;
const { Option } = Select;

const PlatformSheinFullListed = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();
  
  // 状态管理
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryPath, setCategoryPath] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [sizeAttributes, setSizeAttributes] = useState([]);
  const [salesAttributes, setSalesAttributes] = useState([]);
  const [publishStandard, setPublishStandard] = useState(null);
  const [platforms, setPlatforms] = useState([]);
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [skcList, setSkcList] = useState([{ key: 0, skuList: [{ key: 0 }] }]);
  const [imageUploading, setImageUploading] = useState(false);

  // 从路由获取选择的产品信息
  const selectedProduct = location.state?.product;

  useEffect(() => {
    loadPlatforms();
  }, []);

  // 加载平台列表
  const loadPlatforms = async () => {
    try {
      const response = await axios.get('/api/platforms');
      const platformData = response.data.data || response.data || [];
      const sheinPlatforms = platformData.filter(p => 
        (p.platform_name === 'SHEIN' || p.platform === 'SHEIN') && 
        (p.status === 'active' || p.status === 'connected')
      );
      setPlatforms(sheinPlatforms);
      if (sheinPlatforms.length > 0) {
        setSelectedPlatform(sheinPlatforms[0]);
      } else {
        message.warning('未找到已激活的SHEIN平台，请先在平台管理中配置');
      }
    } catch (error) {
      console.error('加载平台失败:', error);
      message.error('加载平台失败: ' + (error.response?.data?.message || error.message));
    }
  };

  // 生成SHEIN签名
  const generateSheinSignature = (openKeyId, secretKey, path, timestamp, randomKey) => {
    const value = `${openKeyId}&${timestamp}&${path}`;
    const key = `${secretKey}${randomKey}`;
    const hexSignature = CryptoJS.HmacSHA256(value, key).toString();
    const base64Signature = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(hexSignature));
    return `${randomKey}${base64Signature}`;
  };

  // 生成随机字符串
  const generateRandomKey = (length = 5) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // 调用SHEIN API（通过后端代理）
  const callSheinAPI = async (path, data = {}) => {
    if (!selectedPlatform) {
      throw new Error('未选择平台');
    }

    try {
      const response = await axios.post('/api/shein-full-api/proxy', {
        apiPath: path,
        data: data,
        platformConfig: {
          app_key: selectedPlatform.app_key || selectedPlatform.open_key_id,
          app_secret: selectedPlatform.app_secret || selectedPlatform.secret_key,
          api_url: selectedPlatform.api_url
        }
      });

      if (response.data.code !== '0') {
        throw new Error(response.data.msg || '接口调用失败');
      }

      return response.data;
    } catch (error) {
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  };

  // 加载分类树
  const loadCategories = async () => {
    setLoading(true);
    try {
      const result = await callSheinAPI('/open-api/goods/query-category-tree');
      setCategories(result.info.data || []);
    } catch (error) {
      message.error('加载分类失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 加载商品发布规范
  const loadPublishStandard = async (categoryId) => {
    setLoading(true);
    try {
      const result = await callSheinAPI('/open-api/goods/query-publish-fill-in-standard', {
        category_id: categoryId
      });
      setPublishStandard(result.info);
      return result.info;
    } catch (error) {
      message.error('加载发布规范失败: ' + error.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // 加载商品属性
  const loadAttributes = async (categoryId, productTypeId) => {
    console.log('loadAttributes 调用参数:', { categoryId, productTypeId });
    
    if (!productTypeId) {
      message.error('product_type_id 参数缺失');
      return null;
    }
    
    setLoading(true);
    try {
      // 注意：API要求的是 product_type_id_list 数组
      const result = await callSheinAPI('/open-api/goods/query-attribute-template', {
        product_type_id_list: [productTypeId]
      });
      
      // API返回的数据结构：info.data 是数组，每个元素包含 attribute_infos
      const dataList = result.info.data || [];
      if (dataList.length === 0) {
        message.warning('该分类下没有可用属性');
        return null;
      }
      
      const attrData = dataList[0].attribute_infos || [];
      console.log('加载到的属性数量:', attrData.length);
      
      // 分类属性
      const productAttrs = attrData.filter(attr => attr.attribute_type === 3 || attr.attribute_type === 4);
      const sizeAttrs = attrData.filter(attr => attr.attribute_type === 2);
      const saleAttrs = attrData.filter(attr => attr.attribute_type === 1);
      
      console.log('商品属性:', productAttrs.length, '尺寸属性:', sizeAttrs.length, '销售属性:', saleAttrs.length);
      
      setAttributes(productAttrs);
      setSizeAttributes(sizeAttrs);
      setSalesAttributes(saleAttrs);
      
      return { productAttrs, sizeAttrs, saleAttrs };
    } catch (error) {
      console.error('加载属性失败:', error);
      message.error('加载属性失败: ' + error.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // 查找分类路径
  const findCategoryPath = (categories, targetId, path = []) => {
    for (const cat of categories) {
      const currentPath = [...path, { id: cat.category_id, name: cat.category_name }];
      if (cat.category_id === targetId) {
        return currentPath;
      }
      if (cat.children && cat.children.length > 0) {
        const found = findCategoryPath(cat.children, targetId, currentPath);
        if (found) return found;
      }
    }
    return null;
  };

  // 分类选择变化
  const handleCategorySelect = async (category) => {
    if (!category.last_category) {
      message.warning('请选择末级分类');
      return;
    }
    
    setSelectedCategory(category);
    const path = findCategoryPath(categories, category.category_id);
    setCategoryPath(path || []);
    
    // 设置表单值
    form.setFieldsValue({
      category_id: category.category_id,
      product_type_id: category.product_type_id
    });
  };

  // 图片上传转换
  const handleImageUpload = async (file, imageType) => {
    setImageUploading(true);
    try {
      // 先上传到本地服务器
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await axios.post('/api/images/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (!uploadRes.data.success) {
        throw new Error(uploadRes.data.error || '图片上传失败');
      }
      
      const imageUrl = uploadRes.data.url;

      // 转换为SHEIN格式
      const result = await callSheinAPI('/open-api/goods/transform-pic', {
        image_type: imageType,
        original_url: imageUrl
      });

      if (result.info.transformed) {
        message.success('图片上传成功');
        return result.info.transformed;
      } else {
        throw new Error(result.info.failure_reason || '图片转换失败');
      }
    } catch (error) {
      console.error('图片上传失败:', error);
      message.error('图片上传失败: ' + error.message);
      return null;
    } finally {
      setImageUploading(false);
    }
  };

  // 渲染分类选择器
  const renderCategorySelector = (categoryList, level = 0) => {
    return categoryList.map(cat => {
      if (cat.last_category) {
        return (
          <Option key={cat.category_id} value={cat.category_id}>
            {'　'.repeat(level)}{cat.category_name}
          </Option>
        );
      } else {
        return [
          <Option key={cat.category_id} value={cat.category_id} disabled>
            {'　'.repeat(level)}{cat.category_name}
          </Option>,
          cat.children && renderCategorySelector(cat.children, level + 1)
        ];
      }
    });
  };

  // 检查字段是否必填
  const isFieldRequired = (fieldKey) => {
    if (!publishStandard || !publishStandard.fill_in_standard_list) return false;
    const field = publishStandard.fill_in_standard_list.find(f => f.field_key === fieldKey);
    return field ? field.required : false;
  };

  // 检查字段是否可显示
  const isFieldShow = (fieldKey) => {
    if (!publishStandard || !publishStandard.fill_in_standard_list) return true;
    const field = publishStandard.fill_in_standard_list.find(f => f.field_key === fieldKey);
    return field ? field.show : true;
  };

  // 添加SKC
  const addSkc = () => {
    const newKey = skcList.length;
    setSkcList([...skcList, { key: newKey, skuList: [{ key: 0 }] }]);
  };

  // 删除SKC
  const removeSkc = (skcKey) => {
    if (skcList.length === 1) {
      message.warning('至少保留一个SKC');
      return;
    }
    setSkcList(skcList.filter(skc => skc.key !== skcKey));
  };

  // 添加SKU
  const addSku = (skcKey) => {
    setSkcList(skcList.map(skc => {
      if (skc.key === skcKey) {
        const newSkuKey = skc.skuList.length;
        return { ...skc, skuList: [...skc.skuList, { key: newSkuKey }] };
      }
      return skc;
    }));
  };

  // 删除SKU
  const removeSku = (skcKey, skuKey) => {
    setSkcList(skcList.map(skc => {
      if (skc.key === skcKey) {
        if (skc.skuList.length === 1) {
          message.warning('至少保留一个SKU');
          return skc;
        }
        return { ...skc, skuList: skc.skuList.filter(sku => sku.key !== skuKey) };
      }
      return skc;
    }));
  };

  // 保存草稿
  const saveDraft = async () => {
    try {
      // 获取表单所有字段值，不进行验证
      const values = form.getFieldsValue(true);
      
      // 构建草稿数据，匹配后端API要求的字段
      const productName = values.product_name || selectedCategory?.category_name || '未命名商品';
      const draftTitle = `${productName} - ${new Date().toLocaleString('zh-CN')}`;
      
      const draftData = {
        title: draftTitle, // 自动生成标题
        draftType: 'platform', // 自动设置为"按平台刊登"
        productNameEn: values.product_name,
        productNameCn: values.product_name,
        productDesc: values.product_description,
        platforms: [selectedPlatform?.platform_name || 'SHEIN'],
        platformConfigs: {
          platform_id: selectedPlatform?.id,
          platform_name: selectedPlatform?.platform_name || 'SHEIN',
          category_id: selectedCategory?.category_id,
          category_name: selectedCategory?.category_name,
          product_type_id: selectedCategory?.product_type_id
        },
        draftData: {
          ...values,
          selectedCategory,
          categoryPath,
          currentStep,
          selectedPlatform
        }
      };

      await axios.post('/api/publish-drafts', draftData);
      message.success('草稿保存成功，可在草稿箱中查看');
    } catch (error) {
      console.error('保存草稿失败:', error);
      message.error('保存草稿失败: ' + (error.response?.data?.message || error.message));
    }
  };

  // 提交发布
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // 构建发布数据
      const publishData = {
        category_id: values.category_id,
        product_type_id: values.product_type_id,
        source_system: 'OpenAPI',
        suit_flag: '0',
        multi_language_name_list: [
          {
            language: publishStandard?.default_language || 'en',
            name: values.product_name
          }
        ],
        multi_language_desc_list: [
          {
            language: publishStandard?.default_language || 'en',
            name: values.product_description
          }
        ],
        shelf_way: values.shelf_way || '1',
        shelf_require: values.shelf_require || '0',
        skc_list: values.skc_list.map((skc, skcIndex) => ({
          supplier_code: skc.supplier_code,
          image_info: {
            image_info_list: skc.images || []
          },
          sale_attribute: skc.sale_attribute,
          sku_list: skc.sku_list.map(sku => ({
            supplier_sku: sku.supplier_sku,
            mall_state: sku.mall_state || 1,
            stop_purchase: sku.stop_purchase || 1,
            height: sku.height,
            width: sku.width,
            length: sku.length,
            weight: sku.weight,
            cost_info: {
              cost_price: sku.cost_price,
              currency: publishStandard?.currency || 'USD'
            },
            sale_attribute_list: sku.sale_attribute_list || [],
            stock_info_list: [{
              inventory_num: sku.inventory_num || 0
            }]
          }))
        }))
      };

      // 添加商品属性
      if (values.product_attributes) {
        publishData.product_attribute_list = values.product_attributes;
      }

      // 调用发布接口
      const result = await callSheinAPI('/open-api/goods/product/publishOrEdit', publishData);

      if (result.info.success) {
        message.success('商品发布成功');
        
        // 保存发布记录
        await axios.post('/api/publish-records', {
          platform_id: selectedPlatform.id,
          platform_name: 'SHEIN',
          spu_name: result.info.spu_name,
          product_data: JSON.stringify(publishData),
          publish_result: JSON.stringify(result.info),
          status: 'success'
        });

        navigate('/publish-records');
      } else {
        throw new Error('发布失败');
      }
    } catch (error) {
      message.error('发布失败: ' + error.message);
      
      // 保存失败记录
      try {
        await axios.post('/api/publish-records', {
          platform_id: selectedPlatform.id,
          platform_name: 'SHEIN',
          product_data: JSON.stringify(form.getFieldsValue()),
          error_message: error.message,
          status: 'failed'
        });
      } catch (e) {
        console.error('保存失败记录出错', e);
      }
    } finally {
      setLoading(false);
    }
  };

  // 多列级联选择状态
  const [cascadeColumns, setCascadeColumns] = useState([]);
  const [selectedPath, setSelectedPath] = useState([]);

  // 初始化第一列
  useEffect(() => {
    if (categories.length > 0 && cascadeColumns.length === 0) {
      setCascadeColumns([categories]);
    }
  }, [categories]);

  // 点击分类项
  const handleCascadeClick = (category, columnIndex) => {
    console.log('=== 点击分类 ===');
    console.log('分类对象:', category);
    console.log('category_id:', category.category_id);
    console.log('product_type_id:', category.product_type_id);
    console.log('last_category:', category.last_category);
    console.log('列索引:', columnIndex);
    
    // 更新选中路径
    const newPath = selectedPath.slice(0, columnIndex);
    newPath[columnIndex] = category;
    setSelectedPath(newPath);

    // 如果是末级分类，直接选择
    if (category.last_category) {
      if (!category.product_type_id || category.product_type_id === 0) {
        message.error(`该分类缺少有效的product_type_id (当前值: ${category.product_type_id})，请联系管理员`);
        console.error('分类数据不完整:', JSON.stringify(category, null, 2));
        return;
      }
      handleCategorySelect(category);
      
      // 更新列显示（保留到当前列）
      setCascadeColumns(cascadeColumns.slice(0, columnIndex + 1));
    } else if (category.children && category.children.length > 0) {
      // 如果有子分类，显示下一列
      const newColumns = cascadeColumns.slice(0, columnIndex + 1);
      newColumns.push(category.children);
      setCascadeColumns(newColumns);
    }
  };

  // 步骤0: 选择分类
  const renderCategorySelection = () => (
    <div>
      {/* 平台店铺选择 */}
      <Card style={{ marginBottom: 16 }}>
        <Form.Item
          label="平台店铺"
          name="platform_id"
          rules={[{ required: true, message: '请选择平台店铺' }]}
          initialValue={platforms.length > 0 ? platforms[0].id : undefined}
          style={{ marginBottom: 0 }}
        >
          <Select
            placeholder="选择SHEIN店铺"
            onChange={(value) => {
              const platform = platforms.find(p => p.id === value);
              setSelectedPlatform(platform);
              if (platform) {
                loadCategories();
              }
            }}
          >
            {platforms.map(p => (
              <Option key={p.id} value={p.id}>
                {p.shop_name || p.store_name || `${p.platform_name} - ${p.shop_code || p.id}`}
              </Option>
            ))}
          </Select>
        </Form.Item>
      </Card>

      {/* 商品分类选择 */}
      <Card title="商品分类" style={{ marginBottom: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin tip="加载分类中..." />
          </div>
        ) : categories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            请先选择店铺
          </div>
        ) : (
          <div>
            {/* 面包屑导航 */}
            {selectedPath.length > 0 && (
              <div style={{ 
                padding: '12px 16px', 
                backgroundColor: '#fafafa', 
                borderRadius: '4px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap'
              }}>
                {selectedPath.map((cat, index) => (
                  <span key={cat.category_id}>
                    <span style={{ color: index === selectedPath.length - 1 ? '#1890ff' : '#000' }}>
                      {cat.category_name}
                    </span>
                    {index < selectedPath.length - 1 && (
                      <span style={{ margin: '0 8px', color: '#999' }}>{'>'}</span>
                    )}
                  </span>
                ))}
              </div>
            )}

            {/* 多列级联选择 */}
            <div style={{ 
              display: 'flex',
              gap: '0',
              border: '1px solid #d9d9d9',
              borderRadius: '4px',
              overflow: 'hidden',
              minHeight: '400px',
              maxHeight: '500px'
            }}>
              {cascadeColumns.map((columnCategories, columnIndex) => (
                <div
                  key={columnIndex}
                  style={{
                    flex: '0 0 250px',
                    borderRight: columnIndex < cascadeColumns.length - 1 ? '1px solid #d9d9d9' : 'none',
                    overflowY: 'auto',
                    backgroundColor: '#fafafa'
                  }}
                >
                  {columnCategories.map(cat => {
                    const isSelected = selectedPath[columnIndex]?.category_id === cat.category_id;
                    const isInPath = selectedPath.some(p => p.category_id === cat.category_id);
                    
                    return (
                      <div
                        key={cat.category_id}
                        onClick={() => handleCascadeClick(cat, columnIndex)}
                        style={{
                          padding: '12px 16px',
                          cursor: 'pointer',
                          backgroundColor: isSelected ? '#e6f7ff' : '#fff',
                          borderBottom: '1px solid #f0f0f0',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = '#f5f5f5';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = '#fff';
                          }
                        }}
                      >
                        <span style={{ 
                          color: isSelected ? '#1890ff' : '#000',
                          fontWeight: isSelected ? '500' : 'normal',
                          fontSize: '14px'
                        }}>
                          {cat.category_name}
                        </span>
                        {!cat.last_category && (
                          <span style={{ fontSize: '12px', color: '#999' }}>
                            {'>'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* 已选分类提示 */}
            {selectedCategory && (
              <div style={{ 
                marginTop: '16px',
                padding: '12px 16px', 
                backgroundColor: '#f6ffed', 
                border: '1px solid #b7eb8f',
                borderRadius: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <span style={{ color: '#52c41a', marginRight: '8px' }}>✓</span>
                  <span style={{ fontWeight: 'bold' }}>已选择：</span>
                  <span style={{ marginLeft: '8px' }}>
                    {selectedCategory.category_name}
                  </span>
                </div>
                <Button 
                  type="link" 
                  size="small"
                  onClick={() => {
                    setSelectedCategory(null);
                    setCategoryPath([]);
                    setSelectedPath([]);
                    setCascadeColumns([categories]);
                  }}
                >
                  重新选择
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );

  // 步骤1: 基本信息
  const renderBasicInfo = () => (
    <Card title="基本信息" style={{ marginBottom: 16 }}>
      {selectedCategory && (
        <div style={{ 
          marginBottom: '16px', 
          padding: '12px', 
          backgroundColor: '#f0f5ff', 
          borderRadius: '4px',
          border: '1px solid #adc6ff'
        }}>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>已选分类</div>
          <div style={{ fontWeight: 'bold' }}>{categoryPath.map(c => c.name).join(' > ')}</div>
        </div>
      )}

      <Form.Item
        label="商品名称"
        name="product_name"
        rules={[{ required: true, message: '请输入商品名称' }]}
      >
        <Input placeholder="最多1000个字符，不支持emoji" maxLength={1000} />
      </Form.Item>

      <Form.Item
        label="商品描述"
        name="product_description"
      >
        <TextArea
          placeholder="最多5000个字符，不支持html和emoji"
          maxLength={5000}
          rows={4}
        />
      </Form.Item>

      {isFieldShow('brand_code') && (
        <Form.Item
          label="品牌"
          name="brand_code"
          rules={[{ required: isFieldRequired('brand_code'), message: '请选择品牌' }]}
        >
          <Select placeholder="选择品牌">
            {/* 品牌列表需要通过API获取 */}
          </Select>
        </Form.Item>
      )}

      {isFieldShow('skc_title') && (
        <Form.Item
          label="SKC标题"
          name="skc_title"
          rules={[{ required: isFieldRequired('skc_title'), message: '请输入SKC标题' }]}
        >
          <Input placeholder="SKC维度商品标题" />
        </Form.Item>
      )}
    </Card>
  );

  // 步骤2: 商品属性
  const renderProductAttributes = () => (
    <Card title="商品属性" style={{ marginBottom: 16 }}>
      {attributes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
          请先选择商品分类
        </div>
      ) : (
        attributes.map(attr => (
          <Form.Item
            key={attr.attribute_id}
            label={attr.attribute_name}
            name={['product_attributes', attr.attribute_id]}
            rules={[{
              required: attr.attribute_status === 3,
              message: `请选择${attr.attribute_name}`
            }]}
          >
            {attr.attribute_mode === 0 ? (
              <InputNumber placeholder="请输入正整数" min={1} style={{ width: '100%' }} />
            ) : attr.attribute_mode === 1 ? (
              <Select
                mode="multiple"
                placeholder={`最多选择${attr.attribute_input_num || '不限'}个`}
                maxTagCount={attr.attribute_input_num || undefined}
              >
                {attr.attribute_value_info_list?.map(val => (
                  <Option key={val.attribute_value_id} value={val.attribute_value_id}>
                    {val.attribute_value}
                  </Option>
                ))}
              </Select>
            ) : attr.attribute_mode === 3 ? (
              <Select placeholder="请选择">
                {attr.attribute_value_info_list?.map(val => (
                  <Option key={val.attribute_value_id} value={val.attribute_value_id}>
                    {val.attribute_value}
                  </Option>
                ))}
              </Select>
            ) : attr.attribute_mode === 4 ? (
              <Space.Compact style={{ width: '100%' }}>
                <Select placeholder="选择单位" style={{ width: '40%' }}>
                  {attr.attribute_value_info_list?.map(val => (
                    <Option key={val.attribute_value_id} value={val.attribute_value_id}>
                      {val.attribute_value}
                    </Option>
                  ))}
                </Select>
                <InputNumber placeholder="输入数值" min={1} style={{ width: '60%' }} />
              </Space.Compact>
            ) : null}
          </Form.Item>
        ))
      )}
    </Card>
  );

  // 步骤3: SKC/SKU信息
  const renderSkcSkuInfo = () => (
    <div>
      {skcList.map((skc, skcIndex) => (
        <Card
          key={skc.key}
          title={`SKC ${skcIndex + 1}`}
          extra={
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              onClick={() => removeSkc(skc.key)}
            >
              删除SKC
            </Button>
          }
          style={{ marginBottom: 16 }}
        >
          <Form.Item
            label="商家货号(SKC)"
            name={['skc_list', skcIndex, 'supplier_code']}
            rules={[{ required: true, message: '请输入商家货号' }]}
          >
            <Input placeholder="最多200个字符" maxLength={200} />
          </Form.Item>

          <Form.Item
            label="主销售属性"
            name={['skc_list', skcIndex, 'sale_attribute']}
            rules={[{ required: true, message: '请选择主销售属性' }]}
          >
            <Select placeholder="选择颜色等主销售属性">
              {salesAttributes
                .filter(attr => attr.attribute_label === 1)
                .map(attr => (
                  <Select.OptGroup key={attr.attribute_id} label={attr.attribute_name}>
                    {attr.attribute_value_info_list?.map(val => (
                      <Option
                        key={val.attribute_value_id}
                        value={JSON.stringify({
                          attribute_id: attr.attribute_id,
                          attribute_value_id: val.attribute_value_id
                        })}
                      >
                        {val.attribute_value}
                      </Option>
                    ))}
                  </Select.OptGroup>
                ))}
            </Select>
          </Form.Item>

          <Divider>SKC图片</Divider>
          <Form.Item label="主图" required>
            <Upload
              listType="picture-card"
              maxCount={1}
              beforeUpload={(file) => {
                handleImageUpload(file, 1).then(url => {
                  if (url) {
                    const images = form.getFieldValue(['skc_list', skcIndex, 'images']) || [];
                    images.push({ image_type: 1, image_sort: 1, image_url: url });
                    form.setFieldValue(['skc_list', skcIndex, 'images'], images);
                  }
                });
                return false;
              }}
            >
              <div>
                <PlusOutlined />
                <div style={{ marginTop: 8 }}>上传主图</div>
              </div>
            </Upload>
          </Form.Item>

          <Form.Item label="细节图">
            <Upload
              listType="picture-card"
              maxCount={10}
              multiple
              beforeUpload={(file) => {
                handleImageUpload(file, 2).then(url => {
                  if (url) {
                    const images = form.getFieldValue(['skc_list', skcIndex, 'images']) || [];
                    const detailImages = images.filter(img => img.image_type === 2);
                    images.push({
                      image_type: 2,
                      image_sort: detailImages.length + 2,
                      image_url: url
                    });
                    form.setFieldValue(['skc_list', skcIndex, 'images'], images);
                  }
                });
                return false;
              }}
            >
              <div>
                <PlusOutlined />
                <div style={{ marginTop: 8 }}>上传细节图</div>
              </div>
            </Upload>
          </Form.Item>

          <Divider>SKU列表</Divider>
          {skc.skuList.map((sku, skuIndex) => (
            <Card
              key={sku.key}
              type="inner"
              title={`SKU ${skuIndex + 1}`}
              extra={
                <Button
                  type="link"
                  danger
                  size="small"
                  onClick={() => removeSku(skc.key, sku.key)}
                >
                  删除
                </Button>
              }
              style={{ marginBottom: 8 }}
            >
              <Form.Item
                label="商家SKU编码"
                name={['skc_list', skcIndex, 'sku_list', skuIndex, 'supplier_sku']}
                rules={[{ required: true, message: '请输入SKU编码' }]}
              >
                <Input placeholder="店内唯一，最多200字符" maxLength={200} />
              </Form.Item>

              <Form.Item
                label="供货价"
                name={['skc_list', skcIndex, 'sku_list', skuIndex, 'cost_price']}
                rules={[{ required: true, message: '请输入供货价' }]}
              >
                <InputNumber
                  placeholder="供货价格"
                  min={0}
                  max={100000}
                  precision={2}
                  style={{ width: '100%' }}
                  addonAfter={publishStandard?.currency || 'USD'}
                />
              </Form.Item>

              <Space style={{ width: '100%' }}>
                <Form.Item
                  label="长(cm)"
                  name={['skc_list', skcIndex, 'sku_list', skuIndex, 'length']}
                  rules={[{ required: true, message: '必填' }]}
                >
                  <InputNumber min={0} precision={2} placeholder="长度" />
                </Form.Item>
                <Form.Item
                  label="宽(cm)"
                  name={['skc_list', skcIndex, 'sku_list', skuIndex, 'width']}
                  rules={[{ required: true, message: '必填' }]}
                >
                  <InputNumber min={0} precision={2} placeholder="宽度" />
                </Form.Item>
                <Form.Item
                  label="高(cm)"
                  name={['skc_list', skcIndex, 'sku_list', skuIndex, 'height']}
                  rules={[{ required: true, message: '必填' }]}
                >
                  <InputNumber min={0} precision={2} placeholder="高度" />
                </Form.Item>
                <Form.Item
                  label="重量(g)"
                  name={['skc_list', skcIndex, 'sku_list', skuIndex, 'weight']}
                  rules={[{ required: true, message: '必填' }]}
                >
                  <InputNumber min={1} placeholder="重量" />
                </Form.Item>
              </Space>

              <Form.Item
                label="库存数量"
                name={['skc_list', skcIndex, 'sku_list', skuIndex, 'inventory_num']}
                rules={[{ required: true, message: '请输入库存' }]}
              >
                <InputNumber min={0} placeholder="库存数量" style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item
                label="采购状态"
                name={['skc_list', skcIndex, 'sku_list', skuIndex, 'stop_purchase']}
                initialValue={1}
                rules={[{ required: true, message: '请选择采购状态' }]}
              >
                <Select>
                  <Option value={1}>可采</Option>
                  <Option value={2}>停采</Option>
                </Select>
              </Form.Item>

              <Form.Item
                label="销售状态"
                name={['skc_list', skcIndex, 'sku_list', skuIndex, 'mall_state']}
                initialValue={1}
                rules={[{ required: true, message: '请选择销售状态' }]}
              >
                <Select>
                  <Option value={1}>在售</Option>
                  <Option value={2}>停售</Option>
                </Select>
              </Form.Item>
            </Card>
          ))}

          <Button
            type="dashed"
            block
            icon={<PlusOutlined />}
            onClick={() => addSku(skc.key)}
          >
            添加SKU
          </Button>
        </Card>
      ))}

      <Button
        type="dashed"
        block
        icon={<PlusOutlined />}
        onClick={addSkc}
        style={{ marginBottom: 16 }}
      >
        添加SKC
      </Button>
    </div>
  );

  // 步骤4: 上架设置
  const renderShelfSettings = () => (
    <Card title="上架设置" style={{ marginBottom: 16 }}>
      <Form.Item
        label="上架方式"
        name="shelf_way"
        initialValue="1"
        rules={[{ required: true, message: '请选择上架方式' }]}
      >
        <Select>
          <Option value="1">自动上架</Option>
          <Option value="2">定时上架</Option>
        </Select>
      </Form.Item>

      <Form.Item
        noStyle
        shouldUpdate={(prevValues, currentValues) =>
          prevValues.shelf_way !== currentValues.shelf_way
        }
      >
        {({ getFieldValue }) =>
          getFieldValue('shelf_way') === '2' ? (
            <Form.Item
              label="期望上架时间"
              name="hope_on_sale_date"
              rules={[{ required: true, message: '请选择上架时间' }]}
            >
              <Input type="datetime-local" />
            </Form.Item>
          ) : null
        }
      </Form.Item>

      {isFieldShow('shelf_require') && (
        <Form.Item
          label="到货SHEIN仓才上架"
          name="shelf_require"
          initialValue="0"
          rules={[{ required: isFieldRequired('shelf_require'), message: '请选择' }]}
        >
          <Select>
            <Option value="0">否</Option>
            <Option value="1">是</Option>
          </Select>
        </Form.Item>
      )}

      {isFieldShow('minimum_stock_quantity') && (
        <Form.Item
          label="最小备货数量"
          name="minimum_stock_quantity"
          rules={[{ required: isFieldRequired('minimum_stock_quantity'), message: '请输入最小备货数量' }]}
        >
          <InputNumber min={1} max={1000000} placeholder="1-1000000" style={{ width: '100%' }} />
        </Form.Item>
      )}

      {isFieldShow('reference_product_link') && (
        <Form.Item
          label="竞品链接"
          name="competing_product_link"
          rules={[
            { required: isFieldRequired('reference_product_link'), message: '请输入竞品链接' },
            { type: 'url', message: '请输入有效的URL' }
          ]}
        >
          <Input placeholder="商品信息参考链接，最多300字符" maxLength={300} />
        </Form.Item>
      )}
    </Card>
  );

  // 主渲染
  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      <Card
        title="SHEIN全托管商品刊登"
        extra={
          <Space>
            <Button onClick={() => navigate(-1)}>返回</Button>
            <Button icon={<SaveOutlined />} onClick={saveDraft}>
              保存草稿
            </Button>
          </Space>
        }
      >
        <Steps current={currentStep} style={{ marginBottom: 24 }}>
          <Step title="选择分类" />
          <Step title="基本信息" />
          <Step title="商品属性" />
          <Step title="SKC/SKU" />
          <Step title="上架设置" />
        </Steps>

        <Spin spinning={loading || imageUploading}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
          >
            {currentStep === 0 && renderCategorySelection()}
            {currentStep === 1 && renderBasicInfo()}
            {currentStep === 2 && renderProductAttributes()}
            {currentStep === 3 && renderSkcSkuInfo()}
            {currentStep === 4 && renderShelfSettings()}

            <div style={{ marginTop: 24, textAlign: 'right' }}>
              <Space>
                {currentStep > 0 && (
                  <Button onClick={() => setCurrentStep(currentStep - 1)}>
                    上一步
                  </Button>
                )}
                {currentStep < 4 && (
                  <Button 
                    type="primary" 
                    onClick={() => {
                      if (currentStep === 0 && !selectedCategory) {
                        message.warning('请先选择商品分类');
                        return;
                      }
                      if (currentStep === 0) {
                        console.log('选中的分类:', selectedCategory);
                        console.log('category_id:', selectedCategory.category_id);
                        console.log('product_type_id:', selectedCategory.product_type_id);
                        
                        if (!selectedCategory.product_type_id) {
                          message.error('分类信息不完整，缺少product_type_id');
                          return;
                        }
                        
                        loadPublishStandard(selectedCategory.category_id);
                        loadAttributes(selectedCategory.category_id, selectedCategory.product_type_id);
                      }
                      setCurrentStep(currentStep + 1);
                    }}
                    disabled={currentStep === 0 && !selectedCategory}
                  >
                    下一步
                  </Button>
                )}
                {currentStep === 4 && (
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={handleSubmit}
                    loading={loading}
                  >
                    提交发布
                  </Button>
                )}
              </Space>
            </div>
          </Form>
        </Spin>
      </Card>
    </div>
  );
};

export default PlatformSheinFullListed;
