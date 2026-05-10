/**
 * 综合服务入口
 * 包含：用户管理、供应商、物流商
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');

const { syncDatabase } = require('./models');
const { initRedis } = require('./services/redis');
const { initMQ, closeMQ } = require('./services/mq');
const { ensureTenantTables, ensureLegacyAuthSchema, ensureBusinessTenantColumns, runWithRequestContext } = require('./services/enterprise-context');
const authRouter = require('./routes/auth');
const pdaAuthRouter = require('./routes/pda-auth');
const usersRouter = require('./routes/users');
const rolesRouter = require('./routes/roles');
const enterpriseRouter = require('./routes/enterprise');
const logsRouter = require('./routes/logs');
const suppliersRouter = require('./routes/suppliers');
const logisticsRouter = require('./routes/logistics');
const { printRouter, complianceLabelRouter, labelMaterialsRouter } = require('./routes/print');
const labelDataRouter = require('./routes/label-data');
const financeRouter = require('./routes/finance');
const pdaRouter = require('./routes/pda');
const packageVideosRouter = require('./routes/package-videos');
const courierReportsRouter = require('./routes/courier-reports');
const mqRouter = require('./routes/mq');

const app = express();
const PORT = process.env.PORT || 5005;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => runWithRequestContext(req, next));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'misc', timestamp: new Date().toISOString() });
});

// 路由
app.use('/api/auth', authRouter);
app.use('/api/pda-auth', pdaAuthRouter);
app.use('/api/users', usersRouter);
app.use('/api/roles', rolesRouter);
app.use('/api/enterprise', enterpriseRouter);
app.use('/api/logs', logsRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/logistics', logisticsRouter);
app.use('/api/remote-print', printRouter);
app.use('/api/compliance-label', complianceLabelRouter);
app.use('/api/label-materials', labelMaterialsRouter);
app.use('/api/label-data-tables', labelDataRouter);
app.use('/api/finance-records', financeRouter);
app.use('/api/withdrawals', financeRouter);
app.use('/api/pda', pdaRouter);
app.use('/api/package-videos', packageVideosRouter);
app.use('/api', courierReportsRouter);
app.use('/api/mq', mqRouter);
app.use('/api/images', express.static('uploads'));
app.use('/uploads', express.static('uploads'));
app.use('/api/publish-drafts', (req, res) => res.json({ success: true, data: [] }));
app.use('/api/publish-records', (req, res) => res.json({ success: true, data: [] }));

app.use((err, req, res, next) => {
  console.error('[MISC] 错误:', err);
  res.status(500).json({ success: false, message: err.message });
});

const start = async () => {
  await syncDatabase();
  await ensureLegacyAuthSchema();
  await ensureTenantTables();
  await ensureBusinessTenantColumns();
  
  // 初始化Redis
  initRedis();

  // 初始化消息队列（非阻塞，失败不影响服务启动）
  initMQ().catch(err => console.warn('[MQ] 初始化跳过:', err.message));
  
  app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`  综合服务(MISC)已启动`);
    console.log(`  端口: ${PORT}`);
    console.log(`  消息队列: RabbitMQ`);
    console.log(`========================================`);
  });
};

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('[MISC] 收到 SIGTERM，正在关闭...');
  await closeMQ();
  process.exit(0);
});

start();

module.exports = app;
