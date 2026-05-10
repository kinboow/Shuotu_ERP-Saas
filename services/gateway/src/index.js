/**
 * API网关服务入口
 * 兼容现有前端所有API路径
 */

const path = require('path');
const fs = require('fs');
const https = require('https');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5000;

// SSL证书配置 - 路径相对于项目根目录
const projectRoot = path.resolve(__dirname, '../../..');
const servicesRoot = path.resolve(__dirname, '../..');
const SSL_CERT_PATH = process.env.SSL_CERT_PATH 
  ? path.resolve(servicesRoot, process.env.SSL_CERT_PATH)
  : path.resolve(projectRoot, 'erp.hlsd.work_certificate.pem');
const SSL_KEY_PATH = process.env.SSL_KEY_PATH 
  ? path.resolve(servicesRoot, process.env.SSL_KEY_PATH)
  : path.resolve(projectRoot, 'erp.hlsd.work_private.key');
const HTTPS_ENABLED = process.env.HTTPS_ENABLED === 'true';
const JWT_SECRET = process.env.JWT_SECRET || 'erp-jwt-secret-key';

// 信任代理（解决X-Forwarded-For警告）
app.set('trust proxy', 1);

// 服务地址配置
const services = {
  syncEngine: `http://${process.env.SYNC_ENGINE_HOST || 'localhost'}:5001`,
  oms: `http://${process.env.OMS_HOST || 'localhost'}:5002`,
  wms: `http://${process.env.WMS_HOST || 'localhost'}:5003`,
  pms: `http://${process.env.PMS_HOST || 'localhost'}:5004`,
  oss: `http://${process.env.OSS_HOST || 'localhost'}:3001`,
  misc: `http://${process.env.MISC_HOST || 'localhost'}:5005`
};

// 限流配置
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 2000,
  message: { success: false, message: '请求过于频繁' }
});

// 中间件
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));
app.use(limiter);

// 请求日志
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[Gateway] ${req.method} ${req.path} - ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

// JWT验证中间件（可选验证）
const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch (e) {}
  }
  next();
};

// 强制验证中间件
const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ success: false, message: '未登录' });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token无效或已过期' });
  }
};

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'gateway', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '跨境电商ERP系统运行中' });
});

// 代理配置
const proxy = (target, pathRewrite = {}) => createProxyMiddleware({
  target,
  changeOrigin: true,
  pathRewrite,
  onProxyReq: (proxyReq, req) => {
    if (req.user) {
      proxyReq.setHeader('x-auth-user-id', req.user.userId || '');
      proxyReq.setHeader('x-auth-username', req.user.username || '');
      proxyReq.setHeader('x-auth-role-id', req.user.roleId || '');
      proxyReq.setHeader('x-auth-role-code', req.user.roleCode || '');
      proxyReq.setHeader('x-auth-is-admin', req.user.isAdmin ? '1' : '0');
      proxyReq.setHeader('x-enterprise-id', req.user.enterpriseId || '');
    }
  },
  onError: (err, req, res) => {
    console.error(`[Gateway] 代理错误: ${target}`, err.message);
    res.status(502).json({ success: false, message: '服务暂时不可用' });
  }
});

// ==================== 公开路由（无需认证）====================
app.use('/api/auth', proxy(services.misc));
app.use('/api/pda-auth', proxy(services.misc)); // PDA认证路由（公开）
app.use('/webhook', proxy(services.syncEngine));

// ==================== 文件服务 ====================
app.use('/upload', proxy(services.oss));
app.use('/file', proxy(services.oss));
app.use('/uploads', proxy(services.oss, { '^/uploads': '/file' }));
app.use('/api/proxy', proxy(services.oss, { '^/api/proxy': '/proxy' })); // 图片代理
// OSS文件访问（通过/api前缀，绕过CRA historyApiFallback对浏览器导航的拦截）
app.use('/api/oss-file', proxy(services.oss, { '^/api/oss-file': '/file' }));

// ==================== Sync-Engine 路由 ====================
app.use('/api/sync', optionalAuth, proxy(services.syncEngine));
app.use('/api/platforms', optionalAuth, proxy(services.syncEngine));
app.use('/api/platform-configs', optionalAuth, proxy(services.syncEngine));
// SHEIN(full)全托管路由
app.use('/api/shein-full', optionalAuth, proxy(services.syncEngine));
app.use('/api/shein-full-auth', optionalAuth, proxy(services.syncEngine));
app.use('/api/shein-full-orders', optionalAuth, proxy(services.syncEngine));
app.use('/api/shein-full-products', optionalAuth, proxy(services.syncEngine));
app.use('/api/shein-full-sync', optionalAuth, proxy(services.syncEngine));
app.use('/api/shein-full-product-list', optionalAuth, proxy(services.syncEngine));
app.use('/api/shein-full-api', optionalAuth, proxy(services.syncEngine));
// 兼容旧SHEIN路由（映射到shein-full）
app.use('/api/shein-auth', optionalAuth, proxy(services.syncEngine));
app.use('/api/shein-orders', optionalAuth, proxy(services.syncEngine));
app.use('/api/shein-products', optionalAuth, proxy(services.syncEngine));
app.use('/api/shein-sync', optionalAuth, proxy(services.syncEngine));
app.use('/api/shein-product-list', optionalAuth, proxy(services.syncEngine));
app.use('/api/shein-api', optionalAuth, proxy(services.syncEngine));

