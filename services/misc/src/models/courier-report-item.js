/**
 * 快递商报单明细模型
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CourierReportItem = sequelize.define('courier_report_items', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    report_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      comment: '报单ID'
    },
    report_no: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: '报单编号'
    },
    package_no: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: '包裹号/快递单号'
    },
    package_type: {
      type: DataTypes.STRING(20),
      defaultValue: 'small',
      comment: '包裹类型: large大件, small小件'
    },
    scan_time: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: '扫描时间'
    },
    remark: {
      type: DataTypes.STRING(500),
      comment: '备注'
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    comment: '快递商报单明细表'
  });

  return CourierReportItem;
};
