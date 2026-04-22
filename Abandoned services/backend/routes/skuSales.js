const express = require('express');
const router = express.Router();

/**
 * SKU销量路由
 * 所有API调用功能已删除，待重新实现
 */

/**
 * 查询SKU销量
 * POST /api/sku-sales/query
 * 功能已删除，待重新实现
 */
router.post('/query', async (req, res) => {
  res.json({
    success: false,
    message: '功能开发中：查询SKU销量'
  });
});

module.exports = router;
