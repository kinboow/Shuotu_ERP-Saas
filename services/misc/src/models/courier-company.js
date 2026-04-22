/**
 * 快递公司模型
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CourierCompany = sequelize.define('courier_companies', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    company_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      comment: '快递公司名称'
    },
    company_code: {
      type: DataTypes.STRING(50),
      comment: '快递公司编码'
    },
    logo_url: {
      type: DataTypes.STRING(500),
      comment: 'Logo URL'
    },
    contact_person: {
      type: DataTypes.STRING(50),
      comment: '联系人'
    },
    contact_phone: {
      type: DataTypes.STRING(50),
      comment: '联系电话'
    },
    is_active: {
      type: DataTypes.TINYINT,
      defaultValue: 1,
      comment: '是否启用: 1启用 0禁用'
    },
    sort_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '排序'
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    comment: '快递公司配置表'
  });

  return CourierCompany;
};
