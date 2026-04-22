const express = require('express');
const router = express.Router();
const PlatformConnection = require('../models/PlatformConnection');
const PlatformShop = require('../models/PlatformShop');
const PlatformConfig = require('../models/PlatformConfig');

// 获取所有平台连接（包括新旧两种模型）
router.get('/', async (req, res) => {
  try {
    // 获取旧的平台连接
    const oldConnections = await PlatformConnection.findAll();
    
    // 获取新的平台店铺（包含配置信息）
    const platformShops = await PlatformShop.findAll({
      include: [{
        model: PlatformConfig,
        as: 'platform',
        required: false
      }]
    });
    
    // 转换新模型数据格式以兼容前端
    const formattedShops = platformShops.map(shop => ({
      id: shop.id,
      platform_name: shop.platform_name === 'shein_full' ? 'SHEIN' : 
                     shop.platform_name === 'shein_semi' ? 'SHEIN' : 
                     shop.platform_name.toUpperCase(),
      shop_name: shop.shop_name,
      shop_code: shop.shop_code,
      status: shop.is_active ? 'active' : 'inactive',
      app_key: shop.open_key_id,
      app_secret: shop.secret_key,
      api_url: shop.platform?.api_domain || 
               (shop.platform?.api_environment === 'test' ? 
                'https://openapi-test01.sheincorp.cn' : 
                'https://openapi.sheincorp.cn'),
      is_active: shop.is_active,
      auth_time: shop.auth_time,
      last_sync_time: shop.last_sync_time
    }));
    
    // 合并两种数据源
    const allPlatforms = [...oldConnections, ...formattedShops];
    
    res.json({ success: true, data: allPlatforms });
  } catch (error) {
    console.error('获取平台列表失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 添加平台连接
router.post('/', async (req, res) => {
  try {
    const connection = await PlatformConnection.create(req.body);
    res.json({ success: true, data: connection });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 同步平台订单
 * POST /api/platforms/:id/sync-orders
 * 功能已删除，待重新实现
 */
router.post('/:id/sync-orders', async (req, res) => {
  res.json({
    success: false,
    message: '功能开发中：同步平台订单'
  });
});

module.exports = router;
