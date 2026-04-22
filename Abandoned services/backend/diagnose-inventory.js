/**
 * 库存查询诊断脚本
 * 用于诊断为什么返回空的库存数据
 */

const sequelize = require('./config/database');
const { QueryTypes } = require('sequelize');

async function diagnose() {
  console.log('========================================');
  console.log('库存查询诊断');
  console.log('========================================\n');

  try {
    // 1. 检查店铺配置
    console.log('1. 检查店铺配置');
    const shops = await sequelize.query(
      `SELECT ps.id, ps.shop_name, ps.platform_name, 
              ps.open_key_id, 
              CASE WHEN ps.secret_key IS NOT NULL THEN '已配置' ELSE '未配置' END as secret_key_status,
              pc.api_domain,
              ps.is_active
       FROM PlatformShops ps
       LEFT JOIN PlatformConfigs pc ON ps.platform_id = pc.id
       WHERE ps.platform_name LIKE 'shein%' AND ps.is_active = 1`,
      { type: QueryTypes.SELECT }
    );

    if (shops.length === 0) {
      console.log('   ❌ 没有找到激活的SHEIN店铺');
      return;
    }

    console.log(`   ✓ 找到${shops.length}个激活的SHEIN店铺`);
    shops.forEach(shop => {
      console.log(`   - 店铺ID: ${shop.id}`);
      console.log(`     店铺名称: ${shop.shop_name}`);
      console.log(`     OpenKeyId: ${shop.open_key_id ? '已配置' : '未配置'}`);
      console.log(`     SecretKey: ${shop.secret_key_status}`);
      console.log(`     API域名: ${shop.api_domain || '未配置'}`);
    });

    // 2. 检查商品数据
    console.log('\n2. 检查商品数据');
    for (const shop of shops) {
      const products = await sequelize.query(
        `SELECT COUNT(*) as total,
                COUNT(DISTINCT spu_name) as spu_count,
                COUNT(DISTINCT skc_name) as skc_count,
                COUNT(DISTINCT sku_code) as sku_count
         FROM SheinProducts
         WHERE shop_id = :shopId AND spu_name IS NOT NULL AND spu_name != ''`,
        {
          replacements: { shopId: shop.id },
          type: QueryTypes.SELECT
        }
      );

      const product = products[0];
      console.log(`   店铺 ${shop.shop_name} (ID: ${shop.id}):`);
      console.log(`   - 总商品数: ${product.total}`);
      console.log(`   - SPU数量: ${product.spu_count}`);
      console.log(`   - SKC数量: ${product.skc_count}`);
      console.log(`   - SKU数量: ${product.sku_count}`);

      if (product.spu_count > 0) {
        // 获取前5个SPU作为示例
        const sampleSpus = await sequelize.query(
          `SELECT DISTINCT spu_name 
           FROM SheinProducts 
           WHERE shop_id = :shopId AND spu_name IS NOT NULL AND spu_name != ''
           LIMIT 5`,
          {
            replacements: { shopId: shop.id },
            type: QueryTypes.SELECT
          }
        );

        console.log(`   - 示例SPU (前5个):`);
        sampleSpus.forEach(s => console.log(`     * ${s.spu_name}`));
      }
    }

    // 3. 检查API域名
    console.log('\n3. 检查API域名配置');
    const configs = await sequelize.query(
      `SELECT platform_name, api_domain, api_environment, is_active
       FROM PlatformConfigs
       WHERE platform_name LIKE 'shein%'`,
      { type: QueryTypes.SELECT }
    );

    configs.forEach(config => {
      console.log(`   ${config.platform_name}:`);
      console.log(`   - API域名: ${config.api_domain || '未配置'}`);
      console.log(`   - 环境: ${config.api_environment}`);
      console.log(`   - 状态: ${config.is_active ? '激活' : '未激活'}`);
    });

    // 4. 诊断建议
    console.log('\n4. 诊断建议');
    console.log('   如果返回空的库存数据，可能的原因：');
    console.log('   1. SPU在SHEIN系统中不存在或已删除');
    console.log('   2. SPU没有库存数据（从未入库）');
    console.log('   3. 仓库类型选择错误（1=SHEIN仓，2=半托管虚拟库存，3=全托管虚拟库存）');
    console.log('   4. 店铺授权已过期或无效');
    console.log('   5. API签名错误');
    
    console.log('\n   排查步骤：');
    console.log('   1. 检查后端日志，查看完整的API响应');
    console.log('   2. 确认SPU是否在SHEIN后台存在');
    console.log('   3. 尝试使用不同的仓库类型查询');
    console.log('   4. 使用测试脚本单独测试几个SPU');
    console.log('   5. 检查SHEIN后台是否有库存数据');

    console.log('\n========================================');
    console.log('诊断完成');
    console.log('========================================');

  } catch (error) {
    console.error('诊断过程出错:', error);
  } finally {
    await sequelize.close();
  }
}

// 运行诊断
diagnose();
