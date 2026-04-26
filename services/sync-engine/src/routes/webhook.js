/**
 * Webhook接收路由
 * 处理各平台的消息推送
 * 
 * SHEIN Webhook说明:
 * - 请求头含 x-lt-openKeyId, x-lt-eventCode, x-lt-appid, x-lt-timestamp, x-lt-signature
 * - 请求体为 JSON: { eventData: "AES加密的Base64字符串" }
 * - 签名使用 appId + appSecretKey (非 openKey+secretKey)
 * - 数据使用 AES/CBC/PKCS5Padding 加密, key=appSecret前16字节, IV="space-station-de"
 * - 返回2xx表示成功，建议异步处理避免超时
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const syncService = require('../services/shein-full-sync.service');

// ==================== SHEIN Webhook 工具函数 ====================

/**
 * 获取SHEIN平台凭证 (appId + appSecret)
 */
async function getSheinPlatformCredentials() {
  const results = await sequelize.query(
    `SELECT app_key, app_secret FROM platform_configs WHERE platform_name = 'shein_full'`,
    { type: QueryTypes.SELECT }
  );
  const config = results[0];
  if (!config || !config.app_key || !config.app_secret) {
    throw new Error('SHEIN平台凭证未配置');
  }
  return { appId: config.app_key, appSecret: config.app_secret };
}

/**
 * SHEIN Webhook签名验证
 * 签名格式: randomKey(5字符) + Base64(HMAC-SHA256(appId&timestamp&path, appSecret+randomKey))
 */
function verifySheinSignature(signature, appId, appSecret, requestPath, timestamp) {
  if (!signature || signature.length <= 5) return false;
  try {
    const randomKey = signature.substring(0, 5);
    const signString = `${appId}&${timestamp}&${requestPath}`;
    const secretKey = appSecret + randomKey;
    const hashValue = crypto.createHmac('sha256', secretKey)
      .update(signString, 'utf8')
      .digest('hex');
    const base64Value = Buffer.from(hashValue, 'utf8').toString('base64');
    const expected = randomKey + base64Value;
    return signature === expected;
  } catch (e) {
    console.error('[Webhook] 签名验证异常:', e.message);
    return false;
  }
}

/**
 * 解密SHEIN Webhook eventData
 * AES-128-CBC, key=appSecret前16字节, IV="space-station-default-iv"前16字节
 */
function decryptSheinEventData(encryptedData, appSecret) {
  const algorithm = 'aes-128-cbc';
  const key = Buffer.from(appSecret.substring(0, 16), 'utf8');
  const iv = Buffer.from('space-station-de', 'utf8'); // "space-station-default-iv" 前16字节
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * 根据openKeyId查找店铺
 */
async function findShopByOpenKeyId(openKeyId) {
  if (!openKeyId) return null;
  const results = await sequelize.query(
    `SELECT id, shop_name, open_key_id FROM shein_full_shops WHERE open_key_id = ? AND status = 1 AND auth_status = 1`,
    { replacements: [openKeyId], type: QueryTypes.SELECT }
  );
  return results[0] || null;
}

/**
 * 记录Webhook事件日志
 */
async function logWebhookEvent(platform, eventCode, openKeyId, shopId, status, detail) {
  try {
    await sequelize.query(`
      INSERT INTO webhook_event_logs (platform, event_code, open_key_id, shop_id, status, detail, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `, { replacements: [platform, eventCode || '', openKeyId || '', shopId || null, status, detail || ''] });
  } catch (e) {
    // 日志记录失败不影响主流程
    console.error('[Webhook] 写入事件日志失败:', e.message);
  }
}

/**
 * 确保webhook_event_logs表存在
 */
async function ensureWebhookLogTable() {
  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS webhook_event_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        platform VARCHAR(50) NOT NULL DEFAULT '',
        event_code VARCHAR(100) NOT NULL DEFAULT '',
        open_key_id VARCHAR(255) DEFAULT '',
        shop_id INT DEFAULT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'received',
        detail TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_event_code (event_code),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } catch (e) {
    console.error('[Webhook] 创建日志表失败:', e.message);
  }
}
// 启动时确保表存在
ensureWebhookLogTable();

// ==================== SHEIN 事件处理 ====================

/**
 * 处理采购单通知事件
 * 接收到采购单状态变动后，从SHEIN API拉取最新数据并更新本地数据库
 */
