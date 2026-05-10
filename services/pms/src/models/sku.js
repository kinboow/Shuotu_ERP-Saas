/**
 * SKU模型
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Sku = sequelize.define('Sku', {
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
    skuId: {
      type: DataTypes.STRING(32),
      unique: true,
      allowNull: false,
      field: 'sku_id'
    },
    productId: {
      type: DataTypes.STRING(32),
      allowNull: false,
      field: 'product_id'
    },
    // SKU编码
    skuCode: {
      type: DataTypes.STRING(100),
      field: 'sku_code'
    },
    barcode: {
      type: DataTypes.STRING(100)
    },
    supplierSkuCode: {
      type: DataTypes.STRING(100),
      field: 'supplier_sku_code'
    },
    // 规格属性
    attributes: {
      type: DataTypes.JSON
    },
    color: {
      type: DataTypes.STRING(50)
    },
    colorCode: {
      type: DataTypes.STRING(20),
      field: 'color_code'
    },
    size: {
      type: DataTypes.STRING(50)
    },
    sizeCode: {
      type: DataTypes.STRING(20),
      field: 'size_code'
    },
    // 价格
    currency: {
      type: DataTypes.STRING(10),
      defaultValue: 'USD'
    },
    costPrice: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      field: 'cost_price'
    },
    retailPrice: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      field: 'retail_price'
    },
    salePrice: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      field: 'sale_price'
    },
    // 物理属性
    weight: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    weightUnit: {
      type: DataTypes.STRING(10),
      defaultValue: 'g',
      field: 'weight_unit'
    },
    length: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    width: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    height: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    // 图片
    image: {
      type: DataTypes.STRING(500)
    },
    // 状态
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'ACTIVE'
    }
  }, {
    tableName: 'skus',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['enterprise_id'] },
      { fields: ['enterprise_id', 'product_id'] },
      { fields: ['product_id'] },
      { fields: ['sku_code'] },
      { fields: ['barcode'] },
      { fields: ['status'] }
    ]
  });

  return Sku;
};
