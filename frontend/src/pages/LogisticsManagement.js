import React, { useState, useEffect } from 'react';
import {
  Button, Modal, Form, Input, Select, Switch, Space, message,
  Popconfirm, Tag, Card, Row, Col, Divider, InputNumber, Tabs, Pagination, Empty
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined,
  PhoneOutlined, UserOutlined, GlobalOutlined, EnvironmentOutlined
} from '@ant-design/icons';
import axios from 'axios';

const { Option } = Select;
const { TextArea } = Input;

// 物流商卡片组件
const ProviderCard = ({ provider, onEdit, onDelete, onUse }) => {
  // 根据物流商类型设置不同的颜色
  const getTypeColor = (type) => {
    const colors = {
      express: '#1890ff',
      freight: '#52c41a',
      international: '#722ed1',
      warehouse: '#fa8c16',
      other: '#8c8c8c'
    };
    return colors[type] || colors.other;
  };

  // 服务区域标签
  const serviceAreas = provider.service_areas || [];
  
  return (
    <Card
      hoverable
      style={{ 
        height: '100%',
        borderRadius: '8px',
        overflow: 'hidden'
      }}
      bodyStyle={{ padding: '16px' }}
    >
      {/* 顶部：Logo和名称 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{
          width: '60px',
          height: '60px',
          borderRadius: '8px',
          backgroundColor: '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: '12px',
          flexShrink: 0,
          border: '1px solid #e8e8e8'
        }}>
          {provider.logo_url ? (
            <img src={provider.logo_url} alt={provider.provider_name} style={{ maxWidth: '50px', maxHeight: '50px' }} />
          ) : (
            <GlobalOutlined style={{ fontSize: '28px', color: getTypeColor(provider.provider_type) }} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ 
            fontSize: '16px', 
            fontWeight: 'bold', 
            marginBottom: '4px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {provider.provider_name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {provider.contact_person && (
              <span style={{ fontSize: '12px', color: '#666' }}>
                <UserOutlined style={{ marginRight: '4px' }} />
                {provider.contact_person}
              </span>
            )}
            {provider.contact_phone && (
              <span style={{ fontSize: '12px', color: '#666' }}>
                <PhoneOutlined style={{ marginRight: '4px' }} />
                {provider.contact_phone}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 服务区域标签 */}
      <div style={{ marginBottom: '12px', minHeight: '24px' }}>
        {serviceAreas.slice(0, 5).map((area, index) => (
          <Tag key={index} style={{ marginBottom: '4px', fontSize: '11px' }}>{area}</Tag>
        ))}
        {serviceAreas.length > 5 && (
          <Tag style={{ marginBottom: '4px', fontSize: '11px' }}>+{serviceAreas.length - 5}</Tag>
        )}
      </div>

      {/* 描述信息 */}
      <div style={{ 
        fontSize: '12px', 
        color: '#666', 
        marginBottom: '12px',
        height: '54px',
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical',
        lineHeight: '18px'
      }}>
        {provider.remark || provider.description || '暂无描述信息'}
      </div>

      {/* 底部操作按钮 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button 
          type="primary" 
          size="small"
          style={{ 
            backgroundColor: '#00b96b',
            borderColor: '#00b96b'
          }}
          onClick={() => onUse(provider)}
        >
          使用此服务商
        </Button>
        <Space>
          <Button type="link" size="small" onClick={() => onEdit(provider)}>
            <EditOutlined /> 编辑
          </Button>
          <Popconfirm
            title="确定要删除这个物流商吗？"
            onConfirm={() => onDelete(provider.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger>
              <DeleteOutlined /> 删除
            </Button>
          </Popconfirm>
        </Space>
      </div>
    </Card>
  );
};

const LogisticsManagement = () => {
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    loadProviders();
  }, [page, pageSize, searchText, activeTab, regionFilter, typeFilter]);

  const loadProviders = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        pageSize,
        search: searchText || undefined,
        provider_type: typeFilter !== 'all' ? typeFilter : undefined,
        is_active: activeTab === 'authorized' ? 'true' : undefined
      };

      const response = await axios.get('/api/logistics/providers', { params });
      
      if (response.data.success) {
        setProviders(response.data.data);
        setTotal(response.data.total);
      }
    } catch (error) {
      message.error('加载物流商列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingProvider(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingProvider(record);
    form.setFieldsValue({
      ...record,
      service_areas: record.service_areas?.join(',') || ''
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      const response = await axios.delete(`/api/logistics/providers/${id}`);
      if (response.data.success) {
        message.success('删除成功');
        loadProviders();
      }
    } catch (error) {
      message.error('删除失败');
      console.error(error);
    }
  };

  const handleUse = (provider) => {
    message.success(`已选择使用 ${provider.provider_name}`);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (values.service_areas) {
        values.service_areas = values.service_areas.split(',').map(s => s.trim()).filter(Boolean);
      }

      const url = editingProvider
        ? `/api/logistics/providers/${editingProvider.id}`
        : '/api/logistics/providers';
      
      const method = editingProvider ? 'put' : 'post';
      
      const response = await axios[method](url, values);
      
      if (response.data.success) {
        message.success(editingProvider ? '更新成功' : '创建成功');
        setModalVisible(false);
        loadProviders();
      }
    } catch (error) {
      if (error.response?.data?.message) {
        message.error(error.response.data.message);
      } else {
        message.error('操作失败');
      }
      console.error(error);
    }
  };

  // 区域筛选选项
  const regionOptions = [
    { label: '全部', value: 'all' },
    { label: '东南亚', value: 'southeast_asia' },
    { label: '美洲', value: 'americas' },
    { label: '欧洲', value: 'europe' },
    { label: '日韩', value: 'japan_korea' },
    { label: '拉美', value: 'latin_america' },
    { label: '中东', value: 'middle_east' },
    { label: '非洲', value: 'africa' },
    { label: '俄罗斯', value: 'russia' },
    { label: '其他', value: 'other' }
  ];

  // 类型筛选选项
  const typeOptions = [
    { label: '全部', value: 'all' },
    { label: 'Temu合作仓', value: 'temu' },
    { label: 'TikTok合作仓', value: 'tiktok' },
    { label: 'Shopee合作仓', value: 'shopee' },
    { label: '其他服务仓', value: 'other' }
  ];

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100%', padding: '0' }}>
      {/* 顶部标签页 */}
      <div style={{ 
        background: '#fff', 
        padding: '0 24px',
        borderBottom: '1px solid #e8e8e8'
      }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'all', label: <span style={{ padding: '0 16px' }}>仓库服务商</span> },
            { key: 'authorized', label: <span style={{ padding: '0 16px' }}>已授权仓库</span> }
          ]}
          style={{ marginBottom: 0 }}
          tabBarStyle={{ marginBottom: 0 }}
        />
      </div>

      {/* 搜索栏 */}
      <div style={{ 
        background: '#fff', 
        padding: '16px 24px',
        borderBottom: '1px solid #e8e8e8',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Input
            placeholder="输入服务商名称、支持模糊搜索"
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: '300px' }}
            allowClear
          />
          <Button type="primary" icon={<SearchOutlined />} style={{ backgroundColor: '#00b96b', borderColor: '#00b96b' }}>
            搜索
          </Button>
        </div>
        <div style={{ color: '#1890ff', cursor: 'pointer' }}>
          找不到海外仓？请在线申请对接！
        </div>
      </div>

      {/* 筛选区域 */}
      <div style={{ 
        background: '#fff', 
        padding: '12px 24px',
        borderBottom: '1px solid #e8e8e8'
      }}>
        <div style={{ marginBottom: '8px' }}>
          <span style={{ color: '#666', marginRight: '12px' }}>适用地区：</span>
          {regionOptions.map(option => (
            <Tag
              key={option.value}
              color={regionFilter === option.value ? '#1890ff' : undefined}
              style={{ 
                cursor: 'pointer', 
                marginRight: '8px',
                marginBottom: '4px'
              }}
              onClick={() => setRegionFilter(option.value)}
            >
              {option.label}
            </Tag>
          ))}
        </div>
        <div>
          <span style={{ color: '#666', marginRight: '12px' }}>类&emsp;&emsp;型：</span>
          {typeOptions.map(option => (
            <Tag
              key={option.value}
              color={typeFilter === option.value ? '#1890ff' : undefined}
              style={{ 
                cursor: 'pointer', 
                marginRight: '8px',
                marginBottom: '4px'
              }}
              onClick={() => setTypeFilter(option.value)}
            >
              {option.label}
            </Tag>
          ))}
        </div>
      </div>

      {/* 卡片列表 */}
      <div style={{ padding: '24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px' }}>加载中...</div>
        ) : providers.length === 0 ? (
          <Empty description="暂无物流服务商" />
        ) : (
          <>
            <Row gutter={[16, 16]}>
              {providers.map(provider => (
                <Col key={provider.id} xs={24} sm={12} md={8} lg={6} xl={6}>
                  <ProviderCard
                    provider={provider}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onUse={handleUse}
                  />
                </Col>
              ))}
            </Row>
            
            {/* 分页 */}
            <div style={{ 
              marginTop: '24px', 
              textAlign: 'right',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: '16px'
            }}>
              <span style={{ color: '#666' }}>{total}条</span>
              <Pagination
                current={page}
                pageSize={pageSize}
                total={total}
                showSizeChanger
                showQuickJumper
                onChange={(p, ps) => {
                  setPage(p);
                  setPageSize(ps);
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* 添加/编辑物流商模态框 */}
      <Modal
        title={editingProvider ? '编辑物流服务商' : '添加物流服务商'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        width={800}
        okText="确定"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            provider_type: 'warehouse',
            is_active: true,
            priority: 0
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="服务商名称"
                name="provider_name"
                rules={[{ required: true, message: '请输入服务商名称' }]}
              >
                <Input placeholder="如：海拓海外仓" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="服务商代码"
                name="provider_code"
                rules={[{ required: true, message: '请输入服务商代码' }]}
              >
                <Input placeholder="如：HAITUO" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="服务类型"
                name="provider_type"
                rules={[{ required: true, message: '请选择服务类型' }]}
              >
                <Select>
                  <Option value="warehouse">海外仓</Option>
                  <Option value="express">快递</Option>
                  <Option value="freight">货运</Option>
                  <Option value="international">国际物流</Option>
                  <Option value="other">其他</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="优先级"
                name="priority"
                tooltip="数字越大优先级越高"
              >
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Logo URL"
            name="logo_url"
          >
            <Input placeholder="服务商Logo图片地址" />
          </Form.Item>

          <Divider orientation="left">API配置</Divider>

          <Form.Item
            label="API地址"
            name="api_url"
          >
            <Input placeholder="https://api.example.com" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="API Key"
                name="api_key"
              >
                <Input.Password placeholder="API密钥" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="API Secret"
                name="api_secret"
              >
                <Input.Password placeholder="API密钥" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="应用ID"
                name="app_id"
              >
                <Input placeholder="应用ID" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="客户代码"
                name="customer_code"
              >
                <Input placeholder="客户代码" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">联系信息</Divider>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="联系人"
                name="contact_person"
              >
                <Input placeholder="联系人姓名" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="联系电话"
                name="contact_phone"
              >
                <Input placeholder="联系电话" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="联系邮箱"
                name="contact_email"
              >
                <Input placeholder="联系邮箱" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="服务区域"
            name="service_areas"
            tooltip="多个区域用逗号分隔，如：马来,新加坡,美国,加拿大"
          >
            <Input placeholder="服务区域，用逗号分隔" />
          </Form.Item>

          <Form.Item
            label="服务描述"
            name="remark"
          >
            <TextArea rows={3} placeholder="服务商描述信息" />
          </Form.Item>

          <Form.Item
            label="启用状态"
            name="is_active"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LogisticsManagement;
