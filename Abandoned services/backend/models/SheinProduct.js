const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SheinProduct = sequelize.define('SheinProduct', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  shop_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '关联的店铺ID'
  },
  // SPU级别信息
  spu_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'SPU编码'
  },
  spu_supplier_code: {
    type: DataTypes.STRING(100),
    comment: 'SPU供应商编码'
  },
  brand_code: {
    type: DataTypes.STRING(100),
    comment: '品牌编码'
  },
  category_id: {
    type: DataTypes.BIGINT,
    comment: '末级分类ID'
  },
  product_type_id: {
    type: DataTypes.BIGINT,
    comment: '商品类型ID'
  },
  // SKC级别信息
  skc_name: {
    type: DataTypes.STRING(100),
    comment: 'SKC编码'
  },
  skc_supplier_code: {
    type: DataTypes.STRING(100),
    comment: 'SKC供应商编码'
  },
  skc_attribute_id: {
    type: DataTypes.BIGINT,
    comment: 'SKC销售属性ID'
  },
  skc_attribute_value_id: {
    type: DataTypes.BIGINT,
    comment: 'SKC销售属性值ID'
  },
  // SKU级别信息
  sku_code: {
    type: DataTypes.STRING(100),
    comment: 'SKU编码'
  },
  supplier_sku: {
    type: DataTypes.STRING(100),
    comment: '供应商SKU'
  },
  // 商品名称和描述
  product_name_cn: {
    type: DataTypes.STRING(500),
    comment: '商品名称（中文）'
  },
  product_name_en: {
    type: DataTypes.STRING(500),
    comment: '商品名称（英文）'
  },
  product_desc_cn: {
    type: DataTypes.TEXT,
    comment: '商品描述（中文）'
  },
  product_desc_en: {
    type: DataTypes.TEXT,
    comment: '商品描述（英文）'
  },
  // 图片信息
  main_image_url: {
    type: DataTypes.TEXT,
    comment: '主图URL'
  },
  image_medium_url: {
    type: DataTypes.TEXT,
    comment: '中图URL'
  },
  image_small_url: {
    type: DataTypes.TEXT,
    comment: '小图URL'
  },
  image_group_code: {
    type: DataTypes.STRING(100),
    comment: '图片组编码'
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
  weight: {
    type: DataTypes.INTEGER,
    comment: '重量(g)'
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
  // 价格信息
  base_price: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '原价'
  },
  special_price: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '特价'
  },
  cost_price: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '供货价'
  },
  srp_price: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '建议零售价'
  },
  currency: {
    type: DataTypes.STRING(10),
    comment: '币种'
  },
  site: {
    type: DataTypes.STRING(50),
    comment: '站点'
  },
  // 状态信息
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
    comment: '最近更新时间'
  },
  // 样品信息
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
  sample_judge_type: {
    type: DataTypes.INTEGER,
    comment: '审版类型'
  },
  // 供应商条码信息
  supplier_barcode_enabled: {
    type: DataTypes.BOOLEAN,
    comment: '是否启用供应条码'
  },
  barcode_type: {
    type: DataTypes.STRING(20),
    comment: '条码类型: EAN、UPC'
  },
  // JSON字段（复杂数据）
  product_multi_name_list: {
    type: DataTypes.JSON,
    comment: '多语言名称列表'
  },
  product_multi_desc_list: {
    type: DataTypes.JSON,
    comment: '多语言描述列表'
  },
  product_attribute_list: {
    type: DataTypes.JSON,
    comment: '商品属性列表'
  },
  dimension_attribute_list: {
    type: DataTypes.JSON,
    comment: '尺寸属性列表'
  },
  sale_attribute_list: {
    type: DataTypes.JSON,
    comment: 'SKU销售属性列表'
  },
  skc_attribute_multi_list: {
    type: DataTypes.JSON,
    comment: 'SKC属性多语言名称'
  },
  skc_attribute_value_multi_list: {
    type: DataTypes.JSON,
    comment: 'SKC属性值多语言名称'
  },
  images: {
    type: DataTypes.JSON,
    comment: '所有图片列表'
  },
  spu_image_list: {
    type: DataTypes.JSON,
    comment: 'SPU图片列表'
  },
  skc_image_list: {
    type: DataTypes.JSON,
    comment: 'SKC图片列表'
  },
  sku_image_list: {
    type: DataTypes.JSON,
    comment: 'SKU图片列表'
  },
  site_detail_image_list: {
    type: DataTypes.JSON,
    comment: '站点详情图列表'
  },
  price_info_list: {
    type: DataTypes.JSON,
    comment: '多站点价格信息列表'
  },
  cost_info_list: {
    type: DataTypes.JSON,
    comment: '供货价信息列表'
  },
  shelf_status_info_list: {
    type: DataTypes.JSON,
    comment: '上下架信息列表'
  },
  recycle_info_list: {
    type: DataTypes.JSON,
    comment: '回收站状态信息列表'
  },
  proof_of_stock_info_list: {
    type: DataTypes.JSON,
    comment: '库存证明文件信息'
  },
  supplier_barcode_list: {
    type: DataTypes.JSON,
    comment: '供应商条码列表'
  },
  sku_supplier_info: {
    type: DataTypes.JSON,
    comment: 'SKU供应商信息'
  },
  raw_data: {
    type: DataTypes.JSON,
    comment: '原始完整数据'
  }
}, {
  tableName: 'SheinProducts',
  timestamps: true,
  indexes: [
    {
      fields: ['shop_id']
    },
    {
      fields: ['spu_name']
    },
    {
      fields: ['skc_name']
    },
    {
      fields: ['sku_code']
    },
    {
      unique: true,
      fields: ['shop_id', 'sku_code']
    }
  ]
});

// 定义关联关系
SheinProduct.associate = (models) => {
  SheinProduct.belongsTo(models.PlatformShop, {
    foreignKey: 'shop_id',
    as: 'shop'
  });
};

module.exports = SheinProduct;
