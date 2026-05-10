import React, { useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  Radio,
  Row,
  Space,
  Steps,
  Typography,
  Upload,
  message
} from 'antd';
import {
  BankOutlined,
  HomeOutlined,
  LoadingOutlined,
  MailOutlined,
  PhoneOutlined,
  TeamOutlined,
  UploadOutlined,
  UserOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authAPI, enterpriseAPI } from '../api';
import { getStoredAuthState, saveAuthSession } from '../utils/authStorage';

const { Paragraph, Text, Title } = Typography;
const { TextArea } = Input;

const getOssUrl = () => {
  if (process.env.REACT_APP_OSS_URL) {
    return process.env.REACT_APP_OSS_URL;
  }
  return '';
};

const pageStyle = {
  minHeight: '100vh',
  background: '#f0f2f5',
  padding: 24
};

const pageContainerStyle = {
  maxWidth: 1080,
  margin: '0 auto'
};

const mainCardStyle = {
  borderRadius: 8,
  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
};

const contentCardStyle = {
  background: '#fff',
  borderRadius: 8,
  border: '1px solid #f0f0f0'
};

const sectionHeaderStyle = {
  padding: '16px 24px',
  margin: '-32px -32px 24px',
  borderBottom: '1px solid #f0f0f0',
  background: '#fff'
};

const stepPanelStyle = {
  background: '#fafafa',
  border: '1px solid #f0f0f0',
  borderRadius: 8,
  padding: 16,
  marginBottom: 24
};

const actionBarStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: 24,
  paddingTop: 16,
  borderTop: '1px solid #f0f0f0'
};

const primaryActionBarStyle = {
  ...actionBarStyle,
  justifyContent: 'flex-end'
};

