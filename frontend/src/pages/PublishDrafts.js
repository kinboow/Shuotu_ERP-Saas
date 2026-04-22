import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  message,
  Modal,
  Input,
  Select,
  Image,
  Popconfirm,
  Empty
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  SendOutlined,
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Search } = Input;
const { Option } = Select;

function PublishDrafts() {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({
    keyword: '',
    draftType: '', // 'platform' 或 'erp'
    platform: '' // 'shein', 'temu', 'tiktok'
  });
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewDraft, setPreviewDraft] = useState(null);

  useEffect(() => {
    fetchDrafts();
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchDrafts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.current,
        limit: pagination.pageSize,
        ...(filters.keyword && { keyword: filters.keyword }),
        ...(filters.draftType && { draftType: filters.draftType }),
        ...(filters.platform && { platform: filters.platform })
      });

      const response = await fetch(`/api/publish-drafts?${params}`);
      const result = await response.json();

      if (result.success) {
        setDrafts(result.data || []);
        setPagination(prev => ({ 
          ...prev, 
          total: result.total || 0 
        }));
      } else {
        throw new Error(result.message || '获取草稿失败');
      }
    } catch (error) {
      console.error('获取草稿失败:', error);
      message.error('获取草稿失败: ' + error.message);
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record) => {
    if (record.draftType === 'platform') {
      navigate('/platform-listed', { state: { draftId: record.id } });
    } else {
      navigate('/erp-listed', { state: { draftId: record.id } });
    }
  };

  const handleDelete = async (id) => {
    try {
      // TODO: 实现删除API
      message.success('草稿已删除');
      fetchDrafts();
    } catch (error) {
      message.error('删除失败: ' + error.message);
    }
  };

  const handlePublish = async (record) => {
    Modal.confirm({
      title: '确认发布',
      content: `确定要发布草稿"${record.title}"吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          // TODO: 实现发布API
          message.success('发布成功！');
          fetchDrafts();
        } catch (error) {
          message.error('发布失败: ' + error.message);
        }
      }
    });
  };

  const handlePreview = (record) => {
    setPreviewDraft(record);
    setPreviewVisible(true);
  };

  const columns = [
    {
      title: '商品信息',
      key: 'product',
      width: 300,
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 12 }}>
          {record.mainImage ? (
            <Image
              width={60}
              height={60}
              src={record.mainImage}
              style={{ objectFit: 'cover', borderRadius: 4 }}
            />
          ) : (
            <div style={{
              width: 60,
              height: 60,
              backgroundColor: '#e8e8e8',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#999',
              fontSize: 12
            }}>
              无图
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>{record.title}</div>
            <div style={{ fontSize: 12, color: '#666' }}>
              {record.draftType === 'erp' && `ERP产品ID: ${record.erpProductId}`}
            </div>
          </div>
        </div>
      )
    },
    {
      title: '草稿类型',
      dataIndex: 'draftType',
      key: 'draftType',
      width: 120,
      render: (type) => (
        <Tag color={type === 'platform' ? 'blue' : 'green'}>
          {type === 'platform' ? '按平台刊登' : 'ERP产品刊登'}
        </Tag>
      )
    },
    {
      title: '目标平台',
      dataIndex: 'platforms',
      key: 'platforms',
      width: 150,
      render: (platforms) => (
        <Space size={4} wrap>
          {platforms.map(platform => {
            const config = {
              shein: { color: 'purple', text: 'SHEIN' },
              temu: { color: 'orange', text: 'TEMU' },
              tiktok: { color: 'cyan', text: 'TikTok' }
            };
            const { color, text } = config[platform] || { color: 'default', text: platform };
            return <Tag key={platform} color={color}>{text}</Tag>;
          })}
        </Space>
      )
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      width: 100,
      align: 'right',
      render: (price) => `¥${price?.toFixed(2) || '0.00'}`
    },
    {
      title: '库存',
      dataIndex: 'stock',
      key: 'stock',
      width: 80,
      align: 'right'
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 160
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handlePreview(record)}
          >
            预览
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<SendOutlined />}
            onClick={() => handlePublish(record)}
          >
            发布
          </Button>
          <Popconfirm
            title="确定要删除这个草稿吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        {/* 筛选栏 */}
        <div style={{ marginBottom: 16 }}>
          <Space size="middle" wrap>
            <Search
              placeholder="搜索商品名称"
              value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
              onSearch={fetchDrafts}
              style={{ width: 250 }}
              allowClear
            />
            <Select
              placeholder="草稿类型"
              value={filters.draftType || undefined}
              onChange={(value) => setFilters({ ...filters, draftType: value })}
              style={{ width: 150 }}
              allowClear
            >
              <Option value="">全部类型</Option>
              <Option value="platform">按平台刊登</Option>
              <Option value="erp">ERP产品刊登</Option>
            </Select>
            <Select
              placeholder="目标平台"
              value={filters.platform || undefined}
              onChange={(value) => setFilters({ ...filters, platform: value })}
              style={{ width: 120 }}
              allowClear
            >
              <Option value="">全部平台</Option>
              <Option value="shein">SHEIN</Option>
              <Option value="temu">TEMU</Option>
              <Option value="tiktok">TikTok</Option>
            </Select>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={fetchDrafts}
            >
              搜索
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchDrafts}
            >
              刷新
            </Button>
          </Space>
        </div>

        {/* 表格 */}
        <Table
          columns={columns}
          dataSource={drafts}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => {
              setPagination({ ...pagination, current: page, pageSize });
            }
          }}
          scroll={{ x: 1200 }}
          locale={{
            emptyText: (
              <Empty
                description="暂无草稿"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Button
                  type="primary"
                  onClick={() => navigate('/publish-product')}
                >
                  创建草稿
                </Button>
              </Empty>
            )
          }}
        />
      </Card>

      {/* 预览模态框 */}
      <Modal
        title="草稿预览"
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={[
          <Button key="close" onClick={() => setPreviewVisible(false)}>
            关闭
          </Button>,
          <Button
            key="edit"
            type="primary"
            onClick={() => {
              setPreviewVisible(false);
              handleEdit(previewDraft);
            }}
          >
            编辑
          </Button>
        ]}
        width={800}
      >
        {previewDraft && (
          <div>
            <div style={{ marginBottom: 16, textAlign: 'center' }}>
              {previewDraft.mainImage && (
                <Image
                  src={previewDraft.mainImage}
                  style={{ maxWidth: '100%', maxHeight: 300 }}
                />
              )}
            </div>
            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 12 }}>
              {previewDraft.title}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px 16px' }}>
              <div style={{ color: '#666' }}>草稿类型：</div>
              <div>
                <Tag color={previewDraft.draftType === 'platform' ? 'blue' : 'green'}>
                  {previewDraft.draftType === 'platform' ? '按平台刊登' : 'ERP产品刊登'}
                </Tag>
              </div>
              <div style={{ color: '#666' }}>目标平台：</div>
              <div>
                <Space size={4}>
                  {previewDraft.platforms?.map(platform => {
                    const config = {
                      shein: { color: 'purple', text: 'SHEIN' },
                      temu: { color: 'orange', text: 'TEMU' },
                      tiktok: { color: 'cyan', text: 'TikTok' }
                    };
                    const { color, text } = config[platform] || { color: 'default', text: platform };
                    return <Tag key={platform} color={color}>{text}</Tag>;
                  })}
                </Space>
              </div>
              <div style={{ color: '#666' }}>价格：</div>
              <div>¥{previewDraft.price?.toFixed(2) || '0.00'}</div>
              <div style={{ color: '#666' }}>库存：</div>
              <div>{previewDraft.stock || 0}</div>
              <div style={{ color: '#666' }}>创建时间：</div>
              <div>{previewDraft.createdAt}</div>
              <div style={{ color: '#666' }}>更新时间：</div>
              <div>{previewDraft.updatedAt}</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default PublishDrafts;
