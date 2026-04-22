/**
 * 供应商模型 - 兼容前端字段命名
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Supplier = sequelize.define('Supplier', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    supplier_code: {
      type: DataTypes.STRING(50),
      unique: true
    },
    supplier_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    short_name: {
      type: DataTypes.STRING(50)
    },
    contact_name: {
      type: DataTypes.STRING(50)
    },
    contact_phone: {
      type: DataTypes.STRING(50)
    },
    wechat: {
      type: DataTypes.STRING(50)
    },
    email: {
      type: DataTypes.STRING(100)
    },
    address: {
      type: DataTypes.STRING(500)
    },
    main_category: {
      type: DataTypes.STRING(200)
    },
    settlement_type: {
      type: DataTypes.INTEGER,
      defaultValue: 1
      // 1-月结, 2-周结, 3-现结
    },
    settlement_cycle: {
      type: DataTypes.INTEGER,
      defaultValue: 30
    },
    bank_name: {
      type: DataTypes.STRING(100)
    },
    bank_account: {
      type: DataTypes.STRING(50)
    },
    account_name: {
      type: DataTypes.STRING(100)
    },
    status: {
      type: DataTypes.INTEGER,
      defaultValue: 1
      // 1-启用, 2-禁用
    },
    remark: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'suppliers',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return Supplier;
};
