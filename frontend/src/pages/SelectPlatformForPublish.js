import React, { useState, useEffect } from 'react';
import { Card, Row, Col, message, Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftOutlined } from '@ant-design/icons';

function SelectPlatformForPublish() {
  const navigate = useNavigate();
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlatforms();
    
    // 设置页面标题
    document.title = '协途 - 选择刊登平台';
  }, []);

  const fetchPlatforms = async () => {
    try {
      const response = await fetch('/api/platform-configs?is_active=true');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPlatforms(data.data || []);
        }
      }
    } catch (error) {
      console.error('获取平台列表失败:', error);
      message.error('获取平台列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlatform = (platform) => {
    // 根据不同平台跳转到不同的刊登页面
    const platformRoutes = {
      'shein_full': '/platform-shein-full-listed',
      'shein_semi': '/platform-shein-semi-listed',
      'shein': '/platform-shein-listed',
      'temu': '/platform-listed',
      'tiktok': '/platform-listed',
      'amazon': '/platform-listed',
      'ebay': '/platform-listed'
    };
    
    const route = platformRoutes[platform.platform_name] || '/platform-listed';
    
    // 构建URL,包含平台参数
    const url = `${window.location.origin}${route}?platform=${encodeURIComponent(platform.platform_name)}&platformName=${encodeURIComponent(platform.platform_display_name || platform.platform_name)}`;
    
    // 在新标签页打开刊登页面
    window.open(url, '_blank');
  };

  // 平台图标和颜色映射
  const platformConfig = {
    'shein': { logo: '🛍️', color: '#ff6b9d', name: 'SHEIN' },
    'shein_full': { logo: '🛍️', color: '#ff6b9d', name: 'SHEIN全托管' },
    'shein_semi': { logo: '🛍️', color: '#ff6b9d', name: 'SHEIN半托管' },
    'temu': { logo: '🏪', color: '#ff6600', name: 'TEMU' },
    'tiktok': { logo: '🎵', color: '#000000', name: 'TikTok Shop' },
    'amazon': { logo: '📦', color: '#ff9900', name: 'Amazon' },
    'ebay': { logo: '🛒', color: '#0064d2', name: 'eBay' }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card 
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ArrowLeftOutlined 
              style={{ cursor: 'pointer', fontSize: '18px' }}
              onClick={() => navigate('/publish-product')}
            />
            <span>选择刊登平台</span>
          </div>
        }
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <Spin size="large" />
            <div style={{ marginTop: '16px', color: '#666' }}>加载平台列表...</div>
          </div>
        ) : platforms.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '60px',
            color: '#999'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
            <div style={{ fontSize: '16px', marginBottom: '8px' }}>暂无可用平台</div>
            <div style={{ fontSize: '14px' }}>请先在平台管理中配置并启用平台</div>
          </div>
        ) : (
          <>
            <div style={{ 
              marginBottom: '24px', 
              padding: '12px 16px',
              backgroundColor: '#f0f5ff',
              borderRadius: '4px',
              border: '1px solid #adc6ff'
            }}>
              <span style={{ color: '#1890ff' }}>💡 请选择要刊登商品的平台</span>
            </div>
            
            <Row gutter={[24, 24]}>
              {platforms.map(platform => {
                const config = platformConfig[platform.platform_name] || { 
                  logo: '🏪', 
                  color: '#1890ff',
                  name: platform.platform_display_name 
                };
                
                return (
                  <Col key={platform.platform_name} xs={24} sm={12} md={8} lg={6}>
                    <Card
                      hoverable
                      onClick={() => handleSelectPlatform(platform)}
                      style={{
                        textAlign: 'center',
                        height: '200px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        border: `2px solid ${config.color}20`,
                        transition: 'all 0.3s'
                      }}
                      bodyStyle={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '100%'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = config.color;
                        e.currentTarget.style.boxShadow = `0 4px 12px ${config.color}40`;
                        e.currentTarget.style.transform = 'translateY(-4px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = `${config.color}20`;
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <div style={{ fontSize: '64px', marginBottom: '16px' }}>
                        {config.logo}
                      </div>
                      <div style={{ 
                        fontSize: '18px', 
                        fontWeight: 'bold',
                        color: config.color
                      }}>
                        {platform.platform_display_name || config.name}
                      </div>
                      {platform.remarks && (
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#999',
                          marginTop: '8px'
                        }}>
                          {platform.remarks}
                        </div>
                      )}
                    </Card>
                  </Col>
                );
              })}
            </Row>
          </>
        )}
      </Card>
    </div>
  );
}

export default SelectPlatformForPublish;
