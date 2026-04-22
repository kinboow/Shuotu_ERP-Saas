/**
 * 采购单/备货单路由
 * 根据platform参数指向不同的数据表
 * shein -> shein_full_purchase_orders / shein_full_purchase_order_items
 * temu/tiktok -> 暂未开放
 */

const express = require('express');
const router = express.Router();
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

// 平台表配置
const platformTables = {
  shein: {
    orders: 'shein_full_purchase_orders',
    items: 'shein_full_purchase_order_items'
  },
  temu: null,   // 暂未开放
  tiktok: null  // 暂未开放
};

/**
 * 获取采购单列表
 * GET /api/stock-orders
 */
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status = '', 
      order_no = '',
      order_number = '',
      type = '',
      order_type = '',
      shop_id = '',
      platform = 'shein',
      start_date = '', 
      end_date = '',
      skc = '',
      supplier_code = '',
      warehouse_group = ''
    } = req.query;
    
    const offset = (page - 1) * limit;
    const platformKey = platform.toLowerCase();
    const tables = platformTables[platformKey];

    // 平台未开放
    if (!tables) {
      return res.json({
        success: true,
        data: [],
        total: 0,
        page: parseInt(page),
        limit: parseInt(limit),
        message: `${platform.toUpperCase()}平台采购单功能暂未开放`
      });
    }

    let whereClause = '';
    const params = {};

    // 状态筛选
    if (status) {
      const statusMap = {
        '待下单': 1, '已下单': 2, '待发货': 2, '发货中': 3,
        '已送货': 4, '已收货': 5, '已查验': 6, '已退货': 7,
        '已完成': 8, '无货下架': 9, '已作废': 10, '待审核': 11,
        '分单中': 12, '待退货': 13
      };
      let statusValue = statusMap[status] !== undefined ? statusMap[status] : status;
      whereClause += ' AND po.status = :status';
      params.status = statusValue;
    }

    const orderNoParam = order_no || order_number;
    if (orderNoParam) {
      // 支持多个订单号查询（按换行符、逗号、空格分隔）
      let decodedParam = orderNoParam;
      try {
        decodedParam = decodeURIComponent(orderNoParam);
      } catch (e) {
        // 解码失败则使用原值
      }
      const orderNos = decodedParam.split(/[\n\r,;，；\s]+/).map(s => s.trim()).filter(s => s);
      console.log('订单号查询参数:', orderNoParam, '解析后:', orderNos);
      if (orderNos.length === 1) {
        // 单个订单号，使用模糊匹配
        whereClause += ' AND po.order_no LIKE :order_no';
        params.order_no = `%${orderNos[0]}%`;
      } else if (orderNos.length > 1) {
        // 多个订单号，使用 IN 精确匹配（直接拼接SQL，对值进行转义）
        const escapedNos = orderNos.map(no => `'${no.replace(/'/g, "''")}'`).join(', ');
        whereClause += ` AND po.order_no IN (${escapedNos})`;
      }
    }

    const typeParam = type || order_type;
    if (typeParam) {
      let typeValue = typeParam;
      if (typeParam === '急采') typeValue = 1;
      else if (typeParam === '备货') typeValue = 2;
      whereClause += ' AND po.order_type = :order_type';
      params.order_type = typeValue;
    }

    if (shop_id) {
      whereClause += ' AND po.shop_id = :shop_id';
      params.shop_id = shop_id;
    }

    if (start_date) {
      whereClause += ' AND po.allocate_time >= :start_date';
      params.start_date = start_date;
    }

    if (end_date) {
      whereClause += ' AND po.allocate_time <= :end_date';
      params.end_date = end_date + ' 23:59:59';
    }

    if (skc) {
      whereClause += ` AND po.id IN (SELECT order_id FROM ${tables.items} WHERE skc LIKE :skc)`;
      params.skc = `%${skc}%`;
    }

    const supplierCodeParam = supplier_code || req.query.product_code;
    if (supplierCodeParam) {
      whereClause += ` AND po.id IN (SELECT order_id FROM ${tables.items} WHERE supplier_code LIKE :supplier_code)`;
      params.supplier_code = `%${supplierCodeParam}%`;
    }

    if (warehouse_group) {
      whereClause += ' AND po.warehouse_name LIKE :warehouse_name';
      params.warehouse_name = `%${warehouse_group}%`;
    }

    const countQuery = `SELECT COUNT(*) as total FROM ${tables.orders} po WHERE 1=1 ${whereClause}`;
    const countResult = await sequelize.query(countQuery, { replacements: params, type: QueryTypes.SELECT });

    const orderQuery = `
      SELECT po.*, 
        COALESCE(s.shop_name, CONCAT('店铺', po.shop_id)) as shop_name,
        'SHEIN' as platform_display_name
      FROM ${tables.orders} po
      LEFT JOIN shein_full_shops s ON po.shop_id = s.id
      WHERE 1=1 ${whereClause}
      ORDER BY po.allocate_time DESC, po.add_time DESC
      LIMIT :limit OFFSET :offset
    `;

    const orders = await sequelize.query(orderQuery, {
      replacements: { ...params, limit: parseInt(limit), offset },
      type: QueryTypes.SELECT
    });

    if (orders.length > 0) {
      const orderIds = orders.map(o => o.id);
      const itemsQuery = `SELECT * FROM ${tables.items} WHERE order_id IN (${orderIds.join(',')}) ORDER BY order_id, id`;
      const allItems = await sequelize.query(itemsQuery, { type: QueryTypes.SELECT });

      const itemsByOrderId = {};
      allItems.forEach(item => {
        if (!itemsByOrderId[item.order_id]) itemsByOrderId[item.order_id] = [];
        item.product_image = item.img_path;
        item.sku_image = item.sku_img;
        item.sku_attribute = item.suffix_zh;
        itemsByOrderId[item.order_id].push(item);
      });

      orders.forEach(order => {
        order.items = itemsByOrderId[order.id] || [];
        order.sku_count = order.items.length;
        order.order_number = order.order_no;
        if (order.items.length > 0) {
          const firstItem = order.items[0];
          order.product_code = firstItem.supplier_code;
          order.product_image = firstItem.img_path;
          order.skc = firstItem.skc;
          order.sku_attribute = firstItem.suffix_zh;
          order.sku_code = firstItem.sku_code;
          order.declared_price = firstItem.price;
        }
      });
    }

    res.json({ success: true, data: orders, total: countResult[0]?.total || 0, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('获取采购单列表失败:', error);
    res.json({ success: false, message: '获取采购单列表失败: ' + error.message });
  }
});

