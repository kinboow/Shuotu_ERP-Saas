const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PlatformConnection = sequelize.define('PlatformConnection', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  platform: {
    type: DataTypes.ENUM('amazon', 'ebay', 'shopify'),
    allowNull: false
  },
  store_name: DataTypes.STRING(100),
  api_key: DataTypes.STRING(255),
  api_secret: DataTypes.STRING(255),
  access_token: DataTypes.TEXT,
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  last_sync: DataTypes.DATE
});

module.exports = PlatformConnection;
