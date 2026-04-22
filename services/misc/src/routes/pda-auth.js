/**
 * PDA认证路由
 * 支持企业员工和物流商两种登录方式
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, LogisticsProvider } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// PDA登录 - 企业员工或物流商
router.post('/pda-login', async (req, res) => {
  try {
    const { username, password, userType } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名和密码不能为空'
      });
    }

    if (!userType || !['employee', 'logistics'].includes(userType)) {
      return res.status(400).json({
        success: false,
        message: '请选择登录类型'
      });
    }

    let user = null;
    let userData = null;

    // 企业员工登录
    if (userType === 'employee') {
      user = await User.findOne({
        where: { username, status: 'ACTIVE' }
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: '用户名或密码错误'
        });
      }

      // 检查PDA访问权限
      if (!user.pda_access) {
        return res.status(403).json({
          success: false,
          message: '该账号无PDA访问权限，请联系管理员'
        });
      }

      // 验证密码
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: '用户名或密码错误'
        });
      }

      // 更新登录信息
      await user.update({
        last_login_at: new Date(),
        login_count: user.login_count + 1
      });

      userData = {
        id: user.id,
        user_id: user.user_id,
        username: user.username,
        real_name: user.real_name,
        phone: user.phone,
        role: user.role,
        user_type: 'employee'
      };
    }
    // 物流商登录
    else if (userType === 'logistics') {
      user = await LogisticsProvider.findOne({
        where: {
          login_username: username,
          login_enabled: 1,
          is_active: true
        }
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: '用户名或密码错误'
        });
      }

      // 检查PDA访问权限
      if (!user.pda_access) {
        return res.status(403).json({
          success: false,
          message: '该物流商无PDA访问权限'
        });
      }

      // 验证密码
      const isPasswordValid = await bcrypt.compare(password, user.login_password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: '用户名或密码错误'
        });
      }

      // 更新登录信息
      await user.update({
        last_login_at: new Date(),
        login_count: user.login_count + 1
      });

      userData = {
        id: user.id,
        logistics_id: user.id,
        username: user.login_username,
        provider_name: user.provider_name,
        contact_person: user.contact_person,
        contact_phone: user.contact_phone,
        user_type: 'logistics'
      };
    }

    // 生成JWT Token
    const token = jwt.sign(
      {
        id: userData.id,
        username: userData.username,
        user_type: userType
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 记录登录日志
    await logPDALogin({
      user_type: userType,
      user_id: userData.id,
      username: userData.username,
      login_status: 'SUCCESS',
      ip_address: req.ip
    });

    res.json({
      success: true,
      message: '登录成功',
      token,
      user: userData
    });

  } catch (error) {
    console.error('[PDA登录] 错误:', error);
    res.status(500).json({
      success: false,
      message: '登录失败，请稍后重试'
    });
  }
});

// 获取物流商列表（用于物流商选择）
router.get('/logistics-list', async (req, res) => {
  try {
    const logistics = await LogisticsProvider.findAll({
      where: {
        login_enabled: 1,
        is_active: true,
        pda_access: 1
      },
      attributes: ['id', 'provider_name', 'provider_code', 'logo_url', 'contact_person'],
      order: [['priority', 'DESC'], ['provider_name', 'ASC']]
    });

    res.json({
      success: true,
      data: logistics
    });
  } catch (error) {
    console.error('[获取物流商列表] 错误:', error);
    res.status(500).json({
      success: false,
      message: '获取物流商列表失败'
    });
  }
});

// 验证Token
router.post('/verify-token', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token不能为空'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // 根据用户类型查询用户信息
    let user = null;
    if (decoded.user_type === 'employee') {
      user = await User.findOne({
        where: { id: decoded.id, status: 'ACTIVE' }
      });
    } else if (decoded.user_type === 'logistics') {
      user = await LogisticsProvider.findOne({
        where: { id: decoded.id, is_active: true }
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token无效'
      });
    }

    res.json({
      success: true,
      user: decoded
    });

  } catch (error) {
    console.error('[验证Token] 错误:', error);
    res.status(401).json({
      success: false,
      message: 'Token无效或已过期'
    });
  }
});

// 记录PDA登录日志
async function logPDALogin(logData) {
  try {
    const { sequelize } = require('../models');
    await sequelize.query(
      `INSERT INTO pda_login_logs (user_type, user_id, username, login_status, fail_reason, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      {
        replacements: [
          logData.user_type,
          logData.user_id,
          logData.username,
          logData.login_status,
          logData.fail_reason || null,
          logData.ip_address
        ]
      }
    );
  } catch (error) {
    console.error('[记录PDA登录日志] 错误:', error);
  }
}

module.exports = router;
