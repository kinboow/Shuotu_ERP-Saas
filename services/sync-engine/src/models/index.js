/**
 * Sync-Engine 数据模型入口
 */

const { sequelize } = require('../config/database');

const PlatformConfig = require('./platform-config')(sequelize);
const PlatformShop = require('./platform-shop')(sequelize);

// 关联关系
PlatformConfig.hasMany(PlatformShop, { foreignKey: 'platform_id', as: 'shops' });
PlatformShop.belongsTo(PlatformConfig, { foreignKey: 'platform_id', as: 'platform' });

const syncDatabase = async () => {
  try {
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      console.log('[Sync-Engine] 数据表同步完成');
    }
  } catch (error) {
    console.error('[Sync-Engine] 数据表同步失败:', error.message);
  }
};

module.exports = {
  sequelize,
  PlatformConfig,
  PlatformShop,
  syncDatabase
};
