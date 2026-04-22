/**
 * 登录测试脚本
 * 测试密码验证逻辑
 */

require('dotenv').config();
const bcrypt = require('bcrypt');
const authDbPool = require('../config/authDatabase');

async function testLogin() {
  try {
    // 从命令行获取手机号和密码
    const phone = process.argv[2];
    const password = process.argv[3];
    
    if (!phone || !password) {
      console.log('使用方法: node testLogin.js <手机号> <密码>');
      console.log('例如: node testLogin.js 13800138000 123456');
      process.exit(1);
    }
    
    console.log('='.repeat(80));
    console.log('登录测试');
    console.log('='.repeat(80));
    console.log('手机号:', phone);
    console.log('密码:', password);
    console.log('');
    
    // 1. 查询用户
    console.log('步骤1: 从B数据库查询用户...');
    const [users] = await authDbPool.query(
      'SELECT uid, name, phone, password, status FROM eb_admin WHERE phone = ? LIMIT 1',
      [phone]
    );
    
    if (users.length === 0) {
      console.log('❌ 用户不存在');
      await authDbPool.end();
      process.exit(1);
    }
    
    const user = users[0];
    console.log('✓ 找到用户');
    console.log('  - UID:', user.uid);
    console.log('  - 姓名:', user.name);
    console.log('  - 状态:', user.status);
    console.log('  - 密码哈希前缀:', user.password.substring(0, 20) + '...');
    console.log('');
    
    // 2. 检查状态
    console.log('步骤2: 检查用户状态...');
    if (user.status !== 1) {
      console.log('❌ 用户已被锁定');
      await authDbPool.end();
      process.exit(1);
    }
    console.log('✓ 用户状态正常');
    console.log('');
    
    // 3. 验证密码
    console.log('步骤3: 验证密码...');
    console.log('  - 输入的密码:', password);
    console.log('  - 数据库密码哈希:', user.password.substring(0, 30) + '...');
    
    // 处理PHP bcrypt格式($2y$)与Node.js bcrypt格式($2b$)的兼容性
    let passwordToCompare = user.password;
    if (passwordToCompare.startsWith('$2y$')) {
      console.log('  - 检测到PHP bcrypt格式($2y$)，转换为Node.js格式($2b$)');
      passwordToCompare = '$2b$' + passwordToCompare.substring(4);
      console.log('  - 转换后哈希:', passwordToCompare.substring(0, 30) + '...');
    }
    
    const isPasswordValid = await bcrypt.compare(password, passwordToCompare);
    
    console.log('  - bcrypt.compare 结果:', isPasswordValid);
    console.log('');
    
    if (isPasswordValid) {
      console.log('✅ 密码验证成功！登录应该可以正常工作');
    } else {
      console.log('❌ 密码验证失败！');
      console.log('');
      console.log('可能的原因：');
      console.log('1. 输入的密码不正确');
      console.log('2. 数据库中的密码哈希格式不对');
      console.log('3. bcrypt版本不兼容');
      console.log('');
      console.log('建议：');
      console.log('- 确认输入的密码是否正确');
      console.log('- 检查数据库中的密码是否是用bcrypt加密的');
    }
    
    console.log('='.repeat(80));
    
    await authDbPool.end();
    
  } catch (error) {
    console.error('测试失败:', error);
    process.exit(1);
  }
}

testLogin();
