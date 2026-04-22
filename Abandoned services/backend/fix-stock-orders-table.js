/**
 * 修复StockOrders表 - 添加shop_id字段
 */

const sequelize = require('./config/database');
const { QueryTypes } = require('sequelize');

async function fixTable() {
  try {
    console.log('========================================');
    console.log('修复StockOrders表');
    console.log('========================================\n');

    // 1. 检查shop_id字段是否已存在
    console.log('1. 检查shop_id字段...');
    const columns = await sequelize.query(
      'DESCRIBE StockOrders',
      { type: QueryTypes.SELECT }
    );
    
    const shopIdExists = columns.find(col => col.Field === 'shop_id');
    
    if (shopIdExists) {
      console.log('✓ shop_id字段已存在，无需修复\n');
      return;
    }
    
    console.log('❌ shop_id字段不存在，开始修复...\n');

    // 2. 添加shop_id字段
    console.log('2. 添加shop_id字段...');
    await sequelize.query(
      'ALTER TABLE StockOrders ADD COLUMN shop_id INT AFTER id',
      { type: QueryTypes.RAW }
    );
    console.log('✓ shop_id字段添加成功\n');

    // 3. 添加索引
    console.log('3. 添加索引...');
    try {
      await sequelize.query(
        'ALTER TABLE StockOrders ADD INDEX idx_shop_id (shop_id)',
        { type: QueryTypes.RAW }
      );
      console.log('✓ 索引添加成功\n');
    } catch (err) {
      if (err.message.includes('Duplicate key name')) {
        console.log('✓ 索引已存在\n');
      } else {
        throw err;
      }
    }

    // 4. 验证修复结果
    console.log('4. 验证修复结果...');
    const updatedColumns = await sequelize.query(
      'DESCRIBE StockOrders',
      { type: QueryTypes.SELECT }
    );
    
    const shopIdColumn = updatedColumns.find(col => col.Field === 'shop_id');
    
    if (shopIdColumn) {
      console.log('✓ 修复成功！');
      console.log(`  字段名: ${shopIdColumn.Field}`);
      console.log(`  类型: ${shopIdColumn.Type}`);
      console.log(`  允许NULL: ${shopIdColumn.Null}`);
      console.log(`  默认值: ${shopIdColumn.Default || '无'}\n`);
    } else {
      console.log('❌ 修复失败！\n');
    }

    console.log('========================================');
    console.log('修复完成');
    console.log('========================================\n');
    console.log('现在可以重新同步采购订单了！\n');

  } catch (error) {
    console.error('修复过程中出错:', error.message);
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

// 运行修复
fixTable();
