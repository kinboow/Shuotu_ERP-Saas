/**
 * 审核订单路由（占位）
 */

const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ success: true, data: [], total: 0 });
});

router.post('/approve/:id', (req, res) => {
  res.json({ success: false, message: '功能迁移中' });
});

router.post('/reject/:id', (req, res) => {
  res.json({ success: false, message: '功能迁移中' });
});

module.exports = router;
