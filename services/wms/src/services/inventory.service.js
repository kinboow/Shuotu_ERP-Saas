/**
 * 库存服务
 */

const { Inventory, StockLog, Warehouse, sequelize } = require('../models');
const { Op } = require('sequelize');
const Redis = require('ioredis');
const { ensureTenantColumns, normalizeEnterpriseId, getCurrentEnterpriseId } = require('./tenant-context.service');

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
  resolveEnterpriseId(enterpriseId = undefined) {
    const explicitEnterpriseId = normalizeEnterpriseId(enterpriseId);
    if (explicitEnterpriseId !== null) {
      return explicitEnterpriseId;
    }

    const contextEnterpriseId = getCurrentEnterpriseId();
    return contextEnterpriseId === null ? 0 : contextEnterpriseId;
  }

  async ensureWarehouse(warehouseId = 'DEFAULT', enterpriseId, transaction) {
    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);
    const targetWarehouseId = warehouseId || 'DEFAULT';

    const warehouse = await Warehouse.findOne({
      where: { enterpriseId: scopedEnterpriseId, warehouseId: targetWarehouseId },
      transaction
    });

    if (warehouse) {
      return warehouse;
    }

    if (targetWarehouseId !== 'DEFAULT') {
      throw new Error('仓库不存在或不属于当前企业');
    }

    return Warehouse.create({
      enterpriseId: scopedEnterpriseId,
      warehouseId: 'DEFAULT',
      name: '默认仓库',
      code: 'WH001',
      isDefault: true,
      status: 'ACTIVE'
    }, { transaction });
  }

  async listWarehouses(enterpriseId = undefined) {
    await ensureTenantColumns();
    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);
    await this.ensureWarehouse('DEFAULT', scopedEnterpriseId);

    return Warehouse.findAll({
      where: { enterpriseId: scopedEnterpriseId },
      order: [['isDefault', 'DESC'], ['created_at', 'ASC']]
    });
  }

  /**
   * 获取分布式锁
   */
  async acquireLock(skuId, warehouseId, enterpriseId, ttl = 5000) {
    const lockKey = `stock:lock:${enterpriseId}:${skuId}:${warehouseId}`;
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
  async getInventory(skuId, warehouseId = 'DEFAULT', enterpriseId = undefined) {
    await ensureTenantColumns();
    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);
    await this.ensureWarehouse(warehouseId, scopedEnterpriseId);

    let inventory = await Inventory.findOne({
      where: { enterpriseId: scopedEnterpriseId, skuId, warehouseId },
      include: [{ model: Warehouse, as: 'warehouse', where: { enterpriseId: scopedEnterpriseId }, required: false }]
    });

    if (!inventory) {
      // 自动创建库存记录
      inventory = await Inventory.create({
        enterpriseId: scopedEnterpriseId,
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
  async getInventoryBatch(skuIds, warehouseId = 'DEFAULT', enterpriseId = undefined) {
    await ensureTenantColumns();
    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);
    await this.ensureWarehouse(warehouseId, scopedEnterpriseId);

    const inventories = await Inventory.findAll({
      where: {
        enterpriseId: scopedEnterpriseId,
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
    await ensureTenantColumns();
    const { warehouseId = 'DEFAULT', referenceNo, operatorId, operatorName, enterpriseId } = options;
    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);
    
    const lock = await this.acquireLock(skuId, warehouseId, scopedEnterpriseId);
    if (!lock) {
      throw new Error('获取库存锁失败，请重试');
    }

    const transaction = await sequelize.transaction();

    try {
      await this.ensureWarehouse(warehouseId, scopedEnterpriseId, transaction);

      const inventory = await Inventory.findOne({
        where: { enterpriseId: scopedEnterpriseId, skuId, warehouseId },
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
        enterpriseId: scopedEnterpriseId,
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
    await ensureTenantColumns();
    const { warehouseId = 'DEFAULT', referenceNo, operatorId, operatorName, enterpriseId } = options;
    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);

    const lock = await this.acquireLock(skuId, warehouseId, scopedEnterpriseId);
    if (!lock) {
      throw new Error('获取库存锁失败，请重试');
    }

    const transaction = await sequelize.transaction();

    try {
      await this.ensureWarehouse(warehouseId, scopedEnterpriseId, transaction);

      const inventory = await Inventory.findOne({
        where: { enterpriseId: scopedEnterpriseId, skuId, warehouseId },
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
        enterpriseId: scopedEnterpriseId,
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
    await ensureTenantColumns();
    const { warehouseId = 'DEFAULT', referenceNo, operatorId, operatorName, enterpriseId } = options;
    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);

    const transaction = await sequelize.transaction();

    try {
      await this.ensureWarehouse(warehouseId, scopedEnterpriseId, transaction);

      const inventory = await Inventory.findOne({
        where: { enterpriseId: scopedEnterpriseId, skuId, warehouseId },
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
        enterpriseId: scopedEnterpriseId,
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
    await ensureTenantColumns();
    const { warehouseId = 'DEFAULT', referenceNo, referenceType = 'PURCHASE', operatorId, operatorName, remark, enterpriseId } = options;
    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);

    const transaction = await sequelize.transaction();

    try {
      await this.ensureWarehouse(warehouseId, scopedEnterpriseId, transaction);

      let inventory = await Inventory.findOne({
        where: { enterpriseId: scopedEnterpriseId, skuId, warehouseId },
        lock: true,
        transaction
      });

      const beforeQty = inventory ? inventory.totalQty : 0;

      if (!inventory) {
        inventory = await Inventory.create({
          enterpriseId: scopedEnterpriseId,
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
        enterpriseId: scopedEnterpriseId,
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
    await ensureTenantColumns();
    const { warehouseId = 'DEFAULT', operatorId, operatorName, remark, enterpriseId } = options;
    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);

    const transaction = await sequelize.transaction();

    try {
      await this.ensureWarehouse(warehouseId, scopedEnterpriseId, transaction);

      let inventory = await Inventory.findOne({
        where: { enterpriseId: scopedEnterpriseId, skuId, warehouseId },
        lock: true,
        transaction
      });

      if (!inventory) {
        inventory = await Inventory.create({
          enterpriseId: scopedEnterpriseId,
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
          enterpriseId: scopedEnterpriseId,
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
  async queryInventory(params = {}, enterpriseId = undefined) {
    await ensureTenantColumns();
    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);
    const {
      warehouseId,
      warehouse_id,
      skuId,
      sku_code,
      status,
      belowSafety,
      keyword,
      page = 1,
      pageSize = 20
    } = params;

    const resolvedWarehouseId = warehouseId || warehouse_id;
    const resolvedSkuId = skuId || sku_code;
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const parsedPageSize = Math.max(parseInt(pageSize, 10) || 20, 1);

    const where = { enterpriseId: scopedEnterpriseId };
    const andConditions = [];

    if (resolvedWarehouseId) where.warehouseId = resolvedWarehouseId;
    if (resolvedSkuId) where.skuId = resolvedSkuId;
    if (belowSafety === 'true') {
      andConditions.push(sequelize.where(sequelize.col('available_qty'), Op.lt, sequelize.col('safety_stock')));
    }
    if (keyword) {
      where.skuId = { [Op.like]: `%${keyword}%` };
    }

    if (status === 'out') {
      where.availableQty = { [Op.lte]: 0 };
    } else if (status === 'low') {
      where.availableQty = { [Op.gt]: 0 };
      andConditions.push(sequelize.where(sequelize.col('available_qty'), Op.lte, sequelize.col('safety_stock')));
    } else if (status === 'normal') {
      andConditions.push(sequelize.where(sequelize.col('available_qty'), Op.gt, sequelize.col('safety_stock')));
      where.availableQty = { [Op.lt]: 50 };
    } else if (status === 'high') {
      where.availableQty = { [Op.gte]: 50 };
    }

    if (andConditions.length > 0) {
      where[Op.and] = andConditions;
    }

    const { count, rows } = await Inventory.findAndCountAll({
      where,
      include: [{ model: Warehouse, as: 'warehouse', where: { enterpriseId: scopedEnterpriseId }, required: false }],
      order: [['updated_at', 'DESC']],
      limit: parsedPageSize,
      offset: (parsedPage - 1) * parsedPageSize
    });

    const matchedRows = await Inventory.findAll({
      where,
      attributes: ['totalQty', 'availableQty', 'safetyStock']
    });

    const stats = matchedRows.reduce((accumulator, row) => {
      const totalQty = Number(row.totalQty || 0);
      const availableQty = Number(row.availableQty || 0);
      const safetyStock = Number(row.safetyStock || 0);

      accumulator.totalSku += 1;
      accumulator.totalQuantity += totalQty;
      if (availableQty <= 0) {
        accumulator.outOfStockCount += 1;
      } else if (availableQty <= safetyStock) {
        accumulator.lowStockCount += 1;
      }

      return accumulator;
    }, {
      totalSku: 0,
      totalQuantity: 0,
      lowStockCount: 0,
      outOfStockCount: 0
    });

    return {
      list: rows,
      total: count,
      page: parsedPage,
      pageSize: parsedPageSize,
      totalPages: Math.ceil(count / parsedPageSize),
      stats
    };
  }

  async queryStockLogs(params = {}, enterpriseId = undefined) {
    await ensureTenantColumns();
    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);
    const {
      skuId,
      warehouseId,
      operationType,
      referenceType,
      referenceNo,
      startTime,
      endTime,
      page = 1,
      pageSize = 20
    } = params;
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const parsedPageSize = Math.max(parseInt(pageSize, 10) || 20, 1);

    const where = { enterpriseId: scopedEnterpriseId };

    if (skuId) {
      where.skuId = { [Op.like]: `%${skuId}%` };
    }

    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    if (operationType) {
      where.operationType = operationType;
    }

    if (referenceType) {
      where.referenceType = referenceType;
    }

    if (referenceNo) {
      where.referenceNo = { [Op.like]: `%${referenceNo}%` };
    }

    if (startTime || endTime) {
      where.created_at = {};
      if (startTime) {
        where.created_at[Op.gte] = new Date(startTime);
      }
      if (endTime) {
        where.created_at[Op.lte] = new Date(endTime);
      }
    }

    const { count, rows } = await StockLog.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parsedPageSize,
      offset: (parsedPage - 1) * parsedPageSize
    });

    const totalQuantity = await StockLog.sum('quantity', { where });

    return {
      list: rows,
      total: count,
      page: parsedPage,
      pageSize: parsedPageSize,
      totalPages: Math.ceil(count / parsedPageSize),
      stats: {
        totalQuantity: totalQuantity || 0
      }
    };
  }

  async saveInventoryRecord(payload = {}, enterpriseId = undefined, inventoryId = null) {
    await ensureTenantColumns();
    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);
    const {
      skuId,
      warehouseId = 'DEFAULT',
      totalQty = 0,
      availableQty,
      lockedQty = 0,
      safetyStock = 10,
      reorderPoint,
      maxStock,
      remark,
      operatorId,
      operatorName
    } = payload;

    if (!skuId) {
      throw new Error('缺少skuId');
    }

    const nextTotalQty = Math.max(Number(totalQty) || 0, 0);
    const nextLockedQty = Math.max(Number(lockedQty) || 0, 0);
    const nextAvailableQty = availableQty === undefined
      ? Math.max(nextTotalQty - nextLockedQty, 0)
      : Math.max(Number(availableQty) || 0, 0);
    const nextSafetyStock = Math.max(Number(safetyStock) || 0, 0);

    if (nextAvailableQty + nextLockedQty > nextTotalQty) {
      throw new Error('可用库存与锁定库存之和不能大于总库存');
    }

    const transaction = await sequelize.transaction();

    try {
      await this.ensureWarehouse(warehouseId, scopedEnterpriseId, transaction);

      const where = inventoryId
        ? { id: inventoryId, enterpriseId: scopedEnterpriseId }
        : { enterpriseId: scopedEnterpriseId, skuId, warehouseId };

      let inventory = await Inventory.findOne({
        where,
        lock: true,
        transaction
      });

      const beforeQty = inventory ? Number(inventory.totalQty || 0) : 0;

      if (!inventory) {
        inventory = await Inventory.create({
          enterpriseId: scopedEnterpriseId,
          skuId,
          warehouseId,
          totalQty: nextTotalQty,
          availableQty: nextAvailableQty,
          lockedQty: nextLockedQty,
          safetyStock: nextSafetyStock,
          reorderPoint,
          maxStock
        }, { transaction });
      } else {
        await inventory.update({
          skuId,
          warehouseId,
          totalQty: nextTotalQty,
          availableQty: nextAvailableQty,
          lockedQty: nextLockedQty,
          safetyStock: nextSafetyStock,
          reorderPoint: reorderPoint ?? inventory.reorderPoint,
          maxStock: maxStock ?? inventory.maxStock,
          version: Number(inventory.version || 0) + 1
        }, { transaction });
      }

      if (beforeQty !== nextTotalQty) {
        await StockLog.create({
          enterpriseId: scopedEnterpriseId,
          skuId,
          warehouseId,
          operationType: OperationType.ADJUST,
          quantity: nextTotalQty - beforeQty,
          beforeQty,
          afterQty: nextTotalQty,
          referenceType: 'ADJUST',
          operatorId,
          operatorName,
          remark: remark || `库存记录维护: ${beforeQty} -> ${nextTotalQty}`
        }, { transaction });
      }

      await transaction.commit();

      return Inventory.findByPk(inventory.id, {
        include: [{ model: Warehouse, as: 'warehouse', where: { enterpriseId: scopedEnterpriseId }, required: false }]
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async deleteInventoryRecord(id, enterpriseId = undefined) {
    await ensureTenantColumns();
    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);
    const inventory = await Inventory.findOne({
      where: { id, enterpriseId: scopedEnterpriseId }
    });

    if (!inventory) {
      throw new Error('库存记录不存在');
    }

    if (Number(inventory.totalQty || 0) !== 0 || Number(inventory.lockedQty || 0) !== 0) {
      throw new Error('仅允许删除库存与锁定库存均为 0 的记录');
    }

    await inventory.destroy();
    return true;
  }

  /**
   * 获取库存预警列表
   */
  async getAlerts(warehouseId = null, enterpriseId = undefined) {
    await ensureTenantColumns();
    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);
    const where = {
      enterpriseId: scopedEnterpriseId,
      availableQty: { [Op.lt]: sequelize.col('safety_stock') }
    };
    if (warehouseId) where.warehouseId = warehouseId;

    return await Inventory.findAll({
      where,
      include: [{ model: Warehouse, as: 'warehouse', where: { enterpriseId: scopedEnterpriseId }, required: false }],
      order: [['available_qty', 'ASC']]
    });
  }

  /**
   * 获取库存日志
   */
  async getStockLogs(skuId, params = {}, enterpriseId = undefined) {
    await ensureTenantColumns();
    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);
    const { warehouseId, startTime, endTime, page = 1, pageSize = 20 } = params;

    const where = { enterpriseId: scopedEnterpriseId, skuId };
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
