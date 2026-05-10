/**
 * 订单服务
 */

const { Order, OrderItem, OrderLog, Shipment, sequelize } = require('../models');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { getCurrentEnterpriseId, normalizeEnterpriseId } = require('./tenant-context.service');

// 订单状态流转规则
const StatusTransitions = {
  PENDING: ['PAID', 'CANCELLED'],
  PAID: ['PROCESSING', 'CANCELLED', 'REFUNDING'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['COMPLETED', 'REFUNDING'],
  COMPLETED: [],
  CANCELLED: [],
  REFUNDING: ['REFUNDED', 'PAID'],
  REFUNDED: []
};

class OrderService {
  resolveEnterpriseId(enterpriseId = undefined) {
    const explicitEnterpriseId = normalizeEnterpriseId(enterpriseId);
    if (explicitEnterpriseId !== null) {
      return explicitEnterpriseId;
    }

    const contextEnterpriseId = getCurrentEnterpriseId();
    return contextEnterpriseId === null ? 0 : contextEnterpriseId;
  }

  /**
   * 生成内部订单ID
   */
  generateOrderId() {
    const date = new Date();
    const prefix = `ORD${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}${random}`;
  }

  generateShipmentNo() {
    const date = new Date();
    const prefix = `SHP${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    return `${prefix}${uuidv4().replace(/-/g, '').substring(0, 10).toUpperCase()}`;
  }

  /**
   * 创建订单（从同步引擎接收）
   */
  async createOrder(unifiedOrder, source = 'SYNC', enterpriseId = undefined) {
    const transaction = await sequelize.transaction();
    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId ?? unifiedOrder?.enterpriseId ?? unifiedOrder?.enterprise_id);

    try {
      // 检查是否已存在
      const existing = await Order.findOne({
        where: {
          enterpriseId: scopedEnterpriseId,
          platform: unifiedOrder.platform,
          platformOrderId: unifiedOrder.platformOrderId
        },
        transaction
      });

      if (existing) {
        await transaction.rollback();
        return { created: false, order: existing, message: '订单已存在' };
      }

      // 生成内部订单ID
      const internalOrderId = this.generateOrderId();

      // 创建订单
      const order = await Order.create({
        enterpriseId: scopedEnterpriseId,
        internalOrderId,
        platform: unifiedOrder.platform,
        platformOrderId: unifiedOrder.platformOrderId,
        shopId: unifiedOrder.shopId,
        status: unifiedOrder.status || 'PENDING',
        platformStatus: unifiedOrder.platformStatus,
        orderTime: unifiedOrder.orderTime,
        payTime: unifiedOrder.payTime,
        shipTime: unifiedOrder.shipTime,
        deliverTime: unifiedOrder.deliverTime,
        currency: unifiedOrder.currency,
        totalAmount: unifiedOrder.totalAmount,
        productAmount: unifiedOrder.productAmount,
        shippingFee: unifiedOrder.shippingFee,
        discount: unifiedOrder.discount,
        tax: unifiedOrder.tax,
        receiverName: unifiedOrder.shipping?.name,
        receiverPhone: unifiedOrder.shipping?.phone,
        receiverEmail: unifiedOrder.shipping?.email,
        country: unifiedOrder.shipping?.country,
        countryCode: unifiedOrder.shipping?.countryCode,
        province: unifiedOrder.shipping?.province,
        city: unifiedOrder.shipping?.city,
        district: unifiedOrder.shipping?.district,
        address: unifiedOrder.shipping?.address,
        zipCode: unifiedOrder.shipping?.zipCode,
        logisticsCompany: unifiedOrder.logistics?.company,
        logisticsCompanyCode: unifiedOrder.logistics?.companyCode,
        trackingNo: unifiedOrder.logistics?.trackingNo,
        shippingMethod: unifiedOrder.logistics?.shippingMethod,
        buyerNote: unifiedOrder.buyerNote,
        sellerNote: unifiedOrder.sellerNote,
        rawData: unifiedOrder.rawData,
        syncedAt: new Date()
      }, { transaction });

      // 创建订单明细
      if (unifiedOrder.items && unifiedOrder.items.length > 0) {
        const items = unifiedOrder.items.map(item => ({
          enterpriseId: scopedEnterpriseId,
          orderId: order.id,
          internalOrderId,
          platformItemId: item.platformItemId,
          platformSkuId: item.platformSkuId,
          platformProductId: item.platformProductId,
          internalSkuId: item.internalSkuId,
          productName: item.productName,
          productImage: item.productImage,
          quantity: item.quantity,
          price: item.price,
          totalPrice: item.totalPrice,
          attributes: item.attributes,
          weight: item.weight,
          barcode: item.barcode
        }));

        await OrderItem.bulkCreate(items, { transaction });
      }

      // 记录日志
      await OrderLog.create({
        enterpriseId: scopedEnterpriseId,
        orderId: order.id,
        internalOrderId,
        action: 'CREATE',
        toStatus: order.status,
        detail: { platform: unifiedOrder.platform, platformOrderId: unifiedOrder.platformOrderId },
        source
      }, { transaction });

      await transaction.commit();

      return { created: true, order, message: '订单创建成功' };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * 更新订单状态
   */
  async updateStatus(internalOrderId, newStatus, options = {}) {
    const { operatorId, operatorName, source = 'USER', detail = {}, enterpriseId } = options;
    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);

    const order = await Order.findOne({ where: { internalOrderId, enterpriseId: scopedEnterpriseId } });
    if (!order) {
      throw new Error('订单不存在');
    }

    // 检查状态流转是否合法
    const allowedTransitions = StatusTransitions[order.status] || [];
    if (!allowedTransitions.includes(newStatus)) {
      throw new Error(`不允许从 ${order.status} 变更为 ${newStatus}`);
    }

    const oldStatus = order.status;

    // 更新状态
    await order.update({ status: newStatus });

    // 记录日志
    await OrderLog.create({
      enterpriseId: scopedEnterpriseId,
      orderId: order.id,
      internalOrderId,
      action: 'STATUS_CHANGE',
      fromStatus: oldStatus,
      toStatus: newStatus,
      detail,
      operatorId,
      operatorName,
      source
    });

    return order;
  }

  /**
   * 订单发货
   */
  async shipOrder(internalOrderId, logistics, options = {}) {
    const scopedEnterpriseId = this.resolveEnterpriseId(options.enterpriseId);
    const order = await Order.findOne({ where: { internalOrderId, enterpriseId: scopedEnterpriseId } });
    if (!order) {
      throw new Error('订单不存在');
    }

    if (!['PAID', 'PROCESSING'].includes(order.status)) {
      throw new Error(`当前状态 ${order.status} 不允许发货`);
    }

    const transaction = await sequelize.transaction();

    try {
      const oldStatus = order.status;
      const shipTime = new Date();

      // 更新订单
      await order.update({
        status: 'SHIPPED',
        logisticsCompany: logistics.company,
        logisticsCompanyCode: logistics.companyCode,
        trackingNo: logistics.trackingNo,
        shipTime
      }, { transaction });

      await Shipment.create({
        enterpriseId: scopedEnterpriseId,
        shipmentNo: this.generateShipmentNo(),
        orderId: order.id,
        internalOrderId,
        logisticsCompany: logistics.company,
        logisticsCompanyCode: logistics.companyCode,
        trackingNo: logistics.trackingNo,
        status: 'SHIPPED',
        shipTime
      }, { transaction });

      // 记录日志
      await OrderLog.create({
        enterpriseId: scopedEnterpriseId,
        orderId: order.id,
        internalOrderId,
        action: 'SHIP',
        fromStatus: oldStatus,
        toStatus: 'SHIPPED',
        detail: logistics,
        operatorId: options.operatorId,
        operatorName: options.operatorName,
        source: options.source || 'USER'
      }, { transaction });

      await transaction.commit();

      return order;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * 获取订单详情
   */
  async getOrderDetail(internalOrderId, enterpriseId = undefined) {
    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);
    const order = await Order.findOne({
      where: { internalOrderId, enterpriseId: scopedEnterpriseId },
      include: [
        { model: OrderItem, as: 'items' },
        { model: Shipment, as: 'shipments' },
        { model: OrderLog, as: 'logs', limit: 20, order: [['created_at', 'DESC']] }
      ]
    });

    if (!order) {
      throw new Error('订单不存在');
    }

    return order;
  }

  /**
   * 查询订单列表
   */
  async queryOrders(params = {}, enterpriseId = undefined) {
    const {
      platform,
      shopId,
      status,
      startTime,
      endTime,
      keyword,
      page = 1,
      pageSize = 20
    } = params;

    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId ?? params.enterpriseId ?? params.enterprise_id);
    const where = { enterpriseId: scopedEnterpriseId };

    if (platform) where.platform = platform;
    if (shopId) where.shopId = shopId;
    if (status) where.status = status;

    if (startTime || endTime) {
      where.orderTime = {};
      if (startTime) where.orderTime[Op.gte] = new Date(startTime);
      if (endTime) where.orderTime[Op.lte] = new Date(endTime);
    }

    if (keyword) {
      where[Op.or] = [
        { internalOrderId: { [Op.like]: `%${keyword}%` } },
        { platformOrderId: { [Op.like]: `%${keyword}%` } },
        { receiverName: { [Op.like]: `%${keyword}%` } },
        { trackingNo: { [Op.like]: `%${keyword}%` } }
      ];
    }

    const { count, rows } = await Order.findAndCountAll({
      where,
      include: [{ model: OrderItem, as: 'items' }],
      order: [['order_time', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    return {
      list: rows,
      total: count,
      page,
      pageSize,
      totalPages: Math.ceil(count / pageSize)
    };
  }

  /**
   * 订单统计
   */
  async getStatistics(params = {}, enterpriseId = undefined) {
    const { platform, shopId, startTime, endTime } = params;

    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId ?? params.enterpriseId ?? params.enterprise_id);
    const where = { enterpriseId: scopedEnterpriseId };
    if (platform) where.platform = platform;
    if (shopId) where.shopId = shopId;
    if (startTime) where.orderTime = { [Op.gte]: new Date(startTime) };
    if (endTime) where.orderTime = { ...where.orderTime, [Op.lte]: new Date(endTime) };

    // 按状态统计
    const statusStats = await Order.findAll({
      where,
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['status'],
      raw: true
    });

    // 按平台统计
    const platformStats = await Order.findAll({
      where,
      attributes: ['platform', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['platform'],
      raw: true
    });

    // 总金额
    const totalAmount = await Order.sum('totalAmount', { where });

    return {
      byStatus: statusStats,
      byPlatform: platformStats,
      totalAmount: totalAmount || 0,
      totalOrders: statusStats.reduce((sum, s) => sum + parseInt(s.count), 0)
    };
  }

  /**
   * 批量更新订单（从同步引擎）
   */
  async batchUpsert(orders, source = 'SYNC', enterpriseId = undefined) {
    const results = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: []
    };

    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);

    for (const order of orders) {
      try {
        const result = await this.createOrder(order, source, scopedEnterpriseId);
        if (result.created) {
          results.created++;
        } else {
          // 已存在，尝试更新状态
          if (order.status && result.order.status !== order.status) {
            try {
              await this.updateStatus(result.order.internalOrderId, order.status, { source, enterpriseId: scopedEnterpriseId });
              results.updated++;
            } catch (e) {
              // 状态流转不合法，忽略
            }
          }
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          platformOrderId: order.platformOrderId,
          error: error.message
        });
      }
    }

    return results;
  }
}

module.exports = new OrderService();
