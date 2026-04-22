/**
 * 标签数据表路由
 * CRUD for label_data_tables and label_data_rows
 */

const express = require('express');
const router = express.Router();
const { LabelDataTable, LabelDataRow } = require('../models');

// ==================== 数据表 CRUD ====================

// 获取所有数据表
router.get('/', async (req, res) => {
  try {
    const tables = await LabelDataTable.findAll({
      where: { status: 'ACTIVE' },
      order: [['created_at', 'DESC']]
    });
    res.json({ success: true, data: tables });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 创建数据表
router.post('/', async (req, res) => {
  try {
    const { name, description, columns } = req.body;
    if (!name || !columns || !Array.isArray(columns) || columns.length === 0) {
      return res.status(400).json({ success: false, message: '表名和列定义不能为空' });
    }
    const table = await LabelDataTable.create({ name, description, columns });
    res.json({ success: true, data: table });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 获取数据表详情（含行数据）
router.get('/:id', async (req, res) => {
  try {
    const table = await LabelDataTable.findByPk(req.params.id, {
      include: [{ association: 'rows', order: [['sort_order', 'ASC']] }]
    });
    if (!table) {
      return res.status(404).json({ success: false, message: '数据表不存在' });
    }
    res.json({ success: true, data: table });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 更新数据表（名称、描述、列定义）
router.put('/:id', async (req, res) => {
  try {
    const table = await LabelDataTable.findByPk(req.params.id);
    if (!table) {
      return res.status(404).json({ success: false, message: '数据表不存在' });
    }
    const { name, description, columns } = req.body;
    await table.update({ name, description, columns });
    res.json({ success: true, data: table });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 删除数据表（软删除）
router.delete('/:id', async (req, res) => {
  try {
    const table = await LabelDataTable.findByPk(req.params.id);
    if (!table) {
      return res.status(404).json({ success: false, message: '数据表不存在' });
    }
    await table.update({ status: 'DELETED' });
    await LabelDataRow.destroy({ where: { table_id: req.params.id } });
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== 数据行 CRUD ====================

// 获取某表的所有行
router.get('/:id/rows', async (req, res) => {
  try {
    const rows = await LabelDataRow.findAll({
      where: { table_id: req.params.id },
      order: [['sort_order', 'ASC'], ['id', 'ASC']]
    });
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 添加行
router.post('/:id/rows', async (req, res) => {
  try {
    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ success: false, message: '行数据不能为空' });
    }
    const maxOrder = await LabelDataRow.max('sort_order', { where: { table_id: req.params.id } });
    const row = await LabelDataRow.create({
      table_id: req.params.id,
      data,
      sort_order: (maxOrder || 0) + 1
    });
    res.json({ success: true, data: row });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 批量设置行（替换所有行）
router.put('/:id/rows', async (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows)) {
      return res.status(400).json({ success: false, message: 'rows 必须是数组' });
    }
    // 删除旧行
    await LabelDataRow.destroy({ where: { table_id: req.params.id } });
    // 批量创建新行
    const newRows = await LabelDataRow.bulkCreate(
      rows.map((data, index) => ({
        table_id: req.params.id,
        data: data.data || data,
        sort_order: index
      }))
    );
    res.json({ success: true, data: newRows });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 更新单行
router.put('/:tableId/rows/:rowId', async (req, res) => {
  try {
    const row = await LabelDataRow.findByPk(req.params.rowId);
    if (!row) {
      return res.status(404).json({ success: false, message: '行不存在' });
    }
    await row.update({ data: req.body.data });
    res.json({ success: true, data: row });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 删除单行
router.delete('/:tableId/rows/:rowId', async (req, res) => {
  try {
    const row = await LabelDataRow.findByPk(req.params.rowId);
    if (!row) {
      return res.status(404).json({ success: false, message: '行不存在' });
    }
    await row.destroy();
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
