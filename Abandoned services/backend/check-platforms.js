const sequelize = require('./config/database');
const PlatformShop = require('./models/PlatformShop');
const PlatformConfig = require('./models/PlatformConfig');

async function checkPlatforms() {
  try {
    await sequelize.sync();
    
    console.log('=== 检查平台配置 ===\n');
    
    const configs = await PlatformConfig.findAll();
    console.log(`平台配置数量: ${configs.length}`);
    configs.forEach(c => {
      console.log(`- ${c.platform_display_name} (${c.platform_name})`);
      console.log(`  App ID: ${c.app_id}`);
      console.log(`  环境: ${c.api_environment}`);
      console.log(`  域名: ${c.api_domain}`);
      console.log(`  激活: ${c.is_active}`);
      console.log('');
    });
    
    console.log('=== 检查平台店铺 ===\n');
    
    const shops = await PlatformShop.findAll({
      include: [{
        model: PlatformConfig,
        as: 'platform',
        required: false
      }]
    });
    
    console.log(`平台店铺数量: ${shops.length}`);
    shops.forEach(s => {
      console.log(`- ${s.shop_name || '未命名'} (${s.platform_name})`);
      console.log(`  ID: ${s.id}`);
      console.log(`  店铺编码: ${s.shop_code}`);
      console.log(`  OpenKeyId: ${s.open_key_id}`);
      console.log(`  SecretKey: ${s.secret_key ? '已设置' : '未设置'}`);
      console.log(`  激活: ${s.is_active}`);
      console.log(`  授权时间: ${s.auth_time}`);
      console.log('');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('检查失败:', error);
    process.exit(1);
  }
}

checkPlatforms();
