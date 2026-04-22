/**
 * 日志管理路由 - 操作日志、登录日志
 */
const express = require('express');
const router = express.Router();
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

/**
 * 获取操作日志列表
 * GET /api/logs/operation
 */
router.get('/operation', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      userId = '', 
      module = '', 
      action = '',
      status = '',
      startDate = '',
      endDate = ''
    } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE 1=1';
    const params = {};
    
    if (userId) {
      whereClause += ' AND user_id = :userId';
      params.userId = userId;
    }
    
    if (module) {
      whereClause += ' AND module = :module';
      params.module = module;
    }
    
    if (action) {
      whereClause += ' AND action = :action';
      params.action = action;
    }
    
    if (status) {
      whereClause += ' AND status = :status';
      params.status = status;
    }
    
    if (startDate) {
      whereClause += ' AND created_at >= :startDate';
      params.startDate = startDate;
    }
    
    if (endDate) {
      whereClause += ' AND created_at <= :endDate';
      params.endDate = endDate + ' 23:59:59';
    }
    
    // 查询总数
    const countQuery = `SELECT COUNT(*) as total FROM operation_logs ${whereClause}`;
    const countResult = await sequelize.query(countQuery, {
      replacements: params,
      type: QueryTypes.SELECT
    });
    
    // 查询列表
    const listQuery = `
      SELECT id, user_id, username, real_name, module, action, target_type, target_id,
        description, request_method, request_url, ip_address, duration, status, error_message, created_at
      FROM operation_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT :limit OFFSET :offset
    `;
    
    const logs = await sequelize.query(listQuery, {
      replacements: { ...params, limit: parseInt(limit), offset },
      type: QueryTypes.SELECT
    });
    
    res.json({
      success: true,
      data: logs,
      total: countResult[0]?.total || 0,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('获取操作日志失败:', error);
    res.json({ success: false, message: '获取操作日志失败: ' + error.message });
  }
});

/**
 * 获取登录日志列表
 * GET /api/logs/login
 */
router.get('/login', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      username = '', 
      status = '',
      startDate = '',
      endDate = ''
    } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE 1=1';
    const params = {};
    
    if (username) {
      whereClause += ' AND username LIKE :username';
      params.username = `%${username}%`;
    }
    
    if (status) {
      whereClause += ' AND status = :status';
      params.status = status;
    }
    
    if (startDate) {
      whereClause += ' AND created_at >= :startDate';
      params.startDate = startDate;
    }
    
    if (endDate) {
      whereClause += ' AND created_at <= :endDate';
      params.endDate = endDate + ' 23:59:59';
    }
    
    // 查询总数
    const countQuery = `SELECT COUNT(*) as total FROM login_logs ${whereClause}`;
    const countResult = await sequelize.query(countQuery, {
      replacements: params,
      type: QueryTypes.SELECT
    });
    
    // 查询列表
    const listQuery = `
      SELECT id, user_id, username, login_type, device_type, ip_address, location, status, fail_reason, created_at
      FROM login_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT :limit OFFSET :offset
    `;
    
    const logs = await sequelize.query(listQuery, {
      replacements: { ...params, limit: parseInt(limit), offset },
      type: QueryTypes.SELECT
    });
    
    res.json({
      success: true,
      data: logs,
      total: countResult[0]?.total || 0,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('获取登录日志失败:', error);
    res.json({ success: false, message: '获取登录日志失败: ' + error.message });
  }
});

/**
 * 获取操作日志详情
 * GET /api/logs/operation/:id
 */
router.get('/operation/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const logs = await sequelize.query('SELECT * FROM operation_logs WHERE id = :id', {
      replacements: { id },
      type: QueryTypes.SELECT
    });
    
    if (logs.length === 0) {
      return res.json({ success: false, message: '日志不存在' });
    }
    
    res.json({ success: true, data: logs[0] });
  } catch (error) {
    console.error('获取日志详情失败:', error);
    res.json({ success: false, message: '获取日志详情失败: ' + error.message });
  }
});

/**
 * 获取模块列表（用于筛选）
 * GET /api/logs/modules
 */
router.get('/modules', async (req, res) => {
  try {
    const modules = await sequelize.query(`
      SELECT DISTINCT module FROM operation_logs ORDER BY module
    `, { type: QueryTypes.SELECT });
    
    const moduleNames = {
      auth: '认证',
      system: '系统管理',
      product: '商品管理',
      order: '订单管理',
      purchase: '采购管理',
      inventory: '库存管理',
      finance: '财务管理',
      platform: '平台管理'
    };
    
    const data = modules.map(m => ({
      value: m.module,
      label: moduleNames[m.module] || m.module
    }));
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('获取模块列表失败:', error);
    res.json({ success: false, message: '获取模块列表失败: ' + error.message });
  }
});

module.exports = router;
