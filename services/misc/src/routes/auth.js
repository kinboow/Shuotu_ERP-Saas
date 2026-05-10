/**
 * 认证路由 - 登录、登出、刷新Token、修改密码
 */
const express = require('express');
const router = express.Router();
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const authService = require('../services/auth');
const redisService = require('../services/redis');
const {
  ensureTenantTables,
  getUserEnterpriseContext,
  listUserJoinRequests
} = require('../services/enterprise-context');

/**
 * 用户注册
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  try {
    await ensureTenantTables();

    const {
      phone,
      password,
      username
    } = req.body;

    if (!phone || !password) {
      return res.json({ success: false, message: '手机号和密码不能为空' });
    }

    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.json({ success: false, message: '手机号格式不正确' });
    }

    if (password.length < 6) {
      return res.json({ success: false, message: '密码长度不能少于6位' });
    }

    const existingUsers = await sequelize.query(
      'SELECT id FROM users WHERE phone = :phone OR username = :username LIMIT 1',
      {
        replacements: { phone, username: username || phone },
        type: QueryTypes.SELECT
      }
    );

    if (existingUsers.length > 0) {
      return res.json({ success: false, message: '该手机号或用户名已存在' });
    }

    const hashedPassword = await authService.hashPassword(password);
    const userId = authService.generateUserId();

    await sequelize.query(
      `INSERT INTO users (
        user_id, username, password, phone, real_name, role, status,
        login_count, token_version, created_at, updated_at
      ) VALUES (
        :userId, :username, :password, :phone, :realName, :role, :status,
        0, 0, NOW(), NOW()
      )`,
      {
        replacements: {
          userId,
          username: username || phone,
          password: hashedPassword,
          phone,
          realName: null,
          role: 'user',
          status: 'ACTIVE'
        },
        type: QueryTypes.INSERT
      }
    );

    return res.json({
      success: true,
      message: '注册成功，请登录后完成账户初始化',
      data: {
        userId,
        username: username || phone,
        phone
      }
    });
  } catch (error) {
    console.error('注册失败:', error);
    return res.json({ success: false, message: '注册失败: ' + error.message });
  }
});

/**
 * 用户登录
 * POST /api/auth/login
 * 支持用户名或手机号登录
 */
