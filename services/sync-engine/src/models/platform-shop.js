/**
 * 平台店铺模型
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PlatformShop = sequelize.define('PlatformShop', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    enterpriseId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
      field: 'enterprise_id'
    },
    platformId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'platform_id'
    },
    shopName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'shop_name'
    },
    // 店铺级别的API凭证
    openKeyId: {
      type: DataTypes.STRING(255),
      field: 'open_key_id'
    },
    secretKey: {
      type: DataTypes.STRING(255),
      field: 'secret_key'
    },
    sellerId: {
      type: DataTypes.STRING(100),
      field: 'seller_id'
    },
    // Access Token（OAuth类型平台）
    accessToken: {
      type: DataTypes.TEXT,
      field: 'access_token'
    },
    refreshToken: {
      type: DataTypes.TEXT,
      field: 'refresh_token'
    },
    tokenExpireAt: {
      type: DataTypes.DATE,
      field: 'token_expire_at'
    },
    // 额外配置
    extraConfig: {
      type: DataTypes.JSON,
      field: 'extra_config'
    },
    // 状态
    status: {
      type: DataTypes.TINYINT,
      defaultValue: 1
    },
    lastSyncAt: {
      type: DataTypes.DATE,
      field: 'last_sync_at'
    },
    remark: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'platform_shops',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true
  });

  // 转换为前端期望的格式
  PlatformShop.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return {
      id: values.id,
      enterprise_id: values.enterpriseId,
      platform_id: values.platformId,
      shop_name: values.shopName,
      open_key_id: values.openKeyId,
      secret_key: values.secretKey,
      seller_id: values.sellerId,
      access_token: values.accessToken,
      refresh_token: values.refreshToken,
      token_expire_at: values.tokenExpireAt,
      extra_config: values.extraConfig,
      status: values.status,
      is_active: values.status === 1,
      last_sync_at: values.lastSyncAt,
      remark: values.remark,
      created_at: values.created_at,
      updated_at: values.updated_at,
      platform: values.platform
    };
  };

  return PlatformShop;
};
