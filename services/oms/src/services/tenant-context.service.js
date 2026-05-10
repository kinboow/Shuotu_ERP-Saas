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

    await sequelize.query(`ALTER TABLE ${tableName} ADD ${definition}`);
  }
}

async function ensureOmsTenantColumns() {
  if (ensureTenantColumnsPromise) {
    return ensureTenantColumnsPromise;
  }

  ensureTenantColumnsPromise = (async () => {
    if (await tableExists('orders')) {
      await ensureColumn('orders', 'enterprise_id', 'BIGINT NOT NULL DEFAULT 0 AFTER id');
      await ensureIndex('orders', 'idx_orders_enterprise_id', 'INDEX idx_orders_enterprise_id (enterprise_id)');
      await ensureIndex('orders', 'idx_orders_enterprise_shop_status', 'INDEX idx_orders_enterprise_shop_status (enterprise_id, shop_id, status)');
      await ensureIndex('orders', 'idx_orders_enterprise_platform_order', 'INDEX idx_orders_enterprise_platform_order (enterprise_id, platform, platform_order_id)');
    }

    if (await tableExists('order_items')) {
      await ensureColumn('order_items', 'enterprise_id', 'BIGINT NOT NULL DEFAULT 0 AFTER id');
      if (await tableExists('orders')) {
        await sequelize.query(`
          UPDATE order_items oi
          INNER JOIN orders o ON oi.order_id = o.id
          SET oi.enterprise_id = COALESCE(o.enterprise_id, 0)
          WHERE oi.enterprise_id = 0
        `);
      }
      await ensureIndex('order_items', 'idx_order_items_enterprise_id', 'INDEX idx_order_items_enterprise_id (enterprise_id)');
      await ensureIndex('order_items', 'idx_order_items_enterprise_order', 'INDEX idx_order_items_enterprise_order (enterprise_id, order_id)');
      await ensureIndex('order_items', 'idx_order_items_enterprise_internal_order', 'INDEX idx_order_items_enterprise_internal_order (enterprise_id, internal_order_id)');
    }

    if (await tableExists('order_logs')) {
      await ensureColumn('order_logs', 'enterprise_id', 'BIGINT NOT NULL DEFAULT 0 AFTER id');
      if (await tableExists('orders')) {
        await sequelize.query(`
          UPDATE order_logs ol
          INNER JOIN orders o ON ol.order_id = o.id
          SET ol.enterprise_id = COALESCE(o.enterprise_id, 0)
          WHERE ol.enterprise_id = 0
        `);
      }
      await ensureIndex('order_logs', 'idx_order_logs_enterprise_id', 'INDEX idx_order_logs_enterprise_id (enterprise_id)');
      await ensureIndex('order_logs', 'idx_order_logs_enterprise_order', 'INDEX idx_order_logs_enterprise_order (enterprise_id, order_id)');
      await ensureIndex('order_logs', 'idx_order_logs_enterprise_internal_order', 'INDEX idx_order_logs_enterprise_internal_order (enterprise_id, internal_order_id)');
    }

    if (await tableExists('shipments')) {
      await ensureColumn('shipments', 'enterprise_id', 'BIGINT NOT NULL DEFAULT 0 AFTER id');
      if (await tableExists('orders')) {
        await sequelize.query(`
          UPDATE shipments s
          INNER JOIN orders o ON s.order_id = o.id
          SET s.enterprise_id = COALESCE(o.enterprise_id, 0)
          WHERE s.enterprise_id = 0
        `);
      }
      await ensureIndex('shipments', 'idx_shipments_enterprise_id', 'INDEX idx_shipments_enterprise_id (enterprise_id)');
      await ensureIndex('shipments', 'idx_shipments_enterprise_order', 'INDEX idx_shipments_enterprise_order (enterprise_id, order_id)');
      await ensureIndex('shipments', 'idx_shipments_enterprise_internal_order', 'INDEX idx_shipments_enterprise_internal_order (enterprise_id, internal_order_id)');
    }

    if (await tableExists('shein_full_purchase_orders')) {
      await ensureColumn('shein_full_purchase_orders', 'enterprise_id', 'BIGINT NOT NULL DEFAULT 0 AFTER id');
      await sequelize.query(`
        UPDATE shein_full_purchase_orders po
        INNER JOIN shein_full_shops s ON po.shop_id = s.id
        SET po.enterprise_id = COALESCE(s.enterprise_id, 0)
        WHERE po.enterprise_id = 0
      `);
      await ensureIndex('shein_full_purchase_orders', 'idx_shein_purchase_orders_enterprise_id', 'INDEX idx_shein_purchase_orders_enterprise_id (enterprise_id)');
      await ensureIndex('shein_full_purchase_orders', 'idx_shein_purchase_orders_enterprise_shop', 'INDEX idx_shein_purchase_orders_enterprise_shop (enterprise_id, shop_id)');
    }

    if (await tableExists('shein_full_delivery_orders')) {
      await ensureColumn('shein_full_delivery_orders', 'enterprise_id', 'BIGINT NOT NULL DEFAULT 0 AFTER id');
      await sequelize.query(`
        UPDATE shein_full_delivery_orders d
        INNER JOIN shein_full_shops s ON d.shop_id = s.id
        SET d.enterprise_id = COALESCE(s.enterprise_id, 0)
        WHERE d.enterprise_id = 0
      `);
      await ensureIndex('shein_full_delivery_orders', 'idx_shein_delivery_orders_enterprise_id', 'INDEX idx_shein_delivery_orders_enterprise_id (enterprise_id)');
      await ensureIndex('shein_full_delivery_orders', 'idx_shein_delivery_orders_enterprise_shop', 'INDEX idx_shein_delivery_orders_enterprise_shop (enterprise_id, shop_id)');
    }

    if (await tableExists('shipping_station')) {
      await ensureColumn('shipping_station', 'enterprise_id', 'BIGINT NOT NULL DEFAULT 0 AFTER id');
      if (await tableExists('shein_full_purchase_orders')) {
        await sequelize.query(`
          UPDATE shipping_station ss
          INNER JOIN shein_full_purchase_orders po ON ss.order_id = po.id
          SET ss.enterprise_id = COALESCE(po.enterprise_id, 0)
          WHERE ss.enterprise_id = 0
        `);
      }
      await ensureIndex('shipping_station', 'idx_shipping_station_enterprise_id', 'INDEX idx_shipping_station_enterprise_id (enterprise_id)');
      await ensureIndex('shipping_station', 'idx_shipping_station_enterprise_order', 'INDEX idx_shipping_station_enterprise_order (enterprise_id, order_id)');
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
  ensureOmsTenantColumns
};
