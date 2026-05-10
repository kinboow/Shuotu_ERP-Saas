const express = require('express');
const bcrypt = require('bcryptjs');
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../db');
const { requirePlatformAuth } = require('../middleware/auth');

const router = express.Router();

 const defaultGlobalPlatforms = [
  {
    platformName: 'shein_full',
    platformDisplayName: 'SHEIN(全托管)',
    baseUrl: 'https://openapi.sheincorp.cn',
    authUrl: 'https://openapi-sem.sheincorp.com',
    callbackUrl: '/auth/shein-full/callback',
    sortOrder: 1
  },
  {
    platformName: 'temu',
    platformDisplayName: 'TEMU',
    baseUrl: 'https://openapi.temupay.com',
    authUrl: null,
    callbackUrl: null,
    sortOrder: 2
  },
  {
    platformName: 'tiktok',
    platformDisplayName: 'TikTok Shop',
    baseUrl: 'https://open-api.tiktokglobalshop.com',
    authUrl: null,
    callbackUrl: null,
    sortOrder: 3
  }
 ];

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

  const [column] = await sequelize.query(
    `SHOW COLUMNS FROM \`${tableName}\` LIKE :columnName`,
    {
      replacements: { columnName },
      type: QueryTypes.SELECT
    }
  );

  return Boolean(column);
 }

 async function ensureColumn(tableName, columnName, definition) {
  if (await columnExists(tableName, columnName)) {
    return;
  }

  await sequelize.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
 }

 async function ensureGlobalPlatformConfigs() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS platform_configs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      enterprise_id BIGINT NOT NULL DEFAULT 0,
      platform_name VARCHAR(50) NOT NULL,
      platform_display_name VARCHAR(100),
      base_url VARCHAR(255),
      auth_url VARCHAR(255),
      callback_url VARCHAR(500),
      app_key VARCHAR(255),
      app_secret VARCHAR(255),
      extra_config JSON,
      status TINYINT DEFAULT 1,
      sort_order INT DEFAULT 0,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_platform_configs_enterprise_platform (enterprise_id, platform_name),
      INDEX idx_platform_configs_enterprise_id (enterprise_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await ensureColumn('platform_configs', 'enterprise_id', 'BIGINT NOT NULL DEFAULT 0 AFTER id');
  await ensureColumn('platform_configs', 'auth_url', 'VARCHAR(255) NULL AFTER base_url');
  await ensureColumn('platform_configs', 'callback_url', 'VARCHAR(500) NULL AFTER auth_url');

  for (const platform of defaultGlobalPlatforms) {
    await sequelize.query(
      `INSERT IGNORE INTO platform_configs
       (enterprise_id, platform_name, platform_display_name, base_url, auth_url, callback_url, status, sort_order)
       VALUES (0, :platformName, :platformDisplayName, :baseUrl, :authUrl, :callbackUrl, 1, :sortOrder)`,
      {
        replacements: platform,
        type: QueryTypes.INSERT
      }
    );
  }
 }

 function normalizePlatformConfig(row) {
  let extraConfig = row.extra_config;

  if (typeof extraConfig === 'string') {
    try {
      extraConfig = JSON.parse(extraConfig);
    } catch (error) {
      extraConfig = null;
    }
  }

  return {
    ...row,
    extra_config: extraConfig,
    status: Number(row.status) === 1 ? 1 : 0,
    is_active: Number(row.status) === 1
  };
 }

 function parseExtraConfig(extraConfig) {
  if (extraConfig === undefined || extraConfig === null || extraConfig === '') {
    return null;
  }

  if (typeof extraConfig === 'string') {
    return JSON.parse(extraConfig);
  }

  if (typeof extraConfig === 'object') {
    return extraConfig;
  }

  throw new Error('extraConfig 必须是对象或 JSON 字符串');
 }

router.use(requirePlatformAuth);

