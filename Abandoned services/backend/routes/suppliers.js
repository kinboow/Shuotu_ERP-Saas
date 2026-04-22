const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const Supplier = require('../models/Supplier');

/**
 * 获取供应商列表
 * GET /api/suppliers
 */
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status, keyword } = req.query;
    
    const where = {};
    if (status) {
      where.status = status;
    }
    if (keyword) {
      where[Op.or] = [
        { supplier_code: { [Op.like]: `%${keyword}%` } },
        { supplier_name: { [Op.like]: `%${keyword}%` } },
        { short_name: { [Op.like]: `%${keyword}%` } },
        { contact_name: { [Op.like]: `%${keyword}%` } },
        { contact_phone: { [Op.like]: `%${keyword}%` } }
      ];
    }

    const { count, rows } = await Supplier.findAndCountAll({
      where,
      limit: parseInt(pageSize),
      offset: (parseInt(page) - 1) * parseInt(pageSize),
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        list: rows,
        total: count,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    console.error('获取供应商列表失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取所有启用的供应商（用于下拉选择）
 * GET /api/suppliers/active
 */
router.get('/active', async (req, res) => {
  try {
    const suppliers = await Supplier.findAll({
      where: { status: 1 },
      attributes: ['id', 'supplier_code', 'supplier_name', 'short_name', 'contact_name', 'contact_phone'],
      order: [['supplier_name', 'ASC']]
    });

    res.json({
      success: true,
      data: suppliers
    });
  } catch (error) {
    console.error('获取供应商列表失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取供应商详情
 * GET /api/suppliers/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const supplier = await Supplier.findByPk(id);
    
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: '供应商不存在'
      });
    }

    res.json({
      success: true,
      data: supplier
    });
  } catch (error) {
    console.error('获取供应商详情失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 创建供应商
 * POST /api/suppliers
 */
router.post('/', async (req, res) => {
  try {
    const {
      supplier_code,
      supplier_name,
      short_name,
      contact_name,
      contact_phone,
      wechat,
      email,
      address,
      province,
      city,
      district,
      bank_name,
      bank_account,
      account_name,
      settlement_cycle,
      settlement_type,
      main_category,
      remark
    } = req.body;

    // 检查编码是否已存在
    const existing = await Supplier.findOne({ where: { supplier_code } });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: '供应商编码已存在'
      });
    }

    const supplier = await Supplier.create({
      supplier_code,
      supplier_name,
      short_name,
      contact_name,
      contact_phone,
      wechat,
      email,
      address,
      province,
      city,
      district,
      bank_name,
      bank_account,
      account_name,
      settlement_cycle: settlement_cycle || 30,
      settlement_type: settlement_type || 1,
      main_category,
      remark,
      status: 1
    });

    res.json({
      success: true,
      message: '创建成功',
      data: supplier
    });
  } catch (error) {
    console.error('创建供应商失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 更新供应商
 * PUT /api/suppliers/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const supplier = await Supplier.findByPk(id);
    
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: '供应商不存在'
      });
    }

    // 如果修改了编码，检查是否重复
    if (req.body.supplier_code && req.body.supplier_code !== supplier.supplier_code) {
      const existing = await Supplier.findOne({ 
        where: { 
          supplier_code: req.body.supplier_code,
          id: { [Op.ne]: id }
        } 
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: '供应商编码已存在'
        });
      }
    }

    await supplier.update(req.body);

    res.json({
      success: true,
      message: '更新成功',
      data: supplier
    });
  } catch (error) {
    console.error('更新供应商失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 删除供应商
 * DELETE /api/suppliers/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const supplier = await Supplier.findByPk(id);
    
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: '供应商不存在'
      });
    }

    await supplier.destroy();

    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    console.error('删除供应商失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 切换供应商状态
 * POST /api/suppliers/:id/toggle-status
 */
router.post('/:id/toggle-status', async (req, res) => {
  try {
    const { id } = req.params;
    const supplier = await Supplier.findByPk(id);
    
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: '供应商不存在'
      });
    }

    await supplier.update({
      status: supplier.status === 1 ? 2 : 1
    });

    res.json({
      success: true,
      message: supplier.status === 1 ? '已启用' : '已禁用',
      data: supplier
    });
  } catch (error) {
    console.error('切换状态失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
