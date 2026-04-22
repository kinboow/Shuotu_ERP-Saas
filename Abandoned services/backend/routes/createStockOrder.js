const express = require('express');
const router = express.Router();

/**
 * 创建备货单路由
 * 所有API调用功能已删除，待重新实现
 */

/**
 * 创建备货单
 * POST /api/create-stock-order
 * 功能已删除，待重新实现
 */
router.post('/', async (req, res) => {
  res.json({
    success: false,
    message: '功能开发中：创建备货单'
  });
});

module.exports = router;
