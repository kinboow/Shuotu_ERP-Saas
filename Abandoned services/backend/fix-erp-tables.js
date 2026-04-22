/**
 * 修复ERP商品表结构
 * 添加新的字段和表
 */

require('dotenv').config();
const sequelize = require('./config/database');

async function fixErpTables() {
  try {
    console.log('🔧 修复ERP商品表结构...\n');

    // 1. 检查并创建 erp_product_skcs 表
    console.log('1. 检查 erp_product_skcs 表...');
    const [skcTableExists] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'erp_product_skcs'
    `);

    if (skcTableExists[0].count === 0) {
      console.log('   创建 erp_product_skcs 表...');
      await sequelize.query(`
        CREATE TABLE erp_product_skcs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          erp_product_id INT NOT NULL COMMENT '关联的SPU ID',
          skc_code VARCHAR(200) NOT NULL COMMENT 'SKC编码',
          supplier_skc VARCHAR(200) COMMENT '供应商SKC编码',
          skc_name_cn VARCHAR(500) COMMENT 'SKC名称(中文)',
          skc_name_en VARCHAR(500) COMMENT 'SKC名称(英文)',
          color VARCHAR(100) COMMENT '颜色名称',
          color_code VARCHAR(50) COMMENT '颜色编码',
          color_attribute_id VARCHAR(100) COMMENT '颜色属性ID',
          color_attribute_value_id VARCHAR(100) COMMENT '颜色属性值ID',
          main_image TEXT COMMENT 'SKC主图URL',
          images JSON COMMENT 'SKC图片列表',
          detail_images JSON COMMENT '详情图列表',
          skc_attributes JSON COMMENT 'SKC级别属性',
          status TINYINT DEFAULT 1 COMMENT '状态: 1-启用, 2-禁用',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_erp_product_id (erp_product_id),
          UNIQUE INDEX idx_product_skc (erp_product_id, skc_code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='ERP产品SKC表'
      `);
      console.log('   ✅ erp_product_skcs 表创建成功');
    } else {
      console.log('   ✅ erp_product_skcs 表已存在');
    }

    // 2. 检查并添加 erp_skc_id 字段到 erp_product_skus 表
    console.log('\n2. 检查 erp_product_skus 表的 erp_skc_id 字段...');
    const [skcIdExists] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'erp_product_skus'
        AND COLUMN_NAME = 'erp_skc_id'
    `);

    if (skcIdExists[0].count === 0) {
      console.log('   添加 erp_skc_id 字段...');
      await sequelize.query(`
        ALTER TABLE erp_product_skus 
        ADD COLUMN erp_skc_id INT NULL COMMENT 'ERP SKC ID' 
        AFTER erp_product_id
      `);
      console.log('   ✅ erp_skc_id 字段添加成功');
      
      // 添加索引
      console.log('   添加索引...');
      try {
        await sequelize.query(`
          ALTER TABLE erp_product_skus 
          ADD INDEX idx_erp_skc_id (erp_skc_id)
        `);
        console.log('   ✅ 索引添加成功');
      } catch (e) {
        console.log('   ⚠️ 索引可能已存在:', e.message);
      }
    } else {
      console.log('   ✅ erp_skc_id 字段已存在');
    }

    // 3. 检查 erp_products 表是否有新字段
    console.log('\n3. 检查 erp_products 表的新字段...');
    const newFields = [
      { name: 'brand_code', type: 'VARCHAR(100)', comment: '品牌编码(SHEIN)' },
      { name: 'supplier_code', type: 'VARCHAR(100)', comment: '商家/供应商编码' }
    ];

    for (const field of newFields) {
      const [fieldExists] = await sequelize.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'erp_products'
          AND COLUMN_NAME = '${field.name}'
      `);

      if (fieldExists[0].count === 0) {
        console.log(`   添加 ${field.name} 字段...`);
        await sequelize.query(`
          ALTER TABLE erp_products 
          ADD COLUMN ${field.name} ${field.type} COMMENT '${field.comment}'
        `);
        console.log(`   ✅ ${field.name} 字段添加成功`);
      } else {
        console.log(`   ✅ ${field.name} 字段已存在`);
      }
    }

    console.log('\n✅ ERP商品表结构修复完成！');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 修复失败:', error.message);
    if (error.original) {
      console.error('SQL错误:', error.original.message);
    }
    process.exit(1);
  }
}

fixErpTables();
