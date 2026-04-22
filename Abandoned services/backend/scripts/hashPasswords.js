/**
 * 密码加密脚本
 * 将eb_admin表中的明文密码加密为bcrypt格式
 */

const bcrypt = require('bcrypt');
const authDbPool = require('../config/authDatabase');

async function hashPasswords() {
  try {
    console.log('开始加密密码...');
    
    // 1. 查询所有用户
    const [users] = await authDbPool.query(
      'SELECT uid, phone, password FROM eb_admin'
    );
    
    console.log(`找到 ${users.length} 个用户`);
    
    // 2. 遍历每个用户，加密密码
    for (const user of users) {
      // 检查密码是否已经是bcrypt格式（bcrypt哈希以$2b$开头）
      if (user.password && user.password.startsWith('$2b$')) {
        console.log(`✓ 用户 ${user.phone} 的密码已加密，跳过`);
        continue;
      }
      
      // 加密明文密码
      const hashedPassword = await bcrypt.hash(user.password, 10);
      
      // 更新数据库
      await authDbPool.query(
        'UPDATE eb_admin SET password = ? WHERE uid = ?',
        [hashedPassword, user.uid]
      );
      
      console.log(`✓ 用户 ${user.phone} 的密码已加密`);
    }
    
    console.log('所有密码加密完成！');
    process.exit(0);
    
  } catch (error) {
    console.error('密码加密失败:', error);
    process.exit(1);
  }
}

hashPasswords();
