/**
 * 修复 Products 表结构
 */

const sequelize = require('./config/database');
const Product = require('./models/Product');

async function fixProductsTable() {
  try {
    console.log('🔧 修复 Products 表结构...\n');

    // 1. 检查当前数据库
    const [dbResult] = await sequelize.query('SELECT DATABASE() as db_name');
    console.log('📊 当前数据库:', dbResult[0].db_name);
    console.log('');

    // 2. 获取模型定义的字段
    const modelFields = Object.keys(Product.rawAttributes);
    console.log(`📝 Product 模型定义了 ${modelFields.length} 个字段\n`);

    // 3. 获取数据库实际的字段
    const [dbFields] = await sequelize.query(`
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'Products'
      ORDER BY ORDINAL_POSITION
    `);
    
    const dbFieldNames = dbFields.map(f => f.COLUMN_NAME);
    console.log(`📊 Products 表实际有 ${dbFieldNames.length} 个字段\n`);

    // 4. 找出缺失的字段
    const missingFields = modelFields.filter(f => !dbFieldNames.includes(f));
    
    if (missingFields.length === 0) {
      console.log('✅ 所有字段都已存在！\n');
    } else {
      console.log(`❌ 缺失 ${missingFields.length} 个字段：`);
      missingFields.forEach(f => console.log(`  - ${f}`));
      console.log('');
    }

    // 5. 使用 Sequelize sync 修复表结构
    console.log('🔄 执行 Sequelize sync (alter 模式)...');
    console.log('⚠️  这会自动添加缺失的字段\n');

    await Product.sync({ alter: true });
    
    console.log('✅ Sync 完成！\n');

    // 6. 再次检查字段
    const [newDbFields] = await sequelize.query(`
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'Products'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log(`📊 修复后的字段数: ${newDbFields.length}\n`);

    // 7. 测试插入
    console.log('🧪 测试插入数据...');
    const testSku = `TEST_PRODUCTS_${Date.now()}`;
    
    const testData = {
      sku: testSku,
      name: 'Test Product',
      price: 99.99,
      dimensions: { length: 10, width: 20, height: 5 },
      attributes: [{ name: 'color', value: 'red' }],
      sale_attributes: [],
      dimension_attributes: []
    };

    const result = await Product.create(testData);
    console.log('✅ 插入成功！ID:', result.id);

    // 清理
    await result.destroy();
    console.log('✅ 清理完成\n');

    console.log('✅ Products 表修复完成！\n');
    console.log('💡 提示：请重启后端服务器，然后重新尝试同步商品。\n');
    
    process.exit(0);

  } catch (error) {
    console.error('\n❌ 修复失败：', error.message);
    if (error.original) {
      console.error('SQL错误：', error.original.message);
    }
    console.error(error);
    process.exit(1);
  }
}

fixProductsTable();
