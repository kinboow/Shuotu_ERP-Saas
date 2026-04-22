import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  message, Button, Form, Input, Select, InputNumber, Upload, 
  Card, Space, Alert, Row, Col, Spin, Modal 
} from 'antd';
import { 
  PlusOutlined, DeleteOutlined, UploadOutlined, 
  SaveOutlined, SendOutlined, LeftOutlined 
} from '@ant-design/icons';
import axios from 'axios';

const { TextArea } = Input;
const { Option } = Select;

const PlatformSheinFullListed = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();
  
  // 状态管理
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
  
  // 多列级联选择状态
  const [cascadeColumns, setCascadeColumns] = useState([]);
  const [selectedPath, setSelectedPath] = useState([]);
  
  // 规格选择状态
  const [selectedMainSpec, setSelectedMainSpec] = useState(null); // 主规格（SKC）
  const [selectedSubSpecs, setSelectedSubSpecs] = useState([]); // 其他规格（SKU）
  
  // 分类搜索状态
  const [categorySearchText, setCategorySearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  
  // 分类确认状态
  const [categoryConfirmed, setCategoryConfirmed] = useState(false);
  
  // 传图识品状态
  const [imageRecognitionUrl, setImageRecognitionUrl] = useState('');
  const [imageRecognitionLoading, setImageRecognitionLoading] = useState(false);
  const [recommendedCategories, setRecommendedCategories] = useState([]);
  
  // 历史选择的类目
  const [recentCategories, setRecentCategories] = useState([]);

  useEffect(() => {
    loadPlatforms();
    loadRecentCategories();
    
    // 从URL参数中获取平台信息
    const searchParams = new URLSearchParams(location.search);
    const platformParam = searchParams.get('platform');
    const platformNameParam = searchParams.get('platformName');
    
    if (platformParam) {
      console.log('从URL获取到平台参数:', platformParam);
      
      // 设置页面标题
      const displayName = platformNameParam || 'SHEIN全托管';
      document.title = `协途 - ${displayName}商品刊登`;
    } else {
      // 默认标题
      document.title = '协途 - SHEIN全托管商品刊登';
    }
  }, [location]);

  // 加载历史选择的类目
  const loadRecentCategories = () => {
    try {
      const saved = localStorage.getItem('shein_recent_categories');
      if (saved) {
        setRecentCategories(JSON.parse(saved));
      }
    } catch (e) {
      console.error('加载历史类目失败:', e);
    }
  };

  // 保存历史选择的类目
  const saveRecentCategory = (category) => {
    try {
      const saved = localStorage.getItem('shein_recent_categories');
      let list = saved ? JSON.parse(saved) : [];
      
      // 移除已存在的相同类目
      list = list.filter(c => c.category_id !== category.category_id);
      
      // 添加到开头
      list.unshift({
        category_id: category.category_id,
        category_name: category.category_name,
        path: categoryPath.map(p => p.category_name).join(' > ')
      });
      
      // 最多保存20个
      if (list.length > 20) {
        list = list.slice(0, 20);
      }
      
      localStorage.setItem('shein_recent_categories', JSON.stringify(list));
      setRecentCategories(list);
    } catch (e) {
      console.error('保存历史类目失败:', e);
    }
  };

  // 初始化第一列
  useEffect(() => {
    if (categories.length > 0 && cascadeColumns.length === 0) {
      setCascadeColumns([categories]);
    }
  }, [categories]);

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
      // 不自动选择店铺，让用户手动选择
    } catch (error) {
      message.error('加载平台失败');
    }
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
  const callSheinAPI = async (path, data = {}, platform = null) => {
    const currentPlatform = platform || selectedPlatform;
    if (!currentPlatform) {
      throw new Error('未选择平台');
    }

    try {
      const response = await axios.post('/api/shein-full-api/proxy', {
        apiPath: path,
        data: data,
        platformConfig: {
          app_key: currentPlatform.app_key || currentPlatform.open_key_id,
          app_secret: currentPlatform.app_secret || currentPlatform.secret_key,
          api_url: currentPlatform.api_url
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
  const loadCategories = async (platform = null) => {
    setLoading(true);
    try {
      const result = await callSheinAPI('/open-api/goods/query-category-tree', {}, platform);
      setCategories(result.info.data || []);
      setCascadeColumns([result.info.data || []]);
    } catch (error) {
      message.error('加载分类失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 传图识品 - 上传图片并识别分类
  const handleImageRecognition = async (file) => {
    if (!selectedPlatform) {
      message.error('请先选择店铺');
      return false;
    }

    // 验证文件类型
    const isValidType = ['image/jpeg', 'image/jpg', 'image/png'].includes(file.type);
    if (!isValidType) {
      message.error('仅支持JPG、JPEG、PNG格式的图片');
      return false;
    }

    // 验证文件大小
    const isLt3M = file.size / 1024 / 1024 < 3;
    if (!isLt3M) {
      message.error('图片大小不能超过3MB');
      return false;
    }

    setImageRecognitionLoading(true);
    setRecommendedCategories([]);

    try {
      // 先上传图片获取URL
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadResponse = await axios.post('/api/images/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (!uploadResponse.data.success) {
        throw new Error(uploadResponse.data.message || '图片上传失败');
      }

      const imageUrl = uploadResponse.data.url;
      setImageRecognitionUrl(imageUrl);

      // 调用SHEIN图文识别推荐类目接口
      const result = await callSheinAPI('/open-api/goods/image-category-suggestion', {
        url: imageUrl
      });

      if (result.info?.data && result.info.data.length > 0) {
        // 根据categoryId查找完整的分类信息
        const recommendedList = [];
        for (const item of result.info.data) {
          const categoryInfo = findCategoryById(categories, item.categoryId);
          if (categoryInfo) {
            recommendedList.push({
              ...item,
              categoryInfo,
              path: findCategoryPath(categories, item.categoryId)
            });
          }
        }
        setRecommendedCategories(recommendedList);
        
        if (recommendedList.length > 0) {
          message.success(`识别成功，找到 ${recommendedList.length} 个推荐分类`);
        } else {
          message.warning('未找到匹配的可用分类');
        }
      } else {
        message.warning('未能识别出推荐分类，请手动选择');
      }
    } catch (error) {
      message.error('图片识别失败: ' + error.message);
    } finally {
      setImageRecognitionLoading(false);
    }

    return false; // 阻止默认上传行为
  };

  // 根据categoryId查找分类信息
  const findCategoryById = (categoryList, categoryId) => {
    for (const cat of categoryList) {
      if (String(cat.category_id) === String(categoryId)) {
        return cat;
      }
      if (cat.children && cat.children.length > 0) {
        const found = findCategoryById(cat.children, categoryId);
        if (found) return found;
      }
    }
    return null;
  };

  // 选择推荐分类
  const handleSelectRecommendedCategory = (recommended) => {
    if (recommended.categoryInfo) {
      handleCategorySelect(recommended.categoryInfo);
      // 更新级联选择的路径
      if (recommended.path) {
        setSelectedPath(recommended.path);
        // 更新级联列表
        const newColumns = [categories];
        for (let i = 0; i < recommended.path.length; i++) {
          const cat = recommended.path[i];
          if (cat.children && cat.children.length > 0) {
            newColumns.push(cat.children);
          }
        }
        setCascadeColumns(newColumns);
      }
      message.success('已选择推荐分类');
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
    if (!productTypeId) {
      message.error('product_type_id 参数缺失');
      return null;
    }
    
    setLoading(true);
    try {
      const result = await callSheinAPI('/open-api/goods/query-attribute-template', {
        product_type_id_list: [productTypeId]
      });
      
      const dataList = result.info.data || [];
      if (dataList.length === 0) {
        message.warning('该分类下没有可用属性');
        return null;
      }
      
      const attrData = dataList[0].attribute_infos || [];
      
      const productAttrs = attrData.filter(attr => attr.attribute_type === 3 || attr.attribute_type === 4);
      const sizeAttrs = attrData.filter(attr => attr.attribute_type === 2);
      const saleAttrs = attrData.filter(attr => attr.attribute_type === 1);
      
      setAttributes(productAttrs);
      setSizeAttributes(sizeAttrs);
      setSalesAttributes(saleAttrs);
      
      return { productAttrs, sizeAttrs, saleAttrs };
    } catch (error) {
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

  // 搜索末级分类
  const searchLeafCategories = (categoriesTree, rootCategories, searchText, results = []) => {
    for (const cat of categoriesTree) {
      if (cat.last_category && cat.category_name.toLowerCase().includes(searchText.toLowerCase())) {
        const path = findCategoryPath(rootCategories, cat.category_id);
        results.push({
          ...cat,
          path: path
        });
      }
      if (cat.children && cat.children.length > 0) {
        searchLeafCategories(cat.children, rootCategories, searchText, results);
      }
    }
    return results;
  };

  // 处理搜索
  const handleCategorySearch = (value) => {
    setCategorySearchText(value);
    if (value.trim()) {
      const results = searchLeafCategories(categories, categories, value.trim());
      setSearchResults(results);
      console.log('搜索结果:', results);
    } else {
      setSearchResults([]);
    }
  };

  // 分类选择变化（仅标记选中，不加载数据）
  const handleCategorySelect = (category) => {
    if (!category.last_category) {
      message.warning('请选择末级分类');
      return;
    }
    
    setSelectedCategory(category);
    const path = findCategoryPath(categories, category.category_id);
    setCategoryPath(path || []);
  };

  // 确认分类选择（加载数据并跳转）
  const confirmCategorySelection = async () => {
    if (!selectedCategory) {
      message.warning('请先选择分类');
      return;
    }

    // 保存到历史类目
    saveRecentCategory(selectedCategory);

    setLoading(true);
    try {
      // 设置表单字段
      form.setFieldsValue({
        category_id: selectedCategory.category_id,
        product_type_id: selectedCategory.product_type_id,
        // 初始化SKC列表
        skc_list: [{
          key: Date.now(),
          supplier_code: '',
          sale_attribute: null,
          images: [],
          sku_list: [{
            key: Date.now(),
            supplier_sku: '',
            sale_attribute_list: [],
            cost_price: '',
            length: '',
            width: '',
            height: '',
            weight: '',
            inventory_num: 0,
            mall_state: 1,
            stop_purchase: 1
          }]
        }]
      });
      
      // 加载规范和属性
      await loadPublishStandard(selectedCategory.category_id);
      await loadAttributes(selectedCategory.category_id, selectedCategory.product_type_id);
      
      // 设置确认状态，触发页面跳转
      setCategoryConfirmed(true);
      message.success('分类确认成功');
    } catch (error) {
      message.error('加载分类信息失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 点击分类项
  const handleCascadeClick = (category, columnIndex) => {
    const newPath = selectedPath.slice(0, columnIndex);
    newPath[columnIndex] = category;
    setSelectedPath(newPath);

    if (category.last_category) {
      if (!category.product_type_id || category.product_type_id === 0) {
        message.error(`该分类缺少有效的product_type_id`);
        return;
      }
      handleCategorySelect(category);
      setCascadeColumns(cascadeColumns.slice(0, columnIndex + 1));
    } else if (category.children && category.children.length > 0) {
      const newColumns = cascadeColumns.slice(0, columnIndex + 1);
      newColumns.push(category.children);
      setCascadeColumns(newColumns);
    }
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

  // 保存草稿
  const saveDraft = async () => {
    try {
      const values = form.getFieldsValue(true);
      const productName = values.product_name || selectedCategory?.category_name || '未命名商品';
      const draftTitle = `${productName} - ${new Date().toLocaleString('zh-CN')}`;
      
      const draftData = {
        title: draftTitle,
        draftType: 'platform',
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
        multi_language_name_list: [{
          language: publishStandard?.default_language || 'en',
          name: values.product_name
        }],
        multi_language_desc_list: [{
          language: publishStandard?.default_language || 'en',
          name: values.product_description
        }],
        shelf_way: values.shelf_way || '1',
        shelf_require: values.shelf_require || '0',
        skc_list: values.skc_list?.map(skc => ({
          supplier_code: skc.supplier_code,
          image_info: {
            image_info_list: skc.images || []
          },
          sale_attribute: skc.sale_attribute,
          sku_list: skc.sku_list?.map(sku => ({
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

      const result = await callSheinAPI('/open-api/goods/product/publishOrEdit', publishData);

      if (result.info.success) {
        message.success('商品发布成功');
        await axios.post('/api/publish-records', {
          platform_id: selectedPlatform.id,
          platform_name: 'SHEIN',
          spu_name: result.info.spu_name,
          product_data: JSON.stringify(publishData),
          publish_result: JSON.stringify(result.info),
          status: 'success'
        });
        navigate('/publish-records');
      }
    } catch (error) {
      message.error('发布失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 渲染分类选择面板
  const renderCategoryPanel = () => (
    <div>
      {loading && selectedPlatform && categories.length === 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '320px',
          backgroundColor: '#fafafa',
          border: '1px solid #e8e8e8',
          borderRadius: '2px',
          padding: '40px'
        }}>
          <Spin size="large" />
          <div style={{ 
            color: '#666', 
            fontSize: '14px', 
            marginTop: '16px' 
          }}>
            正在加载分类数据...
          </div>
        </div>
      )}

      {categories.length > 0 && (
        <>
          {/* 搜索框 */}
          <div style={{ marginBottom: '16px', position: 'relative' }}>
            <Input.Search
              placeholder="搜索末级分类..."
              allowClear
              value={categorySearchText}
              onChange={(e) => handleCategorySearch(e.target.value)}
              onSearch={handleCategorySearch}
              style={{ width: '100%' }}
            />

            {/* 搜索结果 - 悬浮显示 */}
            {searchResults.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 1000,
                border: '1px solid #e8e8e8',
                borderRadius: '2px',
                maxHeight: '300px',
                overflowY: 'auto',
                backgroundColor: '#fff',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
              }}>
                <div style={{
                  padding: '8px 16px',
                  backgroundColor: '#fafafa',
                  borderBottom: '1px solid #e8e8e8',
                  fontSize: '13px',
                  color: '#666',
                  fontWeight: '500'
                }}>
                  找到 {searchResults.length} 个匹配的末级分类
                </div>
                {searchResults.map(cat => (
                  <div
                    key={cat.category_id}
                    onClick={() => {
                      handleCategorySelect(cat);
                      setCategorySearchText('');
                      setSearchResults([]);
                      
                      // 更新层级选择框显示
                      if (cat.path && cat.path.length > 0) {
                        // 根据path中的id找到完整的分类对象
                        const fullPath = [];
                        const newColumns = [categories];
                        let currentCategories = categories;
                        
                        for (let i = 0; i < cat.path.length; i++) {
                          const pathItem = cat.path[i];
                          const foundCategory = currentCategories.find(c => c.category_id === pathItem.id);
                          if (foundCategory) {
                            fullPath.push(foundCategory);
                            if (foundCategory.children && foundCategory.children.length > 0) {
                              newColumns.push(foundCategory.children);
                              currentCategories = foundCategory.children;
                            }
                          }
                        }
                        
                        setSelectedPath(fullPath);
                        setCascadeColumns(newColumns);
                      }
                    }}
                    style={{
                      padding: '10px 16px',
                      borderBottom: '1px solid #f0f0f0',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                      fontSize: '14px',
                      color: '#333'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#fff';
                    }}
                  >
                    {cat.path?.map(p => p.name).join('/')}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 常用分类 - 历史选择过的类目 */}
          {recentCategories.length > 0 && (
            <div style={{ 
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              flexWrap: 'wrap'
            }}>
              <span style={{ color: '#999', fontSize: '13px', lineHeight: '24px', flexShrink: 0 }}>常用分类</span>
              {recentCategories.slice(0, 10).map(cat => (
                <span
                  key={cat.category_id}
                  onClick={() => {
                    const categoryInfo = findCategoryById(categories, cat.category_id);
                    if (categoryInfo) {
                      handleCategorySelect(categoryInfo);
                      const path = findCategoryPath(categories, cat.category_id);
                      if (path) {
                        setSelectedPath(path);
                        const newColumns = [categories];
                        for (let i = 0; i < path.length; i++) {
                          const c = path[i];
                          if (c.children && c.children.length > 0) {
                            newColumns.push(c.children);
                          }
                        }
                        setCascadeColumns(newColumns);
                      }
                    } else {
                      message.warning('该分类已不可用');
                    }
                  }}
                  style={{
                    padding: '2px 8px',
                    fontSize: '13px',
                    color: '#1890ff',
                    cursor: 'pointer',
                    borderRadius: '2px',
                    transition: 'all 0.2s',
                    lineHeight: '20px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#e6f4ff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {cat.category_name}
                </span>
              ))}
            </div>
          )}

          {selectedPath.length > 0 && (
            <div style={{ 
              padding: '10px 16px', 
              backgroundColor: '#f5f7fa', 
              borderRadius: '2px',
              marginBottom: '16px',
              fontSize: '13px',
              color: '#666',
              border: '1px solid #e8e8e8'
            }}>
              <span style={{ color: '#999', marginRight: '8px' }}>当前位置:</span>
              {selectedPath.map((cat, index) => (
                <span key={cat.category_id}>
                  <span style={{ color: index === selectedPath.length - 1 ? '#1677ff' : '#333' }}>
                    {cat.category_name}
                  </span>
                  {index < selectedPath.length - 1 && (
                    <span style={{ margin: '0 6px', color: '#d9d9d9' }}>›</span>
                  )}
                </span>
              ))}
            </div>
          )}

          <div style={{ 
            display: 'flex',
            gap: '0',
            border: '1px solid #e8e8e8',
            borderRadius: '2px',
            overflow: 'hidden',
            minHeight: '320px',
            maxHeight: '450px',
            backgroundColor: '#fff'
          }}>
            {cascadeColumns.map((columnCategories, columnIndex) => (
              <div
                key={columnIndex}
                style={{
                  flex: '0 0 25%',
                  borderRight: columnIndex < cascadeColumns.length - 1 ? '1px solid #e8e8e8' : 'none',
                  overflowY: 'auto',
                  backgroundColor: '#fafafa'
                }}
              >
                {columnCategories.map(cat => {
                  const isSelected = selectedPath[columnIndex]?.category_id === cat.category_id;
                  
                  return (
                    <div
                      key={cat.category_id}
                      onClick={() => handleCascadeClick(cat, columnIndex)}
                      style={{
                        padding: '8px 16px',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? '#e6f4ff' : '#fff',
                        borderBottom: '1px solid #f0f0f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '14px',
                        transition: 'all 0.2s',
                        color: isSelected ? '#1677ff' : '#333'
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
                        fontWeight: isSelected ? '500' : 'normal',
                        flex: 1
                      }}>
                        {cat.category_name}
                      </span>
                      {!cat.last_category && (
                        <span style={{ 
                          color: isSelected ? '#1677ff' : '#bfbfbf',
                          fontSize: '12px',
                          marginLeft: '8px'
                        }}>
                          ›
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

        </>
      )}
    </div>
  );

  // 渲染基本信息面板
  const renderBasicInfoPanel = () => (
    <div>
      <Row gutter={16}>
        <Col span={24}>
          <Form.Item
            label="商品名称"
            name="product_name"
            rules={[{ required: true, message: '请输入商品名称' }]}
            extra="最多1000个字符，不支持emoji"
          >
            <Input placeholder="请输入商品名称" maxLength={1000} />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={24}>
          <Form.Item
            label="商品描述"
            name="product_description"
            extra="最多5000个字符，不支持html和emoji"
          >
            <TextArea
              placeholder="请输入商品描述"
              maxLength={5000}
              rows={4}
              showCount
            />
          </Form.Item>
        </Col>
      </Row>

      {isFieldShow('brand_code') && (
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="品牌"
              name="brand_code"
              rules={[{ required: isFieldRequired('brand_code'), message: '请选择品牌' }]}
            >
              <Select placeholder="选择品牌">
                {/* 品牌列表需要通过API获取 */}
              </Select>
            </Form.Item>
          </Col>
        </Row>
      )}

      {isFieldShow('skc_title') && (
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item
              label="SKC标题"
              name="skc_title"
              rules={[{ required: isFieldRequired('skc_title'), message: '请输入SKC标题' }]}
            >
              <Input placeholder="SKC维度商品标题" />
            </Form.Item>
          </Col>
        </Row>
      )}
    </div>
  );

  // 图片上传转换
  const handleImageUpload = async (file, imageType) => {
    setImageUploading(true);
    try {
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



  // 自动生成SKC和SKU
  const generateSkcSku = () => {
    if (!selectedMainSpec) {
      message.warning('请先选择主规格');
      return;
    }

    const mainAttr = salesAttributes.find(attr => attr.attribute_id === selectedMainSpec.attributeId);
    if (!mainAttr || !mainAttr.attribute_value_info_list) {
      message.error('主规格数据异常');
      return;
    }

    const newSkcList = [];

    // 遍历主规格的每个值，生成SKC
    mainAttr.attribute_value_info_list.forEach((mainValue, skcIdx) => {
      const skcKey = Date.now() + skcIdx;
      
      // 如果有其他规格，生成SKU组合
      let skuList = [];
      if (selectedSubSpecs.length > 0) {
        // 获取所有其他规格的属性值
        const subSpecValues = selectedSubSpecs.map(subSpec => {
          const subAttr = salesAttributes.find(attr => attr.attribute_id === subSpec.attributeId);
          return {
            attributeId: subSpec.attributeId,
            attributeName: subAttr?.attribute_name || '',
            values: subAttr?.attribute_value_info_list || []
          };
        });

        // 生成笛卡尔积（所有可能的组合）
        const combinations = cartesianProduct(subSpecValues.map(spec => spec.values));
        
        skuList = combinations.map((combo, skuIdx) => ({
          key: Date.now() + skcIdx * 1000 + skuIdx,
          supplier_sku: `SKU-${generateRandomKey(8)}`,
          sale_attribute_list: Array.isArray(combo) ? combo.map((val, idx) => ({
            attribute_id: subSpecValues[idx].attributeId,
            attribute_value_id: val.attribute_value_id
          })) : [{
            attribute_id: subSpecValues[0].attributeId,
            attribute_value_id: combo.attribute_value_id
          }],
          cost_price: '',
          length: '',
          width: '',
          height: '',
          weight: '',
          inventory_num: 0,
          mall_state: 1,
          stop_purchase: 1
        }));
      } else {
        // 没有其他规格，只生成一个空SKU
        skuList = [{
          key: Date.now() + skcIdx * 1000,
          supplier_sku: `SKU-${generateRandomKey(8)}`,
          sale_attribute_list: [],
          cost_price: '',
          length: '',
          width: '',
          height: '',
          weight: '',
          inventory_num: 0,
          mall_state: 1,
          stop_purchase: 1
        }];
      }

      newSkcList.push({
        key: skcKey,
        supplier_code: `SKC-${generateRandomKey(8)}`,
        sale_attribute: {
          attribute_id: selectedMainSpec.attributeId,
          attribute_value_id: mainValue.attribute_value_id
        },
        images: [],
        sku_list: skuList
      });
    });

    form.setFieldsValue({ skc_list: newSkcList });
    message.success(`已生成 ${newSkcList.length} 个SKC，共 ${newSkcList.reduce((sum, skc) => sum + skc.sku_list.length, 0)} 个SKU`);
  };

  // 笛卡尔积函数
  const cartesianProduct = (arrays) => {
    if (arrays.length === 0) return [];
    if (arrays.length === 1) return arrays[0].map(item => [item]);
    
    const result = [];
    const restProduct = cartesianProduct(arrays.slice(1));
    
    arrays[0].forEach(item => {
      restProduct.forEach(restItem => {
        result.push([item, ...restItem]);
      });
    });
    
    return result;
  };

  // 渲染SKC/SKU面板
  const renderSkcSkuPanel = () => {
    const mainSalesAttrs = salesAttributes.filter(attr => attr.attribute_label === 1);
    const subSalesAttrs = salesAttributes.filter(attr => attr.attribute_label === 0);

    return (
      <div>
        {/* 规格选择器 */}
        <div style={{ marginBottom: 16 }}>
          {/* 提示信息 */}
          <div style={{
            background: 'rgb(255, 250, 230)',
            padding: '12px 16px',
            marginBottom: '16px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px'
          }}>
            <span style={{ color: '#faad14', fontSize: '16px', marginTop: '2px' }}>⚠</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#333', fontSize: '14px', marginBottom: '4px' }}>
                <span style={{ fontWeight: '500' }}>主规格</span>: 每选定的一个主规格的属性值，对应生成一个SKC。<span style={{ fontWeight: '500' }}>其他规格</span>: 如所有可选的其他规格的属性值，可在本页面上传新产品，系统将自动上传到上线。
              </div>
              <div style={{ color: '#666', fontSize: '13px' }}>
                主规格选择后，需选择至少一个其他规格，可在本页面上传新产品，系统将自动上传到上线。
              </div>
            </div>
            <a href="#" style={{ color: '#1677ff', fontSize: '13px', whiteSpace: 'nowrap' }}>
              研究如何选择
            </a>
          </div>

          {/* 规格选择 */}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item 
                label={<span><span style={{ color: 'red' }}>*</span> 主规格</span>}
                style={{ marginBottom: 8 }}
              >
                <Select
                  placeholder="请选择"
                  value={selectedMainSpec?.attributeId}
                  onChange={(value) => {
                    const attr = mainSalesAttrs.find(a => a.attribute_id === value);
                    setSelectedMainSpec({
                      attributeId: value,
                      attributeName: attr?.attribute_name,
                      values: []
                    });
                  }}
                  allowClear
                >
                  {mainSalesAttrs.map(attr => (
                    <Option key={attr.attribute_id} value={attr.attribute_id}>
                      {attr.attribute_name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            {selectedMainSpec && (
              <Col span={12}>
                <Form.Item 
                  label="选择属性值"
                  style={{ marginBottom: 8 }}
                >
                  <Select
                    mode="multiple"
                    placeholder="请选择"
                    value={selectedMainSpec.values || []}
                    onChange={(values) => {
                      setSelectedMainSpec({
                        ...selectedMainSpec,
                        values: values
                      });
                    }}
                    allowClear
                  >
                    {mainSalesAttrs
                      .find(a => a.attribute_id === selectedMainSpec.attributeId)
                      ?.attribute_value_info_list?.map(val => (
                        <Option key={val.attribute_value_id} value={val.attribute_value_id}>
                          {val.attribute_value}
                        </Option>
                      ))}
                  </Select>
                </Form.Item>
              </Col>
            )}
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item 
                label="其他规格"
                style={{ marginBottom: 8 }}
              >
                <Select
                  mode="multiple"
                  placeholder="请选择"
                  value={selectedSubSpecs.map(s => s.attributeId)}
                  onChange={(values) => {
                    const specs = values.map(value => {
                      const attr = subSalesAttrs.find(a => a.attribute_id === value);
                      const existingSpec = selectedSubSpecs.find(s => s.attributeId === value);
                      return {
                        attributeId: value,
                        attributeName: attr?.attribute_name,
                        values: existingSpec?.values || []
                      };
                    });
                    setSelectedSubSpecs(specs);
                  }}
                  allowClear
                >
                  {subSalesAttrs.map(attr => (
                    <Option key={attr.attribute_id} value={attr.attribute_id}>
                      {attr.attribute_name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* 其他规格的属性值选择 */}
          {selectedSubSpecs.map((spec, index) => (
            <Row gutter={16} key={spec.attributeId}>
              <Col span={12}>
                <Form.Item 
                  label={`${spec.attributeName} 属性值`}
                  style={{ marginBottom: 8 }}
                >
                  <Select
                    mode="multiple"
                    placeholder="请选择"
                    value={spec.values || []}
                    onChange={(values) => {
                      const newSpecs = [...selectedSubSpecs];
                      newSpecs[index] = {
                        ...newSpecs[index],
                        values: values
                      };
                      setSelectedSubSpecs(newSpecs);
                    }}
                    allowClear
                  >
                    {subSalesAttrs
                      .find(a => a.attribute_id === spec.attributeId)
                      ?.attribute_value_info_list?.map(val => (
                        <Option key={val.attribute_value_id} value={val.attribute_value_id}>
                          {val.attribute_value}
                        </Option>
                      ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          ))}

          <div style={{ marginTop: '12px' }}>
            <Button 
              type="link"
              onClick={generateSkcSku}
              disabled={!selectedMainSpec}
              style={{ padding: 0, color: '#1677ff' }}
            >
              + 添加规格组合
            </Button>
          </div>
        </div>

        <Form.List name="skc_list">
          {(skcFields, { add: addSkcField, remove: removeSkcField }) => (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <Button 
                  type="dashed" 
                  icon={<PlusOutlined />}
                  onClick={() => addSkcField({
                    key: Date.now(),
                    supplier_code: `SKC-${generateRandomKey(8)}`,
                    sale_attribute: null,
                    images: [],
                    sku_list: [{
                      key: Date.now(),
                      supplier_sku: `SKU-${generateRandomKey(8)}`,
                      sale_attribute_list: [],
                      cost_price: '',
                      length: '',
                      width: '',
                      height: '',
                      weight: '',
                      inventory_num: 0,
                      mall_state: 1,
                      stop_purchase: 1
                    }]
                  })}
                >
                  手动添加SKC
                </Button>
              </div>
              {skcFields.map((skcField, skcIndex) => {
                const skc = form.getFieldValue(['skc_list', skcIndex]) || {};
                
                // 获取SKC的主规格值名称
                let skcTitle = `SKC ${skcIndex + 1}`;
                if (skc.sale_attribute) {
                  const mainAttr = mainSalesAttrs.find(attr => attr.attribute_id === skc.sale_attribute.attribute_id);
                  const mainValue = mainAttr?.attribute_value_info_list?.find(val => val.attribute_value_id === skc.sale_attribute.attribute_value_id);
                  if (mainValue) {
                    skcTitle = `${mainAttr.attribute_name}: ${mainValue.attribute_value}`;
                  }
                }

                return (
                  <Card
                    key={skcField.key}
                    title={skcTitle}
                    extra={
                      <Button 
                        type="link" 
                        danger 
                        onClick={() => removeSkcField(skcField.name)}
                      >
                        删除SKC
                      </Button>
                    }
                    style={{ marginBottom: 16 }}
                  >
                    <Row gutter={16}>
                      <Col span={8}>
                        <Form.Item
                          label="商家货号"
                          name={[skcField.name, 'supplier_code']}
                          rules={[{ required: true, message: '请输入商家货号' }]}
                        >
                          <Input placeholder="SKC货号" />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item
                          label="主销售属性"
                          name={[skcField.name, 'sale_attribute']}
                          rules={[{ required: true, message: '请选择主销售属性' }]}
                        >
                          <Select placeholder="选择颜色">
                            {mainSalesAttrs.map(attr => (
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
                      </Col>
                    </Row>

                    <Form.Item label="SKC图片">
                      <Upload
                        listType="picture-card"
                        fileList={skc.images?.map((img, idx) => ({
                          uid: idx,
                          name: `image-${idx}`,
                          status: 'done',
                          url: img.image_url
                        })) || []}
                        beforeUpload={(file) => {
                          handleImageUpload(file, 1).then(url => {
                            if (url) {
                              const currentList = form.getFieldValue('skc_list');
                              const newImages = [...(currentList[skcIndex].images || []), {
                                image_type: 1,
                                image_sort: (currentList[skcIndex].images?.length || 0) + 1,
                                image_url: url
                              }];
                              currentList[skcIndex].images = newImages;
                              form.setFieldsValue({ skc_list: [...currentList] });
                            }
                          });
                          return false;
                        }}
                      >
                        {(!skc.images || skc.images.length < 5) && (
                          <div>
                            <PlusOutlined />
                            <div style={{ marginTop: 8 }}>上传</div>
                          </div>
                        )}
                      </Upload>
                    </Form.Item>

                    <div style={{ marginTop: 16 }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: 12 
                      }}>
                        <span style={{ fontWeight: '500' }}>SKU列表</span>
                      </div>

                      <Form.List name={[skcField.name, 'sku_list']}>
                        {(skuFields, { add: addSkuField, remove: removeSkuField }) => (
                          <>
                            <Button 
                              type="dashed" 
                              size="small"
                              icon={<PlusOutlined />}
                              onClick={() => addSkuField({
                                key: Date.now(),
                                supplier_sku: `SKU-${generateRandomKey(8)}`,
                                sale_attribute_list: [],
                                cost_price: '',
                                length: '',
                                width: '',
                                height: '',
                                weight: '',
                                inventory_num: 0,
                                mall_state: 1,
                                stop_purchase: 1
                              })}
                              style={{ marginBottom: 12 }}
                            >
                              添加SKU
                            </Button>

                            {skuFields.map((skuField, skuIndex) => {
                              const sku = form.getFieldValue(['skc_list', skcIndex, 'sku_list', skuIndex]) || {};
                              
                              // 获取SKU的规格值名称
                              let skuTitle = `SKU ${skuIndex + 1}`;
                              if (sku.sale_attribute_list && sku.sale_attribute_list.length > 0) {
                                const specNames = sku.sale_attribute_list.map(saleAttr => {
                                  const attr = subSalesAttrs.find(a => a.attribute_id === saleAttr.attribute_id);
                                  const value = attr?.attribute_value_info_list?.find(v => v.attribute_value_id === saleAttr.attribute_value_id);
                                  return value ? `${attr.attribute_name}:${value.attribute_value}` : '';
                                }).filter(Boolean).join(' / ');
                                if (specNames) {
                                  skuTitle = specNames;
                                }
                              }

                              return (
                                <Card
                                  key={skuField.key}
                                  type="inner"
                                  size="small"
                                  title={skuTitle}
                                  extra={
                                    <Button 
                                      type="link" 
                                      danger 
                                      size="small"
                                      onClick={() => removeSkuField(skuField.name)}
                                    >
                                      删除
                                    </Button>
                                  }
                                  style={{ marginBottom: 8 }}
                                >
                                  <Row gutter={16}>
                                    <Col span={8}>
                                      <Form.Item
                                        label="SKU货号"
                                        name={[skuField.name, 'supplier_sku']}
                                        rules={[{ required: true, message: '请输入SKU货号' }]}
                                      >
                                        <Input placeholder="SKU货号" />
                                      </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                      <Form.Item
                                        label={`供货价(${publishStandard?.currency || 'USD'})`}
                                        name={[skuField.name, 'cost_price']}
                                        rules={[{ required: true, message: '请输入供货价' }]}
                                      >
                                        <InputNumber 
                                          placeholder="价格" 
                                          min={0} 
                                          precision={2}
                                          style={{ width: '100%' }}
                                        />
                                      </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                      <Form.Item
                                        label="库存"
                                        name={[skuField.name, 'inventory_num']}
                                        rules={[{ required: true, message: '请输入库存' }]}
                                      >
                                        <InputNumber 
                                          placeholder="库存" 
                                          min={0}
                                          style={{ width: '100%' }}
                                        />
                                      </Form.Item>
                                    </Col>
                                  </Row>

                                  <Row gutter={16}>
                                    <Col span={6}>
                                      <Form.Item
                                        label="长(cm)"
                                        name={[skuField.name, 'length']}
                                        rules={[{ required: true, message: '必填' }]}
                                      >
                                        <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                                      </Form.Item>
                                    </Col>
                                    <Col span={6}>
                                      <Form.Item
                                        label="宽(cm)"
                                        name={[skuField.name, 'width']}
                                        rules={[{ required: true, message: '必填' }]}
                                      >
                                        <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                                      </Form.Item>
                                    </Col>
                                    <Col span={6}>
                                      <Form.Item
                                        label="高(cm)"
                                        name={[skuField.name, 'height']}
                                        rules={[{ required: true, message: '必填' }]}
                                      >
                                        <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                                      </Form.Item>
                                    </Col>
                                    <Col span={6}>
                                      <Form.Item
                                        label="重量(g)"
                                        name={[skuField.name, 'weight']}
                                        rules={[{ required: true, message: '必填' }]}
                                      >
                                        <InputNumber min={1} style={{ width: '100%' }} />
                                      </Form.Item>
                                    </Col>
                                  </Row>

                                  <Row gutter={16}>
                                    <Col span={12}>
                                      <Form.Item
                                        label="销售状态"
                                        name={[skuField.name, 'mall_state']}
                                        initialValue={1}
                                      >
                                        <Select>
                                          <Option value={1}>在售</Option>
                                          <Option value={2}>停售</Option>
                                        </Select>
                                      </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                      <Form.Item
                                        label="采购状态"
                                        name={[skuField.name, 'stop_purchase']}
                                        initialValue={1}
                                      >
                                        <Select>
                                          <Option value={1}>可采</Option>
                                          <Option value={2}>停采</Option>
                                                        </Select>
                                      </Form.Item>
                                    </Col>
                                  </Row>
                                </Card>
                              );
                            })}
                          </>
                        )}
                      </Form.List>
                    </div>
                  </Card>
                );
              })}
            </>
          )}
        </Form.List>
      </div>
    );
  };

  // 渲染商品属性面板
  const renderAttributesPanel = () => (
    <div>
      {attributes.length === 0 ? (
        <Alert
          message="请先选择商品分类"
          type="warning"
          showIcon
        />
      ) : (
        <>
          <Alert
            message="商品属性"
            description="请根据商品实际情况填写属性信息，标记为必填的属性必须填写"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          
          <Row gutter={16}>
            {attributes.map(attr => (
              <Col span={12} key={attr.attribute_id}>
                <Form.Item
                  label={attr.attribute_name}
                  name={['product_attributes', attr.attribute_id]}
                  rules={[{
                    required: attr.attribute_status === 3,
                    message: `请选择${attr.attribute_name}`
                  }]}
                  extra={attr.attribute_status === 3 ? '必填项' : ''}
                >
                  {attr.attribute_mode === 0 ? (
                    <InputNumber 
                      placeholder="请输入正整数" 
                      min={1} 
                      style={{ width: '100%' }} 
                    />
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
                  ) : null}
                </Form.Item>
              </Col>
            ))}
          </Row>
        </>
      )}
    </div>
  );

  // 如果还没确认分类，显示分类选择页面
  if (!categoryConfirmed) {
    return (
      <div style={{ padding: '0', background: '#f0f2f5', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* 分类选择内容 */}
        <div style={{ padding: '24px 48px', flex: 1, overflowY: 'auto', paddingBottom: '80px', width: '83.25%', margin: '0 auto' }}>
          {/* 请选择商品分类提示 */}
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#e6f4ff',
            border: '1px solid #91caff',
            borderRadius: '4px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px'
          }}>
            <svg style={{ flexShrink: 0 }} width="16" height="16" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path d="M511.999488 65.290005C265.29776 65.290005 65.30075 265.301342 65.30075 511.988744c0 246.694565 199.995987 446.720228 446.697715 446.720228s446.697715-200.025663 446.697715-446.720228C958.697203 265.301342 758.701217 65.290005 511.999488 65.290005L511.999488 65.290005zM511.999488 783.214005c-33.153074 0-60.011792-26.885324-60.011792-60.039421 0-33.139771 26.857694-60.025095 60.011792-60.025095s60.010769 26.885324 60.010769 60.025095C572.009234 756.328681 545.152563 783.214005 511.999488 783.214005L511.999488 783.214005zM586.390779 342.710362l-14.381545 215.381395c0 33.153074-26.856671 60.039421-60.010769 60.039421s-60.011792-26.885324-60.011792-60.039421l-14.380522-215.381395c-0.407276-3.191692-0.64059-6.426363-0.64059-9.735735 0-41.440831 33.590026-75.030857 75.03188-75.030857 41.440831 0 75.030857 33.590026 75.030857 75.030857C587.030345 336.282976 586.798055 339.517647 586.390779 342.710362L586.390779 342.710362zM597.150844 316.994678" fill="#197afa"/></svg>
            <div>
              <div style={{ color: '#333', fontSize: '14px', fontWeight: '500', marginBottom: '4px', lineHeight: '16px' }}>
                请选择商品分类
              </div>
              <div style={{ color: '#666', fontSize: '13px' }}>
                选择末级分类后，系统将自动加载该分类的发布规范和属性信息
              </div>
            </div>
          </div>

          {/* 平台店铺选择 */}
          <div style={{ 
            background: '#fff', 
            padding: '16px 20px', 
            marginBottom: '16px',
            borderRadius: '4px',
            border: '1px solid #e8e8e8'
          }}>
            <Form.Item
              label="平台店铺"
              name="platform_id"
              rules={[{ required: true, message: '请选择平台店铺' }]}
              style={{ marginBottom: 0 }}
            >
              <Select
                placeholder="选择SHEIN店铺"
                onChange={(value) => {
                  const platform = platforms.find(p => p.id === value);
                  setSelectedPlatform(platform);
                  if (platform) {
                    loadCategories(platform);
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
          </div>

          {/* 只有选择了店铺才显示传图识品和分类选择 */}
          {selectedPlatform && (
            <>
              {/* 传图识品区域 */}
              <div style={{ 
                background: '#fff', 
                padding: '16px 20px', 
                marginBottom: '16px',
                borderRadius: '4px',
                border: '1px solid #e8e8e8'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <span style={{ fontWeight: '500', color: '#333', marginRight: '8px' }}>传图识品</span>
                    <span style={{ color: '#999', fontSize: '13px' }}>
                      1. 上传商品正面图，可自动识别商品分类，并填充部分商品属性 2. 支持JPG、JPEG、PNG格式，图片大小≤3MB
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <Upload
                    accept=".jpg,.jpeg,.png"
                    showUploadList={false}
                    beforeUpload={handleImageRecognition}
                    disabled={imageRecognitionLoading}
                  >
                    <div style={{
                      width: '80px',
                      height: '80px',
                      border: '1px dashed #d9d9d9',
                      borderRadius: '4px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: imageRecognitionLoading ? 'not-allowed' : 'pointer',
                      background: '#fafafa'
                    }}>
                      {imageRecognitionLoading ? (
                        <Spin size="small" />
                      ) : imageRecognitionUrl ? (
                        <img src={imageRecognitionUrl} alt="识别图片" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} />
                      ) : (
                        <>
                          <PlusOutlined style={{ fontSize: '20px', color: '#999' }} />
                          <span style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>点击上传</span>
                        </>
                      )}
                    </div>
                  </Upload>

                  {/* 推荐分类结果 */}
                  {recommendedCategories.length > 0 && (
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                        推荐分类（点击选择）：
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {recommendedCategories.map((item, index) => (
                          <div
                            key={item.categoryId}
                            onClick={() => handleSelectRecommendedCategory(item)}
                            style={{
                              padding: '8px 12px',
                              background: selectedCategory?.category_id === item.categoryId ? '#e6f4ff' : '#f5f5f5',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              border: selectedCategory?.category_id === item.categoryId ? '1px solid #1890ff' : '1px solid transparent',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              if (selectedCategory?.category_id !== item.categoryId) {
                                e.currentTarget.style.background = '#e8e8e8';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (selectedCategory?.category_id !== item.categoryId) {
                                e.currentTarget.style.background = '#f5f5f5';
                              }
                            }}
                          >
                            <div style={{ fontSize: '13px', color: '#333' }}>
                              {item.path?.map(p => p.category_name).join(' > ') || item.categoryInfo?.category_name}
                            </div>
                            {item.vote && (
                              <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
                                相似度: {item.vote}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 商品分类模块 */}
              <div style={{ 
                background: '#fff', 
                padding: '16px 20px', 
                borderRadius: '4px',
                border: '1px solid #e8e8e8'
              }}>
                {/* 商品分类标题 */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '12px'
                }}>
                  <span style={{ fontWeight: '500', color: '#333', fontSize: '14px' }}>商品分类</span>
                  <a style={{ color: '#1890ff', fontSize: '13px' }}>未找到合适分类？点此申请</a>
                </div>

                {renderCategoryPanel()}
              </div>
            </>
          )}
        </div>

        {/* 固定底部区域 */}
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#fff',
          borderTop: '1px solid #e8e8e8',
          padding: '14px 48px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          zIndex: 1000
        }}>
          {/* 已选择分类提示 */}
          {selectedCategory && (
            <span style={{ color: '#666', fontSize: '14px' }}>
              已选择分类：<span style={{ color: '#333', fontWeight: '500' }}>{selectedCategory.category_name}</span>
            </span>
          )}
          {/* 按钮组 */}
          <div style={{
            display: 'flex',
            gap: '12px'
          }}>
            <Button 
              type="primary" 
              size="large"
              style={{ width: '109px', height: '31px', borderRadius: '4px' }}
              disabled={!selectedCategory}
              loading={loading}
              onClick={confirmCategorySelection}
            >
              发布商品
            </Button>
            <Button 
              size="large"
              style={{ width: '109px', height: '31px', borderRadius: '4px' }}
              onClick={() => {
                navigate(-1);
              }}
            >
              取消
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 已选择分类，显示商品信息页面
  return (
    <div style={{ padding: '0', background: '#f0f2f5', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 主内容区 */}
      <div style={{ padding: '24px 48px', flex: 1, overflowY: 'auto', paddingBottom: '100px' }}>
        {/* 已选择类目提示框 */}
        {selectedCategory && categoryPath.length > 0 && (
          <div style={{
            background: 'rgb(232, 241, 254)',
            padding: '12px 16px',
            marginBottom: '16px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ color: '#666', fontSize: '14px' }}>
                已选择分类: <span style={{ color: '#333', fontWeight: '500' }}>{categoryPath.map(c => c.name).join(' > ')}</span>
              </span>
            </div>
            <Button 
              type="link" 
              size="small"
              onClick={() => {
                Modal.confirm({
                  title: '确认重新修改吗?',
                  content: '修改分类后当前填写需要重新填写部分商品信息，是否确认操作?',
                  okText: '确定',
                  cancelText: '取消',
                  onOk: () => {
                    setSelectedCategory(null);
                    setCategoryPath([]);
                    setSelectedPath([]);
                    setCascadeColumns([categories]);
                    setCategoryConfirmed(false);
                    form.resetFields();
                  }
                });
              }}
              style={{ color: '#1677ff' }}
            >
              重新选择分类
            </Button>
          </div>
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          {/* 1. 基本信息 */}
          <Card 
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ 
                  display: 'inline-block',
                  width: '24px',
                  height: '24px',
                  lineHeight: '24px',
                  textAlign: 'center',
                  borderRadius: '50%',
                  backgroundColor: '#1890ff',
                  color: '#fff',
                  fontSize: '12px'
                }}>
                  1
                </span>
                <span style={{ fontSize: '14px', fontWeight: '500' }}>基本信息</span>
              </div>
            }
            style={{ marginBottom: 16 }}
          >
            {renderBasicInfoPanel()}
          </Card>



          {/* 2. SKC/SKU信息 */}
          <Card 
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ 
                  display: 'inline-block',
                  width: '24px',
                  height: '24px',
                  lineHeight: '24px',
                  textAlign: 'center',
                  borderRadius: '50%',
                  backgroundColor: '#1890ff',
                  color: '#fff',
                  fontSize: '12px'
                }}>
                  2
                </span>
                <span style={{ fontSize: '14px', fontWeight: '500' }}>SKC/SKU信息</span>
              </div>
            }
            style={{ marginBottom: 16 }}
          >
            {renderSkcSkuPanel()}
          </Card>

          {/* 3. 上架设置 */}
          <Card 
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ 
                  display: 'inline-block',
                  width: '24px',
                  height: '24px',
                  lineHeight: '24px',
                  textAlign: 'center',
                  borderRadius: '50%',
                  backgroundColor: '#1890ff',
                  color: '#fff',
                  fontSize: '12px'
                }}>
                  3
                </span>
                <span style={{ fontSize: '14px', fontWeight: '500' }}>上架设置</span>
              </div>
            }
            style={{ marginBottom: 16 }}
          >
            <Row gutter={16}>
              <Col span={12}>
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
              </Col>
            </Row>
          </Card>
        </Form>
      </div>

      {/* 底部固定操作栏 */}
      <div style={{ 
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#fff', 
        padding: '16px 48px', 
        borderTop: '1px solid #e8e8e8',
        display: 'flex',
        justifyContent: 'center',
        gap: '12px',
        zIndex: 100
      }}>
        <Button 
          icon={<SaveOutlined />} 
          onClick={saveDraft}
          size="large"
          style={{ minWidth: '120px' }}
        >
          保存草稿
        </Button>
        <Button 
          type="primary" 
          icon={<SendOutlined />}
          onClick={handleSubmit}
          loading={loading}
          size="large"
          style={{ minWidth: '120px' }}
        >
          提交发布
        </Button>
      </div>
    </div>
  );
};

export default PlatformSheinFullListed;
