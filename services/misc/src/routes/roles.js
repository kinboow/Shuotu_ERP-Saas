/**
 * 角色权限管理路由
 */
const express = require('express');
const router = express.Router();
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

/**
 * 获取角色列表
 * GET /api/roles
 */
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT r.*, 
        (SELECT COUNT(*) FROM users WHERE role_id = r.id) as user_count
      FROM roles r
      ORDER BY r.is_system DESC, r.id ASC
    `;
    
    const roles = await sequelize.query(query, { type: QueryTypes.SELECT });
    
    res.json({ success: true, data: roles });
  } catch (error) {
    console.error('获取角色列表失败:', error);
    res.json({ success: false, message: '获取角色列表失败: ' + error.message });
  }
});

/**
 * 获取角色详情（含权限）
 * GET /api/roles/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 获取角色信息
    const roles = await sequelize.query('SELECT * FROM roles WHERE id = :id', {
      replacements: { id },
      type: QueryTypes.SELECT
    });
    
    if (roles.length === 0) {
      return res.json({ success: false, message: '角色不存在' });
    }
    
    // 获取角色权限
    const permissions = await sequelize.query(`
      SELECT p.id, p.permission_code, p.permission_name, p.module
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = :id
    `, {
      replacements: { id },
      type: QueryTypes.SELECT
    });
    
    res.json({
      success: true,
      data: {
        ...roles[0],
        permissions: permissions.map(p => p.permission_code)
      }
    });
  } catch (error) {
    console.error('获取角色详情失败:', error);
    res.json({ success: false, message: '获取角色详情失败: ' + error.message });
  }
});

/**
 * 创建角色
 * POST /api/roles
 */
router.post('/', async (req, res) => {
  try {
    const { roleCode, roleName, description, permissions = [] } = req.body;
    
    if (!roleCode || !roleName) {
      return res.json({ success: false, message: '角色编码和名称不能为空' });
    }
    
    // 检查角色编码是否已存在
    const existing = await sequelize.query('SELECT id FROM roles WHERE role_code = :roleCode', {
      replacements: { roleCode },
      type: QueryTypes.SELECT
    });
    
    if (existing.length > 0) {
      return res.json({ success: false, message: '角色编码已存在' });
    }
    
    // 创建角色
    const [result] = await sequelize.query(`
      INSERT INTO roles (role_code, role_name, description, is_system)
      VALUES (:roleCode, :roleName, :description, 0)
    `, {
      replacements: { roleCode, roleName, description },
      type: QueryTypes.INSERT
    });
    
    const roleId = result;
    
    // 分配权限
    if (permissions.length > 0) {
      await assignPermissions(roleId, permissions);
    }
    
    res.json({ success: true, message: '角色创建成功', data: { id: roleId } });
  } catch (error) {
    console.error('创建角色失败:', error);
    res.json({ success: false, message: '创建角色失败: ' + error.message });
  }
});

/**
 * 更新角色
 * PUT /api/roles/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { roleName, description, permissions } = req.body;
    
    // 检查角色是否存在
    const roles = await sequelize.query('SELECT * FROM roles WHERE id = :id', {
      replacements: { id },
      type: QueryTypes.SELECT
    });
    
    if (roles.length === 0) {
      return res.json({ success: false, message: '角色不存在' });
    }
    
    // 更新角色信息
    await sequelize.query(`
      UPDATE roles SET 
        role_name = COALESCE(:roleName, role_name),
        description = COALESCE(:description, description),
        updated_at = NOW()
      WHERE id = :id
    `, {
      replacements: { id, roleName, description },
      type: QueryTypes.UPDATE
    });
    
    // 更新权限
    if (permissions !== undefined) {
      // 删除旧权限
      await sequelize.query('DELETE FROM role_permissions WHERE role_id = :id', {
        replacements: { id },
        type: QueryTypes.DELETE
      });
      
      // 分配新权限
      if (permissions.length > 0) {
        await assignPermissions(id, permissions);
      }
    }
    
    res.json({ success: true, message: '角色更新成功' });
  } catch (error) {
    console.error('更新角色失败:', error);
    res.json({ success: false, message: '更新角色失败: ' + error.message });
  }
});

/**
 * 删除角色
 * DELETE /api/roles/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查角色是否存在
    const roles = await sequelize.query('SELECT * FROM roles WHERE id = :id', {
      replacements: { id },
      type: QueryTypes.SELECT
    });
    
    if (roles.length === 0) {
      return res.json({ success: false, message: '角色不存在' });
    }
    
    const role = roles[0];
    
    // 系统角色不能删除
    if (role.is_system === 1) {
      return res.json({ success: false, message: '系统角色不能删除' });
    }
    
    // 检查是否有用户使用该角色
    const userCount = await sequelize.query('SELECT COUNT(*) as count FROM users WHERE role_id = :id', {
      replacements: { id },
      type: QueryTypes.SELECT
    });
    
    if (userCount[0].count > 0) {
      return res.json({ success: false, message: '该角色下还有用户，不能删除' });
    }
    
    // 删除角色权限关联
    await sequelize.query('DELETE FROM role_permissions WHERE role_id = :id', {
      replacements: { id },
      type: QueryTypes.DELETE
    });
    
    // 删除角色
    await sequelize.query('DELETE FROM roles WHERE id = :id', {
      replacements: { id },
      type: QueryTypes.DELETE
    });
    
    res.json({ success: true, message: '角色删除成功' });
  } catch (error) {
    console.error('删除角色失败:', error);
    res.json({ success: false, message: '删除角色失败: ' + error.message });
  }
});

/**
 * 获取所有权限列表（按模块分组）
 * GET /api/roles/permissions/all
 */
router.get('/permissions/all', async (req, res) => {
  try {
    const permissions = await sequelize.query(`
      SELECT id, permission_code, permission_name, module, description, sort_order
      FROM permissions
      ORDER BY module, sort_order
    `, { type: QueryTypes.SELECT });
    
    // 按模块分组
    const grouped = {};
    const moduleNames = {
      system: '系统管理',
      product: '商品管理',
      order: '订单管理',
      purchase: '采购管理',
      inventory: '库存管理',
      finance: '财务管理',
      platform: '平台管理'
    };
    
    permissions.forEach(p => {
      if (!grouped[p.module]) {
        grouped[p.module] = {
          module: p.module,
          moduleName: moduleNames[p.module] || p.module,
          permissions: []
        };
      }
      grouped[p.module].permissions.push(p);
    });
    
    res.json({ success: true, data: Object.values(grouped) });
  } catch (error) {
    console.error('获取权限列表失败:', error);
    res.json({ success: false, message: '获取权限列表失败: ' + error.message });
  }
});

// 辅助函数：分配权限
async function assignPermissions(roleId, permissionCodes) {
  if (!permissionCodes || permissionCodes.length === 0) return;
  
  // 获取权限ID
  const permissions = await sequelize.query(`
    SELECT id FROM permissions WHERE permission_code IN (:codes)
  `, {
    replacements: { codes: permissionCodes },
    type: QueryTypes.SELECT
  });
  
  // 批量插入
  for (const p of permissions) {
    await sequelize.query(`
      INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (:roleId, :permissionId)
    `, {
      replacements: { roleId, permissionId: p.id },
      type: QueryTypes.INSERT
    });
  }
}

module.exports = router;
