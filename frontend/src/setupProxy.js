/**
 * 开发环境代理配置
 * 将所有后端请求代理到网关的 HTTP 端口
 * 
 * 这样前端dev server作为唯一入口：
 * - 外网只需开放前端端口(3788)
 * - 所有API/文件/Webhook请求通过代理转发到内网网关
 */
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // 后端网关地址 - 默认本地开发网关
  const gatewayHost = process.env.GATEWAY_HOST || 'localhost';
  const gatewayHttpPort = process.env.GATEWAY_HTTP_PORT || '5080';
  const target = `http://${gatewayHost}:${gatewayHttpPort}`;

  const proxyOptions = {
    target: target,
    changeOrigin: true,
    logLevel: 'silent',
    onError: (err, req, res) => {
      console.error('[Proxy Error]', err.message);
      if (!res.headersSent) {
        res.status(502).json({ success: false, message: '后端服务连接失败: ' + err.message });
      }
    }
  };

  // API路由
  app.use('/api', createProxyMiddleware(proxyOptions));

  // 文件上传/下载路由
  app.use('/upload', createProxyMiddleware(proxyOptions));
  app.use('/file', createProxyMiddleware(proxyOptions));
  app.use('/uploads', createProxyMiddleware(proxyOptions));

  // Webhook路由（第三方平台回调）
  app.use('/webhook', createProxyMiddleware(proxyOptions));

  // 网关健康检查
  app.use('/health', createProxyMiddleware(proxyOptions));
};
