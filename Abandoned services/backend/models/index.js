const sequelize = require('../config/database');

// Import all models
const User = require('./User');
const Order = require('./Order');
const Product = require('./Product');
const PlatformConfig = require('./PlatformConfig');
const PlatformShop = require('./PlatformShop');
const PlatformConnection = require('./PlatformConnection');
const StockOrder = require('./StockOrder');
const FinanceRecord = require('./FinanceRecord');
const Withdrawal = require('./Withdrawal');
const SheinAuth = require('./SheinAuth');
const SheinProduct = require('./SheinProduct');
const SheinProductList = require('./SheinProductList');
const ErpProduct = require('./ErpProduct');
const ErpProductSkc = require('./ErpProductSkc');
const ErpProductSku = require('./ErpProductSku');
const ComplianceLabelTemplate = require('./ComplianceLabelTemplate');
const LabelMaterial = require('./LabelMaterial');

// Create models object
const models = {
  User,
  Order,
  Product,
  PlatformConfig,
  PlatformShop,
  PlatformConnection,
  StockOrder,
  FinanceRecord,
  Withdrawal,
  SheinAuth,
  SheinProduct,
  SheinProductList,
  ErpProduct,
  ErpProductSkc,
  ErpProductSku,
  ComplianceLabelTemplate,
  LabelMaterial
};

// Define ERP product associations (SPU -> SKC -> SKU)
ErpProduct.hasMany(ErpProductSkc, { foreignKey: 'erp_product_id', as: 'skcs' });
ErpProductSkc.belongsTo(ErpProduct, { foreignKey: 'erp_product_id', as: 'product' });

ErpProductSkc.hasMany(ErpProductSku, { foreignKey: 'erp_skc_id', as: 'skus' });
ErpProductSku.belongsTo(ErpProductSkc, { foreignKey: 'erp_skc_id', as: 'skc' });

// SPU也可以直接关联SKU（兼容旧数据）
ErpProduct.hasMany(ErpProductSku, { foreignKey: 'erp_product_id', as: 'allSkus' });
ErpProductSku.belongsTo(ErpProduct, { foreignKey: 'erp_product_id', as: 'product' });

// Initialize associations
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

// Add sequelize instance to models
models.sequelize = sequelize;

module.exports = models;
