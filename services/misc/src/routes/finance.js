/**
 * 财务记录路由
 */

const express = require('express');
const router = express.Router();
const { FinanceRecord, Withdrawal } = require('../models');
const { Op } = require('sequelize');

const generateId = (prefix = 'FIN') => {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}${dateStr}${random}`;
};

// ==================== 财务记录 ====================

// 获取财务记录列表
router.get('/', async (req, res) => {
  try {
    const { type, category, platform, shopId, startDate, endDate, keyword, page = 1, pageSize = 20 } = req.query;
    
    const where = { status: 'ACTIVE' };
    if (type) where.type = type;
    if (category) where.category = category;
    if (platform) where.platform = platform;
    if (shopId) where.shopId = shopId;
    
    if (startDate || endDate) {
      where.recordDate = {};
      if (startDate) where.recordDate[Op.gte] = new Date(startDate);
      if (endDate) where.recordDate[Op.lte] = new Date(endDate + ' 23:59:59');
    }
    
    if (keyword) {
      where[Op.or] = [
        { description: { [Op.like]: `%${keyword}%` } },
        { relatedId: { [Op.like]: `%${keyword}%` } }
      ];
    }
    
    const { count, rows } = await FinanceRecord.findAndCountAll({
      where,
      order: [['recordDate', 'DESC'], ['created_at', 'DESC']],
      limit: parseInt(pageSize),
      offset: (parseInt(page) - 1) * parseInt(pageSize)
    });
    
    res.json({ success: true, data: { list: rows, total: count, page: parseInt(page), pageSize: parseInt(pageSize) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 创建财务记录
router.post('/', async (req, res) => {
  try {
    const record = await FinanceRecord.create({
      ...req.body,
      recordId: generateId('FIN'),
      recordDate: req.body.recordDate || new Date()
    });
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 获取财务记录详情
router.get('/:id', async (req, res) => {
  try {
    const record = await FinanceRecord.findOne({ where: { recordId: req.params.id } });
    if (!record) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 更新财务记录
router.put('/:id', async (req, res) => {
  try {
    const record = await FinanceRecord.findOne({ where: { recordId: req.params.id } });
    if (!record) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }
    await record.update(req.body);
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 删除财务记录
router.delete('/:id', async (req, res) => {
  try {
    const record = await FinanceRecord.findOne({ where: { recordId: req.params.id } });
    if (!record) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }
    await record.update({ status: 'DELETED' });
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 财务统计
router.get('/stats/summary', async (req, res) => {
  try {
    const { platform, shopId, startDate, endDate } = req.query;
    const where = { status: 'ACTIVE' };
    
    if (platform) where.platform = platform;
    if (shopId) where.shopId = shopId;
    if (startDate || endDate) {
      where.recordDate = {};
      if (startDate) where.recordDate[Op.gte] = new Date(startDate);
      if (endDate) where.recordDate[Op.lte] = new Date(endDate + ' 23:59:59');
    }
    
    const records = await FinanceRecord.findAll({ where, raw: true });
    
    const income = records.filter(r => r.type === 'INCOME').reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
    const expense = records.filter(r => r.type === 'EXPENSE').reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
    
    res.json({ success: true, data: { income, expense, profit: income - expense } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== 提现记录 ====================

// 获取提现记录列表
router.get('/withdrawals', async (req, res) => {
  try {
    const { platform, shopId, status, page = 1, pageSize = 20 } = req.query;
    const where = {};
    
    if (platform) where.platform = platform;
    if (shopId) where.shopId = shopId;
    if (status) where.status = status;
    
    const { count, rows } = await Withdrawal.findAndCountAll({
      where,
      order: [['applyTime', 'DESC']],
      limit: parseInt(pageSize),
      offset: (parseInt(page) - 1) * parseInt(pageSize)
    });
    
    res.json({ success: true, data: { list: rows, total: count, page: parseInt(page), pageSize: parseInt(pageSize) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 申请提现
router.post('/withdrawals', async (req, res) => {
  try {
    const withdrawal = await Withdrawal.create({
      ...req.body,
      withdrawalId: generateId('WD'),
      applyTime: new Date(),
      status: 'PENDING'
    });
    res.json({ success: true, data: withdrawal });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 处理提现
router.put('/withdrawals/:id/process', async (req, res) => {
  try {
    const { status, remark } = req.body;
    const withdrawal = await Withdrawal.findOne({ where: { withdrawalId: req.params.id } });
    
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: '提现记录不存在' });
    }
    
    const updateData = { status, remark };
    if (status === 'PROCESSING') updateData.processTime = new Date();
    else if (status === 'COMPLETED') updateData.completeTime = new Date();
    
    await withdrawal.update(updateData);
    res.json({ success: true, data: withdrawal });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