/**
 * 获取采购单统计
 * GET /api/stock-orders/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const { platform = 'shein' } = req.query;
    const platformKey = platform.toLowerCase();
    const tables = platformTables[platformKey];

    if (!tables) {
      return res.json({ success: true, data: { total: 0, pending: 0, shipped: 0, received: 0, urgent_count: 0, stock_count: 0 } });
    }

    const query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status IN (3, 4) THEN 1 ELSE 0 END) as shipped,
        SUM(CASE WHEN status IN (5, 6, 8) THEN 1 ELSE 0 END) as received,
        SUM(CASE WHEN order_type = 1 THEN 1 ELSE 0 END) as urgent_count,
        SUM(CASE WHEN order_type = 2 THEN 1 ELSE 0 END) as stock_count
      FROM ${tables.orders}
    `;

    const result = await sequelize.query(query, { type: QueryTypes.SELECT });
    res.json({ success: true, data: result[0] || { total: 0, pending: 0, shipped: 0, received: 0, urgent_count: 0, stock_count: 0 } });
  } catch (error) {
    res.json({ success: false, message: '获取统计信息失败: ' + error.message });
  }
});

/**
 * 获取店铺列表（从订单数据中提取，关联店铺表获取名称）
 * GET /api/stock-orders/shops
 */