async function handlePurchaseOrderNotice(data, openKeyId) {
  let orders;
  try {
    orders = typeof data === 'string' ? JSON.parse(data) : data;
  } catch (e) {
    console.error('[Webhook] 采购单通知数据解析失败:', e.message);
    return { success: false, message: '数据解析失败' };
  }

  if (!Array.isArray(orders) || orders.length === 0) {
    console.warn('[Webhook] 采购单通知: 无订单数据');
    return { success: false, message: '无订单数据' };
  }

  // 通过openKeyId查找店铺
  const shop = await findShopByOpenKeyId(openKeyId);
  if (!shop) {
    console.warn(`[Webhook] 未找到openKeyId对应的店铺: ${openKeyId}`);
    return { success: false, message: `未找到店铺: ${openKeyId}` };
  }

  const orderNos = orders.map(o => o.orderNo).filter(Boolean);
  const stateInfo = orders.map(o => `${o.orderNo}(${o.stateName || o.state})`).join(', ');
  console.log(`[Webhook] 采购单通知: 店铺=${shop.shop_name}(${shop.id}), ${orderNos.length}个订单: ${stateInfo}`);

  if (orderNos.length === 0) {
    return { success: false, message: '无有效订单号' };
  }

  // 获取适配器，从SHEIN API拉取最新数据
  let successCount = 0;
  let failCount = 0;

  try {
    const adapter = await syncService.getAdapter(shop.id);

    // SHEIN API 限制: orderNos一次最多200个
    for (let i = 0; i < orderNos.length; i += 200) {
      const batch = orderNos.slice(i, i + 200);
      try {
        const result = await adapter.getPurchaseOrders({ orderNos: batch.join(',') });
        const fetchedOrders = result.info?.list || [];

        for (const order of fetchedOrders) {
          try {
            await syncService.savePurchaseOrder(shop.id, order);
            successCount++;
          } catch (err) {
            failCount++;
            console.error(`[Webhook] 保存采购单失败: ${order.orderNo}, ${err.message}`);
          }
        }

        // 记录未查到的订单
        const fetchedNos = new Set(fetchedOrders.map(o => o.orderNo));
        const missingNos = batch.filter(no => !fetchedNos.has(no));
        if (missingNos.length > 0) {
          console.warn(`[Webhook] 以下订单号未从API查到: ${missingNos.join(', ')}`);
        }
      } catch (err) {
        failCount += batch.length;
        console.error(`[Webhook] 批次API请求失败: ${err.message}`);
      }
    }
  } catch (err) {
    console.error(`[Webhook] 获取适配器失败: ${err.message}`);
    return { success: false, message: `获取适配器失败: ${err.message}` };
  }

  const msg = `同步完成: 成功${successCount}, 失败${failCount}`;
  console.log(`[Webhook] 采购单通知处理结果: ${msg}`);
  return { success: true, message: msg, successCount, failCount };
}

// ==================== SHEIN Webhook 路由 ====================

/**
 * SHEIN Webhook
 * POST /webhook/shein
 * 
 * 支持的事件:
 * - purchase_order_notice: 采购单状态变动通知
 * - delivery_modify_notice: 发货单变更通知
 * - logistics_order_result_notice: 物流单下单通知
 */
router.post('/shein', async (req, res) => {
  // 立即返回200，避免SHEIN判断超时并重试
  res.status(200).json({ success: true });

  // 提取请求头
  const openKeyId = req.headers['x-lt-openkeyid'];
  const eventCode = req.headers['x-lt-eventcode'];
  const appIdHeader = req.headers['x-lt-appid'];
  const timestamp = req.headers['x-lt-timestamp'];
  const signature = req.headers['x-lt-signature'];

  console.log(`[Webhook] SHEIN收到事件: eventCode=${eventCode}, openKeyId=${openKeyId}, appId=${appIdHeader}`);

  // 异步处理，不阻塞响应
  setImmediate(async () => {
    let shopId = null;
    try {
      // 1. 获取平台凭证
      const credentials = await getSheinPlatformCredentials();

      // 2. 验证签名
      const signValid = verifySheinSignature(signature, appIdHeader || credentials.appId, credentials.appSecret, '/webhook/shein', timestamp);
      if (!signValid) {
        console.warn(`[Webhook] SHEIN签名验证失败, eventCode=${eventCode}`);
        await logWebhookEvent('shein', eventCode, openKeyId, null, 'sign_failed', '签名验证失败');
        // 继续处理（生产环境可选择拒绝）
      }

      // 3. 获取eventData并解密
      let eventData;
      if (typeof req.body === 'object' && req.body !== null) {
        eventData = req.body.eventData;
      }
      if (!eventData && typeof req.body === 'string') {
        try {
          const parsed = JSON.parse(req.body);
          eventData = parsed.eventData;
        } catch (e) {
          eventData = req.body;
        }
      }

      if (!eventData) {
        console.warn('[Webhook] SHEIN: 未收到eventData');
        await logWebhookEvent('shein', eventCode, openKeyId, null, 'error', '未收到eventData');
        return;
      }

      let decryptedData;
      try {
        decryptedData = decryptSheinEventData(eventData, credentials.appSecret);
        console.log(`[Webhook] SHEIN解密成功, eventCode=${eventCode}, 数据长度=${decryptedData.length}`);
      } catch (e) {
        console.error(`[Webhook] SHEIN解密失败: ${e.message}`);
        await logWebhookEvent('shein', eventCode, openKeyId, null, 'decrypt_failed', e.message);
        return;
      }

      // 查找店铺ID用于日志
      const shop = await findShopByOpenKeyId(openKeyId);
      shopId = shop?.id || null;

      // 4. 根据事件类型分发处理
      switch (eventCode) {
        case 'purchase_order_notice': {
          const result = await handlePurchaseOrderNotice(decryptedData, openKeyId);
          await logWebhookEvent('shein', eventCode, openKeyId, shopId, result.success ? 'success' : 'error', result.message);
          break;
        }

        case 'delivery_modify_notice': {
          console.log(`[Webhook] 发货单变更通知:`, decryptedData.substring(0, 200));
          await logWebhookEvent('shein', eventCode, openKeyId, shopId, 'received', decryptedData.substring(0, 500));
          // TODO: 发货单变更处理
          break;
        }

        case 'logistics_order_result_notice': {
          console.log(`[Webhook] 物流单下单通知:`, decryptedData.substring(0, 200));
          await logWebhookEvent('shein', eventCode, openKeyId, shopId, 'received', decryptedData.substring(0, 500));
          // TODO: 物流单处理
          break;
        }

        default: {
          console.log(`[Webhook] SHEIN未处理的事件: ${eventCode}`, decryptedData.substring(0, 200));
          await logWebhookEvent('shein', eventCode, openKeyId, shopId, 'ignored', decryptedData.substring(0, 500));
        }
      }
    } catch (error) {
      console.error(`[Webhook] SHEIN异步处理失败: ${error.message}`, error.stack);
      await logWebhookEvent('shein', eventCode, openKeyId, shopId, 'error', error.message);
    }
  });
});

