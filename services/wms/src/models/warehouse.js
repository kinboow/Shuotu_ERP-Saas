/**
 * 仓库模型
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Warehouse = sequelize.define('Warehouse', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    warehouseId: {
      type: DataTypes.STRING(32),
      unique: true,
      allowNull: false,
      field: 'warehouse_id'
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    code: {
      type: DataTypes.STRING(20)
    },
    // 地址
    country: {
      type: DataTypes.STRING(50)
    },
    province: {
      type: DataTypes.STRING(100)
    },
    city: {
      type: DataTypes.STRING(100)
    },
    address: {
      type: DataTypes.STRING(500)
    },
    zipCode: {
      type: DataTypes.STRING(20),
      field: 'zip_code'
    },
    // 联系人
    contactName: {
      type: DataTypes.STRING(50),
      field: 'contact_name'
    },
    contactPhone: {
      type: DataTypes.STRING(50),
      field: 'contact_phone'
    },
    // 状态
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'ACTIVE'
      // ACTIVE, INACTIVE
    },
    // 是否默认仓库
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_default'
    },
    // 备注
    remark: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'warehouses',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return Warehouse;
};
