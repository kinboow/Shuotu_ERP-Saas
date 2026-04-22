/**
 * 统一库存模型
 * 支持多仓库库存管理
 */

// 库存操作类型
const StockOperationType = {
  INBOUND: 'INBOUND',       // 入库
  OUTBOUND: 'OUTBOUND',     // 出库
  LOCK: 'LOCK',             // 锁定（下单）
  UNLOCK: 'UNLOCK',         // 解锁（取消）
  ADJUST: 'ADJUST',         // 盘点调整
  SYNC: 'SYNC',             // 平台同步
  TRANSFER: 'TRANSFER'      // 调拨
};

/**
 * 统一库存类
 */
class UnifiedInventory {
  constructor(data = {}) {
    // 标识
    this.id = data.id || null;
    this.skuId = data.skuId || '';
    this.warehouseId = data.warehouseId || 'DEFAULT';
    
    // 库存数量
    this.totalQty = parseInt(data.totalQty) || 0;
    this.availableQty = parseInt(data.availableQty) || 0;
    this.lockedQty = parseInt(data.lockedQty) || 0;
    this.inTransitQty = parseInt(data.inTransitQty) || 0;
    this.defectiveQty = parseInt(data.defectiveQty) || 0;
    
    // 预警设置
    this.safetyStock = parseInt(data.safetyStock) || 10;
    this.reorderPoint = parseInt(data.reorderPoint) || 20;
    this.maxStock = parseInt(data.maxStock) || 9999;
    
    // 平台分配
    this.platformAllocation = data.platformAllocation || [];
    
    // 版本号（乐观锁）
    this.version = parseInt(data.version) || 0;
    
    // 时间
    this.lastSyncAt = data.lastSyncAt ? new Date(data.lastSyncAt) : null;
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }
  
  /**
   * 检查库存是否充足
   */
  hasEnoughStock(quantity) {
    return this.availableQty >= quantity;
  }
  
  /**
   * 检查是否低于安全库存
   */
  isBelowSafetyStock() {
    return this.availableQty < this.safetyStock;
  }
  
  /**
   * 检查是否需要补货
   */
  needsReorder() {
    return this.availableQty <= this.reorderPoint;
  }
  
  /**
   * 锁定库存
   */
  lock(quantity) {
    if (!this.hasEnoughStock(quantity)) {
      throw new Error(`库存不足: 可用${this.availableQty}, 需要${quantity}`);
    }
    this.availableQty -= quantity;
    this.lockedQty += quantity;
    this.updatedAt = new Date();
  }
  
  /**
   * 解锁库存
   */
  unlock(quantity) {
    if (this.lockedQty < quantity) {
      throw new Error(`锁定库存不足: 锁定${this.lockedQty}, 需解锁${quantity}`);
    }
    this.lockedQty -= quantity;
    this.availableQty += quantity;
    this.updatedAt = new Date();
  }
  
  /**
   * 出库（从锁定库存扣减）
   */
  ship(quantity) {
    if (this.lockedQty < quantity) {
      throw new Error(`锁定库存不足: 锁定${this.lockedQty}, 需出库${quantity}`);
    }
    this.lockedQty -= quantity;
    this.totalQty -= quantity;
    this.updatedAt = new Date();
  }
  
  /**
   * 入库
   */
  receive(quantity) {
    this.totalQty += quantity;
    this.availableQty += quantity;
    this.updatedAt = new Date();
  }
  
  /**
   * 转换为数据库存储格式
   */
  toDatabase() {
    return {
      sku_id: this.skuId,
      warehouse_id: this.warehouseId,
      total_qty: this.totalQty,
      available_qty: this.availableQty,
      locked_qty: this.lockedQty,
      in_transit_qty: this.inTransitQty,
      defective_qty: this.defectiveQty,
      safety_stock: this.safetyStock,
      reorder_point: this.reorderPoint,
      max_stock: this.maxStock,
      platform_allocation: JSON.stringify(this.platformAllocation),
      version: this.version,
      last_sync_at: this.lastSyncAt,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }
  
  /**
   * 从数据库记录创建实例
   */
  static fromDatabase(row) {
    return new UnifiedInventory({
      id: row.id,
      skuId: row.sku_id,
      warehouseId: row.warehouse_id,
      totalQty: row.total_qty,
      availableQty: row.available_qty,
      lockedQty: row.locked_qty,
      inTransitQty: row.in_transit_qty,
      defectiveQty: row.defective_qty,
      safetyStock: row.safety_stock,
      reorderPoint: row.reorder_point,
      maxStock: row.max_stock,
      platformAllocation: row.platform_allocation ? JSON.parse(row.platform_allocation) : [],
      version: row.version,
      lastSyncAt: row.last_sync_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }
}

module.exports = UnifiedInventory;
module.exports.StockOperationType = StockOperationType;
