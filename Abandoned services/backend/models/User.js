const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  uid: {
    type: DataTypes.CHAR(36),
    allowNull: false,
    unique: true,
    comment: '认证数据库的用户UID'
  },
  name: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '用户姓名'
  },
  phone: {
    type: DataTypes.STRING(11),
    allowNull: false,
    comment: '手机号'
  },
  avatar: {
    type: DataTypes.STRING(255),
    comment: '用户头像'
  },
  last_login: {
    type: DataTypes.DATE,
    comment: '最后登录时间'
  },
  login_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '登录次数'
  }
}, {
  tableName: 'Users',
  timestamps: true,
  indexes: [
    {
      fields: ['uid']
    },
    {
      fields: ['phone']
    }
  ]
});

module.exports = User;
