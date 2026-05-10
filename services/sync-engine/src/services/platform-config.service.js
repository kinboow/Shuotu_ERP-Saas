/**
 * 平台配置服务
 * 提供平台配置的读取和缓存
 */

const { Op } = require('sequelize');
const { PlatformConfig, PlatformShop } = require('../models');
const {
  ensureTenantColumns,
  normalizeEnterpriseId,
  getCurrentEnterpriseId
} = require('./tenant-context.service');

// 配置缓存
let configCache = new Map();
let shopCache = new Map();
let cacheExpireAt = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

function buildCacheKey(type, ...parts) {
  return [type, ...parts.map(item => item === null || item === undefined ? 'global' : item)].join(':');
}

function toShopPayload(shop) {
  const data = typeof shop?.toJSON === 'function' ? shop.toJSON() : { ...(shop || {}) };
  return {
    ...data,
    enterprise_id: data.enterprise_id ?? data.enterpriseId ?? 0,
    enterpriseId: data.enterpriseId ?? data.enterprise_id ?? 0,
    platformId: data.platformId ?? data.platform_id,
    shopName: data.shopName ?? data.shop_name,
    openKeyId: data.openKeyId ?? data.open_key_id,
    secretKey: data.secretKey ?? data.secret_key,
    sellerId: data.sellerId ?? data.seller_id,
    accessToken: data.accessToken ?? data.access_token,
    refreshToken: data.refreshToken ?? data.refresh_token,
    tokenExpireAt: data.tokenExpireAt ?? data.token_expire_at,
    extraConfig: data.extraConfig ?? data.extra_config,
    lastSyncAt: data.lastSyncAt ?? data.last_sync_at,
    isActive: data.isActive ?? data.is_active,
    platform: data.platform || null
  };
}

function toPlatformPayload(platform, shops = undefined) {
  const data = typeof platform?.toJSON === 'function' ? platform.toJSON() : { ...(platform || {}) };
  const nextShops = (shops ?? data.shops ?? []).map(toShopPayload);
  return {
    ...data,
    enterprise_id: data.enterprise_id ?? data.enterpriseId ?? 0,
    enterpriseId: data.enterpriseId ?? data.enterprise_id ?? 0,
    platformName: data.platformName ?? data.platform_name,
    platformDisplayName: data.platformDisplayName ?? data.platform_display_name,
    baseUrl: data.baseUrl ?? data.base_url,
    appKey: data.appKey ?? data.app_key,
    appSecret: data.appSecret ?? data.app_secret,
    extraConfig: data.extraConfig ?? data.extra_config,
    sortOrder: data.sortOrder ?? data.sort_order,
    isActive: data.isActive ?? data.is_active,
    shops: nextShops
  };
}

class PlatformConfigService {
  static resolveEnterpriseId(enterpriseId) {
    return normalizeEnterpriseId(enterpriseId ?? getCurrentEnterpriseId());
  }

  static async getEnterpriseShops(enterpriseId, platformName = null) {
    const scopedEnterpriseId = normalizeEnterpriseId(enterpriseId) ?? 0;
    const include = [{
      model: PlatformConfig,
      as: 'platform',
      where: platformName ? { platformName } : undefined,
      required: true
    }];

    return PlatformShop.findAll({
      where: { status: 1, enterpriseId: scopedEnterpriseId },
      include,
      order: [['platformId', 'ASC'], ['id', 'ASC']]
    });
  }

  static async getPlatformInstance(platformName, enterpriseId, includeInactive = false) {
    const scopedEnterpriseId = normalizeEnterpriseId(enterpriseId);

    if (scopedEnterpriseId !== null) {
      const enterprisePlatform = await PlatformConfig.findOne({
        where: { platformName, enterpriseId: scopedEnterpriseId }
      });

      if (enterprisePlatform) {
        if (!includeInactive && Number(enterprisePlatform.status) !== 1) {
          return null;
        }
        return enterprisePlatform;
      }
    }

    return PlatformConfig.findOne({
      where: {
        platformName,
        enterpriseId: 0,
        ...(includeInactive ? {} : { status: 1 })
      }
    });
  }

  /**
   * 获取所有平台配置
   */
  static async getAllPlatforms(enterpriseId = undefined, options = {}) {
    await ensureTenantColumns();

    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);
    const scope = options.scope || (scopedEnterpriseId === null ? 'global' : 'enterprise');
    const cacheKey = buildCacheKey('platform-list', scope, scopedEnterpriseId);

    if (Date.now() < cacheExpireAt && configCache.has(cacheKey)) {
      return configCache.get(cacheKey);
    }

    let result = [];

