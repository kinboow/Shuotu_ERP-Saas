/**
 * 数据库配置
 */

const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'mysql',
  host: process.env.MYSQL_HOST || 'localhost',
  port: process.env.MYSQL_PORT || 3306,
  username: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'eer',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  timezone: '+08:00'
});

const connectDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('[Sync-Engine] 数据库连接成功');
  } catch (error) {
    console.error('[Sync-Engine] 数据库连接失败:', error.message);
  }
};

module.exports = { sequelize, connectDatabase };
