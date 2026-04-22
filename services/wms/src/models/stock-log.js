/**
 * 库存变动日志模型
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const StockLog = sequelize.define('StockLog', {
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
      field: 'warehouse_id'
    },
    // 操作类型
    operationType: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'operation_type'
      // INBOUND, OUTBOUND, LOCK, UNLOCK, ADJUST, SYNC, TRANSFER
    },
    // 数量变化
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    // 变动前后数量
    beforeQty: {
      type: DataTypes.INTEGER,
      field: 'before_qty'
    },
    afterQty: {
      type: DataTypes.INTEGER,
      field: 'after_qty'
    },
    // 关联单据
    referenceType: {
      type: DataTypes.STRING(20),
      field: 'reference_type'
      // ORDER, PURCHASE, TRANSFER, ADJUST
    },
    referenceNo: {
      type: DataTypes.STRING(50),
      field: 'reference_no'
    },
    // 操作人
    operatorId: {
      type: DataTypes.STRING(32),
      field: 'operator_id'
    },
    operatorName: {
      type: DataTypes.STRING(50),
      field: 'operator_name'
    },
    // 备注
    remark: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'stock_logs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { fields: ['sku_id'] },
      { fields: ['warehouse_id'] },
      { fields: ['operation_type'] },
      { fields: ['reference_no'] },
      { fields: ['created_at'] }
    ]
  });

  return StockLog;
};
