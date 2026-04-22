/**
 * 修复 SheinProducts 表问题
 * 检查表是否存在，如果不存在则创建
 */

require('dotenv').config();
const sequelize = require('./config/database');
const SheinProduct = require('./models/SheinProduct');

async function fixSheinProductsTable() {
  try {
    console.log('🔧 检查并修复 SheinProducts 表...\n');

    // 1. 检查当前数据库
    const [dbResult] = await sequelize.query('SELECT DATABASE() as db_name');
    console.log('📊 当前数据库:', dbResult[0].db_name);

    // 2. 检查所有类似名称的表
    console.log('\n🔍 检查数据库中的表...');
    const [tables] = await sequelize.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE()
        AND (TABLE_NAME LIKE '%shein%' OR TABLE_NAME LIKE '%Shein%' OR TABLE_NAME LIKE '%SHEIN%')
    `);
    
    if (tables.length > 0) {
      console.log('找到以下相关表:');
      tables.forEach(t => console.log(`  - ${t.TABLE_NAME}`));
    } else {
      console.log('没有找到任何 shein 相关的表');
    }

    // 3. 检查 SheinProducts 表是否存在
    const [sheinProductsExists] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'SheinProducts'
    `);

    if (sheinProductsExists[0].count > 0) {
      console.log('\n✅ SheinProducts 表已存在');
      
      // 检查记录数
      const [countResult] = await sequelize.query('SELECT COUNT(*) as count FROM SheinProducts');
      console.log(`   表中有 ${countResult[0].count} 条记录`);
    } else {
      console.log('\n❌ SheinProducts 表不存在，正在创建...');
      
      // 使用 Sequelize 同步创建表
      await SheinProduct.sync({ force: false });
      console.log('✅ SheinProducts 表创建成功');
    }

    // 4. 验证表结构
    console.log('\n🔍 验证表结构...');
    const [columns] = await sequelize.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'SheinProducts'
      ORDER BY ORDINAL_POSITION
      LIMIT 10
    `);

    if (columns.length > 0) {
      console.log('表结构（前10列）:');
      columns.forEach(col => {
        console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE} (${col.IS_NULLABLE === 'YES' ? '可空' : '非空'})`);
      });
    }

    console.log('\n✅ 修复完成！');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 修复失败:', error.message);
    if (error.original) {
      console.error('SQL错误:', error.original.message);
    }
    process.exit(1);
  }
}

fixSheinProductsTable();
