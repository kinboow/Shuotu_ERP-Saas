const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PlatformShop = sequelize.define('PlatformShop', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  platform_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '关联的平台配置ID',
    references: {
      model: 'PlatformConfigs',
      key: 'id'
    }
  },
  platform_name: {
    type: DataTypes.ENUM('shein_full', 'shein_semi', 'amazon', 'ebay'),
    allowNull: false,
    comment: '平台名称: shein_full=SHEIN(全托管), shein_semi=SHEIN(半托管), amazon=Amazon, ebay=eBay'
  },
  shop_name: {
    type: DataTypes.STRING(100),
    comment: '店铺名称'
  },
  shop_code: {
    type: DataTypes.STRING(100),
    comment: '店铺编码/ID'
  },
  
  // 授权信息（通用字段）
  access_token: {
    type: DataTypes.TEXT,
    comment: '访问令牌'
  },
  refresh_token: {
    type: DataTypes.TEXT,
    comment: '刷新令牌'
  },
  token_expires_at: {
    type: DataTypes.DATE,
    comment: '令牌过期时间'
  },
  
  // SHEIN特有字段
  open_key_id: {
    type: DataTypes.STRING(100),
    comment: 'SHEIN: 店铺授权后的openKeyId'
  },
  secret_key: {
    type: DataTypes.TEXT,
    comment: 'SHEIN: 店铺授权后的secretKey（已解密）'
  },
  encrypted_secret_key: {
    type: DataTypes.TEXT,
    comment: 'SHEIN: 店铺授权后的secretKey（加密）'
  },
  
  // Amazon特有字段
  seller_id: {
    type: DataTypes.STRING(100),
    comment: 'Amazon: 卖家ID'
  },
  marketplace_id: {
    type: DataTypes.STRING(100),
    comment: 'Amazon: 市场ID'
  },
  
  // 通用字段
  auth_data: {
    type: DataTypes.JSON,
    comment: '其他授权数据（平台特定）'
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
  sync_status: {
    type: DataTypes.STRING(50),
    comment: '同步状态'
  },
  remarks: {
    type: DataTypes.TEXT,
    comment: '备注'
  }
}, {
  tableName: 'PlatformShops',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['platform_name', 'shop_code']
    },
    {
      fields: ['platform_id']
    },
    {
      fields: ['platform_name']
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['open_key_id']
    }
  ]
});

// 定义关联关系
PlatformShop.associate = (models) => {
  PlatformShop.belongsTo(models.PlatformConfig, {
    foreignKey: 'platform_id',
    as: 'platform'
  });
  
  PlatformShop.hasMany(models.SheinProduct, {
    foreignKey: 'shop_id',
    as: 'sheinProducts'
  });
};

module.exports = PlatformShop;
