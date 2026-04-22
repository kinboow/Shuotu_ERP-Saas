/**
 * 商品模型
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Product = sequelize.define('Product', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    productId: {
      type: DataTypes.STRING(32),
      unique: true,
      allowNull: false,
      field: 'product_id'
    },
    // 基本信息
    productName: {
      type: DataTypes.STRING(500),
      field: 'product_name'
    },
    productNameEn: {
      type: DataTypes.STRING(500),
      field: 'product_name_en'
    },
    description: {
      type: DataTypes.TEXT
    },
    // 分类
    categoryId: {
      type: DataTypes.STRING(50),
      field: 'category_id'
    },
    categoryName: {
      type: DataTypes.STRING(200),
      field: 'category_name'
    },
    brand: {
      type: DataTypes.STRING(100)
    },
    // 供应商
    supplierId: {
      type: DataTypes.STRING(32),
      field: 'supplier_id'
    },
    supplierName: {
      type: DataTypes.STRING(100),
      field: 'supplier_name'
    },
    // 图片
    mainImage: {
      type: DataTypes.STRING(500),
      field: 'main_image'
    },
    images: {
      type: DataTypes.JSON
    },
    // 状态
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'ACTIVE'
      // ACTIVE, INACTIVE, DELETED
    },
    // 备注
    remark: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'products',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['category_id'] },
      { fields: ['supplier_id'] },
      { fields: ['status'] }
    ]
  });

  return Product;
};
