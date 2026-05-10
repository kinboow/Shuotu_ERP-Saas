/**
 * 订单服务入口
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');

const { syncDatabase } = require('./models');
const ordersRouter = require('./routes/orders');
const stockOrdersRouter = require('./routes/stock-orders');
const { runWithRequestContext, ensureOmsTenantColumns } = require('./services/tenant-context.service');

const app = express();
const PORT = process.env.PORT || 5002;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => runWithRequestContext(req, next));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'oms', timestamp: new Date().toISOString() });
});

// 路由
app.use('/api/orders', ordersRouter);
app.use('/api/stock-orders', stockOrdersRouter);
app.use('/api/delivery-orders', require('./routes/delivery-orders'));
app.use('/api/review-orders', require('./routes/review-orders'));
app.use('/api/shipping-station', require('./routes/shipping-station'));
app.use('/api/create-stock-order', (req, res) => res.json({ success: false, message: '功能迁移中' }));

// 错误处理
app.use((err, req, res, next) => {
  console.error('[OMS] 错误:', err);
  res.status(500).json({ success: false, message: err.message || '服务器内部错误' });
});

// 启动服务
const start = async () => {
  await syncDatabase();
  await ensureOmsTenantColumns();
  
  app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`  订单服务(OMS)已启动`);
    console.log(`  端口: ${PORT}`);
    console.log(`========================================`);
  });
};

start();

module.exports = app;
