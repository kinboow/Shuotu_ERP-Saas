const express = require('express');
const router = express.Router();
const LabelMaterial = require('../models/LabelMaterial');
const { Op } = require('sequelize');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/materials');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|svg|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === 'image/svg+xml';
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('只支持图片文件 (jpeg, jpg, png, gif, svg, webp)'));
  }
});

// 获取素材列表
router.get('/', async (req, res) => {
  try {
    const { category, sub_category, keyword, page = 1, pageSize = 50 } = req.query;
    
    const where = { is_active: true };
    if (category) where.category = category;
    if (sub_category) where.sub_category = sub_category;
    if (keyword) {
      where[Op.or] = [
        { name: { [Op.like]: `%${keyword}%` } },
        { description: { [Op.like]: `%${keyword}%` } }
      ];
    }
    
    const { count, rows } = await LabelMaterial.findAndCountAll({
      where,
      order: [['sort_order', 'ASC'], ['created_at', 'DESC']],
      limit: parseInt(pageSize),
      offset: (parseInt(page) - 1) * parseInt(pageSize)
    });
    
    res.json({ 
      success: true, 
      data: rows,
      total: count,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    });
  } catch (error) {
    console.error('获取素材列表失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取素材分类
router.get('/categories', async (req, res) => {
  try {
    const categories = await LabelMaterial.findAll({
      attributes: ['category', 'sub_category'],
      where: { is_active: true },
      group: ['category', 'sub_category'],
      raw: true
    });
    
    // 整理分类结构
    const categoryMap = {};
    categories.forEach(item => {
      if (!categoryMap[item.category]) {
        categoryMap[item.category] = [];
      }
      if (item.sub_category && !categoryMap[item.category].includes(item.sub_category)) {
        categoryMap[item.category].push(item.sub_category);
      }
    });
    
    res.json({ success: true, data: categoryMap });
  } catch (error) {
    console.error('获取素材分类失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取单个素材
router.get('/:id', async (req, res) => {
  try {
    const material = await LabelMaterial.findByPk(req.params.id);
    if (!material) {
      return res.status(404).json({ success: false, message: '素材不存在' });
    }
    res.json({ success: true, data: material });
  } catch (error) {
    console.error('获取素材失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 上传素材图片
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请选择文件' });
    }
    
    const fileUrl = `/uploads/materials/${req.file.filename}`;
    res.json({ 
      success: true, 
      data: { 
        url: fileUrl,
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size
      }
    });
  } catch (error) {
    console.error('上传素材失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 创建素材
router.post('/', async (req, res) => {
  try {
    const { name, category, sub_category, content_type, content, thumbnail, width, height, description, tags } = req.body;
    
    if (!name || !content) {
      return res.status(400).json({ success: false, message: '名称和内容不能为空' });
    }
    
    const material = await LabelMaterial.create({
      name,
      category: category || 'image',
      sub_category,
      content_type: content_type || 'url',
      content,
      thumbnail,
      width,
      height,
      description,
      tags,
      is_system: false
    });
    
    res.json({ success: true, data: material, message: '素材创建成功' });
  } catch (error) {
    console.error('创建素材失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 更新素材
router.put('/:id', async (req, res) => {
  try {
    const material = await LabelMaterial.findByPk(req.params.id);
    if (!material) {
      return res.status(404).json({ success: false, message: '素材不存在' });
    }
    
    const { name, category, sub_category, content_type, content, thumbnail, width, height, description, tags, is_active, sort_order } = req.body;
    
    await material.update({
      name: name || material.name,
      category: category || material.category,
      sub_category: sub_category !== undefined ? sub_category : material.sub_category,
      content_type: content_type || material.content_type,
      content: content || material.content,
      thumbnail: thumbnail !== undefined ? thumbnail : material.thumbnail,
      width: width !== undefined ? width : material.width,
      height: height !== undefined ? height : material.height,
      description: description !== undefined ? description : material.description,
      tags: tags !== undefined ? tags : material.tags,
      is_active: is_active !== undefined ? is_active : material.is_active,
      sort_order: sort_order !== undefined ? sort_order : material.sort_order
    });
    
    res.json({ success: true, data: material, message: '素材更新成功' });
  } catch (error) {
    console.error('更新素材失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 删除素材
router.delete('/:id', async (req, res) => {
  try {
    const material = await LabelMaterial.findByPk(req.params.id);
    if (!material) {
      return res.status(404).json({ success: false, message: '素材不存在' });
    }
    
    // 系统素材不能删除
    if (material.is_system) {
      return res.status(403).json({ success: false, message: '系统素材不能删除' });
    }
    
    await material.destroy();
    res.json({ success: true, message: '素材删除成功' });
  } catch (error) {
    console.error('删除素材失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 批量初始化系统素材
router.post('/init-system', async (req, res) => {
  try {
    const systemMaterials = [
      // 认证标识
      { name: 'CE标识', category: 'certification', sub_category: 'ce_mark', content_type: 'svg', content: '<svg viewBox="0 0 100 60"><text x="5" y="45" font-size="40" font-weight="bold" font-family="Arial">CE</text></svg>', width: 60, height: 40, is_system: true, sort_order: 1 },
      { name: 'FCC标识', category: 'certification', sub_category: 'fcc', content_type: 'svg', content: '<svg viewBox="0 0 100 40"><text x="5" y="30" font-size="24" font-weight="bold" font-family="Arial">FCC</text></svg>', width: 60, height: 30, is_system: true, sort_order: 2 },
      { name: 'UKCA标识', category: 'certification', sub_category: 'ukca', content_type: 'svg', content: '<svg viewBox="0 0 100 40"><text x="5" y="30" font-size="20" font-weight="bold" font-family="Arial">UKCA</text></svg>', width: 60, height: 30, is_system: true, sort_order: 3 },
      { name: 'RoHS标识', category: 'certification', sub_category: 'rohs', content_type: 'svg', content: '<svg viewBox="0 0 100 40"><text x="5" y="30" font-size="20" font-weight="bold" font-family="Arial">RoHS</text></svg>', width: 60, height: 30, is_system: true, sort_order: 4 },
      { name: 'WEEE标识', category: 'certification', sub_category: 'weee', content_type: 'svg', content: '<svg viewBox="0 0 60 60"><rect x="5" y="5" width="50" height="50" fill="none" stroke="#000" stroke-width="2"/><line x1="30" y1="15" x2="30" y2="45" stroke="#000" stroke-width="3"/><line x1="20" y1="45" x2="40" y2="45" stroke="#000" stroke-width="3"/></svg>', width: 40, height: 40, is_system: true, sort_order: 5 },
      
      // 图标
      { name: '回收标识', category: 'icon', sub_category: 'recycle', content_type: 'svg', content: '<svg viewBox="0 0 60 60"><path d="M30 5 L50 25 L40 25 L40 55 L20 55 L20 25 L10 25 Z" fill="none" stroke="#000" stroke-width="2"/></svg>', width: 30, height: 30, is_system: true, sort_order: 10 },
      { name: '警告标识', category: 'icon', sub_category: 'warning', content_type: 'svg', content: '<svg viewBox="0 0 60 60"><polygon points="30,5 55,55 5,55" fill="none" stroke="#000" stroke-width="2"/><text x="26" y="45" font-size="24" font-weight="bold">!</text></svg>', width: 30, height: 30, is_system: true, sort_order: 11 },
      
      // 文本模板
      { name: 'MADE IN CHINA', category: 'text_template', sub_category: 'origin', content_type: 'text', content: 'MADE IN CHINA', width: 150, height: 30, is_system: true, sort_order: 20 },
      { name: 'EC REP', category: 'text_template', sub_category: 'representative', content_type: 'text', content: 'EC REP', width: 80, height: 30, is_system: true, sort_order: 21 },
      { name: 'UK REP', category: 'text_template', sub_category: 'representative', content_type: 'text', content: 'UK REP', width: 80, height: 30, is_system: true, sort_order: 22 },
      { name: 'Manufacturer', category: 'text_template', sub_category: 'label', content_type: 'text', content: 'Manufacturer', width: 120, height: 25, is_system: true, sort_order: 23 },
      { name: 'Importer', category: 'text_template', sub_category: 'label', content_type: 'text', content: 'Importer', width: 100, height: 25, is_system: true, sort_order: 24 },
    ];
    
    for (const material of systemMaterials) {
      await LabelMaterial.findOrCreate({
        where: { name: material.name, is_system: true },
        defaults: material
      });
    }
    
    res.json({ success: true, message: '系统素材初始化成功' });
  } catch (error) {
    console.error('初始化系统素材失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
