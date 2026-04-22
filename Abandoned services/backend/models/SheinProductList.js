/**
 * SHEIN商品列表模型
 * 用于存储从浏览器扩展抓取的商品数据
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SheinProductList = sequelize.define('SheinProductList', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  spu_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'SPU ID'
  },
  skc_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'SKC ID'
  },
  sku_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: 'SKU ID'
  },
  product_name: {
    type: DataTypes.STRING(500),
    comment: '商品名称'
  },
  product_code: {
    type: DataTypes.STRING(100),
    comment: '货号'
  },
  category: {
    type: DataTypes.STRING(200),
    comment: '类目'
  },
  product_image: {
    type: DataTypes.TEXT,
    comment: '商品图片URL'
  },
  attributes: {
    type: DataTypes.TEXT,
    comment: '商品属性（分号分隔）'
  },
  color: {
    type: DataTypes.STRING(100),
    comment: '颜色'
  },
  size: {
    type: DataTypes.STRING(100),
    comment: '尺码'
  },
  stock: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '库存数量'
  },
  volume: {
    type: DataTypes.STRING(100),
    comment: '体积（卖家测量）'
  },
  weight: {
    type: DataTypes.STRING(100),
    comment: '重量（卖家测量）'
  },
  platform_volume: {
    type: DataTypes.STRING(100),
    comment: '体积（平台测量）'
  },
  platform_weight: {
    type: DataTypes.STRING(100),
    comment: '重量（平台测量）'
  },
  sku_category: {
    type: DataTypes.STRING(50),
    comment: 'SKU分类：单品/套装'
  },
  item_count: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: '单品数量'
  },
  sku_code: {
    type: DataTypes.STRING(100),
    comment: 'SKU货号'
  },
  declared_price: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '申报价格(CNY)'
  },
  today_sales: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '今日销量'
  },
  today_total: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '今日合计'
  },
  week_sales: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '7天销量'
  },
  created_time: {
    type: DataTypes.DATE,
    comment: '商品创建时间'
  },
  captured_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '抓取时间'
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '更新时间'
  }
}, {
  tableName: 'SheinProductList',
  timestamps: false,
  indexes: [
    { fields: ['spu_id'] },
    { fields: ['skc_id'] },
    { fields: ['sku_id'] },
    { fields: ['product_code'] },
    { fields: ['captured_at'] }
  ]
});

module.exports = SheinProductList;
