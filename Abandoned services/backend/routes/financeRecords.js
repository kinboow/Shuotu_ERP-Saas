const express = require('express');
const router = express.Router();
const FinanceRecord = require('../models/FinanceRecord');
const { Op } = require('sequelize');

// 获取所有资金流水
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, type, startDate, endDate } = req.query;
    const offset = (page - 1) * limit;
    
    const where = {};
    if (type) where.transaction_type = type;
    if (startDate || endDate) {
      where.transaction_time = {};
      if (startDate) where.transaction_time[Op.gte] = new Date(startDate);
      if (endDate) where.transaction_time[Op.lte] = new Date(endDate);
    }
    
    const { count, rows } = await FinanceRecord.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['transaction_time', 'DESC']]
    });
    
    res.json({
      success: true,
      data: rows,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit)
    });
  } catch (error) {
    console.error('获取资金流水失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 批量导入资金流水
router.post('/', async (req, res) => {
  try {
    const records = Array.isArray(req.body) ? req.body : [req.body];
    
    const results = [];
    for (const recordData of records) {
      try {
        const [record, created] = await FinanceRecord.upsert(recordData);
        results.push({ record, created });
      } catch (err) {
        console.error('导入记录失败:', recordData.transaction_time, err.message);
      }
    }
    
    res.json({
      success: true,
      message: `成功导入 ${results.length} 条资金流水`,
      count: results.length,
      data: results
    });
  } catch (error) {
    console.error('批量导入失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取统计信息
router.get('/stats/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const where = {};
    if (startDate || endDate) {
      where.transaction_time = {};
      if (startDate) where.transaction_time[Op.gte] = new Date(startDate);
      if (endDate) where.transaction_time[Op.lte] = new Date(endDate);
    }
    
    const total = await FinanceRecord.count({ where });
    
    const incomeSum = await FinanceRecord.sum('amount', {
      where: { ...where, is_income: true }
    }) || 0;
    
    const expenseSum = await FinanceRecord.sum('amount', {
      where: { ...where, is_income: false }
    }) || 0;
    
    const balance = incomeSum - Math.abs(expenseSum);
    
    res.json({
      success: true,
      data: {
        total,
        income: incomeSum,
        expense: Math.abs(expenseSum),
        balance
      }
    });
  } catch (error) {
    console.error('获取统计信息失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 删除记录
router.delete('/:id', async (req, res) => {
  try {
    const record = await FinanceRecord.findByPk(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }
    
    await record.destroy();
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除记录失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
