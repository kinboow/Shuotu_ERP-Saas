/**
 * 认证服务
 */

const { User } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'erp-jwt-secret-key';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

class AuthService {
  generateId() {
    const date = new Date();
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `U${dateStr}${random}`;
  }

  // 注册
  async register(data) {
    const { username, password, nickname, email, phone, role } = data;

    const existing = await User.findOne({ where: { username } });
    if (existing) throw new Error('用户名已存在');

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      userId: this.generateId(),
      username,
      password: hashedPassword,
      nickname: nickname || username,
      email,
      phone,
      role: role || 'user',
      status: 'ACTIVE'
    });

    return { userId: user.userId, username: user.username, nickname: user.nickname };
  }

  // 登录
  async login(username, password, ip) {
    const user = await User.findOne({ where: { username } });
    if (!user) throw new Error('用户不存在');
    if (user.status !== 'ACTIVE') throw new Error('用户已禁用');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new Error('密码错误');

    // 更新登录信息
    await user.update({ lastLoginAt: new Date(), lastLoginIp: ip });

    // 生成Token
    const token = jwt.sign(
      { userId: user.userId, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    return {
      token,
      user: {
        userId: user.userId,
        username: user.username,
        nickname: user.nickname,
        role: user.role,
        avatar: user.avatar
      }
    };
  }

  // 验证Token
  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      throw new Error('Token无效或已过期');
    }
  }

  // 获取用户信息
  async getUserInfo(userId) {
    const user = await User.findOne({
      where: { userId },
      attributes: { exclude: ['password'] }
    });
    if (!user) throw new Error('用户不存在');
    return user;
  }

  // 修改密码
  async changePassword(userId, oldPassword, newPassword) {
    const user = await User.findOne({ where: { userId } });
    if (!user) throw new Error('用户不存在');

    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) throw new Error('原密码错误');

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hashedPassword });
    return { success: true };
  }

  // 查询用户列表
  async queryUsers(params = {}) {
    const { role, status, keyword, page = 1, pageSize = 20 } = params;
    const where = {};
    if (role) where.role = role;
    if (status) where.status = status;

    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password'] },
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    return { list: rows, total: count, page, pageSize };
  }
}

module.exports = new AuthService();
