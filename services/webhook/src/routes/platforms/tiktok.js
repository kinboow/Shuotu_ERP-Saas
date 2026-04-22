/**
 * TIKTOK平台 Webhook路由
 * 统一回调地址: /tiktok/callback
 * 
 * TODO: 根据TIKTOK平台的Webhook文档实现具体逻辑
 */

const express = require('express');
const router = express.Router();

// 从环境变量获取配置
const APP_KEY = process.env.TIKTOK_APP_KEY || '';
const APP_SECRET = process.env.TIKTOK_APP_SECRET || '';

/**
 * 统一回调入口
 * POST /tiktok/callback
 * 
 * 在TIKTOK后台配置的回调地址: https://your-domain:8443/tiktok/callback
 */
router.post('/callback', async (req, res) => {
  try {
    console.log('\n[TIKTOK] ========== 收到Webhook ==========');
    console.log('[TIKTOK] Headers:', JSON.stringify(req.headers, null, 2));
    console.log('[TIKTOK] Body:', JSON.stringify(req.body, null, 2));
    
    // TODO: 根据TIKTOK平台的签名规则验证签名
    // TODO: 根据TIKTOK平台的加密规则解密数据
    // TODO: 根据消息类型分发处理
    
    const data = req.body;
    const eventType = data.type || data.event_type || 'unknown';
    
    console.log(`[TIKTOK] 事件类型: ${eventType}`);
    
    // 根据事件类型分发处理
    await handleEvent(eventType, data);
    
    res.status(200).json({ success: true, message: 'received' });
  } catch (error) {
    console.error('[TIKTOK] 处理失败:', error);
    res.status(200).json({ success: true, message: 'received' });
  }
});

/**
 * 事件分发处理
 */
async function handleEvent(eventType, data) {
  switch (eventType) {
    case 'order':
      console.log('[TIKTOK-订单]', data);
      break;
    case 'delivery':
      console.log('[TIKTOK-发货单]', data);
      break;
    case 'product':
      console.log('[TIKTOK-商品]', data);
      break;
    default:
      console.log(`[TIKTOK] 未知事件类型: ${eventType}`);
  }
}

module.exports = router;
