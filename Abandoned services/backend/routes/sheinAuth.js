const express = require('express');
const router = express.Router();
const axios = require('axios');
const { Op } = require('sequelize');
const PlatformShop = require('../models/PlatformShop');
const PlatformConfig = require('../models/PlatformConfig');
const AESTools = require('../utils/aesTools');
const SheinSignature = require('../utils/sheinSignature');

// SHEIN API域名配置
const API_DOMAINS = {
  production: 'https://openapi.sheincorp.com',
  test: 'https://openapi-test01.sheincorp.cn'
};

/**
 * 获取所有平台配置列表
 * GET /api/shein-auth/platforms
 */
router.get('/platforms', async (req, res) => {
  try {
    const platforms = await PlatformConfig.findAll({
      attributes: ['id', 'platform_name', 'platform_display_name', 'is_active', 'api_environment'],
      order: [['platform_name', 'ASC']]
    });

    res.json({
      success: true,
      data: platforms
    });
  } catch (error) {
    console.error('获取平台列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取平台列表失败',
      error: error.message
    });
  }
});

/**
 * 生成授权链接（使用平台配置）
 * POST /api/shein-auth/generate-auth-url
 * Body: { shopName, platform } - shopName可选，platform必填
 */
router.post('/generate-auth-url', async (req, res) => {
  try {
    const { shopName, platform } = req.body;

    if (!platform) {
      return res.status(400).json({
        success: false,
        message: '请选择平台'
      });
    }

    // 处理平台名称兼容性（'shein' -> 'shein_full'）
    let platformName = platform;
    if (platform === 'shein') {
      platformName = 'shein_full';
    }

    // 从平台配置表获取指定平台配置
    const platformConfig = await PlatformConfig.findOne({
      where: { 
        platform_name: platformName,
        is_active: true
      }
    });

    if (!platformConfig) {
      return res.status(404).json({
        success: false,
        message: `${platform}平台配置不存在或未启用，请先在平台管理中配置`
      });
    }

    const { app_id, callback_url, api_environment, platform_display_name } = platformConfig;

    // 生成state标识
    const state = `AUTH-${Date.now()}`;

    // Base64编码回调URL
    const encodedRedirectUrl = Buffer.from(callback_url).toString('base64');

    // 生成授权链接（固定使用生产环境）
    const authHost = 'openapi-sem.sheincorp.com';
    const authUrl = `https://${authHost}/#/empower?appid=${app_id}&redirectUrl=${encodedRedirectUrl}&state=${state}`;

    console.log('========================================');
    console.log(`生成${platform_display_name}授权链接`);
    console.log('========================================');
    console.log('平台:', platformName);
    console.log('AppID:', app_id);
    console.log('回调地址:', callback_url);
    console.log('State:', state);
    console.log('授权链接:', authUrl);
    console.log('========================================');

    res.json({
      success: true,
      data: {
        authUrl,
        appid: app_id,
        state,
        platform: platformName,
        platform_display_name,
        environment: 'production',
        callback_url,
        shopName: shopName || '新店铺'
      },
      message: '授权链接生成成功'
    });
  } catch (error) {
    console.error('生成授权链接失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 通过tempToken获取店铺密钥（使用平台配置）
 * POST /api/shein-auth/get-by-token
 * Body: { tempToken, shopName, platform }
 */
router.post('/get-by-token', async (req, res) => {
  try {
    const { tempToken, shopName, platform } = req.body;

    if (!tempToken) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数: tempToken'
      });
    }

    if (!platform) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数: platform'
      });
    }

    // 处理平台名称兼容性（'shein' -> 'shein_full'）
    let platformName = platform;
    if (platform === 'shein') {
      platformName = 'shein_full';
    }

    // 从平台配置表获取指定平台配置
    const platformConfig = await PlatformConfig.findOne({
      where: { 
        platform_name: platformName,
        is_active: true
      }
    });

    if (!platformConfig) {
      return res.status(404).json({
        success: false,
        message: `${platform}平台配置不存在或未启用，请先在平台管理中配置`
      });
    }

    const { id: platform_id, app_id: appid, app_secret: appSecret, api_environment, platform_display_name } = platformConfig;

    const apiPath = '/open-api/auth/get-by-token';
    const apiDomain = API_DOMAINS[api_environment || 'production'];

    // 生成签名头
    const headers = SheinSignature.generateAuthHeaders(appid, appSecret, apiPath);

    console.log('========================================');
    console.log('请求SHEIN授权API');
    console.log('========================================');
    console.log('URL:', apiDomain + apiPath);
    console.log('Headers:', JSON.stringify(headers, null, 2));
    console.log('Body:', JSON.stringify({ tempToken }, null, 2));
    console.log('========================================');

    // 调用SHEIN API
    const response = await axios.post(
      apiDomain + apiPath,
      { tempToken },
      { headers }
    );

    console.log('========================================');
    console.log('SHEIN API响应成功');
    console.log('========================================');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    console.log('========================================');

    if (response.data.code !== '0') {
      return res.status(400).json({
        success: false,
        message: response.data.msg || '获取授权失败',
        code: response.data.code,
        traceId: response.data.traceId
      });
    }

    const { openKeyId, secretKey: encryptedSecretKey, state } = response.data.info;

    // 解密secretKey
    const decryptedSecretKey = AESTools.decrypt(encryptedSecretKey, appSecret);

    console.log('解密成功:', {
      openKeyId,
      decryptedSecretKey: decryptedSecretKey.substring(0, 10) + '...'
    });

    // 保存到PlatformShops表
    const [shopRecord, created] = await PlatformShop.findOrCreate({
      where: { 
        platform_name: platformName,
        open_key_id: openKeyId 
      },
      defaults: {
        platform_id: platform_id,
        platform_name: platformName,
        shop_name: shopName || `${platform_display_name}店铺-${openKeyId.substring(0, 8)}`,
        shop_code: openKeyId,
        open_key_id: openKeyId,
        secret_key: decryptedSecretKey,
        encrypted_secret_key: encryptedSecretKey,
        auth_data: {
          appid,
          appSecret,
          tempToken,
          state
        },
        is_active: true,
        auth_time: new Date()
      }
    });

    // 如果记录已存在，更新它
    if (!created) {
      await shopRecord.update({
        shop_name: shopName || shopRecord.shop_name,
        secret_key: decryptedSecretKey,
        encrypted_secret_key: encryptedSecretKey,
        auth_data: {
          ...shopRecord.auth_data,
          appid,
          appSecret,
          tempToken,
          state
        },
        is_active: true,
        auth_time: new Date()
      });
    }

    res.json({
      success: true,
      message: created ? '授权成功' : '授权已更新',
      data: {
        id: shopRecord.id,
        shopName: shopRecord.shop_name,
        platformName: platform,
        platformDisplayName: platform_display_name,
        openKeyId,
        authTime: shopRecord.auth_time
      }
    });
  } catch (error) {
    console.error('========================================');
    console.error('获取授权失败 - 详细错误信息');
    console.error('========================================');
    console.error('错误消息:', error.message);
    console.error('HTTP状态码:', error.response?.status);
    console.error('状态文本:', error.response?.statusText);
    console.error('响应数据:', JSON.stringify(error.response?.data, null, 2));
    console.error('响应头:', JSON.stringify(error.response?.headers, null, 2));
    console.error('请求配置:', {
      url: error.config?.url,
      method: error.config?.method,
      headers: error.config?.headers,
      data: error.config?.data
    });
    console.error('========================================');
    
    res.status(500).json({
      success: false,
      message: error.message,
      httpStatus: error.response?.status,
      details: error.response?.data,
      suggestion: error.response?.status === 401 
        ? '认证失败，请检查：1) AppID和AppSecret是否正确 2) TempToken是否在10分钟内有效 3) 环境配置是否正确'
        : '请查看后端日志获取详细信息'
    });
  }
});

