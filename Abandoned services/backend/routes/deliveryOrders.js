/**
 * 发货单管理路由
 * 支持SHEIN全托管、SHEIN自营、SHEIN POP平台
 */

const express = require('express');
const router = express.Router();
const sequelize = require('../config/database');
const { QueryTypes } = require('sequelize');
const { syncDeliveryNotes } = require('../api_comprehensive/SHEIN全托管_SHEIN自营_SHEINPOP_订单_同步发货单');

/**
 * 获取发货单列表（重定向到新API端点）
 * GET /api/delivery-orders
 * 已迁移到 GET /api/delivery-orders/shein
 */
router.get('/', async (req, res) => {
  res.json({
    success: false,
    message: '此端点已废弃，请使用 GET /api/delivery-orders/shein'
  });
});

/**
 * 同步发货单
 * POST /api/delivery-orders/sync
 * @param {number} shopId - 店铺ID（必须）
 * @param {string} [deliveryCode] - 发货单号（可选，每次最多1个）
 */
router.post('/sync', async (req, res) => {
  try {
    const { shopId, deliveryCode } = req.body;
    
    if (!shopId) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数: shopId'
      });
    }
    
    console.log(`[发货单路由] 开始同步，店铺ID: ${shopId}, 发货单号: ${deliveryCode || '全量同步'}`);
    
    const result = await syncDeliveryNotes({ shopId, deliveryCode });
    
    res.json({
      success: result.success,
      message: result.message,
      data: {
        syncedCount: result.syncedCount,
        createdCount: result.createdCount,
        updatedCount: result.updatedCount,
        errors: result.errors
      }
    });
  } catch (error) {
    console.error('[发货单路由] 同步失败:', error);
    res.status(500).json({
      success: false,
      message: '同步失败: ' + error.message
    });
  }
});

/**
 * 获取发货单列表（根据平台选择不同数据表）
 * GET /api/delivery-orders/shein
 * platform_id: 1=SHEIN, 5=TEMU, 6=TIKTOK
 */
router.get('/shein', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      shopId,
      platform_id = '1', // 默认SHEIN
      delivery_code = '', 
      express_code = '',
      start_date = '', 
      end_date = '' 
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
        message: `${platformName}平台发货单功能暂未开放`
      });
    }

    // SHEIN平台 - 使用 shein_delivery_notes 表
    let whereClause = '';
    const params = {};

    if (shopId) {
      whereClause += ' AND dn.shop_id = :shopId';
      params.shopId = parseInt(shopId);
    }

    if (delivery_code) {
      whereClause += ' AND dn.delivery_code LIKE :delivery_code';
      params.delivery_code = `%${delivery_code}%`;
    }

    if (express_code) {
      whereClause += ' AND dn.express_code LIKE :express_code';
      params.express_code = `%${express_code}%`;
    }

    if (start_date) {
      whereClause += ' AND dn.add_time >= :start_date';
      params.start_date = start_date;
    }

    if (end_date) {
      whereClause += ' AND dn.add_time <= :end_date';
      params.end_date = end_date + ' 23:59:59';
    }

    // 统计总数
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM shein_delivery_notes dn
      WHERE 1=1 ${whereClause}
    `;
    const countResult = await sequelize.query(countQuery, {
      replacements: params,
      type: QueryTypes.SELECT
    });

    // 获取发货单列表
    const orderQuery = `
      SELECT 
        dn.*,
        ps.shop_name,
        ps.platform_name,
        pc.platform_display_name
      FROM shein_delivery_notes dn
      LEFT JOIN PlatformShops ps ON dn.shop_id = ps.id
      LEFT JOIN PlatformConfigs pc ON ps.platform_id = pc.id
      WHERE 1=1 ${whereClause}
      ORDER BY dn.add_time DESC
      LIMIT :limit OFFSET :offset
    `;

    const orders = await sequelize.query(orderQuery, {
      replacements: { ...params, limit: parseInt(limit), offset },
      type: QueryTypes.SELECT
    });

    // 获取每个发货单的明细
    if (orders.length > 0) {
      const noteIds = orders.map(o => o.id);
      
      const itemsQuery = `
        SELECT *
        FROM shein_delivery_note_items
        WHERE delivery_note_id IN (:noteIds)
        ORDER BY delivery_note_id, id
      `;
      
      const allItems = await sequelize.query(itemsQuery, {
        replacements: { noteIds },
        type: QueryTypes.SELECT
      });

      // 将明细按发货单ID分组
      const itemsByNoteId = {};
      allItems.forEach(item => {
        if (!itemsByNoteId[item.delivery_note_id]) {
          itemsByNoteId[item.delivery_note_id] = [];
        }
        itemsByNoteId[item.delivery_note_id].push(item);
      });

      // 将明细列表附加到每个发货单
      orders.forEach(order => {
        order.items = itemsByNoteId[order.id] || [];
      });
    }

    res.json({
      success: true,
      data: orders,
      total: countResult[0].total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('获取SHEIN发货单失败:', error);
    res.json({
      success: false,
      message: '获取发货单失败: ' + error.message
    });
  }
});

/**
 * 获取发货单详情
 * GET /api/delivery-orders/shein/:id
 */
router.get('/shein/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const orderQuery = `
      SELECT 
        dn.*,
        ps.shop_name,
        ps.platform_name,
        pc.platform_display_name
      FROM shein_delivery_notes dn
      LEFT JOIN PlatformShops ps ON dn.shop_id = ps.id
      LEFT JOIN PlatformConfigs pc ON ps.platform_id = pc.id
      WHERE dn.id = :id
    `;
    
    const orders = await sequelize.query(orderQuery, {
      replacements: { id },
      type: QueryTypes.SELECT
    });
    
    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: '发货单不存在'
      });
    }
    
    const order = orders[0];
    
    // 获取明细
    const itemsQuery = `
      SELECT * FROM shein_delivery_note_items
      WHERE delivery_note_id = :id
      ORDER BY id
    `;
    
    order.items = await sequelize.query(itemsQuery, {
      replacements: { id },
      type: QueryTypes.SELECT
    });
    
    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('获取发货单详情失败:', error);
    res.json({
      success: false,
      message: '获取发货单详情失败: ' + error.message
    });
  }
});

/**
 * 获取同步日志
 * GET /api/delivery-orders/sync-logs
 */
router.get('/sync-logs', async (req, res) => {
  try {
    const { shopId, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = '';
    const params = {};
    
    if (shopId) {
      whereClause = ' WHERE shop_id = :shopId';
      params.shopId = parseInt(shopId);
    }
    
    const countQuery = `SELECT COUNT(*) as total FROM shein_delivery_note_sync_logs ${whereClause}`;
    const countResult = await sequelize.query(countQuery, {
      replacements: params,
      type: QueryTypes.SELECT
    });
    
    const logsQuery = `
      SELECT sl.*, ps.shop_name
      FROM shein_delivery_note_sync_logs sl
      LEFT JOIN PlatformShops ps ON sl.shop_id = ps.id
      ${whereClause}
      ORDER BY sl.created_at DESC
      LIMIT :limit OFFSET :offset
    `;
    
    const logs = await sequelize.query(logsQuery, {
      replacements: { ...params, limit: parseInt(limit), offset },
      type: QueryTypes.SELECT
    });
    
    res.json({
      success: true,
      data: logs,
      total: countResult[0].total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('获取同步日志失败:', error);
    res.json({
      success: false,
      message: '获取同步日志失败: ' + error.message
    });
  }
});

module.exports = router;
