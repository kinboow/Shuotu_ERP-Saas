/**
 * 打印和合规标签路由
 * 
 * 路由挂载点（在 index.js 中）：
 * - /api/remote-print -> printRouter (远程打印客户端)
 * - /api/compliance-label -> complianceLabelRouter (合规标签模板)
 * - /api/label-materials -> labelMaterialsRouter (标签材料)
 */

const express = require('express');
const { ComplianceLabelTemplate } = require('../models');
const { Op } = require('sequelize');

const generateId = (prefix = 'TPL') => {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}${dateStr}${random}`;
};

// ==================== 远程打印客户端路由 ====================
const printRouter = express.Router();

let printClients = [];

printRouter.get('/clients', (req, res) => {
  res.json({ success: true, data: printClients });
});

printRouter.get('/clients/:clientId/printers', (req, res) => {
  const client = printClients.find(c => c.id === req.params.clientId);
  if (!client) {
    return res.status(404).json({ success: false, message: '客户端不存在' });
  }
  res.json({ success: true, data: client.printers || [] });
});

printRouter.post('/http-clients', (req, res) => {
  try {
    const { name, host, port } = req.body;
    const client = {
      id: generateId('CLI'),
      name, host, port,
      type: 'HTTP',
      status: 'ONLINE',
      printers: [],
      createdAt: new Date()
    };
    printClients.push(client);
    res.json({ success: true, data: client });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

printRouter.delete('/http-clients/:clientId', (req, res) => {
  const index = printClients.findIndex(c => c.id === req.params.clientId);
  if (index === -1) {
    return res.status(404).json({ success: false, message: '客户端不存在' });
  }
  printClients.splice(index, 1);
  res.json({ success: true, message: '删除成功' });
});

printRouter.post('/http-clients/:clientId/refresh', async (req, res) => {
  try {
    const client = printClients.find(c => c.id === req.params.clientId);
    if (!client) {
      return res.status(404).json({ success: false, message: '客户端不存在' });
    }
    client.printers = [
      { name: 'Default Printer', status: 'Ready' },
      { name: 'Label Printer', status: 'Ready' }
    ];
    client.lastRefresh = new Date();
    res.json({ success: true, data: client });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 远程打印（也挂在 remote-print 下）
printRouter.post('/print', async (req, res) => {
  try {
    const { templateId, data, clientId, printerName, copies = 1 } = req.body;
    const client = printClients.find(c => c.id === clientId);
    if (!client) {
      return res.status(404).json({ success: false, message: '打印客户端不存在' });
    }
    const printJob = {
      id: generateId('JOB'),
      templateId,
      clientId,
      printerName,
      copies,
      status: 'COMPLETED',
      createdAt: new Date()
    };
    res.json({ success: true, data: printJob, message: '打印任务已提交' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

printRouter.post('/print-native', async (req, res) => {
  try {
    const printJob = {
      id: generateId('JOB'),
      ...req.body,
      status: 'COMPLETED',
      createdAt: new Date()
    };
    res.json({ success: true, data: printJob, message: '原生打印任务已提交' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== 合规标签模板路由 ====================
const complianceLabelRouter = express.Router();

const transformFrontendToDb = (data) => {
  return {
    name: data.template_name,
    description: data.template_desc || '',
    width: data.label_width || 100,
    height: data.label_height || 70,
    labelType: data.category || 'compliance',
    template: data.elements ? JSON.stringify(data.elements) : null
  };
};

const transformDbToFrontend = (template) => {
  if (!template) return null;
  const t = template.toJSON ? template.toJSON() : template;
  return {
    id: t.id,
    template_id: t.templateId,
    template_name: t.name,
    template_desc: t.description,
    label_width: parseFloat(t.width) || 100,
    label_height: parseFloat(t.height) || 70,
    category: t.labelType || 'compliance',
    elements: t.template ? (typeof t.template === 'string' ? JSON.parse(t.template) : t.template) : [],
    status: t.status,
    created_at: t.createdAt,
    updated_at: t.updatedAt
  };
};

complianceLabelRouter.get('/templates', async (req, res) => {
  try {
    const { category, keyword, page = 1, pageSize = 100 } = req.query;
    const where = { status: 'ACTIVE' };
    if (category && category !== 'all') {
      where.labelType = category;
    }
    const { count, rows } = await ComplianceLabelTemplate.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(pageSize),
      offset: (parseInt(page) - 1) * parseInt(pageSize)
    });
    res.json({ success: true, data: rows.map(transformDbToFrontend) });
  } catch (error) {
    console.error('获取模板列表失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

complianceLabelRouter.post('/templates', async (req, res) => {
  try {
    const dbData = transformFrontendToDb(req.body);
    const template = await ComplianceLabelTemplate.create({
      ...dbData,
      templateId: generateId('TPL')
    });
    res.json({ success: true, data: transformDbToFrontend(template) });
  } catch (error) {
    console.error('创建模板失败:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

complianceLabelRouter.get('/templates/:id', async (req, res) => {
  try {
    const isNumericId = /^\d+$/.test(req.params.id);
    const whereClause = isNumericId
      ? { id: parseInt(req.params.id) }
      : { templateId: req.params.id };
    const template = await ComplianceLabelTemplate.findOne({ where: whereClause });
    if (!template) {
      return res.status(404).json({ success: false, message: '模板不存在' });
    }
    res.json({ success: true, data: transformDbToFrontend(template) });
  } catch (error) {
    console.error('获取模板详情失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

complianceLabelRouter.put('/templates/:id', async (req, res) => {
  try {
    const isNumericId = /^\d+$/.test(req.params.id);
    const whereClause = isNumericId
      ? { id: parseInt(req.params.id) }
      : { templateId: req.params.id };
    const template = await ComplianceLabelTemplate.findOne({ where: whereClause });
    if (!template) {
      return res.status(404).json({ success: false, message: '模板不存在' });
    }
    const dbData = transformFrontendToDb(req.body);
    await template.update(dbData);
    res.json({ success: true, data: transformDbToFrontend(template) });
  } catch (error) {
    console.error('更新模板失败:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

complianceLabelRouter.delete('/templates/:id', async (req, res) => {
  try {
    const isNumericId = /^\d+$/.test(req.params.id);
    const whereClause = isNumericId
      ? { id: parseInt(req.params.id) }
      : { templateId: req.params.id };
    const template = await ComplianceLabelTemplate.findOne({ where: whereClause });
    if (!template) {
      return res.status(404).json({ success: false, message: '模板不存在' });
    }
    await template.update({ status: 'DELETED' });
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除模板失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

complianceLabelRouter.post('/print', async (req, res) => {
  try {
    const { templateId, data, clientId, printerName, copies = 1 } = req.body;
    const template = await ComplianceLabelTemplate.findOne({ where: { templateId } });
    if (!template) {
      return res.status(404).json({ success: false, message: '模板不存在' });
    }
    const client = printClients.find(c => c.id === clientId);
    if (!client) {
      return res.status(404).json({ success: false, message: '打印客户端不存在' });
    }
    const printJob = {
      id: generateId('JOB'),
      templateId,
      templateName: template.name,
      clientId,
      printerName,
      copies,
      status: 'COMPLETED',
      createdAt: new Date()
    };
    res.json({ success: true, data: printJob, message: '打印任务已提交' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== 标签材料路由 ====================
const labelMaterialsRouter = express.Router();

let labelMaterials = [];

const systemMaterials = [
  { id: 'SYS001', name: 'CE标志', category: 'certification', type: 'image', url: '/api/images/ce-mark.png', isSystem: true },
  { id: 'SYS002', name: '回收标志', category: 'environmental', type: 'image', url: '/api/images/recycle.png', isSystem: true },
  { id: 'SYS003', name: '警告标志', category: 'warning', type: 'image', url: '/api/images/warning.png', isSystem: true }
];

// GET /api/label-materials
labelMaterialsRouter.get('/', (req, res) => {
  const { category } = req.query;
  let result = [...systemMaterials, ...labelMaterials];
  if (category && category !== 'all') {
    result = result.filter(m => m.category === category);
  }
  res.json({ success: true, data: result });
});

// POST /api/label-materials/init-system
labelMaterialsRouter.post('/init-system', (req, res) => {
  res.json({ success: true, data: systemMaterials, message: '系统素材已初始化' });
});

// POST /api/label-materials/upload
labelMaterialsRouter.post('/upload', (req, res) => {
  const filename = `material_${Date.now()}.png`;
  res.json({ success: true, data: { url: `/api/images/${filename}`, filename } });
});

// POST /api/label-materials
labelMaterialsRouter.post('/', (req, res) => {
  try {
    const material = {
      id: generateId('MAT'),
      ...req.body,
      isSystem: false,
      createdAt: new Date()
    };
    labelMaterials.push(material);
    res.json({ success: true, data: material });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// PUT /api/label-materials/:id
labelMaterialsRouter.put('/:id', (req, res) => {
  const index = labelMaterials.findIndex(m => m.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: '素材不存在' });
  }
  labelMaterials[index] = { ...labelMaterials[index], ...req.body, updatedAt: new Date() };
  res.json({ success: true, data: labelMaterials[index] });
});

// DELETE /api/label-materials/:id
labelMaterialsRouter.delete('/:id', (req, res) => {
  const index = labelMaterials.findIndex(m => m.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: '素材不存在' });
  }
  labelMaterials.splice(index, 1);
  res.json({ success: true, message: '删除成功' });
});

module.exports = { printRouter, complianceLabelRouter, labelMaterialsRouter };
