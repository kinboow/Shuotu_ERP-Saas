const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use('/api', createProxyMiddleware({
    target: process.env.PLATFORM_ADMIN_PROXY_TARGET || 'http://127.0.0.1:5090',
    changeOrigin: true,
    logLevel: 'silent'
  }));
};
