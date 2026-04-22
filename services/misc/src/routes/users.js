/**
 * 用户管理路由 - 子账号CRUD、权限分配
 */
const express = require('express');
const router = express.Router();
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const authService = require('../services/auth');

/**
 * 获取用户列表
 * GET /api/users
 */
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, keyword = '', roleId = '', status = '' } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE 1=1';
    const params = {};
    
    if (keyword) {
      whereClause += ' AND (u.username LIKE :keyword OR u.real_name LIKE :keyword OR u.phone LIKE :keyword)';
      params.keyword = `%${keyword}%`;
    }
    
    if (roleId) {
      whereClause += ' AND u.role_id = :roleId';
      params.roleId = roleId;
    }
    
    if (status) {
      whereClause += ' AND u.status = :status';
      params.status = status;
    }
    
    // 查询总数
    const countQuery = `SELECT COUNT(*) as total FROM users u ${whereClause}`;
    const countResult = await sequelize.query(countQuery, {
      replacements: params,
      type: QueryTypes.SELECT
    });
    
    // 查询列表
    const listQuery = `
      SELECT u.id, u.user_id, u.username, u.real_name, u.phone, u.email, u.avatar,
        u.role_id, r.role_name, r.role_code, u.is_admin, u.department, u.position,
        u.status, u.last_login_at, u.login_ip, u.login_count, u.created_at
      FROM users u
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
    const { id } = req.params;
    
    const query = `
      SELECT u.*, r.role_name, r.role_code
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = :id
    `;
    
    const users = await sequelize.query(query, {
      replacements: { id },
      type: QueryTypes.SELECT
    });
    
    if (users.length === 0) {
      return res.json({ success: false, message: '用户不存在' });
    }
    
    const user = users[0];
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
      VALUES (:userId, :username, :password, :realName, :phone, :email, :roleId, :department, :position, :status, 0)
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
        status 
      },
      type: QueryTypes.INSERT
    });
    
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
    const { id } = req.params;
    const { realName, phone, email, roleId, department, position, status, avatar } = req.body;
    
    // 检查用户是否存在
    const users = await sequelize.query('SELECT * FROM users WHERE id = :id', {
      replacements: { id },
      type: QueryTypes.SELECT
    });
    
    if (users.length === 0) {
      return res.json({ success: false, message: '用户不存在' });
    }
    
    const user = users[0];
    
    // 主账号不能修改角色
    if (user.is_admin === 1 && roleId && roleId !== user.role_id) {
      return res.json({ success: false, message: '主账号角色不能修改' });
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
        status = COALESCE(:status, status),
        avatar = COALESCE(:avatar, avatar),
        updated_at = NOW()
      WHERE id = :id
    `, {
      replacements: { id, realName, phone, email, roleId, department, position, status, avatar },
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
    const { id } = req.params;
    
    // 检查用户是否存在
    const users = await sequelize.query('SELECT * FROM users WHERE id = :id', {
      replacements: { id },
      type: QueryTypes.SELECT
    });
    
    if (users.length === 0) {
      return res.json({ success: false, message: '用户不存在' });
    }
    
    const user = users[0];
    
    // 主账号不能删除
    if (user.is_admin === 1) {
      return res.json({ success: false, message: '主账号不能删除' });
    }
    
    // 删除用户
    await sequelize.query('DELETE FROM users WHERE id = :id', {
      replacements: { id },
      type: QueryTypes.DELETE
    });
    
    res.json({ success: true, message: '用户删除成功' });
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
    const { id } = req.params;
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return res.json({ success: false, message: '新密码长度不能少于6位' });
    }
    
    // 检查用户是否存在
    const users = await sequelize.query('SELECT * FROM users WHERE id = :id', {
      replacements: { id },
      type: QueryTypes.SELECT
    });
    
    if (users.length === 0) {
      return res.json({ success: false, message: '用户不存在' });
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
    const { id } = req.params;
    
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
