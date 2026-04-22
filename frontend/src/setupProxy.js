/**
 * 开发环境代理配置
 * 将 /api 请求代理到后端网关的 HTTP 端口
 */
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // 后端网关地址 - 默认本地开发网关
  const gatewayHost = process.env.GATEWAY_HOST || 'localhost';
  const gatewayHttpPort = process.env.GATEWAY_HTTP_PORT || '5080';
  const target = `http://${gatewayHost}:${gatewayHttpPort}`;

  app.use(
    '/api',
    createProxyMiddleware({
      target: target,
      changeOrigin: true,
      logLevel: 'silent',
      onError: (err, req, res) => {
        console.error('[Proxy Error]', err.message);
        if (!res.headersSent) {
          res.status(502).json({ success: false, message: '后端服务连接失败: ' + err.message });
        }
      }
    })
  );
};
