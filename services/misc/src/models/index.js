/**
 * MISC数据模型入口
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

const User = require('./user')(sequelize);
const Supplier = require('./supplier')(sequelize);
const LogisticsProvider = require('./logistics-provider')(sequelize);
const FinanceRecord = require('./finance-record')(sequelize);
const Withdrawal = require('./withdrawal')(sequelize);
const ComplianceLabelTemplate = require('./compliance-label')(sequelize);
const { LabelDataTable, LabelDataRow } = require('./label-data-table')(sequelize);
const CourierCompany = require('./courier-company')(sequelize);
const CourierReport = require('./courier-report')(sequelize);
const CourierReportItem = require('./courier-report-item')(sequelize);

const shouldAutoSync = process.env.DB_AUTO_SYNC === 'true' || process.env.NODE_ENV === 'development';

const syncDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('[MISC] 数据库连接成功');
    if (shouldAutoSync) {
      await sequelize.sync({ alter: true });
      console.log('[MISC] 数据表同步完成');
    }
  } catch (error) {
    console.error('[MISC] 数据库连接失败:', error.message);
    throw error;
  }
};

module.exports = {
  sequelize,
  User,
  Supplier,
  LogisticsProvider,
  FinanceRecord,
  Withdrawal,
  ComplianceLabelTemplate,
  LabelDataTable,
  LabelDataRow,
  CourierCompany,
  CourierReport,
  CourierReportItem,
  syncDatabase
};
