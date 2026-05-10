/**
 * 库存API路由
 */

const express = require('express');
const router = express.Router();
const inventoryService = require('../services/inventory.service');
const { getRequiredEnterpriseIdFromRequest } = require('../services/tenant-context.service');

/**
 * 查询库存列表
 * GET /api/inventory
 */
router.get('/', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const result = await inventoryService.queryInventory(req.query, enterpriseId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/warehouses', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const warehouses = await inventoryService.listWarehouses(enterpriseId);
    res.json({ success: true, data: warehouses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/logs', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const result = await inventoryService.queryStockLogs(req.query, enterpriseId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/records', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const inventory = await inventoryService.saveInventoryRecord(req.body, enterpriseId);
    res.json({ success: true, data: inventory });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.put('/records/:id', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const inventory = await inventoryService.saveInventoryRecord(req.body, enterpriseId, req.params.id);
    res.json({ success: true, data: inventory });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.delete('/records/:id', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    await inventoryService.deleteInventoryRecord(req.params.id, enterpriseId);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * 获取单个SKU库存
 * GET /api/inventory/:skuId
 */
router.get('/:skuId', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const { warehouseId } = req.query;
    const inventory = await inventoryService.getInventory(req.params.skuId, warehouseId, enterpriseId);
    res.json({ success: true, data: inventory });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 批量获取库存
 * POST /api/inventory/batch
 */
router.post('/batch', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const { skuIds, warehouseId } = req.body;
    if (!skuIds || !Array.isArray(skuIds)) {
      return res.status(400).json({ success: false, message: '缺少skuIds数组' });
    }
    const inventoryMap = await inventoryService.getInventoryBatch(skuIds, warehouseId, enterpriseId);
    const result = {};
    inventoryMap.forEach((inv, skuId) => {
      result[skuId] = inv;
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 入库
 * POST /api/inventory/inbound
 */
router.post('/inbound', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const { skuId, quantity, warehouseId, referenceNo, referenceType, operatorId, operatorName, remark } = req.body;
    if (!skuId || !quantity) {
      return res.status(400).json({ success: false, message: '缺少skuId或quantity' });
    }
    const inventory = await inventoryService.inbound(skuId, quantity, {
      warehouseId, referenceNo, referenceType, operatorId, operatorName, remark, enterpriseId
    });
    res.json({ success: true, data: inventory });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * 出库
 * POST /api/inventory/outbound
 */
router.post('/outbound', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const { skuId, quantity, warehouseId, referenceNo, operatorId, operatorName } = req.body;
    if (!skuId || !quantity) {
      return res.status(400).json({ success: false, message: '缺少skuId或quantity' });
    }
    const inventory = await inventoryService.outbound(skuId, quantity, {
      warehouseId, referenceNo, operatorId, operatorName, enterpriseId
    });
    res.json({ success: true, data: inventory });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * 锁定库存
 * POST /api/inventory/lock
 */
router.post('/lock', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const { skuId, quantity, warehouseId, referenceNo, operatorId, operatorName } = req.body;
    if (!skuId || !quantity) {
      return res.status(400).json({ success: false, message: '缺少skuId或quantity' });
    }
    const inventory = await inventoryService.lockStock(skuId, quantity, {
      warehouseId, referenceNo, operatorId, operatorName, enterpriseId
    });
    res.json({ success: true, data: inventory });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * 解锁库存
 * POST /api/inventory/unlock
 */
router.post('/unlock', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const { skuId, quantity, warehouseId, referenceNo, operatorId, operatorName } = req.body;
    if (!skuId || !quantity) {
      return res.status(400).json({ success: false, message: '缺少skuId或quantity' });
    }
    const inventory = await inventoryService.unlockStock(skuId, quantity, {
      warehouseId, referenceNo, operatorId, operatorName, enterpriseId
    });
    res.json({ success: true, data: inventory });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * 库存调整
 * POST /api/inventory/adjust
 */
router.post('/adjust', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const { skuId, quantity, warehouseId, operatorId, operatorName, remark } = req.body;
    if (!skuId || quantity === undefined) {
      return res.status(400).json({ success: false, message: '缺少skuId或quantity' });
    }
    const inventory = await inventoryService.adjust(skuId, quantity, {
      warehouseId, operatorId, operatorName, remark, enterpriseId
    });
    res.json({ success: true, data: inventory });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * 获取库存预警
 * GET /api/inventory/alerts
 */
router.get('/alerts/list', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const { warehouseId } = req.query;
    const alerts = await inventoryService.getAlerts(warehouseId, enterpriseId);
    res.json({ success: true, data: alerts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 获取库存日志
 * GET /api/inventory/:skuId/logs
 */
router.get('/:skuId/logs', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const result = await inventoryService.getStockLogs(req.params.skuId, req.query, enterpriseId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
