/**
 * 调试批量插入问题
 */

const SheinProduct = require('./models/SheinProduct');
const sequelize = require('./config/database');

// 启用详细的SQL日志
sequelize.options.logging = (sql, timing) => {
  console.log('\n📝 执行的SQL:');
  console.log(sql);
  console.log('');
};

async function debugBulkInsert() {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('🔍 调试批量插入问题...\n');

    // 模拟实际同步时的数据
    const testData = {
      shop_id: 1,
      spu_name: 'DEBUG_SPU',
      spu_supplier_code: 'SUP001',
      brand_code: 'BRAND001',
      category_id: 12345,
      product_type_id: 1,
      skc_name: 'DEBUG_SKC',
      skc_supplier_code: 'SKCSUP001',
      skc_attribute_id: 100,
      skc_attribute_value_id: 200,
      sku_code: `DEBUG_SKU_${Date.now()}`,
      supplier_sku: 'SUPPLIER_SKU',
      product_name_cn: '调试商品',
      product_name_en: 'Debug Product',
      product_desc_cn: null,
      product_desc_en: null,
      main_image_url: 'https://example.com/image.jpg',
      image_medium_url: 'https://example.com/medium.jpg',
      image_small_url: 'https://example.com/small.jpg',
      image_group_code: 'IMG001',
      length: null,
      width: null,
      height: null,
      weight: null,
      quantity_type: 1,
      quantity_unit: 1,
      quantity: 1,
      package_type: 1,
      base_price: 99.99,
      special_price: null,
      cost_price: null,
      srp_price: null,
      currency: 'USD',
      site: 'US',
      shelf_status: 1,
      mall_state: 1,
      stop_purchase: 1,
      recycle_status: 0,
      first_shelf_time: null,
      last_shelf_time: null,
      last_update_time: new Date(),
      sample_code: null,
      reserve_sample_flag: null,
      spot_flag: null,
      sample_judge_type: null,
      supplier_barcode_enabled: null,
      barcode_type: null,
      product_multi_name_list: [],
      product_multi_desc_list: [],
      product_attribute_list: [],
      dimension_attribute_list: [],
      sale_attribute_list: [],
      skc_attribute_multi_list: [],
      skc_attribute_value_multi_list: [],
      images: [],
      spu_image_list: [],
      skc_image_list: [],
      sku_image_list: [],
      site_detail_image_list: [],
      price_info_list: [],
      cost_info_list: [],
      shelf_status_info_list: [],
      recycle_info_list: [],
      proof_of_stock_info_list: [],
      supplier_barcode_list: [],
      sku_supplier_info: {},
      raw_data: {}
    };

    console.log('📝 测试数据包含的字段数:', Object.keys(testData).length);
    console.log('');

    console.log('💾 执行 bulkCreate（使用事务和 updateOnDuplicate）...\n');
    
    const results = await SheinProduct.bulkCreate([testData], {
      transaction,
      updateOnDuplicate: [
        'product_name_cn',
        'product_name_en',
        'main_image_url',
        'base_price',
        'special_price',
        'cost_price',
        'shelf_status',
        'mall_state',
        'stop_purchase',
        'last_update_time',
        'raw_data',
        'updatedAt'
      ]
    });

    await transaction.commit();
    
    console.log('✅ 批量插入成功！');
    console.log('插入的记录 ID:', results[0].id);

    // 清理
    await results[0].destroy();
    console.log('✅ 测试数据已清理\n');

    process.exit(0);

  } catch (error) {
    await transaction.rollback();
    
    console.error('\n❌ 批量插入失败：', error.message);
    
    if (error.original) {
      console.error('\nSQL错误详情：');
      console.error('  消息:', error.original.message);
      console.error('  代码:', error.original.code);
      console.error('  errno:', error.original.errno);
      if (error.original.sql) {
        console.error('  SQL:', error.original.sql.substring(0, 500) + '...');
      }
    }
    
    if (error.parent) {
      console.error('\n父错误:', error.parent.message);
    }
    
    console.error('\n完整错误堆栈：');
    console.error(error.stack);
    
    process.exit(1);
  }
}

debugBulkInsert();
