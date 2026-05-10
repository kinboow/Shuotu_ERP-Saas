/**
 * 平台配置模型
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PlatformConfig = sequelize.define('PlatformConfig', {
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
    platformName: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'platform_name'
      // shein, temu, tiktok
    },
    platformDisplayName: {
      type: DataTypes.STRING(100),
      field: 'platform_display_name'
    },
    // API基础配置
    baseUrl: {
      type: DataTypes.STRING(255),
      field: 'base_url'
    },
    appKey: {
      type: DataTypes.STRING(255),
      field: 'app_key'
    },
    appSecret: {
      type: DataTypes.STRING(255),
      field: 'app_secret'
    },
    // 额外配置（JSON格式存储其他参数）
    extraConfig: {
      type: DataTypes.JSON,
      field: 'extra_config'
    },
    // 状态
    status: {
      type: DataTypes.TINYINT,
      defaultValue: 1
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'sort_order'
    },
    remark: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'platform_configs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    // 返回JSON时使用下划线命名，兼容前端
    underscored: true
  });

  // 转换为前端期望的格式
  PlatformConfig.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return {
      id: values.id,
      enterprise_id: values.enterpriseId,
      platform_name: values.platformName,
      platform_display_name: values.platformDisplayName,
      base_url: values.baseUrl,
      app_key: values.appKey,
      app_secret: values.appSecret,
      extra_config: values.extraConfig,
      status: values.status,
      sort_order: values.sortOrder,
      is_active: values.status === 1,
      remark: values.remark,
      created_at: values.created_at,
      updated_at: values.updated_at,
      shops: values.shops
    };
  };

  return PlatformConfig;
};
