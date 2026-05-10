/**
 * 企业信息管理路由
 */
const express = require('express');
const router = express.Router();
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const authService = require('../services/auth');
const {
  ensureTenantTables,
  createEnterpriseForUser,
  createJoinRequest,
  getUserEnterpriseContext,
  listEnterpriseMembers,
  listJoinRequests,
  assertEnterpriseAdmin,
  approveJoinRequest,
  rejectJoinRequest
} = require('../services/enterprise-context');

async function getAuthenticatedUser(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    throw new Error('未登录');
  }

  const { valid, decoded, error } = await authService.verifyAccessToken(token);
  if (!valid) {
    throw new Error(error || 'Token无效');
  }

  const users = await sequelize.query(
    'SELECT id, user_id, username, real_name, phone, email, role_id, is_admin, status FROM users WHERE id = :userId LIMIT 1',
    {
      replacements: { userId: decoded.userId },
      type: QueryTypes.SELECT
    }
  );

  if (!users.length) {
    throw new Error('用户不存在');
  }

  return {
    token,
    decoded,
    user: users[0]
  };
}

function serializeExtraInfo(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value);
}

/**
 * 获取企业信息
 * GET /api/enterprise
 */
router.get('/', async (req, res) => {
  try {
    await ensureTenantTables();

    const auth = await getAuthenticatedUser(req);
    const enterpriseContext = await getUserEnterpriseContext(auth.user.id, req.query.enterpriseId || auth.decoded.enterpriseId);

    if (enterpriseContext.currentEnterprise) {
      return res.json({
        success: true,
        data: enterpriseContext.currentEnterprise,
        enterprises: enterpriseContext.enterprises
      });
    }

    const enterprises = await sequelize.query('SELECT * FROM enterprise_info WHERE id = 1', {
      type: QueryTypes.SELECT
    });

    if (enterprises.length === 0) {
      await sequelize.query(`
        INSERT INTO enterprise_info (id, company_name, company_short_name)
        VALUES (1, '我的企业', '我的企业')
      `, { type: QueryTypes.INSERT });

      return res.json({
        success: true,
        data: { id: 1, company_name: '我的企业', company_short_name: '我的企业' },
        enterprises: []
      });
    }

    return res.json({ success: true, data: enterprises[0], enterprises: [] });
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
    await ensureTenantTables();

    const auth = await getAuthenticatedUser(req);
    const enterpriseContext = await getUserEnterpriseContext(auth.user.id, req.body.enterpriseId || auth.decoded.enterpriseId);

    if (enterpriseContext.currentEnterprise) {
      await assertEnterpriseAdmin(auth.user.id, enterpriseContext.currentEnterprise.id);

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

      await sequelize.query(
        `UPDATE enterprises SET
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
         WHERE id = :enterpriseId`,
        {
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
            extraInfo: serializeExtraInfo(extraInfo),
            enterpriseId: enterpriseContext.currentEnterprise.id
          },
          type: QueryTypes.UPDATE
        }
      );

      const updatedContext = await getUserEnterpriseContext(auth.user.id, enterpriseContext.currentEnterprise.id);
      return res.json({ success: true, message: '企业信息更新成功', data: updatedContext.currentEnterprise });
    }

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
        extraInfo: serializeExtraInfo(extraInfo)
      },
      type: QueryTypes.UPDATE
    });
    
    res.json({ success: true, message: '企业信息更新成功' });
  } catch (error) {
    console.error('更新企业信息失败:', error);
    res.json({ success: false, message: '更新企业信息失败: ' + error.message });
  }
});

