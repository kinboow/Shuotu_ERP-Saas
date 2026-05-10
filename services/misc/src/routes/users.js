/**
 * 用户管理路由 - 子账号CRUD、权限分配
 */
const express = require('express');
const router = express.Router();
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const authService = require('../services/auth');
const {
  ensureTenantTables,
  getUserEnterpriseContext,
  assertEnterpriseAdmin
} = require('../services/enterprise-context');

async function getRequestContext(req) {
  await ensureTenantTables();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    throw new Error('未登录');
  }

  const { valid, decoded, error } = await authService.verifyAccessToken(token);
  if (!valid) {
    throw new Error(error || 'Token无效');
  }

  const users = await sequelize.query(
    'SELECT id, user_id, username, real_name, phone, email, role_id, is_admin, status FROM users WHERE id = :userId AND status = :status LIMIT 1',
    {
      replacements: { userId: decoded.userId, status: 'ACTIVE' },
      type: QueryTypes.SELECT
    }
  );

  if (!users.length) {
    throw new Error('用户不存在或已禁用');
  }

  const user = users[0];
  const enterpriseContext = await getUserEnterpriseContext(user.id, decoded.enterpriseId);
  if (!enterpriseContext.currentEnterprise) {
    throw new Error('当前账号尚未加入企业');
  }

  return {
    decoded,
    user,
    enterpriseContext,
    currentEnterprise: enterpriseContext.currentEnterprise,
    currentEnterpriseId: enterpriseContext.currentEnterprise.id
  };
}

async function getEnterpriseUserById(enterpriseId, userId) {
  const users = await sequelize.query(
    `SELECT u.*, r.role_name, r.role_code,
            em.enterprise_id, em.member_type, em.status AS member_status, em.is_owner, em.joined_at
     FROM enterprise_members em
     JOIN users u ON u.id = em.user_id
     LEFT JOIN roles r ON u.role_id = r.id
     WHERE em.enterprise_id = :enterpriseId AND em.user_id = :userId
     LIMIT 1`,
    {
      replacements: { enterpriseId, userId },
      type: QueryTypes.SELECT
    }
  );

  if (!users.length) {
    return null;
  }

  const user = users[0];
  user.status = user.member_status || user.status;
  return user;
}

/**
 * 获取用户列表
 * GET /api/users
 */
