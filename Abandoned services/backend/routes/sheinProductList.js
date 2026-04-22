/**
 * SHEIN商品列表路由
 * 处理从浏览器扩展抓取的商品数据
 */

const express = require('express');
const router = express.Router();
const SheinProductList = require('../models/SheinProductList');
const { Op } = require('sequelize');

/**
 * 批量保存商品列表
 * POST /api/shein-product-list
 */
router.post('/', async (req, res) => {
  try {
    const products = req.body;
    
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供商品数据数组'
      });
    }
    
    console.log(`收到 ${products.length} 条商品数据`);
    
    let successCount = 0;
    let updateCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // 批量处理商品数据
    for (const product of products) {
      try {
        // 检查必填字段
        if (!product.sku_id) {
          errorCount++;
          errors.push({ product, error: '缺少SKU ID' });
          continue;
        }
        
        // 查找是否已存在
        const existing = await SheinProductList.findOne({
          where: { sku_id: product.sku_id }
        });
        
        if (existing) {
          // 更新现有记录
          await existing.update({
            spu_id: product.spu_id || existing.spu_id,
            skc_id: product.skc_id || existing.skc_id,
            product_name: product.product_name || existing.product_name,
            product_code: product.product_code || existing.product_code,
            category: product.category || existing.category,
            product_image: product.product_image || existing.product_image,
            attributes: product.attributes || existing.attributes,
            color: product.color || existing.color,
            size: product.size || existing.size,
            stock: product.stock !== undefined ? product.stock : existing.stock,
            volume: product.volume || existing.volume,
            weight: product.weight || existing.weight,
            platform_volume: product.platform_volume || existing.platform_volume,
            platform_weight: product.platform_weight || existing.platform_weight,
            sku_category: product.sku_category || existing.sku_category,
            item_count: product.item_count !== undefined ? product.item_count : existing.item_count,
            sku_code: product.sku_code || existing.sku_code,
            declared_price: product.declared_price !== undefined ? product.declared_price : existing.declared_price,
            today_sales: product.today_sales !== undefined ? product.today_sales : existing.today_sales,
            today_total: product.today_total !== undefined ? product.today_total : existing.today_total,
            week_sales: product.week_sales !== undefined ? product.week_sales : existing.week_sales,
            created_time: product.created_time || existing.created_time,
            updated_at: new Date()
          });
          updateCount++;
        } else {
          // 创建新记录
          await SheinProductList.create({
            spu_id: product.spu_id || '',
            skc_id: product.skc_id || '',
            sku_id: product.sku_id,
            product_name: product.product_name || '',
            product_code: product.product_code || '',
            category: product.category || '',
            product_image: product.product_image || '',
            attributes: product.attributes || '',
            color: product.color || '',
            size: product.size || '',
            stock: product.stock || 0,
            volume: product.volume || '',
            weight: product.weight || '',
            platform_volume: product.platform_volume || '',
            platform_weight: product.platform_weight || '',
            sku_category: product.sku_category || '',
            item_count: product.item_count || 1,
            sku_code: product.sku_code || '',
            declared_price: product.declared_price || 0,
            today_sales: product.today_sales || 0,
            today_total: product.today_total || 0,
            week_sales: product.week_sales || 0,
            created_time: product.created_time || null,
            captured_at: new Date()
          });
          successCount++;
        }
      } catch (error) {
        console.error('保存商品失败:', error);
        errorCount++;
        errors.push({ 
          product: { sku_id: product.sku_id }, 
          error: error.message 
        });
      }
    }
    
    console.log(`✓ 商品数据保存完成: 新增 ${successCount}, 更新 ${updateCount}, 失败 ${errorCount}`);
    
    res.json({
      success: true,
      message: `成功处理 ${successCount + updateCount} 条商品数据`,
      count: successCount + updateCount,
      details: {
        created: successCount,
        updated: updateCount,
        failed: errorCount,
        errors: errors.length > 0 ? errors.slice(0, 10) : [] // 只返回前10个错误
      }
    });
    
  } catch (error) {
    console.error('批量保存商品失败:', error);
    res.status(500).json({
      success: false,
      message: '保存商品数据失败',
      error: error.message
    });
  }
});

/**
 * 获取商品列表
 * GET /api/shein-product-list
 */
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      spu_id, 
      skc_id, 
      product_code,
      keyword,
      sort = 'captured_at',
      order = 'DESC'
    } = req.query;
    
    const offset = (page - 1) * limit;
    
    // 构建查询条件
    const where = {};
    
    if (spu_id) {
      where.spu_id = spu_id;
    }
    
    if (skc_id) {
      where.skc_id = skc_id;
    }
    
    if (product_code) {
      where.product_code = product_code;
    }
    
    if (keyword) {
      where[Op.or] = [
        { product_name: { [Op.like]: `%${keyword}%` } },
        { product_code: { [Op.like]: `%${keyword}%` } },
        { sku_id: { [Op.like]: `%${keyword}%` } }
      ];
    }
    
    // 查询数据
    const { count, rows } = await SheinProductList.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sort, order]]
    });
    
    res.json({
      success: true,
      data: {
        products: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }
    });
    
  } catch (error) {
    console.error('获取商品列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取商品列表失败',
      error: error.message
    });
  }
});

/**
 * 获取单个商品详情
 * GET /api/shein-product-list/:sku_id
 */
router.get('/:sku_id', async (req, res) => {
  try {
    const { sku_id } = req.params;
    
    const product = await SheinProductList.findOne({
      where: { sku_id }
    });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: '商品不存在'
      });
    }
    
    res.json({
      success: true,
      data: product
    });
    
  } catch (error) {
    console.error('获取商品详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取商品详情失败',
      error: error.message
    });
  }
});

/**
 * 删除商品
 * DELETE /api/shein-product-list/:sku_id
 */
router.delete('/:sku_id', async (req, res) => {
  try {
    const { sku_id } = req.params;
    
    const result = await SheinProductList.destroy({
      where: { sku_id }
    });
    
    if (result === 0) {
      return res.status(404).json({
        success: false,
        message: '商品不存在'
      });
    }
    
    res.json({
      success: true,
      message: '商品已删除'
    });
    
  } catch (error) {
    console.error('删除商品失败:', error);
    res.status(500).json({
      success: false,
      message: '删除商品失败',
      error: error.message
    });
  }
});

/**
 * 获取统计信息
 * GET /api/shein-product-list/stats/summary
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const totalCount = await SheinProductList.count();
    
    const spuCount = await SheinProductList.count({
      distinct: true,
      col: 'spu_id'
    });
    
    const skcCount = await SheinProductList.count({
      distinct: true,
      col: 'skc_id'
    });
    
    res.json({
      success: true,
      data: {
        total_products: totalCount,
        total_spu: spuCount,
        total_skc: skcCount
      }
    });
    
  } catch (error) {
    console.error('获取统计信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取统计信息失败',
      error: error.message
    });
  }
});

module.exports = router;
