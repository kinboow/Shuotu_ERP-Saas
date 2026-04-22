const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StockOrder = sequelize.define('StockOrder', {
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
  parent_order_number: {
    type: DataTypes.STRING(100)
  },
  product_name: {
    type: DataTypes.STRING(500)
  },
  product_image: {
    type: DataTypes.STRING(500)
  },
  skc: {
    type: DataTypes.STRING(100)
  },
  product_code: {
    type: DataTypes.STRING(100)
  },
  sku_id: {
    type: DataTypes.STRING(100)
  },
  sku_attribute: {
    type: DataTypes.STRING(200)
  },
  sku_code: {
    type: DataTypes.STRING(100)
  },
  declared_price: {
    type: DataTypes.DECIMAL(10, 2)
  },
  stock_quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  delivered_quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  warehouse_quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  status: {
    type: DataTypes.STRING(50),
    defaultValue: '待创建'
  },
  warehouse_group: {
    type: DataTypes.STRING(100)
  },
  order_type: {
    type: DataTypes.STRING(50)
  },
  stock_water_level: {
    type: DataTypes.STRING(100)
  },
  can_ship_today: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_hot_sale: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_return: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_domestic: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_vmi: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  ship_deadline: {
    type: DataTypes.DATE
  },
  arrival_deadline: {
    type: DataTypes.DATE
  },
  created_time: {
    type: DataTypes.DATE
  },
  ship_time: {
    type: DataTypes.DATE
  },
  delivery_number: {
    type: DataTypes.STRING(100)
  },
  handover_time: {
    type: DataTypes.DATE
  },
  receive_time: {
    type: DataTypes.DATE
  },
  actual_warehouse: {
    type: DataTypes.STRING(100)
  },
  return_time: {
    type: DataTypes.DATE
  },
  progress_status: {
    type: DataTypes.STRING(200)
  },
  estimated_ship_date: {
    type: DataTypes.DATE
  },
  remarks: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'StockOrders',
  timestamps: true
});

module.exports = StockOrder;
