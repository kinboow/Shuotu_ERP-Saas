/**
 * 库存模型
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Inventory = sequelize.define('Inventory', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    skuId: {
      type: DataTypes.STRING(32),
      allowNull: false,
      field: 'sku_id'
    },
    warehouseId: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'DEFAULT',
      field: 'warehouse_id'
    },
    // 库存数量
    totalQty: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'total_qty'
    },
    availableQty: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'available_qty'
    },
    lockedQty: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'locked_qty'
    },
    inTransitQty: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'in_transit_qty'
    },
    defectiveQty: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'defective_qty'
    },
    // 预警设置
    safetyStock: {
      type: DataTypes.INTEGER,
      defaultValue: 10,
      field: 'safety_stock'
    },
    reorderPoint: {
      type: DataTypes.INTEGER,
      defaultValue: 20,
      field: 'reorder_point'
    },
    maxStock: {
      type: DataTypes.INTEGER,
      defaultValue: 9999,
      field: 'max_stock'
    },
    // 平台分配
    platformAllocation: {
      type: DataTypes.JSON,
      field: 'platform_allocation'
    },
    // 版本号（乐观锁）
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    // 最后同步时间
    lastSyncAt: {
      type: DataTypes.DATE,
      field: 'last_sync_at'
    }
  }, {
    tableName: 'inventory',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { unique: true, fields: ['sku_id', 'warehouse_id'] },
      { fields: ['available_qty'] },
      { fields: ['warehouse_id'] }
    ]
  });

  return Inventory;
};
