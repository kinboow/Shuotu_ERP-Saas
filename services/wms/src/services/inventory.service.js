/**
 * 库存服务
 */

const { Inventory, StockLog, Warehouse, sequelize } = require('../models');
const { Op } = require('sequelize');
const Redis = require('ioredis');

// Redis客户端（用于分布式锁）
let redis = null;
const getRedis = () => {
  if (!redis) {
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined
    });
  }
  return redis;
};

// 操作类型
const OperationType = {
  INBOUND: 'INBOUND',
  OUTBOUND: 'OUTBOUND',
  LOCK: 'LOCK',
  UNLOCK: 'UNLOCK',
  ADJUST: 'ADJUST',
  SYNC: 'SYNC',
  TRANSFER: 'TRANSFER'
};

class InventoryService {
  /**
   * 获取分布式锁
   */
  async acquireLock(skuId, warehouseId, ttl = 5000) {
    const lockKey = `stock:lock:${skuId}:${warehouseId}`;
    const lockValue = Date.now().toString();
    
    const result = await getRedis().set(lockKey, lockValue, 'PX', ttl, 'NX');
    if (result === 'OK') {
      return { key: lockKey, value: lockValue };
    }
    return null;
  }

  /**
   * 释放分布式锁
   */
  async releaseLock(lock) {
    if (!lock) return;
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await getRedis().eval(script, 1, lock.key, lock.value);
  }

  /**
   * 获取库存
   */
  async getInventory(skuId, warehouseId = 'DEFAULT') {
    let inventory = await Inventory.findOne({
      where: { skuId, warehouseId },
      include: [{ model: Warehouse, as: 'warehouse' }]
    });

    if (!inventory) {
      // 自动创建库存记录
      inventory = await Inventory.create({
        skuId,
        warehouseId,
        totalQty: 0,
        availableQty: 0,
        lockedQty: 0
      });
    }

    return inventory;
  }

  /**
   * 批量获取库存
   */
  async getInventoryBatch(skuIds, warehouseId = 'DEFAULT') {
    const inventories = await Inventory.findAll({
      where: {
        skuId: { [Op.in]: skuIds },
        warehouseId
      }
    });

    // 转为Map方便查找
    const map = new Map();
    inventories.forEach(inv => map.set(inv.skuId, inv));

    return map;
  }

  /**
   * 锁定库存（下单时调用）
   */
  async lockStock(skuId, quantity, options = {}) {
    const { warehouseId = 'DEFAULT', referenceNo, operatorId, operatorName } = options;
    
    const lock = await this.acquireLock(skuId, warehouseId);
    if (!lock) {
      throw new Error('获取库存锁失败，请重试');
    }

    const transaction = await sequelize.transaction();

    try {
      const inventory = await Inventory.findOne({
        where: { skuId, warehouseId },
        lock: true,
        transaction
      });

      if (!inventory) {
        throw new Error(`SKU ${skuId} 库存记录不存在`);
      }

      if (inventory.availableQty < quantity) {
        throw new Error(`库存不足: 可用${inventory.availableQty}, 需要${quantity}`);
      }

      const beforeQty = inventory.availableQty;

      // 更新库存
      await inventory.update({
        availableQty: inventory.availableQty - quantity,
        lockedQty: inventory.lockedQty + quantity,
        version: inventory.version + 1
      }, { transaction });

      // 记录日志
      await StockLog.create({
        skuId,
        warehouseId,
        operationType: OperationType.LOCK,
        quantity: -quantity,
        beforeQty,
        afterQty: inventory.availableQty - quantity,
        referenceType: 'ORDER',
        referenceNo,
        operatorId,
        operatorName,
        remark: `订单锁定库存 ${quantity}`
      }, { transaction });

      await transaction.commit();
      await this.releaseLock(lock);

      return inventory;
    } catch (error) {
      await transaction.rollback();
      await this.releaseLock(lock);
      throw error;
    }
  }

  /**
   * 解锁库存（取消订单时调用）
   */
  async unlockStock(skuId, quantity, options = {}) {
    const { warehouseId = 'DEFAULT', referenceNo, operatorId, operatorName } = options;

    const lock = await this.acquireLock(skuId, warehouseId);
    if (!lock) {
      throw new Error('获取库存锁失败，请重试');
    }

    const transaction = await sequelize.transaction();

    try {
      const inventory = await Inventory.findOne({
        where: { skuId, warehouseId },
        lock: true,
        transaction
      });

      if (!inventory) {
        throw new Error(`SKU ${skuId} 库存记录不存在`);
      }

      if (inventory.lockedQty < quantity) {
        throw new Error(`锁定库存不足: 锁定${inventory.lockedQty}, 需解锁${quantity}`);
      }

      const beforeQty = inventory.availableQty;

      await inventory.update({
        availableQty: inventory.availableQty + quantity,
        lockedQty: inventory.lockedQty - quantity,
        version: inventory.version + 1
      }, { transaction });

      await StockLog.create({
        skuId,
        warehouseId,
        operationType: OperationType.UNLOCK,
        quantity,
        beforeQty,
        afterQty: inventory.availableQty + quantity,
        referenceType: 'ORDER',
        referenceNo,
        operatorId,
        operatorName,
        remark: `订单取消释放库存 ${quantity}`
      }, { transaction });

      await transaction.commit();
      await this.releaseLock(lock);

      return inventory;
    } catch (error) {
      await transaction.rollback();
      await this.releaseLock(lock);
      throw error;
    }
  }

