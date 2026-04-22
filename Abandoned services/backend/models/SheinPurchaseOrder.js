/**
 * SHEIN采购单模型
 * 对应API: /open-api/order/purchase-order-infos
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SheinPurchaseOrder = sequelize.define('SheinPurchaseOrder', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  // 店铺关联
  shop_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '店铺ID'
  },
  // 平台ID
  platform_id: {
    type: DataTypes.INTEGER,
    comment: '平台ID: 1=SHEIN'
  },
  // 采购单基本信息
  order_no: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '采购单号'
  },
  type: {
    type: DataTypes.INTEGER,
    comment: '采购单类型：1急采/2备货'
  },
  type_name: {
    type: DataTypes.STRING(50),
    comment: '订单类型名称'
  },
  status: {
    type: DataTypes.INTEGER,
    comment: '订单状态：1待下单/2已下单/3发货中/4已送货/5已收货/6已查验/7已退货/8已完成/9无货下架/10已作废/11待审核/12分单中/13待退货'
  },
  status_name: {
    type: DataTypes.STRING(50),
    comment: '状态名称'
  },
  // 供应商信息
  supplier_name: {
    type: DataTypes.STRING(200),
    comment: '商家名称'
  },
  supplier_code: {
    type: DataTypes.STRING(100),
    comment: '供应商代码'
  },
  // 币种信息
  currency: {
    type: DataTypes.STRING(20),
    comment: '币种代码'
  },
  currency_id: {
    type: DataTypes.INTEGER,
    comment: '币种ID'
  },
  currency_name: {
    type: DataTypes.STRING(50),
    comment: '币种名称'
  },
  // 时间信息
  add_time: {
    type: DataTypes.DATE,
    comment: '备货单创建时间'
  },
  allocate_time: {
    type: DataTypes.DATE,
    comment: '备货单下发时间'
  },
  update_time: {
    type: DataTypes.DATE,
    comment: '更新时间'
  },
  reserve_time: {
    type: DataTypes.DATE,
    comment: '预约送货时间'
  },
  receipt_time: {
    type: DataTypes.DATE,
    comment: 'SHEIN仓库收货时间'
  },
  check_time: {
    type: DataTypes.DATE,
    comment: '质检完成时间'
  },
  storage_time: {
    type: DataTypes.DATE,
    comment: '仓库确认入库时间'
  },
  return_time: {
    type: DataTypes.DATE,
    comment: '退货时间'
  },
  delivery_time: {
    type: DataTypes.DATE,
    comment: '发货时间'
  },
  request_delivery_time: {
    type: DataTypes.DATE,
    comment: '要求发货时间（JIT场景）'
  },
  request_receipt_time: {
    type: DataTypes.DATE,
    comment: '要求收货时间'
  },
  request_take_parcel_time: {
    type: DataTypes.DATE,
    comment: '要求取件时间'
  },
  request_complete_time: {
    type: DataTypes.DATE,
    comment: '要求完工时间（JIT场景）'
  },
  // 仓库信息
  storage_id: {
    type: DataTypes.STRING(50),
    comment: 'SHEIN收货仓库ID'
  },
  warehouse_name: {
    type: DataTypes.STRING(100),
    comment: '收货仓库名称'
  },
  recommended_sub_warehouse_id: {
    type: DataTypes.STRING(50),
    comment: '预估收货仓ID'
  },
  // 订单标识
  first_mark: {
    type: DataTypes.BOOLEAN,
    comment: '首单标识'
  },
  first_mark_name: {
    type: DataTypes.STRING(20),
    comment: '首单标识名称'
  },
  urgent_type: {
    type: DataTypes.INTEGER,
    comment: '紧急标识'
  },
  urgent_type_name: {
    type: DataTypes.STRING(50),
    comment: '紧急类型名称'
  },
  // 备货类型
  prepare_type_id: {
    type: DataTypes.INTEGER,
    comment: '备货类型值'
  },
  prepare_type_name: {
    type: DataTypes.STRING(50),
    comment: '备货类型名称'
  },
  // 订单分类
  category: {
    type: DataTypes.INTEGER,
    comment: '订单分类'
  },
  category_name: {
    type: DataTypes.STRING(50),
    comment: '订单类型名称'
  },
  order_mark_id: {
    type: DataTypes.INTEGER,
    comment: '订单标识ID'
  },
  order_mark_name: {
    type: DataTypes.STRING(50),
    comment: '订单标识名称'
  },
  // JIT相关
  is_jit_mother_name: {
    type: DataTypes.STRING(20),
    comment: '是否JIT母单'
  },
  is_prior_production_name: {
    type: DataTypes.STRING(20),
    comment: '是否优先生产'
  },
  is_production_completion_name: {
    type: DataTypes.STRING(20),
    comment: '是否生产完成'
  },
  is_all_delivery_name: {
    type: DataTypes.STRING(20),
    comment: '是否完全要求发货'
  },
  is_delivery_name: {
    type: DataTypes.STRING(20),
    comment: '是否送货'
  },
  // 跟单信息
  order_supervisor: {
    type: DataTypes.STRING(100),
    comment: '跟单员'
  },
  add_uid: {
    type: DataTypes.STRING(100),
    comment: '添加人'
  },
  // 国家市场
  country_market: {
    type: DataTypes.INTEGER,
    comment: '预销国家市场：0默认/1南大区/2北大区'
  },
  // 定制信息
  custom_info_id: {
    type: DataTypes.STRING(100),
    comment: '客单定制信息ID'
  },
  custom_info: {
    type: DataTypes.JSON,
    comment: '客单定制信息'
  },
  // 标签信息（JSON存储）
  order_label_info: {
    type: DataTypes.JSON,
    comment: '备货单标签信息'
  },
  goods_level: {
    type: DataTypes.JSON,
    comment: '备货单商品层次信息'
  },
  // 版本和增值信息
  attribute_version: {
    type: DataTypes.INTEGER,
    comment: '成份版本号（OEM/ODM商家）'
  },
  is_increment_on_way: {
    type: DataTypes.INTEGER,
    comment: '是否增值中：1是/2否（OEM/ODM商家）'
  },
  // 请求追踪
  trace_id: {
    type: DataTypes.STRING(100),
    comment: '请求唯一标识'
  },
  // 原始数据
  raw_data: {
    type: DataTypes.JSON,
    comment: '原始API返回数据'
  }
}, {
  tableName: 'shein_purchase_orders',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['shop_id', 'order_no'] },
    { fields: ['status'] },
    { fields: ['type'] },
    { fields: ['add_time'] },
    { fields: ['allocate_time'] },
    { fields: ['update_time'] }
  ]
});

module.exports = SheinPurchaseOrder;
