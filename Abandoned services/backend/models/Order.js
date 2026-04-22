const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  order_number: {
    type: DataTypes.STRING(100),
    unique: true,
    allowNull: false
  },
  platform: {
    type: DataTypes.ENUM('amazon', 'ebay', 'shopify', 'manual'),
    allowNull: false
  },
  platform_order_id: DataTypes.STRING(100),
  customer_name: DataTypes.STRING(100),
  customer_email: DataTypes.STRING(100),
  shipping_address: DataTypes.TEXT,
  total_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled'),
    defaultValue: 'pending'
  },
  order_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  tracking_number: DataTypes.STRING(100)
});

module.exports = Order;
