/**
 * 修复远程数据库表结构 - 添加所有缺失的字段
 */

const sequelize = require('./config/database');

async function fixRemoteDatabase() {
  try {
    console.log('🔧 开始修复远程数据库表结构...\n');

    // 检查当前数据库
    const [dbResult] = await sequelize.query('SELECT DATABASE() as db_name');
    console.log('📊 当前数据库:', dbResult[0].db_name);
    console.log('📊 数据库主机:', sequelize.config.host);
    console.log('');

    // 定义所有需要添加的字段
    const fieldsToAdd = [
      { name: 'product_type_id', type: 'BIGINT', comment: 'Product type ID', after: 'category_id' },
      { name: 'skc_attribute_id', type: 'BIGINT', comment: 'SKC销售属性ID', after: 'skc_supplier_code' },
      { name: 'skc_attribute_value_id', type: 'BIGINT', comment: 'SKC销售属性值ID', after: 'skc_attribute_id' },
      { name: 'image_medium_url', type: 'TEXT', comment: '中图URL', after: 'main_image_url' },
      { name: 'image_small_url', type: 'TEXT', comment: '小图URL', after: 'image_medium_url' },
      { name: 'image_group_code', type: 'VARCHAR(100)', comment: '图片组编码', after: 'image_small_url' },
      { name: 'quantity_type', type: 'INT', comment: '件数类型: 1-单件 2-同品多件', after: 'weight' },
      { name: 'quantity_unit', type: 'INT', comment: '件数单位: 1-件 2-双', after: 'quantity_type' },
      { name: 'quantity', type: 'INT', comment: '件数值', after: 'quantity_unit' },
      { name: 'package_type', type: 'INT', comment: '包装类型: 0-空 1-软包装+软物 2-软包装+硬物 3-硬包装 4-真空', after: 'quantity' },
      { name: 'srp_price', type: 'DECIMAL(10,2)', comment: '建议零售价', after: 'cost_price' },
      { name: 'stop_purchase', type: 'INT', comment: '采购状态: 1-在采 2-停采', after: 'mall_state' },
      { name: 'recycle_status', type: 'INT', comment: '回收站状态: 0-未回收 1-已回收', after: 'stop_purchase' },
      { name: 'first_shelf_time', type: 'DATETIME', comment: '首次上架时间', after: 'recycle_status' },
      { name: 'last_shelf_time', type: 'DATETIME', comment: '最近上架时间', after: 'first_shelf_time' },
      { name: 'sample_code', type: 'VARCHAR(100)', comment: '样衣SKU', after: 'last_update_time' },
      { name: 'reserve_sample_flag', type: 'INT', comment: '是否需留样: 1-是 2-否', after: 'sample_code' },
      { name: 'spot_flag', type: 'INT', comment: '是否现货: 1-是 2-否', after: 'reserve_sample_flag' },
      { name: 'sample_judge_type', type: 'INT', comment: '审版类型', after: 'spot_flag' },
      { name: 'supplier_barcode_enabled', type: 'BOOLEAN', comment: '是否启用供应条码', after: 'sample_judge_type' },
      { name: 'barcode_type', type: 'VARCHAR(20)', comment: '条码类型: EAN、UPC', after: 'supplier_barcode_enabled' },
      { name: 'product_multi_desc_list', type: 'JSON', comment: '多语言描述列表', after: 'product_multi_name_list' },
      { name: 'dimension_attribute_list', type: 'JSON', comment: '尺寸属性列表', after: 'product_attribute_list' },
      { name: 'sale_attribute_list', type: 'JSON', comment: 'SKU销售属性列表', after: 'dimension_attribute_list' },
      { name: 'skc_attribute_multi_list', type: 'JSON', comment: 'SKC属性多语言名称', after: 'sale_attribute_list' },
      { name: 'skc_attribute_value_multi_list', type: 'JSON', comment: 'SKC属性值多语言名称', after: 'skc_attribute_multi_list' },
      { name: 'spu_image_list', type: 'JSON', comment: 'SPU图片列表', after: 'images' },
      { name: 'skc_image_list', type: 'JSON', comment: 'SKC图片列表', after: 'spu_image_list' },
      { name: 'sku_image_list', type: 'JSON', comment: 'SKU图片列表', after: 'skc_image_list' },
      { name: 'site_detail_image_list', type: 'JSON', comment: '站点详情图列表', after: 'sku_image_list' },
      { name: 'cost_info_list', type: 'JSON', comment: '供货价信息列表', after: 'price_info_list' },
      { name: 'shelf_status_info_list', type: 'JSON', comment: '上下架信息列表', after: 'cost_info_list' },
      { name: 'recycle_info_list', type: 'JSON', comment: '回收站状态信息列表', after: 'shelf_status_info_list' },
      { name: 'proof_of_stock_info_list', type: 'JSON', comment: '库存证明文件信息', after: 'recycle_info_list' },
      { name: 'supplier_barcode_list', type: 'JSON', comment: '供应商条码列表', after: 'proof_of_stock_info_list' },
      { name: 'sku_supplier_info', type: 'JSON', comment: 'SKU供应商信息', after: 'supplier_barcode_list' }
    ];

    console.log(`📝 准备添加 ${fieldsToAdd.length} 个字段\n`);

    let addedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const field of fieldsToAdd) {
      try {
        // 检查字段是否已存在
        const [exists] = await sequelize.query(`
          SELECT COUNT(*) as count
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'SheinProducts'
            AND COLUMN_NAME = '${field.name}'
        `);

        if (exists[0].count > 0) {
          console.log(`  ⏭️  跳过: ${field.name} (已存在)`);
          skippedCount++;
          continue;
        }

        // 添加字段
        const sql = `ALTER TABLE SheinProducts ADD COLUMN ${field.name} ${field.type} COMMENT '${field.comment}' AFTER ${field.after}`;
        await sequelize.query(sql);
        console.log(`  ✅ 添加: ${field.name}`);
        addedCount++;

      } catch (error) {
        console.error(`  ❌ 失败: ${field.name} - ${error.message}`);
        errorCount++;
      }
    }

    console.log(`\n📊 执行结果：`);
    console.log(`  ✅ 成功添加: ${addedCount} 个字段`);
    console.log(`  ⏭️  已存在跳过: ${skippedCount} 个字段`);
    console.log(`  ❌ 失败: ${errorCount} 个字段`);

    // 验证最终结果
    console.log(`\n🔍 验证表结构...`);
    const [columns] = await sequelize.query(`
      SELECT COUNT(*) as count
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'SheinProducts'
    `);
    console.log(`✅ SheinProducts 表现在有 ${columns[0].count} 列`);

    // 测试插入
    console.log(`\n🧪 测试插入数据...`);
    const testSku = `TEST_FIX_${Date.now()}`;
    await sequelize.query(`
      INSERT INTO SheinProducts (
        shop_id, spu_name, sku_code, 
        product_type_id, skc_attribute_id, image_medium_url,
        quantity_type, srp_price, stop_purchase,
        createdAt, updatedAt
      ) VALUES (
        1, 'TEST_SPU', '${testSku}',
        1, 100, 'https://test.com/img.jpg',
        1, 99.99, 1,
        NOW(), NOW()
      )
    `);
    console.log('✅ 插入测试数据成功');

    // 清理测试数据
    await sequelize.query(`DELETE FROM SheinProducts WHERE sku_code = '${testSku}'`);
    console.log('✅ 清理测试数据成功');

    console.log('\n✅ 远程数据库表结构修复完成！\n');
    console.log('💡 提示：请重启后端服务器，然后重新尝试同步商品。\n');
    
    process.exit(0);

  } catch (error) {
    console.error('\n❌ 修复失败：', error.message);
    console.error(error);
    process.exit(1);
  }
}

fixRemoteDatabase();
