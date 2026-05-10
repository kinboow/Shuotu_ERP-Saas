/**
 * WMS数据模型入口
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
const Inventory = require('./inventory')(sequelize);
const Warehouse = require('./warehouse')(sequelize);
const StockLog = require('./stock-log')(sequelize);

// 定义关联关系
Inventory.belongsTo(Warehouse, { foreignKey: 'warehouseId', targetKey: 'warehouseId', as: 'warehouse', constraints: false });
Warehouse.hasMany(Inventory, { foreignKey: 'warehouseId', sourceKey: 'warehouseId', as: 'inventories', constraints: false });

const shouldAutoSync = process.env.DB_AUTO_SYNC === 'true' || process.env.NODE_ENV === 'development';

// 同步数据库
const syncDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('[WMS] 数据库连接成功');

    if (shouldAutoSync) {
      await sequelize.sync({ alter: true });
      console.log('[WMS] 数据表同步完成');

      // 创建默认仓库
      await Warehouse.findOrCreate({
        where: { enterpriseId: 0, warehouseId: 'DEFAULT' },
        defaults: {
          enterpriseId: 0,
          warehouseId: 'DEFAULT',
          name: '默认仓库',
          code: 'WH001',
          isDefault: true,
          status: 'ACTIVE'
        }
      });
      console.log('[WMS] 默认仓库已就绪');
    }
  } catch (error) {
    console.error('[WMS] 数据库连接失败:', error.message);
    throw error;
  }
};

module.exports = {
  sequelize,
  Inventory,
  Warehouse,
  StockLog,
  syncDatabase
};