// ==================== OMS 订单服务路由 ====================
app.use('/api/orders', optionalAuth, proxy(services.oms));
app.use('/api/stock-orders', optionalAuth, proxy(services.oms));
app.use('/api/delivery-orders', optionalAuth, proxy(services.oms));
app.use('/api/create-stock-order', optionalAuth, proxy(services.oms));
app.use('/api/review-orders', optionalAuth, proxy(services.oms));
app.use('/api/shipping-station', optionalAuth, proxy(services.oms));

// ==================== WMS 库存服务路由 ====================
app.use('/api/inventory', optionalAuth, proxy(services.wms));

// ==================== PMS 商品服务路由 ====================
app.use('/api/products', optionalAuth, proxy(services.pms));
app.use('/api/erp-products', optionalAuth, proxy(services.pms));
app.use('/api/sku-sales', optionalAuth, proxy(services.pms));

// ==================== MISC 综合服务路由 ====================
app.use('/api/users', optionalAuth, proxy(services.misc));
app.use('/api/roles', optionalAuth, proxy(services.misc));
app.use('/api/enterprise', optionalAuth, proxy(services.misc));
app.use('/api/logs', optionalAuth, proxy(services.misc));
app.use('/api/suppliers', optionalAuth, proxy(services.misc));
app.use('/api/logistics', optionalAuth, proxy(services.misc));
app.use('/api/finance-records', optionalAuth, proxy(services.misc));
app.use('/api/withdrawals', optionalAuth, proxy(services.misc));
app.use('/api/compliance-label', optionalAuth, proxy(services.misc));
app.use('/api/label-materials', optionalAuth, proxy(services.misc));
app.use('/api/label-data-tables', optionalAuth, proxy(services.misc));
app.use('/api/pda', optionalAuth, proxy(services.misc));
app.use('/api/package-videos', optionalAuth, proxy(services.misc));
app.use('/api/remote-print', optionalAuth, proxy(services.misc));
app.use('/api/images', optionalAuth, proxy(services.misc));
app.use('/api/publish-drafts', optionalAuth, proxy(services.misc));
app.use('/api/publish-records', optionalAuth, proxy(services.misc));
app.use('/api/courier-companies', optionalAuth, proxy(services.misc)); // 快递公司
app.use('/api/courier-reports', optionalAuth, proxy(services.misc)); // 快递报单
app.use('/api/mq', optionalAuth, proxy(services.misc)); // 消息队列状态

// 404处理
app.use((req, res) => {
  console.log(`[Gateway] 404: ${req.method} ${req.path}`);
  res.status(404).json({ success: false, message: `接口不存在: ${req.path}` });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('[Gateway] 错误:', err);
  res.status(500).json({ success: false, message: err.message });
});

// 启动服务
const startServer = () => {
  const HTTP_PORT = parseInt(process.env.HTTP_PORT || '5080'); // HTTP端口，用于内网代理
  
  console.log(`[Gateway] HTTPS_ENABLED: ${HTTPS_ENABLED}`);
  console.log(`[Gateway] SSL_CERT_PATH: ${SSL_CERT_PATH} (exists: ${fs.existsSync(SSL_CERT_PATH)})`);
  console.log(`[Gateway] SSL_KEY_PATH: ${SSL_KEY_PATH} (exists: ${fs.existsSync(SSL_KEY_PATH)})`);
  
  // 始终启动HTTP服务（用于内网代理）
  app.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`[Gateway] HTTP服务已启动，端口: ${HTTP_PORT}`);
  });
  
  if (HTTPS_ENABLED && fs.existsSync(SSL_CERT_PATH) && fs.existsSync(SSL_KEY_PATH)) {
    // HTTPS模式
    const httpsOptions = {
      cert: fs.readFileSync(SSL_CERT_PATH),
      key: fs.readFileSync(SSL_KEY_PATH)
    };
    https.createServer(httpsOptions, app).listen(PORT, '0.0.0.0', () => {
      console.log(`========================================`);
      console.log(`  API网关已启动`);
      console.log(`  HTTPS端口: ${PORT}`);
      console.log(`  HTTP端口: ${HTTP_PORT} (内网代理用)`);
      console.log(`  证书: ${SSL_CERT_PATH}`);
      console.log(`  后端服务:`);
      Object.entries(services).forEach(([name, url]) => {
        console.log(`    - ${name}: ${url}`);
      });
      console.log(`========================================`);
    });
  } else {
    // 仅HTTP模式
    console.log(`========================================`);
    console.log(`  API网关已启动 (仅HTTP)`);
    console.log(`  端口: ${HTTP_PORT}`);
    console.log(`  后端服务:`);
    Object.entries(services).forEach(([name, url]) => {
      console.log(`    - ${name}: ${url}`);
    });
    console.log(`========================================`);
  }
};

startServer();

module.exports = app;
