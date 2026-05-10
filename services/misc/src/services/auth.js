/**
 * 认证服务 - Token生成、验证、权限检查
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const redisService = require('./redis');

// JWT配置
const JWT_SECRET = process.env.JWT_SECRET || 'erp-jwt-secret-key-2024';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'erp-jwt-refresh-secret-2024';

/**
 * 生成密码哈希
 */
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

/**
 * 验证密码
 */
const verifyPassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

/**
 * 生成Token哈希（用于存储和黑名单）
 */
const generateTokenHash = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex').substring(0, 16);
};

/**
 * 生成访问Token
 */
const generateAccessToken = (user, context = {}) => {
  const payload = {
    userId: user.id,
    username: user.username,
    roleId: user.role_id,
    roleCode: user.role_code,
    isAdmin: user.is_admin,
    tokenVersion: user.token_version || 0,
    enterpriseId: context.currentEnterpriseId || null
  };
  
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: redisService.TOKEN_EXPIRE
  });
};

/**
 * 生成刷新Token
 */
const generateRefreshToken = (user, context = {}) => {
  const payload = {
    userId: user.id,
    type: 'refresh',
    tokenVersion: user.token_version || 0,
    enterpriseId: context.currentEnterpriseId || null
  };
  
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: redisService.REFRESH_TOKEN_EXPIRE
  });
};

/**
 * 验证访问Token
 */
const verifyAccessToken = async (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 检查Token是否在黑名单
    const tokenHash = generateTokenHash(token);
    const isBlacklisted = await redisService.isTokenBlacklisted(tokenHash);
    if (isBlacklisted) {
      return { valid: false, error: 'Token已失效' };
    }
    
    return { valid: true, decoded };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return { valid: false, error: 'Token已过期' };
    }
    return { valid: false, error: 'Token无效' };
  }
};

/**
 * 验证刷新Token
 */
const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
    if (decoded.type !== 'refresh') {
      return { valid: false, error: 'Token类型错误' };
    }
    return { valid: true, decoded };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return { valid: false, error: '刷新Token已过期，请重新登录' };
    }
    return { valid: false, error: '刷新Token无效' };
  }
};

/**
 * 使Token失效（登出时调用）
 */
const invalidateToken = async (token) => {
  const tokenHash = generateTokenHash(token);
  return redisService.addTokenToBlacklist(tokenHash);
};

/**
 * 生成随机用户ID
 */
const generateUserId = () => {
  return 'U' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 8).toUpperCase();
};

module.exports = {
  hashPassword,
  verifyPassword,
  generateTokenHash,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  invalidateToken,
  generateUserId,
  JWT_SECRET
};