router.get('/shops', async (req, res) => {
  try {
    const { platform = 'shein' } = req.query;
    const platformKey = platform.toLowerCase();
    const tables = platformTables[platformKey];

    if (!tables) {
      return res.json({ success: true, data: [] });
    }

    // 关联shein_full_shops表获取店铺名称
    const query = `
      SELECT DISTINCT po.shop_id, COALESCE(s.shop_name, CONCAT('店铺', po.shop_id)) as shop_name
      FROM ${tables.orders} po
      LEFT JOIN shein_full_shops s ON po.shop_id = s.id
      WHERE po.shop_id IS NOT NULL
      ORDER BY shop_name
    `;

    const result = await sequelize.query(query, { type: QueryTypes.SELECT });
    res.json({ success: true, data: result });
  } catch (error) {
    res.json({ success: false, message: '获取店铺列表失败: ' + error.message });
  }
});

/**
 * 获取单个采购单详情
 * GET /api/stock-orders/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { platform = 'shein' } = req.query;
    const platformKey = platform.toLowerCase();
    const tables = platformTables[platformKey];

    if (!tables) {
      return res.json({ success: false, message: `${platform.toUpperCase()}平台采购单功能暂未开放` });
    }

    const orderQuery = `SELECT po.* FROM ${tables.orders} po WHERE po.id = :id`;
    const orders = await sequelize.query(orderQuery, { replacements: { id }, type: QueryTypes.SELECT });

    if (orders.length === 0) {
      return res.json({ success: false, message: '采购单不存在' });
    }

    const order = orders[0];
    const itemsQuery = `SELECT * FROM ${tables.items} WHERE order_id = :id`;
    order.items = await sequelize.query(itemsQuery, { replacements: { id }, type: QueryTypes.SELECT });

    res.json({ success: true, data: order });
  } catch (error) {
    res.json({ success: false, message: '获取采购单详情失败: ' + error.message });
  }
});

/**
 * 打印商品条码（代理到sync-engine的SHEIN API）
 * POST /api/stock-orders/print-barcode
 */
router.post('/print-barcode', async (req, res) => {
  try {
    const { shopId, data, type = 2, printFormatType = 1 } = req.body;

    if (!shopId) {
      return res.status(400).json({ success: false, message: '缺少shopId参数' });
    }
    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ success: false, message: '缺少data参数或data为空' });
    }

    // 代理到 sync-engine 服务
    const axios = require('axios');
    const syncEngineUrl = `http://localhost:${process.env.SYNC_ENGINE_PORT || 5001}`;
    const response = await axios.post(`${syncEngineUrl}/api/shein-full/print-barcode`, {
      shopId,
      data,
      type,
      printFormatType
    }, { timeout: 30000 });

    res.json(response.data);
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ success: false, message: '打印条码失败: ' + error.message });
    }
  }
});

/**
 * 获取SKU分类信息（代理到sync-engine）
 * POST /api/stock-orders/sku-categories
 */
router.post('/sku-categories', async (req, res) => {
  try {
    const { shopId, skus } = req.body;

    if (!shopId) {
      return res.status(400).json({ success: false, message: '缺少shopId参数' });
    }
    if (!skus || !Array.isArray(skus) || skus.length === 0) {
      return res.json({ success: true, data: {} });
    }

    const axios = require('axios');
    const syncEngineUrl = `http://localhost:${process.env.SYNC_ENGINE_PORT || 5001}`;
    const response = await axios.post(`${syncEngineUrl}/api/shein-full/sku-categories`, {
      shopId,
      skus
    }, { timeout: 30000 });

    res.json(response.data);
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ success: false, message: '获取分类失败: ' + error.message });
    }
  }
});

module.exports = router;
