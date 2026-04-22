/**
 * 同步引擎核心
 * 负责执行同步任务
 */

const adapterManager = require('../adapters');

class SyncEngine {
  constructor(options = {}) {
    this.options = options;
    this.running = false;
  }

  /**
   * 同步订单
   * @param {string} shopId - 店铺ID
   * @param {Object} params - 同步参数
   */
  async syncOrders(shopId, params = {}) {
    const adapter = adapterManager.get(shopId);
    const taskId = `order_${shopId}_${Date.now()}`;

    console.log(`[SyncEngine] 开始同步订单: ${shopId}`, params);

    const result = {
      taskId,
      shopId,
      platform: adapter.platform,
      type: 'orders',
      status: 'running',
      startTime: new Date(),
      endTime: null,
      total: 0,
      success: 0,
      failed: 0,
      newOrders: [],
      updatedOrders: [],
      errors: []
    };

    try {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await adapter.pullOrders({
          ...params,
          page,
          pageSize: params.pageSize || 50
        });

        result.total += response.list.length;

        for (const order of response.list) {
          try {
            // 这里应该保存到数据库，暂时只记录
            result.success++;
            result.newOrders.push(order.platformOrderId);
          } catch (error) {
            result.failed++;
            result.errors.push({
              orderId: order.platformOrderId,
              error: error.message
            });
          }
        }

        hasMore = response.hasMore;
        page++;

        // 防止无限循环
        if (page > 100) break;
      }

      result.status = 'completed';
    } catch (error) {
      result.status = 'failed';
      result.errors.push({ error: error.message });
      console.error(`[SyncEngine] 同步订单失败: ${shopId}`, error);
    }

    result.endTime = new Date();
    console.log(`[SyncEngine] 订单同步完成: ${shopId}`, {
      total: result.total,
      success: result.success,
      failed: result.failed
    });

    return result;
  }

  /**
   * 同步商品
   * @param {string} shopId - 店铺ID
   * @param {Object} params - 同步参数
   */
  async syncProducts(shopId, params = {}) {
    const adapter = adapterManager.get(shopId);
    const taskId = `product_${shopId}_${Date.now()}`;

    console.log(`[SyncEngine] 开始同步商品: ${shopId}`, params);

    const result = {
      taskId,
      shopId,
      platform: adapter.platform,
      type: 'products',
      status: 'running',
      startTime: new Date(),
      endTime: null,
      total: 0,
      success: 0,
      failed: 0,
      errors: []
    };

    try {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await adapter.pullProducts({
          ...params,
          page,
          pageSize: params.pageSize || 50
        });

        result.total += response.list.length;

        for (const product of response.list) {
          try {
            result.success++;
          } catch (error) {
            result.failed++;
            result.errors.push({
              productId: product.platformProductId,
              error: error.message
            });
          }
        }

        hasMore = response.hasMore;
        page++;

        if (page > 100) break;
      }

      result.status = 'completed';
    } catch (error) {
      result.status = 'failed';
      result.errors.push({ error: error.message });
      console.error(`[SyncEngine] 同步商品失败: ${shopId}`, error);
    }

    result.endTime = new Date();
    return result;
  }

  /**
   * 同步库存到平台
   * @param {string} shopId - 店铺ID
   * @param {Array} skuList - SKU列表
   */
  async syncInventory(shopId, skuList) {
    const adapter = adapterManager.get(shopId);

    console.log(`[SyncEngine] 开始同步库存: ${shopId}`, { count: skuList.length });

    try {
      const result = await adapter.syncInventory(skuList);
      console.log(`[SyncEngine] 库存同步完成: ${shopId}`);
      return { success: true, result };
    } catch (error) {
      console.error(`[SyncEngine] 库存同步失败: ${shopId}`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 订单发货
   * @param {string} shopId - 店铺ID
   * @param {string} orderId - 订单ID
   * @param {Object} logistics - 物流信息
   */
  async shipOrder(shopId, orderId, logistics) {
    const adapter = adapterManager.get(shopId);

    console.log(`[SyncEngine] 订单发货: ${shopId} - ${orderId}`);

    try {
      const result = await adapter.shipOrder(orderId, logistics);
      console.log(`[SyncEngine] 发货成功: ${orderId}`);
      return { success: true, result };
    } catch (error) {
      console.error(`[SyncEngine] 发货失败: ${orderId}`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取订单详情
   * @param {string} shopId - 店铺ID
   * @param {string} orderId - 订单ID
   */
  async getOrderDetail(shopId, orderId) {
    const adapter = adapterManager.get(shopId);
    return await adapter.getOrderDetail(orderId);
  }

  /**
   * 批量同步所有店铺订单
   * @param {Object} params - 同步参数
   */
  async syncAllOrders(params = {}) {
    const adapters = adapterManager.getAll();
    const results = [];

    for (const { shopId } of adapters) {
      try {
        const result = await this.syncOrders(shopId, params);
        results.push(result);
      } catch (error) {
        results.push({
          shopId,
          status: 'failed',
          error: error.message
        });
      }
    }

    return results;
  }
}

module.exports = SyncEngine;
