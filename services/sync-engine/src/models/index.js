/**
 * Sync-Engine 数据模型入口
 */

const { sequelize } = require('../config/database');

const PlatformConfig = require('./platform-config')(sequelize);
const PlatformShop = require('./platform-shop')(sequelize);

// 关联关系
PlatformConfig.hasMany(PlatformShop, { foreignKey: 'platform_id', as: 'shops' });
PlatformShop.belongsTo(PlatformConfig, { foreignKey: 'platform_id', as: 'platform' });

const shouldAutoSync = process.env.DB_AUTO_SYNC === 'true' || process.env.NODE_ENV === 'development';

const syncDatabase = async () => {
  try {
    if (shouldAutoSync) {
      await sequelize.sync({ alter: true });
      console.log('[Sync-Engine] 数据表同步完成');
    }
  } catch (error) {
    console.error('[Sync-Engine] 数据表同步失败:', error.message);
    throw error;
  }
};

module.exports = {
  sequelize,
  PlatformConfig,
  PlatformShop,
  syncDatabase
};