router.post('/login', async (req, res) => {
  const startTime = Date.now();
  const { username, phone, password, deviceType = 'web', enterpriseId } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];
  
  console.log('登录请求:', { username, phone, hasPassword: !!password, deviceType });
  
  // 支持用户名或手机号登录
  const loginAccount = username || phone;
  
  try {
    if (!loginAccount || !password) {
      console.log('登录验证失败: 账号或密码为空', { loginAccount, hasPassword: !!password });
      return res.json({ success: false, message: '账号和密码不能为空' });
    }
    
    // 检查登录失败次数
    const attempts = await redisService.getLoginAttempts(loginAccount);
    if (attempts >= 5) {
      // 记录登录日志
      await logLogin(null, loginAccount, 'password', deviceType, ipAddress, userAgent, 'FAILED', '登录失败次数过多，请30分钟后再试');
      return res.json({ success: false, message: '登录失败次数过多，请30分钟后再试' });
    }
    
    // 查询用户（支持用户名或手机号）
    const userQuery = `
      SELECT u.*, r.role_code, r.role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE (u.username = :loginAccount OR u.phone = :loginAccount) AND u.status = 'ACTIVE'
    `;
    const users = await sequelize.query(userQuery, {
      replacements: { loginAccount },
      type: QueryTypes.SELECT
    });
    
    if (users.length === 0) {
      await redisService.recordLoginAttempt(loginAccount);
      await logLogin(null, loginAccount, 'password', deviceType, ipAddress, userAgent, 'FAILED', '用户不存在或已禁用');
      return res.json({ success: false, message: '账号或密码错误' });
    }
    
    const user = users[0];
    
    // 验证密码
    const isValidPassword = await authService.verifyPassword(password, user.password);
    if (!isValidPassword) {
      await redisService.recordLoginAttempt(loginAccount);
      await logLogin(user.id, loginAccount, 'password', deviceType, ipAddress, userAgent, 'FAILED', '密码错误');
      return res.json({ success: false, message: '账号或密码错误' });
    }
    
    // 清除登录失败次数
    await redisService.clearLoginAttempts(loginAccount);

    const enterpriseContext = await getUserEnterpriseContext(user.id, enterpriseId);
    const pendingJoinRequests = await listUserJoinRequests(user.id, 'PENDING');
    
    // 生成Token
    const accessToken = authService.generateAccessToken(user, enterpriseContext);
    const refreshToken = authService.generateRefreshToken(user, enterpriseContext);
    
    // 存储会话信息到Redis
    const sessionData = {
      userId: user.id,
      username: user.username,
      roleId: user.role_id,
      roleCode: user.role_code,
      roleName: user.role_name,
      isAdmin: user.is_admin,
      currentEnterpriseId: enterpriseContext.currentEnterpriseId,
      enterpriseIds: enterpriseContext.enterprises.map((item) => item.id),
      deviceType,
      ipAddress,
      loginTime: new Date().toISOString()
    };
    await redisService.setUserSession(user.id, sessionData);
    
    // 更新用户登录信息
    await sequelize.query(`
      UPDATE users SET 
        last_login_at = NOW(), 
        login_ip = :ipAddress,
        login_count = COALESCE(login_count, 0) + 1
      WHERE id = :userId
    `, {
      replacements: { userId: user.id, ipAddress },
      type: QueryTypes.UPDATE
    });
    
    // 存储Token记录
    await sequelize.query(`
      INSERT INTO user_tokens (user_id, token_hash, device_type, ip_address, user_agent, expires_at)
      VALUES (:userId, :tokenHash, :deviceType, :ipAddress, :userAgent, DATE_ADD(NOW(), INTERVAL 2 HOUR))
    `, {
      replacements: {
        userId: user.id,
        tokenHash: authService.generateTokenHash(accessToken),
        deviceType,
        ipAddress,
        userAgent
      },
      type: QueryTypes.INSERT
    });
    
    // 记录登录日志
    await logLogin(user.id, username, 'password', deviceType, ipAddress, userAgent, 'SUCCESS', null);
    
    // 获取用户权限
    const permissions = await getUserPermissions(user.role_id);
    
    res.json({
      success: true,
      message: '登录成功',
      data: {
        accessToken,
        refreshToken,
        expiresIn: redisService.TOKEN_EXPIRE,
        user: {
          id: user.id,
          userId: user.user_id,
          username: user.username,
          realName: user.real_name,
          avatar: user.avatar,
          email: user.email,
          phone: user.phone,
          roleId: user.role_id,
          roleCode: user.role_code,
          roleName: user.role_name,
          isAdmin: user.is_admin,
          department: user.department,
          position: user.position
        },
        permissions,
        enterprises: enterpriseContext.enterprises,
        currentEnterprise: enterpriseContext.currentEnterprise,
        pendingJoinRequests,
        requiresEnterpriseSelection: !enterpriseContext.hasEnterprises
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.json({ success: false, message: '登录失败: ' + error.message });
  }
});

/**
 * 用户登出
 * POST /api/auth/logout
 */
router.post('/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      // 将Token加入黑名单
      await authService.invalidateToken(token);
      
      // 验证Token获取用户ID
      const { valid, decoded } = await authService.verifyAccessToken(token);
      if (valid && decoded) {
        // 删除Redis会话
        await redisService.deleteUserToken(decoded.userId);
        
        // 记录操作日志
        await logOperation(decoded.userId, decoded.username, null, 'auth', 'logout', null, null, '用户登出', req);
      }
    }
    
    res.json({ success: true, message: '登出成功' });
  } catch (error) {
    console.error('登出失败:', error);
    res.json({ success: true, message: '登出成功' }); // 即使出错也返回成功
  }
});

