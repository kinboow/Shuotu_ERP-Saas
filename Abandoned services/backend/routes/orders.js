const express = require('express');
const router = express.Router();
const Order = require('../models/Order');

// 获取所有订单
router.get('/', async (req, res) => {
  try {
    const { platform, status, page = 1, limit = 20 } = req.query;
    const where = {};
    if (platform) where.platform = platform;
    if (status) where.status = status;

    const orders = await Order.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['order_date', 'DESC']]
    });

    res.json({
      success: true,
      data: orders.rows,
      total: orders.count,
      page: parseInt(page),
      totalPages: Math.ceil(orders.count / limit)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 创建订单（支持单个或批量）
router.post('/', async (req, res) => {
  try {
    const data = Array.isArray(req.body) ? req.body : [req.body];
    const orders = await Order.bulkCreate(data, {
      updateOnDuplicate: ['status', 'total_amount', 'tracking_number']
    });
    res.json({ 
      success: true, 
      data: orders,
      count: orders.length,
      message: `成功导入 ${orders.length} 条订单`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 更新订单状态
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByPk(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: '订单不存在' });
    }
    order.status = status;
    await order.save();
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