router.post('/create', async (req, res) => {
  try {
    await ensureTenantTables();

    const auth = await getAuthenticatedUser(req);
    const currentEnterprise = await createEnterpriseForUser({
      userId: auth.user.id,
      companyName: req.body.companyName,
      companyShortName: req.body.companyShortName,
      logoUrl: req.body.logoUrl,
      contactPerson: req.body.contactPerson,
      contactPhone: req.body.contactPhone,
      contactEmail: req.body.contactEmail,
      address: req.body.address,
      businessLicense: req.body.businessLicense,
      taxNumber: req.body.taxNumber,
      bankName: req.body.bankName,
      bankAccount: req.body.bankAccount,
      extraInfo: req.body.extraInfo
    });

    return res.json({ success: true, message: '企业创建成功', data: currentEnterprise });
  } catch (error) {
    console.error('创建企业失败:', error);
    return res.json({ success: false, message: '创建企业失败: ' + error.message });
  }
});

router.get('/context', async (req, res) => {
  try {
    const auth = await getAuthenticatedUser(req);
    const enterpriseContext = await getUserEnterpriseContext(auth.user.id, req.query.enterpriseId || auth.decoded.enterpriseId);
    return res.json({ success: true, data: enterpriseContext });
  } catch (error) {
    console.error('获取企业上下文失败:', error);
    return res.json({ success: false, message: '获取企业上下文失败: ' + error.message });
  }
});

router.get('/members', async (req, res) => {
  try {
    const auth = await getAuthenticatedUser(req);
    const enterpriseContext = await getUserEnterpriseContext(auth.user.id, req.query.enterpriseId || auth.decoded.enterpriseId);
    if (!enterpriseContext.currentEnterprise) {
      return res.json({ success: false, message: '当前用户尚未加入企业' });
    }

    const members = await listEnterpriseMembers(enterpriseContext.currentEnterprise.id);
    return res.json({ success: true, data: members, currentEnterprise: enterpriseContext.currentEnterprise });
  } catch (error) {
    console.error('获取企业成员失败:', error);
    return res.json({ success: false, message: '获取企业成员失败: ' + error.message });
  }
});

router.post('/join-requests', async (req, res) => {
  try {
    const auth = await getAuthenticatedUser(req);
    const joinResult = await createJoinRequest({
      userId: auth.user.id,
      enterpriseCode: req.body.enterpriseCode,
      applicantMessage: req.body.applicantMessage
    });

    return res.json({ success: true, message: '加入申请已提交', data: joinResult });
  } catch (error) {
    console.error('提交加入申请失败:', error);
    return res.json({ success: false, message: '提交加入申请失败: ' + error.message });
  }
});

router.get('/join-requests', async (req, res) => {
  try {
    const auth = await getAuthenticatedUser(req);
    const enterpriseContext = await getUserEnterpriseContext(auth.user.id, req.query.enterpriseId || auth.decoded.enterpriseId);
    if (!enterpriseContext.currentEnterprise) {
      return res.json({ success: false, message: '当前用户尚未加入企业' });
    }

    await assertEnterpriseAdmin(auth.user.id, enterpriseContext.currentEnterprise.id);

    const requests = await listJoinRequests(enterpriseContext.currentEnterprise.id, req.query.status || 'PENDING');
    return res.json({ success: true, data: requests, currentEnterprise: enterpriseContext.currentEnterprise });
  } catch (error) {
    console.error('获取加入申请失败:', error);
    return res.json({ success: false, message: '获取加入申请失败: ' + error.message });
  }
});

router.post('/join-requests/:id/approve', async (req, res) => {
  try {
    const auth = await getAuthenticatedUser(req);
    const result = await approveJoinRequest({
      reviewerUserId: auth.user.id,
      requestId: req.params.id
    });

    return res.json({ success: true, message: '加入申请已通过', data: result });
  } catch (error) {
    console.error('审批加入申请失败:', error);
    return res.json({ success: false, message: '审批加入申请失败: ' + error.message });
  }
});

router.post('/join-requests/:id/reject', async (req, res) => {
  try {
    const auth = await getAuthenticatedUser(req);
    const result = await rejectJoinRequest({
      reviewerUserId: auth.user.id,
      requestId: req.params.id
    });

    return res.json({ success: true, message: '加入申请已拒绝', data: result });
  } catch (error) {
    console.error('拒绝加入申请失败:', error);
    return res.json({ success: false, message: '拒绝加入申请失败: ' + error.message });
  }
});

module.exports = router;
