/**
 * 诊断表结构问题
 */

const sequelize = require('./config/database');

async function diagnoseTableIssue() {
  try {
    console.log('🔍 诊断 SheinProducts 表问题...\n');

    // 1. 检查数据库
    const [dbResult] = await sequelize.query('SELECT DATABASE() as db_name');
    console.log('📊 当前数据库:', dbResult[0].db_name);
    console.log('');

    // 2. 列出所有表
    console.log('📋 数据库中的所有表：');
    const [tables] = await sequelize.query(`
      SELECT TABLE_NAME, TABLE_ROWS, DATA_LENGTH
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME
    `);
    
    tables.forEach(t => {
      console.log(`  - ${t.TABLE_NAME} (${t.TABLE_ROWS} 行, ${(t.DATA_LENGTH / 1024).toFixed(2)} KB)`);
    });
    console.log('');

    // 3. 检查是否有多个 SheinProducts 表（不同大小写）
    console.log('🔍 检查 SheinProducts 表（所有大小写变体）：');
    const [sheinTables] = await sequelize.query(`
      SELECT TABLE_NAME, TABLE_COLLATION
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND LOWER(TABLE_NAME) = 'sheinproducts'
    `);
    
    if (sheinTables.length === 0) {
      console.log('❌ 没有找到任何 SheinProducts 表！');
      console.log('');
      console.log('可能的原因：');
      console.log('  1. 表名拼写错误');
      console.log('  2. 表还没有创建');
      console.log('  3. 连接到了错误的数据库');
      process.exit(1);
    }

    sheinTables.forEach(t => {
      console.log(`  ✓ 表名: ${t.TABLE_NAME}`);
      console.log(`    排序规则: ${t.TABLE_COLLATION}`);
    });
    console.log('');

    // 4. 对每个找到的表，检查其字段
    for (const table of sheinTables) {
      console.log(`🔍 检查表 "${table.TABLE_NAME}" 的字段：`);
      
      const [columns] = await sequelize.query(`
        SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_COMMENT
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = '${table.TABLE_NAME}'
        ORDER BY ORDINAL_POSITION
      `);
      
      console.log(`  共 ${columns.length} 列`);
      
      // 检查关键字段
      const keyFields = ['product_type_id', 'skc_attribute_id', 'image_medium_url'];
      console.log('  关键字段检查：');
      keyFields.forEach(field => {
        const exists = columns.some(c => c.COLUMN_NAME === field);
        console.log(`    ${field}: ${exists ? '✅' : '❌'}`);
      });
      
      // 列出所有字段
      console.log('  所有字段：');
      columns.forEach(col => {
        console.log(`    - ${col.COLUMN_NAME} (${col.COLUMN_TYPE})`);
      });
      console.log('');
    }

    // 5. 尝试直接查询表
    console.log('🧪 尝试直接查询表：');
    try {
      const [result] = await sequelize.query('SELECT COUNT(*) as count FROM SheinProducts');
      console.log(`  ✓ 查询成功，表中有 ${result[0].count} 条记录`);
    } catch (error) {
      console.log(`  ❌ 查询失败: ${error.message}`);
    }
    console.log('');

    // 6. 尝试插入测试数据
    console.log('🧪 尝试插入测试数据：');
    try {
      const testSku = `DIAG_${Date.now()}`;
      await sequelize.query(`
        INSERT INTO SheinProducts (
          shop_id, spu_name, sku_code, 
          product_type_id, skc_attribute_id, image_medium_url,
          createdAt, updatedAt
        ) VALUES (
          1, 'TEST', '${testSku}',
          1, 100, 'https://test.com/img.jpg',
          NOW(), NOW()
        )
      `);
      console.log('  ✓ 插入成功');
      
      // 清理
      await sequelize.query(`DELETE FROM SheinProducts WHERE sku_code = '${testSku}'`);
      console.log('  ✓ 清理成功');
    } catch (error) {
      console.log(`  ❌ 插入失败: ${error.message}`);
      if (error.original) {
        console.log(`     SQL错误: ${error.original.message}`);
        console.log(`     SQL代码: ${error.original.code}`);
      }
    }
    console.log('');

    console.log('✅ 诊断完成！\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ 诊断失败：', error.message);
    console.error(error);
    process.exit(1);
  }
}

diagnoseTableIssue();
