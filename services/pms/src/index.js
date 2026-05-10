/**
 * 商品服务入口
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');

const { syncDatabase } = require('./models');
const { ensureTenantColumns, runWithRequestContext } = require('./services/tenant-context.service');
const productsRouter = require('./routes/products');

const app = express();
const PORT = process.env.PORT || 5004;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => runWithRequestContext(req, next));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'pms', timestamp: new Date().toISOString() });
});

app.use('/api/products', productsRouter);
app.use('/api/erp-products', require('./routes/erp-products'));
app.use('/api/sku-sales', require('./routes/sku-sales'));

app.use((err, req, res, next) => {
  console.error('[PMS] 错误:', err);
  res.status(500).json({ success: false, message: err.message });
});

const start = async () => {
  await syncDatabase();
  await ensureTenantColumns();
  app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`  商品服务(PMS)已启动`);
    console.log(`  端口: ${PORT}`);
    console.log(`========================================`);
  });
};

start();

module.exports = app;
