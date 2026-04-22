const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LogisticsProvider = sequelize.define('LogisticsProvider', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  provider_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '物流商名称'
  },
  provider_code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '物流商代码'
  },
  provider_type: {
    type: DataTypes.ENUM('express', 'freight', 'international', 'other'),
    defaultValue: 'express',
    comment: '物流类型'
  },
  api_url: {
    type: DataTypes.STRING(255),
    comment: 'API地址'
  },
  api_key: {
    type: DataTypes.STRING(255),
    comment: 'API密钥'
  },
  api_secret: {
    type: DataTypes.STRING(255),
    comment: 'API密钥'
  },
  app_id: {
    type: DataTypes.STRING(100),
    comment: '应用ID'
  },
  customer_code: {
    type: DataTypes.STRING(100),
    comment: '客户代码'
  },
  contact_person: {
    type: DataTypes.STRING(50),
    comment: '联系人'
  },
  contact_phone: {
    type: DataTypes.STRING(20),
    comment: '联系电话'
  },
  contact_email: {
    type: DataTypes.STRING(100),
    comment: '联系邮箱'
  },
  service_areas: {
    type: DataTypes.TEXT,
    comment: '服务区域(JSON)',
    get() {
      const value = this.getDataValue('service_areas');
      return value ? JSON.parse(value) : [];
    },
    set(value) {
      this.setDataValue('service_areas', JSON.stringify(value));
    }
  },
  price_config: {
    type: DataTypes.TEXT,
    comment: '价格配置(JSON)',
    get() {
      const value = this.getDataValue('price_config');
      return value ? JSON.parse(value) : {};
    },
    set(value) {
      this.setDataValue('price_config', JSON.stringify(value));
    }
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否启用'
  },
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '优先级(数字越大优先级越高)'
  },
  remark: {
    type: DataTypes.TEXT,
    comment: '备注'
  }
}, {
  tableName: 'logistics_providers',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['provider_code'] },
    { fields: ['is_active'] },
    { fields: ['priority'] }
  ]
});

module.exports = LogisticsProvider;