    if (scope === 'all') {
      const platforms = await PlatformConfig.findAll({
        where: { status: 1 },
        order: [['sortOrder', 'ASC']],
        include: [{ model: PlatformShop, as: 'shops', where: { status: 1 }, required: false }]
      });

      result = platforms.map(platform => toPlatformPayload(platform));
    } else if (scope === 'global') {
      const platforms = await PlatformConfig.findAll({
        where: { status: 1, enterpriseId: 0 },
        order: [['sortOrder', 'ASC']],
        include: [{ model: PlatformShop, as: 'shops', where: { status: 1, enterpriseId: 0 }, required: false }]
      });

      result = platforms.map(platform => toPlatformPayload(platform));
    } else {
      const [globalPlatforms, enterprisePlatforms, shops] = await Promise.all([
        PlatformConfig.findAll({
          where: { status: 1, enterpriseId: 0 },
          order: [['sortOrder', 'ASC']]
        }),
        PlatformConfig.findAll({
          where: { enterpriseId: scopedEnterpriseId },
          order: [['sortOrder', 'ASC']]
        }),
        this.getEnterpriseShops(scopedEnterpriseId)
      ]);

      const platformMap = new Map();
      globalPlatforms.forEach(platform => {
        platformMap.set(platform.platformName, platform);
      });
      enterprisePlatforms.forEach(platform => {
        platformMap.set(platform.platformName, platform);
      });

      const shopsByPlatformName = new Map();
      shops.forEach(shop => {
        const payload = toShopPayload(shop);
        const platformName = payload.platform?.platformName || payload.platform?.platform_name;
        if (!platformName) {
          return;
        }

        if (!shopsByPlatformName.has(platformName)) {
          shopsByPlatformName.set(platformName, []);
        }
        shopsByPlatformName.get(platformName).push(payload);
      });

      result = Array.from(platformMap.values())
        .filter(platform => Number(platform.status) === 1)
        .map(platform => toPlatformPayload(platform, shopsByPlatformName.get(platform.platformName) || []));
    }

    configCache.set(cacheKey, result);
    cacheExpireAt = Date.now() + CACHE_TTL;
    return result;
  }

  static async getAllPlatformsForBootstrap() {
    return this.getAllPlatforms(undefined, { scope: 'all' });
  }

  /**
   * 获取单个平台配置
   */
  static async getPlatformConfig(platformName, enterpriseId = undefined) {
    await ensureTenantColumns();

    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);
    const cacheKey = buildCacheKey('platform', platformName, scopedEnterpriseId);

    if (Date.now() < cacheExpireAt && configCache.has(cacheKey)) {
      return configCache.get(cacheKey);
    }

    const platform = await this.getPlatformInstance(platformName, scopedEnterpriseId);
    if (!platform) {
      return null;
    }

    const shops = await this.getEnterpriseShops(scopedEnterpriseId, platformName);
    const payload = toPlatformPayload(platform, shops);
    configCache.set(cacheKey, payload);
    cacheExpireAt = Date.now() + CACHE_TTL;
    return payload;
  }

  /**
   * 获取店铺配置
   */
  static async getShopConfig(shopId, enterpriseId = undefined) {
    await ensureTenantColumns();

    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);
    const cacheKey = buildCacheKey('shop', shopId, scopedEnterpriseId);

    if (shopCache.has(cacheKey)) {
      return shopCache.get(cacheKey);
    }

    const shop = await PlatformShop.findOne({
      where: {
        id: shopId,
        enterpriseId: scopedEnterpriseId ?? 0
      },
      include: [{ model: PlatformConfig, as: 'platform' }]
    });

    if (shop) {
      const payload = toShopPayload(shop);
      shopCache.set(cacheKey, payload);
      return payload;
    }

    return null;
  }

  /**
   * 获取适配器配置（合并平台配置和店铺配置）
   */
  static async getAdapterConfig(platformName, shopId, enterpriseId = undefined) {
    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);
    const platform = await this.getPlatformConfig(platformName, scopedEnterpriseId);
    if (!platform) {
      throw new Error(`平台配置不存在: ${platformName}`);
    }

    let shop = null;
    if (shopId) {
      shop = await this.getShopConfig(shopId, scopedEnterpriseId);
    }

    // 合并配置
    return {
      platform: platform.platformName,
      baseUrl: platform.baseUrl,
      appKey: platform.appKey,
      appSecret: platform.appSecret,
      // 店铺级别配置覆盖
      openKeyId: shop?.openKeyId || platform.appKey,
      secretKey: shop?.secretKey || platform.appSecret,
      sellerId: shop?.sellerId,
      accessToken: shop?.accessToken,
      refreshToken: shop?.refreshToken,
      shopId: shop?.id,
      shopName: shop?.shopName,
      // 额外配置
      ...platform.extraConfig,
      ...shop?.extraConfig
    };
  }
  
  /**
   * 更新店铺Token
   */
  static async updateShopToken(shopId, tokenData, enterpriseId = undefined) {
    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);
    await PlatformShop.update({
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      tokenExpireAt: tokenData.expireAt
    }, {
      where: {
        id: shopId,
        enterpriseId: scopedEnterpriseId ?? 0
      }
    });
    
    // 清除缓存
    shopCache.delete(buildCacheKey('shop', shopId, scopedEnterpriseId));
  }
  
  /**
   * 清除缓存
   */
  static clearCache() {
    configCache.clear();
    shopCache.clear();
    cacheExpireAt = 0;
  }
  
  /**
   * 初始化默认平台配置
   */
  static async initDefaultPlatforms() {
    await ensureTenantColumns();

    const defaults = [
      { platformName: 'shein_full', platformDisplayName: 'SHEIN(全托管)', baseUrl: 'https://openapi.sheincorp.cn', sortOrder: 1 },
      { platformName: 'temu', platformDisplayName: 'TEMU', baseUrl: 'https://openapi.temupay.com', sortOrder: 2 },
      { platformName: 'tiktok', platformDisplayName: 'TikTok Shop', baseUrl: 'https://open-api.tiktokglobalshop.com', sortOrder: 3 }
    ];
    
    for (const config of defaults) {
      await PlatformConfig.findOrCreate({
        where: { enterpriseId: 0, platformName: config.platformName },
        defaults: { ...config, enterpriseId: 0 }
      });
    }
    
    console.log('[PlatformConfig] 默认平台配置初始化完成');
  }
}

module.exports = PlatformConfigService;
