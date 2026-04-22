const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * 供应商/厂家表
 */
const Supplier = sequelize.define('Supplier', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  // 厂家编码
  supplier_code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '厂家编码'
  },
  // 厂家名称
  supplier_name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '厂家名称'
  },
  // 简称
  short_name: {
    type: DataTypes.STRING(100),
    comment: '简称'
  },
  // 联系人
  contact_name: {
    type: DataTypes.STRING(100),
    comment: '联系人'
  },
  // 联系电话
  contact_phone: {
    type: DataTypes.STRING(50),
    comment: '联系电话'
  },
  // 微信
  wechat: {
    type: DataTypes.STRING(100),
    comment: '微信号'
  },
  // 邮箱
  email: {
    type: DataTypes.STRING(200),
    comment: '邮箱'
  },
  // 地址
  address: {
    type: DataTypes.STRING(500),
    comment: '地址'
  },
  // 省份
  province: {
    type: DataTypes.STRING(50),
    comment: '省份'
  },
  // 城市
  city: {
    type: DataTypes.STRING(50),
    comment: '城市'
  },
  // 区县
  district: {
    type: DataTypes.STRING(50),
    comment: '区县'
  },
  // 开户银行
  bank_name: {
    type: DataTypes.STRING(200),
    comment: '开户银行'
  },
  // 银行账号
  bank_account: {
    type: DataTypes.STRING(100),
    comment: '银行账号'
  },
  // 账户名称
  account_name: {
    type: DataTypes.STRING(200),
    comment: '账户名称'
  },
  // 结算周期（天）
  settlement_cycle: {
    type: DataTypes.INTEGER,
    defaultValue: 30,
    comment: '结算周期（天）'
  },
  // 结算方式：1-月结 2-周结 3-现结
  settlement_type: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    comment: '结算方式：1-月结 2-周结 3-现结'
  },
  // 主营品类
  main_category: {
    type: DataTypes.STRING(500),
    comment: '主营品类'
  },
  // 备注
  remark: {
    type: DataTypes.TEXT,
    comment: '备注'
  },
  // 状态：1-启用 2-禁用
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    comment: '状态：1-启用 2-禁用'
  }
}, {
  tableName: 'suppliers',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Supplier;
