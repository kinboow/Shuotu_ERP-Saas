/**
 * 财务记录模型
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const FinanceRecord = sequelize.define('FinanceRecord', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    recordId: {
      type: DataTypes.STRING(32),
      unique: true,
      allowNull: false,
      field: 'record_id'
    },
    type: {
      type: DataTypes.STRING(20),
      allowNull: false
      // INCOME, EXPENSE, TRANSFER
    },
    category: {
      type: DataTypes.STRING(50)
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    currency: {
      type: DataTypes.STRING(10),
      defaultValue: 'CNY'
    },
    description: {
      type: DataTypes.TEXT
    },
    relatedType: {
      type: DataTypes.STRING(20),
      field: 'related_type'
    },
    relatedId: {
      type: DataTypes.STRING(50),
      field: 'related_id'
    },
    platform: {
      type: DataTypes.STRING(20)
    },
    shopId: {
      type: DataTypes.STRING(32),
      field: 'shop_id'
    },
    recordDate: {
      type: DataTypes.DATE,
      field: 'record_date'
    },
    operatorId: {
      type: DataTypes.STRING(32),
      field: 'operator_id'
    },
    operatorName: {
      type: DataTypes.STRING(50),
      field: 'operator_name'
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'ACTIVE'
    },
    remark: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'finance_records',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['type'] },
      { fields: ['category'] },
      { fields: ['platform', 'shop_id'] },
      { fields: ['record_date'] }
    ]
  });

  return FinanceRecord;
};