/**
 * 刷新Token
 * POST /api/auth/refresh
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken, enterpriseId } = req.body;
    
    if (!refreshToken) {
      return res.json({ success: false, message: '刷新Token不能为空' });
    }
    
    // 验证刷新Token
    const { valid, decoded, error } = authService.verifyRefreshToken(refreshToken);
    if (!valid) {
      return res.json({ success: false, message: error, code: 'TOKEN_EXPIRED' });
    }
    
    // 查询用户
    const userQuery = `
      SELECT u.*, r.role_code, r.role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = :userId AND u.status = 'ACTIVE'
    `;
    const users = await sequelize.query(userQuery, {
      replacements: { userId: decoded.userId },
      type: QueryTypes.SELECT
    });
    
    if (users.length === 0) {
      return res.json({ success: false, message: '用户不存在或已禁用', code: 'USER_INVALID' });
    }
    
    const user = users[0];
    
    // 检查Token版本（用于强制下线）
    if (user.token_version !== decoded.tokenVersion) {
      return res.json({ success: false, message: '登录已失效，请重新登录', code: 'TOKEN_REVOKED' });
    }
    
    const enterpriseContext = await getUserEnterpriseContext(user.id, enterpriseId || decoded.enterpriseId);
    const pendingJoinRequests = await listUserJoinRequests(user.id, 'PENDING');

    // 生成新Token
    const newAccessToken = authService.generateAccessToken(user, enterpriseContext);
    const newRefreshToken = authService.generateRefreshToken(user, enterpriseContext);
    
    // 刷新Redis会话
    await redisService.setUserSession(user.id, {
      userId: user.id,
      username: user.username,
      roleId: user.role_id,
      roleCode: user.role_code,
      roleName: user.role_name,
      isAdmin: user.is_admin,
      currentEnterpriseId: enterpriseContext.currentEnterpriseId,
      enterpriseIds: enterpriseContext.enterprises.map((item) => item.id),
      loginTime: new Date().toISOString()
    });
    
    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: redisService.TOKEN_EXPIRE,
        enterprises: enterpriseContext.enterprises,
        currentEnterprise: enterpriseContext.currentEnterprise,
        pendingJoinRequests,
        requiresEnterpriseSelection: !enterpriseContext.hasEnterprises
      }
    });
  } catch (error) {
    console.error('刷新Token失败:', error);
    res.json({ success: false, message: '刷新Token失败' });
  }
});

/**
 * 获取当前用户信息
 * GET /api/auth/me
 */
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.json({ success: false, message: '未登录', code: 'UNAUTHORIZED' });
    }
    
    const { valid, decoded, error } = await authService.verifyAccessToken(token);
    if (!valid) {
      return res.json({ success: false, message: error, code: 'TOKEN_INVALID' });
    }
    
    // 查询用户
    const userQuery = `
      SELECT u.*, r.role_code, r.role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = :userId
    `;
    const users = await sequelize.query(userQuery, {
      replacements: { userId: decoded.userId },
      type: QueryTypes.SELECT
    });
    
    if (users.length === 0) {
      return res.json({ success: false, message: '用户不存在' });
    }
    
    const user = users[0];
    const permissions = await getUserPermissions(user.role_id);
    const enterpriseContext = await getUserEnterpriseContext(user.id, decoded.enterpriseId);
    const pendingJoinRequests = await listUserJoinRequests(user.id, 'PENDING');
    
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          userId: user.user_id,
          username: user.username,
          realName: user.real_name,
          avatar: user.avatar,
          email: user.email,
          phone: user.phone,
          roleId: user.role_id,
          roleCode: user.role_code,
          roleName: user.role_name,
          isAdmin: user.is_admin,
          department: user.department,
          position: user.position,
          lastLoginAt: user.last_login_at,
          loginIp: user.login_ip
        },
        permissions,
        enterprises: enterpriseContext.enterprises,
        currentEnterprise: enterpriseContext.currentEnterprise,
        pendingJoinRequests,
        requiresEnterpriseSelection: !enterpriseContext.hasEnterprises
      }
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.json({ success: false, message: '获取用户信息失败' });
  }
});

/**
 * 更新当前用户资料
 * PUT /api/auth/profile
 */
