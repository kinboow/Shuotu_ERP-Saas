import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './SheinSync.css';

const SheinSync = () => {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);
  const [syncMode, setSyncMode] = useState('custom');
  const [formData, setFormData] = useState({
    shopId: '',
    timeStart: '',
    timeEnd: ''
  });

  // 获取店铺列表
  useEffect(() => {
    fetchShops();
  }, []);

  const fetchShops = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/shein-full-auth/shops');
      if (response.data.success) {
        setShops(response.data.data || []);
      }
    } catch (error) {
      console.error('获取店铺列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSync = async (e) => {
    e.preventDefault();

    if (!formData.shopId) {
      alert('请选择店铺');
      return;
    }

    if (syncMode === 'custom') {
      if (!formData.timeStart || !formData.timeEnd) {
        alert('请选择开始和结束时间');
        return;
      }
    }

    try {
      setSyncing(true);
      setResult(null);

      const payload = {
        shopId: parseInt(formData.shopId),
        syncMode: syncMode,
        syncToProducts: true,
        pageSize: 50
      };

      if (syncMode === 'custom') {
        payload.insertTimeStart = formData.timeStart;
        payload.insertTimeEnd = formData.timeEnd;
      }

      const response = await axios.post('/api/shein-full-sync/query-and-sync', payload);

      setResult(response.data);
    } catch (error) {
      setResult({
        success: false,
        message: error.response?.data?.message || error.message,
        details: error.response?.data?.details
      });
    } finally {
      setSyncing(false);
    }
  };

  const getShopDisplayName = (shopId) => {
    const shop = shops.find(s => s.id === parseInt(shopId));
    return shop ? `${shop.shop_name} (${shop.platform?.platform_display_name})` : '';
  };

  return (
    <div className="shein-sync-container">
      <div className="page-header">
        <h1>🔄 SHEIN商品同步</h1>
        <button className="btn btn-primary" onClick={fetchShops} disabled={loading}>
          {loading ? '加载中...' : '刷新店铺列表'}
        </button>
      </div>

      <div className="info-box">
        <h4>📋 同步说明</h4>
        <ul>
          <li><strong>全店同步</strong>：自动按20天间隔从当前时间查询到2009年，预计耗时30-60分钟</li>
          <li><strong>自定义时间范围</strong>：指定开始和结束时间，快速同步特定时间段的商品</li>
          <li>同步过程中会自动保存到SHEIN商品表和产品管理表</li>
          <li>已存在的商品会自动更新，不会重复添加</li>
        </ul>
      </div>

      <div className="sync-form-container">
        <form onSubmit={handleSync} className="sync-form">
          <div className="form-group">
            <label htmlFor="shopId">选择店铺 *</label>
            <select
              id="shopId"
              name="shopId"
              value={formData.shopId}
              onChange={handleInputChange}
              disabled={syncing || loading}
            >
              <option value="">-- 请选择店铺 --</option>
              {shops.map(shop => (
                <option key={shop.id} value={shop.id}>
                  {shop.shop_name} ({shop.platform?.platform_display_name})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>同步模式 *</label>
            <div className="sync-mode-options">
              <label className="radio-option">
                <input
                  type="radio"
                  name="syncMode"
                  value="full"
                  checked={syncMode === 'full'}
                  onChange={(e) => setSyncMode(e.target.value)}
                  disabled={syncing}
                />
                <span className="radio-label">
                  <strong>全店同步</strong>
                  <span className="radio-desc">从现在往回查询到2009年，20天为间隔</span>
                </span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="syncMode"
                  value="custom"
                  checked={syncMode === 'custom'}
                  onChange={(e) => setSyncMode(e.target.value)}
                  disabled={syncing}
                />
                <span className="radio-label">
                  <strong>自定义时间范围</strong>
                  <span className="radio-desc">指定开始和结束时间</span>
                </span>
              </label>
            </div>
          </div>

          {syncMode === 'custom' && (
            <>
              <div className="form-group">
                <label htmlFor="timeStart">开始时间 *</label>
                <input
                  id="timeStart"
                  type="datetime-local"
                  name="timeStart"
                  value={formData.timeStart}
                  onChange={handleInputChange}
                  disabled={syncing}
                />
                <span className="form-help">格式：YYYY-MM-DD HH:mm:ss</span>
              </div>

              <div className="form-group">
                <label htmlFor="timeEnd">结束时间 *</label>
                <input
                  id="timeEnd"
                  type="datetime-local"
                  name="timeEnd"
                  value={formData.timeEnd}
                  onChange={handleInputChange}
                  disabled={syncing}
                />
                <span className="form-help">格式：YYYY-MM-DD HH:mm:ss</span>
              </div>
            </>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-large"
            disabled={syncing}
          >
            {syncing ? '同步中...' : '开始同步'}
          </button>
        </form>
      </div>

      {syncing && (
        <div className="sync-progress">
          <div className="progress-content">
            <div className="spinner"></div>
            <p className="progress-text">正在同步商品，请勿关闭此页面...</p>
          </div>
        </div>
      )}

      {result && !syncing && (
        <div className="sync-result">
          {result.success ? (
            <div className="result-success">
              <div className="result-header">
                <span className="result-icon">✓</span>
                <div>
                  <h3>同步完成</h3>
                  <p>{result.message}</p>
                </div>
              </div>

              <div className="result-stats">
                <div className="stat-item">
                  <span className="stat-label">同步模式</span>
                  <span className="stat-value">
                    {result.data.syncMode === 'full' ? '全店同步' : '自定义'}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">查询时间范围</span>
                  <span className="stat-value">{result.data.timeRangesQueried} 个</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">找到商品</span>
                  <span className="stat-value">{result.data.totalProducts} 个</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">已同步</span>
                  <span className="stat-value success">{result.data.syncedToProducts} 个</span>
                </div>
              </div>

              {result.data.errors && result.data.errors.length > 0 && (
                <div className="error-list">
                  <h4>⚠️ 有 {result.data.errors.length} 个商品同步失败</h4>
                  <div className="error-items">
                    {result.data.errors.slice(0, 5).map((error, index) => (
                      <div key={index} className="error-item">
                        <strong>{error.spuName}</strong>: {error.error}
                      </div>
                    ))}
                    {result.data.errors.length > 5 && (
                      <div className="error-item">... 还有 {result.data.errors.length - 5} 个错误</div>
                    )}
                  </div>
                </div>
              )}

              <button
                className="btn btn-primary"
                onClick={() => setResult(null)}
              >
                继续同步
              </button>
            </div>
          ) : (
            <div className="result-error">
              <div className="result-header">
                <span className="result-icon error">✕</span>
                <div>
                  <h3>同步失败</h3>
                  <p>{result.message}</p>
                </div>
              </div>

              {result.details && (
                <div className="error-details">
                  <h4>错误详情</h4>
                  <pre>{JSON.stringify(result.details, null, 2)}</pre>
                </div>
              )}

              <button
                className="btn btn-primary"
                onClick={() => setResult(null)}
              >
                重新同步
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SheinSync;