router.get('/', async (req, res) => {
  try {
    const auth = await getRequestContext(req);
    await assertEnterpriseAdmin(auth.user.id, auth.currentEnterpriseId);

    const { page = 1, limit = 20, keyword = '', roleId = '', status = '' } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE em.enterprise_id = :enterpriseId';
    const params = { enterpriseId: auth.currentEnterpriseId };
    
    if (keyword) {
      whereClause += ' AND (u.username LIKE :keyword OR u.real_name LIKE :keyword OR u.phone LIKE :keyword)';
      params.keyword = `%${keyword}%`;
    }
    
    if (roleId) {
      whereClause += ' AND u.role_id = :roleId';
      params.roleId = roleId;
    }
    
    if (status) {
      whereClause += ' AND em.status = :status';
      params.status = status;
    }
    
    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM enterprise_members em
      JOIN users u ON u.id = em.user_id
      ${whereClause}
    `;
    const countResult = await sequelize.query(countQuery, {
      replacements: params,
      type: QueryTypes.SELECT
    });
    
    // 查询列表
    const listQuery = `
      SELECT u.id, u.user_id, u.username, u.real_name, u.phone, u.email, u.avatar,
        u.role_id, r.role_name, r.role_code, u.is_admin, u.department, u.position,
        em.status, em.member_type, em.is_owner, em.joined_at,
        u.last_login_at, u.login_ip, u.login_count, u.created_at
      FROM enterprise_members em
      JOIN users u ON u.id = em.user_id
      LEFT JOIN roles r ON u.role_id = r.id
      ${whereClause}
      ORDER BY u.is_admin DESC, u.created_at DESC
      LIMIT :limit OFFSET :offset
    `;
    
    const users = await sequelize.query(listQuery, {
      replacements: { ...params, limit: parseInt(limit), offset },
      type: QueryTypes.SELECT
    });
    
    res.json({
      success: true,
      data: users,
      total: countResult[0]?.total || 0,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.json({ success: false, message: '获取用户列表失败: ' + error.message });
  }
});

/**
 * 获取单个用户详情
 * GET /api/users/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const auth = await getRequestContext(req);
    const { id } = req.params;

    const user = await getEnterpriseUserById(auth.currentEnterpriseId, id);
    if (!user) {
      return res.json({ success: false, message: '用户不存在或不属于当前企业' });
    }

    if (Number(user.id) !== Number(auth.user.id)) {
      await assertEnterpriseAdmin(auth.user.id, auth.currentEnterpriseId);
    }

    delete user.password; // 不返回密码
    
    res.json({ success: true, data: user });
  } catch (error) {
    console.error('获取用户详情失败:', error);
    res.json({ success: false, message: '获取用户详情失败: ' + error.message });
  }
});

/**
 * 创建用户（子账号）
 * POST /api/users
 */
router.post('/', async (req, res) => {
  try {
    const auth = await getRequestContext(req);
    await assertEnterpriseAdmin(auth.user.id, auth.currentEnterpriseId);

    const { username, password, realName, phone, email, roleId, department, position, status = 'ACTIVE' } = req.body;
    
    if (!username || !password) {
      return res.json({ success: false, message: '用户名和密码不能为空' });
    }
    
    if (password.length < 6) {
      return res.json({ success: false, message: '密码长度不能少于6位' });
    }
    
    // 检查用户名是否已存在
    const existingUsers = await sequelize.query('SELECT id FROM users WHERE username = :username', {
      replacements: { username },
      type: QueryTypes.SELECT
    });
    
    if (existingUsers.length > 0) {
      return res.json({ success: false, message: '用户名已存在' });
    }
    
    // 生成用户ID和密码哈希
    const userId = authService.generateUserId();
    const hashedPassword = await authService.hashPassword(password);
    
    // 创建用户
    await sequelize.query(`
      INSERT INTO users (user_id, username, password, real_name, phone, email, role_id, department, position, status, is_admin)
      VALUES (:userId, :username, :password, :realName, :phone, :email, :roleId, :department, :position, :userStatus, 0)
    `, {
      replacements: { 
        userId, 
        username, 
        password: hashedPassword, 
        realName: realName || null, 
        phone: phone || null, 
        email: email || null, 
        roleId: roleId || null, 
        department: department || null, 
        position: position || null, 
        userStatus: 'ACTIVE'
      },
      type: QueryTypes.INSERT
    });

    const createdUsers = await sequelize.query(
      'SELECT id FROM users WHERE user_id = :userId LIMIT 1',
      {
        replacements: { userId },
        type: QueryTypes.SELECT
      }
    );

    await sequelize.query(
      `INSERT INTO enterprise_members (enterprise_id, user_id, member_type, status, is_owner, joined_at, approved_by, created_at, updated_at)
       VALUES (:enterpriseId, :userId, 'member', :status, 0, NOW(), :approvedBy, NOW(), NOW())`,
      {
        replacements: {
          enterpriseId: auth.currentEnterpriseId,
          userId: createdUsers[0].id,
          status,
          approvedBy: auth.user.id
        },
        type: QueryTypes.INSERT
      }
    );
    
    res.json({ success: true, message: '用户创建成功' });
  } catch (error) {
    console.error('创建用户失败:', error);
    res.json({ success: false, message: '创建用户失败: ' + error.message });
  }
});

/**
 * 更新用户
 * PUT /api/users/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const auth = await getRequestContext(req);
    const { id } = req.params;
    const { realName, phone, email, roleId, department, position, status, avatar } = req.body;
    
    // 检查用户是否存在
    const user = await getEnterpriseUserById(auth.currentEnterpriseId, id);
    if (!user) {
      return res.json({ success: false, message: '用户不存在或不属于当前企业' });
    }

    let canManageOthers = false;
    try {
      await assertEnterpriseAdmin(auth.user.id, auth.currentEnterpriseId);
      canManageOthers = true;
    } catch (permissionError) {
      if (Number(user.id) !== Number(auth.user.id)) {
        throw permissionError;
      }
    }

    if (!canManageOthers && (roleId !== undefined || status !== undefined)) {
      return res.json({ success: false, message: '当前用户无权修改角色或状态' });
    }
    
    // 主账号不能修改角色
    if (user.is_admin === 1 && roleId && roleId !== user.role_id) {
      return res.json({ success: false, message: '主账号角色不能修改' });
    }

    if (canManageOthers && status !== undefined) {
      await sequelize.query(
        `UPDATE enterprise_members
         SET status = :status, updated_at = NOW()
         WHERE enterprise_id = :enterpriseId AND user_id = :userId`,
        {
          replacements: {
            status,
            enterpriseId: auth.currentEnterpriseId,
            userId: id
          },
          type: QueryTypes.UPDATE
        }
      );
    }
    
    // 更新用户
    await sequelize.query(`
      UPDATE users SET 
        real_name = COALESCE(:realName, real_name),
        phone = COALESCE(:phone, phone),
        email = COALESCE(:email, email),
        role_id = COALESCE(:roleId, role_id),
        department = COALESCE(:department, department),
        position = COALESCE(:position, position),
        avatar = COALESCE(:avatar, avatar),
        updated_at = NOW()
      WHERE id = :id
    `, {
      replacements: {
        id,
        realName,
        phone,
        email,
        roleId: canManageOthers ? roleId : null,
        department,
        position,
        avatar
      },
      type: QueryTypes.UPDATE
    });
    
    res.json({ success: true, message: '用户更新成功' });
  } catch (error) {
    console.error('更新用户失败:', error);
    res.json({ success: false, message: '更新用户失败: ' + error.message });
  }
});

/**
 * 删除用户
 * DELETE /api/users/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const auth = await getRequestContext(req);
    await assertEnterpriseAdmin(auth.user.id, auth.currentEnterpriseId);

    const { id } = req.params;
    
    // 检查用户是否存在
    const user = await getEnterpriseUserById(auth.currentEnterpriseId, id);
    if (!user) {
      return res.json({ success: false, message: '用户不存在或不属于当前企业' });
    }
    
    // 主账号不能删除
    if (user.is_admin === 1 || user.is_owner) {
      return res.json({ success: false, message: '主账号不能删除' });
    }
    
    await sequelize.query(
      'DELETE FROM enterprise_members WHERE enterprise_id = :enterpriseId AND user_id = :userId',
      {
        replacements: { enterpriseId: auth.currentEnterpriseId, userId: id },
        type: QueryTypes.DELETE
      }
    );
    
    res.json({ success: true, message: '用户移除成功' });
  } catch (error) {
    console.error('删除用户失败:', error);
    res.json({ success: false, message: '删除用户失败: ' + error.message });
  }
});

/**
 * 重置用户密码
 * POST /api/users/:id/reset-password
 */
router.post('/:id/reset-password', async (req, res) => {
  try {
    const auth = await getRequestContext(req);
    await assertEnterpriseAdmin(auth.user.id, auth.currentEnterpriseId);

    const { id } = req.params;
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return res.json({ success: false, message: '新密码长度不能少于6位' });
    }
    
    // 检查用户是否存在
    const user = await getEnterpriseUserById(auth.currentEnterpriseId, id);
    if (!user) {
      return res.json({ success: false, message: '用户不存在或不属于当前企业' });
    }
    
    // 更新密码
    const hashedPassword = await authService.hashPassword(newPassword);
    await sequelize.query(`
      UPDATE users SET 
        password = :password, 
        password_updated_at = NOW(),
        token_version = COALESCE(token_version, 0) + 1
      WHERE id = :id
    `, {
      replacements: { id, password: hashedPassword },
      type: QueryTypes.UPDATE
    });
    
    res.json({ success: true, message: '密码重置成功' });
  } catch (error) {
    console.error('重置密码失败:', error);
    res.json({ success: false, message: '重置密码失败: ' + error.message });
  }
});

/**
 * 强制用户下线
 * POST /api/users/:id/force-logout
 */
router.post('/:id/force-logout', async (req, res) => {
  try {
    const auth = await getRequestContext(req);
    await assertEnterpriseAdmin(auth.user.id, auth.currentEnterpriseId);

    const { id } = req.params;

    const user = await getEnterpriseUserById(auth.currentEnterpriseId, id);
    if (!user) {
      return res.json({ success: false, message: '用户不存在或不属于当前企业' });
    }
    
    // 增加token_version使所有Token失效
    await sequelize.query(`
      UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = :id
    `, {
      replacements: { id },
      type: QueryTypes.UPDATE
    });
    
    // 删除用户的所有Token记录
    await sequelize.query('DELETE FROM user_tokens WHERE user_id = :id', {
      replacements: { id },
      type: QueryTypes.DELETE
    });
    
    res.json({ success: true, message: '用户已强制下线' });
  } catch (error) {
    console.error('强制下线失败:', error);
    res.json({ success: false, message: '强制下线失败: ' + error.message });
  }
});

module.exports = router;
