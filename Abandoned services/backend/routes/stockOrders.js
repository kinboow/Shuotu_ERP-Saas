/**
 * 采购单路由（备货单/急采单）
 * 数据来源：shein_purchase_orders 表（通过同步功能从SHEIN API获取）
 */

const express = require('express');
const router = express.Router();
const sequelize = require('../config/database');
const { QueryTypes } = require('sequelize');

// 引入功能模块
const { printBarcode } = require('../api_comprehensive/shein_order_printBarcode');

/**
 * 获取采购单列表
 * GET /api/stock-orders
 * 根据platform_id选择不同的数据库表：
 * - SHEIN(1): shein_purchase_orders + shein_purchase_order_details
 * - TEMU(5): 暂未实现
 * - TIKTOK(6): 暂未实现
 */
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status = '', 
      order_no = '',
      order_number = '',  // 兼容旧参数名
      type = '',          // 1:急采 2:备货
      order_type = '',    // 兼容旧参数名
      shop_id = '',
      platform_id = '1',  // 平台筛选：SHEIN=1, TEMU=5, TIKTOK=6，默认SHEIN
      start_date = '', 
      end_date = '',
      skc = '',
      supplier_code = '',
      warehouse_group = '' // 仓库筛选
    } = req.query;
    
    const offset = (page - 1) * limit;
    const platformIdNum = parseInt(platform_id) || 1;

    // TEMU(5) 和 TIKTOK(6) 暂未实现，返回空数据
    if (platformIdNum === 5 || platformIdNum === 6) {
      const platformName = platformIdNum === 5 ? 'TEMU' : 'TIKTOK';
      return res.json({
        success: true,
        data: [],
        total: 0,
        page: parseInt(page),
        limit: parseInt(limit),
        message: `${platformName}平台采购单功能暂未开放`
      });
    }

    // SHEIN平台 - 使用 shein_purchase_orders 和 shein_purchase_order_details 表
    let whereClause = '';
    const params = {};

    // 状态筛选（支持数字和中文名称）
    if (status) {
      // 状态码映射：1待下单/2已下单/3发货中/4已送货/5已收货/6已查验/7已退货/8已完成/9无货下架/10已作废/11待审核/12分单中/13待退货
      const statusMap = {
        '待下单': 1,
        '已下单': 2,
        '待发货': 2, // 已下单等同于待发货
        '发货中': 3,
        '已送货': 4,
        '已收货': 5,
        '已查验': 6,
        '已退货': 7,
        '已完成': 8,
        '无货下架': 9,
        '已作废': 10,
        '待审核': 11,
        '分单中': 12,
        '待退货': 13
      };
      
      let statusValue = status;
      if (statusMap[status] !== undefined) {
        statusValue = statusMap[status];
      }
      
      whereClause += ' AND po.status = :status';
      params.status = statusValue;
    }

    // 订单号筛选（支持两个参数名）
    const orderNoParam = order_no || order_number;
    if (orderNoParam) {
      whereClause += ' AND po.order_no LIKE :order_no';
      params.order_no = `%${orderNoParam}%`;
    }

    // 类型筛选（1:急采 2:备货）
    const typeParam = type || order_type;
    if (typeParam) {
      // 支持数字和中文名称
      let typeValue = typeParam;
      if (typeParam === '急采') typeValue = 1;
      else if (typeParam === '备货') typeValue = 2;
      
      whereClause += ' AND po.type = :type';
      params.type = typeValue;
    }

    // 店铺筛选
    if (shop_id) {
      whereClause += ' AND po.shop_id = :shop_id';
      params.shop_id = shop_id;
    }

    // 时间范围筛选（使用allocate_time下发时间）
    if (start_date) {
      whereClause += ' AND po.allocate_time >= :start_date';
      params.start_date = start_date;
    }

    if (end_date) {
      whereClause += ' AND po.allocate_time <= :end_date';
      params.end_date = end_date + ' 23:59:59';
    }

    // SKC筛选（需要关联明细表）
    if (skc) {
      whereClause += ' AND po.id IN (SELECT purchase_order_id FROM shein_purchase_order_details WHERE skc LIKE :skc)';
      params.skc = `%${skc}%`;
    }

    // 供应商货号筛选（支持 supplier_code 和 product_code 两个参数名）
    const supplierCodeParam = supplier_code || req.query.product_code;
    if (supplierCodeParam) {
      whereClause += ' AND po.id IN (SELECT purchase_order_id FROM shein_purchase_order_details WHERE supplier_code LIKE :supplier_code)';
      params.supplier_code = `%${supplierCodeParam}%`;
    }

    // 仓库筛选
    if (warehouse_group) {
      whereClause += ' AND po.warehouse_name LIKE :warehouse_name';
      params.warehouse_name = `%${warehouse_group}%`;
    }

    // 统计总数
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM shein_purchase_orders po
      WHERE 1=1 ${whereClause}
    `;
    const countResult = await sequelize.query(countQuery, {
      replacements: params,
      type: QueryTypes.SELECT
    });

    // 获取采购单列表
    const orderQuery = `
      SELECT 
        po.*,
        ps.shop_name,
        ps.platform_name,
        pc.platform_display_name
      FROM shein_purchase_orders po
      LEFT JOIN PlatformShops ps ON po.shop_id = ps.id
      LEFT JOIN PlatformConfigs pc ON ps.platform_id = pc.id
      WHERE 1=1 ${whereClause}
      ORDER BY po.allocate_time DESC, po.add_time DESC, po.update_time DESC
      LIMIT :limit OFFSET :offset
    `;

    const orders = await sequelize.query(orderQuery, {
      replacements: { ...params, limit: parseInt(limit), offset },
      type: QueryTypes.SELECT
    });

    // 获取每个采购单的SKU明细
    if (orders.length > 0) {
      const orderIds = orders.map(o => o.id);
      
      const itemsQuery = `
        SELECT *
        FROM shein_purchase_order_details
        WHERE purchase_order_id IN (${orderIds.map(() => '?').join(',')})
        ORDER BY purchase_order_id, id
      `;
      
      const allItems = await sequelize.query(itemsQuery, {
        replacements: orderIds,
        type: QueryTypes.SELECT
      });

      // 将明细按订单ID分组，并添加字段映射
      const itemsByOrderId = {};
      allItems.forEach(item => {
        if (!itemsByOrderId[item.purchase_order_id]) {
          itemsByOrderId[item.purchase_order_id] = [];
        }
        // 添加前端期望的字段名映射
        item.product_image = item.img_path;
        item.sku_image = item.sku_img;
        item.sku_attribute = item.suffix_zh;
        itemsByOrderId[item.purchase_order_id].push(item);
      });

      // 将明细列表附加到每个订单，并兼容旧字段名
      orders.forEach(order => {
        order.items = itemsByOrderId[order.id] || [];
        order.sku_count = order.items.length;
        
        // 兼容旧字段名
        order.order_number = order.order_no;
        order.order_type = order.type;
        
        // 使用第一个SKU的信息作为订单的主要显示信息
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

    res.json({
      success: true,
      data: orders,
      total: countResult[0]?.total || 0,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('获取采购单列表失败:', error);
    res.json({
      success: false,
      message: '获取采购单列表失败: ' + error.message
    });
  }
});

/**
 * 获取采购单统计信息
 * GET /api/stock-orders/stats
 * 根据platform_id选择不同的数据库表
 */
router.get('/stats', async (req, res) => {
  try {
    const { platform_id = '1' } = req.query;
    const platformIdNum = parseInt(platform_id) || 1;

    // TEMU(5) 和 TIKTOK(6) 暂未实现，返回空统计
    if (platformIdNum === 5 || platformIdNum === 6) {
      return res.json({
        success: true,
        data: { total: 0, pending: 0, shipped: 0, received: 0, urgent_count: 0, stock_count: 0 }
      });
    }

    // SHEIN平台 - 使用 shein_purchase_orders 表
    // 状态：1待下单/2已下单/3发货中/4已送货/5已收货/6已查验/7已退货/8已完成/9无货下架/10已作废
    const query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status IN (3, 4) THEN 1 ELSE 0 END) as shipped,
        SUM(CASE WHEN status IN (5, 6, 8) THEN 1 ELSE 0 END) as received,
        SUM(CASE WHEN type = 1 THEN 1 ELSE 0 END) as urgent_count,
        SUM(CASE WHEN type = 2 THEN 1 ELSE 0 END) as stock_count
      FROM shein_purchase_orders
    `;

    const result = await sequelize.query(query, {
      type: QueryTypes.SELECT
    });

    res.json({
      success: true,
      data: result[0] || { total: 0, pending: 0, shipped: 0, received: 0, urgent_count: 0, stock_count: 0 }
    });
  } catch (error) {
    console.error('获取统计信息失败:', error);
    res.json({
      success: false,
      message: '获取统计信息失败: ' + error.message
    });
  }
});

