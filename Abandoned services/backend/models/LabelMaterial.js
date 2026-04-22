const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LabelMaterial = sequelize.define('LabelMaterial', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '素材名称'
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'image',
    comment: '素材类型: image, icon, logo, certification, text_template'
  },
  sub_category: {
    type: DataTypes.STRING(100),
    comment: '子分类: ce_mark, fcc, ukca, rohs, weee, etc'
  },
  content_type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'url',
    comment: '内容类型: url, base64, svg'
  },
  content: {
    type: DataTypes.TEXT('long'),
    allowNull: false,
    comment: '素材内容(URL/Base64/SVG代码)'
  },
  thumbnail: {
    type: DataTypes.TEXT,
    comment: '缩略图(Base64或URL)'
  },
  width: {
    type: DataTypes.INTEGER,
    comment: '默认宽度(px)'
  },
  height: {
    type: DataTypes.INTEGER,
    comment: '默认高度(px)'
  },
  description: {
    type: DataTypes.TEXT,
    comment: '素材描述'
  },
  tags: {
    type: DataTypes.JSON,
    comment: '标签(用于搜索)'
  },
  is_system: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否系统内置素材'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否启用'
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '排序顺序'
  },
  created_by: {
    type: DataTypes.INTEGER,
    comment: '创建人ID'
  }
}, {
  tableName: 'label_materials',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = LabelMaterial;
