/**
 * OMS数据模型入口
 */

const { Sequelize } = require('sequelize');

// 数据库配置
const sequelize = new Sequelize({
  dialect: 'mysql',
  host: process.env.MYSQL_HOST || 'localhost',
  port: process.env.MYSQL_PORT || 3306,
  username: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'eer',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  timezone: '+08:00',
  define: {
    freezeTableName: true
  }
});

// 加载模型
const Order = require('./order')(sequelize);
const OrderItem = require('./order-item')(sequelize);
const Shipment = require('./shipment')(sequelize);
const OrderLog = require('./order-log')(sequelize);

// 定义关联关系
Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId' });

Order.hasMany(Shipment, { foreignKey: 'orderId', as: 'shipments' });
Shipment.belongsTo(Order, { foreignKey: 'orderId' });

Order.hasMany(OrderLog, { foreignKey: 'orderId', as: 'logs' });
OrderLog.belongsTo(Order, { foreignKey: 'orderId' });

// 同步数据库
const syncDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('[OMS] 数据库连接成功');
    
    // 开发环境自动同步表结构
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      console.log('[OMS] 数据表同步完成');
    }
  } catch (error) {
    console.error('[OMS] 数据库连接失败:', error.message);
  }
};

module.exports = {
  sequelize,
  Order,
  OrderItem,
  Shipment,
  OrderLog,
  syncDatabase
};
