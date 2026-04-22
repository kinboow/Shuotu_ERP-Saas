const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PlatformConfig = sequelize.define('PlatformConfig', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  platform_name: {
    type: DataTypes.ENUM('shein_full', 'shein_semi', 'amazon', 'ebay'),
    allowNull: false,
    unique: true,
    comment: '平台名称: shein_full=SHEIN(全托管), shein_semi=SHEIN(半托管), amazon=Amazon, ebay=eBay'
  },
  platform_display_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '平台显示名称'
  },
  icon: {
    type: DataTypes.TEXT,
    comment: 'SVG图标代码'
  },
  app_id: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '应用ID/AppID'
  },
  app_secret: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: '应用密钥/APP Secret'
  },
  callback_url: {
    type: DataTypes.STRING(500),
    allowNull: false,
    comment: '回调地址'
  },
  api_environment: {
    type: DataTypes.ENUM('production', 'test'),
    defaultValue: 'production',
    comment: 'API环境'
  },
  api_domain: {
    type: DataTypes.STRING(255),
    comment: 'API域名'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否启用'
  },
  config_data: {
    type: DataTypes.JSON,
    comment: '其他配置信息'
  },
  remarks: {
    type: DataTypes.TEXT,
    comment: '备注说明'
  }
}, {
  tableName: 'PlatformConfigs',
  timestamps: true
});

// 定义关联关系
PlatformConfig.associate = (models) => {
  PlatformConfig.hasMany(models.PlatformShop, {
    foreignKey: 'platform_id',
    as: 'shops'
  });
};

module.exports = PlatformConfig;
