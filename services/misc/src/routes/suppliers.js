/**
 * 供应商路由 - 兼容前端
 */

const express = require('express');
const router = express.Router();
const { Supplier } = require('../models');
const { Op } = require('sequelize');
const { ensureBusinessTenantColumns, getRequiredEnterpriseIdFromRequest } = require('../services/enterprise-context');

// 查询列表
router.get('/', async (req, res) => {
  try {
    await ensureBusinessTenantColumns();
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const { status, keyword, page = 1, pageSize = 20 } = req.query;
    const where = { enterpriseId };
    if (status) where.status = parseInt(status);
    if (keyword) {
      where[Op.or] = [
        { supplier_name: { [Op.like]: `%${keyword}%` } },
        { supplier_code: { [Op.like]: `%${keyword}%` } },
        { contact_name: { [Op.like]: `%${keyword}%` } },
        { contact_phone: { [Op.like]: `%${keyword}%` } }
      ];
    }

    const { count, rows } = await Supplier.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(pageSize),
      offset: (parseInt(page) - 1) * parseInt(pageSize)
    });

    res.json({ success: true, data: { list: rows, total: count, page: parseInt(page), pageSize: parseInt(pageSize) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取详情
router.get('/:id', async (req, res) => {
  try {
    await ensureBusinessTenantColumns();
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const supplier = await Supplier.findOne({ where: { id: req.params.id, enterpriseId } });
    if (!supplier) return res.status(404).json({ success: false, message: '供应商不存在' });
    res.json({ success: true, data: supplier });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 创建
router.post('/', async (req, res) => {
  try {
    await ensureBusinessTenantColumns();
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const supplier = await Supplier.create({
      ...req.body,
      enterpriseId
    });
    res.json({ success: true, data: supplier });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 更新
router.put('/:id', async (req, res) => {
  try {
    await ensureBusinessTenantColumns();
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const supplier = await Supplier.findOne({ where: { id: req.params.id, enterpriseId } });
    if (!supplier) return res.status(404).json({ success: false, message: '供应商不存在' });
    const payload = { ...req.body };
    delete payload.enterpriseId;
    delete payload.enterprise_id;
    await supplier.update(payload);
    res.json({ success: true, data: supplier });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 删除
router.delete('/:id', async (req, res) => {
  try {
    await ensureBusinessTenantColumns();
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const supplier = await Supplier.findOne({ where: { id: req.params.id, enterpriseId } });
    if (!supplier) return res.status(404).json({ success: false, message: '供应商不存在' });
    await supplier.destroy();
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 切换状态
router.post('/:id/toggle-status', async (req, res) => {
  try {
    await ensureBusinessTenantColumns();
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const supplier = await Supplier.findOne({ where: { id: req.params.id, enterpriseId } });
    if (!supplier) return res.status(404).json({ success: false, message: '供应商不存在' });
    const newStatus = supplier.status === 1 ? 2 : 1;
    await supplier.update({ status: newStatus });
    res.json({ success: true, message: newStatus === 1 ? '已启用' : '已禁用', data: supplier });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
