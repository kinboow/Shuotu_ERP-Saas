/**
 * 平台配置路由
 */

const express = require('express');
const router = express.Router();
const { PlatformConfig, PlatformShop } = require('../models');
const PlatformConfigService = require('../services/platform-config.service');
const {
  ensureTenantColumns,
  getEnterpriseIdFromRequest,
  getRequiredEnterpriseIdFromRequest
} = require('../services/tenant-context.service');

async function resolvePlatformForEnterprise({ platformId, platformName, enterpriseId, includeInactive = false }) {
  await ensureTenantColumns();

  if (platformName) {
    return PlatformConfigService.getPlatformInstance(platformName, enterpriseId, includeInactive);
  }

  if (!platformId) {
    return null;
  }

  const platform = await PlatformConfig.findByPk(platformId);
  if (!platform) {
    return null;
  }

  if (Number(platform.enterpriseId) !== 0 && Number(platform.enterpriseId) !== Number(enterpriseId)) {
    return null;
  }

  return platform;
}

// ==================== 平台配置 ====================

/**
 * 获取平台列表
 * GET /api/platforms
 */
router.get('/', async (req, res) => {
  try {
    const enterpriseId = getEnterpriseIdFromRequest(req);
    const platforms = await PlatformConfigService.getAllPlatforms(enterpriseId);
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
    const enterpriseId = getEnterpriseIdFromRequest(req);
    const platform = await PlatformConfigService.getPlatformConfig(req.params.name, enterpriseId);
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
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const { platformName, platformDisplayName, baseUrl, appKey, appSecret, extraConfig, remark } = req.body;
    const globalPlatform = await PlatformConfig.findOne({ where: { platformName, enterpriseId: 0 } });
    
    const [platform, created] = await PlatformConfig.findOrCreate({
      where: { platformName, enterpriseId },
      defaults: {
        enterpriseId,
        platformName,
        platformDisplayName: platformDisplayName ?? globalPlatform?.platformDisplayName ?? null,
        baseUrl: baseUrl ?? globalPlatform?.baseUrl ?? null,
        appKey: appKey ?? globalPlatform?.appKey ?? null,
        appSecret: appSecret ?? globalPlatform?.appSecret ?? null,
        extraConfig: extraConfig ?? globalPlatform?.extraConfig ?? null,
        remark: remark ?? globalPlatform?.remark ?? null,
        sortOrder: globalPlatform?.sortOrder ?? 0,
        status: 1
      }
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
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    let platform = await PlatformConfig.findOne({ where: { id: req.params.id, enterpriseId } });

    if (!platform) {
      const sourcePlatform = await PlatformConfig.findByPk(req.params.id);
      if (!sourcePlatform || Number(sourcePlatform.enterpriseId) !== 0) {
        return res.json({ success: false, message: '平台不存在' });
      }

      const [overlayPlatform] = await PlatformConfig.findOrCreate({
        where: { enterpriseId, platformName: sourcePlatform.platformName },
        defaults: {
          enterpriseId,
          platformName: sourcePlatform.platformName,
          platformDisplayName: sourcePlatform.platformDisplayName,
          baseUrl: sourcePlatform.baseUrl,
          appKey: sourcePlatform.appKey,
          appSecret: sourcePlatform.appSecret,
          extraConfig: sourcePlatform.extraConfig,
          remark: sourcePlatform.remark,
          sortOrder: sourcePlatform.sortOrder,
          status: sourcePlatform.status
        }
      });
      platform = overlayPlatform;
    }

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
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    let affectedRows = await PlatformConfig.update({ status: 0 }, { where: { id: req.params.id, enterpriseId } });

    if (!affectedRows[0]) {
      const sourcePlatform = await PlatformConfig.findByPk(req.params.id);
      if (!sourcePlatform || Number(sourcePlatform.enterpriseId) !== 0) {
        return res.json({ success: false, message: '平台不存在' });
      }

      const [overlayPlatform] = await PlatformConfig.findOrCreate({
        where: { enterpriseId, platformName: sourcePlatform.platformName },
        defaults: {
          enterpriseId,
          platformName: sourcePlatform.platformName,
          platformDisplayName: sourcePlatform.platformDisplayName,
          baseUrl: sourcePlatform.baseUrl,
          appKey: sourcePlatform.appKey,
          appSecret: sourcePlatform.appSecret,
          extraConfig: sourcePlatform.extraConfig,
          remark: sourcePlatform.remark,
          sortOrder: sourcePlatform.sortOrder,
          status: 0
        }
      });

      if (Number(overlayPlatform.status) !== 0) {
        await overlayPlatform.update({ status: 0 });
      }
    }

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
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const { platform_id, platformName } = req.query;
    const where = { status: 1, enterpriseId };
    const include = [{ model: PlatformConfig, as: 'platform', attributes: ['platformName', 'platformDisplayName'] }];
    
    if (platform_id) where.platformId = platform_id;
    
    // 支持通过平台名称查询
    if (platformName) {
      include[0].where = { platformName };
      include[0].required = true;
    }
    
    const shops = await PlatformShop.findAll({
      where,
      include,
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
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const shop = await PlatformShop.findOne({
      where: { id: req.params.id, enterpriseId },
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
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const { platformId, platformName, shopName, openKeyId, secretKey, sellerId, accessToken, refreshToken, extraConfig, remark } = req.body;
    
    const platform = await resolvePlatformForEnterprise({ platformId, platformName, enterpriseId });
    const finalPlatformId = platform?.id;
    
    if (!finalPlatformId) {
      return res.json({ success: false, message: '请指定平台' });
    }
    
    const shop = await PlatformShop.create({
      enterpriseId,
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
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const shop = await PlatformShop.findOne({ where: { id: req.params.id, enterpriseId } });
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
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    await PlatformShop.update({ status: 0 }, { where: { id: req.params.id, enterpriseId } });
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
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const shop = await PlatformShop.findOne({
      where: { id: req.params.id, enterpriseId },
      include: [{ model: PlatformConfig, as: 'platform' }]
    });
    
    if (!shop) {
      return res.json({ success: false, message: '店铺不存在' });
    }
    const { getAdapter } = require('../adapters');
    const platformName = shop.platform.platformName || shop.platform.platform_name;
    const config = await PlatformConfigService.getAdapterConfig(platformName, shop.id, enterpriseId);
    const adapter = getAdapter(platformName, config);

    await adapter.authenticate();

    res.json({ success: true, message: '连接测试成功' });
  } catch (error) {
    res.json({ success: false, message: `连接测试失败: ${error.message}` });
  }
});

module.exports = router;
