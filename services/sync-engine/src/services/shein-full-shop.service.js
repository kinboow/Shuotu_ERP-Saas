/**
 * SHEIN(full)店铺管理服务
 * 管理全托管模式的店铺配置和授权
 */
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const SheinFullAuthService = require('./shein-full-auth.service');
const {
  ensureTenantColumns,
  normalizeEnterpriseId,
  getCurrentEnterpriseId
} = require('./tenant-context.service');

class SheinFullShopService {
  static resolveEnterpriseId(enterpriseId) {
    return normalizeEnterpriseId(enterpriseId ?? getCurrentEnterpriseId());
  }

  static async getScopedPlatformConfig(enterpriseId = undefined) {
    await ensureTenantColumns();

    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);
    const enterpriseIds = scopedEnterpriseId === null ? [0] : [scopedEnterpriseId, 0];
    const preferredEnterpriseId = scopedEnterpriseId === null ? 0 : scopedEnterpriseId;

    const results = await sequelize.query(
      `SELECT enterprise_id, app_key, app_secret, callback_url
       FROM platform_configs
       WHERE platform_name = 'shein_full'
         AND enterprise_id IN (:enterpriseIds)
         AND status = 1
       ORDER BY CASE WHEN enterprise_id = :preferredEnterpriseId THEN 0 ELSE 1 END, id ASC
       LIMIT 1`,
      {
        replacements: { enterpriseIds, preferredEnterpriseId },
        type: QueryTypes.SELECT
      }
    );

