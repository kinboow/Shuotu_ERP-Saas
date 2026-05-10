/**
 * PMS数据模型入口
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
  timezone: '+08:00',
  define: { freezeTableName: true }
});

const Product = require('./product')(sequelize);
const Sku = require('./sku')(sequelize);
const SkuMapping = require('./sku-mapping')(sequelize);
const ErpProduct = require('./erp-product')(sequelize);

// 关联关系
Product.hasMany(Sku, { foreignKey: 'productId', sourceKey: 'productId', as: 'skus' });
Sku.belongsTo(Product, { foreignKey: 'productId', targetKey: 'productId', as: 'product' });

Sku.hasMany(SkuMapping, { foreignKey: 'internalSkuId', sourceKey: 'skuId', as: 'mappings' });
SkuMapping.belongsTo(Sku, { foreignKey: 'internalSkuId', targetKey: 'skuId', as: 'sku' });

const shouldAutoSync = process.env.DB_AUTO_SYNC === 'true' || process.env.NODE_ENV === 'development';

const syncDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('[PMS] 数据库连接成功');
    if (shouldAutoSync) {
      await sequelize.sync({ alter: true });
      console.log('[PMS] 数据表同步完成');
    }
  } catch (error) {
    console.error('[PMS] 数据库连接失败:', error.message);
    throw error;
  }
};

module.exports = { sequelize, Product, Sku, SkuMapping, ErpProduct, syncDatabase };
