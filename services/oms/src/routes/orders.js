/**
 * 订单API路由
 */

const express = require('express');
const router = express.Router();
const orderService = require('../services/order.service');
const { getRequiredEnterpriseIdFromRequest } = require('../services/tenant-context.service');

/**
 * 查询订单列表
 * GET /api/orders
 */
router.get('/', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const result = await orderService.queryOrders(req.query, enterpriseId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 获取订单详情
 * GET /api/orders/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const order = await orderService.getOrderDetail(req.params.id, enterpriseId);
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
});

/**
 * 创建订单（从同步引擎接收）
 * POST /api/orders
 */
router.post('/', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const result = await orderService.createOrder(req.body, req.body.source || 'API', enterpriseId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * 批量创建/更新订单
 * POST /api/orders/batch
 */
router.post('/batch', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const { orders, source } = req.body;
    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({ success: false, message: '缺少orders数组' });
    }
    const result = await orderService.batchUpsert(orders, source || 'SYNC', enterpriseId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 更新订单状态
 * PUT /api/orders/:id/status
 */
router.put('/:id/status', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const { status, operatorId, operatorName, detail } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: '缺少status' });
    }
    const order = await orderService.updateStatus(req.params.id, status, {
      operatorId,
      operatorName,
      source: 'API',
      detail,
      enterpriseId
    });
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * 订单发货
 * POST /api/orders/:id/ship
 */
router.post('/:id/ship', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const { company, companyCode, trackingNo, operatorId, operatorName } = req.body;
    if (!trackingNo) {
      return res.status(400).json({ success: false, message: '缺少物流单号' });
    }
    const order = await orderService.shipOrder(req.params.id, {
      company,
      companyCode,
      trackingNo
    }, { operatorId, operatorName, enterpriseId });
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * 取消订单
 * POST /api/orders/:id/cancel
 */
router.post('/:id/cancel', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const { reason, operatorId, operatorName } = req.body;
    const order = await orderService.updateStatus(req.params.id, 'CANCELLED', {
      operatorId,
      operatorName,
      source: 'API',
      detail: { reason },
      enterpriseId
    });
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * 订单统计
 * GET /api/orders/stats/summary
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const stats = await orderService.getStatistics(req.query, enterpriseId);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
