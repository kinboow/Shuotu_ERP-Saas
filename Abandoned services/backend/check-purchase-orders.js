/**
 * 检查采购单数据
 */
const sequelize = require('./config/database');
const { QueryTypes } = require('sequelize');

async function checkPurchaseOrders() {
  try {
    console.log('连接数据库...');
    await sequelize.authenticate();
    console.log('数据库连接成功\n');

    // 检查 shein_purchase_orders 表
    console.log('=== shein_purchase_orders 表 ===');
    const ordersCount = await sequelize.query(
      'SELECT COUNT(*) as count FROM shein_purchase_orders',
      { type: QueryTypes.SELECT }
    );
    console.log('总记录数:', ordersCount[0].count);

    // 获取前5条记录
    const orders = await sequelize.query(
      'SELECT id, shop_id, order_no, type, status, status_name, allocate_time FROM shein_purchase_orders LIMIT 5',
      { type: QueryTypes.SELECT }
    );
    console.log('前5条记录:');
    orders.forEach(o => {
      console.log(`  ID:${o.id}, shop_id:${o.shop_id}, order_no:${o.order_no}, type:${o.type}, status:${o.status}`);
    });

    // 检查 shein_purchase_order_details 表
    console.log('\n=== shein_purchase_order_details 表 ===');
    const itemsCount = await sequelize.query(
      'SELECT COUNT(*) as count FROM shein_purchase_order_details',
      { type: QueryTypes.SELECT }
    );
    console.log('总记录数:', itemsCount[0].count);

    // 检查店铺关联
    console.log('\n=== 店铺关联检查 ===');
    const shopCheck = await sequelize.query(
      `SELECT po.shop_id, ps.shop_name, COUNT(*) as order_count
       FROM shein_purchase_orders po
       LEFT JOIN PlatformShops ps ON po.shop_id = ps.id
       GROUP BY po.shop_id, ps.shop_name`,
      { type: QueryTypes.SELECT }
    );
    console.log('按店铺统计:');
    shopCheck.forEach(s => {
      console.log(`  shop_id:${s.shop_id}, shop_name:${s.shop_name || '未关联'}, 订单数:${s.order_count}`);
    });

    // 测试API查询
    console.log('\n=== 模拟API查询 ===');
    const apiQuery = `
      SELECT 
        po.*,
        ps.shop_name,
        ps.platform_name
      FROM shein_purchase_orders po
      LEFT JOIN PlatformShops ps ON po.shop_id = ps.id
      ORDER BY po.allocate_time DESC, po.add_time DESC
      LIMIT 5
    `;
    const apiResult = await sequelize.query(apiQuery, { type: QueryTypes.SELECT });
    console.log('API查询结果数量:', apiResult.length);
    if (apiResult.length > 0) {
      console.log('第一条记录:', JSON.stringify(apiResult[0], null, 2));
    }

  } catch (error) {
    console.error('检查失败:', error.message);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

checkPurchaseOrders();
