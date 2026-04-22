/**
 * 强制同步 Sequelize 模型到数据库
 * 这会检查模型和数据库的差异，并尝试修复
 */

const sequelize = require('./config/database');
const SheinProduct = require('./models/SheinProduct');

async function forceSyncModel() {
  try {
    console.log('🔧 强制同步 SheinProduct 模型...\n');

    // 1. 检查当前数据库
    const [dbResult] = await sequelize.query('SELECT DATABASE() as db_name');
    console.log('📊 当前数据库:', dbResult[0].db_name);
    console.log('📊 数据库主机:', sequelize.config.host);
    console.log('');

    // 2. 获取模型定义的所有字段
    console.log('📝 模型定义的字段：');
    const modelFields = Object.keys(SheinProduct.rawAttributes);
    console.log(`共 ${modelFields.length} 个字段\n`);

    // 3. 获取数据库实际的字段
    const [dbFields] = await sequelize.query(`
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'SheinProducts'
      ORDER BY ORDINAL_POSITION
    `);
    
    const dbFieldNames = dbFields.map(f => f.COLUMN_NAME);
    console.log('📊 数据库实际的字段：');
    console.log(`共 ${dbFieldNames.length} 个字段\n`);

    // 4. 找出差异
    const missingInDb = modelFields.filter(f => !dbFieldNames.includes(f));
    const extraInDb = dbFieldNames.filter(f => !modelFields.includes(f));

    if (missingInDb.length > 0) {
      console.log('❌ 模型中有但数据库中缺失的字段：');
      missingInDb.forEach(f => console.log(`  - ${f}`));
      console.log('');
    }

    if (extraInDb.length > 0) {
      console.log('⚠️  数据库中有但模型中没有的字段：');
      extraInDb.forEach(f => console.log(`  - ${f}`));
      console.log('');
    }

    if (missingInDb.length === 0 && extraInDb.length === 0) {
      console.log('✅ 模型和数据库字段完全一致！\n');
    }

    // 5. 使用 Sequelize 的 sync 方法（alter 模式）
    console.log('🔄 执行 Sequelize sync (alter 模式)...');
    console.log('⚠️  注意：这会修改数据库表结构以匹配模型定义\n');

    await SheinProduct.sync({ alter: true });
    
    console.log('✅ Sync 完成！\n');

    // 6. 再次检查字段
    const [newDbFields] = await sequelize.query(`
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'SheinProducts'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log(`📊 Sync 后的字段数: ${newDbFields.length}\n`);

    // 7. 测试插入
    console.log('🧪 测试插入数据...');
    const testSku = `TEST_SYNC_${Date.now()}`;
    
    const testData = {
      shop_id: 1,
      spu_name: 'TEST_SYNC_SPU',
      sku_code: testSku,
      product_type_id: 1,
      skc_attribute_id: 100,
      image_medium_url: 'https://test.com/img.jpg',
      quantity_type: 1,
      srp_price: 99.99,
      stop_purchase: 1
    };

    const result = await SheinProduct.create(testData);
    console.log('✅ 插入成功！ID:', result.id);

    // 清理
    await result.destroy();
    console.log('✅ 清理完成\n');

    console.log('✅ 模型同步和测试全部完成！\n');
    console.log('💡 提示：请重启后端服务器，然后重新尝试同步商品。\n');
    
    process.exit(0);

  } catch (error) {
    console.error('\n❌ 同步失败：', error.message);
    if (error.original) {
      console.error('SQL错误：', error.original.message);
    }
    console.error(error);
    process.exit(1);
  }
}

forceSyncModel();
