/**
 * 测试实际的批量插入（模拟 concurrentSync.js 的方式）
 */

const SheinProduct = require('./models/SheinProduct');
const sequelize = require('./config/database');

async function testActualBulkInsert() {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('🔍 测试实际批量插入（带事务）...\n');

    // 模拟 buildSheinProductData 返回的数据结构
    const testDataList = [{
      shop_id: 1,
      spu_name: 'TEST_SPU_ACTUAL',
      spu_supplier_code: 'SUP001',
      brand_code: 'BRAND001',
      category_id: 12345,
      product_type_id: 1,  // 这个字段报错
      skc_name: 'TEST_SKC_ACTUAL',
      skc_supplier_code: 'SKCSUP001',
      skc_attribute_id: 100,
      skc_attribute_value_id: 200,
      sku_code: `TEST_SKU_ACTUAL_${Date.now()}`,
      supplier_sku: 'SUPPLIER_SKU_001',
      product_name_cn: '测试商品',
      product_name_en: 'Test Product',
      product_desc_cn: '测试描述',
      product_desc_en: 'Test Description',
      main_image_url: 'https://example.com/image.jpg',
      image_medium_url: 'https://example.com/image_medium.jpg',
      image_small_url: 'https://example.com/image_small.jpg',
      image_group_code: 'IMG001',
      length: 10.5,
      width: 20.3,
      height: 5.2,
      weight: 500,
      quantity_type: 1,
      quantity_unit: 1,
      quantity: 1,
      package_type: 1,
      base_price: 99.99,
      special_price: 79.99,
      cost_price: 50.00,
      srp_price: 120.00,
      currency: 'USD',
      site: 'US',
      shelf_status: 1,
      mall_state: 1,
      stop_purchase: 1,
      recycle_status: 0,
      first_shelf_time: new Date(),
      last_shelf_time: new Date(),
      last_update_time: new Date(),
      sample_code: 'SAMPLE001',
      reserve_sample_flag: 1,
      spot_flag: 1,
      sample_judge_type: 1,
      supplier_barcode_enabled: true,
      barcode_type: 'EAN',
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
      raw_data: { test: true }
    }];

    console.log('📝 测试数据包含的字段：');
    console.log(Object.keys(testDataList[0]).join(', '));
    console.log(`\n共 ${Object.keys(testDataList[0]).length} 个字段\n`);

    console.log('💾 执行批量插入（使用事务和 updateOnDuplicate）...\n');
    
    // 使用与 concurrentSync.js 相同的方式
    const results = await SheinProduct.bulkCreate(testDataList, {
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
    
    console.log(`✅ 批量插入成功！插入了 ${results.length} 条记录\n`);

    // 清理测试数据
    console.log('🗑️  清理测试数据...');
    for (const result of results) {
      await result.destroy();
    }
    console.log('✅ 测试数据已清理\n');

    console.log('✅ 测试完成！\n');
    process.exit(0);

  } catch (error) {
    await transaction.rollback();
    
    console.error('\n❌ 测试失败：', error.message);
    
    if (error.original) {
      console.error('\n原始SQL错误：');
      console.error('  消息:', error.original.message);
      console.error('  代码:', error.original.code);
      console.error('  SQL:', error.original.sql);
    }
    
    console.error('\n完整错误：');
    console.error(error);
    process.exit(1);
  }
}

testActualBulkInsert();