router.put('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.json({ success: false, message: '未登录', code: 'UNAUTHORIZED' });
    }

    const { valid, decoded, error } = await authService.verifyAccessToken(token);
    if (!valid) {
      return res.json({ success: false, message: error, code: 'TOKEN_INVALID' });
    }

    const { realName } = req.body;

    await sequelize.query(
      `UPDATE users
       SET real_name = :realName,
           updated_at = NOW()
       WHERE id = :userId`,
      {
        replacements: {
          userId: decoded.userId,
          realName: realName && String(realName).trim() ? String(realName).trim() : null
        },
        type: QueryTypes.UPDATE
      }
    );

    const users = await sequelize.query(
      `SELECT id, user_id, username, real_name, avatar, email, phone, role_id, is_admin, department, position, last_login_at, login_ip
       FROM users
       WHERE id = :userId
       LIMIT 1`,
      {
        replacements: { userId: decoded.userId },
        type: QueryTypes.SELECT
      }
    );

    if (!users.length) {
      return res.json({ success: false, message: '用户不存在' });
    }

    const user = users[0];
    return res.json({
      success: true,
      message: '资料更新成功',
      data: {
        user: {
          id: user.id,
          userId: user.user_id,
          username: user.username,
          realName: user.real_name,
          avatar: user.avatar,
          email: user.email,
          phone: user.phone,
          roleId: user.role_id,
          isAdmin: user.is_admin,
          department: user.department,
          position: user.position,
          lastLoginAt: user.last_login_at,
          loginIp: user.login_ip
        }
      }
    });
  } catch (error) {
    console.error('更新当前用户资料失败:', error);
    return res.json({ success: false, message: '更新当前用户资料失败: ' + error.message });
  }
});

/**
 * 切换当前企业
 * POST /api/auth/select-enterprise
 */
router.post('/select-enterprise', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.json({ success: false, message: '未登录', code: 'UNAUTHORIZED' });
    }

    const { enterpriseId } = req.body;
    if (!enterpriseId) {
      return res.json({ success: false, message: 'enterpriseId 不能为空' });
    }

    const { valid, decoded, error } = await authService.verifyAccessToken(token);
    if (!valid) {
      return res.json({ success: false, message: error, code: 'TOKEN_INVALID' });
    }

    const users = await sequelize.query(
      `SELECT u.*, r.role_code, r.role_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = :userId AND u.status = 'ACTIVE'`,
      {
        replacements: { userId: decoded.userId },
        type: QueryTypes.SELECT
      }
    );

    if (users.length === 0) {
      return res.json({ success: false, message: '用户不存在或已禁用' });
    }

    const user = users[0];
    const enterpriseContext = await getUserEnterpriseContext(user.id, enterpriseId);
    if (!enterpriseContext.currentEnterprise || enterpriseContext.currentEnterprise.id !== Number(enterpriseId)) {
      return res.json({ success: false, message: '当前用户无权访问该企业' });
    }

    const pendingJoinRequests = await listUserJoinRequests(user.id, 'PENDING');
    const accessToken = authService.generateAccessToken(user, enterpriseContext);
    const refreshToken = authService.generateRefreshToken(user, enterpriseContext);

    await redisService.setUserSession(user.id, {
      userId: user.id,
      username: user.username,
      roleId: user.role_id,
      roleCode: user.role_code,
      roleName: user.role_name,
      isAdmin: user.is_admin,
      currentEnterpriseId: enterpriseContext.currentEnterpriseId,
      enterpriseIds: enterpriseContext.enterprises.map((item) => item.id),
      loginTime: new Date().toISOString()
    });

    return res.json({
      success: true,
      message: '切换企业成功',
      data: {
        accessToken,
        refreshToken,
        expiresIn: redisService.TOKEN_EXPIRE,
        enterprises: enterpriseContext.enterprises,
        currentEnterprise: enterpriseContext.currentEnterprise,
        pendingJoinRequests,
        requiresEnterpriseSelection: !enterpriseContext.hasEnterprises
      }
    });
  } catch (error) {
    console.error('切换企业失败:', error);
    return res.json({ success: false, message: '切换企业失败: ' + error.message });
  }
});

