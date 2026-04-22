const express = require('express');
const router = express.Router();

/**
 * 库存管理路由
 * 所有API调用功能已删除，待重新实现
 */

/**
 * 查询库存
 * POST /api/inventory/query
 * 功能已删除，待重新实现
 */
router.post('/query', async (req, res) => {
  res.json({
    success: false,
    message: '功能开发中：查询库存'
  });
});

/**
 * 同步在线商品库存
 * POST /api/inventory/sync-online-products
 * 功能已删除，待重新实现
 */
router.post('/sync-online-products', async (req, res) => {
  res.json({
    success: false,
    message: '功能开发中：同步在线商品库存'
  });
});

module.exports = router;
