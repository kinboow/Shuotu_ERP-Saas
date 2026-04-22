const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FinanceRecord = sequelize.define('FinanceRecord', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  transaction_time: {
    type: DataTypes.DATE,
    allowNull: false
  },
  transaction_type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'CNY'
  },
  remarks: {
    type: DataTypes.TEXT
  },
  is_income: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'FinanceRecords',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['transaction_time', 'amount', 'transaction_type']
    }
  ]
});

module.exports = FinanceRecord;
