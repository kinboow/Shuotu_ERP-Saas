/**
 * 初始化平台配置脚本
 * 用于设置SHEIN平台的AppID、AppSecret等信息
 */

require('dotenv').config();
const sequelize = require('../config/database');
const PlatformConfig = require('../models/PlatformConfig');

async function initPlatformConfig() {
  try {
    console.log('========================================');
    console.log('初始化平台配置');
    console.log('========================================');

    // 连接数据库
    await sequelize.authenticate();
    console.log('✓ 数据库连接成功');

    // 同步模型
    await sequelize.sync();
    console.log('✓ 数据库模型同步完成');

    // 检查是否已存在SHEIN(全托管)配置
    const existingConfig = await PlatformConfig.findOne({
      where: { platform_name: 'shein_full' }
    });

    if (existingConfig) {
      console.log('\n⚠️  SHEIN(全托管)平台配置已存在');
      console.log('当前配置:');
      console.log('  AppID:', existingConfig.app_id);
      console.log('  回调地址:', existingConfig.callback_url);
      console.log('  环境:', existingConfig.api_environment);
      console.log('  状态:', existingConfig.is_active ? '启用' : '禁用');
      
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      readline.question('\n是否要更新配置？(y/n): ', async (answer) => {
        if (answer.toLowerCase() === 'y') {
          await updateConfig(existingConfig);
        } else {
          console.log('\n取消更新');
        }
        readline.close();
        process.exit(0);
      });
    } else {
      await createConfig();
    }
  } catch (error) {
    console.error('❌ 初始化失败:', error);
    process.exit(1);
  }
}

async function createConfig() {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('\n========================================');
  console.log('创建SHEIN(全托管)平台配置');
  console.log('========================================');

  const config = {};

  // 获取AppID
  await new Promise((resolve) => {
    readline.question('请输入SHEIN AppID: ', (answer) => {
      config.app_id = answer.trim();
      resolve();
    });
  });

  // 获取AppSecret
  await new Promise((resolve) => {
    readline.question('请输入SHEIN AppSecret: ', (answer) => {
      config.app_secret = answer.trim();
      resolve();
    });
  });

  // 获取回调地址
  await new Promise((resolve) => {
    readline.question('请输入回调地址 (默认: http://localhost:3000/shein-callback): ', (answer) => {
      config.callback_url = answer.trim() || 'http://localhost:3000/shein-callback';
      resolve();
    });
  });

  readline.close();

  // 创建配置
  const platformConfig = await PlatformConfig.create({
    platform_name: 'shein_full',
    platform_display_name: 'SHEIN(全托管)',
    app_id: config.app_id,
    app_secret: config.app_secret,
    callback_url: config.callback_url,
    api_environment: 'production',
    api_domain: 'https://openapi.sheincorp.com',
    is_active: true,
    remarks: 'SHEIN全托管平台配置'
  });

  console.log('\n========================================');
  console.log('✓ SHEIN(全托管)平台配置创建成功');
  console.log('========================================');
  console.log('配置信息:');
  console.log('  ID:', platformConfig.id);
  console.log('  平台:', platformConfig.platform_display_name);
  console.log('  AppID:', platformConfig.app_id);
  console.log('  回调地址:', platformConfig.callback_url);
  console.log('  环境:', platformConfig.api_environment);
  console.log('========================================');

  process.exit(0);
}

async function updateConfig(existingConfig) {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('\n========================================');
  console.log('更新SHEIN(全托管)平台配置');
  console.log('========================================');
  console.log('留空则保持原值');

  const updates = {};

  // 更新AppID
  await new Promise((resolve) => {
    readline.question(`AppID (当前: ${existingConfig.app_id}): `, (answer) => {
      if (answer.trim()) updates.app_id = answer.trim();
      resolve();
    });
  });

  // 更新AppSecret
  await new Promise((resolve) => {
    readline.question(`AppSecret (当前: ${existingConfig.app_secret.substring(0, 10)}...): `, (answer) => {
      if (answer.trim()) updates.app_secret = answer.trim();
      resolve();
    });
  });

  // 更新回调地址
  await new Promise((resolve) => {
    readline.question(`回调地址 (当前: ${existingConfig.callback_url}): `, (answer) => {
      if (answer.trim()) updates.callback_url = answer.trim();
      resolve();
    });
  });

  readline.close();

  if (Object.keys(updates).length > 0) {
    await existingConfig.update(updates);
    console.log('\n✓ 配置更新成功');
  } else {
    console.log('\n未做任何更改');
  }

  process.exit(0);
}

// 运行初始化
initPlatformConfig();
