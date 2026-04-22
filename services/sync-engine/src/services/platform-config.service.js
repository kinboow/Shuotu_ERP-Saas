/**
 * 平台配置服务
 * 提供平台配置的读取和缓存
 */

const { PlatformConfig, PlatformShop } = require('../models');

// 配置缓存
let configCache = new Map();
let shopCache = new Map();
let cacheExpireAt = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

class PlatformConfigService {
  
  /**
   * 获取所有平台配置
   */
  static async getAllPlatforms() {
    if (Date.now() < cacheExpireAt && configCache.size > 0) {
      return Array.from(configCache.values());
    }
    
    const platforms = await PlatformConfig.findAll({
      where: { status: 1 },
      order: [['sortOrder', 'ASC']],
      include: [{ model: PlatformShop, as: 'shops', where: { status: 1 }, required: false }]
    });
    
    configCache.clear();
    const result = platforms.map(p => {
      const json = p.toJSON();
      configCache.set(p.platformName, json);
      return json;
    });
    cacheExpireAt = Date.now() + CACHE_TTL;
    
    return result;
  }
  
  /**
   * 获取单个平台配置
   */
  static async getPlatformConfig(platformName) {
    if (Date.now() < cacheExpireAt && configCache.has(platformName)) {
      return configCache.get(platformName);
    }
    
    const platform = await PlatformConfig.findOne({
      where: { platformName, status: 1 },
      include: [{ model: PlatformShop, as: 'shops', where: { status: 1 }, required: false }]
    });
    
    if (platform) {
      const json = platform.toJSON();
      configCache.set(platformName, json);
      return json;
    }
    
    return null;
  }
  
  /**
   * 获取店铺配置
   */
  static async getShopConfig(shopId) {
    if (shopCache.has(shopId)) {
      return shopCache.get(shopId);
    }
    
    const shop = await PlatformShop.findByPk(shopId, {
      include: [{ model: PlatformConfig, as: 'platform' }]
    });
    
    if (shop) {
      const json = shop.toJSON();
      shopCache.set(shopId, json);
      return json;
    }
    
    return null;
  }
  
  /**
   * 获取适配器配置（合并平台配置和店铺配置）
   */
  static async getAdapterConfig(platformName, shopId) {
    const platform = await this.getPlatformConfig(platformName);
    if (!platform) {
      throw new Error(`平台配置不存在: ${platformName}`);
    }
    
    let shop = null;
    if (shopId) {
      shop = await this.getShopConfig(shopId);
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
  static async updateShopToken(shopId, tokenData) {
    await PlatformShop.update({
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      tokenExpireAt: tokenData.expireAt
    }, { where: { id: shopId } });
    
    // 清除缓存
    shopCache.delete(shopId);
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
    const defaults = [
      { platformName: 'shein_full', platformDisplayName: 'SHEIN(全托管)', baseUrl: 'https://openapi.sheincorp.cn', sortOrder: 1 },
      { platformName: 'temu', platformDisplayName: 'TEMU', baseUrl: 'https://openapi.temupay.com', sortOrder: 2 },
      { platformName: 'tiktok', platformDisplayName: 'TikTok Shop', baseUrl: 'https://open-api.tiktokglobalshop.com', sortOrder: 3 }
    ];
    
    for (const config of defaults) {
      await PlatformConfig.findOrCreate({
        where: { platformName: config.platformName },
        defaults: config
      });
    }
    
    console.log('[PlatformConfig] 默认平台配置初始化完成');
  }
}

module.exports = PlatformConfigService;
