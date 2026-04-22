/**
 * 提现记录模型
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Withdrawal = sequelize.define('Withdrawal', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    withdrawalId: {
      type: DataTypes.STRING(32),
      unique: true,
      allowNull: false,
      field: 'withdrawal_id'
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    currency: {
      type: DataTypes.STRING(10),
      defaultValue: 'CNY'
    },
    platform: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    shopId: {
      type: DataTypes.STRING(32),
      field: 'shop_id'
    },
    bankName: {
      type: DataTypes.STRING(100),
      field: 'bank_name'
    },
    bankAccount: {
      type: DataTypes.STRING(50),
      field: 'bank_account'
    },
    accountHolder: {
      type: DataTypes.STRING(100),
      field: 'account_holder'
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'PENDING'
    },
    applyTime: {
      type: DataTypes.DATE,
      field: 'apply_time'
    },
    processTime: {
      type: DataTypes.DATE,
      field: 'process_time'
    },
    completeTime: {
      type: DataTypes.DATE,
      field: 'complete_time'
    },
    operatorId: {
      type: DataTypes.STRING(32),
      field: 'operator_id'
    },
    operatorName: {
      type: DataTypes.STRING(50),
      field: 'operator_name'
    },
    remark: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'withdrawals',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['platform', 'shop_id'] },
      { fields: ['status'] },
      { fields: ['apply_time'] }
    ]
  });

  return Withdrawal;
};
