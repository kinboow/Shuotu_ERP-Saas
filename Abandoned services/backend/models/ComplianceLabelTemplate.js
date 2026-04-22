const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ComplianceLabelTemplate = sequelize.define('ComplianceLabelTemplate', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  template_name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '模板名称'
  },
  template_desc: {
    type: DataTypes.TEXT,
    comment: '模板描述'
  },
  label_width: {
    type: DataTypes.INTEGER,
    defaultValue: 100,
    comment: '标签宽度(mm)'
  },
  label_height: {
    type: DataTypes.INTEGER,
    defaultValue: 70,
    comment: '标签高度(mm)'
  },
  elements: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: '标签元素列表(JSON)'
  },
  is_default: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否默认模板'
  },
  category: {
    type: DataTypes.STRING(50),
    defaultValue: 'compliance',
    comment: '模板分类: all, factory, brand, compliance, shein, shein-compliance, temu, temu-compliance'
  },
  created_by: {
    type: DataTypes.INTEGER,
    comment: '创建人ID'
  }
}, {
  tableName: 'compliance_label_templates',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = ComplianceLabelTemplate;
