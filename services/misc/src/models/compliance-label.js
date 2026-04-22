/**
 * 合规标签模板模型
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ComplianceLabelTemplate = sequelize.define('ComplianceLabelTemplate', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    templateId: {
      type: DataTypes.STRING(32),
      unique: true,
      allowNull: false,
      field: 'template_id'
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT
    },
    labelType: {
      type: DataTypes.STRING(50),
      field: 'label_type'
    },
    country: {
      type: DataTypes.STRING(50)
    },
    region: {
      type: DataTypes.STRING(50)
    },
    template: {
      type: DataTypes.JSON
    },
    width: {
      type: DataTypes.DECIMAL(8, 2)
    },
    height: {
      type: DataTypes.DECIMAL(8, 2)
    },
    unit: {
      type: DataTypes.STRING(10),
      defaultValue: 'mm'
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'ACTIVE'
    },
    creatorId: {
      type: DataTypes.STRING(32),
      field: 'creator_id'
    },
    creatorName: {
      type: DataTypes.STRING(50),
      field: 'creator_name'
    }
  }, {
    tableName: 'compliance_label_templates',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['label_type'] },
      { fields: ['country', 'region'] },
      { fields: ['status'] }
    ]
  });

  return ComplianceLabelTemplate;
};
