/**
 * 标签数据表模型
 * 用户可创建自定义数据表，在标签编辑器中引用字段
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  // 数据表定义
  const LabelDataTable = sequelize.define('LabelDataTable', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    description: {
      type: DataTypes.STRING(500)
    },
    // 列定义 JSON: [{ key: "col1", title: "品名", type: "text" }, ...]
    columns: {
      type: DataTypes.JSON,
      allowNull: false
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'ACTIVE'
    }
  }, {
    tableName: 'label_data_tables',
    timestamps: true,
    underscored: true
  });

  // 数据行
  const LabelDataRow = sequelize.define('LabelDataRow', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    table_id: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    // 行数据 JSON: { "col1": "值1", "col2": "值2" }
    data: {
      type: DataTypes.JSON,
      allowNull: false
    },
    sort_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    }
  }, {
    tableName: 'label_data_rows',
    timestamps: true,
    underscored: true
  });

  LabelDataTable.hasMany(LabelDataRow, { foreignKey: 'table_id', as: 'rows' });
  LabelDataRow.belongsTo(LabelDataTable, { foreignKey: 'table_id', as: 'table' });

  return { LabelDataTable, LabelDataRow };
};
