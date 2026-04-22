/**
 * ERP商品路由
 */

const express = require('express');
const router = express.Router();
const { ErpProduct } = require('../models');
const { Op } = require('sequelize');

/**
 * 获取ERP商品列表
 * GET /api/erp-products
 */
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, keyword, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    
    const where = {};
    if (keyword) {
      where[Op.or] = [
        { product_code: { [Op.like]: `%${keyword}%` } },
        { product_name_cn: { [Op.like]: `%${keyword}%` } },
        { product_name_en: { [Op.like]: `%${keyword}%` } },
        { supplier_code: { [Op.like]: `%${keyword}%` } }
      ];
    }
    if (status !== undefined && status !== '') {
      where.status = parseInt(status);
    }
    
    const { count, rows } = await ErpProduct.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(pageSize),
      offset
    });
    
    res.json({
      success: true,
      data: rows,
      total: count,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    });
  } catch (error) {
    console.error('获取ERP商品列表失败:', error);
    res.json({ success: false, message: error.message });
  }
});

/**
 * 获取ERP商品详情
 * GET /api/erp-products/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await ErpProduct.findByPk(id);
    
    if (!product) {
      return res.json({ success: false, message: '商品不存在' });
    }
    
    res.json({ success: true, data: product });
  } catch (error) {
    console.error('获取ERP商品详情失败:', error);
    res.json({ success: false, message: error.message });
  }
});


/**
 * 创建ERP商品
 * POST /api/erp-products
 */
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    
    // 自动生成唯一编号
    const product_code = await ErpProduct.generateProductCode();
    
    const product = await ErpProduct.create({
      ...data,
      product_code
    });
    
    res.json({
      success: true,
      data: product,
      message: `商品创建成功，编号: ${product_code}`
    });
  } catch (error) {
    console.error('创建ERP商品失败:', error);
    res.json({ success: false, message: error.message });
  }
});

/**
 * 更新ERP商品
 * PUT /api/erp-products/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    
    const product = await ErpProduct.findByPk(id);
    if (!product) {
      return res.json({ success: false, message: '商品不存在' });
    }
    
    // 不允许修改product_code
    delete data.product_code;
    
    await product.update(data);
    
    res.json({ success: true, data: product, message: '更新成功' });
  } catch (error) {
    console.error('更新ERP商品失败:', error);
    res.json({ success: false, message: error.message });
  }
});

/**
 * 删除ERP商品
 * DELETE /api/erp-products/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await ErpProduct.findByPk(id);
    if (!product) {
      return res.json({ success: false, message: '商品不存在' });
    }
    
    await product.destroy();
    
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除ERP商品失败:', error);
    res.json({ success: false, message: error.message });
  }
});

/**
 * 从在线商品复制到ERP商品
 * POST /api/erp-products/copy-from-online
 */
router.post('/copy-from-online', async (req, res) => {
  try {
    const { productIds, products } = req.body;
    
    if (!products || products.length === 0) {
      return res.json({ success: false, message: '请选择要复制的商品' });
    }
    
    const created = [];
    for (const p of products) {
      const product_code = await ErpProduct.generateProductCode();
      
      const product = await ErpProduct.create({
        product_code,
        product_name_cn: p.product_name || p.productName,
        product_name_en: p.product_name_en || p.productNameEn,
        main_images: p.main_images || p.images || [],
        category: p.category,
        category_id: p.category_id,
        brand: p.brand,
        cost_price: p.cost_price || p.price,
        supplier_code: p.supplier_code || p.supplierCode
      });
      
      created.push(product);
    }
    
    res.json({
      success: true,
      data: created,
      message: `成功复制 ${created.length} 个商品到ERP`
    });
  } catch (error) {
    console.error('复制商品失败:', error);
    res.json({ success: false, message: error.message });
  }
});

module.exports = router;
