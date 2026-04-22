/**
 * Webhook接收路由
 * 处理各平台的消息推送
 */

const express = require('express');
const router = express.Router();
const adapterManager = require('../adapters');

/**
 * SHEIN Webhook
 * POST /webhook/shein
 */
router.post('/shein', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { shopId, eventType, data } = body;

    console.log(`[Webhook] SHEIN事件: ${eventType}`, { shopId });

    // 获取适配器验证签名
    if (adapterManager.has(shopId)) {
      const adapter = adapterManager.get(shopId);
      
      if (!adapter.verifyWebhook(req.headers, body)) {
        console.warn(`[Webhook] SHEIN签名验证失败: ${shopId}`);
        // 暂时不拒绝，记录日志
      }

      // 解析事件
      const event = adapter.parseWebhook(eventType, data);
      console.log(`[Webhook] SHEIN解析事件:`, event.type);

      // TODO: 发布事件到消息队列
      // eventBus.publish(event.type, event.data);
    }

    // 返回成功，避免平台重试
    res.json({ success: true });
  } catch (error) {
    console.error('[Webhook] SHEIN处理失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * TEMU Webhook
 * POST /webhook/temu
 */
router.post('/temu', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { shop_id: shopId, event_type: eventType, data } = body;

    console.log(`[Webhook] TEMU事件: ${eventType}`, { shopId });

    if (adapterManager.has(shopId)) {
      const adapter = adapterManager.get(shopId);
      
      if (!adapter.verifyWebhook(req.headers, body)) {
        console.warn(`[Webhook] TEMU签名验证失败: ${shopId}`);
      }

      const event = adapter.parseWebhook(eventType, data);
      console.log(`[Webhook] TEMU解析事件:`, event.type);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Webhook] TEMU处理失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * TikTok Webhook
 * POST /webhook/tiktok
 */
router.post('/tiktok', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { shop_id: shopId, type: eventType, data } = body;

    console.log(`[Webhook] TikTok事件: ${eventType}`, { shopId });

    if (adapterManager.has(shopId)) {
      const adapter = adapterManager.get(shopId);
      
      if (!adapter.verifyWebhook(req.headers, body)) {
        console.warn(`[Webhook] TikTok签名验证失败: ${shopId}`);
      }

      const event = adapter.parseWebhook(eventType, data);
      console.log(`[Webhook] TikTok解析事件:`, event.type);
    }

    res.json({ code: 0, message: 'success' });
  } catch (error) {
    console.error('[Webhook] TikTok处理失败:', error);
    res.status(500).json({ code: -1, message: error.message });
  }
});

/**
 * 通用Webhook（根据header判断平台）
 * POST /webhook
 */
router.post('/', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    
    // 根据header或body判断平台
    let platform = 'unknown';
    if (req.headers['x-lt-signature']) {
      platform = 'shein_full';
    } else if (req.headers['x-temu-signature']) {
      platform = 'temu';
    } else if (req.headers['x-tiktok-signature']) {
      platform = 'tiktok';
    }

    console.log(`[Webhook] 通用接收: ${platform}`, body);

    res.json({ success: true });
  } catch (error) {
    console.error('[Webhook] 处理失败:', error);
    res.status(500).json({ success: false, message: error.message });
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

module.exports = router;