// ==================== 其他平台 Webhook ====================

/**
 * TEMU Webhook
 * POST /webhook/temu
 */
router.post('/temu', async (req, res) => {
  try {
    const body = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const { shop_id: shopId, event_type: eventType } = body;
    console.log(`[Webhook] TEMU事件: ${eventType}`, { shopId });
    await logWebhookEvent('temu', eventType, '', shopId, 'received', JSON.stringify(body).substring(0, 500));
    res.json({ success: true });
  } catch (error) {
    console.error('[Webhook] TEMU处理失败:', error);
    res.status(200).json({ success: true });
  }
});

/**
 * TikTok Webhook
 * POST /webhook/tiktok
 */
router.post('/tiktok', async (req, res) => {
  try {
    const body = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const { shop_id: shopId, type: eventType } = body;
    console.log(`[Webhook] TikTok事件: ${eventType}`, { shopId });
    await logWebhookEvent('tiktok', eventType, '', shopId, 'received', JSON.stringify(body).substring(0, 500));
    res.json({ code: 0, message: 'success' });
  } catch (error) {
    console.error('[Webhook] TikTok处理失败:', error);
    res.status(200).json({ code: 0, message: 'success' });
  }
});

/**
 * 通用Webhook（根据header判断平台）
 * POST /webhook
 */
router.post('/', async (req, res) => {
  try {
    // 根据header判断平台
    let platform = 'unknown';
    if (req.headers['x-lt-signature']) {
      platform = 'shein';
    } else if (req.headers['x-temu-signature']) {
      platform = 'temu';
    } else if (req.headers['x-tiktok-signature']) {
      platform = 'tiktok';
    }
    console.log(`[Webhook] 通用接收: ${platform}`);
    await logWebhookEvent(platform, 'generic', '', null, 'received', JSON.stringify(req.body).substring(0, 500));
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Webhook] 处理失败:', error);
    res.status(200).json({ success: true });
  }
});

/**
 * Webhook测试端点
 * POST /webhook/test
 */
router.post('/test', (req, res) => {
  console.log('[Webhook] 测试请求:', {
    headers: req.headers,
    body: req.body
  });
  res.json({
    success: true,
    message: 'Webhook测试成功',
    received: req.body
  });
});

/**
 * 查询Webhook事件日志
 * GET /webhook/logs
 */
router.get('/logs', async (req, res) => {
  try {
    const { page = 1, limit = 50, event_code, platform, status } = req.query;
    const offset = (page - 1) * limit;

    let where = '1=1';
    const params = {};
    if (event_code) { where += ' AND event_code = :event_code'; params.event_code = event_code; }
    if (platform) { where += ' AND platform = :platform'; params.platform = platform; }
    if (status) { where += ' AND status = :status'; params.status = status; }

    const [countResult] = await sequelize.query(
      `SELECT COUNT(*) as total FROM webhook_event_logs WHERE ${where}`,
      { replacements: params, type: QueryTypes.SELECT }
    );

    const logs = await sequelize.query(
      `SELECT * FROM webhook_event_logs WHERE ${where} ORDER BY created_at DESC LIMIT :limit OFFSET :offset`,
      { replacements: { ...params, limit: parseInt(limit), offset }, type: QueryTypes.SELECT }
    );

    res.json({ success: true, data: logs, total: countResult?.total || 0, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