  /**
   * 出库（发货时调用，从锁定库存扣减）
   */
  async outbound(skuId, quantity, options = {}) {
    const { warehouseId = 'DEFAULT', referenceNo, operatorId, operatorName } = options;

    const transaction = await sequelize.transaction();

    try {
      const inventory = await Inventory.findOne({
        where: { skuId, warehouseId },
        lock: true,
        transaction
      });

      if (!inventory) {
        throw new Error(`SKU ${skuId} 库存记录不存在`);
      }

      if (inventory.lockedQty < quantity) {
        throw new Error(`锁定库存不足: 锁定${inventory.lockedQty}, 需出库${quantity}`);
      }

      const beforeQty = inventory.totalQty;

      await inventory.update({
        totalQty: inventory.totalQty - quantity,
        lockedQty: inventory.lockedQty - quantity,
        version: inventory.version + 1
      }, { transaction });

      await StockLog.create({
        skuId,
        warehouseId,
        operationType: OperationType.OUTBOUND,
        quantity: -quantity,
        beforeQty,
        afterQty: inventory.totalQty - quantity,
        referenceType: 'ORDER',
        referenceNo,
        operatorId,
        operatorName,
        remark: `发货出库 ${quantity}`
      }, { transaction });

      await transaction.commit();
      return inventory;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * 入库
   */
  async inbound(skuId, quantity, options = {}) {
    const { warehouseId = 'DEFAULT', referenceNo, referenceType = 'PURCHASE', operatorId, operatorName, remark } = options;

    const transaction = await sequelize.transaction();

    try {
      let inventory = await Inventory.findOne({
        where: { skuId, warehouseId },
        lock: true,
        transaction
      });

      const beforeQty = inventory ? inventory.totalQty : 0;

      if (!inventory) {
        inventory = await Inventory.create({
          skuId,
          warehouseId,
          totalQty: quantity,
          availableQty: quantity,
          lockedQty: 0
        }, { transaction });
      } else {
        await inventory.update({
          totalQty: inventory.totalQty + quantity,
          availableQty: inventory.availableQty + quantity,
          version: inventory.version + 1
        }, { transaction });
      }

      await StockLog.create({
        skuId,
        warehouseId,
        operationType: OperationType.INBOUND,
        quantity,
        beforeQty,
        afterQty: beforeQty + quantity,
        referenceType,
        referenceNo,
        operatorId,
        operatorName,
        remark: remark || `入库 ${quantity}`
      }, { transaction });

      await transaction.commit();
      return inventory;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * 库存调整（盘点）
   */
  async adjust(skuId, newQty, options = {}) {
    const { warehouseId = 'DEFAULT', operatorId, operatorName, remark } = options;

    const transaction = await sequelize.transaction();

    try {
      let inventory = await Inventory.findOne({
        where: { skuId, warehouseId },
        lock: true,
        transaction
      });

      if (!inventory) {
        inventory = await Inventory.create({
          skuId,
          warehouseId,
          totalQty: newQty,
          availableQty: newQty,
          lockedQty: 0
        }, { transaction });
      } else {
        const diff = newQty - inventory.totalQty;
        const beforeQty = inventory.totalQty;

        await inventory.update({
          totalQty: newQty,
          availableQty: inventory.availableQty + diff,
          version: inventory.version + 1
        }, { transaction });

        await StockLog.create({
          skuId,
          warehouseId,
          operationType: OperationType.ADJUST,
          quantity: diff,
          beforeQty,
          afterQty: newQty,
          referenceType: 'ADJUST',
          operatorId,
          operatorName,
          remark: remark || `盘点调整: ${beforeQty} -> ${newQty}`
        }, { transaction });
      }

      await transaction.commit();
      return inventory;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * 查询库存列表
   */
  async queryInventory(params = {}) {
    const { warehouseId, skuId, belowSafety, keyword, page = 1, pageSize = 20 } = params;

    const where = {};
    if (warehouseId) where.warehouseId = warehouseId;
    if (skuId) where.skuId = skuId;
    if (belowSafety === 'true') {
      where.availableQty = { [Op.lt]: sequelize.col('safety_stock') };
    }
    if (keyword) {
      where.skuId = { [Op.like]: `%${keyword}%` };
    }

    const { count, rows } = await Inventory.findAndCountAll({
      where,
      include: [{ model: Warehouse, as: 'warehouse' }],
      order: [['updated_at', 'DESC']],
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
   * 获取库存预警列表
   */
  async getAlerts(warehouseId = null) {
    const where = {
      availableQty: { [Op.lt]: sequelize.col('safety_stock') }
    };
    if (warehouseId) where.warehouseId = warehouseId;

    return await Inventory.findAll({
      where,
      include: [{ model: Warehouse, as: 'warehouse' }],
      order: [['available_qty', 'ASC']]
    });
  }

  /**
   * 获取库存日志
   */
  async getStockLogs(skuId, params = {}) {
    const { warehouseId, startTime, endTime, page = 1, pageSize = 20 } = params;

    const where = { skuId };
    if (warehouseId) where.warehouseId = warehouseId;
    if (startTime || endTime) {
      where.created_at = {};
      if (startTime) where.created_at[Op.gte] = new Date(startTime);
      if (endTime) where.created_at[Op.lte] = new Date(endTime);
    }

    const { count, rows } = await StockLog.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    return { list: rows, total: count, page, pageSize };
  }
}

module.exports = new InventoryService();
module.exports.OperationType = OperationType;
