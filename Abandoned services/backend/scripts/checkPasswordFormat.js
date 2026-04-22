/**
 * 检查密码格式脚本
 * 查看B数据库中密码是明文还是已加密
 */

require('dotenv').config();
const authDbPool = require('../config/authDatabase');

async function checkPasswordFormat() {
  try {
    console.log('正在检查密码格式...\n');
    
    // 查询所有用户的密码（只显示前20个字符）
    const [users] = await authDbPool.query(
      'SELECT uid, phone, LEFT(password, 20) as password_preview FROM eb_admin LIMIT 5'
    );
    
    console.log('用户密码格式预览：');
    console.log('='.repeat(80));
    
    users.forEach(user => {
      const isBcrypt = user.password_preview.startsWith('$2b$') || 
                       user.password_preview.startsWith('$2a$') || 
                       user.password_preview.startsWith('$2y$');
      
      console.log(`手机号: ${user.phone}`);
      console.log(`密码前缀: ${user.password_preview}...`);
      console.log(`格式: ${isBcrypt ? '✓ 已加密(bcrypt)' : '✗ 明文或其他格式'}`);
      console.log('-'.repeat(80));
    });
    
    await authDbPool.end();
    
  } catch (error) {
    console.error('检查失败:', error.message);
    process.exit(1);
  }
}

checkPasswordFormat();
