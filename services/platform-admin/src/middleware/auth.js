const jwt = require('jsonwebtoken');

const platformJwtSecret = process.env.PLATFORM_ADMIN_JWT_SECRET || `${process.env.JWT_SECRET || 'erp-jwt-secret-key'}-platform-admin`;

function requirePlatformAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ success: false, message: '未登录平台管理后台' });
  }

  try {
    req.platformUser = jwt.verify(token, platformJwtSecret);
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: '平台后台登录已失效' });
  }
}

module.exports = { requirePlatformAuth, platformJwtSecret };
