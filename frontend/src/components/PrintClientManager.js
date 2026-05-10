import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, Table, Tag, message, Popconfirm, Space, Tooltip } from 'antd';
import { PlusOutlined, ReloadOutlined, DeleteOutlined, CheckCircleOutlined, CloseCircleOutlined, DesktopOutlined } from '@ant-design/icons';

const PrintClientManager = ({ visible, onClose }) => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible) {
      loadClients();
    }
  }, [visible]);

  // 获取API基础URL，自动匹配当前协议
  const getApiBaseUrl = () => {
    if (process.env.REACT_APP_API_URL) {
      return process.env.REACT_APP_API_URL;
    }
    return '/api';
  };

  const loadClients = async () => {
    setLoading(true);
    try {
      const apiUrl = getApiBaseUrl();
      console.log('PrintClientManager: 加载客户端列表, API URL:', apiUrl);
      const response = await fetch(`${apiUrl}/remote-print/clients`);
      const data = await response.json();
      console.log('PrintClientManager: 客户端列表响应:', data);
      if (data.success) {
        setClients(data.data || []);
      }
    } catch (error) {
      console.error('加载客户端失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddClient = async (values) => {
    try {
      const apiUrl = getApiBaseUrl();
      const response = await fetch(`${apiUrl}/remote-print/http-clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: `http-${Date.now()}`,
          clientName: values.clientName,
          url: values.url.replace(/\/$/, '')
        })
      });
      const data = await response.json();
      if (data.success) {
        message.success(data.message);
        setAddModalVisible(false);
        form.resetFields();
        loadClients();
      } else {
        message.error(data.message || '添加失败');
      }
    } catch (error) {
      message.error('添加客户端失败');
    }
  };

  const handleDeleteClient = async (clientId) => {
    try {
      const apiUrl = getApiBaseUrl();
      const response = await fetch(`${apiUrl}/remote-print/http-clients/${clientId}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        message.success('删除成功');
        loadClients();
      } else {
        message.error(data.message || '删除失败');
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleRefreshClient = async (clientId) => {
    try {
      const apiUrl = getApiBaseUrl();
      const response = await fetch(`${apiUrl}/remote-print/http-clients/${clientId}/refresh`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        message.success('刷新成功');
        loadClients();
      } else {
        message.warning(data.message || '客户端离线');
        loadClients();
      }
    } catch (error) {
      message.error('刷新失败');
    }
  };

  const columns = [
    {
      title: '客户端名称',
      dataIndex: 'clientName',
      key: 'clientName',
      render: (text, record) => (
        <Space>
          <DesktopOutlined />
          <span>{text}</span>
          <Tag color={record.type === 'http' ? 'blue' : 'green'}>
            {record.type === 'http' ? 'HTTP' : 'Socket'}
          </Tag>
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'online',
      key: 'online',
      width: 100,
      render: (online) => (
        online ? (
          <Tag icon={<CheckCircleOutlined />} color="success">在线</Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="error">离线</Tag>
        )
      )
    },
    {
      title: '打印机数量',
      dataIndex: 'printers',
      key: 'printers',
      width: 100,
      render: (printers) => (
        <Tooltip title={printers?.map(p => p.name || p).join(', ') || '无'}>
          <span>{printers?.length || 0} 台</span>
        </Tooltip>
      )
    },
    {
      title: '地址',
      dataIndex: 'url',
      key: 'url',
      ellipsis: true,
      render: (url) => url || '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          {record.type === 'http' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => handleRefreshClient(record.clientId)}
              >
                刷新
              </Button>
              <Popconfirm
                title="确定删除此客户端?"
                onConfirm={() => handleDeleteClient(record.clientId)}
              >
                <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      )
    }
  ];

  return (
    <>
      <Modal
        title="打印客户端管理"
        open={visible}
        onCancel={onClose}
        width={800}
        footer={null}
      >
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Button icon={<PlusOutlined />} type="primary" onClick={() => setAddModalVisible(true)}>
            添加HTTP客户端
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadClients} loading={loading}>
            刷新列表
          </Button>
        </div>
        
        <Table
          columns={columns}
          dataSource={clients}
          rowKey="clientId"
          loading={loading}
          pagination={false}
          size="small"
        />
        
        <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
          <h4 style={{ margin: '0 0 8px 0' }}>使用说明</h4>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#666' }}>
            <li>HTTP客户端：需要在目标电脑上运行 PrintClient 打印程序</li>
            <li>Socket客户端：通过浏览器扩展连接（自动显示）</li>
            <li>添加HTTP客户端时，请确保打印程序已启动并监听指定端口</li>
            <li>默认端口为 9100，地址格式：http://IP地址:9100</li>
          </ul>
        </div>
      </Modal>

      <Modal
        title="添加HTTP打印客户端"
        open={addModalVisible}
        onCancel={() => {
          setAddModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={400}
      >
        <Form form={form} layout="vertical" onFinish={handleAddClient}>
          <Form.Item
            name="clientName"
            label="客户端名称"
            rules={[{ required: true, message: '请输入客户端名称' }]}
          >
            <Input placeholder="例如：仓库打印机、办公室打印机" />
          </Form.Item>
          <Form.Item
            name="url"
            label="服务地址"
            rules={[
              { required: true, message: '请输入服务地址' },
              { pattern: /^https?:\/\//, message: '请输入有效的HTTP地址' }
            ]}
          >
            <Input placeholder="http://192.168.1.100:9100" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={() => {
                setAddModalVisible(false);
                form.resetFields();
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                添加
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default PrintClientManager;