router.get('/overview', async (req, res) => {
  try {
    const [[enterpriseCount], [memberCount], [platformUserCount], [planCount], [subscriptionCount]] = await Promise.all([
      sequelize.query('SELECT COUNT(*) AS count FROM enterprises', { type: QueryTypes.SELECT }),
      sequelize.query('SELECT COUNT(*) AS count FROM enterprise_members', { type: QueryTypes.SELECT }),
      sequelize.query('SELECT COUNT(*) AS count FROM platform_users', { type: QueryTypes.SELECT }),
      sequelize.query('SELECT COUNT(*) AS count FROM plans', { type: QueryTypes.SELECT }),
      sequelize.query('SELECT COUNT(*) AS count FROM enterprise_subscriptions', { type: QueryTypes.SELECT })
    ]);

    return res.json({
      success: true,
      data: {
        enterpriseCount: Number(enterpriseCount.count || 0),
        memberCount: Number(memberCount.count || 0),
        platformUserCount: Number(platformUserCount.count || 0),
        planCount: Number(planCount.count || 0),
        subscriptionCount: Number(subscriptionCount.count || 0)
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/users', async (req, res) => {
  try {
    const users = await sequelize.query(
      'SELECT id, username, real_name, email, phone, role_code, status, last_login_at, created_at FROM platform_users ORDER BY id DESC',
      { type: QueryTypes.SELECT }
    );

    return res.json({ success: true, data: users });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/users', async (req, res) => {
  try {
    const { username, password, realName, email, phone, roleCode = 'platform_operator' } = req.body;

    if (!username || !password) {
      return res.json({ success: false, message: '用户名和密码不能为空' });
    }

    const existing = await sequelize.query(
      'SELECT id FROM platform_users WHERE username = :username LIMIT 1',
      {
        replacements: { username },
        type: QueryTypes.SELECT
      }
    );

    if (existing.length) {
      return res.json({ success: false, message: '平台用户名已存在' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await sequelize.query(
      `INSERT INTO platform_users (username, password_hash, real_name, email, phone, role_code, status)
       VALUES (:username, :passwordHash, :realName, :email, :phone, :roleCode, 'ACTIVE')`,
      {
        replacements: {
          username,
          passwordHash,
          realName: realName || null,
          email: email || null,
          phone: phone || null,
          roleCode
        },
        type: QueryTypes.INSERT
      }
    );

    return res.json({ success: true, message: '平台用户创建成功' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/enterprises', async (req, res) => {
  try {
    const enterprises = await sequelize.query(
      `SELECT e.*, 
          (SELECT COUNT(*) FROM enterprise_members em WHERE em.enterprise_id = e.id AND em.status = 'ACTIVE') AS member_count,
          p.plan_name,
          es.status AS subscription_status,
          es.expired_at
       FROM enterprises e
       LEFT JOIN enterprise_subscriptions es ON es.enterprise_id = e.id
       LEFT JOIN plans p ON p.id = es.plan_id
       ORDER BY e.id DESC`,
      { type: QueryTypes.SELECT }
    );

    return res.json({ success: true, data: enterprises });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/plans', async (req, res) => {
  try {
    const plans = await sequelize.query(
      `SELECT p.*, COUNT(pf.id) AS feature_count
       FROM plans p
       LEFT JOIN plan_features pf ON pf.plan_id = p.id AND pf.enabled = 1
       GROUP BY p.id
       ORDER BY p.price ASC, p.id ASC`,
      { type: QueryTypes.SELECT }
    );

    return res.json({ success: true, data: plans });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/provider-credentials', async (req, res) => {
  try {
    await ensureGlobalPlatformConfigs();

    const providers = await sequelize.query(
      `SELECT id, enterprise_id, platform_name, platform_display_name, base_url, auth_url, callback_url,
              app_key, app_secret, extra_config, status, sort_order, remark, created_at, updated_at
       FROM platform_configs
       WHERE enterprise_id = 0
       ORDER BY sort_order ASC, id ASC`,
      { type: QueryTypes.SELECT }
    );

    return res.json({ success: true, data: providers.map(normalizePlatformConfig) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

 router.put('/provider-credentials/:platformName', async (req, res) => {
  try {
    await ensureGlobalPlatformConfigs();

    const { platformName } = req.params;
    const {
      platformDisplayName,
      baseUrl,
      authUrl,
      appKey,
      appSecret,
      extraConfig,
      status,
      sortOrder,
      remark
    } = req.body;

    const parsedExtraConfig = parseExtraConfig(extraConfig);
    const numericStatus = Number(status) === 0 ? 0 : 1;
    const numericSortOrder = Number.isNaN(Number(sortOrder)) ? 0 : Number(sortOrder);

    const [existing] = await sequelize.query(
      `SELECT id
       FROM platform_configs
       WHERE enterprise_id = 0 AND platform_name = :platformName
       LIMIT 1`,
      {
        replacements: { platformName },
        type: QueryTypes.SELECT
      }
    );

    if (existing?.id) {
      await sequelize.query(
        `UPDATE platform_configs
         SET platform_display_name = :platformDisplayName,
             base_url = :baseUrl,
             auth_url = :authUrl,
             callback_url = :callbackUrl,
             app_key = :appKey,
             app_secret = :appSecret,
             extra_config = :extraConfig,
             status = :status,
             sort_order = :sortOrder,
             remark = :remark
         WHERE id = :id`,
        {
          replacements: {
            id: existing.id,
            platformDisplayName: platformDisplayName || platformName,
            baseUrl: baseUrl || null,
            authUrl: authUrl || null,
            appKey: appKey || null,
            appSecret: appSecret || null,
            extraConfig: parsedExtraConfig ? JSON.stringify(parsedExtraConfig) : null,
            status: numericStatus,
            sortOrder: numericSortOrder,
            remark: remark || null
          },
          type: QueryTypes.UPDATE
        }
      );
    } else {
      await sequelize.query(
        `INSERT INTO platform_configs
         (enterprise_id, platform_name, platform_display_name, base_url, auth_url, callback_url, app_key, app_secret, extra_config, status, sort_order, remark)
         VALUES (0, :platformName, :platformDisplayName, :baseUrl, :authUrl, :callbackUrl, :appKey, :appSecret, :extraConfig, :status, :sortOrder, :remark)`,
        {
          replacements: {
            platformName,
            platformDisplayName: platformDisplayName || platformName,
            baseUrl: baseUrl || null,
            authUrl: authUrl || null,
            callbackUrl: platformName === 'shein_full' ? '/auth/shein-full/callback' : null,
            appKey: appKey || null,
            appSecret: appSecret || null,
            extraConfig: parsedExtraConfig ? JSON.stringify(parsedExtraConfig) : null,
            status: numericStatus,
            sortOrder: numericSortOrder,
            remark: remark || null
          },
          type: QueryTypes.INSERT
        }
      );
    }

    const [provider] = await sequelize.query(
      `SELECT id, enterprise_id, platform_name, platform_display_name, base_url, auth_url, callback_url,
              app_key, app_secret, extra_config, status, sort_order, remark, created_at, updated_at
       FROM platform_configs
       WHERE enterprise_id = 0 AND platform_name = :platformName
       LIMIT 1`,
      {
        replacements: { platformName },
        type: QueryTypes.SELECT
      }
    );

    return res.json({
      success: true,
      message: '平台配置保存成功',
      data: normalizePlatformConfig(provider)
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
 });

module.exports = router;
