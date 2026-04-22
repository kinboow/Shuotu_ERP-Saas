/**
 * 快递商报单模型
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CourierReport = sequelize.define('courier_reports', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    report_no: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: '报单编号'
    },
    courier_company: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: '快递公司'
    },
    report_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: '报单日期'
    },
    large_package_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '大件数量'
    },
    small_package_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '小件数量'
    },
    total_package_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '总件数'
    },
    operator_id: {
      type: DataTypes.STRING(50),
      comment: '操作员ID'
    },
    operator_name: {
      type: DataTypes.STRING(100),
      comment: '操作员姓名'
    },
    device_type: {
      type: DataTypes.STRING(50),
      defaultValue: 'pda',
      comment: '设备类型'
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'submitted',
      comment: '状态: submitted已提交, confirmed已确认, cancelled已取消'
    },
    remark: {
      type: DataTypes.TEXT,
      comment: '备注'
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    comment: '快递商报单表'
  });

  return CourierReport;
};
