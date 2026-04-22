/**
 * 检查运行时实际连接的数据库和表结构
 */

const sequelize = require('./config/database');
const SheinProduct = require('./models/SheinProduct');

async function checkRuntimeDatabase() {
  try {
    console.log('🔍 检查运行时数据库连接...\n');

    // 1. 检查数据库连接配置
    console.log('📊 数据库配置：');
    console.log('  Host:', sequelize.config.host);
    console.log('  Database:', sequelize.config.database);
    console.log('  Username:', sequelize.config.username);
    console.log('');

    // 2. 检查实际连接的数据库
    const [dbResult] = await sequelize.query('SELECT DATABASE() as db_name');
    console.log('📊 实际连接的数据库:', dbResult[0].db_name);
    console.log('');

    // 3. 检查模型使用的表名
    console.log('📊 SheinProduct 模型信息：');
    console.log('  表名:', SheinProduct.tableName);
    console.log('  字段数:', Object.keys(SheinProduct.rawAttributes).length);
    console.log('');

    // 4. 检查数据库中的表结构
    const [columns] = await sequelize.query(`
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = '${SheinProduct.tableName}'
      ORDER BY ORDINAL_POSITION
    `);

    console.log(`📊 数据库表 ${SheinProduct.tableName} 的列（共 ${columns.length} 列）：`);
    const dbColumnNames = columns.map(c => c.COLUMN_NAME);
    console.log(dbColumnNames.join(', '));
    console.log('');

    // 5. 检查关键字段
    const keyFields = ['product_type_id', 'skc_attribute_id', 'image_medium_url'];
    console.log('🔍 检查关键字段：');
    keyFields.forEach(field => {
      const existsInDb = dbColumnNames.includes(field);
      const existsInModel = SheinProduct.rawAttributes.hasOwnProperty(field);
      console.log(`  ${field}:`);
      console.log(`    数据库: ${existsInDb ? '✅' : '❌'}`);
      console.log(`    模型: ${existsInModel ? '✅' : '❌'}`);
    });
    console.log('');

    // 6. 尝试实际的 bulkCreate 操作（不提交）
    console.log('🧪 测试 bulkCreate SQL 生成...');
    const testData = [{
      shop_id: 1,
      spu_name: 'TEST',
      sku_code: 'TEST_' + Date.now(),
      product_type_id: 1,
      skc_attribute_id: 100,
      image_medium_url: 'https://test.com/img.jpg'
    }];

    // 使用 dry run 模式（不实际执行）
    const sql = SheinProduct.queryGenerator.bulkInsertQuery(
      SheinProduct.tableName,
      testData,
      {},
      SheinProduct.rawAttributes
    );

    console.log('生成的 SQL 片段（前500字符）：');
    console.log(sql.substring(0, 500) + '...');
    console.log('');

    // 检查 SQL 中是否包含关键字段
    console.log('🔍 SQL 中包含的关键字段：');
    keyFields.forEach(field => {
      const included = sql.includes(`\`${field}\``);
      console.log(`  ${field}: ${included ? '✅' : '❌'}`);
    });

    console.log('\n✅ 检查完成！\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ 检查失败：', error.message);
    console.error(error);
    process.exit(1);
  }
}

checkRuntimeDatabase();
