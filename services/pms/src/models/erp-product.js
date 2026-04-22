/**
 * ERP商品模型
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ErpProduct = sequelize.define('ErpProduct', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    // 唯一编号 XT + 时间戳 + 随机2位 (共19位)
    product_code: {
      type: DataTypes.STRING(25),
      allowNull: false,
      unique: true,
      comment: 'ERP产品唯一编号(XT+时间戳+随机)'
    },
    // 基本信息
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
      comment: '多语言商品名称'
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
      comment: '商品描述HTML格式'
    },
    // 品牌信息
    brand: {
      type: DataTypes.STRING(200),
      comment: '品牌名称'
    },
    brand_id: {
      type: DataTypes.STRING(100),
      comment: '品牌ID'
    },
    brand_code: {
      type: DataTypes.STRING(100),
      comment: '品牌编码'
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
      comment: '类目路径'
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
      comment: '主图URL列表'
    },
    // 尺寸重量
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
      comment: '商家编码'
    },
    // 货源类型
    source_type: {
      type: DataTypes.TINYINT,
      defaultValue: 1,
      comment: '货源类型：1-自生产 2-厂家调货'
    },
    supplier_id: {
      type: DataTypes.INTEGER,
      comment: '供应商ID'
    },
    purchase_price: {
      type: DataTypes.DECIMAL(10, 2),
      comment: '采购成本价'
    },
    production_cost: {
      type: DataTypes.DECIMAL(10, 2),
      comment: '生产成本价'
    },
    // 状态
    status: {
      type: DataTypes.TINYINT,
      defaultValue: 1,
      comment: '状态：1-正常 0-禁用'
    }
  }, {
    tableName: 'erp_products',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  /**
   * 生成唯一编号 XT + 时间戳 + 随机2位数字
   * 格式: XT + YYMMDDHHmmssSSS + 随机2位 = XT + 15位时间戳 + 2位随机 = 19位
   * 例如: XT25120614302512325
   */
  ErpProduct.generateProductCode = async () => {
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2); // 25
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    
    const timestamp = `${year}${month}${day}${hour}${minute}${second}${ms}`;
    const random = String(Math.floor(Math.random() * 100)).padStart(2, '0');
    
    return `XT${timestamp}${random}`;
  };

  return ErpProduct;
};
