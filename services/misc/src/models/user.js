/**
 * 用户模型
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.STRING(32),
      unique: true,
      allowNull: false,
      field: 'user_id'
    },
    username: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: false
    },
    password: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    realName: {
      type: DataTypes.STRING(50),
      field: 'real_name'
    },
    nickname: {
      type: DataTypes.STRING(50)
    },
    email: {
      type: DataTypes.STRING(100)
    },
    phone: {
      type: DataTypes.STRING(20)
    },
    avatar: {
      type: DataTypes.STRING(500)
    },
    role: {
      type: DataTypes.STRING(20),
      defaultValue: 'user'
      // admin, manager, user
    },
    roleId: {
      type: DataTypes.INTEGER,
      field: 'role_id'
    },
    isAdmin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_admin'
    },
    parentId: {
      type: DataTypes.BIGINT,
      field: 'parent_id'
    },
    department: {
      type: DataTypes.STRING(100)
    },
    position: {
      type: DataTypes.STRING(100)
    },
    loginIp: {
      type: DataTypes.STRING(50),
      field: 'login_ip'
    },
    loginCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'login_count'
    },
    passwordUpdatedAt: {
      type: DataTypes.DATE,
      field: 'password_updated_at'
    },
    tokenVersion: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'token_version'
    },
    pdaAccess: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'pda_access'
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'ACTIVE'
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      field: 'last_login_at'
    },
    lastLoginIp: {
      type: DataTypes.STRING(50),
      field: 'last_login_ip'
    }
  }, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return User;
};
