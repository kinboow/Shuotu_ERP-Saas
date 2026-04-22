/**
 * 平台配置路由
 */

const express = require('express');
const router = express.Router();
const { PlatformConfig, PlatformShop } = require('../models');
const PlatformConfigService = require('../services/platform-config.service');

// ==================== 平台配置 ====================

/**
 * 获取平台列表
 * GET /api/platforms
 */
router.get('/', async (req, res) => {
  try {
    const platforms = await PlatformConfigService.getAllPlatforms();
    res.json({ success: true, data: platforms });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

/**
 * 获取单个平台配置
 * GET /api/platforms/:name
 */
router.get('/:name', async (req, res) => {
  try {
    const platform = await PlatformConfigService.getPlatformConfig(req.params.name);
    if (!platform) {
      return res.json({ success: false, message: '平台不存在' });
    }
    res.json({ success: true, data: platform });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

/**
 * 创建/更新平台配置
 * POST /api/platforms
 */
router.post('/', async (req, res) => {
  try {
    const { platformName, platformDisplayName, baseUrl, appKey, appSecret, extraConfig, remark } = req.body;
    
    const [platform, created] = await PlatformConfig.findOrCreate({
      where: { platformName },
      defaults: { platformDisplayName, baseUrl, appKey, appSecret, extraConfig, remark }
    });
    
    if (!created) {
      await platform.update({ platformDisplayName, baseUrl, appKey, appSecret, extraConfig, remark });
    }
    
    PlatformConfigService.clearCache();
    res.json({ success: true, data: platform, message: created ? '创建成功' : '更新成功' });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

/**
 * 更新平台配置
 * PUT /api/platforms/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const platform = await PlatformConfig.findByPk(req.params.id);
    if (!platform) {
      return res.json({ success: false, message: '平台不存在' });
    }
    
    await platform.update(req.body);
    PlatformConfigService.clearCache();
    res.json({ success: true, data: platform, message: '更新成功' });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

/**
 * 删除平台配置
 * DELETE /api/platforms/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    await PlatformConfig.update({ status: 0 }, { where: { id: req.params.id } });
    PlatformConfigService.clearCache();
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

// ==================== 店铺配置 ====================

/**
 * 获取店铺列表
 * GET /api/platforms/shops
 */
router.get('/shops/list', async (req, res) => {
  try {
    const { platform_id, platformName } = req.query;
    const where = { status: 1 };
    
    if (platform_id) where.platformId = platform_id;
    
    // 支持通过平台名称查询
    if (platformName) {
      const platform = await PlatformConfig.findOne({ where: { platformName } });
      if (platform) where.platformId = platform.id;
    }
    
    const shops = await PlatformShop.findAll({
      where,
      include: [{ model: PlatformConfig, as: 'platform', attributes: ['platformName', 'platformDisplayName'] }],
      order: [['platformId', 'ASC'], ['id', 'ASC']]
    });
    
    res.json({ success: true, data: shops });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

/**
 * 获取单个店铺
 * GET /api/platforms/shops/:id
 */
router.get('/shops/:id', async (req, res) => {
  try {
    const shop = await PlatformShop.findByPk(req.params.id, {
      include: [{ model: PlatformConfig, as: 'platform' }]
    });
    if (!shop) {
      return res.json({ success: false, message: '店铺不存在' });
    }
    res.json({ success: true, data: shop });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

/**
 * 创建店铺
 * POST /api/platforms/shops
 */
router.post('/shops', async (req, res) => {
  try {
    const { platformId, platformName, shopName, openKeyId, secretKey, sellerId, accessToken, refreshToken, extraConfig, remark } = req.body;
    
    let finalPlatformId = platformId;
    if (!finalPlatformId && platformName) {
      const platform = await PlatformConfig.findOne({ where: { platformName } });
      if (platform) finalPlatformId = platform.id;
    }
    
    if (!finalPlatformId) {
      return res.json({ success: false, message: '请指定平台' });
    }
    
    const shop = await PlatformShop.create({
      platformId: finalPlatformId,
      shopName,
      openKeyId,
      secretKey,
      sellerId,
      accessToken,
      refreshToken,
      extraConfig,
      remark
    });
    
    PlatformConfigService.clearCache();
    res.json({ success: true, data: shop, message: '店铺创建成功' });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

/**
 * 更新店铺
 * PUT /api/platforms/shops/:id
 */
router.put('/shops/:id', async (req, res) => {
  try {
    const shop = await PlatformShop.findByPk(req.params.id);
    if (!shop) {
      return res.json({ success: false, message: '店铺不存在' });
    }
    
    await shop.update(req.body);
    PlatformConfigService.clearCache();
    res.json({ success: true, data: shop, message: '店铺更新成功' });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

/**
 * 删除店铺
 * DELETE /api/platforms/shops/:id
 */
router.delete('/shops/:id', async (req, res) => {
  try {
    await PlatformShop.update({ status: 0 }, { where: { id: req.params.id } });
    PlatformConfigService.clearCache();
    res.json({ success: true, message: '店铺删除成功' });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

/**
 * 测试店铺连接
 * POST /api/platforms/shops/:id/test
 */
router.post('/shops/:id/test', async (req, res) => {
  try {
    const shop = await PlatformShop.findByPk(req.params.id, {
      include: [{ model: PlatformConfig, as: 'platform' }]
    });
    
    if (!shop) {
      return res.json({ success: false, message: '店铺不存在' });
    }
    
    // 获取适配器并测试连接
    const { getAdapter } = require('../adapters');
    const config = await PlatformConfigService.getAdapterConfig(shop.platform.platformName, shop.id);
    const adapter = getAdapter(shop.platform.platformName, config);
    
    await adapter.authenticate();
    
    res.json({ success: true, message: '连接测试成功' });
  } catch (error) {
    res.json({ success: false, message: `连接测试失败: ${error.message}` });
  }
});

module.exports = router;
