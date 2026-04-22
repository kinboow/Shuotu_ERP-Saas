const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * JWT认证中间件
 * 验证请求中的Token，并将用户信息添加到req.user
 */
const authMiddleware = async (req, res, next) => {
  try {
    // 从请求头获取token
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: '未提供认证令牌'
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // 验证token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret_key');

    // 从数据库获取用户信息
    const user = await User.findOne({
      where: { uid: decoded.uid },
      attributes: ['id', 'uid', 'name', 'phone', 'avatar']
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 将用户信息添加到请求对象
    req.user = {
      id: user.id,
      uid: user.uid,
      name: user.name,
      phone: user.phone,
      avatar: user.avatar
    };

    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: '无效的认证令牌'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: '认证令牌已过期，请重新登录'
      });
    }

    console.error('认证中间件错误:', error);
    return res.status(500).json({
      success: false,
      message: '认证失败',
      error: error.message
    });
  }
};

/**
 * 可选的认证中间件
 * 如果有token则验证，没有token则继续
 */
const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret_key');

    const user = await User.findOne({
      where: { uid: decoded.uid },
      attributes: ['id', 'uid', 'name', 'phone', 'avatar']
    });

    if (user) {
      req.user = {
        id: user.id,
        uid: user.uid,
        name: user.name,
        phone: user.phone,
        avatar: user.avatar
      };
    }

    next();

  } catch (error) {
    // 可选认证失败不返回错误，继续执行
    next();
  }
};

module.exports = {
  authMiddleware,
  optionalAuthMiddleware
};
