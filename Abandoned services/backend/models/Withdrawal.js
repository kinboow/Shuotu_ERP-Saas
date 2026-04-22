const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Withdrawal = sequelize.define('Withdrawal', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sequence_number: {
    type: DataTypes.INTEGER,
    comment: '序号'
  },
  account_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '资金账户类型'
  },
  created_time: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '创建时间'
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    comment: '提现金额'
  },
  status: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '提现状态'
  },
  bank_account: {
    type: DataTypes.STRING(100),
    comment: '收款账户'
  }
}, {
  tableName: 'Withdrawals',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['created_time', 'amount']
    },
    {
      fields: ['status']
    },
    {
      fields: ['created_time']
    }
  ]
});

module.exports = Withdrawal;
