const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SheinAuth = sequelize.define('SheinAuth', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  shop_name: {
    type: DataTypes.STRING(100),
    comment: '店铺名称'
  },
  appid: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'SHEIN应用ID'
  },
  app_secret: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'SHEIN应用密钥'
  },
  open_key_id: {
    type: DataTypes.STRING(100),
    comment: '店铺授权后的openKeyId'
  },
  secret_key: {
    type: DataTypes.TEXT,
    comment: '店铺授权后的secretKey（已解密）'
  },
  encrypted_secret_key: {
    type: DataTypes.TEXT,
    comment: '店铺授权后的secretKey（加密）'
  },
  temp_token: {
    type: DataTypes.STRING(255),
    comment: '临时token'
  },
  state: {
    type: DataTypes.STRING(100),
    comment: '授权状态标识'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否激活'
  },
  auth_time: {
    type: DataTypes.DATE,
    comment: '授权时间'
  },
  last_sync_time: {
    type: DataTypes.DATE,
    comment: '最后同步时间'
  },
  api_environment: {
    type: DataTypes.ENUM('production', 'test'),
    defaultValue: 'production',
    comment: 'API环境'
  },
  api_domain: {
    type: DataTypes.STRING(255),
    comment: 'API域名'
  }
}, {
  tableName: 'SheinAuths',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['appid', 'open_key_id']
    },
    {
      fields: ['is_active']
    }
  ]
});

module.exports = SheinAuth;
