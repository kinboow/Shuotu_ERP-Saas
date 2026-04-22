/**
 * Webhook微服务
 * 支持多平台的Webhook通知接收
 * 支持SSL/HTTPS
 * 
 * 平台路由规划：
 * - SHEIN全托管: /shein-full/*
 * - TEMU: /temu/*
 * - TIKTOK: /tiktok/*
 * - 其他平台: /[platform]/*
 */

require('dotenv').config({ path: '../.env' });
const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

// 平台路由
const sheinFullWebhook = require('./routes/platforms/shein-full');
const temuWebhook = require('./routes/platforms/temu');
const tiktokWebhook = require('./routes/platforms/tiktok');

const app = express();

// 中间件
app.use(cors());
app.use(express.json());
// SHEIN使用form-data格式传参，需要支持urlencoded
app.use(express.urlencoded({ extended: true }));

// 请求日志
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] ========== 新请求 ==========`);
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  console.log(`[${timestamp}] Headers:`, JSON.stringify(req.headers, null, 2));
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`[${timestamp}] Body:`, JSON.stringify(req.body, null, 2));
  }
  next();
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'webhook',
    platforms: ['shein-full', 'temu', 'tiktok'],
    ssl: true 
  });
});

// 平台路由
// SHEIN全托管: https://your-domain:8443/shein-full/callback
app.use('/shein-full', sheinFullWebhook);

// TEMU: https://your-domain:8443/temu/callback
app.use('/temu', temuWebhook);

// TIKTOK: https://your-domain:8443/tiktok/callback
app.use('/tiktok', tiktokWebhook);

// 通用回调入口（根据header判断平台）
app.post('/callback', (req, res) => {
  console.log('[通用回调] 收到请求，请配置具体平台的回调地址');
  res.status(200).json({ success: true, message: 'received' });
});

// 404处理
app.use((req, res) => {
  console.log(`[404] 未找到路由: ${req.method} ${req.path}`);
  res.status(404).json({ success: false, message: 'Not Found' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('[Webhook Error]', err);
  res.status(500).json({ success: false, message: err.message });
});

// SSL配置
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || path.join(__dirname, '../ssl/server.key');
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || path.join(__dirname, '../ssl/server.crt');
const HTTPS_PORT = process.env.WEBHOOK_HTTPS_PORT || 8678;
const HTTP_PORT = process.env.WEBHOOK_HTTP_PORT || 8080;

// 启动服务器
const startServer = () => {
  const sslKeyExists = fs.existsSync(SSL_KEY_PATH);
  const sslCertExists = fs.existsSync(SSL_CERT_PATH);

  console.log('\n========================================');
  console.log('  Webhook微服务启动');
  console.log('========================================\n');

  if (sslKeyExists && sslCertExists) {
    const sslOptions = {
      key: fs.readFileSync(SSL_KEY_PATH),
      cert: fs.readFileSync(SSL_CERT_PATH)
    };

    https.createServer(sslOptions, app).listen(HTTPS_PORT, () => {
      console.log(`[HTTPS] 服务已启动: https://192.168.5.102:${HTTPS_PORT}`);
    });

    http.createServer(app).listen(HTTP_PORT, () => {
      console.log(`[HTTP]  服务已启动: http://192.168.5.102:${HTTP_PORT}`);
    });
  } else {
    console.warn('[警告] SSL证书未找到，仅启动HTTP服务器');
    console.warn(`[警告] 证书路径: ${SSL_CERT_PATH}`);
    console.warn(`[警告] 密钥路径: ${SSL_KEY_PATH}`);
    
    http.createServer(app).listen(HTTP_PORT, () => {
      console.log(`[HTTP] 服务已启动: http://192.168.5.102:${HTTP_PORT}`);
    });
  }

  console.log('\n[平台回调地址]');
  console.log(`  SHEIN全托管: /shein-full/callback`);
  console.log(`  TEMU:        /temu/callback`);
  console.log(`  TIKTOK:      /tiktok/callback`);
  console.log('');
};

startServer();
