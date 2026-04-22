/**
 * SHEIN(全托管)授权回调页面
 * 用于接收SHEIN授权后的tempToken并完成授权流程
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { sheinFullShopsAPI } from '../api';

function SheinFullAuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('processing'); // processing, success, error
  const [message, setMessage] = useState('正在处理授权...');
  const [errorDetail, setErrorDetail] = useState('');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      // 从URL获取参数
      const tempToken = searchParams.get('tempToken');
      const state = searchParams.get('state');
      const appid = searchParams.get('appid');

      console.log('授权回调参数:', { tempToken, state, appid });

      if (!tempToken) {
        setStatus('error');
        setMessage('授权失败');
        setErrorDetail('未获取到tempToken参数，请重新授权');
        return;
      }

      if (!state) {
        setStatus('error');
        setMessage('授权失败');
        setErrorDetail('未获取到state参数，无法识别店铺');
        return;
      }

      // 从state中解析shopId (格式: shop_123_timestamp)
      const match = state.match(/shop_(\d+)_/);
      if (!match) {
        setStatus('error');
        setMessage('授权失败');
        setErrorDetail('state参数格式错误，无法识别店铺ID');
        return;
      }

      const shopId = parseInt(match[1]);
      setMessage(`正在完成店铺授权 (ID: ${shopId})...`);

      // 调用后端API完成授权
      const response = await sheinFullShopsAPI.handleCallback({
        shopId,
        tempToken
      });

      if (response.data.success) {
        setStatus('success');
        setMessage('授权成功！');
        
        // 3秒后跳转到平台管理页面
        setTimeout(() => {
          navigate('/platform-management?platform=shein_full&authSuccess=true');
        }, 2000);
      } else {
        setStatus('error');
        setMessage('授权失败');
        setErrorDetail(response.data.message || '未知错误');
      }
    } catch (error) {
      console.error('授权回调处理失败:', error);
      setStatus('error');
      setMessage('授权处理失败');
      setErrorDetail(error.response?.data?.message || error.message);
    }
  };

  const handleRetry = () => {
    navigate('/platform-management?platform=shein_full');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f0f2f5'
    }}>
      <div style={{
        background: 'white',
        padding: '48px 64px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        textAlign: 'center',
        maxWidth: '500px'
      }}>
        {/* 状态图标 */}
        <div style={{ marginBottom: '24px' }}>
          {status === 'processing' && (
            <div style={{
              width: '64px',
              height: '64px',
              margin: '0 auto',
              border: '4px solid #f0f0f0',
              borderTopColor: '#1890ff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
          )}
          {status === 'success' && (
            <div style={{
              width: '64px',
              height: '64px',
              margin: '0 auto',
              background: '#52c41a',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '32px'
            }}>✓</div>
          )}
          {status === 'error' && (
            <div style={{
              width: '64px',
              height: '64px',
              margin: '0 auto',
              background: '#ff4d4f',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '32px'
            }}>✕</div>
          )}
        </div>

        {/* 标题 */}
        <h2 style={{ 
          margin: '0 0 16px', 
          color: status === 'error' ? '#ff4d4f' : status === 'success' ? '#52c41a' : '#333'
        }}>
          {message}
        </h2>

        {/* 错误详情 */}
        {status === 'error' && errorDetail && (
          <p style={{ color: '#999', marginBottom: '24px' }}>
            {errorDetail}
          </p>
        )}

        {/* 成功提示 */}
        {status === 'success' && (
          <p style={{ color: '#999', marginBottom: '24px' }}>
            即将跳转到平台管理页面...
          </p>
        )}

        {/* 操作按钮 */}
        {status === 'error' && (
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={handleRetry}
              style={{
                padding: '8px 24px',
                background: '#1890ff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              返回重试
            </button>
          </div>
        )}

        {/* 加载动画样式 */}
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}

export default SheinFullAuthCallback;
