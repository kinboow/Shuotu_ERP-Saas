const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const PlatformShop = require('../models/PlatformShop');
const PlatformConfig = require('../models/PlatformConfig');
const SheinProduct = require('../models/SheinProduct');

/**
 * SHEIN商品路由
 * API调用功能已删除，仅保留本地数据库查询功能
 */

// 缓存总SPU数量（5分钟过期）
const spuCountCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟

/**
 * 获取商品列表
 * POST /api/shein-products/query
 * 功能已删除，待重新实现
 */
router.post('/query', async (req, res) => {
  res.json({
    success: false,
    message: '功能开发中：查询SHEIN商品列表'
  });
});

/**
 * 获取SPU商品详情
 * POST /api/shein-products/spu-info
 * 功能已删除，待重新实现
 */
router.post('/spu-info', async (req, res) => {
  res.json({
    success: false,
    message: '功能开发中：获取SPU商品详情'
  });
});

/**
 * 清除SPU数量缓存
 * POST /api/shein-products/clear-cache
 */
router.post('/clear-cache', async (req, res) => {
  try {
    spuCountCache.clear();
    res.json({
      success: true,
      message: '缓存已清除'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 同步商品到本地数据库
 * POST /api/shein-products/sync
 * 功能已删除，待重新实现
 */
router.post('/sync', async (req, res) => {
  res.json({
    success: false,
    message: '功能开发中：同步商品到本地数据库'
  });
});

/**
 * 批量同步商品
 * POST /api/shein-products/batch-sync
 * 功能已删除，待重新实现
 */
router.post('/batch-sync', async (req, res) => {
  res.json({
    success: false,
    message: '功能开发中：批量同步商品'
  });
});

/**
 * 获取本地商品列表（支持SPU维度分页）
 * GET /api/shein-products/local
 */
router.get('/local', async (req, res) => {
  try {
    const { shopId, page = 1, pageSize = 20, search, shelf_status, mall_state, countOnly = 'false' } = req.query;

    const where = {};
    if (shopId) where.shop_id = shopId;
    if (search) {
      where[Op.or] = [
        { spu_name: { [Op.like]: `%${search}%` } },
        { sku_code: { [Op.like]: `%${search}%` } },
        { product_name_cn: { [Op.like]: `%${search}%` } }
      ];
    }
    if (shelf_status !== undefined && shelf_status !== null && shelf_status !== '') {
      where.shelf_status = parseInt(shelf_status);
    }
    if (mall_state !== undefined && mall_state !== null && mall_state !== '') {
      where.mall_state = parseInt(mall_state);
    }

    if (countOnly === 'true') {
      const cacheKey = `spu_count_${shopId || 'all'}_${search || ''}`;
      const cached = spuCountCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return res.json({
          success: true,
          data: { totalSpu: cached.count }
        });
      }

      const spuCount = await SheinProduct.count({
        where,
        distinct: true,
        col: 'spu_name'
      });

      spuCountCache.set(cacheKey, { count: spuCount, timestamp: Date.now() });

      return res.json({
        success: true,
        data: { totalSpu: spuCount }
      });
    }

    const startIndex = (parseInt(page) - 1) * parseInt(pageSize);
    const sequelize = SheinProduct.sequelize;
    
    const whereConditions = [];
    const replacements = {
      limit: parseInt(pageSize),
      offset: startIndex
    };
    
    if (shopId) {
      whereConditions.push('shop_id = :shopId');
      replacements.shopId = shopId;
    }
    if (search) {
      whereConditions.push('(spu_name LIKE :search OR sku_code LIKE :search OR product_name_cn LIKE :search)');
      replacements.search = `%${search}%`;
    }
    if (shelf_status !== undefined && shelf_status !== null && shelf_status !== '') {
      whereConditions.push('shelf_status = :shelf_status');
      replacements.shelf_status = parseInt(shelf_status);
    }
    if (mall_state !== undefined && mall_state !== null && mall_state !== '') {
      whereConditions.push('mall_state = :mall_state');
      replacements.mall_state = parseInt(mall_state);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    const spuQuery = `
      SELECT DISTINCT spu_name 
      FROM SheinProducts 
      ${whereClause}
      ORDER BY updatedAt DESC
      LIMIT :limit OFFSET :offset
    `;
    
    const spuResult = await sequelize.query(spuQuery, {
      replacements,
      type: sequelize.QueryTypes.SELECT
    });
    
    const spuNames = spuResult.map(row => row.spu_name);

    if (spuNames.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: {
          totalSku: 0,
          totalSkc: 0,
          totalSpu: 0,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          totalPages: 0
        }
      });
    }

    const cacheKey = `spu_count_${shopId || 'all'}_${search || ''}`;
    let totalSpu;
    const cached = spuCountCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      totalSpu = cached.count;
    } else {
      totalSpu = await SheinProduct.count({
        where,
        distinct: true,
        col: 'spu_name'
      });
      spuCountCache.set(cacheKey, { count: totalSpu, timestamp: Date.now() });
    }

    const rows = await SheinProduct.findAll({
      where: {
        ...where,
        spu_name: { [Op.in]: spuNames }
      },
      attributes: [
        'id', 'sku_code', 'spu_name', 'skc_name',
        'product_name_cn', 'product_name_en', 'brand_code',
        'main_image_url', 'base_price', 'special_price', 'cost_price',
        'shelf_status', 'mall_state', 'stop_purchase'
      ],
      order: [['spu_name', 'ASC'], ['skc_name', 'ASC'], ['updatedAt', 'DESC']],
      raw: true
    });

    const skcSet = new Set(rows.map(r => r.skc_name));
    const totalSkc = skcSet.size;

    res.json({
      success: true,
      data: rows,
      pagination: {
        totalSku: rows.length,
        totalSkc: totalSkc,
        totalSpu: totalSpu,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(totalSpu / parseInt(pageSize))
      }
    });
  } catch (error) {
    console.error('获取本地商品列表失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取单个商品详情
 * GET /api/shein-products/local/:id
 */
router.get('/local/:id', async (req, res) => {
  try {
    const product = await SheinProduct.findByPk(req.params.id, {
      include: [{
        model: PlatformShop,
        as: 'shop',
        attributes: ['id', 'shop_name'],
        include: [{
          model: PlatformConfig,
          as: 'platform',
          attributes: ['id', 'api_domain']
        }]
      }]
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
      message: error.message
    });
  }
});

module.exports = router;
