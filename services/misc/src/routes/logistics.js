/**
 * 物流商路由
 */

const express = require('express');
const router = express.Router();
const { LogisticsProvider } = require('../models');
const { Op } = require('sequelize');

const generateId = () => {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `LOG${dateStr}${random}`;
};

// 查询列表 - 兼容 /api/logistics 和 /api/logistics/providers
router.get('/', async (req, res) => {
  try {
    const { status, type, keyword, page = 1, pageSize = 20 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (keyword) {
      where[Op.or] = [
        { name: { [Op.like]: `%${keyword}%` } },
        { code: { [Op.like]: `%${keyword}%` } }
      ];
    }

    const { count, rows } = await LogisticsProvider.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(pageSize),
      offset: (parseInt(page) - 1) * parseInt(pageSize)
    });

    res.json({ success: true, data: { list: rows, total: count, page: parseInt(page), pageSize: parseInt(pageSize) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取详情
router.get('/:id', async (req, res) => {
  try {
    const provider = await LogisticsProvider.findOne({ where: { providerId: req.params.id } });
    if (!provider) return res.status(404).json({ success: false, message: '物流商不存在' });
    res.json({ success: true, data: provider });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 创建
router.post('/', async (req, res) => {
  try {
    const provider = await LogisticsProvider.create({ ...req.body, providerId: generateId() });
    res.json({ success: true, data: provider });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 更新
router.put('/:id', async (req, res) => {
  try {
    const provider = await LogisticsProvider.findOne({ where: { providerId: req.params.id } });
    if (!provider) return res.status(404).json({ success: false, message: '物流商不存在' });
    await provider.update(req.body);
    res.json({ success: true, data: provider });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 删除
router.delete('/:id', async (req, res) => {
  try {
    const provider = await LogisticsProvider.findOne({ where: { providerId: req.params.id } });
    if (!provider) return res.status(404).json({ success: false, message: '物流商不存在' });
    await provider.update({ status: 'DELETED' });
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 兼容前端 /api/logistics/providers 路径
router.get('/providers', async (req, res) => {
  try {
    const { search, provider_type, is_active, page = 1, pageSize = 20 } = req.query;
    const where = {};
    if (provider_type && provider_type !== 'all') where.type = provider_type;
    if (is_active === 'true') where.status = 'ACTIVE';
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { code: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await LogisticsProvider.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(pageSize),
      offset: (parseInt(page) - 1) * parseInt(pageSize)
    });

    res.json({ success: true, data: rows, total: count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/providers', async (req, res) => {
  try {
    const provider = await LogisticsProvider.create({ ...req.body, providerId: generateId() });
    res.json({ success: true, data: provider });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.put('/providers/:id', async (req, res) => {
  try {
    const provider = await LogisticsProvider.findByPk(req.params.id);
    if (!provider) return res.status(404).json({ success: false, message: '物流商不存在' });
    await provider.update(req.body);
    res.json({ success: true, data: provider });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.delete('/providers/:id', async (req, res) => {
  try {
    const provider = await LogisticsProvider.findByPk(req.params.id);
    if (!provider) return res.status(404).json({ success: false, message: '物流商不存在' });
    await provider.destroy();
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PDA账号管理相关API
const bcrypt = require('bcryptjs');

// 设置登录账号
router.put('/providers/:id/login-account', async (req, res) => {
  try {
    const { login_username, login_password, login_enabled, pda_access } = req.body;
    
    const provider = await LogisticsProvider.findByPk(req.params.id);
    if (!provider) {
      return res.status(404).json({ success: false, message: '物流商不存在' });
    }

    // 检查用户名是否已被使用
    if (login_username && login_username !== provider.login_username) {
      const existing = await LogisticsProvider.findOne({
        where: { login_username }
      });
      if (existing) {
        return res.status(400).json({ success: false, message: '该登录账号已被使用' });
      }
    }

    const updateData = {
      login_username,
      login_enabled: login_enabled !== undefined ? login_enabled : provider.login_enabled,
      pda_access: pda_access !== undefined ? pda_access : provider.pda_access
    };

    // 如果提供了新密码，则加密后保存
    if (login_password) {
      const hashedPassword = await bcrypt.hash(login_password, 10);
      updateData.login_password = hashedPassword;
    }

    await provider.update(updateData);

    res.json({
      success: true,
      message: '账号设置成功',
      data: {
        id: provider.id,
        login_username: provider.login_username,
        login_enabled: provider.login_enabled,
        pda_access: provider.pda_access
      }
    });
  } catch (error) {
    console.error('[设置登录账号] 错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 修改密码
router.put('/providers/:id/change-password', async (req, res) => {
  try {
    const { new_password } = req.body;
    
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ success: false, message: '密码至少6个字符' });
    }

    const provider = await LogisticsProvider.findByPk(req.params.id);
    if (!provider) {
      return res.status(404).json({ success: false, message: '物流商不存在' });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);
    await provider.update({ login_password: hashedPassword });

    res.json({ success: true, message: '密码修改成功' });
  } catch (error) {
    console.error('[修改密码] 错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 开启/关闭PDA访问
router.put('/providers/:id/pda-access', async (req, res) => {
  try {
    const { login_enabled, pda_access } = req.body;
    
    const provider = await LogisticsProvider.findByPk(req.params.id);
    if (!provider) {
      return res.status(404).json({ success: false, message: '物流商不存在' });
    }

    await provider.update({
      login_enabled: login_enabled !== undefined ? login_enabled : provider.login_enabled,
      pda_access: pda_access !== undefined ? pda_access : provider.pda_access
    });

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('[更新PDA访问] 错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
