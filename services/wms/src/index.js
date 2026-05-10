/**
 * 库存服务入口
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');

const { syncDatabase } = require('./models');
const { ensureTenantColumns, runWithRequestContext } = require('./services/tenant-context.service');
const inventoryRouter = require('./routes/inventory');

const app = express();
const PORT = process.env.PORT || 5003;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => runWithRequestContext(req, next));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'wms', timestamp: new Date().toISOString() });
});

// 路由
app.use('/api/inventory', inventoryRouter);

// 错误处理
app.use((err, req, res, next) => {
  console.error('[WMS] 错误:', err);
  res.status(500).json({ success: false, message: err.message || '服务器内部错误' });
});

// 启动服务
const start = async () => {
  await syncDatabase();
  await ensureTenantColumns();
  
  app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`  库存服务(WMS)已启动`);
    console.log(`  端口: ${PORT}`);
    console.log(`========================================`);
  });
};

start();

module.exports = app;
