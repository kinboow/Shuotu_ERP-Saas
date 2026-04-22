/**
 * 认证数据库连接配置
 * 用于连接B数据库（192_168_5_40）进行用户登录验证
 */

const mysql = require('mysql2/promise');

const authDbConfig = {
  host: process.env.AUTH_DB_HOST || 'localhost',
  port: process.env.AUTH_DB_PORT || 3306,
  user: process.env.AUTH_DB_USER || 'root',
  password: process.env.AUTH_DB_PASSWORD || '',
  database: process.env.AUTH_DB_NAME || '192_168_5_40',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// 创建认证数据库连接池
const authDbPool = mysql.createPool(authDbConfig);

// 测试连接
authDbPool.getConnection()
  .then(connection => {
    console.log('✓ 认证数据库连接成功');
    connection.release();
  })
  .catch(err => {
    console.error('❌ 认证数据库连接失败:', err.message);
  });

module.exports = authDbPool;
