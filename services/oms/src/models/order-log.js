/**
 * 订单操作日志模型
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const OrderLog = sequelize.define('OrderLog', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    enterpriseId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
      field: 'enterprise_id'
    },
    orderId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'order_id'
    },
    internalOrderId: {
      type: DataTypes.STRING(32),
      allowNull: false,
      field: 'internal_order_id'
    },
    // 操作类型
    action: {
      type: DataTypes.STRING(50),
      allowNull: false
      // CREATE, STATUS_CHANGE, SHIP, CANCEL, UPDATE, SYNC
    },
    // 状态变更
    fromStatus: {
      type: DataTypes.STRING(20),
      field: 'from_status'
    },
    toStatus: {
      type: DataTypes.STRING(20),
      field: 'to_status'
    },
    // 操作详情
    detail: {
      type: DataTypes.JSON
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
    // 来源
    source: {
      type: DataTypes.STRING(20)
      // SYSTEM, USER, PLATFORM, SYNC
    },
    // IP地址
    ip: {
      type: DataTypes.STRING(50)
    }
  }, {
    tableName: 'order_logs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { fields: ['enterprise_id'] },
      { fields: ['enterprise_id', 'order_id'] },
      { fields: ['order_id'] },
      { fields: ['enterprise_id', 'internal_order_id'] },
      { fields: ['internal_order_id'] },
      { fields: ['action'] },
      { fields: ['created_at'] }
    ]
  });

  return OrderLog;
};
