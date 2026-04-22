/**
 * SKU销量路由（占位）
 */

const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ success: true, data: [], total: 0 });
});

router.get('/stats', (req, res) => {
  res.json({ success: true, data: {} });
});

module.exports = router;
