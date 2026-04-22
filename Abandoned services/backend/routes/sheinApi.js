const express = require('express');
const router = express.Router();

/**
 * SHEIN API代理路由
 * 所有API调用功能已删除，待重新实现
 */

/**
 * SHEIN API代理
 * POST /api/shein-api/proxy
 * 功能已删除，待重新实现
 */
router.post('/proxy', async (req, res) => {
  res.json({
    success: false,
    message: '功能开发中：SHEIN API代理'
  });
});

module.exports = router;
