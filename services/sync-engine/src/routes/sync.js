/**
 * 同步API路由
 */

const express = require('express');
const router = express.Router();
const adapterManager = require('../adapters');
const scheduler = require('../engine/scheduler');
const SyncEngine = require('../engine/sync-engine');
const PlatformConfigService = require('../services/platform-config.service');
const { getRequiredEnterpriseIdFromRequest } = require('../services/tenant-context.service');

const syncEngine = new SyncEngine();

async function ensureShopBelongsToEnterprise(shopId, enterpriseId) {
  const shop = await PlatformConfigService.getShopConfig(shopId, enterpriseId);
  if (!shop) {
    throw new Error('店铺不存在或不属于当前企业');
  }
  return shop;
}

async function getEnterpriseShopIdSet(enterpriseId) {
  const shops = await PlatformConfigService.getEnterpriseShops(enterpriseId);
  return new Set(shops.map(shop => String(shop.id)));
}

/**
 * 获取支持的平台列表
 * GET /api/sync/platforms
 */
router.get('/platforms', (req, res) => {
  res.json({
    success: true,
    data: adapterManager.getSupportedPlatforms()
  });
});

/**
 * 获取已注册的适配器列表
 * GET /api/sync/adapters
 */
router.get('/adapters', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const allowedShopIds = await getEnterpriseShopIdSet(enterpriseId);
    const adapters = adapterManager.getAll()
      .filter(({ shopId }) => allowedShopIds.has(String(shopId)))
      .map(({ shopId, platform, adapter }) => ({
        shopId,
        platform,
        info: adapter.getInfo()
      }));

    res.json({
      success: true,
      data: adapters,
      stats: {
        total: adapters.length,
        byPlatform: adapters.reduce((acc, adapter) => {
          acc[adapter.platform] = (acc[adapter.platform] || 0) + 1;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 注册适配器
 * POST /api/sync/adapters
 */
router.post('/adapters', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const { shopId, platform, config } = req.body;

    if (!shopId || !platform) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数: shopId, platform'
      });
    }

    await ensureShopBelongsToEnterprise(shopId, enterpriseId);

    const adapter = adapterManager.register(shopId, platform, config);

    res.json({
      success: true,
      message: '适配器注册成功',
      data: adapter.getInfo()
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 移除适配器
 * DELETE /api/sync/adapters/:shopId
 */
router.delete('/adapters/:shopId', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const { shopId } = req.params;

    await ensureShopBelongsToEnterprise(shopId, enterpriseId);

    if (!adapterManager.has(shopId)) {
      return res.status(404).json({
        success: false,
        message: '适配器不存在'
      });
    }

    adapterManager.remove(shopId);
    scheduler.removeJob(shopId);

    res.json({
      success: true,
      message: '适配器已移除'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 手动触发订单同步
 * POST /api/sync/orders
 */
router.post('/orders', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const { shopId, startTime, endTime, status, pageSize } = req.body;

    if (!shopId) {
      return res.status(400).json({
        success: false,
        message: '缺少shopId'
      });
    }

    await ensureShopBelongsToEnterprise(shopId, enterpriseId);

    const result = await syncEngine.syncOrders(shopId, {
      startTime: startTime ? new Date(startTime) : new Date(Date.now() - 24 * 60 * 60 * 1000),
      endTime: endTime ? new Date(endTime) : new Date(),
      status,
      pageSize
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 手动触发商品同步
 * POST /api/sync/products
 */
router.post('/products', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const { shopId, pageSize } = req.body;

    if (!shopId) {
      return res.status(400).json({
        success: false,
        message: '缺少shopId'
      });
    }

    await ensureShopBelongsToEnterprise(shopId, enterpriseId);

    const result = await syncEngine.syncProducts(shopId, { pageSize });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 同步库存到平台
 * POST /api/sync/inventory
 */
router.post('/inventory', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const { shopId, skuList } = req.body;

    if (!shopId || !skuList || !Array.isArray(skuList)) {
      return res.status(400).json({
        success: false,
        message: '缺少shopId或skuList'
      });
    }

    await ensureShopBelongsToEnterprise(shopId, enterpriseId);

    const result = await syncEngine.syncInventory(shopId, skuList);

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 订单发货
 * POST /api/sync/ship
 */
router.post('/ship', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const { shopId, orderId, logistics } = req.body;

    if (!shopId || !orderId || !logistics) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }

    await ensureShopBelongsToEnterprise(shopId, enterpriseId);

    const result = await syncEngine.shipOrder(shopId, orderId, logistics);

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取订单详情
 * GET /api/sync/orders/:shopId/:orderId
 */
router.get('/orders/:shopId/:orderId', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const { shopId, orderId } = req.params;

    await ensureShopBelongsToEnterprise(shopId, enterpriseId);

    const order = await syncEngine.getOrderDetail(shopId, orderId);

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 配置定时同步
 * POST /api/sync/schedule
 */
router.post('/schedule', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const { shopId, ordersCron, productsCron, enabled } = req.body;

    if (!shopId) {
      return res.status(400).json({
        success: false,
        message: '缺少shopId'
      });
    }

    await ensureShopBelongsToEnterprise(shopId, enterpriseId);

    scheduler.addJob(shopId, { ordersCron, productsCron, enabled });

    res.json({
      success: true,
      message: '定时任务已配置'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取调度器状态
 * GET /api/sync/schedule/status
 */
router.get('/schedule/status', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const allowedShopIds = await getEnterpriseShopIdSet(enterpriseId);
    const status = scheduler.getStatus();
    const shops = status.shops.filter(shop => allowedShopIds.has(String(shop.shopId)));

    res.json({
      success: true,
      data: {
        totalJobs: shops.length,
        shops
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 同步所有店铺订单
 * POST /api/sync/all/orders
 */
router.post('/all/orders', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const { startTime, endTime } = req.body;
    const allowedShopIds = await getEnterpriseShopIdSet(enterpriseId);
    const results = [];

    for (const { shopId } of adapterManager.getAll()) {
      if (!allowedShopIds.has(String(shopId))) {
        continue;
      }

      try {
        const result = await syncEngine.syncOrders(shopId, {
          startTime: startTime ? new Date(startTime) : new Date(Date.now() - 24 * 60 * 60 * 1000),
          endTime: endTime ? new Date(endTime) : new Date()
        });
        results.push(result);
      } catch (error) {
        results.push({
          shopId,
          success: false,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
