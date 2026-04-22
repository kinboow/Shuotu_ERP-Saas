/**
 * 订单商品明细模型
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const OrderItem = sequelize.define('OrderItem', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
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
    // 平台信息
    platformItemId: {
      type: DataTypes.STRING(64),
      field: 'platform_item_id'
    },
    platformSkuId: {
      type: DataTypes.STRING(64),
      field: 'platform_sku_id'
    },
    platformProductId: {
      type: DataTypes.STRING(64),
      field: 'platform_product_id'
    },
    // 内部SKU映射
    internalSkuId: {
      type: DataTypes.STRING(32),
      field: 'internal_sku_id'
    },
    // 商品信息
    productName: {
      type: DataTypes.STRING(500),
      field: 'product_name'
    },
    productImage: {
      type: DataTypes.STRING(500),
      field: 'product_image'
    },
    quantity: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    totalPrice: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
      field: 'total_price'
    },
    // 规格属性
    attributes: {
      type: DataTypes.JSON
    },
    weight: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    barcode: {
      type: DataTypes.STRING(100)
    }
  }, {
    tableName: 'order_items',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['order_id'] },
      { fields: ['internal_order_id'] },
      { fields: ['platform_sku_id'] },
      { fields: ['internal_sku_id'] }
    ]
  });

  return OrderItem;
};
