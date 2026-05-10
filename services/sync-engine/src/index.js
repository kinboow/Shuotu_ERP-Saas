/**
 * 同步引擎服务入口
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');

const syncRouter = require('./routes/sync');
const webhookRouter = require('./routes/webhook');
const platformsRouter = require('./routes/platforms');
const adapterManager = require('./adapters');
const { initAdaptersFromDatabase } = require('./adapters');
const { connectDatabase } = require('./config/database');
const { syncDatabase } = require('./models');
const PlatformConfigService = require('./services/platform-config.service');
const { initMQ, closeMQ } = require('./services/mq');
const { ensureTenantColumns, runWithRequestContext } = require('./services/tenant-context.service');

const app = express();
const PORT = process.env.PORT || 5001;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => runWithRequestContext(req, next));

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'sync-engine',
    timestamp: new Date().toISOString(),
    adapters: adapterManager.getStats()
  });
});

// 路由
app.use('/api/sync', syncRouter);
app.use('/api/platforms', platformsRouter);
app.use('/api/platform-configs', platformsRouter);
app.use('/webhook', webhookRouter);

// SHEIN(full)全托管相关路由
const sheinFullRouter = require('./routes/shein-full');
app.use('/api/shein-full', sheinFullRouter);
app.use('/api/shein-full-auth', sheinFullRouter);
app.use('/api/shein-full-orders', sheinFullRouter);
app.use('/api/shein-full-products', sheinFullRouter);
app.use('/api/shein-full-sync', sheinFullRouter);
app.use('/api/shein-full-product-list', sheinFullRouter);
app.use('/api/shein-full-api', sheinFullRouter);
// 兼容旧接口路由（映射到shein-full）
app.use('/api/shein-auth', sheinFullRouter);
app.use('/api/shein-orders', sheinFullRouter);
app.use('/api/shein-products', sheinFullRouter);
app.use('/api/shein-sync', sheinFullRouter);
app.use('/api/shein-product-list', sheinFullRouter);
app.use('/api/shein-api', sheinFullRouter);

// 错误处理
app.use((err, req, res, next) => {
  console.error('[sync-engine] 错误:', err);
  res.status(500).json({
    success: false,
    message: err.message || '服务器内部错误'
  });
});

// 启动服务
const start = async () => {
  await connectDatabase();
  await syncDatabase();
  await ensureTenantColumns();
  
  // 初始化默认平台配置
  await PlatformConfigService.initDefaultPlatforms();
  
  // 从数据库加载适配器配置
  await initAdaptersFromDatabase();

  // 初始化消息队列（非阻塞，失败不影响服务启动）
  initMQ().catch(err => console.warn('[MQ] 初始化跳过:', err.message));
  
  app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`  同步引擎服务已启动`);
    console.log(`  端口: ${PORT}`);
    console.log(`  支持平台: ${adapterManager.getSupportedPlatforms().join(', ')}`);
    console.log(`  已加载适配器: ${adapterManager.getStats().total} 个`);
    console.log(`  消息队列: RabbitMQ`);
    console.log(`========================================`);
  });
};

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('[sync-engine] 收到 SIGTERM，正在关闭...');
  await closeMQ();
  process.exit(0);
});

start();

module.exports = app;
