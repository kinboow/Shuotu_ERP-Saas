const express = require('express');
const router = express.Router();

/**
 * SHEIN订单路由
 * 所有API调用功能已删除，待重新实现
 */

/**
 * 同步SHEIN采购单（备货单/急采单）
 * POST /api/shein-orders/sync/:shopId
 * 功能已删除，请使用导航栏的"同步数据"按钮勾选"采购单"进行同步
 * 实际调用路由：POST /api/shein-sync/batch
 */
router.post('/sync/:shopId', async (req, res) => {
  res.json({
    success: false,
    message: '请使用导航栏的"同步数据"按钮勾选"采购单"进行同步'
  });
});

/**
 * 获取采购单详情（通过订单号）
 * GET /api/shein-orders/detail/:shopId/:orderNo
 * 功能已删除，待重新实现
 */
router.get('/detail/:shopId/:orderNo', async (req, res) => {
  res.json({
    success: false,
    message: '功能开发中：获取采购单详情'
  });
});

/**
 * 查询JIT母单及子单对应关系
 * GET /api/shein-orders/jit/:shopId
 * 功能已删除，待重新实现
 */
router.get('/jit/:shopId', async (req, res) => {
  res.json({
    success: false,
    message: '功能开发中：查询JIT母单子单关系'
  });
});

module.exports = router;
