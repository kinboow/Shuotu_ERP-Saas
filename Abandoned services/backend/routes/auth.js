const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authDbPool = require('../config/authDatabase');
const User = require('../models/User');

/**
 * 用户登录
 * POST /api/auth/login
 * Body: { phone, password }
 */
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    // 验证输入
    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: '请输入手机号和密码'
      });
    }

    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: '手机号格式不正确'
      });
    }

    console.log('========================================');
    console.log('用户登录请求');
    console.log('========================================');
    console.log('手机号:', phone);
    console.log('时间:', new Date().toLocaleString('zh-CN'));

    // 1. 从认证数据库（B数据库）查询用户
    const [users] = await authDbPool.query(
      'SELECT uid, name, phone, avatar, password, status FROM eb_admin WHERE phone = ? LIMIT 1',
      [phone]
    );

    if (users.length === 0) {
      console.log('❌ 用户不存在');
      return res.status(401).json({
        success: false,
        message: '手机号或密码错误'
      });
    }

    const authUser = users[0];

    // 检查用户状态
    if (authUser.status !== 1) {
      console.log('❌ 用户已被锁定');
      return res.status(403).json({
        success: false,
        message: '账号已被锁定，请联系管理员'
      });
    }

    // 2. 验证密码（bcrypt）
    // 处理PHP bcrypt格式($2y$)与Node.js bcrypt格式($2b$)的兼容性
    let passwordToCompare = authUser.password;
    if (passwordToCompare.startsWith('$2y$')) {
      // 将PHP的$2y$格式转换为Node.js的$2b$格式
      passwordToCompare = '$2b$' + passwordToCompare.substring(4);
    }
    
    const isPasswordValid = await bcrypt.compare(password, passwordToCompare);

    if (!isPasswordValid) {
      console.log('❌ 密码错误');
      console.log('原始哈希:', authUser.password.substring(0, 20) + '...');
      console.log('转换后哈希:', passwordToCompare.substring(0, 20) + '...');
      return res.status(401).json({
        success: false,
        message: '手机号或密码错误'
      });
    }

    console.log('✓ 密码验证成功');
    console.log('用户UID:', authUser.uid);
    console.log('用户姓名:', authUser.name);

    // 3. 同步用户信息到A数据库（ERP数据库）
    const [user, created] = await User.findOrCreate({
      where: { uid: authUser.uid },
      defaults: {
        uid: authUser.uid,
        name: authUser.name,
        phone: authUser.phone,
        avatar: authUser.avatar || '',
        last_login: new Date(),
        login_count: 1
      }
    });

    // 如果用户已存在，更新信息
    if (!created) {
      await user.update({
        name: authUser.name,
        phone: authUser.phone,
        avatar: authUser.avatar || '',
        last_login: new Date(),
        login_count: user.login_count + 1
      });
      console.log('✓ 用户信息已更新');
    } else {
      console.log('✓ 新用户信息已创建');
    }

    // 4. 生成JWT Token
    const token = jwt.sign(
      { 
        uid: authUser.uid,
        phone: authUser.phone,
        name: authUser.name
      },
      process.env.JWT_SECRET || 'default_secret_key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    console.log('✓ Token生成成功');
    console.log('========================================');

    // 5. 返回登录成功信息
    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        user: {
          uid: authUser.uid,
          name: authUser.name,
          phone: authUser.phone,
          avatar: authUser.avatar || ''
        }
      }
    });

  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({
      success: false,
      message: '登录失败，请稍后重试',
      error: error.message
    });
  }
});

/**
 * 获取当前用户信息
 * GET /api/auth/me
 * Headers: Authorization: Bearer <token>
 */
router.get('/me', async (req, res) => {
  try {
    // 从请求头获取token
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未提供认证令牌'
      });
    }

    // 验证token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret_key');

    // 从A数据库获取用户信息
    const user = await User.findOne({
      where: { uid: decoded.uid },
      attributes: ['uid', 'name', 'phone', 'avatar', 'last_login', 'login_count']
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          uid: user.uid,
          name: user.name,
          phone: user.phone,
          avatar: user.avatar,
          last_login: user.last_login,
          login_count: user.login_count
        }
      }
    });

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
        message: '认证令牌已过期'
      });
    }

    console.error('��取用户信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户信息失败',
      error: error.message
    });
  }
});

/**
 * 用户登出
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  // JWT是无状态的，登出主要在前端清除token
  res.json({
    success: true,
    message: '登出成功'
  });
});

module.exports = router;
