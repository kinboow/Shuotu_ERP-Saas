const express = require('express');
const router = express.Router();
const { sequelize } = require('../models');

// 获取发货台订单列表
router.get('/', async (req, res) => {
  try {
    const { order_number, platform, shop_id } = req.query;

    let query = `
      SELECT
        ss.id,
        ss.order_id,
        ss.added_at,
        po.order_no as order_number,
        po.order_type_name as order_type,
        po.warehouse_name,
        po.request_take_parcel_time as request_delivery_time,
        po.shop_id,
        po.raw_data,
        COALESCE(s.shop_name, CONCAT('店铺', po.shop_id)) as shop_name,
        'shein' as platform
      FROM shipping_station ss
      LEFT JOIN shein_full_purchase_orders po ON ss.order_id = po.id
      LEFT JOIN shein_full_shops s ON po.shop_id = s.id
      WHERE 1=1
    `;

    const params = [];

    if (order_number) {
      query += ` AND po.order_no LIKE :order_number`;
      params.push(`%${order_number}%`);
    }

    if (platform) {
      query += ` AND 'shein' = :platform`;
    }

    if (shop_id) {
      query += ` AND po.shop_id = :shop_id`;
    }

    query += ` ORDER BY ss.added_at DESC`;

    const rows = await sequelize.query(query, {
      replacements: { order_number: `%${order_number || ''}%`, platform, shop_id },
      type: sequelize.QueryTypes.SELECT
    });

    // 处理返回数据，从 raw_data 中提取需要的字段
    const processedRows = rows.map(row => {
      let rawData = {};
      try {
        rawData = typeof row.raw_data === 'string' ? JSON.parse(row.raw_data) : row.raw_data || {};
      } catch (e) {
        console.error('解析 raw_data 失败:', e);
      }

      // 从 orderExtends 中获取第一个商品的信息
      const firstItem = rawData.orderExtends?.[0] || {};

      return {
        id: row.id,
        order_id: row.order_id,
        order_number: row.order_number,
        order_type: row.order_type,
        skc: firstItem.skc || '-',
        product_code: firstItem.supplierCode || '-',
        stock_quantity: rawData.orderExtends?.reduce((sum, item) => sum + (item.orderQuantity || 0), 0) || 0,
        warehouse_group: row.warehouse_name,
        request_delivery_time: row.request_delivery_time,
        shop_id: row.shop_id,
        shop_name: row.shop_name || rawData.supplierName || '-',
        platform: row.platform,
        product_image: firstItem.imgPath || firstItem.skuImg || null,
        added_at: row.added_at
      };
    });

    res.json({
      success: true,
      data: processedRows
    });
  } catch (error) {
    console.error('获取发货台订单失败:', error);
    res.status(500).json({
      success: false,
      message: '获取发货台订单失败: ' + error.message
    });
  }
});

// 添加订单到发货台
router.post('/add', async (req, res) => {
  try {
    const { orderIds } = req.body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供要添加的订单ID'
      });
    }

    // 检查订单是否已存在于发货台
    const existing = await sequelize.query(
      `SELECT order_id FROM shipping_station WHERE order_id IN (:orderIds)`,
      {
        replacements: { orderIds },
        type: sequelize.QueryTypes.SELECT
      }
    );

    const existingIds = existing.map(row => row.order_id);
    const newOrderIds = orderIds.filter(id => !existingIds.includes(id));

    if (newOrderIds.length === 0) {
      return res.json({
        success: true,
        message: '所选订单已在发货台中',
        data: { added: 0, existing: existingIds.length }
      });
    }

    // 批量插入
    const values = newOrderIds.map(orderId => `(${orderId}, NOW())`).join(',');
    await sequelize.query(
      `INSERT INTO shipping_station (order_id, added_at) VALUES ${values}`
    );

    res.json({
      success: true,
      message: `成功添加 ${newOrderIds.length} 个订单到发货台`,
      data: {
        added: newOrderIds.length,
        existing: existingIds.length
      }
    });
  } catch (error) {
    console.error('添加订单到发货台失败:', error);
    res.status(500).json({
      success: false,
      message: '添加订单到发货台失败: ' + error.message
    });
  }
});

// 从发货台移除订单
router.post('/remove', async (req, res) => {
  try {
    const { orderIds } = req.body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供要移除的订单ID'
      });
    }

    await sequelize.query(
      `DELETE FROM shipping_station WHERE id IN (?)`,
      {
        replacements: [orderIds]
      }
    );

    res.json({
      success: true,
      message: '已从发货台移除'
    });
  } catch (error) {
    console.error('从发货台移除订单失败:', error);
    res.status(500).json({
      success: false,
      message: '从发货台移除订单失败: ' + error.message
    });
  }
});

// 清空发货台
router.post('/clear', async (req, res) => {
  try {
    await sequelize.query(`DELETE FROM shipping_station`);

    res.json({
      success: true,
      message: '发货台已清空'
    });
  } catch (error) {
    console.error('清空发货台失败:', error);
    res.status(500).json({
      success: false,
      message: '清空发货台失败: ' + error.message
    });
  }
});

module.exports = router;
