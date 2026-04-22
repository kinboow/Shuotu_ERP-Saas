import React from 'react';
import { Card, Row, Col } from 'antd';
import { AppstoreOutlined, DatabaseOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

function PublishProduct() {
  const navigate = useNavigate();

  // 设置页面标题
  React.useEffect(() => {
    document.title = '协途 - 刊登产品';
  }, []);

  return (
    <div style={{ padding: '24px' }}>
      <Card title="选择刊登模式">
        <Row gutter={24} style={{ marginTop: 24 }}>
          <Col span={12}>
            <Card
              hoverable
              style={{
                textAlign: 'center',
                height: '280px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                cursor: 'pointer',
                border: '2px solid #e8e8e8'
              }}
              onClick={() => navigate('/select-platform-for-publish')}
            >
              <AppstoreOutlined style={{ fontSize: 64, color: '#1890ff', marginBottom: 24 }} />
              <h2 style={{ fontSize: 20, marginBottom: 12 }}>按平台刊登</h2>
              <p style={{ color: '#666', fontSize: 14 }}>
                直接填写商品信息并发布到指定平台
              </p>
            </Card>
          </Col>
          <Col span={12}>
            <Card
              hoverable
              style={{
                textAlign: 'center',
                height: '280px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                cursor: 'pointer',
                border: '2px solid #e8e8e8'
              }}
              onClick={() => navigate('/erp-listed')}
            >
              <DatabaseOutlined style={{ fontSize: 64, color: '#52c41a', marginBottom: 24 }} />
              <h2 style={{ fontSize: 20, marginBottom: 12 }}>从ERP产品刊登</h2>
              <p style={{ color: '#666', fontSize: 14 }}>
                从ERP产品库选择商品并发布到平台
              </p>
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  );
}

export default PublishProduct;
