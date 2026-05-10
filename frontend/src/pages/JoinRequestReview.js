import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Popconfirm, Space, Table, Tag, Typography, message } from 'antd';
import { enterpriseAPI } from '../api';
import { getStoredAuthState } from '../utils/authStorage';

const { Paragraph, Text, Title } = Typography;

function JoinRequestReview() {
  const [joinRequests, setJoinRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [canReviewJoinRequests, setCanReviewJoinRequests] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const authState = getStoredAuthState();
  const currentEnterprise = authState.currentEnterprise || null;
  const currentEnterpriseCode = currentEnterprise?.enterpriseCode || currentEnterprise?.enterprise_code || '';

  const pendingCount = useMemo(
    () => joinRequests.filter((item) => (item.status || '').toUpperCase() === 'PENDING').length,
    [joinRequests]
  );

  const fetchJoinRequests = async () => {
    setRequestsLoading(true);
    try {
      const response = await enterpriseAPI.getJoinRequests({ status: 'PENDING' });
      if (response.data.success) {
        setJoinRequests(response.data.data || []);
        setCanReviewJoinRequests(true);
        setErrorMessage('');
      } else {
        setJoinRequests([]);
        setCanReviewJoinRequests(false);
        setErrorMessage(response.data.message || '当前账号暂无审核权限');
      }
    } catch (error) {
      setJoinRequests([]);
      setCanReviewJoinRequests(false);
      setErrorMessage(error.response?.data?.message || '当前账号暂无审核权限');
    } finally {
      setRequestsLoading(false);
    }
  };

  useEffect(() => {
    fetchJoinRequests();
  }, []);

  const handleApprove = async (requestId) => {
    try {
      const response = await enterpriseAPI.approveJoinRequest(requestId);
      if (response.data.success) {
        message.success(response.data.message || '加入申请已通过');
        fetchJoinRequests();
      } else {
        message.error(response.data.message || '审批失败');
      }
    } catch (error) {
      message.error(error.response?.data?.message || '审批失败');
    }
  };

  const handleReject = async (requestId) => {
    try {
      const response = await enterpriseAPI.rejectJoinRequest(requestId);
      if (response.data.success) {
        message.success(response.data.message || '加入申请已拒绝');
        fetchJoinRequests();
      } else {
        message.error(response.data.message || '拒绝失败');
      }
    } catch (error) {
      message.error(error.response?.data?.message || '拒绝失败');
    }
  };

  const formatDateTime = (value) => {
    if (!value) {
      return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    const pad = (num) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const columns = [
    {
      title: '申请人',
      key: 'applicant',
      render: (_, record) => record.real_name || record.realName || record.username || '-'
    },
    {
      title: '账号',
      dataIndex: 'username',
      key: 'username',
      render: (value) => value || '-'
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      render: (value) => value || '-'
    },
    {
      title: '联系邮箱',
      dataIndex: 'email',
      key: 'email',
      render: (value) => value || '-'
    },
    {
      title: '申请备注',
      dataIndex: 'applicant_message',
      key: 'applicant_message',
      render: (value) => value || '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (value) => {
        const normalized = (value || '').toUpperCase();
        const color = normalized === 'PENDING' ? 'processing' : normalized === 'APPROVED' ? 'success' : normalized === 'REJECTED' ? 'error' : 'default';
        return <Tag color={color}>{value || '-'}</Tag>;
      }
    },
    {
      title: '申请时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (value) => formatDateTime(value)
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space>
          <Popconfirm title="确认通过该加入申请？" onConfirm={() => handleApprove(record.id)}>
            <Button type="primary" size="small">通过</Button>
          </Popconfirm>
          <Popconfirm title="确认拒绝该加入申请？" onConfirm={() => handleReject(record.id)}>
            <Button danger size="small">拒绝</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="加入申请审核"
        extra={(
          <Button onClick={fetchJoinRequests} loading={requestsLoading}>
            刷新
          </Button>
        )}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <Title level={4} style={{ marginBottom: 8 }}>企业成员加入审核</Title>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              当前企业：{currentEnterprise?.companyName || '-'}
              {currentEnterpriseCode ? `（${currentEnterpriseCode}）` : ''}
            </Paragraph>
          </div>

          {canReviewJoinRequests ? (
            <Alert
              type="info"
              showIcon
              message={`当前待审核申请 ${pendingCount} 条`}
              description="企业管理员可以在这里统一处理所有待审批的加入申请。"
            />
          ) : (
            <Alert
              type="warning"
              showIcon
              message="当前账号暂无审核权限"
              description={errorMessage || '只有当前企业的管理员或所有者可以查看并审批加入申请。'}
            />
          )}

          {canReviewJoinRequests && (
            <Table
              rowKey="id"
              columns={columns}
              dataSource={joinRequests}
              loading={requestsLoading}
              pagination={false}
              locale={{ emptyText: <Empty description="暂无待审核加入申请" /> }}
              scroll={{ x: 1100 }}
            />
          )}

          {!canReviewJoinRequests && (
            <Card size="small" bordered={false} style={{ background: '#fafafa' }}>
              <Text type="secondary">请切换到有权限的企业管理员账号后再进行审核。</Text>
            </Card>
          )}
        </Space>
      </Card>
    </div>
  );
}

export default JoinRequestReview;
