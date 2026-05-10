const path = require('path');
try {
  require('dotenv').config({ path: path.resolve(__dirname, '.env') });
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') {
    throw error;
  }
}

process.env.DB_AUTO_SYNC = process.env.DB_AUTO_SYNC || 'true';

const { syncDatabase: syncMisc } = require('./misc/src/models');
const {
  ensureTenantTables,
  ensureLegacyAuthSchema,
  ensureBusinessTenantColumns
} = require('./misc/src/services/enterprise-context');

const { connectDatabase: connectSyncEngine } = require('./sync-engine/src/config/database');
const { syncDatabase: syncSyncEngine } = require('./sync-engine/src/models');
const { ensureTenantColumns: ensureSyncTenantColumns } = require('./sync-engine/src/services/tenant-context.service');
const PlatformConfigService = require('./sync-engine/src/services/platform-config.service');

const { syncDatabase: syncOms } = require('./oms/src/models');
const { ensureOmsTenantColumns } = require('./oms/src/services/tenant-context.service');

const { syncDatabase: syncWms, Warehouse } = require('./wms/src/models');
const { ensureTenantColumns: ensureWmsTenantColumns } = require('./wms/src/services/tenant-context.service');

const { syncDatabase: syncPms } = require('./pms/src/models');
const { ensureTenantColumns: ensurePmsTenantColumns } = require('./pms/src/services/tenant-context.service');

const { ensurePlatformAdminSchema } = require('./platform-admin/src/bootstrap');

async function ensureDefaultWarehouse() {
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
}

async function runStep(name, handler) {
  console.log(`\n[Migration] 开始: ${name}`);
  await handler();
  console.log(`[Migration] 完成: ${name}`);
}

async function main() {
  console.log('========================================');
  console.log('  Shuotu ERP 数据库迁移开始');
  console.log('========================================');
  console.log(`[Migration] NODE_ENV=${process.env.NODE_ENV || 'production'}`);
  console.log(`[Migration] MYSQL_HOST=${process.env.MYSQL_HOST || 'localhost'}`);
  console.log(`[Migration] MYSQL_PORT=${process.env.MYSQL_PORT || '3306'}`);
  console.log(`[Migration] MYSQL_DATABASE=${process.env.MYSQL_DATABASE || 'eer'}`);

  await runStep('Platform Admin Schema', async () => {
    await ensurePlatformAdminSchema();
  });

  await runStep('Misc Models & Enterprise Schema', async () => {
    await syncMisc();
    await ensureLegacyAuthSchema();
    await ensureTenantTables();
    await ensureBusinessTenantColumns();
  });

  await runStep('Sync Engine Models & Tenant Columns', async () => {
    await connectSyncEngine();
    await syncSyncEngine();
    await ensureSyncTenantColumns();
    await PlatformConfigService.initDefaultPlatforms();
  });

  await runStep('OMS Models & Tenant Columns', async () => {
    await syncOms();
    await ensureOmsTenantColumns();
  });

  await runStep('WMS Models & Tenant Columns', async () => {
    await syncWms();
    await ensureWmsTenantColumns();
    await ensureDefaultWarehouse();
  });

  await runStep('PMS Models & Tenant Columns', async () => {
    await syncPms();
    await ensurePmsTenantColumns();
  });

  console.log('\n========================================');
  console.log('  Shuotu ERP 数据库迁移完成');
  console.log('========================================');
}

main().catch((error) => {
  console.error('\n[Migration] 执行失败:', error);
  process.exit(1);
});