function EnterpriseOnboarding() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('create');
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [realName, setRealName] = useState('');
  const [pendingJoinRequests, setPendingJoinRequests] = useState([]);
  const [createForm] = Form.useForm();
  const [joinForm] = Form.useForm();

  const pendingApprovalRequests = pendingJoinRequests.filter(
    (item) => (item.status || '').toUpperCase() === 'PENDING'
  );
  const hasPendingJoinRequest = pendingApprovalRequests.length > 0;

  useEffect(() => {
    const init = async () => {
      const authState = getStoredAuthState();
      setPendingJoinRequests(authState.pendingJoinRequests || []);

      try {
        const response = await authAPI.getCurrentUser();
        if (!response.data.success) {
          message.error(response.data.message || '获取账户信息失败');
          navigate('/login', { replace: true });
          return;
        }

        saveAuthSession(response.data.data);
        const nextState = getStoredAuthState();
        setPendingJoinRequests(nextState.pendingJoinRequests || []);
        setRealName(nextState.user?.realName || '');

        if (!nextState.requiresEnterpriseSelection && nextState.currentEnterprise?.id) {
          navigate('/', { replace: true });
          return;
        }
      } catch (error) {
        message.error(error.response?.data?.message || '获取账户信息失败');
        navigate('/login', { replace: true });
        return;
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [navigate]);

  const refreshSession = async () => {
    const response = await authAPI.getCurrentUser();
    if (response.data.success) {
      saveAuthSession(response.data.data);
      const nextState = getStoredAuthState();
      setPendingJoinRequests(nextState.pendingJoinRequests || []);
      return nextState;
    }

    throw new Error(response.data.message || '刷新账户状态失败');
  };

  const persistRealName = async () => {
    const response = await authAPI.updateProfile({ realName });
    if (!response.data.success) {
      throw new Error(response.data.message || '保存真实姓名失败');
    }

    if (response.data.data?.user) {
      const currentState = getStoredAuthState();
      saveAuthSession({
        user: {
          ...(currentState.user || {}),
          ...response.data.data.user
        }
      });
    }
  };

  const handleCreateEnterprise = async (values) => {
    if (hasPendingJoinRequest) {
      message.warning('你已有待审批的加入申请，暂时不能继续新增企业归属信息');
      return;
    }

    setSubmitting(true);
    try {
      const formValues = {
        ...values,
        ...createForm.getFieldsValue(true)
      };
      const companyName = String(formValues.companyName || '').trim();

      if (!companyName) {
        setCurrentStep(2);
        createForm.setFields([
          {
            name: 'companyName',
            errors: ['请输入企业名称']
          }
        ]);
        message.error('请输入企业名称');
        return;
      }

      await persistRealName();

      const response = await enterpriseAPI.create({
        ...formValues,
        companyName,
        logoUrl
      });

      if (!response.data.success) {
        message.error(response.data.message || '创建企业失败');
        return;
      }

      const createdEnterprise = response.data.data;
      const selectResponse = await authAPI.selectEnterprise({ enterpriseId: createdEnterprise.id });
      if (!selectResponse.data.success) {
        message.error(selectResponse.data.message || '切换企业失败');
        return;
      }

      saveAuthSession(selectResponse.data.data);
      message.success('企业创建成功，欢迎进入系统');
      navigate('/', { replace: true });
    } catch (error) {
      message.error(error.response?.data?.message || error.message || '创建企业失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinEnterprise = async (values) => {
    if (hasPendingJoinRequest) {
      message.warning('你已有待审批的加入申请，请等待管理员审核');
      return;
    }

    setSubmitting(true);
    try {
      await persistRealName();

      const response = await enterpriseAPI.createJoinRequest(values);
      if (!response.data.success) {
        message.error(response.data.message || '提交加入申请失败');
        return;
      }

      const nextState = await refreshSession();
      setMode('join');
      joinForm.resetFields();
      message.success(response.data.message || '加入申请已提交');

      if (!nextState.requiresEnterpriseSelection && nextState.currentEnterprise?.id) {
        navigate('/', { replace: true });
      }
    } catch (error) {
      message.error(error.response?.data?.message || error.message || '提交加入申请失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogoUpload = async (file) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('只能上传图片文件');
      return false;
    }

    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) {
      message.error('图片大小不能超过2MB');
      return false;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'permanent');

      const response = await fetch(`${getOssUrl()}/upload`, {
        method: 'POST',
        body: formData
      });
      const result = await response.json();

      if (result.success) {
        setLogoUrl(result.data.signedUrl);
        message.success('Logo上传成功');
      } else {
        message.error(result.message || '上传失败');
      }
    } catch (error) {
      message.error(`上传失败: ${error.message}`);
    } finally {
      setUploading(false);
    }

    return false;
  };

  const stepItems = mode === 'create'
    ? [
        { title: '账户信息' },
        { title: '选择方式' },
        { title: '企业基础' },
        { title: '企业详情' }
      ]
    : [
        { title: '账户信息' },
        { title: '选择方式' },
        { title: '加入企业' }
      ];

  const handleModeChange = (e) => {
    if (hasPendingJoinRequest) {
      return;
    }

    setMode(e.target.value);
  };

  const handleNext = async () => {
    if (hasPendingJoinRequest) {
      return;
    }

    if (currentStep === 0) {
      setCurrentStep(1);
      return;
    }

    if (currentStep === 1) {
      setCurrentStep(2);
      return;
    }

    if (mode === 'create' && currentStep === 2) {
      await createForm.validateFields(['companyName']);
      setCurrentStep(3);
    }
  };

  const handlePrev = () => {
    if (hasPendingJoinRequest) {
      return;
    }

    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const renderStepContent = () => {
    if (currentStep === 0) {
      return (
        <Card bordered={false} style={contentCardStyle}>
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Title level={4} style={{ marginBottom: 0 }}>先完善你的账户信息</Title>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              这一步只需要填写你的基础资料，后续可在个人中心继续修改。
            </Paragraph>
          </Space>
          <Form layout="vertical" style={{ marginTop: 24 }}>
            <Row gutter={24}>
              <Col xs={24} md={12}>
                <Form.Item label="真实姓名">
                  <Input
                    prefix={<UserOutlined />}
                    value={realName}
                    onChange={(e) => setRealName(e.target.value)}
                    placeholder="真实姓名（可选）"
                    maxLength={50}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Card>
      );
    }

    if (currentStep === 1) {
      return (
        <Card bordered={false} style={contentCardStyle}>
          <Space direction="vertical" size={8} style={{ width: '100%', marginBottom: 24 }}>
            <Title level={4} style={{ marginBottom: 0 }}>选择企业归属方式</Title>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              你可以创建一个全新的企业，或者申请加入已有企业。
            </Paragraph>
          </Space>

          <Radio.Group
            value={mode}
            onChange={handleModeChange}
            style={{ width: '100%' }}
          >
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Card
                size="small"
                hoverable
                onClick={() => setMode('create')}
                style={{ borderColor: mode === 'create' ? '#1677ff' : '#f0f0f0', background: mode === 'create' ? '#f0f7ff' : '#fff' }}
              >
                <Radio value="create">创建企业</Radio>
                <Paragraph type="secondary" style={{ margin: '8px 0 0 24px' }}>
                  适合首次使用系统，创建你的专属企业并成为管理员。
                </Paragraph>
              </Card>
              <Card
                size="small"
                hoverable
                onClick={() => setMode('join')}
                style={{ borderColor: mode === 'join' ? '#1677ff' : '#f0f0f0', background: mode === 'join' ? '#f0f7ff' : '#fff' }}
              >
                <Radio value="join">加入企业</Radio>
                <Paragraph type="secondary" style={{ margin: '8px 0 0 24px' }}>
                  使用企业编码提交加入申请，等待企业管理员审核后即可进入系统。
                </Paragraph>
              </Card>
            </Space>
          </Radio.Group>
        </Card>
      );
    }

    if (mode === 'create' && currentStep === 2) {
      return (
        <Card bordered={false} style={contentCardStyle}>
          <Form form={createForm} layout="vertical" preserve>
            <Row gutter={24}>
              <Col span={24}>
                <div style={{ ...stepPanelStyle, textAlign: 'center' }}>
                  <Avatar size={88} src={logoUrl} icon={<BankOutlined />} style={{ backgroundColor: '#1677ff' }} />
                  <div style={{ marginTop: 12 }}>
                    <Upload showUploadList={false} accept="image/*" beforeUpload={handleLogoUpload}>
                      <Button icon={uploading ? <LoadingOutlined /> : <UploadOutlined />} loading={uploading}>
                        {uploading ? '上传中...' : '上传企业Logo'}
                      </Button>
                    </Upload>
                  </div>
                </div>
              </Col>
            </Row>

            <Row gutter={24}>
              <Col xs={24} md={12}>
                <Form.Item name="companyName" label="企业名称" rules={[{ required: true, whitespace: true, message: '请输入企业名称' }]}>
                  <Input prefix={<BankOutlined />} placeholder="请输入企业全称" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="companyShortName" label="企业简称">
                  <Input placeholder="请输入企业简称" />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Card>
      );
    }

    if (mode === 'create' && currentStep === 3) {
      return (
        <Card bordered={false} style={contentCardStyle}>
          <Form form={createForm} layout="vertical" preserve onFinish={handleCreateEnterprise}>
            <Row gutter={24}>
              <Col xs={24} md={12}>
                <Form.Item name="contactPerson" label="联系人">
                  <Input prefix={<UserOutlined />} placeholder="请输入联系人姓名" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="contactPhone" label="联系电话">
                  <Input prefix={<PhoneOutlined />} placeholder="请输入联系电话" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={24}>
              <Col xs={24} md={12}>
                <Form.Item name="contactEmail" label="联系邮箱">
                  <Input prefix={<MailOutlined />} placeholder="请输入联系邮箱" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="address" label="企业地址">
                  <Input prefix={<HomeOutlined />} placeholder="请输入企业地址" />
                </Form.Item>
              </Col>
            </Row>

            <Divider orientation="left">工商与结算信息</Divider>

            <Row gutter={24}>
              <Col xs={24} md={12}>
                <Form.Item name="businessLicense" label="营业执照号">
                  <Input placeholder="请输入营业执照号" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="taxNumber" label="税号">
                  <Input placeholder="请输入税号" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={24}>
              <Col xs={24} md={12}>
                <Form.Item name="bankName" label="开户银行">
                  <Input placeholder="请输入开户银行" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="bankAccount" label="银行账号">
                  <Input placeholder="请输入银行账号" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="extraInfo" label="补充说明">
              <TextArea rows={4} placeholder="可填写企业介绍、备注信息等" />
            </Form.Item>
          </Form>
        </Card>
      );
    }

    return (
      <Card bordered={false} style={contentCardStyle}>
        <Form form={joinForm} layout="vertical" onFinish={handleJoinEnterprise}>
          <Form.Item
            name="enterpriseCode"
            label="企业编码"
            rules={[{ required: true, message: '请输入企业编码' }]}
          >
            <Input prefix={<TeamOutlined />} placeholder="请输入企业编码" />
          </Form.Item>

          <Form.Item name="applicantMessage" label="申请备注">
            <TextArea rows={5} placeholder="可填写你的身份说明、加入原因等" />
          </Form.Item>

          <Alert
            type="warning"
            showIcon
            message="加入企业需要管理员审批"
            description="提交后你将停留在初始化页，企业管理员审核通过后再次登录或刷新即可进入对应企业。"
          />
        </Form>
      </Card>
    );
  };

  const renderStepActions = () => {
    if (currentStep === 0) {
      return (
        <div style={primaryActionBarStyle}>
          <Button type="primary" size="large" onClick={handleNext}>
            下一步
          </Button>
        </div>
      );
    }

    if (currentStep === 1) {
      return (
        <div style={actionBarStyle}>
          <Button size="large" onClick={handlePrev}>上一步</Button>
          <Button type="primary" size="large" onClick={handleNext}>
            {mode === 'create' ? '开始创建企业' : '去填写加入申请'}
          </Button>
        </div>
      );
    }

    if (mode === 'create' && currentStep === 2) {
      return (
        <div style={actionBarStyle}>
          <Button size="large" onClick={handlePrev}>上一步</Button>
          <Button type="primary" size="large" onClick={handleNext}>
            下一步
          </Button>
        </div>
      );
    }

    if (mode === 'create' && currentStep === 3) {
      return (
        <div style={actionBarStyle}>
          <Button size="large" onClick={handlePrev}>上一步</Button>
          <Button type="primary" size="large" loading={submitting} onClick={() => createForm.submit()}>
            创建企业并进入系统
          </Button>
        </div>
      );
    }

    return (
      <div style={actionBarStyle}>
        <Button size="large" onClick={handlePrev}>上一步</Button>
        <Button type="primary" size="large" loading={submitting} onClick={() => joinForm.submit()}>
          提交加入申请
        </Button>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Card bordered={false} style={{ width: 420, textAlign: 'center', ...mainCardStyle }}>
          <LoadingOutlined style={{ fontSize: 28, color: '#1677ff', marginBottom: 12 }} />
          <div>正在准备账户初始化...</div>
        </Card>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={pageContainerStyle}>
        <Card bordered={false} style={mainCardStyle} bodyStyle={{ padding: 32 }}>
          <div style={sectionHeaderStyle}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Title level={3} style={{ marginBottom: 0 }}>账户初始化</Title>
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                按步骤完成账户初始化。你可以创建一个新企业，或者申请加入已有企业。
              </Paragraph>
            </Space>
          </div>

          <Space direction="vertical" size={8} style={{ width: '100%', marginBottom: 24 }}>
            <Text strong>初始化进度</Text>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              系统将根据你的企业归属创建工作空间，并为后续权限和数据隔离做准备。
            </Paragraph>
          </Space>

          {!hasPendingJoinRequest && <Steps current={currentStep} items={stepItems} style={{ marginBottom: 24 }} />}

          {pendingApprovalRequests.length > 0 && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
              message="你已有待审批的加入申请，当前初始化已锁定"
              description={(
                <div>
                  <Paragraph style={{ marginBottom: 8 }}>
                    当前有待审批申请时，不能再次创建企业或重复提交加入申请，请等待管理员处理后再继续。
                  </Paragraph>
                  {pendingApprovalRequests.map((item) => (
                    <div key={item.id || `${item.enterpriseId}_${item.createdAt || ''}`} style={{ marginTop: 8 }}>
                      <Text>
                        {item.enterpriseName || item.companyName || item.company_name || `企业 ${item.enterpriseId}`}
                        {(item.enterpriseCode || item.enterprise_code) ? `（${item.enterpriseCode || item.enterprise_code}）` : ''}
                      </Text>
                      <Text type="secondary"> {item.status === 'PENDING' ? '审批中' : item.status}</Text>
                    </div>
                  ))}
                </div>
              )}
            />
          )}

          <div style={{ marginTop: 24 }}>
            {hasPendingJoinRequest ? (
              <Card bordered={false} style={contentCardStyle}>
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Title level={4} style={{ marginBottom: 0 }}>等待管理员审核</Title>
                  <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    你已经提交过加入企业申请。在审核结果返回前，当前页面不会再开放新的创建或加入操作。
                  </Paragraph>
                </Space>
              </Card>
            ) : (
              <>
                {renderStepContent()}
                {renderStepActions()}
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default EnterpriseOnboarding;
