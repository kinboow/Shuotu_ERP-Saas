/**
 * 发货单模型
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Shipment = sequelize.define('Shipment', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    shipmentNo: {
      type: DataTypes.STRING(32),
      unique: true,
      allowNull: false,
      field: 'shipment_no'
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
    // 物流信息
    logisticsCompany: {
      type: DataTypes.STRING(100),
      field: 'logistics_company'
    },
    logisticsCompanyCode: {
      type: DataTypes.STRING(50),
      field: 'logistics_company_code'
    },
    trackingNo: {
      type: DataTypes.STRING(100),
      field: 'tracking_no'
    },
    // 状态
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'PENDING'
      // PENDING, SHIPPED, IN_TRANSIT, DELIVERED, EXCEPTION
    },
    // 时间
    shipTime: {
      type: DataTypes.DATE,
      field: 'ship_time'
    },
    deliverTime: {
      type: DataTypes.DATE,
      field: 'deliver_time'
    },
    // 包裹信息
    weight: {
      type: DataTypes.DECIMAL(10, 2)
    },
    length: {
      type: DataTypes.DECIMAL(10, 2)
    },
    width: {
      type: DataTypes.DECIMAL(10, 2)
    },
    height: {
      type: DataTypes.DECIMAL(10, 2)
    },
    // 平台同步状态
    platformSynced: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'platform_synced'
    },
    platformSyncTime: {
      type: DataTypes.DATE,
      field: 'platform_sync_time'
    },
    platformSyncError: {
      type: DataTypes.TEXT,
      field: 'platform_sync_error'
    },
    // 备注
    remark: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'shipments',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['order_id'] },
      { fields: ['internal_order_id'] },
      { fields: ['tracking_no'] },
      { fields: ['status'] }
    ]
  });

  return Shipment;
};
