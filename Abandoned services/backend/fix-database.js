/**
 * 数据库修复脚本 - 修复StockOrders表
 * 执行方法: node backend/fix-database.js
 */

const { sequelize } = require('./config/database');

async function fixStockOrdersTable() {
  console.log('开始修复StockOrders表...\n');

  try {
    // 步骤1: 检查并删除旧的UNIQUE约束
    console.log('步骤1: 检查并删除旧的UNIQUE约束...');
    
    const [constraints] = await sequelize.query(`
      SELECT COUNT(*) as count
      FROM information_schema.table_constraints 
      WHERE table_schema = 'eer' 
        AND table_name = 'StockOrders' 
        AND constraint_name = 'order_number'
        AND constraint_type = 'UNIQUE'
    `);

    if (constraints[0].count > 0) {
      await sequelize.query('ALTER TABLE StockOrders DROP INDEX order_number');
      console.log('✓ 已删除旧的UNIQUE约束\n');
    } else {
      console.log('✓ 旧约束不存在，跳过\n');
    }

    // 步骤2: 添加新的复合唯一索引
    console.log('步骤2: 添加新的复合唯一索引...');
    
    const [indexes1] = await sequelize.query(`
      SELECT COUNT(*) as count
      FROM information_schema.statistics 
      WHERE table_schema = 'eer' 
        AND table_name = 'StockOrders' 
        AND index_name = 'unique_order_sku'
    `);

    if (indexes1[0].count === 0) {
      await sequelize.query('ALTER TABLE StockOrders ADD UNIQUE KEY unique_order_sku (order_number, sku_id)');
      console.log('✓ 已添加复合唯一索引 unique_order_sku\n');
    } else {
      console.log('✓ 索引已存在，跳过\n');
    }

    // 步骤3: 添加SKU代码索引
    console.log('步骤3: 添加SKU代码索引...');
    
    const [indexes2] = await sequelize.query(`
      SELECT COUNT(*) as count
      FROM information_schema.statistics 
      WHERE table_schema = 'eer' 
        AND table_name = 'StockOrders' 
        AND index_name = 'idx_sku_code'
    `);

    if (indexes2[0].count === 0) {
      await sequelize.query('ALTER TABLE StockOrders ADD KEY idx_sku_code (sku_code)');
      console.log('✓ 已添加索引 idx_sku_code\n');
    } else {
      console.log('✓ 索引已存在，跳过\n');
    }

    // 步骤4: 添加母单号索引
    console.log('步骤4: 添加母单号索引...');
    
    const [indexes3] = await sequelize.query(`
      SELECT COUNT(*) as count
      FROM information_schema.statistics 
      WHERE table_schema = 'eer' 
        AND table_name = 'StockOrders' 
        AND index_name = 'idx_parent_order'
    `);

    if (indexes3[0].count === 0) {
      await sequelize.query('ALTER TABLE StockOrders ADD KEY idx_parent_order (parent_order_number)');
      console.log('✓ 已添加索引 idx_parent_order\n');
    } else {
      console.log('✓ 索引已存在，跳过\n');
    }

    // 验证结果
    console.log('验证修复结果...\n');
    
    const [stats] = await sequelize.query(`
      SELECT 
        COUNT(*) AS total_records,
        COUNT(DISTINCT order_number) AS unique_orders,
        COUNT(*) - COUNT(DISTINCT order_number) AS multi_sku_orders
      FROM StockOrders
    `);

    console.log('统计信息:');
    console.log(`  总记录数: ${stats[0].total_records}`);
    console.log(`  唯一订单数: ${stats[0].unique_orders}`);
    console.log(`  多SKU订单数: ${stats[0].multi_sku_orders}\n`);

    // 显示当前索引
    const [currentIndexes] = await sequelize.query(`
      SELECT 
        index_name,
        GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columns,
        CASE WHEN non_unique = 0 THEN 'UNIQUE' ELSE 'NON-UNIQUE' END AS index_type
      FROM information_schema.statistics
      WHERE table_schema = 'eer' 
        AND table_name = 'StockOrders'
      GROUP BY index_name, non_unique
      ORDER BY index_name
    `);

    console.log('当前索引列表:');
    currentIndexes.forEach(idx => {
      console.log(`  ${idx.index_name}: ${idx.columns} (${idx.index_type})`);
    });

    console.log('\n✅ StockOrders表修复完成！');
    console.log('现在支持一个订单号包含多个SKU\n');

  } catch (error) {
    console.error('❌ 修复失败:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// 执行修复
fixStockOrdersTable()
  .then(() => {
    console.log('脚本执行完成');
    process.exit(0);
  })
  .catch(error => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });
