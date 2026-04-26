import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Upload, Avatar, Row, Col, Divider, Spin } from 'antd';
import { UploadOutlined, BankOutlined, UserOutlined, PhoneOutlined, MailOutlined, HomeOutlined, LoadingOutlined } from '@ant-design/icons';
import { enterpriseAPI } from '../api';

const { TextArea } = Input;

// OSS服务地址，通过前端代理转发
const getOssUrl = () => {
  if (process.env.REACT_APP_OSS_URL) {
    return process.env.REACT_APP_OSS_URL;
  }
  // 使用相对路径，通过前端dev server代理转发到网关
  return '';
};

function EnterpriseSettings() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchEnterprise();
  }, []);

  const fetchEnterprise = async () => {
    setLoading(true);
    try {
      const response = await enterpriseAPI.get();
      if (response.data.success) {
        const data = response.data.data;
        form.setFieldsValue({
          companyName: data.company_name,
          companyShortName: data.company_short_name,
          contactPerson: data.contact_person,
          contactPhone: data.contact_phone,
          contactEmail: data.contact_email,
          address: data.address,
          businessLicense: data.business_license,
          taxNumber: data.tax_number,
          bankName: data.bank_name,
          bankAccount: data.bank_account
        });
        setLogoUrl(data.logo_url);
      }
    } catch (error) {
      message.error('获取企业信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    setSaving(true);
    try {
      const response = await enterpriseAPI.update({
        ...values,
        logoUrl
      });
      if (response.data.success) {
        message.success('保存成功');
      } else {
        message.error(response.data.message);
      }
    } catch (error) {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Card title="企业信息设置" loading={loading}>
        <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ maxWidth: 800 }}>
          <Row gutter={24}>
            <Col span={24}>
              <div style={{ marginBottom: 24, textAlign: 'center' }}>
                <Avatar 
                  size={100} 
                  src={logoUrl} 
                  icon={<BankOutlined />}
                  style={{ backgroundColor: '#1890ff' }}
                />
                <div style={{ marginTop: 8 }}>
                  <Upload
                    showUploadList={false}
                    accept="image/*"
                    beforeUpload={async (file) => {
                      // 验证文件类型
                      const isImage = file.type.startsWith('image/');
                      if (!isImage) {
                        message.error('只能上传图片文件');
                        return false;
                      }
                      
                      // 验证文件大小（最大2MB）
                      const isLt2M = file.size / 1024 / 1024 < 2;
                      if (!isLt2M) {
                        message.error('图片大小不能超过2MB');
                        return false;
                      }
                      
                      setUploading(true);
                      try {
                        const ossUrl = getOssUrl();
                        const formData = new FormData();
                        formData.append('file', file);
                        formData.append('category', 'permanent'); // 永久文件，无需签名
                        
                        const response = await fetch(`${ossUrl}/upload`, {
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
                        console.error('上传失败:', error);
                        message.error('上传失败: ' + error.message);
                      } finally {
                        setUploading(false);
                      }
                      
                      return false; // 阻止默认上传行为
                    }}
                  >
                    <Button icon={uploading ? <LoadingOutlined /> : <UploadOutlined />} size="small" loading={uploading}>
                      {uploading ? '上传中...' : '更换Logo'}
                    </Button>
                  </Upload>
                </div>
              </div>
            </Col>
          </Row>

          <Divider orientation="left">基本信息</Divider>
          
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="companyName" label="企业名称" rules={[{ required: true, message: '请输入企业名称' }]}>
                <Input prefix={<BankOutlined />} placeholder="请输入企业全称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="companyShortName" label="企业简称">
                <Input placeholder="请输入企业简称" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="contactPerson" label="联系人">
                <Input prefix={<UserOutlined />} placeholder="请输入联系人姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contactPhone" label="联系电话">
                <Input prefix={<PhoneOutlined />} placeholder="请输入联系电话" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="contactEmail" label="联系邮箱">
                <Input prefix={<MailOutlined />} placeholder="请输入联系邮箱" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="address" label="企业地址">
                <Input prefix={<HomeOutlined />} placeholder="请输入企业地址" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">工商信息</Divider>

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="businessLicense" label="营业执照号">
                <Input placeholder="请输入营业执照号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="taxNumber" label="税号">
                <Input placeholder="请输入税号" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">银行信息</Divider>

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="bankName" label="开户银行">
                <Input placeholder="请输入开户银行" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="bankAccount" label="银行账号">
                <Input placeholder="请输入银行账号" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ marginTop: 24 }}>
            <Button type="primary" htmlType="submit" loading={saving}>
              保存设置
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

export default EnterpriseSettings;
