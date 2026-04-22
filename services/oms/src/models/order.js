/**
 * 订单数据模型
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Order = sequelize.define('Order', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    internalOrderId: {
      type: DataTypes.STRING(32),
      unique: true,
      allowNull: false,
      field: 'internal_order_id'
    },
    // 平台信息
    platform: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    platformOrderId: {
      type: DataTypes.STRING(64),
      allowNull: false,
      field: 'platform_order_id'
    },
    shopId: {
      type: DataTypes.STRING(32),
      allowNull: false,
      field: 'shop_id'
    },
    // 状态
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'PENDING'
    },
    platformStatus: {
      type: DataTypes.STRING(50),
      field: 'platform_status'
    },
    // 时间
    orderTime: {
      type: DataTypes.DATE,
      field: 'order_time'
    },
    payTime: {
      type: DataTypes.DATE,
      field: 'pay_time'
    },
    shipTime: {
      type: DataTypes.DATE,
      field: 'ship_time'
    },
    deliverTime: {
      type: DataTypes.DATE,
      field: 'deliver_time'
    },
    // 金额
    currency: {
      type: DataTypes.STRING(10),
      defaultValue: 'USD'
    },
    totalAmount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
      field: 'total_amount'
    },
    productAmount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
      field: 'product_amount'
    },
    shippingFee: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      field: 'shipping_fee'
    },
    discount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    tax: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    // 收货信息
    receiverName: {
      type: DataTypes.STRING(100),
      field: 'receiver_name'
    },
    receiverPhone: {
      type: DataTypes.STRING(50),
      field: 'receiver_phone'
    },
    receiverEmail: {
      type: DataTypes.STRING(100),
      field: 'receiver_email'
    },
    country: {
      type: DataTypes.STRING(50)
    },
    countryCode: {
      type: DataTypes.STRING(10),
      field: 'country_code'
    },
    province: {
      type: DataTypes.STRING(100)
    },
    city: {
      type: DataTypes.STRING(100)
    },
    district: {
      type: DataTypes.STRING(100)
    },
    address: {
      type: DataTypes.TEXT
    },
    zipCode: {
      type: DataTypes.STRING(20),
      field: 'zip_code'
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
    shippingMethod: {
      type: DataTypes.STRING(50),
      field: 'shipping_method'
    },
    // 备注
    buyerNote: {
      type: DataTypes.TEXT,
      field: 'buyer_note'
    },
    sellerNote: {
      type: DataTypes.TEXT,
      field: 'seller_note'
    },
    // 元数据
    rawData: {
      type: DataTypes.JSON,
      field: 'raw_data'
    },
    syncedAt: {
      type: DataTypes.DATE,
      field: 'synced_at'
    }
  }, {
    tableName: 'orders',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['platform', 'platform_order_id'] },
      { fields: ['shop_id', 'status'] },
      { fields: ['order_time'] },
      { fields: ['status'] }
    ]
  });

  return Order;
};
