const { QueryTypes } = require('sequelize');
const { AsyncLocalStorage } = require('async_hooks');
const { sequelize } = require('../models');

const requestContextStorage = new AsyncLocalStorage();
let businessTenantColumnsPromise = null;

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS enterprises (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    enterprise_code VARCHAR(32) NOT NULL UNIQUE,
    company_name VARCHAR(200) NOT NULL,
    company_short_name VARCHAR(50),
    logo_url VARCHAR(500),
    contact_person VARCHAR(100),
    contact_phone VARCHAR(30),
    contact_email VARCHAR(100),
    address VARCHAR(255),
    business_license VARCHAR(100),
    tax_number VARCHAR(100),
    bank_name VARCHAR(100),
    bank_account VARCHAR(100),
    extra_info TEXT,
    owner_user_id BIGINT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_enterprises_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS enterprise_members (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    enterprise_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    member_type VARCHAR(30) NOT NULL DEFAULT 'member',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    is_owner TINYINT(1) NOT NULL DEFAULT 0,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_by BIGINT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_enterprise_member (enterprise_id, user_id),
    INDEX idx_enterprise_members_status (status),
    INDEX idx_enterprise_members_enterprise (enterprise_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS enterprise_join_requests (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    enterprise_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    applicant_message VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    reviewed_by BIGINT,
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_enterprise_join_requests_status (status),
    INDEX idx_enterprise_join_requests_enterprise (enterprise_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS plans (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    plan_code VARCHAR(50) NOT NULL UNIQUE,
    plan_name VARCHAR(100) NOT NULL,
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
    price DECIMAL(12,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_plans_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS enterprise_subscriptions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    enterprise_id BIGINT NOT NULL,
    plan_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expired_at DATETIME,
    auto_renew TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_enterprise_subscriptions_enterprise (enterprise_id),
    INDEX idx_enterprise_subscriptions_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
];

let schemaReady = false;

function toNumber(value) {
  return value === null || value === undefined ? null : Number(value);
}

function serializeExtraInfo(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value);
}

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

async function ensureBusinessTenantColumns() {
  if (businessTenantColumnsPromise) {
    return businessTenantColumnsPromise;
  }

  businessTenantColumnsPromise = (async () => {
    await ensureColumn('suppliers', 'enterprise_id', 'BIGINT NOT NULL DEFAULT 0 AFTER id');
    await ensureColumn('logistics_providers', 'enterprise_id', 'BIGINT NOT NULL DEFAULT 0 AFTER id');

    await ensureIndex('suppliers', 'idx_suppliers_enterprise_id', 'INDEX idx_suppliers_enterprise_id (enterprise_id)');
    await ensureIndex('logistics_providers', 'idx_logistics_providers_enterprise_id', 'INDEX idx_logistics_providers_enterprise_id (enterprise_id)');
  })().catch((error) => {
    businessTenantColumnsPromise = null;
    throw error;
  });

  return businessTenantColumnsPromise;
}

function generateEnterpriseCode(companyName = '') {
  const base = companyName
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '')
    .toUpperCase()
    .slice(0, 6);
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${base || 'ENT'}${random}`;
}

function mapEnterpriseRow(row) {
  return {
    id: toNumber(row.id),
    enterpriseCode: row.enterprise_code,
    companyName: row.company_name,
    companyShortName: row.company_short_name,
    logoUrl: row.logo_url || null,
    contactPerson: row.contact_person || null,
    contactPhone: row.contact_phone || null,
    contactEmail: row.contact_email || null,
    address: row.address || null,
    businessLicense: row.business_license || null,
    taxNumber: row.tax_number || null,
    bankName: row.bank_name || null,
    bankAccount: row.bank_account || null,
    extraInfo: row.extra_info || null,
    ownerUserId: toNumber(row.owner_user_id),
    enterpriseStatus: row.enterprise_status || row.status,
    memberType: row.member_type || null,
    membershipStatus: row.membership_status || null,
    isOwner: Boolean(row.is_owner),
    joinedAt: row.joined_at || null,
    planId: toNumber(row.plan_id),
    planCode: row.plan_code || null,
    planName: row.plan_name || null,
    subscriptionStatus: row.subscription_status || null,
    expiredAt: row.expired_at || null
  };
}

function pickCurrentEnterprise(enterprises, preferredEnterpriseId) {
  if (!enterprises.length) {
    return null;
  }

  const activeEnterprises = enterprises.filter((item) => item.membershipStatus === 'ACTIVE' && item.enterpriseStatus === 'ACTIVE');

  if (preferredEnterpriseId) {
    const matched = activeEnterprises.find((item) => item.id === Number(preferredEnterpriseId));
    if (matched) {
      return matched;
    }
  }

  return activeEnterprises[0] || enterprises[0];
}

async function ensureTenantTables() {
  if (schemaReady) {
    return;
  }

  for (const statement of schemaStatements) {
    await sequelize.query(statement);
  }

  await ensureColumn('enterprises', 'logo_url', 'VARCHAR(500) NULL AFTER company_short_name');
  await ensureColumn('enterprises', 'contact_person', 'VARCHAR(100) NULL AFTER logo_url');
  await ensureColumn('enterprises', 'contact_phone', 'VARCHAR(30) NULL AFTER contact_person');
  await ensureColumn('enterprises', 'contact_email', 'VARCHAR(100) NULL AFTER contact_phone');
  await ensureColumn('enterprises', 'address', 'VARCHAR(255) NULL AFTER contact_email');
  await ensureColumn('enterprises', 'business_license', 'VARCHAR(100) NULL AFTER address');
  await ensureColumn('enterprises', 'tax_number', 'VARCHAR(100) NULL AFTER business_license');
  await ensureColumn('enterprises', 'bank_name', 'VARCHAR(100) NULL AFTER tax_number');
  await ensureColumn('enterprises', 'bank_account', 'VARCHAR(100) NULL AFTER bank_name');
  await ensureColumn('enterprises', 'extra_info', 'TEXT NULL AFTER bank_account');

  await sequelize.query(
    `INSERT IGNORE INTO plans (plan_code, plan_name, billing_cycle, price, status)
     VALUES ('free', '免费版', 'monthly', 0, 'ACTIVE')`
  );

  schemaReady = true;
}

async function getEnterpriseById(enterpriseId) {
  await ensureTenantTables();

  const enterprises = await sequelize.query(
    'SELECT * FROM enterprises WHERE id = :enterpriseId LIMIT 1',
    {
      replacements: { enterpriseId },
      type: QueryTypes.SELECT
    }
  );

  return enterprises[0] || null;
}

async function getEnterpriseByCode(enterpriseCode) {
  await ensureTenantTables();

  const enterprises = await sequelize.query(
    'SELECT * FROM enterprises WHERE enterprise_code = :enterpriseCode LIMIT 1',
    {
      replacements: { enterpriseCode },
      type: QueryTypes.SELECT
    }
  );

  return enterprises[0] || null;
}

async function getUserEnterpriseContext(userId, preferredEnterpriseId) {
  await ensureTenantTables();

  const rows = await sequelize.query(
    `SELECT e.id,
            e.enterprise_code,
            e.company_name,
            e.company_short_name,
            e.logo_url,
            e.contact_person,
            e.contact_phone,
            e.contact_email,
            e.address,
            e.business_license,
            e.tax_number,
            e.bank_name,
            e.bank_account,
            e.extra_info,
            e.owner_user_id,
            e.status AS enterprise_status,
            em.member_type,
            em.status AS membership_status,
            em.is_owner,
            em.joined_at,
            p.id AS plan_id,
            p.plan_code,
            p.plan_name,
            es.status AS subscription_status,
            es.expired_at
     FROM enterprise_members em
     JOIN enterprises e ON e.id = em.enterprise_id
     LEFT JOIN enterprise_subscriptions es ON es.enterprise_id = e.id AND es.status = 'ACTIVE'
     LEFT JOIN plans p ON p.id = es.plan_id
     WHERE em.user_id = :userId
       AND em.status = 'ACTIVE'
       AND e.status = 'ACTIVE'
     ORDER BY em.is_owner DESC, em.id ASC`,
    {
      replacements: { userId },
      type: QueryTypes.SELECT
    }
  );

  const enterprises = rows.map(mapEnterpriseRow);
  const currentEnterprise = pickCurrentEnterprise(enterprises, preferredEnterpriseId);

  return {
    enterprises,
    currentEnterprise,
    hasEnterprises: enterprises.length > 0,
    currentEnterpriseId: currentEnterprise?.id || null
  };
}

async function createEnterpriseForUser({
  userId,
  companyName,
  companyShortName,
  logoUrl,
  contactPerson,
  contactPhone,
  contactEmail,
  address,
  businessLicense,
  taxNumber,
  bankName,
  bankAccount,
  extraInfo
}) {
  await ensureTenantTables();

  if (!companyName) {
    throw new Error('企业名称不能为空');
  }

  let enterpriseCode = generateEnterpriseCode(companyName);
  let existingEnterprise = await getEnterpriseByCode(enterpriseCode);
  while (existingEnterprise) {
    enterpriseCode = generateEnterpriseCode(companyName);
    existingEnterprise = await getEnterpriseByCode(enterpriseCode);
  }

  await sequelize.query(
    `INSERT INTO enterprises (
       enterprise_code,
       company_name,
       company_short_name,
       logo_url,
       contact_person,
       contact_phone,
       contact_email,
       address,
       business_license,
       tax_number,
       bank_name,
       bank_account,
       extra_info,
       owner_user_id,
       status,
       created_at,
       updated_at
     ) VALUES (
       :enterpriseCode,
       :companyName,
       :companyShortName,
       :logoUrl,
       :contactPerson,
       :contactPhone,
       :contactEmail,
       :address,
       :businessLicense,
       :taxNumber,
       :bankName,
       :bankAccount,
       :extraInfo,
       :userId,
       'ACTIVE',
       NOW(),
       NOW()
     )`,
    {
      replacements: {
        enterpriseCode,
        companyName,
        companyShortName: companyShortName || companyName,
        logoUrl: logoUrl || null,
        contactPerson: contactPerson || null,
        contactPhone: contactPhone || null,
        contactEmail: contactEmail || null,
        address: address || null,
        businessLicense: businessLicense || null,
        taxNumber: taxNumber || null,
        bankName: bankName || null,
        bankAccount: bankAccount || null,
        extraInfo: serializeExtraInfo(extraInfo),
        userId
      },
      type: QueryTypes.INSERT
    }
  );

  const enterprise = await getEnterpriseByCode(enterpriseCode);

  await sequelize.query(
    `INSERT INTO enterprise_members (enterprise_id, user_id, member_type, status, is_owner, joined_at, approved_by, created_at, updated_at)
     VALUES (:enterpriseId, :userId, 'owner', 'ACTIVE', 1, NOW(), :userId, NOW(), NOW())`,
    {
      replacements: {
        enterpriseId: enterprise.id,
        userId
      },
      type: QueryTypes.INSERT
    }
  );

  const freePlans = await sequelize.query(
    'SELECT id FROM plans WHERE plan_code = :planCode LIMIT 1',
    {
      replacements: { planCode: 'free' },
      type: QueryTypes.SELECT
    }
  );

  if (freePlans.length > 0) {
    await sequelize.query(
      `INSERT INTO enterprise_subscriptions (enterprise_id, plan_id, status, started_at, auto_renew, created_at, updated_at)
       SELECT :enterpriseId, :planId, 'ACTIVE', NOW(), 0, NOW(), NOW()
       FROM DUAL
       WHERE NOT EXISTS (
         SELECT 1 FROM enterprise_subscriptions WHERE enterprise_id = :enterpriseId
       )`,
      {
        replacements: {
          enterpriseId: enterprise.id,
          planId: freePlans[0].id
        },
        type: QueryTypes.INSERT
      }
    );
  }

  const context = await getUserEnterpriseContext(userId, enterprise.id);
  return context.currentEnterprise;
}

async function createJoinRequest({ userId, enterpriseCode, applicantMessage }) {
  await ensureTenantTables();

  const enterprise = await getEnterpriseByCode(enterpriseCode);
  if (!enterprise) {
    throw new Error('企业编码不存在');
  }

  const existingMembers = await sequelize.query(
    'SELECT id, status FROM enterprise_members WHERE enterprise_id = :enterpriseId AND user_id = :userId LIMIT 1',
    {
      replacements: { enterpriseId: enterprise.id, userId },
      type: QueryTypes.SELECT
    }
  );

  if (existingMembers.length > 0 && existingMembers[0].status === 'ACTIVE') {
    return {
      status: 'ACTIVE',
      alreadyMember: true,
      enterprise: mapEnterpriseRow(enterprise)
    };
  }

  const pendingRequests = await sequelize.query(
    `SELECT id, enterprise_id, status, applicant_message, created_at
     FROM enterprise_join_requests
     WHERE enterprise_id = :enterpriseId AND user_id = :userId AND status = 'PENDING'
     ORDER BY id DESC
     LIMIT 1`,
    {
      replacements: { enterpriseId: enterprise.id, userId },
      type: QueryTypes.SELECT
    }
  );

  if (pendingRequests.length > 0) {
    return {
      status: 'PENDING',
      alreadyPending: true,
      joinRequest: pendingRequests[0],
      enterprise: mapEnterpriseRow(enterprise)
    };
  }

  await sequelize.query(
    `INSERT INTO enterprise_join_requests (enterprise_id, user_id, applicant_message, status, created_at, updated_at)
     VALUES (:enterpriseId, :userId, :applicantMessage, 'PENDING', NOW(), NOW())`,
    {
      replacements: {
        enterpriseId: enterprise.id,
        userId,
        applicantMessage: applicantMessage || null
      },
      type: QueryTypes.INSERT
    }
  );

  const createdRequests = await sequelize.query(
    `SELECT id, enterprise_id, user_id, applicant_message, status, created_at
     FROM enterprise_join_requests
     WHERE enterprise_id = :enterpriseId AND user_id = :userId
     ORDER BY id DESC
     LIMIT 1`,
    {
      replacements: { enterpriseId: enterprise.id, userId },
      type: QueryTypes.SELECT
    }
  );

  return {
    status: 'PENDING',
    joinRequest: createdRequests[0],
    enterprise: mapEnterpriseRow(enterprise)
  };
}

async function assertEnterpriseAdmin(userId, enterpriseId) {
  await ensureTenantTables();

  const memberships = await sequelize.query(
    `SELECT *
     FROM enterprise_members
     WHERE enterprise_id = :enterpriseId
       AND user_id = :userId
       AND status = 'ACTIVE'
       AND (is_owner = 1 OR member_type IN ('owner', 'admin'))
     LIMIT 1`,
    {
      replacements: { enterpriseId, userId },
      type: QueryTypes.SELECT
    }
  );

  if (!memberships.length) {
    throw new Error('当前用户不是企业管理员');
  }

  return memberships[0];
}

async function listEnterpriseMembers(enterpriseId) {
  await ensureTenantTables();

  return sequelize.query(
    `SELECT em.id,
            em.enterprise_id,
            em.user_id,
            em.member_type,
            em.status,
            em.is_owner,
            em.joined_at,
            u.user_id AS user_code,
            u.username,
            u.real_name,
            u.phone,
            u.email
     FROM enterprise_members em
     LEFT JOIN users u ON u.id = em.user_id
     WHERE em.enterprise_id = :enterpriseId
     ORDER BY em.is_owner DESC, em.id ASC`,
    {
      replacements: { enterpriseId },
      type: QueryTypes.SELECT
    }
  );
}

async function listJoinRequests(enterpriseId, status = 'PENDING') {
  await ensureTenantTables();

  const statusClause = status ? 'AND r.status = :status' : '';
  return sequelize.query(
    `SELECT r.id,
            r.enterprise_id,
            r.user_id,
            r.applicant_message,
            r.status,
            r.reviewed_by,
            r.reviewed_at,
            r.created_at,
            u.user_id AS user_code,
            u.username,
            u.real_name,
            u.phone,
            u.email
     FROM enterprise_join_requests r
     LEFT JOIN users u ON u.id = r.user_id
     WHERE r.enterprise_id = :enterpriseId ${statusClause}
     ORDER BY r.id DESC`,
    {
      replacements: { enterpriseId, status },
      type: QueryTypes.SELECT
    }
  );
}

async function listUserJoinRequests(userId, status) {
  await ensureTenantTables();

  const statusClause = status ? 'AND r.status = :status' : '';
  return sequelize.query(
    `SELECT r.id,
            r.enterprise_id,
            r.user_id,
            r.applicant_message,
            r.status,
            r.reviewed_by,
            r.reviewed_at,
            r.created_at,
            e.enterprise_code,
            e.company_name,
            e.company_short_name
     FROM enterprise_join_requests r
     JOIN enterprises e ON e.id = r.enterprise_id
     WHERE r.user_id = :userId ${statusClause}
     ORDER BY r.id DESC`,
    {
      replacements: { userId, status },
      type: QueryTypes.SELECT
    }
  );
}

async function approveJoinRequest({ reviewerUserId, requestId }) {
  await ensureTenantTables();

  const requests = await sequelize.query(
    'SELECT * FROM enterprise_join_requests WHERE id = :requestId LIMIT 1',
    {
      replacements: { requestId },
      type: QueryTypes.SELECT
    }
  );

  if (!requests.length) {
    throw new Error('加入申请不存在');
  }

  const joinRequest = requests[0];
  if (joinRequest.status !== 'PENDING') {
    throw new Error('该申请已处理');
  }

  await assertEnterpriseAdmin(reviewerUserId, joinRequest.enterprise_id);

  const existingMembers = await sequelize.query(
    'SELECT id, status FROM enterprise_members WHERE enterprise_id = :enterpriseId AND user_id = :userId LIMIT 1',
    {
      replacements: { enterpriseId: joinRequest.enterprise_id, userId: joinRequest.user_id },
      type: QueryTypes.SELECT
    }
  );

  if (existingMembers.length > 0) {
    await sequelize.query(
      `UPDATE enterprise_members
       SET status = 'ACTIVE', member_type = COALESCE(member_type, 'member'), approved_by = :reviewerUserId, updated_at = NOW()
       WHERE id = :membershipId`,
      {
        replacements: {
          reviewerUserId,
          membershipId: existingMembers[0].id
        },
        type: QueryTypes.UPDATE
      }
    );
  } else {
    await sequelize.query(
      `INSERT INTO enterprise_members (enterprise_id, user_id, member_type, status, is_owner, joined_at, approved_by, created_at, updated_at)
       VALUES (:enterpriseId, :userId, 'member', 'ACTIVE', 0, NOW(), :reviewerUserId, NOW(), NOW())`,
      {
        replacements: {
          enterpriseId: joinRequest.enterprise_id,
          userId: joinRequest.user_id,
          reviewerUserId
        },
        type: QueryTypes.INSERT
      }
    );
  }

  await sequelize.query(
    `UPDATE enterprise_join_requests
     SET status = 'APPROVED', reviewed_by = :reviewerUserId, reviewed_at = NOW(), updated_at = NOW()
     WHERE id = :requestId`,
    {
      replacements: { reviewerUserId, requestId },
      type: QueryTypes.UPDATE
    }
  );

  const result = await sequelize.query(
    'SELECT * FROM enterprise_join_requests WHERE id = :requestId LIMIT 1',
    {
      replacements: { requestId },
      type: QueryTypes.SELECT
    }
  );

  return result[0];
}

async function rejectJoinRequest({ reviewerUserId, requestId }) {
  await ensureTenantTables();

  const requests = await sequelize.query(
    'SELECT * FROM enterprise_join_requests WHERE id = :requestId LIMIT 1',
    {
      replacements: { requestId },
      type: QueryTypes.SELECT
    }
  );

  if (!requests.length) {
    throw new Error('加入申请不存在');
  }

  const joinRequest = requests[0];
  if (joinRequest.status !== 'PENDING') {
    throw new Error('该申请已处理');
  }

  await assertEnterpriseAdmin(reviewerUserId, joinRequest.enterprise_id);

  await sequelize.query(
    `UPDATE enterprise_join_requests
     SET status = 'REJECTED', reviewed_by = :reviewerUserId, reviewed_at = NOW(), updated_at = NOW()
     WHERE id = :requestId`,
    {
      replacements: { reviewerUserId, requestId },
      type: QueryTypes.UPDATE
    }
  );

  const result = await sequelize.query(
    'SELECT * FROM enterprise_join_requests WHERE id = :requestId LIMIT 1',
    {
      replacements: { requestId },
      type: QueryTypes.SELECT
    }
  );

  return result[0];
}

module.exports = {
  ensureTenantTables,
  ensureBusinessTenantColumns,
  getEnterpriseById,
  getEnterpriseByCode,
  createEnterpriseForUser,
  createJoinRequest,
  getUserEnterpriseContext,
  listEnterpriseMembers,
  listJoinRequests,
  listUserJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  assertEnterpriseAdmin,
  normalizeEnterpriseId,
  getEnterpriseIdFromRequest,
  getRequiredEnterpriseIdFromRequest,
  runWithRequestContext,
  getCurrentEnterpriseId
};
