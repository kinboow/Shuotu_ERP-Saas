/**
 * 消息队列状态路由
 * 提供 MQ 健康检查和管理接口
 */

const express = require('express');
const router = express.Router();
const { getMQ } = require('../services/mq');

// MQ 健康检查
router.get('/health', (req, res) => {
  const mq = getMQ();
  res.json({
    success: true,
    data: {
      connected: mq ? mq.connected : false,
      service: 'misc',
      timestamp: new Date().toISOString()
    }
  });
});

// 发送测试消息
router.post('/test', async (req, res) => {
  try {
    const mq = getMQ();
    if (!mq || !mq.connected) {
      return res.json({ success: false, message: 'MQ 未连接' });
    }

    const { queue, message } = req.body;
    if (!queue || !message) {
      return res.status(400).json({ success: false, message: '缺少 queue 或 message 参数' });
    }

    const msgId = await mq.sendToQueue(queue, message);
    res.json({ success: true, data: { messageId: msgId } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
