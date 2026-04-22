const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * ERP产品主表 - 包含多平台刊登所需的核心必填参数
 */
const ErpProduct = sequelize.define('ErpProduct', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  // 基本信息
  product_code: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    comment: 'ERP产品编码'
  },
  product_name_cn: {
    type: DataTypes.STRING(500),
    comment: '商品名称(中文)'
  },
  product_name_en: {
    type: DataTypes.STRING(500),
    comment: '商品名称(英文)'
  },
  product_name_multi: {
    type: DataTypes.JSON,
    comment: '多语言商品名称 {"en":"xxx","zh":"xxx","de":"xxx"}'
  },
  product_desc: {
    type: DataTypes.TEXT,
    comment: '商品描述'
  },
  product_desc_multi: {
    type: DataTypes.JSON,
    comment: '多语言商品描述'
  },
  product_desc_html: {
    type: DataTypes.TEXT,
    comment: '商品描述HTML格式(TikTok)'
  },
  
  // 品牌信息
  brand: {
    type: DataTypes.STRING(200),
    comment: '品牌名称'
  },
  brand_id: {
    type: DataTypes.STRING(100),
    comment: '品牌ID(TikTok)'
  },
  brand_code: {
    type: DataTypes.STRING(100),
    comment: '品牌编码(SHEIN)'
  },
  
  // 分类信息
  category: {
    type: DataTypes.STRING(200),
    comment: '类目名称'
  },
  category_id: {
    type: DataTypes.STRING(100),
    comment: '末级类目ID'
  },
  category_path: {
    type: DataTypes.JSON,
    comment: '类目路径 [cat1Id, cat2Id, cat3Id]'
  },
  category_name: {
    type: DataTypes.STRING(500),
    comment: '类目名称路径'
  },
  
  // 仓库信息
  warehouse_id: {
    type: DataTypes.STRING(100),
    comment: '仓库ID'
  },
  warehouse_name: {
    type: DataTypes.STRING(200),
    comment: '仓库名称'
  },
  
  // 商品属性
  product_attributes: {
    type: DataTypes.JSON,
    comment: '商品属性列表'
  },
  
  // 主图
  main_images: {
    type: DataTypes.JSON,
    comment: '主图/轮播图URL列表'
  },
  
  // 包裹尺寸(产品级别)
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
    comment: '包裹长度(cm)'
  },
  package_width: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '包裹宽度(cm)'
  },
  package_height: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '包裹高度(cm)'
  },
  package_weight: {
    type: DataTypes.INTEGER,
    comment: '包裹重量(g)'
  },
  
  // 价格信息
  cost_price: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '成本价'
  },
  suggested_price: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '建议零售价'
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'CNY',
    comment: '币种'
  },
  
  // 商家编码
  supplier_code: {
    type: DataTypes.STRING(100),
    comment: '商家/供应商编码'
  },
  
  // 货源类型：1-自生产 2-厂家调货
  source_type: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    comment: '货源类型：1-自生产 2-厂家调货'
  },
  
  // 供应商/厂家ID（当source_type=2时使用）
  supplier_id: {
    type: DataTypes.INTEGER,
    comment: '供应商/厂家ID'
  },
  
  // 采购成本价（从厂家采购的价格）
  purchase_price: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '采购成本价'
  },
  
  // 生产成本价（自生产时的成本）
  production_cost: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '生产成本价'
  }
}, {
  tableName: 'erp_products',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = ErpProduct;
