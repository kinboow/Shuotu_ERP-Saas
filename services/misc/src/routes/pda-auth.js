/**
 * PDA认证路由
 * 支持企业员工和物流商两种登录方式
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, LogisticsProvider } = require('../models');
const {
  ensureBusinessTenantColumns,
  getEnterpriseIdFromRequest,
  getEnterpriseById,
  getEnterpriseByCode,
  getUserEnterpriseContext
} = require('../services/enterprise-context');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

function buildError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getEnterpriseCodeFromRequest(req) {
  const rawEnterpriseCode = req.body?.enterpriseCode ?? req.query?.enterpriseCode ?? req.headers['x-enterprise-code'] ?? null;
  if (typeof rawEnterpriseCode !== 'string') {
    return null;
  }

  const normalizedEnterpriseCode = rawEnterpriseCode.trim().toUpperCase();
  return normalizedEnterpriseCode || null;
}

function getGlobalEnterpriseScope() {
  return {
    enterpriseId: 0,
    enterpriseCode: '0',
    enterpriseName: '默认企业'
  };
}

function mapEnterpriseScope(enterprise) {
  return {
    enterpriseId: Number(enterprise.id),
    enterpriseCode: enterprise.enterprise_code,
    enterpriseName: enterprise.company_short_name || enterprise.company_name || enterprise.enterprise_code
  };
}

function mapMembershipEnterpriseScope(enterprise) {
  return {
    enterpriseId: Number(enterprise.id),
    enterpriseCode: enterprise.enterpriseCode,
    enterpriseName: enterprise.companyShortName || enterprise.companyName || enterprise.enterpriseCode
  };
}

async function resolveRequestedEnterpriseScope(req, { required = false } = {}) {
  await ensureBusinessTenantColumns();

  const requestedEnterpriseId = getEnterpriseIdFromRequest(req);
  if (requestedEnterpriseId !== null) {
    if (requestedEnterpriseId === 0) {
      return getGlobalEnterpriseScope();
    }

    const enterprise = await getEnterpriseById(requestedEnterpriseId);
    if (!enterprise) {
      throw buildError('企业不存在', 400);
    }

    return mapEnterpriseScope(enterprise);
  }

  const requestedEnterpriseCode = getEnterpriseCodeFromRequest(req);
  if (requestedEnterpriseCode) {
    if (requestedEnterpriseCode === '0') {
      return getGlobalEnterpriseScope();
    }

    const enterprise = await getEnterpriseByCode(requestedEnterpriseCode);
    if (!enterprise) {
      throw buildError('企业不存在', 400);
    }

    return mapEnterpriseScope(enterprise);
  }

  if (required) {
    throw buildError('请输入企业编码', 400);
  }

  return null;
}

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
    let enterpriseScope = await resolveRequestedEnterpriseScope(req, { required: userType === 'logistics' });

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

      const enterpriseContext = await getUserEnterpriseContext(user.id, enterpriseScope?.enterpriseId);
      if (enterpriseScope && enterpriseScope.enterpriseId !== 0) {
        const matchedEnterprise = enterpriseContext.enterprises.find((item) => item.id === enterpriseScope.enterpriseId && item.membershipStatus === 'ACTIVE' && item.enterpriseStatus === 'ACTIVE');
        if (!matchedEnterprise) {
          throw buildError('该账号不属于所选企业', 403);
        }

        enterpriseScope = mapMembershipEnterpriseScope(matchedEnterprise);
      } else if (!enterpriseScope) {
        enterpriseScope = enterpriseContext.currentEnterprise
          ? mapMembershipEnterpriseScope(enterpriseContext.currentEnterprise)
          : getGlobalEnterpriseScope();
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
        user_type: 'employee',
        enterprise_id: enterpriseScope.enterpriseId,
        enterprise_code: enterpriseScope.enterpriseCode,
        enterprise_name: enterpriseScope.enterpriseName
      };
    }
    // 物流商登录
    else if (userType === 'logistics') {
      user = await LogisticsProvider.findOne({
        where: {
          enterpriseId: enterpriseScope.enterpriseId,
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
        user_type: 'logistics',
        enterprise_id: enterpriseScope.enterpriseId,
        enterprise_code: enterpriseScope.enterpriseCode,
        enterprise_name: enterpriseScope.enterpriseName
      };
    }

    // 生成JWT Token
    const token = jwt.sign(
      {
        id: userData.id,
        username: userData.username,
        user_type: userType,
        enterprise_id: enterpriseScope.enterpriseId,
        enterprise_code: enterpriseScope.enterpriseCode
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
    res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : '登录失败，请稍后重试'
    });
  }
});

// 获取物流商列表（用于物流商选择）
router.get('/logistics-list', async (req, res) => {
  try {
    const enterpriseScope = await resolveRequestedEnterpriseScope(req, { required: true });
    const logistics = await LogisticsProvider.findAll({
      where: {
        enterpriseId: enterpriseScope.enterpriseId,
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
    res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : '获取物流商列表失败'
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
    const decodedEnterpriseId = decoded.enterprise_id === undefined || decoded.enterprise_id === null ? null : Number(decoded.enterprise_id);
    const enterpriseScope = decodedEnterpriseId === 0
      ? getGlobalEnterpriseScope()
      : (decodedEnterpriseId !== null && !Number.isNaN(decodedEnterpriseId)
        ? await getEnterpriseById(decodedEnterpriseId)
        : null);

    // 根据用户类型查询用户信息
    let user = null;
    if (decoded.user_type === 'employee') {
      user = await User.findOne({
        where: { id: decoded.id, status: 'ACTIVE' }
      });
      if (user && !user.pda_access) {
        user = null;
      }

      if (user && decodedEnterpriseId && decodedEnterpriseId !== 0) {
        const enterpriseContext = await getUserEnterpriseContext(user.id, decodedEnterpriseId);
        const matchedEnterprise = enterpriseContext.enterprises.find((item) => item.id === decodedEnterpriseId && item.membershipStatus === 'ACTIVE' && item.enterpriseStatus === 'ACTIVE');
        if (!matchedEnterprise) {
          user = null;
        }
      }
    } else if (decoded.user_type === 'logistics') {
      await ensureBusinessTenantColumns();
      if (decodedEnterpriseId === null || Number.isNaN(decodedEnterpriseId)) {
        user = null;
      } else {
      user = await LogisticsProvider.findOne({
        where: { id: decoded.id, enterpriseId: decodedEnterpriseId, is_active: true, login_enabled: 1 }
      });
        if (user && !user.pda_access) {
          user = null;
        }
      }
    }

    if (!user || (decodedEnterpriseId && decodedEnterpriseId !== 0 && !enterpriseScope)) {
      return res.status(401).json({
        success: false,
        message: 'Token无效'
      });
    }

    res.json({
      success: true,
      user: {
        ...decoded,
        enterprise_id: decodedEnterpriseId === null || Number.isNaN(decodedEnterpriseId) ? 0 : decodedEnterpriseId,
        enterprise_code: decodedEnterpriseId === 0 ? '0' : (enterpriseScope?.enterprise_code || decoded.enterprise_code || null)
      }
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
