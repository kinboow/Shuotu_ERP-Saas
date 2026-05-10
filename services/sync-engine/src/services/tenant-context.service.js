const { AsyncLocalStorage } = require('async_hooks');
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const requestContextStorage = new AsyncLocalStorage();
let ensureLegacySheinSchemaPromise = null;
let ensureTenantColumnsPromise = null;

const legacySheinSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS shein_full_shops (
    id INT AUTO_INCREMENT PRIMARY KEY,
    enterprise_id BIGINT NOT NULL DEFAULT 0,
    shop_name VARCHAR(100) NOT NULL,
    app_id VARCHAR(100) NOT NULL,
    app_secret VARCHAR(255) NOT NULL,
    open_key_id VARCHAR(100),
    secret_key VARCHAR(255),
    secret_key_encrypted VARCHAR(255),
    auth_status TINYINT DEFAULT 0,
    auth_time DATETIME,
    is_test TINYINT DEFAULT 0,
    base_url VARCHAR(255) DEFAULT 'https://openapi.sheincorp.cn',
    auth_url VARCHAR(255) DEFAULT 'https://openapi-sem.sheincorp.com',
    extra_config JSON,
    status TINYINT DEFAULT 1,
    last_sync_at DATETIME,
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_shein_full_shops_enterprise_id (enterprise_id),
    INDEX idx_app_id (app_id),
    INDEX idx_auth_status (auth_status),
    INDEX idx_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS shein_full_auth_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    shop_id INT,
    app_id VARCHAR(100),
    action VARCHAR(50) NOT NULL,
    temp_token VARCHAR(100),
    state VARCHAR(255),
    redirect_url TEXT,
    request_data JSON,
    response_data JSON,
    error_message TEXT,
    ip_address VARCHAR(50),
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_shop_id (shop_id),
    INDEX idx_app_id (app_id),
    INDEX idx_action (action),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS shein_full_purchase_orders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    enterprise_id BIGINT NOT NULL DEFAULT 0,
    shop_id INT NOT NULL,
    order_no VARCHAR(50) NOT NULL,
    order_type TINYINT,
    order_type_name VARCHAR(20),
    status INT,
    status_name VARCHAR(50),
    supplier_name VARCHAR(100),
    currency VARCHAR(20),
    warehouse_name VARCHAR(100),
    storage_id VARCHAR(50),
    first_mark TINYINT,
    prepare_type_id INT,
    prepare_type_name VARCHAR(50),
    urgent_type INT,
    is_jit_mother VARCHAR(10),
    add_time DATETIME,
    allocate_time DATETIME,
    delivery_time DATETIME,
    receipt_time DATETIME,
    check_time DATETIME,
    storage_time DATETIME,
    update_time DATETIME,
    request_receipt_time DATETIME,
    request_take_parcel_time DATETIME,
    order_labels JSON,
    goods_level JSON,
    raw_data JSON,
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_shein_full_purchase_enterprise_shop_order (enterprise_id, shop_id, order_no),
    INDEX idx_shein_full_purchase_orders_enterprise_id (enterprise_id),
    INDEX idx_shein_full_purchase_orders_enterprise_shop (enterprise_id, shop_id),
    INDEX idx_status (status),
    INDEX idx_order_type (order_type),
    INDEX idx_add_time (add_time),
    INDEX idx_update_time (update_time)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS shein_full_purchase_order_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT NOT NULL,
    order_no VARCHAR(50) NOT NULL,
    skc VARCHAR(50),
    sku_code VARCHAR(50),
    supplier_code VARCHAR(100),
    supplier_sku VARCHAR(100),
    suffix_zh VARCHAR(100),
    img_path TEXT,
    sku_img TEXT,
    price DECIMAL(10, 2),
    need_quantity INT,
    order_quantity INT,
    delivery_quantity INT,
    receipt_quantity INT,
    storage_quantity INT,
    defective_quantity INT,
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_order_id (order_id),
    INDEX idx_order_no (order_no),
    INDEX idx_skc (skc),
    INDEX idx_sku_code (sku_code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS shein_full_delivery_orders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    enterprise_id BIGINT NOT NULL DEFAULT 0,
    shop_id INT NOT NULL,
    delivery_code VARCHAR(50) NOT NULL,
    delivery_type INT,
    delivery_type_name VARCHAR(50),
    express_id VARCHAR(50),
    express_company_name VARCHAR(100),
    express_code VARCHAR(100),
    send_package INT,
    package_weight DECIMAL(10, 2),
    take_parcel_time DATETIME,
    reserve_parcel_time DATETIME,
    add_time DATETIME,
    pre_receipt_time DATETIME,
    receipt_time DATETIME,
    supplier_warehouse_id BIGINT,
    supplier_warehouse_name VARCHAR(100),
    raw_data JSON,
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_shein_full_delivery_enterprise_shop_code (enterprise_id, shop_id, delivery_code),
    INDEX idx_shein_full_delivery_orders_enterprise_id (enterprise_id),
    INDEX idx_shein_full_delivery_orders_enterprise_shop (enterprise_id, shop_id),
    INDEX idx_add_time (add_time),
    INDEX idx_delivery_type (delivery_type)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS shein_full_delivery_order_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    delivery_id BIGINT NOT NULL,
    delivery_code VARCHAR(50) NOT NULL,
    skc VARCHAR(50),
    sku_code VARCHAR(50),
    order_no VARCHAR(50),
    delivery_quantity INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_shein_full_delivery_item (delivery_id, sku_code, order_no),
    INDEX idx_delivery_id (delivery_id),
    INDEX idx_delivery_code (delivery_code),
    INDEX idx_order_no (order_no),
    INDEX idx_skc (skc)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS shein_full_products (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    shop_id INT NOT NULL,
    spu_name VARCHAR(50) NOT NULL,
    skc_name VARCHAR(50),
    category_id BIGINT,
    product_type_id BIGINT,
    brand_code VARCHAR(50),
    supplier_code VARCHAR(100),
    product_name VARCHAR(500),
    product_desc TEXT,
    product_attributes JSON,
    dimension_attributes JSON,
    spu_images JSON,
    skc_list JSON,
    barcode JSON,
    raw_data JSON,
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_shop_spu (shop_id, spu_name),
    INDEX idx_skc_name (skc_name),
    INDEX idx_category (category_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS shein_full_finance_reports (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    shop_id INT NOT NULL,
    report_order_no VARCHAR(50) NOT NULL,
    sales_total INT,
    replenish_total INT,
    add_time DATETIME,
    last_update_time DATETIME,
    settlement_status INT,
    settlement_status_name VARCHAR(50),
    estimate_pay_time DATETIME,
    completed_pay_time DATETIME,
    company_name VARCHAR(200),
    estimate_income_money_total DECIMAL(12, 2),
    currency_code VARCHAR(10),
    raw_data JSON,
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_shop_report (shop_id, report_order_no),
    INDEX idx_settlement_status (settlement_status),
    INDEX idx_add_time (add_time)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS shein_full_finance_report_sales_details (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    shop_id INT NOT NULL,
    report_order_no VARCHAR(50) NOT NULL,
    detail_id VARCHAR(100) NOT NULL,
    second_order_type INT,
    second_order_type_name VARCHAR(200),
    in_and_out INT,
    in_and_out_name VARCHAR(50),
    bz_order_no VARCHAR(100),
    skc_name VARCHAR(100),
    sku_code VARCHAR(100),
    supplier_sku VARCHAR(100),
    expense_type INT,
    goods_count INT,
    settle_currency_code VARCHAR(10),
    amount DECIMAL(14, 4),
    unit_price DECIMAL(14, 4),
    company_name VARCHAR(200),
    add_time DATETIME,
    raw_data JSON,
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_shop_report_sales_detail (shop_id, report_order_no, detail_id),
    INDEX idx_shop_report_sales (shop_id, report_order_no),
    INDEX idx_bz_order_no_sales (bz_order_no),
    INDEX idx_sku_code_sales (sku_code),
    INDEX idx_add_time_sales (add_time)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS shein_full_finance_report_adjustment_details (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    shop_id INT NOT NULL,
    report_order_no VARCHAR(50) NOT NULL,
    detail_id VARCHAR(100) NOT NULL,
    replenish_no VARCHAR(100),
    replenish_type INT,
    replenish_type_name VARCHAR(50),
    replenish_category VARCHAR(255),
    bz_order_no VARCHAR(100),
    skc_name VARCHAR(100),
    sku_code VARCHAR(100),
    supplier_sku VARCHAR(100),
    expense_type INT,
    goods_count INT,
    settle_currency_code VARCHAR(10),
    amount DECIMAL(14, 4),
    unit_price DECIMAL(14, 4),
    company_name VARCHAR(200),
    add_time DATETIME,
    raw_data JSON,
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_shop_report_adj_detail (shop_id, report_order_no, detail_id),
    INDEX idx_shop_report_adj (shop_id, report_order_no),
    INDEX idx_bz_order_no_adj (bz_order_no),
    INDEX idx_replenish_no_adj (replenish_no),
    INDEX idx_add_time_adj (add_time)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS shein_full_inventory (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    shop_id INT NOT NULL,
    spu_name VARCHAR(50),
    skc_name VARCHAR(50),
    sku_code VARCHAR(50) NOT NULL,
    warehouse_type VARCHAR(10),
    warehouse_code VARCHAR(50),
    total_inventory INT DEFAULT 0,
    locked_quantity INT DEFAULT 0,
    temp_lock_quantity INT DEFAULT 0,
    usable_inventory INT DEFAULT 0,
    transit_quantity INT DEFAULT 0,
    raw_data JSON,
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_shop_sku_warehouse (shop_id, sku_code, warehouse_code),
    INDEX idx_skc_name (skc_name),
    INDEX idx_spu_name (spu_name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS sync_tasks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id VARCHAR(32) UNIQUE NOT NULL,
    platform VARCHAR(20) NOT NULL,
    shop_id INT,
    task_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    params JSON,
    result JSON,
    total_count INT DEFAULT 0,
    success_count INT DEFAULT 0,
    fail_count INT DEFAULT 0,
    error_message TEXT,
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_platform (platform),
    INDEX idx_shop_id (shop_id),
    INDEX idx_task_type (task_type),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
];

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

async function ensureLegacySheinSchema() {
  if (ensureLegacySheinSchemaPromise) {
    return ensureLegacySheinSchemaPromise;
  }

  ensureLegacySheinSchemaPromise = (async () => {
    for (const statement of legacySheinSchemaStatements) {
      await sequelize.query(statement);
    }
  })().catch((error) => {
    ensureLegacySheinSchemaPromise = null;
    throw error;
  });

  return ensureLegacySheinSchemaPromise;
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
  ensureLegacySheinSchema,
  ensureTenantColumns
};
