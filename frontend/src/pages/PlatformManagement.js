import React, { useState, useEffect } from 'react';
import { message } from 'antd';
import { platformConfigsAPI, sheinFullShopsAPI } from '../api';
import './PlatformManagement.css';

function PlatformManagement() {
  const [platforms, setPlatforms] = useState([]);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [showAuthUrlModal, setShowAuthUrlModal] = useState(false);
  const [showCallbackModal, setShowCallbackModal] = useState(false);
  const [currentShop, setCurrentShop] = useState(null);
  const [authUrl, setAuthUrl] = useState('');
  const [tempToken, setTempToken] = useState('');
  
  const [authForm, setAuthForm] = useState({
    shopName: '',
    appId: '',
    appSecret: '',
    openKeyId: '',
    secretKey: '',
    sellerId: '',
    isTest: false
  });

  useEffect(() => {
    loadPlatforms();
    // 检查URL是否有授权回调参数
    checkAuthCallback();
  }, []);

  useEffect(() => {
    if (selectedPlatform) {
      loadShops();
    } else {
      setShops([]);
    }
  }, [selectedPlatform]);

  // 检查URL是否包含SHEIN授权回调参数
  const checkAuthCallback = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const callbackTempToken = urlParams.get('tempToken');
    const callbackState = urlParams.get('state');
    
    if (callbackTempToken && callbackState) {
      // 解析state获取shopId
      const match = callbackState.match(/shop_(\d+)_/);
      if (match) {
        const shopId = parseInt(match[1]);
        handleAuthCallbackAuto(shopId, callbackTempToken);
        // 清除URL参数
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  };

  // 自动处理SHEIN授权回调
  const handleAuthCallbackAuto = async (shopId, token) => {
    try {
      setLoading(true);
      message.loading('正在处理授权...', 0);
      
      const response = await sheinFullShopsAPI.handleCallback({
        shopId,
        tempToken: token
      });
      
      message.destroy();
      if (response.data.success) {
        message.success('SHEIN授权成功！');
        setSelectedPlatform('shein_full');
        loadShops();
      } else {
        message.error('授权失败: ' + response.data.message);
      }
    } catch (error) {
      message.destroy();
      message.error('授权处理失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const loadPlatforms = async () => {
    try {
      const response = await platformConfigsAPI.getAll();
      const data = response.data.data || [];
      setPlatforms(data);
      const firstActive = data.find(p => p.is_active);
      if (firstActive) {
        setSelectedPlatform(firstActive.platform_name);
      }
    } catch (error) {
      console.error('加载平台列表失败:', error);
      message.error('加载平台列表失败');
    }
  };

  const loadShops = async () => {
    if (!selectedPlatform) return;
    
    try {
      setLoading(true);
      
      // 如果是shein_full平台，使用专用API
      if (selectedPlatform === 'shein_full') {
        const response = await sheinFullShopsAPI.getAll();
        setShops(response.data.data || []);
      } else {
        const response = await platformConfigsAPI.getShops({ platformName: selectedPlatform });
        setShops(response.data.data || []);
      }
    } catch (error) {
      console.error('加载店铺列表失败:', error);
      setShops([]);
    } finally {
      setLoading(false);
    }
  };

  // 创建店铺
  const handleCreateShop = async (e) => {
    e.preventDefault();
    
    if (!selectedPlatform) {
      message.error('请先选择平台');
      return;
    }
    
    try {
      setLoading(true);
      
      // 如果是shein_full平台，使用专用API（只需店铺名称，App凭证从后端配置获取）
      if (selectedPlatform === 'shein_full') {
        const createResponse = await sheinFullShopsAPI.create({
          shopName: authForm.shopName,
          remark: ''
        });
        
        if (createResponse.data.success) {
          const shopId = createResponse.data.data.id;
          message.success('店铺创建成功，正在跳转到授权页面...');
          setShowAuthForm(false);
          resetAuthForm();
          
          // 自动开始授权流程
          setTimeout(async () => {
            try {
              const authResponse = await sheinFullShopsAPI.generateAuthUrl({ shopId });
              if (authResponse.data.success) {
                // 直接跳转到SHEIN授权页面
                window.location.href = authResponse.data.data.authUrl;
              }
            } catch (error) {
              message.error('生成授权链接失败: ' + (error.response?.data?.message || error.message));
              loadShops();
            }
          }, 1000);
        }
      } else {
        await platformConfigsAPI.createShop({
          platformName: selectedPlatform,
          shopName: authForm.shopName,
          openKeyId: authForm.openKeyId,
          secretKey: authForm.secretKey,
          sellerId: authForm.sellerId
        });
        message.success('店铺添加成功');
        setShowAuthForm(false);
        resetAuthForm();
        loadShops();
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      message.error('添加店铺失败: ' + errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const resetAuthForm = () => {
    setAuthForm({
      shopName: '',
      appId: '',
      appSecret: '',
      openKeyId: '',
      secretKey: '',
      sellerId: '',
      isTest: false
    });
  };

  // 开始SHEIN授权流程
  const handleStartSheinAuth = async (shop) => {
    try {
      setLoading(true);
      setCurrentShop(shop);
      
      // 生成回调地址
      const redirectUrl = `${window.location.origin}${window.location.pathname}`;
      
      const response = await sheinFullShopsAPI.generateAuthUrl({
        shopId: shop.id,
        redirectUrl: redirectUrl,
        state: `shop_${shop.id}_${Date.now()}`
      });
      
      if (response.data.success) {
        setAuthUrl(response.data.data.authUrl);
        setShowAuthUrlModal(true);
      }
    } catch (error) {
      message.error('生成授权链接失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 打开SHEIN授权页面
  const openSheinAuthPage = () => {
    if (authUrl) {
      window.open(authUrl, '_blank');
      setShowAuthUrlModal(false);
      setShowCallbackModal(true);
    }
  };

  // 手动处理授权回调
  const handleManualCallback = async () => {
    if (!tempToken || !currentShop) {
      message.error('请输入tempToken');
      return;
    }
    
    try {
      setLoading(true);
      const response = await sheinFullShopsAPI.handleCallback({
        shopId: currentShop.id,
        tempToken: tempToken
      });
      
      if (response.data.success) {
        message.success('授权成功！');
        setShowCallbackModal(false);
        setTempToken('');
        setCurrentShop(null);
        loadShops();
      }
    } catch (error) {
      message.error('授权失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async (shop) => {
    try {
      setLoading(true);
      
      if (selectedPlatform === 'shein_full') {
        const response = await sheinFullShopsAPI.testConnection(shop.id);
        if (response.data.success) {
          message.success('连接测试成功');
        } else {
          message.error('连接测试失败: ' + response.data.message);
        }
      } else {
        const response = await platformConfigsAPI.testShopConnection(shop.id);
        message.success(response.data.message || '连接测试成功');
      }
    } catch (error) {
      message.error('连接测试失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (shop) => {
    try {
      if (selectedPlatform === 'shein_full') {
        await sheinFullShopsAPI.update(shop.id, { status: shop.status === 1 ? 0 : 1 });
      } else {
        await platformConfigsAPI.updateShop(shop.id, { status: shop.is_active ? 0 : 1 });
      }
      loadShops();
      message.success(shop.status === 1 || shop.is_active ? '已停用' : '已启用');
    } catch (error) {
      message.error('更新失败: ' + error.message);
    }
  };

  const handleDeleteShop = async (id) => {
    if (!window.confirm('确定要删除此店铺吗？')) return;
    
    try {
      if (selectedPlatform === 'shein_full') {
        await sheinFullShopsAPI.delete(id);
      } else {
        await platformConfigsAPI.deleteShop(id);
      }
      message.success('删除成功');
      loadShops();
    } catch (error) {
      message.error('删除失败: ' + error.message);
    }
  };

  const getPlatformDisplayName = (platformName) => {
    if (!platformName) return '';
    const platform = platforms.find(p => p.platform_name === platformName);
    return platform?.platform_display_name || platformName.toUpperCase();
  };

  const getSelectedPlatformConfig = () => {
    return platforms.find(p => p.platform_name === selectedPlatform);
  };

  const handleOpenAuthForm = () => {
    const platformConfig = getSelectedPlatformConfig();
    if (platformConfig) {
      setAuthForm({
        shopName: '',
        appId: platformConfig.app_key || '',
        appSecret: platformConfig.app_secret || '',
        openKeyId: platformConfig.app_key || '',
        secretKey: platformConfig.app_secret || '',
        sellerId: '',
        isTest: false
      });
    }
    setShowAuthForm(true);
  };

  // 判断是否是shein_full平台
  const isSheinFull = selectedPlatform === 'shein_full';

  // 获取授权状态显示
  const getAuthStatusDisplay = (shop) => {
    if (!isSheinFull) {
      return shop.is_active ? '已启用' : '已停用';
    }
    const statusMap = {
      0: { text: '未授权', class: 'pending' },
      1: { text: '已授权', class: 'active' },
      2: { text: '授权过期', class: 'expired' }
    };
    return statusMap[shop.auth_status] || statusMap[0];
  };

  return (
    <div className="platform-management-container">
      <div className="page-header">
        <h1>平台店铺管理</h1>
        <div className="header-actions">
          <button 
            className="btn btn-primary"
            onClick={handleOpenAuthForm}
            disabled={!selectedPlatform}
            style={{ opacity: selectedPlatform ? 1 : 0.5, cursor: selectedPlatform ? 'pointer' : 'not-allowed' }}
          >
            + 新增店铺
          </button>
        </div>
      </div>

      {/* 平台选择 */}
      <div className="platform-selector">
        <div className="selector-header">
          <h3>选择平台</h3>
          <span className="platform-count">共 {platforms.length} 个平台</span>
        </div>
        <div className="platform-grid">
          {platforms.length === 0 ? (
            <div style={{ padding: '20px', color: '#999' }}>暂无平台配置</div>
          ) : (
            platforms.map(platform => (
              <div
                key={platform.platform_name || platform.id}
                className={`platform-item ${selectedPlatform === platform.platform_name ? 'active' : ''} ${!platform.is_active ? 'disabled' : ''}`}
                onClick={() => platform.is_active && setSelectedPlatform(platform.platform_name)}
              >
                <div className="platform-logo">
                  <span className="logo-text">
                    {(platform.platform_display_name || platform.platform_name || '?').charAt(0)}
                  </span>
                </div>
                <div className="platform-info">
                  <div className="platform-name">
                    {platform.platform_display_name || platform.platform_name || '未知平台'}
                  </div>
                  {!platform.is_active && <div className="platform-status">未启用</div>}
                </div>
                {selectedPlatform === platform.platform_name && <div className="platform-check">✓</div>}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 新增店铺弹窗 */}
      {showAuthForm && selectedPlatform && (
        <div className="modal-overlay" onClick={() => setShowAuthForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>新增店铺 - {getPlatformDisplayName(selectedPlatform)}</h2>
            
            {isSheinFull ? (
              // SHEIN全托管专用表单 - 只需填写店铺名称
              <form onSubmit={handleCreateShop}>
                <p className="form-hint" style={{ color: '#666', marginBottom: '16px' }}>
                  请输入店铺名称，系统将使用统一的应用凭证进行授权
                </p>
                
                <div className="form-group">
                  <label>店铺名称 *</label>
                  <input
                    type="text"
                    value={authForm.shopName}
                    onChange={e => setAuthForm({...authForm, shopName: e.target.value})}
                    placeholder="例如：主店铺、分店铺"
                    required
                    autoFocus
                  />
                </div>

                <div className="form-actions">
                  <button type="button" className="btn" onClick={() => setShowAuthForm(false)}>取消</button>
                  <button type="submit" className="btn btn-primary" disabled={!authForm.shopName || loading}>
                    {loading ? '创建中...' : '创建并授权'}
                  </button>
                </div>
              </form>
            ) : (
              // 其他平台表单
              <form onSubmit={handleCreateShop}>
                <p className="form-hint">请填写店铺的API凭证信息</p>
                
                <div className="form-group">
                  <label>店铺名称 *</label>
                  <input
                    type="text"
                    value={authForm.shopName}
                    onChange={e => setAuthForm({...authForm, shopName: e.target.value})}
                    placeholder="例如：主店铺、美国站"
                    required
                    autoFocus
                  />
                </div>
                
                <div className="form-group">
                  <label>Open Key ID / App Key</label>
                  <input
                    type="text"
                    value={authForm.openKeyId}
                    onChange={e => setAuthForm({...authForm, openKeyId: e.target.value})}
                    placeholder="平台提供的Key ID"
                  />
                </div>
                
                <div className="form-group">
                  <label>Secret Key / App Secret</label>
                  <input
                    type="text"
                    value={authForm.secretKey}
                    onChange={e => setAuthForm({...authForm, secretKey: e.target.value})}
                    placeholder="平台提供的密钥"
                  />
                </div>
                
                <div className="form-group">
                  <label>卖家ID (Seller ID)</label>
                  <input
                    type="text"
                    value={authForm.sellerId}
                    onChange={e => setAuthForm({...authForm, sellerId: e.target.value})}
                    placeholder="可选"
                  />
                </div>

                <div className="form-actions">
                  <button type="button" className="btn" onClick={() => setShowAuthForm(false)}>取消</button>
                  <button type="submit" className="btn btn-primary" disabled={!authForm.shopName || loading}>
                    {loading ? '添加中...' : '添加店铺'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* SHEIN授权URL弹窗 */}
      {showAuthUrlModal && (
        <div className="modal-overlay" onClick={() => setShowAuthUrlModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h2>🔐 SHEIN店铺授权</h2>
            
            <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: '4px', padding: '12px', marginBottom: '16px' }}>
              <strong>授权步骤：</strong>
              <ol style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
                <li>点击下方"打开授权页面"按钮</li>
                <li>在新窗口中登录SHEIN卖家后台</li>
                <li>点击"授权"按钮完成授权</li>
                <li>授权成功后页面会自动跳转回来</li>
              </ol>
            </div>
            
            <div className="form-group">
              <label>授权链接：</label>
              <textarea
                value={authUrl}
                readOnly
                rows={3}
                style={{ width: '100%', fontSize: '12px', fontFamily: 'monospace' }}
              />
            </div>
            
            <div style={{ background: '#fff2e8', border: '1px solid #ffbb96', borderRadius: '4px', padding: '12px', marginBottom: '16px' }}>
              ⚠️ 注意：tempToken有效期为10分钟，请尽快完成授权
            </div>

            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setShowAuthUrlModal(false)}>取消</button>
              <button type="button" className="btn btn-primary" onClick={openSheinAuthPage}>
                打开授权页面
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 手动输入tempToken弹窗 */}
      {showCallbackModal && (
        <div className="modal-overlay" onClick={() => setShowCallbackModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>完成授权</h2>
            
            <div style={{ background: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: '4px', padding: '12px', marginBottom: '16px' }}>
              如果页面没有自动跳转回来，请手动输入tempToken
            </div>
            
            <p>授权成功后，SHEIN会重定向到回调地址，URL中会包含 <code>tempToken</code> 参数。</p>
            <p>请复制URL中的tempToken值粘贴到下方：</p>
            
            <div className="form-group">
              <input
                type="text"
                placeholder="请输入tempToken"
                value={tempToken}
                onChange={e => setTempToken(e.target.value)}
              />
            </div>

            <div className="form-actions">
              <button type="button" className="btn" onClick={() => { setShowCallbackModal(false); setTempToken(''); }}>取消</button>
              <button type="button" className="btn btn-primary" onClick={handleManualCallback} disabled={!tempToken || loading}>
                {loading ? '处理中...' : '完成授权'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 店铺列表 */}
      <div className="shops-list">
        {!selectedPlatform ? (
          <div className="empty-state"><p>请先选择一个平台</p></div>
        ) : loading && shops.length === 0 ? (
          <div className="loading">加载中...</div>
        ) : shops.length === 0 ? (
          <div className="empty-state">
            <p>暂无店铺</p>
            <p>点击"新增店铺"开始添加 {getPlatformDisplayName(selectedPlatform)} 店铺</p>
          </div>
        ) : (
          <table className="shops-table">
            <thead>
              <tr>
                <th>店铺名称</th>
                {isSheinFull ? <th>App ID</th> : <th>Key ID</th>}
                {isSheinFull ? <th>Open Key ID</th> : <th>卖家ID</th>}
                <th>状态</th>
                {isSheinFull && <th>授权时间</th>}
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {shops.map(shop => {
                const authStatus = isSheinFull ? getAuthStatusDisplay(shop) : null;
                return (
                  <tr key={shop.id} className={isSheinFull ? (shop.status !== 1 ? 'inactive' : '') : (!shop.is_active ? 'inactive' : '')}>
                    <td className="shop-name">
                      <span>{shop.shop_name || '未命名店铺'}</span>
                      {isSheinFull && shop.is_test === 1 && (
                        <span style={{ fontSize: '11px', color: '#faad14', marginLeft: '8px' }}>(测试)</span>
                      )}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                      {isSheinFull 
                        ? (shop.app_id ? shop.app_id.substring(0, 16) + '...' : '-')
                        : (shop.open_key_id || '-')
                      }
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                      {isSheinFull 
                        ? (shop.open_key_id ? shop.open_key_id.substring(0, 16) + '...' : '-')
                        : (shop.seller_id || '-')
                      }
                    </td>
                    <td>
                      {isSheinFull ? (
                        <span className={`status-badge ${authStatus.class}`}>
                          {authStatus.text}
                        </span>
                      ) : (
                        <span className={`status-badge ${shop.is_active ? 'active' : 'inactive'}`}>
                          {shop.is_active ? '已启用' : '已停用'}
                        </span>
                      )}
                    </td>
                    {isSheinFull && (
                      <td>{shop.auth_time ? new Date(shop.auth_time).toLocaleString('zh-CN') : '-'}</td>
                    )}
                    <td className="actions">
                      {isSheinFull && shop.auth_status !== 1 && (
                        <button className="btn-link primary" onClick={() => handleStartSheinAuth(shop)}>
                          授权
                        </button>
                      )}
                      {(isSheinFull ? shop.auth_status === 1 : true) && (
                        <button className="btn-link" onClick={() => handleTestConnection(shop)}>
                          测试连接
                        </button>
                      )}
                      <button className="btn-link" onClick={() => handleToggleActive(shop)}>
                        {(isSheinFull ? shop.status === 1 : shop.is_active) ? '停用' : '启用'}
                      </button>
                      <button className="btn-link danger" onClick={() => handleDeleteShop(shop.id)}>
                        删除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default PlatformManagement;