/**
 * 获取单个采购单详情
 * GET /api/stock-orders/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const orderQuery = `
      SELECT po.*, ps.shop_name, ps.platform_name
      FROM shein_purchase_orders po
      LEFT JOIN PlatformShops ps ON po.shop_id = ps.id
      WHERE po.id = :id
    `;
    const orderResult = await sequelize.query(orderQuery, {
      replacements: { id },
      type: QueryTypes.SELECT
    });

    if (orderResult.length === 0) {
      return res.json({
        success: false,
        message: '采购单不存在'
      });
    }

    const order = orderResult[0];

    // 获取采购单明细
    const itemsQuery = `SELECT * FROM shein_purchase_order_details WHERE purchase_order_id = :id`;
    const items = await sequelize.query(itemsQuery, {
      replacements: { id },
      type: QueryTypes.SELECT
    });

    order.items = items;
    order.order_number = order.order_no;

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('获取采购单详情失败:', error);
    res.json({
      success: false,
      message: '获取采购单详情失败: ' + error.message
    });
  }
});

/**
 * 查询JIT母单及子单对应关系
 * POST /api/stock-orders/jit-relations
 * 功能已删除，待重新实现
 */
router.post('/jit-relations', async (req, res) => {
  res.json({
    success: false,
    message: '功能开发中：查询JIT母单子单关系'
  });
});

