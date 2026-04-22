/**
 * 物流商模型 - 兼容前端字段命名
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const LogisticsProvider = sequelize.define('LogisticsProvider', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    provider_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    provider_code: {
      type: DataTypes.STRING(50)
    },
    provider_type: {
      type: DataTypes.STRING(50),
      defaultValue: 'warehouse'
      // warehouse, express, freight, international, other
    },
    logo_url: {
      type: DataTypes.STRING(500)
    },
    api_url: {
      type: DataTypes.STRING(255)
    },
    api_key: {
      type: DataTypes.STRING(255)
    },
    api_secret: {
      type: DataTypes.STRING(255)
    },
    app_id: {
      type: DataTypes.STRING(100)
    },
    customer_code: {
      type: DataTypes.STRING(100)
    },
    contact_person: {
      type: DataTypes.STRING(50)
    },
    contact_phone: {
      type: DataTypes.STRING(50)
    },
    contact_email: {
      type: DataTypes.STRING(100)
    },
    service_areas: {
      type: DataTypes.JSON
    },
    priority: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    remark: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'logistics_providers',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return LogisticsProvider;
};
