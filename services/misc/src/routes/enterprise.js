/**
 * 企业信息管理路由
 */
const express = require('express');
const router = express.Router();
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

/**
 * 获取企业信息
 * GET /api/enterprise
 */
router.get('/', async (req, res) => {
  try {
    const enterprises = await sequelize.query('SELECT * FROM enterprise_info WHERE id = 1', {
      type: QueryTypes.SELECT
    });
    
    if (enterprises.length === 0) {
      // 如果不存在，创建默认记录
      await sequelize.query(`
        INSERT INTO enterprise_info (id, company_name, company_short_name) 
        VALUES (1, '我的企业', '我的企业')
      `, { type: QueryTypes.INSERT });
      
      return res.json({
        success: true,
        data: { id: 1, company_name: '我的企业', company_short_name: '我的企业' }
      });
    }
    
    res.json({ success: true, data: enterprises[0] });
  } catch (error) {
    console.error('获取企业信息失败:', error);
    res.json({ success: false, message: '获取企业信息失败: ' + error.message });
  }
});

/**
 * 更新企业信息
 * PUT /api/enterprise
 */
router.put('/', async (req, res) => {
  try {
    const {
      companyName,
      companyShortName,
      logoUrl,
      contactPerson,
      contactPhone,
      contactEmail,
      address,
      businessLicense,
      taxNumber,
      bankName,
      bankAccount,
      extraInfo
    } = req.body;
    
    await sequelize.query(`
      UPDATE enterprise_info SET
        company_name = COALESCE(:companyName, company_name),
        company_short_name = COALESCE(:companyShortName, company_short_name),
        logo_url = COALESCE(:logoUrl, logo_url),
        contact_person = COALESCE(:contactPerson, contact_person),
        contact_phone = COALESCE(:contactPhone, contact_phone),
        contact_email = COALESCE(:contactEmail, contact_email),
        address = COALESCE(:address, address),
        business_license = COALESCE(:businessLicense, business_license),
        tax_number = COALESCE(:taxNumber, tax_number),
        bank_name = COALESCE(:bankName, bank_name),
        bank_account = COALESCE(:bankAccount, bank_account),
        extra_info = COALESCE(:extraInfo, extra_info),
        updated_at = NOW()
      WHERE id = 1
    `, {
      replacements: {
        companyName,
        companyShortName,
        logoUrl,
        contactPerson,
        contactPhone,
        contactEmail,
        address,
        businessLicense,
        taxNumber,
        bankName,
        bankAccount,
        extraInfo: extraInfo ? JSON.stringify(extraInfo) : null
      },
      type: QueryTypes.UPDATE
    });
    
    res.json({ success: true, message: '企业信息更新成功' });
  } catch (error) {
    console.error('更新企业信息失败:', error);
    res.json({ success: false, message: '更新企业信息失败: ' + error.message });
  }
});

module.exports = router;
