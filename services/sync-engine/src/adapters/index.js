/**
 * 适配器管理器
 * 负责适配器的注册、获取和配置管理
 */

const SheinFullAdapter = require('./shein-full.adapter');
const TemuAdapter = require('./temu.adapter');
const TikTokAdapter = require('./tiktok.adapter');

// 适配器类映射
const AdapterClasses = {
  shein_full: SheinFullAdapter,
  temu: TemuAdapter,
  tiktok: TikTokAdapter
};

/**
 * 根据平台名称获取适配器实例
 */
function getAdapter(platformName, config) {
  const AdapterClass = AdapterClasses[platformName];
  if (!AdapterClass) {
    throw new Error(`不支持的平台: ${platformName}`);
  }
  return new AdapterClass(config);
}

class AdapterManager {
  constructor() {
    this.adapters = new Map();  // shopId -> adapter实例
    this.configs = new Map();   // shopId -> 配置
  }

  /**
   * 注册适配器配置
   * @param {string} shopId - 店铺ID
   * @param {string} platform - 平台标识
   * @param {Object} config - 平台配置
   */
  register(shopId, platform, config) {
    const AdapterClass = AdapterClasses[platform];
    if (!AdapterClass) {
      throw new Error(`不支持的平台: ${platform}`);
    }

    const fullConfig = { ...config, shopId, platform };
    this.configs.set(shopId, fullConfig);

    // 创建适配器实例
    const adapter = new AdapterClass(fullConfig);
    this.adapters.set(shopId, adapter);

    console.log(`[AdapterManager] 注册适配器: ${platform} - ${shopId}`);
    return adapter;
  }

  /**
   * 获取适配器实例
   * @param {string} shopId - 店铺ID
   */
  get(shopId) {
    const adapter = this.adapters.get(shopId);
    if (!adapter) {
      throw new Error(`未找到店铺适配器: ${shopId}`);
    }
    return adapter;
  }

  /**
   * 根据平台获取所有适配器
   * @param {string} platform - 平台标识
   */
  getByPlatform(platform) {
    const result = [];
    for (const [shopId, adapter] of this.adapters) {
      if (adapter.platform === platform) {
        result.push({ shopId, adapter });
      }
    }
    return result;
  }

  /**
   * 获取所有适配器
   */
  getAll() {
    const result = [];
    for (const [shopId, adapter] of this.adapters) {
      result.push({
        shopId,
        platform: adapter.platform,
        adapter
      });
    }
    return result;
  }

  /**
   * 移除适配器
   * @param {string} shopId - 店铺ID
   */
  remove(shopId) {
    this.adapters.delete(shopId);
    this.configs.delete(shopId);
    console.log(`[AdapterManager] 移除适配器: ${shopId}`);
  }

  /**
   * 检查适配器是否存在
   * @param {string} shopId - 店铺ID
   */
  has(shopId) {
    return this.adapters.has(shopId);
  }

  /**
   * 获取支持的平台列表
   */
  getSupportedPlatforms() {
    return Object.keys(AdapterClasses);
  }

  /**
   * 获取适配器统计信息
   */
  getStats() {
    const stats = {
      total: this.adapters.size,
      byPlatform: {}
    };

    for (const [, adapter] of this.adapters) {
      const platform = adapter.platform;
      stats.byPlatform[platform] = (stats.byPlatform[platform] || 0) + 1;
    }

    return stats;
  }

  /**
   * 从数据库加载配置
   * @param {Array} configs - 配置列表
   */
  loadFromConfigs(configs) {
    for (const config of configs) {
      try {
        this.register(config.shopId, config.platform, config);
      } catch (error) {
        console.error(`[AdapterManager] 加载配置失败: ${config.shopId}`, error.message);
      }
    }
    console.log(`[AdapterManager] 已加载 ${this.adapters.size} 个适配器`);
  }
}

// 单例
const adapterManager = new AdapterManager();

/**
 * 从数据库初始化所有店铺适配器
 */
async function initAdaptersFromDatabase() {
  try {
    const PlatformConfigService = require('../services/platform-config.service');
    const platforms = await PlatformConfigService.getAllPlatforms();
    
    for (const platform of platforms) {
      const shops = platform.shops || [];
      for (const shop of shops) {
        try {
          const config = await PlatformConfigService.getAdapterConfig(platform.platformName, shop.id);
          adapterManager.register(String(shop.id), platform.platformName, config);
        } catch (err) {
          console.error(`[AdapterManager] 初始化店铺适配器失败: ${shop.shopName}`, err.message);
        }
      }
    }
    
    console.log(`[AdapterManager] 从数据库初始化完成，共 ${adapterManager.adapters.size} 个适配器`);
  } catch (error) {
    console.error('[AdapterManager] 从数据库初始化失败:', error.message);
  }
}

module.exports = adapterManager;
module.exports.AdapterManager = AdapterManager;
module.exports.AdapterClasses = AdapterClasses;
module.exports.getAdapter = getAdapter;
module.exports.initAdaptersFromDatabase = initAdaptersFromDatabase;
