/**
 * 备货单审核列表路由
 * API调用功能已删除，待重新实现
 */

const express = require('express');
const router = express.Router();

/**
 * 获取备货单审核列表
 * POST /api/review-orders
 * 功能已删除，待重新实现
 */
router.post('/', async (req, res) => {
  res.json({
    success: false,
    message: '功能开发中：获取备货单审核列表'
  });
});

module.exports = router;
