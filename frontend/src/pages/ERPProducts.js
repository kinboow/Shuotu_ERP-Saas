import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  Space,
  message,
  Popconfirm
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined
} from '@ant-design/icons';

function ERPProducts() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });

  useEffect(() => {
    fetchProducts();
  }, [pagination.current, pagination.pageSize]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/erp-products?page=${pagination.current}&pageSize=${pagination.pageSize}`
      );
      const data = await response.json();
      
      if (data.success) {
        // 兼容两种数据格式
        const list = Array.isArray(data.data) ? data.data : (data.data?.list || []);
        const total = data.total || data.data?.total || list.length;
        setProducts(list);
        setPagination({
          ...pagination,
          total
        });
      }
    } catch (error) {
      console.error('获取商品列表失败:', error);
      message.error('获取商品列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    navigate('/erp-products/create');
  };

  const handleEdit = (record) => {
    navigate(`/erp-products/edit/${record.id}`);
  };

  const handleDelete = async (id) => {
    try {
      const response = await fetch(`/api/erp-products/${id}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      
      if (data.success) {
        message.success('删除成功');
        fetchProducts();
      } else {
        message.error(data.message || '删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  const columns = [
    {
      title: '商品编码',
      dataIndex: 'product_code',
      key: 'product_code',
      width: 150,
      fixed: 'left',
      render: (text) => (
        <span style={{ 
          fontFamily: 'monospace', 
          fontWeight: 'bold',
          color: text?.startsWith('XT') ? '#1890ff' : '#333'
        }}>
          {text}
        </span>
      )
    },
    {
      title: '商品名称',
      dataIndex: 'product_name_cn',
      key: 'product_name_cn',
      width: 200,
      render: (text, record) => (
        <div>
          <div>{text}</div>
          <div style={{ fontSize: '12px', color: '#999' }}>
            {record.product_name_en}
          </div>
        </div>
      )
    },
    {
      title: '品牌',
      dataIndex: 'brand',
      key: 'brand',
      width: 120
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 150
    },
    {
      title: '成本价',
      dataIndex: 'cost_price',
      key: 'cost_price',
      width: 100,
      render: (text) => `¥${text || 0}`
    },
    {
      title: '建议零售价',
      dataIndex: 'suggested_price',
      key: 'suggested_price',
      width: 120,
      render: (text) => `¥${text || 0}`
    },

    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text) => text ? new Date(text).toLocaleString('zh-CN') : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个商品吗？"
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
    <div>
      <Card
        title="ERP商品管理"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            创建商品
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={products}
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
          scroll={{ x: 1500 }}
        />
      </Card>

    </div>
  );
}

export default ERPProducts;
