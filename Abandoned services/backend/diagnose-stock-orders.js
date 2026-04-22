/**
 * 采购订单问题诊断脚本
 * 检查数据库表结构和数据
 */

const sequelize = require('./config/database');
const { QueryTypes } = require('sequelize');

async function diagnose() {
  try {
    console.log('========================================');
    console.log('采购订单问题诊断');
    console.log('========================================\n');

    // 1. 检查StockOrders表是否存在
    console.log('1. 检查StockOrders表是否存在...');
    const tables = await sequelize.query(
      "SHOW TABLES LIKE 'StockOrders'",
      { type: QueryTypes.SELECT }
    );
    
    if (tables.length === 0) {
      console.log('❌ StockOrders表不存在！');
      console.log('\n解决方案：');
      console.log('需要创建StockOrders表。请运行以下SQL：\n');
      console.log(getCreateTableSQL());
      return;
    }
    
    console.log('✓ StockOrders表存在\n');

    // 2. 检查表结构
    console.log('2. 检查表结构...');
    const columns = await sequelize.query(
      'DESCRIBE StockOrders',
      { type: QueryTypes.SELECT }
    );
    
    console.log(`✓ 表有 ${columns.length} 个字段`);
    
    // 检查关键字段
    const requiredFields = ['id', 'order_number', 'shop_id', 'status', 'product_name'];
    const missingFields = [];
    
    requiredFields.forEach(field => {
      const exists = columns.find(col => col.Field === field);
      if (!exists) {
        missingFields.push(field);
      }
    });
    
    if (missingFields.length > 0) {
      console.log(`❌ 缺少关键字段: ${missingFields.join(', ')}`);
      console.log('\n需要添加这些字段！');
    } else {
      console.log('✓ 所有关键字段都存在\n');
    }

    // 3. 检查数据
    console.log('3. 检查数据...');
    const countResult = await sequelize.query(
      'SELECT COUNT(*) as count FROM StockOrders',
      { type: QueryTypes.SELECT }
    );
    
    const count = countResult[0].count;
    console.log(`数据库中有 ${count} 条采购订单记录\n`);

    if (count === 0) {
      console.log('❌ 数据库中没有采购订单数据！');
      console.log('\n可能的原因：');
      console.log('1. 从未同步过订单');
      console.log('2. 同步失败但没有报错');
      console.log('3. shop_id字段缺失导致插入失败\n');
    } else {
      // 显示前5条数据
      console.log('前5条数据：');
      const samples = await sequelize.query(
        'SELECT id, order_number, shop_id, status, product_name, created_time FROM StockOrders LIMIT 5',
        { type: QueryTypes.SELECT }
      );
      console.table(samples);
    }

    // 4. 检查shop_id字段
    console.log('\n4. 检查shop_id字段...');
    const shopIdColumn = columns.find(col => col.Field === 'shop_id');
    
    if (!shopIdColumn) {
      console.log('❌ shop_id字段不存在！');
      console.log('\n这是主要问题！同步订单时需要shop_id字段。');
      console.log('\n解决方案：添加shop_id字段');
      console.log('ALTER TABLE StockOrders ADD COLUMN shop_id INT AFTER id;');
      console.log('ALTER TABLE StockOrders ADD INDEX idx_shop_id (shop_id);');
    } else {
      console.log('✓ shop_id字段存在');
      console.log(`  类型: ${shopIdColumn.Type}`);
      console.log(`  允许NULL: ${shopIdColumn.Null}`);
      console.log(`  默认值: ${shopIdColumn.Default || '无'}\n`);
    }

    // 5. 检查PlatformShops表
    console.log('5. 检查PlatformShops表...');
    const shopsCount = await sequelize.query(
      'SELECT COUNT(*) as count FROM PlatformShops WHERE is_active = 1',
      { type: QueryTypes.SELECT }
    );
    
    console.log(`活跃店铺数量: ${shopsCount[0].count}`);
    
    if (shopsCount[0].count === 0) {
      console.log('❌ 没有活跃的店铺！');
      console.log('需要先添加店铺授权信息。\n');
    } else {
      const shops = await sequelize.query(
        'SELECT id, shop_name, platform_name, open_key_id FROM PlatformShops WHERE is_active = 1',
        { type: QueryTypes.SELECT }
      );
      console.log('\n活跃店铺列表：');
      console.table(shops);
    }

    console.log('\n========================================');
    console.log('诊断完成');
    console.log('========================================\n');

  } catch (error) {
    console.error('诊断过程中出错:', error.message);
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

function getCreateTableSQL() {
  return `
CREATE TABLE IF NOT EXISTS StockOrders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  shop_id INT COMMENT '店铺ID',
  order_number VARCHAR(100) UNIQUE NOT NULL COMMENT '订单号',
  parent_order_number VARCHAR(100) COMMENT '母单号',
  product_name VARCHAR(500) COMMENT '商品名称',
  product_image VARCHAR(500) COMMENT '商品图片',
  skc VARCHAR(100) COMMENT 'SKC编码',
  product_code VARCHAR(100) COMMENT '货号',
  sku_id VARCHAR(100) COMMENT 'SKU ID',
  sku_attribute VARCHAR(200) COMMENT 'SKU属性',
  sku_code VARCHAR(100) COMMENT 'SKU编码',
  declared_price DECIMAL(10, 2) COMMENT '申报价格',
  stock_quantity INT DEFAULT 0 COMMENT '备货件数',
  delivered_quantity INT DEFAULT 0 COMMENT '送货件数',
  warehouse_quantity INT DEFAULT 0 COMMENT '入库件数',
  status VARCHAR(50) DEFAULT '待创建' COMMENT '状态',
  warehouse_group VARCHAR(100) COMMENT '仓库分组',
  order_type VARCHAR(50) COMMENT '订单类型',
  stock_water_level VARCHAR(100) COMMENT '库存水位',
  can_ship_today BOOLEAN DEFAULT FALSE COMMENT '今日可发货',
  is_hot_sale BOOLEAN DEFAULT FALSE COMMENT '是否热销款',
  is_return BOOLEAN DEFAULT FALSE COMMENT '是否退货',
  is_domestic BOOLEAN DEFAULT FALSE COMMENT '是否国内备货',
  is_vmi BOOLEAN DEFAULT FALSE COMMENT '是否VMI',
  ship_deadline DATETIME COMMENT '发货截止时间',
  arrival_deadline DATETIME COMMENT '入库截止时间',
  created_time DATETIME COMMENT '创建时间',
  ship_time DATETIME COMMENT '发货时间',
  delivery_number VARCHAR(100) COMMENT '快递单号',
  handover_time DATETIME COMMENT '交接时间',
  receive_time DATETIME COMMENT '收货时间',
  actual_warehouse VARCHAR(100) COMMENT '实际仓库',
  return_time DATETIME COMMENT '退货时间',
  progress_status VARCHAR(200) COMMENT '进度状态',
  estimated_ship_date DATETIME COMMENT '预计发货日期',
  remarks TEXT COMMENT '备注',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_shop_id (shop_id),
  KEY idx_order_number (order_number),
  KEY idx_status (status),
  KEY idx_order_type (order_type),
  KEY idx_created_time (created_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='备货订单表';
`;
}

// 运行诊断
diagnose();