    return results[0] || null;
  }
  
  /**
   * 获取所有店铺列表
   */
  static async getAllShops(includeDisabled = false, enterpriseId = undefined) {
    await ensureTenantColumns();

    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);
    const conditions = ['enterprise_id = :enterpriseId'];
    if (!includeDisabled) {
      conditions.push('status = 1');
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const shops = await sequelize.query(`
      SELECT * FROM shein_full_shops ${whereClause} ORDER BY created_at DESC
    `, {
      replacements: { enterpriseId: scopedEnterpriseId ?? 0 },
      type: QueryTypes.SELECT
    });
    const productSyncCheckpointMap = await this.getProductSyncCheckpointMap(shops.map(shop => shop.id));
    
    // 隐藏敏感信息
    return shops.map(shop => ({
      ...shop,
      last_product_sync_success_at: productSyncCheckpointMap.get(shop.id)?.completedAt || null,
      last_product_sync_checkpoint_time: productSyncCheckpointMap.get(shop.id)?.checkpointTime || null,
      last_product_sync_mode: productSyncCheckpointMap.get(shop.id)?.actualSyncMode || productSyncCheckpointMap.get(shop.id)?.requestedSyncMode || null,
      last_product_sync_task_id: productSyncCheckpointMap.get(shop.id)?.taskId || null,
      app_secret: shop.app_secret ? '******' : null,
      secret_key: shop.secret_key ? '******' : null,
      secret_key_encrypted: undefined
    }));
  }

  static async getProductSyncCheckpointMap(shopIds = []) {
    const normalizedShopIds = Array.from(new Set(
      shopIds
        .map(id => Number.parseInt(id, 10))
        .filter(id => !Number.isNaN(id))
    ));

    if (normalizedShopIds.length === 0) {
      return new Map();
    }

    const placeholders = normalizedShopIds.map(() => '?').join(', ');
    const tasks = await sequelize.query(`
      SELECT shop_id, task_id, completed_at, result
      FROM sync_tasks
      WHERE platform = 'shein_full'
        AND status = 'completed'
        AND completed_at IS NOT NULL
        AND shop_id IN (${placeholders})
      ORDER BY shop_id ASC, completed_at DESC
    `, {
      replacements: normalizedShopIds,
      type: QueryTypes.SELECT
    });

    const checkpointMap = new Map();

    for (const task of tasks) {
      const shopId = Number.parseInt(task.shop_id, 10);
      if (checkpointMap.has(shopId)) {
        continue;
      }

      const parsedResult = this.safeJsonParse(task.result);
      const productResult = parsedResult?.products;

      if (!productResult || productResult.success === false) {
        continue;
      }

      if (Number(productResult.failCount || 0) > 0) {
        continue;
      }

      const checkpointTime = this.parseDateTime(productResult.syncRangeEnd)
        || this.parseDateTime(productResult.syncRangeEndAt)
        || (task.completed_at ? new Date(task.completed_at) : null);

      if (!checkpointTime) {
        continue;
      }

      checkpointMap.set(shopId, {
        taskId: task.task_id,
        checkpointTime,
        completedAt: task.completed_at ? new Date(task.completed_at) : null,
        requestedSyncMode: productResult.requestedSyncMode || null,
        actualSyncMode: productResult.actualSyncMode || null
      });
    }

    return checkpointMap;
  }

  static safeJsonParse(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }

  static parseDateTime(value) {
    if (!value) return null;
    if (value === '1970-01-01 08:00:01' || value === '1970-01-01 08:00:00') {
      return null;
    }
    try {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    } catch (error) {
      return null;
    }
  }

  /**
   * 获取单个店铺详情
   */
  static async getShopById(id, enterpriseId = undefined) {
    await ensureTenantColumns();

    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);
    const [shop] = await sequelize.query(`
      SELECT * FROM shein_full_shops WHERE id = ? AND enterprise_id = ?
    `, {
      replacements: [id, scopedEnterpriseId ?? 0],
      type: QueryTypes.SELECT
    });
    
    return shop || null;
  }

  /**
   * 获取平台配置的App凭证（只从数据库读取）
   */
  static async getPlatformCredentials(enterpriseId = undefined) {
    const config = await this.getScopedPlatformConfig(enterpriseId);
    if (!config) {
      throw new Error('未找到SHEIN平台配置，请检查platform_configs表');
    }
    
    if (!config.app_key || !config.app_secret) {
      throw new Error('SHEIN平台凭证未配置，请在platform_configs表中设置app_key和app_secret');
    }
    
    return { appId: config.app_key, appSecret: config.app_secret };
  }

  /**
   * 创建店铺 (未授权状态)
   * 只需要店铺名称，App凭证从平台配置获取，始终使用生产环境
   */
  static async createShop(data, enterpriseId = undefined) {
    const { shopName, remark } = data;
    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);
    
    if (!shopName) throw new Error('店铺名称不能为空');

    // 从平台配置获取App凭证
    const { appId, appSecret } = await this.getPlatformCredentials(scopedEnterpriseId);

    // 始终使用生产环境
    const isTest = false;
    const env = SheinFullAuthService.getEnvConfig(isTest);
    
    const [result] = await sequelize.query(`
      INSERT INTO shein_full_shops 
      (enterprise_id, shop_name, app_id, app_secret, is_test, base_url, auth_url, auth_status, status, remark, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?, NOW())
    `, {
      replacements: [
        scopedEnterpriseId ?? 0,
        shopName,
        appId,
        appSecret,
        0, // 始终使用生产环境
        env.apiHost,
        `https://${env.authHost}`,
        remark || null
      ]
    });

    return { id: result, shopName, appId };
  }

  /**
   * 生成店铺授权URL
   * @param {number} shopId - 店铺ID
   * @param {string} customRedirectUrl - 自定义回调地址（可选，不传则从数据库获取）
   */
  static async generateAuthUrl(shopId, customRedirectUrl = null, enterpriseId = undefined) {
    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);
    const shop = await this.getShopById(shopId, scopedEnterpriseId);
    if (!shop) throw new Error('店铺不存在');

    // 获取回调地址
    let redirectUrl = customRedirectUrl;
    if (!redirectUrl) {
      // 从数据库获取平台配置的回调地址
      const platformConfig = await this.getScopedPlatformConfig(scopedEnterpriseId);
      
      if (platformConfig?.callback_url) {
        // 构建完整的回调URL
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        redirectUrl = `${baseUrl}${platformConfig.callback_url}`;
      } else {
        throw new Error('未配置授权回调地址，请在platform_configs表中设置callback_url');
      }
    }

    const state = `shop_${shopId}_${Date.now()}`;
    const authUrl = SheinFullAuthService.generateAuthUrl(
      shop.app_id,
      redirectUrl,
      state,
      shop.is_test === 1
    );

    // 记录授权日志
    await this.logAuthAction(shopId, 'generate_url', {
      redirectUrl,
      state,
      authUrl
    });

    return { authUrl, shopId, appId: shop.app_id, redirectUrl, state };
  }

  /**
   * 处理授权回调
   */
  static async handleAuthCallback(shopId, tempToken, enterpriseId = undefined) {
    const shop = await this.getShopById(shopId, enterpriseId);
    if (!shop) throw new Error('店铺不存在');

    try {
      // 获取店铺密钥
      const authData = await SheinFullAuthService.getTokenByTemp(
        tempToken,
        shop.app_id,
        shop.app_secret,
        shop.is_test === 1
      );

      // 更新店铺授权信息
      await sequelize.query(`
        UPDATE shein_full_shops SET
          open_key_id = ?,
          secret_key = ?,
          secret_key_encrypted = ?,
          auth_status = 1,
          auth_time = NOW(),
          updated_at = NOW()
        WHERE id = ?
      `, {
        replacements: [
          authData.openKeyId,
          authData.secretKey,
          authData.secretKeyEncrypted,
          shopId
        ]
      });

      // 记录成功日志
      await this.logAuthAction(shopId, 'callback', {
        tempToken: tempToken.substring(0, 10) + '...',
        openKeyId: authData.openKeyId,
        status: 'SUCCESS'
      });

      return {
        success: true,
        shopId,
        openKeyId: authData.openKeyId,
        message: '授权成功'
      };
    } catch (error) {
      // 记录失败日志
      await this.logAuthAction(shopId, 'callback', {
        tempToken: tempToken.substring(0, 10) + '...',
        error: error.message,
        status: 'FAILED'
      });

      throw error;
    }
  }

  /**
   * 测试店铺连接
   */
  static async testConnection(shopId, enterpriseId = undefined) {
    const shop = await this.getShopById(shopId, enterpriseId);
    if (!shop) throw new Error('店铺不存在');
    if (shop.auth_status !== 1) throw new Error('店铺未授权');
    if (!shop.open_key_id || !shop.secret_key) throw new Error('店铺密钥缺失');

    const result = await SheinFullAuthService.verifyAuth(
      shop.open_key_id,
      shop.secret_key,
      shop.is_test === 1
    );

    if (!result.valid) {
      // 标记授权过期
      await sequelize.query(`
        UPDATE shein_full_shops SET auth_status = 2, updated_at = NOW() WHERE id = ?
      `, { replacements: [shopId] });
    }

    return result;
  }

  /**
   * 更新店铺信息
   */
  static async updateShop(shopId, data, enterpriseId = undefined) {
    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);
    const shop = await this.getShopById(shopId, scopedEnterpriseId);
    if (!shop) throw new Error('店铺不存在');

    const updates = [];
    const values = [];

    if (data.shopName !== undefined) {
      updates.push('shop_name = ?');
      values.push(data.shopName);
    }
    if (data.appSecret !== undefined) {
      updates.push('app_secret = ?');
      values.push(data.appSecret);
      // 更新appSecret后需要重新授权
      updates.push('auth_status = 0');
      updates.push('open_key_id = NULL');
      updates.push('secret_key = NULL');
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
    }
    if (data.remark !== undefined) {
      updates.push('remark = ?');
      values.push(data.remark);
    }

    if (updates.length === 0) {
      return shop;
    }

    updates.push('updated_at = NOW()');
    values.push(shopId);
    values.push(scopedEnterpriseId ?? 0);

    await sequelize.query(`
      UPDATE shein_full_shops SET ${updates.join(', ')} WHERE id = ? AND enterprise_id = ?
    `, { replacements: values });

    return this.getShopById(shopId, scopedEnterpriseId);
  }

  /**
   * 删除店铺
   */
  static async deleteShop(shopId, enterpriseId = undefined) {
    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);
    const shop = await this.getShopById(shopId, scopedEnterpriseId);
    if (!shop) throw new Error('店铺不存在');

    await sequelize.query(`DELETE FROM shein_full_shops WHERE id = ? AND enterprise_id = ?`, {
      replacements: [shopId, scopedEnterpriseId ?? 0]
    });

    return { success: true, message: '删除成功' };
  }

  /**
   * 记录授权日志
   */
  static async logAuthAction(shopId, action, data) {
    try {
      await sequelize.query(`
        INSERT INTO shein_full_auth_logs 
        (shop_id, app_id, action, request_data, status, created_at)
        VALUES (?, (SELECT app_id FROM shein_full_shops WHERE id = ?), ?, ?, ?, NOW())
      `, {
        replacements: [
          shopId,
          shopId,
          action,
          JSON.stringify(data),
          data.status || 'SUCCESS'
        ]
      });
    } catch (error) {
      console.error('[SheinFullShop] 记录日志失败:', error.message);
    }
  }

  /**
   * 获取授权日志
   */
  static async getAuthLogs(shopId, limit = 50, enterpriseId = undefined) {
    const shop = await this.getShopById(shopId, enterpriseId);
    if (!shop) throw new Error('店铺不存在');

    return await sequelize.query(`
      SELECT * FROM shein_full_auth_logs 
      WHERE shop_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `, { replacements: [shopId, limit], type: QueryTypes.SELECT });
  }

  /**
   * 获取已授权的店铺配置 (用于适配器)
   */
  static async getShopConfig(shopId, enterpriseId = undefined) {
    const shop = await this.getShopById(shopId, enterpriseId);
    if (!shop) throw new Error('店铺不存在');
    if (shop.status !== 1) throw new Error('店铺已禁用');
    if (shop.auth_status !== 1) throw new Error('店铺未授权，请先完成授权');

    return {
      shopId: shop.id,
      shopName: shop.shop_name,
      appId: shop.app_id,
      appSecret: shop.app_secret,
      openKeyId: shop.open_key_id,
      secretKey: shop.secret_key,
      isTest: shop.is_test === 1,
      baseUrl: shop.base_url,
      appType: shop.is_test === 1 ? 'test' : 'full-managed'
    };
  }
}

module.exports = SheinFullShopService;
