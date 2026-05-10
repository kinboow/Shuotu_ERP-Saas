const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../db');
const { platformJwtSecret, requirePlatformAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.json({ success: false, message: '用户名和密码不能为空' });
    }

    const users = await sequelize.query(
      'SELECT * FROM platform_users WHERE username = :username AND status = \'ACTIVE\' LIMIT 1',
      {
        replacements: { username },
        type: QueryTypes.SELECT
      }
    );

    if (!users.length) {
      return res.json({ success: false, message: '平台用户不存在或已禁用' });
    }

    const user = users[0];
    const matched = await bcrypt.compare(password, user.password_hash);

    if (!matched) {
      return res.json({ success: false, message: '用户名或密码错误' });
    }

    await sequelize.query(
      'UPDATE platform_users SET last_login_at = NOW() WHERE id = :id',
      { replacements: { id: user.id } }
    );

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        roleCode: user.role_code
      },
      platformJwtSecret,
      { expiresIn: '12h' }
    );

    return res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          realName: user.real_name,
          roleCode: user.role_code,
          email: user.email,
          phone: user.phone
        }
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/me', requirePlatformAuth, async (req, res) => {
  try {
    const users = await sequelize.query(
      'SELECT id, username, real_name, email, phone, role_code, status, last_login_at FROM platform_users WHERE id = :id LIMIT 1',
      {
        replacements: { id: req.platformUser.id },
        type: QueryTypes.SELECT
      }
    );

    if (!users.length) {
      return res.status(404).json({ success: false, message: '平台用户不存在' });
    }

    return res.json({ success: true, data: users[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
