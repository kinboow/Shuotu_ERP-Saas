/**
 * 验证当前连接的数据库表结构
 */

const sequelize = require('./config/database');

async function verifyDatabase() {
  try {
    console.log('🔍 验证当前数据库连接...\n');

    // 1. 检查数据库名称
    const [dbResult] = await sequelize.query('SELECT DATABASE() as db_name');
    console.log('📊 当前数据库:', dbResult[0].db_name);

    // 2. 检查 SheinProducts 表是否存在
    const [tableExists] = await sequelize.query(`
      SELECT COUNT(*) as count
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'SheinProducts'
    `);

    if (tableExists[0].count === 0) {
      console.log('❌ SheinProducts 表不存在！');
      process.exit(1);
    }

    console.log('✅ SheinProducts 表存在\n');

    // 3. 检查关键字段是否存在
    const keyFields = [
      'product_type_id',
      'skc_attribute_id',
      'skc_attribute_value_id',
      'image_medium_url',
      'image_small_url',
      'image_group_code',
      'quantity_type',
      'quantity_unit',
      'quantity',
      'package_type',
      'srp_price',
      'stop_purchase',
      'recycle_status',
      'first_shelf_time',
      'last_shelf_time',
      'sample_code',
      'reserve_sample_flag',
      'spot_flag',
      'sample_judge_type',
      'supplier_barcode_enabled',
      'barcode_type'
    ];

    console.log('🔍 检查关键字段：\n');
    
    for (const field of keyFields) {
      const [result] = await sequelize.query(`
        SELECT COUNT(*) as count
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'SheinProducts'
          AND COLUMN_NAME = '${field}'
      `);

      if (result[0].count === 0) {
        console.log(`  ❌ 字段缺失: ${field}`);
      } else {
        console.log(`  ✅ ${field}`);
      }
    }

    // 4. 获取表的总列数
    const [columnCount] = await sequelize.query(`
      SELECT COUNT(*) as count
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'SheinProducts'
    `);

    console.log(`\n📊 SheinProducts 表共有 ${columnCount[0].count} 列`);

    // 5. 测试插入一条数据
    console.log('\n🧪 测试插入数据...');
    
    const testSku = `TEST_VERIFY_${Date.now()}`;
    await sequelize.query(`
      INSERT INTO SheinProducts (
        shop_id, spu_name, sku_code, product_type_id, 
        skc_attribute_id, image_medium_url, quantity_type,
        createdAt, updatedAt
      ) VALUES (
        1, 'TEST_SPU', '${testSku}', 1,
        100, 'https://test.com/img.jpg', 1,
        NOW(), NOW()
      )
    `);

    console.log('✅ 插入测试数据成功');

    // 清理测试数据
    await sequelize.query(`DELETE FROM SheinProducts WHERE sku_code = '${testSku}'`);
    console.log('✅ 清理测试数据成功');

    console.log('\n✅ 数据库验证完成！所有字段都存在且可以正常插入。\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ 验证失败：', error.message);
    if (error.original) {
      console.error('SQL错误：', error.original.message);
    }
    console.error(error);
    process.exit(1);
  }
}

verifyDatabase();
