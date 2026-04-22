const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// 获取所有产品
router.get('/', async (req, res) => {
  try {
    const { category, page = 1, limit = 20 } = req.query;
    const where = {};
    if (category) where.category = category;

    const products = await Product.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });

    res.json({
      success: true,
      data: products.rows,
      total: products.count,
      page: parseInt(page),
      totalPages: Math.ceil(products.count / limit)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 创建产品（支持单个或批量）
router.post('/', async (req, res) => {
  try {
    const data = Array.isArray(req.body) ? req.body : [req.body];
    const products = await Product.bulkCreate(data, {
      updateOnDuplicate: ['name', 'price', 'stock', 'description']
    });
    res.json({ 
      success: true, 
      data: products,
      count: products.length,
      message: `成功导入 ${products.length} 条产品`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 更新库存
router.put('/:id/stock', async (req, res) => {
  try {
    const { stock } = req.body;
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: '产品不存在' });
    }
    product.stock = stock;
    await product.save();
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
