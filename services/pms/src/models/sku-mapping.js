/**
 * SKU平台映射模型
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SkuMapping = sequelize.define('SkuMapping', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    // 内部SKU
    internalSkuId: {
      type: DataTypes.STRING(32),
      allowNull: false,
      field: 'internal_sku_id'
    },
    // 平台信息
    platform: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    shopId: {
      type: DataTypes.STRING(32),
      allowNull: false,
      field: 'shop_id'
    },
    // 平台SKU信息
    platformSkuId: {
      type: DataTypes.STRING(64),
      allowNull: false,
      field: 'platform_sku_id'
    },
    platformProductId: {
      type: DataTypes.STRING(64),
      field: 'platform_product_id'
    },
    platformSkuCode: {
      type: DataTypes.STRING(100),
      field: 'platform_sku_code'
    },
    // 平台商品名称
    platformProductName: {
      type: DataTypes.STRING(500),
      field: 'platform_product_name'
    },
    // 状态
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'ACTIVE'
      // ACTIVE, INACTIVE, DELETED
    },
    // 最后同步时间
    lastSyncAt: {
      type: DataTypes.DATE,
      field: 'last_sync_at'
    }
  }, {
    tableName: 'sku_mappings',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { unique: true, fields: ['platform', 'shop_id', 'platform_sku_id'] },
      { fields: ['internal_sku_id'] },
      { fields: ['platform', 'shop_id'] }
    ]
  });

  return SkuMapping;
};
