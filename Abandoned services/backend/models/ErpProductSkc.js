const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * ERP产品SKC表 - SKC级别（颜色/款式变体）
 * 层级结构: SPU(ErpProduct) -> SKC(ErpProductSkc) -> SKU(ErpProductSku)
 */
const ErpProductSkc = sequelize.define('ErpProductSkc', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  erp_product_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '关联的SPU ID'
  },
  
  // SKC编码
  skc_code: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: 'SKC编码'
  },
  supplier_skc: {
    type: DataTypes.STRING(200),
    comment: '供应商SKC编码'
  },
  
  // SKC名称
  skc_name_cn: {
    type: DataTypes.STRING(500),
    comment: 'SKC名称(中文)'
  },
  skc_name_en: {
    type: DataTypes.STRING(500),
    comment: 'SKC名称(英文)'
  },
  
  // 颜色属性（SKC级别的主要区分属性）
  color: {
    type: DataTypes.STRING(100),
    comment: '颜色名称'
  },
  color_code: {
    type: DataTypes.STRING(50),
    comment: '颜色编码'
  },
  color_attribute_id: {
    type: DataTypes.STRING(100),
    comment: '颜色属性ID'
  },
  color_attribute_value_id: {
    type: DataTypes.STRING(100),
    comment: '颜色属性值ID'
  },
  
  // SKC图片
  main_image: {
    type: DataTypes.TEXT,
    comment: 'SKC主图URL'
  },
  images: {
    type: DataTypes.JSON,
    comment: 'SKC图片列表'
  },
  detail_images: {
    type: DataTypes.JSON,
    comment: '详情图列表'
  },
  
  // SKC属性
  skc_attributes: {
    type: DataTypes.JSON,
    comment: 'SKC级别属性'
  }
}, {
  tableName: 'erp_product_skcs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['erp_product_id']
    },
    {
      unique: true,
      fields: ['erp_product_id', 'skc_code']
    }
  ]
});

module.exports = ErpProductSkc;
