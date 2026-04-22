/**
 * SHEIN采购单明细模型
 * 对应API返回的orderExtends数组
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SheinPurchaseOrderItem = sequelize.define('SheinPurchaseOrderItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  // 关联采购单
  purchase_order_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '采购单ID'
  },
  order_no: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '采购单号'
  },
  // SKC/SKU信息
  skc: {
    type: DataTypes.STRING(50),
    comment: 'SHEIN SKC'
  },
  sku_code: {
    type: DataTypes.STRING(50),
    comment: 'SHEIN SKU'
  },
  supplier_code: {
    type: DataTypes.STRING(100),
    comment: '供应商货号（SKC维度）'
  },
  supplier_sku: {
    type: DataTypes.STRING(100),
    comment: '供应商SKU'
  },
  // 属性信息
  suffix_zh: {
    type: DataTypes.STRING(200),
    comment: '属性集（如Blue-L）'
  },
  // 价格
  price: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '结算价格'
  },
  currency_name: {
    type: DataTypes.STRING(50),
    comment: '币种名称'
  },
  // 数量信息
  need_quantity: {
    type: DataTypes.INTEGER,
    comment: '需求数量'
  },
  order_quantity: {
    type: DataTypes.INTEGER,
    comment: '下单数量'
  },
  delivery_quantity: {
    type: DataTypes.INTEGER,
    comment: '送货数量'
  },
  receipt_quantity: {
    type: DataTypes.INTEGER,
    comment: '收货数量'
  },
  storage_quantity: {
    type: DataTypes.INTEGER,
    comment: '入仓数量'
  },
  defective_quantity: {
    type: DataTypes.INTEGER,
    comment: '次品数量'
  },
  // JIT相关数量
  request_delivery_quantity: {
    type: DataTypes.STRING(50),
    comment: 'JIT母单中已下子备货单数量'
  },
  no_request_delivery_quantity: {
    type: DataTypes.STRING(50),
    comment: 'JIT母单中未下子备货单数量'
  },
  already_delivery_quantity: {
    type: DataTypes.STRING(50),
    comment: 'JIT母单中子备货单的总已发货单数量'
  },
  // 图片
  img_path: {
    type: DataTypes.STRING(500),
    comment: 'SKC图片'
  },
  sku_img: {
    type: DataTypes.STRING(500),
    comment: 'SKU图片'
  },
  // 备注
  remark: {
    type: DataTypes.TEXT,
    comment: '备注'
  }
}, {
  tableName: 'shein_purchase_order_details',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['purchase_order_id'] },
    { fields: ['order_no'] },
    { fields: ['skc'] },
    { fields: ['sku_code'] },
    { fields: ['supplier_code'] }
  ]
});

module.exports = SheinPurchaseOrderItem;