/**
 * 同步采购单
 * POST /api/stock-orders/sync
 * 请使用导航栏的"同步数据"按钮勾选"采购单"进行同步
 */
router.post('/sync', async (req, res) => {
  res.json({
    success: false,
    message: '请使用导航栏的"同步数据"按钮勾选"采购单"进行同步'
  });
});

/**
 * 批量获取SKC尺码
 * POST /api/stock-orders/batch-skc-size
 * 功能已删除，待重新实现
 */
router.post('/batch-skc-size', async (req, res) => {
  res.json({
    success: false,
    message: '功能开发中：批量获取SKC尺码'
  });
});

/**
 * 打印商品条码
 * POST /api/stock-orders/print-barcode
 * 调用SHEIN API获取条码PDF链接
 * 
 * 请求体:
 * {
 *   shopId: number,  // 店铺ID（必须）
 *   data: [          // 打印数据数组（必须）
 *     {
 *       orderNo: string,      // 采购单号（可选）
 *       supplierSku: string,  // 卖家SKU编码（与sheinSku二选一）
 *       sheinSku: string,     // SHEIN SKU编码（必须）
 *       printNumber: number   // 打印份数（必须，累计不超过2000）
 *     }
 *   ]
 * }
 */
router.post('/print-barcode', async (req, res) => {
  try {
    const { shopId, data } = req.body;

    // 调用功能模块
    const result = await printBarcode({ shopId, data });

    res.json(result);
  } catch (error) {
    console.error('打印条码失败:', error);
    res.json({
      success: false,
      message: '打印条码失败: ' + error.message
    });
  }
});

module.exports = router;