/**
 * 获取所有授权店铺（支持按平台筛选）
 * GET /api/shein-auth/shops?platform=shein
 */
router.get('/shops', async (req, res) => {
  try {
    const { isActive, platform } = req.query;
    
    const where = {};
    
    // 如果指定了平台，则筛选该平台
    if (platform) {
      where.platform_name = platform;
    } else {
      // 默认显示所有SHEIN平台（shein_full 和 shein_semi）
      where.platform_name = {
        [Op.in]: ['shein_full', 'shein_semi', 'shein']
      };
    }
    
    if (isActive !== undefined) {
      where.is_active = isActive === 'true';
    }

    const shops = await PlatformShop.findAll({
      where,
      attributes: [
        'id',
        'platform_id',
        'platform_name',
        'shop_name',
        'shop_code',
        'open_key_id',
        'seller_id',
        'marketplace_id',
        'is_active',
        'auth_time',
        'last_sync_time',
        'sync_status',
        'auth_data'
      ],
      include: [{
        model: PlatformConfig,
        as: 'platform',
        attributes: ['id', 'platform_display_name', 'api_environment']
      }],
      order: [['auth_time', 'DESC']]
    });

    res.json({
      success: true,
      data: shops,
      total: shops.length
    });
  } catch (error) {
    console.error('获取店铺列表失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取单个店铺授权信息
 * GET /api/shein-auth/shops/:id
 */
router.get('/shops/:id', async (req, res) => {
  try {
    const shop = await PlatformShop.findByPk(req.params.id, {
      attributes: { exclude: ['secret_key', 'encrypted_secret_key', 'access_token', 'refresh_token'] },
      include: [{
        model: PlatformConfig,
        as: 'platform',
        attributes: ['id', 'platform_name', 'platform_display_name', 'api_environment', 'api_domain']
      }]
    });

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: '店铺不存在'
      });
    }

    res.json({
      success: true,
      data: shop
    });
  } catch (error) {
    console.error('获取店铺信息失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 更新店铺信息
 * PUT /api/shein-auth/shops/:id
 */
router.put('/shops/:id', async (req, res) => {
  try {
    const { shopName, isActive } = req.body;
    
    const shop = await PlatformShop.findByPk(req.params.id);
    
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: '店铺不存在'
      });
    }

    const updateData = {};
    if (shopName !== undefined) updateData.shop_name = shopName;
    if (isActive !== undefined) updateData.is_active = isActive;

    await shop.update(updateData);

    res.json({
      success: true,
      message: '更新成功',
      data: shop
    });
  } catch (error) {
    console.error('更新店铺信息失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 删除店铺授权
 * DELETE /api/shein-auth/shops/:id
 */
router.delete('/shops/:id', async (req, res) => {
  try {
    const shop = await PlatformShop.findByPk(req.params.id);
    
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: '店铺不存在'
      });
    }

    await shop.destroy();

    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    console.error('删除店铺授权失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 测试API连接
 * POST /api/shein-auth/test-connection/:id
 */
router.post('/test-connection/:id', async (req, res) => {
  try {
    const shop = await SheinAuth.findByPk(req.params.id);
    
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: '店铺不存在'
      });
    }

    // 这里可以调用一个简单的SHEIN API来测试连接
    // 例如获取店铺信息或订单列表
    const testApiPath = '/open-api/order/list';
    const headers = SheinSignature.generateApiHeaders(
      shop.open_key_id,
      shop.secret_key,
      testApiPath
    );

    const response = await axios.post(
      shop.api_domain + testApiPath,
      {
        page: 1,
        pageSize: 1
      },
      { headers }
    );

    res.json({
      success: true,
      message: 'API连接正常',
      data: {
        shopName: shop.shop_name,
        apiEnvironment: shop.api_environment,
        responseCode: response.data.code
      }
    });
  } catch (error) {
    console.error('测试连接失败:', error);
    res.status(500).json({
      success: false,
      message: '连接失败: ' + error.message,
      details: error.response?.data
    });
  }
});

module.exports = router;
