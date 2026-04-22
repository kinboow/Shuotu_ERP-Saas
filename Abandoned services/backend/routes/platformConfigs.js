const express = require('express');
const router = express.Router();
const PlatformConfig = require('../models/PlatformConfig');

/**
 * 获取所有平台配置
 * GET /api/platform-configs
 */
router.get('/', async (req, res) => {
  try {
    const { is_active } = req.query;
    const where = {};
    
    if (is_active !== undefined) {
      where.is_active = is_active === 'true';
    }
    
    const configs = await PlatformConfig.findAll({
      where,
      order: [['platform_name', 'ASC']]
    });
    
    res.json({
      success: true,
      data: configs
    });
  } catch (error) {
    console.error('获取平台配置失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取单个平台配置
 * GET /api/platform-configs/:platform
 */
router.get('/:platform', async (req, res) => {
  try {
    const config = await PlatformConfig.findOne({
      where: { platform_name: req.params.platform }
    });
    
    if (!config) {
      return res.status(404).json({
        success: false,
        message: '平台配置不存在'
      });
    }
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('获取平台配置失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 创建或更新平台配置
 * POST /api/platform-configs
 */
router.post('/', async (req, res) => {
  try {
    const {
      platform_name,
      platform_display_name,
      app_id,
      app_secret,
      callback_url,
      api_environment = 'production',
      api_domain,
      is_active = true,
      config_data,
      remarks
    } = req.body;
    
    if (!platform_name || !platform_display_name || !app_id || !app_secret || !callback_url) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }
    
    const [config, created] = await PlatformConfig.upsert({
      platform_name,
      platform_display_name,
      app_id,
      app_secret,
      callback_url,
      api_environment,
      api_domain,
      is_active,
      config_data,
      remarks
    }, {
      returning: true
    });
    
    res.json({
      success: true,
      data: config,
      message: created ? '平台配置创建成功' : '平台配置更新成功'
    });
  } catch (error) {
    console.error('保存平台配置失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 更新平台配置
 * PUT /api/platform-configs/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const config = await PlatformConfig.findByPk(req.params.id);
    
    if (!config) {
      return res.status(404).json({
        success: false,
        message: '平台配置不存在'
      });
    }
    
    await config.update(req.body);
    
    res.json({
      success: true,
      data: config,
      message: '平台配置更新成功'
    });
  } catch (error) {
    console.error('更新平台配置失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 删除平台配置
 * DELETE /api/platform-configs/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const config = await PlatformConfig.findByPk(req.params.id);
    
    if (!config) {
      return res.status(404).json({
        success: false,
        message: '平台配置不存在'
      });
    }
    
    await config.destroy();
    
    res.json({
      success: true,
      message: '平台配置删除成功'
    });
  } catch (error) {
    console.error('删除平台配置失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
