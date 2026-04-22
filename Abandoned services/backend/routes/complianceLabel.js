const express = require('express');
const router = express.Router();
const ComplianceLabelTemplate = require('../models/ComplianceLabelTemplate');

// 获取所有标签模板
router.get('/templates', async (req, res) => {
  try {
    const templates = await ComplianceLabelTemplate.findAll({
      order: [['is_default', 'DESC'], ['created_at', 'DESC']]
    });
    res.json({ success: true, data: templates });
  } catch (error) {
    console.error('获取标签模板失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取默认模板 (必须在 /templates/:id 之前定义)
router.get('/templates/default', async (req, res) => {
  try {
    let template = await ComplianceLabelTemplate.findOne({ where: { is_default: true } });
    if (!template) {
      template = await ComplianceLabelTemplate.findOne({ order: [['created_at', 'DESC']] });
    }
    res.json({ success: true, data: template });
  } catch (error) {
    console.error('获取默认模板失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取单个模板
router.get('/templates/:id', async (req, res) => {
  try {
    const template = await ComplianceLabelTemplate.findByPk(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: '模板不存在' });
    }
    res.json({ success: true, data: template });
  } catch (error) {
    console.error('获取模板失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 创建新模板
router.post('/templates', async (req, res) => {
  try {
    const { template_name, template_desc, label_width, label_height, elements, is_default, category } = req.body;
    
    // 如果设为默认,先取消其他默认
    if (is_default) {
      await ComplianceLabelTemplate.update({ is_default: false }, { where: { is_default: true } });
    }
    
    const template = await ComplianceLabelTemplate.create({
      template_name,
      template_desc,
      label_width: label_width || 100,
      label_height: label_height || 70,
      elements: elements || [],
      is_default: is_default || false,
      category: category || 'compliance'
    });
    
    res.json({ success: true, data: template, message: '模板创建成功' });
  } catch (error) {
    console.error('创建模板失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 更新模板
router.put('/templates/:id', async (req, res) => {
  try {
    const { template_name, template_desc, label_width, label_height, elements, is_default, category } = req.body;
    
    const template = await ComplianceLabelTemplate.findByPk(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: '模板不存在' });
    }
    
    // 如果设为默认,先取消其他默认
    if (is_default) {
      await ComplianceLabelTemplate.update({ is_default: false }, { where: { is_default: true } });
    }
    
    await template.update({
      template_name: template_name || template.template_name,
      template_desc: template_desc !== undefined ? template_desc : template.template_desc,
      label_width: label_width || template.label_width,
      label_height: label_height || template.label_height,
      elements: elements || template.elements,
      is_default: is_default !== undefined ? is_default : template.is_default,
      category: category !== undefined ? category : template.category
    });
    
    res.json({ success: true, data: template, message: '模板更新成功' });
  } catch (error) {
    console.error('更新模板失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 删除模板
router.delete('/templates/:id', async (req, res) => {
  try {
    const template = await ComplianceLabelTemplate.findByPk(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: '模板不存在' });
    }
    
    await template.destroy();
    res.json({ success: true, message: '模板删除成功' });
  } catch (error) {
    console.error('删除模板失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 设置默认模板
router.post('/templates/:id/set-default', async (req, res) => {
  try {
    // 先取消所有默认
    await ComplianceLabelTemplate.update({ is_default: false }, { where: { is_default: true } });
    
    // 设置新默认
    const template = await ComplianceLabelTemplate.findByPk(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: '模板不存在' });
    }
    
    await template.update({ is_default: true });
    res.json({ success: true, data: template, message: '已设为默认模板' });
  } catch (error) {
    console.error('设置默认模板失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
