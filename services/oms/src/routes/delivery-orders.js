/**
 * 发货单路由
 * 根据platform参数指向不同的数据表
 * shein -> shein_full_delivery_orders / shein_full_delivery_order_items
 * temu/tiktok -> 暂未开放
 */

const express = require('express');
const router = express.Router();
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

// 平台表配置
const platformTables = {
  shein: {
    orders: 'shein_full_delivery_orders',
    items: 'shein_full_delivery_order_items'
  },
  temu: null,   // 暂未开放
  tiktok: null  // 暂未开放
};

/**
 * 获取发货单列表
 * GET /api/delivery-orders
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      limit,
      shopId,
      deliveryCode,
      deliveryType,
      startTime,
      start_date,
      endTime,
      end_date,
      platform = 'shein'
    } = req.query;

    const platformKey = platform.toLowerCase();
    const tables = platformTables[platformKey];

    // 平台未开放
    if (!tables) {
      return res.json({
        success: true,
        data: [],
        total: 0,
        page: parseInt(page),
        pageSize: parseInt(pageSize || limit || 20),
        message: `${platform.toUpperCase()}平台发货单功能暂未开放`
      });
    }

    const offset = (parseInt(page) - 1) * parseInt(pageSize || limit || 20);
    const pageLimit = parseInt(pageSize || limit || 20);

    let whereClause = '1=1';
    const replacements = [];

    if (shopId) {
      whereClause += ' AND d.shop_id = ?';
      replacements.push(shopId);
    }
    if (deliveryCode) {
      whereClause += ' AND d.delivery_code LIKE ?';
      replacements.push(`%${deliveryCode}%`);
    }
    if (deliveryType) {
      whereClause += ' AND d.delivery_type = ?';
      replacements.push(deliveryType);
    }
    
    const startParam = startTime || start_date;
    if (startParam) {
      whereClause += ' AND d.add_time >= ?';
      replacements.push(startParam);
    }
    
    const endParam = endTime || end_date;
    if (endParam) {
      whereClause += ' AND d.add_time <= ?';
      replacements.push(endParam);
    }

    const [countResult] = await sequelize.query(`
      SELECT COUNT(*) as total FROM ${tables.orders} d WHERE ${whereClause}
    `, { replacements, type: QueryTypes.SELECT });

    const list = await sequelize.query(`
      SELECT d.*
      FROM ${tables.orders} d
      WHERE ${whereClause}
      ORDER BY d.add_time DESC
      LIMIT ? OFFSET ?
    `, { 
      replacements: [...replacements, pageLimit, offset], 
      type: QueryTypes.SELECT 
    });

    // 批量查询所有发货单的明细数据
    if (list.length > 0) {
      const deliveryIds = list.map(d => d.id);
      const allItems = await sequelize.query(`
        SELECT * FROM ${tables.items} WHERE delivery_id IN (${deliveryIds.join(',')})
      `, { type: QueryTypes.SELECT });

      // 按delivery_id分组
      const itemsByDeliveryId = {};
      allItems.forEach(item => {
        if (!itemsByDeliveryId[item.delivery_id]) {
          itemsByDeliveryId[item.delivery_id] = [];
        }
        itemsByDeliveryId[item.delivery_id].push(item);
      });

      // 将明细数据附加到每个发货单，并计算统计值
      list.forEach(delivery => {
        const items = itemsByDeliveryId[delivery.id] || [];
        delivery.items = items;
        delivery.total_sku_count = items.length;
        delivery.total_delivery_quantity = items.reduce((sum, item) => sum + (item.delivery_quantity || 0), 0);
      });
    }

    res.json({
      success: true,
      data: list,
      total: countResult.total,
      page: parseInt(page),
      pageSize: pageLimit
    });
  } catch (error) {
    console.error('[发货单列表] 错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 获取发货单统计
 * GET /api/delivery-orders/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const { platform = 'shein', shopId } = req.query;
    const platformKey = platform.toLowerCase();
    const tables = platformTables[platformKey];

    if (!tables) {
      return res.json({ 
        success: true, 
        data: { total: 0, express_count: 0, delivery_count: 0, pickup_count: 0 } 
      });
    }

    let whereClause = '1=1';
    const replacements = [];

    if (shopId) {
      whereClause += ' AND shop_id = ?';
      replacements.push(shopId);
    }

    const [stats] = await sequelize.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN delivery_type = 1 THEN 1 ELSE 0 END) as express_count,
        SUM(CASE WHEN delivery_type = 2 THEN 1 ELSE 0 END) as delivery_count,
        SUM(CASE WHEN delivery_type = 3 THEN 1 ELSE 0 END) as pickup_count
      FROM ${tables.orders}
      WHERE ${whereClause}
    `, { replacements, type: QueryTypes.SELECT });

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('[发货单统计] 错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 同步发货单（转发到sync-engine）
 * POST /api/delivery-orders/sync
 */
router.post('/sync', async (req, res) => {
  try {
    const axios = require('axios');
    const syncEngineUrl = process.env.SYNC_ENGINE_URL || 'http://localhost:5001';
    const response = await axios.post(`${syncEngineUrl}/api/shein-full/sync/delivery-orders`, req.body);
    res.json(response.data);
  } catch (error) {
    console.error('[同步发货单] 错误:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 获取发货单详情
 * GET /api/delivery-orders/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { platform = 'shein' } = req.query;
    
    console.log(`[发货单详情] 请求: id=${id}, platform=${platform}`);
    
    const platformKey = platform.toLowerCase();
    const tables = platformTables[platformKey];

    if (!tables) {
      return res.json({ success: false, message: `${platform.toUpperCase()}平台发货单功能暂未开放` });
    }

    const [delivery] = await sequelize.query(`
      SELECT d.* FROM ${tables.orders} d WHERE d.id = ?
    `, { replacements: [id], type: QueryTypes.SELECT });

    if (!delivery) {
      console.log(`[发货单详情] 发货单不存在: id=${id}`);
      return res.status(404).json({ success: false, message: '发货单不存在' });
    }

    const items = await sequelize.query(`
      SELECT * FROM ${tables.items} WHERE delivery_id = ?
    `, { replacements: [id], type: QueryTypes.SELECT });

    console.log(`[发货单详情] 查询结果: delivery_code=${delivery.delivery_code}, items数量=${items.length}`);

    res.json({
      success: true,
      data: {
        ...delivery,
        items
      }
    });
  } catch (error) {
    console.error('[发货单详情] 错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
