const express = require('express');
const bcrypt = require('bcryptjs');
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../db');
const { requirePlatformAuth } = require('../middleware/auth');

const router = express.Router();

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
    const providers = await sequelize.query(
      'SELECT id, provider_code, provider_name, status, updated_at FROM platform_provider_credentials ORDER BY id ASC',
      { type: QueryTypes.SELECT }
    );

    return res.json({ success: true, data: providers });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
