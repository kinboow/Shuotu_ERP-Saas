const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sku: {
    type: DataTypes.STRING(100),
    unique: true,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: DataTypes.TEXT,
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  cost: DataTypes.DECIMAL(10, 2),
  stock: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  weight: DataTypes.DECIMAL(10, 2),
  category: DataTypes.STRING(100),
  image_url: DataTypes.STRING(500),
  // SHEIN相关字段
  source_platform: {
    type: DataTypes.STRING(50),
    comment: '来源平台: shein, manual, amazon等'
  },
  source_spu: {
    type: DataTypes.STRING(100),
    comment: 'SHEIN SPU编码'
  },
  source_skc: {
    type: DataTypes.STRING(100),
    comment: 'SHEIN SKC编码'
  },
  source_sku: {
    type: DataTypes.STRING(100),
    comment: 'SHEIN SKU编码'
  },
  supplier_sku: {
    type: DataTypes.STRING(100),
    comment: '供应商SKU'
  },
  supplier_code: {
    type: DataTypes.STRING(100),
    comment: '供应商编码'
  },
  brand: {
    type: DataTypes.STRING(100),
    comment: '品牌'
  },
  brand_code: {
    type: DataTypes.STRING(100),
    comment: '品牌编码'
  },
  category_id: {
    type: DataTypes.BIGINT,
    comment: 'SHEIN分类ID'
  },
  product_type_id: {
    type: DataTypes.BIGINT,
    comment: 'SHEIN商品类型ID'
  },
  // 尺寸信息
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
  dimensions: {
    type: DataTypes.JSON,
    comment: '完整尺寸信息'
  },
  // 商品属性
  attributes: {
    type: DataTypes.JSON,
    comment: '商品属性列表'
  },
  sale_attributes: {
    type: DataTypes.JSON,
    comment: '销售属性列表'
  },
  dimension_attributes: {
    type: DataTypes.JSON,
    comment: '尺码属性列表'
  },
  // 图片信息
  images: {
    type: DataTypes.JSON,
    comment: '商品图片列表'
  },
  main_image: {
    type: DataTypes.TEXT,
    comment: '主图URL'
  },
  detail_images: {
    type: DataTypes.JSON,
    comment: '详情图列表'
  },
  // 价格信息
  price_info: {
    type: DataTypes.JSON,
    comment: '多站点价格信息'
  },
  base_price: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '基础价格'
  },
  special_price: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '特价'
  },
  currency: {
    type: DataTypes.STRING(10),
    comment: '币种'
  },
  cost_info: {
    type: DataTypes.JSON,
    comment: '成本信息'
  },
  cost_price: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '成本价'
  },
  srp_price: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '建议零售价'
  },
  // 状态信息
  status: {
    type: DataTypes.STRING(50),
    defaultValue: 'active',
    comment: '状态: active, inactive'
  },
  shelf_status: {
    type: DataTypes.INTEGER,
    comment: '上架状态: 0-下架 1-上架'
  },
  mall_state: {
    type: DataTypes.INTEGER,
    comment: '商城销售状态: 1-在售 2-停售'
  },
  stop_purchase: {
    type: DataTypes.INTEGER,
    comment: '采购状态: 1-在采 2-停采'
  },
  recycle_status: {
    type: DataTypes.INTEGER,
    comment: '回收站状态: 0-未回收 1-已回收'
  },
  // 时间信息
  first_shelf_time: {
    type: DataTypes.DATE,
    comment: '首次上架时间'
  },
  last_shelf_time: {
    type: DataTypes.DATE,
    comment: '最近上架时间'
  },
  last_update_time: {
    type: DataTypes.DATE,
    comment: 'SHEIN最近更新时间'
  },
  sync_time: {
    type: DataTypes.DATE,
    comment: '最后同步时间'
  },
  // 样品信息
  sample_info: {
    type: DataTypes.JSON,
    comment: '样品信息'
  },
  sample_code: {
    type: DataTypes.STRING(100),
    comment: '样衣SKU'
  },
  reserve_sample_flag: {
    type: DataTypes.INTEGER,
    comment: '是否需留样: 1-是 2-否'
  },
  spot_flag: {
    type: DataTypes.INTEGER,
    comment: '是否现货: 1-是 2-否'
  },
  // 包装信息
  quantity_type: {
    type: DataTypes.INTEGER,
    comment: '件数类型: 1-单件 2-同品多件'
  },
  quantity_unit: {
    type: DataTypes.INTEGER,
    comment: '件数单位: 1-件 2-双'
  },
  quantity: {
    type: DataTypes.INTEGER,
    comment: '件数值'
  },
  package_type: {
    type: DataTypes.INTEGER,
    comment: '包装类型: 0-空 1-软包装+软物 2-软包装+硬物 3-硬包装 4-真空'
  },
  // 条码信息
  supplier_barcode_enabled: {
    type: DataTypes.BOOLEAN,
    comment: '是否启用供应条码'
  },
  supplier_barcode_list: {
    type: DataTypes.JSON,
    comment: '供应商条码列表'
  },
  // 站点信息
  site: {
    type: DataTypes.STRING(50),
    comment: '站点'
  },
  sites: {
    type: DataTypes.JSON,
    comment: '多站点信息'
  },
  // 多语言信息
  multi_language_names: {
    type: DataTypes.JSON,
    comment: '多语言名称'
  },
  multi_language_desc: {
    type: DataTypes.JSON,
    comment: '多语言描述'
  },
  // 原始数据
  raw_data: {
    type: DataTypes.JSON,
    comment: 'SHEIN原始完整数据'
  }
});

module.exports = Product;
