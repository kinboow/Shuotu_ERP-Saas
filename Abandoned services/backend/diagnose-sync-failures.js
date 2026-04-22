/**
 * 诊断备货订单同步失败的原因
 * 
 * 使用方法：
 * node backend/diagnose-sync-failures.js
 */

const sequelize = require('./config/database');
const { QueryTypes } = require('sequelize');

async function diagnoseSyncFailures() {
  try {
    console.log('='.repeat(80));
    console.log('备货订单同步失败诊断工具');
    console.log('='.repeat(80));
    console.log('');

    // 1. 检查数据库连接
    console.log('1. 检查数据库连接...');
    await sequelize.authenticate();
    console.log('   ✅ 数据库连接正常');
    console.log('');

    // 2. 检查表结构
    console.log('2. 检查表结构...');
    
    const tables = await sequelize.query(
      `SHOW TABLES LIKE 'StockOrders'`,
      { type: QueryTypes.SELECT }
    );
    
    if (tables.length === 0) {
      console.log('   ❌ StockOrders 表不存在！');
      return;
    }
    console.log('   ✅ StockOrders 表存在');

    const itemsTables = await sequelize.query(
      `SHOW TABLES LIKE 'StockOrderItems'`,
      { type: QueryTypes.SELECT }
    );
    
    if (itemsTables.length === 0) {
      console.log('   ❌ StockOrderItems 表不存在！');
      return;
    }
    console.log('   ✅ StockOrderItems 表存在');
    console.log('');

    // 3. 检查表字段
    console.log('3. 检查 StockOrders 表字段...');
    const columns = await sequelize.query(
      `DESCRIBE StockOrders`,
      { type: QueryTypes.SELECT }
    );
    
    const requiredFields = [
      'id', 'shop_id', 'order_number', 'order_type', 'status',
      'supplier_name', 'warehouse_name', 'total_skc_count',
      'total_order_quantity', 'add_time', 'allocate_time'
    ];
    
    const existingFields = columns.map(col => col.Field);
    const missingFields = requiredFields.filter(field => !existingFields.includes(field));
    
    if (missingFields.length > 0) {
      console.log('   ❌ 缺少字段:', missingFields.join(', '));
    } else {
      console.log('   ✅ 所有必要字段都存在');
    }
    console.log('');

    // 4. 检查 StockOrderItems 表字段
    console.log('4. 检查 StockOrderItems 表字段...');
    const itemColumns = await sequelize.query(
      `DESCRIBE StockOrderItems`,
      { type: QueryTypes.SELECT }
    );
    
    const requiredItemFields = [
      'id', 'stock_order_id', 'order_number', 'skc', 'sku_code',
      'supplier_code', 'sku_attribute', 'price', 'order_quantity'
    ];
    
    const existingItemFields = itemColumns.map(col => col.Field);
    const missingItemFields = requiredItemFields.filter(field => !existingItemFields.includes(field));
    
    if (missingItemFields.length > 0) {
      console.log('   ❌ 缺少字段:', missingItemFields.join(', '));
    } else {
      console.log('   ✅ 所有必要字段都存在');
    }
    console.log('');

    // 5. 检查外键约束
    console.log('5. 检查外键约束...');
    const foreignKeys = await sequelize.query(
      `SELECT 
        CONSTRAINT_NAME,
        TABLE_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'StockOrderItems'
        AND REFERENCED_TABLE_NAME IS NOT NULL`,
      { type: QueryTypes.SELECT }
    );
    
    if (foreignKeys.length === 0) {
      console.log('   ⚠️  没有外键约束（可能影响数据完整性）');
    } else {
      console.log('   ✅ 外键约束存在:');
      foreignKeys.forEach(fk => {
        console.log(`      ${fk.TABLE_NAME}.${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
      });
    }
    console.log('');

    // 6. 检查现有数据
    console.log('6. 检查现有数据...');
    
    const orderCount = await sequelize.query(
      `SELECT COUNT(*) as count FROM StockOrders`,
      { type: QueryTypes.SELECT }
    );
    console.log(`   订单主表记录数: ${orderCount[0].count}`);
    
    const itemCount = await sequelize.query(
      `SELECT COUNT(*) as count FROM StockOrderItems`,
      { type: QueryTypes.SELECT }
    );
    console.log(`   订单明细记录数: ${itemCount[0].count}`);
    console.log('');

    // 7. 检查数据一致性
    console.log('7. 检查数据一致性...');
    
    const inconsistentOrders = await sequelize.query(
      `SELECT 
        so.order_number,
        so.total_skc_count AS main_skc_count,
        COUNT(soi.id) AS detail_skc_count,
        so.total_order_quantity AS main_total_qty,
        COALESCE(SUM(soi.order_quantity), 0) AS detail_total_qty
      FROM StockOrders so
      LEFT JOIN StockOrderItems soi ON so.id = soi.stock_order_id
      GROUP BY so.id
      HAVING main_skc_count != detail_skc_count 
         OR main_total_qty != detail_total_qty
      LIMIT 10`,
      { type: QueryTypes.SELECT }
    );
    
    if (inconsistentOrders.length > 0) {
      console.log('   ⚠️  发现数据不一致的订单:');
      inconsistentOrders.forEach(order => {
        console.log(`      订单 ${order.order_number}:`);
        console.log(`        主表SKC数: ${order.main_skc_count}, 明细SKC数: ${order.detail_skc_count}`);
        console.log(`        主表总数量: ${order.main_total_qty}, 明细总数量: ${order.detail_total_qty}`);
      });
    } else {
      console.log('   ✅ 数据一致性检查通过');
    }
    console.log('');

    // 8. 检查空值情况
    console.log('8. 检查关键字段空值情况...');
    
    const nullChecks = [
      { field: 'order_number', table: 'StockOrders' },
      { field: 'shop_id', table: 'StockOrders' },
      { field: 'order_type', table: 'StockOrders' },
      { field: 'status', table: 'StockOrders' },
      { field: 'skc', table: 'StockOrderItems' },
      { field: 'order_number', table: 'StockOrderItems' }
    ];
    
    for (const check of nullChecks) {
      const result = await sequelize.query(
        `SELECT COUNT(*) as count FROM ${check.table} WHERE ${check.field} IS NULL OR ${check.field} = ''`,
        { type: QueryTypes.SELECT }
      );
      
      if (result[0].count > 0) {
        console.log(`   ⚠️  ${check.table}.${check.field} 有 ${result[0].count} 条空值记录`);
      }
    }
    console.log('   ✅ 关键字段空值检查完成');
    console.log('');

    // 9. 检查最近的订单
    console.log('9. 检查最近同步的订单...');
    
    const recentOrders = await sequelize.query(
      `SELECT 
        order_number,
        order_type,
        status,
        total_skc_count,
        total_order_quantity,
        createdAt,
        updatedAt
      FROM StockOrders
      ORDER BY updatedAt DESC
      LIMIT 5`,
      { type: QueryTypes.SELECT }
    );
    
    if (recentOrders.length > 0) {
      console.log('   最近5个订单:');
      recentOrders.forEach(order => {
        console.log(`      ${order.order_number} - ${order.order_type} - ${order.status} - ${order.total_skc_count} SKC - 更新于 ${order.updatedAt}`);
      });
    } else {
      console.log('   ⚠️  没有订单记录');
    }
    console.log('');

    // 10. 检查店铺配置
    console.log('10. 检查店铺配置...');
    
    const shops = await sequelize.query(
      `SELECT 
        ps.id,
        ps.shop_name,
        ps.platform_name,
        ps.is_active,
        ps.open_key_id,
        CASE WHEN ps.secret_key IS NOT NULL THEN '已配置' ELSE '未配置' END as secret_key_status
      FROM PlatformShops ps
      WHERE ps.platform_name = 'shein_full'`,
      { type: QueryTypes.SELECT }
    );
    
    if (shops.length === 0) {
      console.log('   ❌ 没有配置SHEIN店铺');
    } else {
      console.log('   SHEIN店铺配置:');
      shops.forEach(shop => {
        console.log(`      店铺ID: ${shop.id}, 名称: ${shop.shop_name || '未命名'}, 状态: ${shop.is_active ? '激活' : '未激活'}`);
        console.log(`      OpenKeyId: ${shop.open_key_id || '未配置'}, SecretKey: ${shop.secret_key_status}`);
      });
    }
    console.log('');

    // 11. 常见失败原因分析
    console.log('11. 常见失败原因分析...');
    console.log('');
    console.log('   可能的失败原因：');
    console.log('   1. ❌ 订单没有 orderExtends 数据（SKC明细为空）');
    console.log('      - 解决：检查API返回数据是否完整');
    console.log('');
    console.log('   2. ❌ 订单号为空或重复');
    console.log('      - 解决：检查API返回的orderNo字段');
    console.log('');
    console.log('   3. ❌ 数据类型不匹配');
    console.log('      - 解决：检查数字字段是否传入了字符串');
    console.log('');
    console.log('   4. ❌ 外键约束失败');
    console.log('      - 解决：确保shop_id存在于PlatformShops表');
    console.log('');
    console.log('   5. ❌ 字段长度超限');
    console.log('      - 解决：检查VARCHAR字段长度限制');
    console.log('');
    console.log('   6. ❌ JSON字段格式错误');
    console.log('      - 解决：确保JSON.stringify正确执行');
    console.log('');

    // 12. 建议
    console.log('12. 优化建议...');
    console.log('');
    console.log('   建议操作：');
    console.log('   1. 查看后端日志中的详细错误信息');
    console.log('   2. 检查失败订单的原始API数据');
    console.log('   3. 验证数据库字段类型和长度');
    console.log('   4. 确保所有必要字段都有默认值或允许NULL');
    console.log('   5. 添加事务处理，确保主表和明细表同时成功或失败');
    console.log('');

    console.log('='.repeat(80));
    console.log('诊断完成！');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ 诊断过程出错:', error.message);
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

// 运行诊断
diagnoseSyncFailures();