/**
 * 修改密码
 * POST /api/auth/change-password
 */
router.post('/change-password', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.json({ success: false, message: '未登录' });
    }
    
    const { valid, decoded } = await authService.verifyAccessToken(token);
    if (!valid) {
      return res.json({ success: false, message: 'Token无效' });
    }
    
    const { oldPassword, newPassword } = req.body;
    
    if (!oldPassword || !newPassword) {
      return res.json({ success: false, message: '旧密码和新密码不能为空' });
    }
    
    if (newPassword.length < 6) {
      return res.json({ success: false, message: '新密码长度不能少于6位' });
    }
    
    // 查询用户
    const users = await sequelize.query('SELECT * FROM users WHERE id = :userId', {
      replacements: { userId: decoded.userId },
      type: QueryTypes.SELECT
    });
    
    if (users.length === 0) {
      return res.json({ success: false, message: '用户不存在' });
    }
    
    const user = users[0];
    
    // 验证旧密码
    const isValidPassword = await authService.verifyPassword(oldPassword, user.password);
    if (!isValidPassword) {
      return res.json({ success: false, message: '旧密码错误' });
    }
    
    // 更新密码
    const hashedPassword = await authService.hashPassword(newPassword);
    await sequelize.query(`
      UPDATE users SET 
        password = :password, 
        password_updated_at = NOW(),
        token_version = COALESCE(token_version, 0) + 1
      WHERE id = :userId
    `, {
      replacements: { userId: decoded.userId, password: hashedPassword },
      type: QueryTypes.UPDATE
    });
    
    // 使当前Token失效
    await authService.invalidateToken(token);
    
    // 记录操作日志
    await logOperation(decoded.userId, decoded.username, null, 'auth', 'change_password', 'user', decoded.userId, '修改密码', req);
    
    res.json({ success: true, message: '密码修改成功，请重新登录' });
  } catch (error) {
    console.error('修改密码失败:', error);
    res.json({ success: false, message: '修改密码失败: ' + error.message });
  }
});

// 辅助函数：获取用户权限
async function getUserPermissions(roleId) {
  if (!roleId) return [];
  
  try {
    const query = `
      SELECT p.permission_code
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = :roleId
    `;
    const permissions = await sequelize.query(query, {
      replacements: { roleId },
      type: QueryTypes.SELECT
    });
    return permissions.map(p => p.permission_code);
  } catch (error) {
    console.error('获取权限失败:', error);
    return [];
  }
}

// 辅助函数：记录登录日志
async function logLogin(userId, username, loginType, deviceType, ipAddress, userAgent, status, failReason) {
  try {
    await sequelize.query(`
      INSERT INTO login_logs (user_id, username, login_type, device_type, ip_address, user_agent, status, fail_reason)
      VALUES (:userId, :username, :loginType, :deviceType, :ipAddress, :userAgent, :status, :failReason)
    `, {
      replacements: { userId, username, loginType, deviceType, ipAddress, userAgent, status, failReason },
      type: QueryTypes.INSERT
    });
  } catch (error) {
    console.error('记录登录日志失败:', error);
  }
}

// 辅助函数：记录操作日志
async function logOperation(userId, username, realName, module, action, targetType, targetId, description, req) {
  try {
    await sequelize.query(`
      INSERT INTO operation_logs (user_id, username, real_name, module, action, target_type, target_id, description, request_method, request_url, ip_address, user_agent)
      VALUES (:userId, :username, :realName, :module, :action, :targetType, :targetId, :description, :method, :url, :ip, :userAgent)
    `, {
      replacements: {
        userId,
        username,
        realName,
        module,
        action,
        targetType,
        targetId,
        description,
        method: req?.method,
        url: req?.originalUrl,
        ip: req?.ip,
        userAgent: req?.headers?.['user-agent']
      },
      type: QueryTypes.INSERT
    });
  } catch (error) {
    console.error('记录操作日志失败:', error);
  }
}

module.exports = router;
