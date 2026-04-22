const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * ERP产品SKU表 - 包含多平台刊登所需的SKU级别必填参数
 */
const ErpProductSku = sequelize.define('ErpProductSku', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  erp_product_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'ERP产品ID(SPU)'
  },
  erp_skc_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'ERP SKC ID'
  },
  
  // SKU编码
  sku_code: {
    type: DataTypes.STRING(200),
    allowNull: false,
    unique: true,
    comment: 'SKU编码'
  },
  supplier_sku: {
    type: DataTypes.STRING(200),
    comment: '商家SKU编码(SHEIN)'
  },
  ext_code: {
    type: DataTypes.STRING(200),
    comment: '外部编码(TEMU)'
  },
  seller_sku: {
    type: DataTypes.STRING(200),
    comment: '卖家SKU(TikTok)'
  },
  
  // 销售属性
  color: {
    type: DataTypes.STRING(100),
    comment: '颜色'
  },
  size: {
    type: DataTypes.STRING(100),
    comment: '尺码'
  },
  spec_1: {
    type: DataTypes.STRING(100),
    comment: '规格1'
  },
  spec_2: {
    type: DataTypes.STRING(100),
    comment: '规格2'
  },
  sale_attributes: {
    type: DataTypes.JSON,
    comment: '销售属性 [{"attr_id":"xxx","value_id":"xxx","value":"xxx"}]'
  },
  
  // SKU图片
  sku_image: {
    type: DataTypes.STRING(500),
    comment: 'SKU图片URL'
  },
  color_image: {
    type: DataTypes.STRING(500),
    comment: '颜色图片URL'
  },
  
  // 库存
  stock_quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '库存数量'
  },
  
  // 价格
  cost_price: {
    type: DataTypes.DECIMAL(10, 2),
    comment: 'SKU成本价'
  },
  sale_price: {
    type: DataTypes.DECIMAL(10, 2),
    comment: 'SKU销售价'
  },
  supply_price: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '供货价'
  },
  suggested_retail_price: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '建议零售价'
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'CNY',
    comment: '币种'
  },
  
  // 重量尺寸
  weight: {
    type: DataTypes.INTEGER,
    comment: '重量(g)'
  },
  length: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '长度(cm)'
  },
  width: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '宽度(cm)'
  },
  height: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '高度(cm)'
  },
  package_length: {
    type: DataTypes.DECIMAL(10, 2),
    comment: 'SKU包裹长度(cm)'
  },
  package_width: {
    type: DataTypes.DECIMAL(10, 2),
    comment: 'SKU包裹宽度(cm)'
  },
  package_height: {
    type: DataTypes.DECIMAL(10, 2),
    comment: 'SKU包裹高度(cm)'
  },
  package_weight: {
    type: DataTypes.INTEGER,
    comment: 'SKU包裹重量(g)'
  },
  
  // 条码
  barcode: {
    type: DataTypes.STRING(100),
    comment: '商品条码'
  },
  upc: {
    type: DataTypes.STRING(100),
    comment: 'UPC码'
  },
  ean: {
    type: DataTypes.STRING(100),
    comment: 'EAN码'
  }
}, {
  tableName: 'erp_product_skus',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = ErpProductSku;
