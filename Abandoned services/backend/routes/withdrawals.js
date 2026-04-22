const express = require('express');
const router = express.Router();
const Withdrawal = require('../models/Withdrawal');
const { Op } = require('sequelize');

// 获取所有提现记录
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, startDate, endDate } = req.query;
    const offset = (page - 1) * limit;
    
    const where = {};
    if (status) where.status = status;
    if (startDate || endDate) {
      where.created_time = {};
      if (startDate) where.created_time[Op.gte] = new Date(startDate);
      if (endDate) where.created_time[Op.lte] = new Date(endDate);
    }
    
    const { count, rows } = await Withdrawal.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_time', 'DESC']]
    });
    
    res.json({
      success: true,
      data: rows,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit)
    });
  } catch (error) {
    console.error('获取提现记录失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 批量导入提现记录
router.post('/', async (req, res) => {
  try {
    const records = Array.isArray(req.body) ? req.body : [req.body];
    
    const results = [];
    for (const recordData of records) {
      try {
        // 使用created_time和amount作为唯一标识
        const [record, created] = await Withdrawal.findOrCreate({
          where: {
            created_time: recordData.created_time,
            amount: recordData.amount
          },
          defaults: recordData
        });
        
        // 如果记录已存在，更新它
        if (!created) {
          await record.update(recordData);
        }
        
        results.push({ record, created });
      } catch (err) {
        console.error('导入记录失败:', recordData.created_time, err.message);
      }
    }
    
    res.json({
      success: true,
      message: `成功导入 ${results.length} 条提现记录`,
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
      where.created_time = {};
      if (startDate) where.created_time[Op.gte] = new Date(startDate);
      if (endDate) where.created_time[Op.lte] = new Date(endDate);
    }
    
    const total = await Withdrawal.count({ where });
    
    const totalAmount = await Withdrawal.sum('amount', { where }) || 0;
    
    // 按状态统计
    const successCount = await Withdrawal.count({
      where: { ...where, status: '银行受理成功' }
    });
    
    const pendingCount = await Withdrawal.count({
      where: { ...where, status: { [Op.ne]: '银行受理成功' } }
    });
    
    res.json({
      success: true,
      data: {
        total,
        totalAmount,
        successCount,
        pendingCount
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
    const record = await Withdrawal.findByPk(req.params.id);
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
