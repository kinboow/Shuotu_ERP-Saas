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
  if (!(await tableExists(tableName))) {
    return false;
  }

  const columns = await sequelize.query(
    `SHOW COLUMNS FROM \`${tableName}\` LIKE :columnName`,
    {
      replacements: { columnName },
      type: QueryTypes.SELECT
    }
  );

  return columns.length > 0;
}

async function columnsExist(tableName, columnNames) {
  for (const columnName of columnNames) {
    if (!(await columnExists(tableName, columnName))) {
      return false;
    }
  }

  return true;
}

async function getIndexes(tableName) {
  if (!(await tableExists(tableName))) {
    return [];
  }

  return sequelize.query(
    `SHOW INDEX FROM \`${tableName}\``,
    {
      type: QueryTypes.SELECT
    }
  );
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

function getGroupedIndexes(indexRows) {
  const groups = new Map();

  indexRows.forEach((row) => {
    if (!groups.has(row.Key_name)) {
      groups.set(row.Key_name, []);
    }
    groups.get(row.Key_name).push(row);
  });

  return groups;
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

  const columnMatch = definition.match(/\(([^)]+)\)/);
  if (columnMatch) {
    const indexColumns = columnMatch[1]
      .split(',')
      .map(column => column.trim().replace(/`/g, ''))
      .filter(Boolean);

    if (indexColumns.length > 0 && !(await columnsExist(tableName, indexColumns))) {
      return;
    }
  }

  if (!(await tableExists(tableName))) {
    return;
  }

  await sequelize.query(`ALTER TABLE \`${tableName}\` ADD ${definition}`);
}

async function dropIndexIfMatches(tableName, expectedColumns, { uniqueOnly = false } = {}) {
  const indexRows = await getIndexes(tableName);
  const groupedIndexes = getGroupedIndexes(indexRows);

  for (const [indexName, rows] of groupedIndexes.entries()) {
    if (indexName === 'PRIMARY') {
      continue;
    }

    const columns = rows
      .sort((left, right) => left.Seq_in_index - right.Seq_in_index)
      .map((row) => row.Column_name);

    if (columns.length !== expectedColumns.length) {
      continue;
    }

    if (columns.some((columnName, index) => columnName !== expectedColumns[index])) {
      continue;
    }

    const isUnique = rows[0].Non_unique === 0;
    if (uniqueOnly && !isUnique) {
      continue;
    }

    await sequelize.query(`ALTER TABLE \`${tableName}\` DROP INDEX \`${indexName}\``);
  }
}

async function ensureTenantColumns() {
  if (ensureTenantColumnsPromise) {
    return ensureTenantColumnsPromise;
  }

  ensureTenantColumnsPromise = (async () => {
    await ensureColumn('inventory', 'enterprise_id', 'BIGINT NOT NULL DEFAULT 0 AFTER id');
    await ensureColumn('warehouses', 'enterprise_id', 'BIGINT NOT NULL DEFAULT 0 AFTER id');
    await ensureColumn('stock_logs', 'enterprise_id', 'BIGINT NOT NULL DEFAULT 0 AFTER id');

    if (
      await tableExists('inventory')
      && await tableExists('warehouses')
      && await columnsExist('inventory', ['warehouse_id', 'enterprise_id'])
      && await columnsExist('warehouses', ['warehouse_id', 'enterprise_id'])
    ) {
      await sequelize.query(`
        UPDATE inventory i
        LEFT JOIN warehouses w ON w.warehouse_id = i.warehouse_id
        SET i.enterprise_id = COALESCE(w.enterprise_id, 0)
        WHERE i.enterprise_id = 0
      `);
    }

    if (
      await tableExists('stock_logs')
      && await tableExists('warehouses')
      && await columnsExist('stock_logs', ['warehouse_id', 'enterprise_id'])
      && await columnsExist('warehouses', ['warehouse_id', 'enterprise_id'])
    ) {
      await sequelize.query(`
        UPDATE stock_logs sl
        LEFT JOIN warehouses w ON w.warehouse_id = sl.warehouse_id
        SET sl.enterprise_id = COALESCE(w.enterprise_id, 0)
        WHERE sl.enterprise_id = 0
      `);
    }

    await dropIndexIfMatches('warehouses', ['warehouse_id'], { uniqueOnly: true });
    await dropIndexIfMatches('inventory', ['sku_id', 'warehouse_id'], { uniqueOnly: true });

    await ensureIndex('warehouses', 'uk_warehouses_enterprise_warehouse', 'UNIQUE INDEX uk_warehouses_enterprise_warehouse (enterprise_id, warehouse_id)');
    await ensureIndex('warehouses', 'idx_warehouses_enterprise_id', 'INDEX idx_warehouses_enterprise_id (enterprise_id)');
    await ensureIndex('inventory', 'uk_inventory_enterprise_sku_warehouse', 'UNIQUE INDEX uk_inventory_enterprise_sku_warehouse (enterprise_id, sku_id, warehouse_id)');
    await ensureIndex('inventory', 'idx_inventory_enterprise_id', 'INDEX idx_inventory_enterprise_id (enterprise_id)');
    await ensureIndex('inventory', 'idx_inventory_enterprise_warehouse', 'INDEX idx_inventory_enterprise_warehouse (enterprise_id, warehouse_id)');
    await ensureIndex('stock_logs', 'idx_stock_logs_enterprise_id', 'INDEX idx_stock_logs_enterprise_id (enterprise_id)');
    await ensureIndex('stock_logs', 'idx_stock_logs_enterprise_sku', 'INDEX idx_stock_logs_enterprise_sku (enterprise_id, sku_id)');
    await ensureIndex('stock_logs', 'idx_stock_logs_enterprise_warehouse', 'INDEX idx_stock_logs_enterprise_warehouse (enterprise_id, warehouse_id)');
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
