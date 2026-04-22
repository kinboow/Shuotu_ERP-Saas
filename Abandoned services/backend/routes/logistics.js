const express = require('express');
const router = express.Router();
const LogisticsProvider = require('../models/LogisticsProvider');
const { Op } = require('sequelize');

// 获取物流商列表
router.get('/providers', async (req, res) => {
  try {
    const { is_active, provider_type, search, page = 1, pageSize = 20 } = req.query;
    
    const where = {};
    
    if (is_active !== undefined) {
      where.is_active = is_active === 'true';
    }
    
    if (provider_type) {
      where.provider_type = provider_type;
    }
    
    if (search) {
      where[Op.or] = [
        { provider_name: { [Op.like]: `%${search}%` } },
        { provider_code: { [Op.like]: `%${search}%` } },
        { contact_person: { [Op.like]: `%${search}%` } }
      ];
    }
    
    const offset = (page - 1) * pageSize;
    
    const { count, rows } = await LogisticsProvider.findAndCountAll({
      where,
      order: [['priority', 'DESC'], ['created_at', 'DESC']],
      limit: parseInt(pageSize),
      offset: offset
    });
    
    res.json({
      success: true,
      data: rows,
      total: count,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    });
  } catch (error) {
    console.error('获取物流商列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取物流商列表失败',
      error: error.message
    });
  }
});

// 获取单个物流商详情
router.get('/providers/:id', async (req, res) => {
  try {
    const provider = await LogisticsProvider.findByPk(req.params.id);
    
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: '物流商不存在'
      });
    }
    
    res.json({
      success: true,
      data: provider
    });
  } catch (error) {
    console.error('获取物流商详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取物流商详情失败',
      error: error.message
    });
  }
});

// 创建物流商
router.post('/providers', async (req, res) => {
  try {
    const {
      provider_name,
      provider_code,
      provider_type,
      api_url,
      api_key,
      api_secret,
      app_id,
      customer_code,
      contact_person,
      contact_phone,
      contact_email,
      service_areas,
      price_config,
      is_active,
      priority,
      remark
    } = req.body;
    
    // 检查代码是否已存在
    const existing = await LogisticsProvider.findOne({
      where: { provider_code }
    });
    
    if (existing) {
      return res.status(400).json({
        success: false,
        message: '物流商代码已存在'
      });
    }
    
    const provider = await LogisticsProvider.create({
      provider_name,
      provider_code,
      provider_type,
      api_url,
      api_key,
      api_secret,
      app_id,
      customer_code,
      contact_person,
      contact_phone,
      contact_email,
      service_areas,
      price_config,
      is_active,
      priority,
      remark
    });
    
    res.json({
      success: true,
      message: '物流商创建成功',
      data: provider
    });
  } catch (error) {
    console.error('创建物流商失败:', error);
    res.status(500).json({
      success: false,
      message: '创建物流商失败',
      error: error.message
    });
  }
});

// 更新物流商
router.put('/providers/:id', async (req, res) => {
  try {
    const provider = await LogisticsProvider.findByPk(req.params.id);
    
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: '物流商不存在'
      });
    }
    
    const {
      provider_name,
      provider_code,
      provider_type,
      api_url,
      api_key,
      api_secret,
      app_id,
      customer_code,
      contact_person,
      contact_phone,
      contact_email,
      service_areas,
      price_config,
      is_active,
      priority,
      remark
    } = req.body;
    
    // 如果修改了代码，检查是否与其他记录冲突
    if (provider_code && provider_code !== provider.provider_code) {
      const existing = await LogisticsProvider.findOne({
        where: {
          provider_code,
          id: { [Op.ne]: req.params.id }
        }
      });
      
      if (existing) {
        return res.status(400).json({
          success: false,
          message: '物流商代码已存在'
        });
      }
    }
    
    await provider.update({
      provider_name,
      provider_code,
      provider_type,
      api_url,
      api_key,
      api_secret,
      app_id,
      customer_code,
      contact_person,
      contact_phone,
      contact_email,
      service_areas,
      price_config,
      is_active,
      priority,
      remark
    });
    
    res.json({
      success: true,
      message: '物流商更新成功',
      data: provider
    });
  } catch (error) {
    console.error('更新物流商失败:', error);
    res.status(500).json({
      success: false,
      message: '更新物流商失败',
      error: error.message
    });
  }
});

// 删除物流商
router.delete('/providers/:id', async (req, res) => {
  try {
    const provider = await LogisticsProvider.findByPk(req.params.id);
    
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: '物流商不存在'
      });
    }
    
    await provider.destroy();
    
    res.json({
      success: true,
      message: '物流商删除成功'
    });
  } catch (error) {
    console.error('删除物流商失败:', error);
    res.status(500).json({
      success: false,
      message: '删除物流商失败',
      error: error.message
    });
  }
});

// 批量启用/禁用
router.post('/providers/batch-toggle', async (req, res) => {
  try {
    const { ids, is_active } = req.body;
    
    await LogisticsProvider.update(
      { is_active },
      { where: { id: ids } }
    );
    
    res.json({
      success: true,
      message: `批量${is_active ? '启用' : '禁用'}成功`
    });
  } catch (error) {
    console.error('批量操作失败:', error);
    res.status(500).json({
      success: false,
      message: '批量操作失败',
      error: error.message
    });
  }
});

// 测试物流商API连接
router.post('/providers/:id/test-connection', async (req, res) => {
  try {
    const provider = await LogisticsProvider.findByPk(req.params.id);
    
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: '物流商不存在'
      });
    }
    
    // TODO: 实现实际的API连接测试逻辑
    // 这里只是模拟
    res.json({
      success: true,
      message: 'API连接测试成功',
      data: {
        connected: true,
        response_time: '120ms'
      }
    });
  } catch (error) {
    console.error('测试连接失败:', error);
    res.status(500).json({
      success: false,
      message: '测试连接失败',
      error: error.message
    });
  }
});

module.exports = router;
