/**
 * 快递商报单路由
 */

const express = require('express');
const router = express.Router();
const { CourierReport, CourierReportItem, CourierCompany } = require('../models');
const { Op } = require('sequelize');

// 生成报单编号
function generateReportNo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `CR${year}${month}${day}${random}`;
}

// 获取快递公司列表
router.get('/courier-companies', async (req, res) => {
  try {
    const companies = await CourierCompany.findAll({
      where: { is_active: 1 },
      order: [['sort_order', 'ASC'], ['company_name', 'ASC']]
    });
    
    res.json({
      success: true,
      data: companies
    });
  } catch (error) {
    console.error('[快递公司列表] 错误:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 创建报单
router.post('/courier-reports', async (req, res) => {
  try {
    const {
      courier_company,
      report_date,
      large_package_count,
      small_package_count,
      packages,
      operator_id,
      operator_name,
      user_type,
      logistics_id,
      remark
    } = req.body;

    // 验证必填字段
    if (!courier_company || !report_date) {
      return res.status(400).json({
        success: false,
        message: '快递公司和报单日期为必填项'
      });
    }

    // 生成报单编号
    const report_no = generateReportNo();

    // 计算总件数
    const total_package_count = (large_package_count || 0) + (small_package_count || 0);

    // 创建报单
    const report = await CourierReport.create({
      report_no,
      courier_company,
      report_date,
      large_package_count: large_package_count || 0,
      small_package_count: small_package_count || 0,
      total_package_count,
      operator_id,
      operator_name,
      user_type: user_type || 'employee',
      logistics_id: logistics_id || null,
      device_type: 'pda',
      status: 'submitted',
      remark
    });

    // 创建报单明细
    if (packages && packages.length > 0) {
      const items = packages.map(pkg => ({
        report_id: report.id,
        report_no: report.report_no,
        package_no: pkg.package_no,
        package_type: pkg.package_type || 'small',
        scan_time: pkg.scan_time || new Date(),
        remark: pkg.remark
      }));

      await CourierReportItem.bulkCreate(items);
    }

    res.json({
      success: true,
      message: '报单创建成功',
      data: {
        id: report.id,
        report_no: report.report_no
      }
    });
  } catch (error) {
    console.error('[创建报单] 错误:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 获取报单列表
router.get('/courier-reports', async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      courier_company,
      status,
      start_date,
      end_date,
      report_no
    } = req.query;

    const where = {};

    if (courier_company) {
      where.courier_company = courier_company;
    }

    if (status) {
      where.status = status;
    }

    if (report_no) {
      where.report_no = { [Op.like]: `%${report_no}%` };
    }

    if (start_date && end_date) {
      where.report_date = {
        [Op.between]: [start_date, end_date]
      };
    } else if (start_date) {
      where.report_date = { [Op.gte]: start_date };
    } else if (end_date) {
      where.report_date = { [Op.lte]: end_date };
    }

    const { count, rows } = await CourierReport.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(pageSize),
      offset: (parseInt(page) - 1) * parseInt(pageSize)
    });

    res.json({
      success: true,
      data: {
        list: rows,
        total: count,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    console.error('[报单列表] 错误:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 获取报单详情
router.get('/courier-reports/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const report = await CourierReport.findByPk(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: '报单不存在'
      });
    }

    // 获取报单明细
    const items = await CourierReportItem.findAll({
      where: { report_id: id },
      order: [['scan_time', 'ASC']]
    });

    res.json({
      success: true,
      data: {
        ...report.toJSON(),
        items
      }
    });
  } catch (error) {
    console.error('[报单详情] 错误:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 更新报单状态
router.put('/courier-reports/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['submitted', 'confirmed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: '无效的状态值'
      });
    }

    const report = await CourierReport.findByPk(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: '报单不存在'
      });
    }

    await report.update({ status });

    res.json({
      success: true,
      message: '状态更新成功'
    });
  } catch (error) {
    console.error('[更新报单状态] 错误:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 删除报单
router.delete('/courier-reports/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const report = await CourierReport.findByPk(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: '报单不存在'
      });
    }

    // 删除报单（会级联删除明细）
    await report.destroy();

    res.json({
      success: true,
      message: '报单删除成功'
    });
  } catch (error) {
    console.error('[删除报单] 错误:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 统计数据
router.get('/courier-reports/stats/summary', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    const where = {};

    if (start_date && end_date) {
      where.report_date = {
        [Op.between]: [start_date, end_date]
      };
    }

    // 按快递公司统计
    const stats = await CourierReport.findAll({
      attributes: [
        'courier_company',
        [CourierReport.sequelize.fn('COUNT', CourierReport.sequelize.col('id')), 'report_count'],
        [CourierReport.sequelize.fn('SUM', CourierReport.sequelize.col('large_package_count')), 'total_large'],
        [CourierReport.sequelize.fn('SUM', CourierReport.sequelize.col('small_package_count')), 'total_small'],
        [CourierReport.sequelize.fn('SUM', CourierReport.sequelize.col('total_package_count')), 'total_packages']
      ],
      where,
      group: ['courier_company'],
      raw: true
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[报单统计] 错误:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
