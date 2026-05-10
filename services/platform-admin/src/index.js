const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
const authRouter = require('./routes/auth');
const platformRouter = require('./routes/platform');
const { ensurePlatformAdminSchema } = require('./bootstrap');

const app = express();
const PORT = Number(process.env.PLATFORM_ADMIN_PORT || 5090);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'platform-admin-api', timestamp: new Date().toISOString() });
});

app.use('/api/platform-auth', authRouter);
app.use('/api/platform', platformRouter);

app.use((err, req, res, next) => {
  res.status(500).json({ success: false, message: err.message });
});

async function start() {
  await ensurePlatformAdminSchema();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Platform Admin API] running on ${PORT}`);
  });
}

start().catch((error) => {
  console.error('[Platform Admin API] startup failed:', error);
  process.exit(1);
});

module.exports = app;
