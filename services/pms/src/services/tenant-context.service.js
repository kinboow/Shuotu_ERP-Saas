const { AsyncLocalStorage } = require('async_hooks');
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');

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
    enterpriseId: getEnterpriseIdFromRequest(req)
  };

  return requestContextStorage.run(context, callback);
}

function getCurrentRequestContext() {
  return requestContextStorage.getStore() || {};
}

function getCurrentEnterpriseId() {
  return normalizeEnterpriseId(getCurrentRequestContext().enterpriseId);
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

async function columnExists(tableName, columnName) {
  const columns = await sequelize.query(
    `SHOW COLUMNS FROM \`${tableName}\` LIKE :columnName`,
    {
      replacements: { columnName },
      type: QueryTypes.SELECT
    }
  );

  return columns.length > 0;
}

async function indexExists(tableName, indexName) {
  const indexes = await sequelize.query(
    `SHOW INDEX FROM \`${tableName}\` WHERE Key_name = :indexName`,
    {
      replacements: { indexName },
      type: QueryTypes.SELECT
    }
  );

  return indexes.length > 0;
}

async function ensureColumn(tableName, columnName, definition) {
  if (!(await tableExists(tableName)) || await columnExists(tableName, columnName)) {
    return;
  }

  await sequelize.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
}

async function ensureIndex(tableName, indexName, definition) {
  if (!(await tableExists(tableName)) || await indexExists(tableName, indexName)) {
    return;
  }

  await sequelize.query(`ALTER TABLE \`${tableName}\` ADD ${definition}`);
}

async function ensureTenantColumns() {
  if (ensureTenantColumnsPromise) {
    return ensureTenantColumnsPromise;
  }

  ensureTenantColumnsPromise = (async () => {
    await ensureColumn('products', 'enterprise_id', 'BIGINT NOT NULL DEFAULT 0 AFTER id');
    await ensureColumn('skus', 'enterprise_id', 'BIGINT NOT NULL DEFAULT 0 AFTER id');
    await ensureColumn('sku_mappings', 'enterprise_id', 'BIGINT NOT NULL DEFAULT 0 AFTER id');

    if (await tableExists('skus')) {
      await sequelize.query(`
        UPDATE skus s
        INNER JOIN products p ON p.product_id = s.product_id
        SET s.enterprise_id = COALESCE(p.enterprise_id, 0)
        WHERE s.enterprise_id = 0
      `);
    }

    if (await tableExists('sku_mappings')) {
      await sequelize.query(`
        UPDATE sku_mappings sm
        INNER JOIN skus s ON s.sku_id = sm.internal_sku_id
        SET sm.enterprise_id = COALESCE(s.enterprise_id, 0)
        WHERE sm.enterprise_id = 0
      `);
    }

    await ensureIndex('products', 'idx_products_enterprise_id', 'INDEX idx_products_enterprise_id (enterprise_id)');
    await ensureIndex('skus', 'idx_skus_enterprise_id', 'INDEX idx_skus_enterprise_id (enterprise_id)');
    await ensureIndex('skus', 'idx_skus_enterprise_product', 'INDEX idx_skus_enterprise_product (enterprise_id, product_id)');
    await ensureIndex('sku_mappings', 'idx_sku_mappings_enterprise_id', 'INDEX idx_sku_mappings_enterprise_id (enterprise_id)');
    await ensureIndex('sku_mappings', 'idx_sku_mappings_enterprise_shop', 'INDEX idx_sku_mappings_enterprise_shop (enterprise_id, platform, shop_id)');
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
  getCurrentEnterpriseId,
  ensureTenantColumns
};
