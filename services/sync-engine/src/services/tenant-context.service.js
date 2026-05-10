const { AsyncLocalStorage } = require('async_hooks');
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const requestContextStorage = new AsyncLocalStorage();
let ensureTenantColumnsPromise = null;

function normalizeEnterpriseId(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function getEnterpriseIdFromRequest(req) {
  if (!req) {
    return null;
  }

  return normalizeEnterpriseId(
    req.headers['x-enterprise-id']
    ?? req.query?.enterpriseId
    ?? req.body?.enterpriseId
    ?? null
  );
}

function getRequiredEnterpriseIdFromRequest(req) {
  const enterpriseId = getEnterpriseIdFromRequest(req);
  if (enterpriseId === null) {
    throw new Error('当前请求缺少企业上下文');
  }
  return enterpriseId;
}

function runWithRequestContext(req, callback) {
  const context = {
    enterpriseId: getEnterpriseIdFromRequest(req),
    userId: normalizeEnterpriseId(req?.headers['x-auth-user-id'])
  };

  return requestContextStorage.run(context, callback);
}

function getCurrentRequestContext() {
  return requestContextStorage.getStore() || {};
}

function getCurrentEnterpriseId() {
  return normalizeEnterpriseId(getCurrentRequestContext().enterpriseId);
}

async function ensureColumn(tableName, columnName, definition) {
  const [column] = await sequelize.query(
    `SHOW COLUMNS FROM ${tableName} LIKE :columnName`,
    {
      replacements: { columnName },
      type: QueryTypes.SELECT
    }
  );

  if (!column) {
    await sequelize.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

async function ensureIndex(tableName, indexName, definition) {
  const indexes = await sequelize.query(
    `SHOW INDEX FROM ${tableName} WHERE Key_name = :indexName`,
    {
      replacements: { indexName },
      type: QueryTypes.SELECT
    }
  );

  if (!indexes.length) {
    await sequelize.query(`ALTER TABLE ${tableName} ADD ${definition}`);
  }
}

async function dropLegacyPlatformNameUniqueIndex() {
  const indexes = await sequelize.query(
    'SHOW INDEX FROM platform_configs',
    { type: QueryTypes.SELECT }
  );

  const groupedIndexes = indexes.reduce((acc, item) => {
    if (!acc[item.Key_name]) {
      acc[item.Key_name] = [];
    }
    acc[item.Key_name].push(item);
    return acc;
  }, {});

  for (const [keyName, items] of Object.entries(groupedIndexes)) {
    if (keyName === 'PRIMARY' || keyName === 'uk_platform_configs_enterprise_platform') {
      continue;
    }

    const unique = items.every(item => item.Non_unique === 0);
    const columns = items
      .sort((a, b) => a.Seq_in_index - b.Seq_in_index)
      .map(item => item.Column_name);

    if (unique && columns.length === 1 && columns[0] === 'platform_name') {
      await sequelize.query(`ALTER TABLE platform_configs DROP INDEX ${keyName}`);
    }
  }
}

async function tableExists(tableName) {
  const tables = await sequelize.query(
    'SHOW TABLES LIKE :tableName',
    {
      replacements: { tableName },
      type: QueryTypes.SELECT
    }
  );

  return tables.length > 0;
}

async function ensureTenantColumns() {
  if (ensureTenantColumnsPromise) {
    return ensureTenantColumnsPromise;
  }

  ensureTenantColumnsPromise = (async () => {
    await ensureColumn('platform_configs', 'enterprise_id', 'BIGINT NOT NULL DEFAULT 0 AFTER id');
    await ensureColumn('platform_shops', 'enterprise_id', 'BIGINT NOT NULL DEFAULT 0 AFTER id');

    await ensureIndex('platform_configs', 'idx_platform_configs_enterprise_id', 'INDEX idx_platform_configs_enterprise_id (enterprise_id)');
    await ensureIndex('platform_shops', 'idx_platform_shops_enterprise_id', 'INDEX idx_platform_shops_enterprise_id (enterprise_id)');
    await ensureIndex('platform_shops', 'idx_platform_shops_enterprise_platform', 'INDEX idx_platform_shops_enterprise_platform (enterprise_id, platform_id)');

    await dropLegacyPlatformNameUniqueIndex();
    await ensureIndex('platform_configs', 'uk_platform_configs_enterprise_platform', 'UNIQUE INDEX uk_platform_configs_enterprise_platform (enterprise_id, platform_name)');

    if (await tableExists('shein_full_shops')) {
      await ensureColumn('shein_full_shops', 'enterprise_id', 'BIGINT NOT NULL DEFAULT 0 AFTER id');
      await ensureIndex('shein_full_shops', 'idx_shein_full_shops_enterprise_id', 'INDEX idx_shein_full_shops_enterprise_id (enterprise_id)');
    }

    if (await tableExists('shein_full_purchase_orders')) {
      await ensureColumn('shein_full_purchase_orders', 'enterprise_id', 'BIGINT NOT NULL DEFAULT 0 AFTER id');
      await sequelize.query(`
        UPDATE shein_full_purchase_orders po
        INNER JOIN shein_full_shops s ON po.shop_id = s.id
        SET po.enterprise_id = COALESCE(s.enterprise_id, 0)
        WHERE po.enterprise_id = 0
      `);
      await ensureIndex('shein_full_purchase_orders', 'idx_shein_full_purchase_orders_enterprise_id', 'INDEX idx_shein_full_purchase_orders_enterprise_id (enterprise_id)');
      await ensureIndex('shein_full_purchase_orders', 'idx_shein_full_purchase_orders_enterprise_shop', 'INDEX idx_shein_full_purchase_orders_enterprise_shop (enterprise_id, shop_id)');
    }

    if (await tableExists('shein_full_delivery_orders')) {
      await ensureColumn('shein_full_delivery_orders', 'enterprise_id', 'BIGINT NOT NULL DEFAULT 0 AFTER id');
      await sequelize.query(`
        UPDATE shein_full_delivery_orders d
        INNER JOIN shein_full_shops s ON d.shop_id = s.id
        SET d.enterprise_id = COALESCE(s.enterprise_id, 0)
        WHERE d.enterprise_id = 0
      `);
      await ensureIndex('shein_full_delivery_orders', 'idx_shein_full_delivery_orders_enterprise_id', 'INDEX idx_shein_full_delivery_orders_enterprise_id (enterprise_id)');
      await ensureIndex('shein_full_delivery_orders', 'idx_shein_full_delivery_orders_enterprise_shop', 'INDEX idx_shein_full_delivery_orders_enterprise_shop (enterprise_id, shop_id)');
    }
  })().catch((error) => {
    ensureTenantColumnsPromise = null;
    throw error;
  });

  return ensureTenantColumnsPromise;
}

module.exports = {
  normalizeEnterpriseId,
  getEnterpriseIdFromRequest,
  getRequiredEnterpriseIdFromRequest,
  runWithRequestContext,
  getCurrentRequestContext,
  getCurrentEnterpriseId,
  ensureTenantColumns
};
