/**
 * 适配器测试脚本
 * 运行: node test-adapter.js
 */

const adapterManager = require('./src/adapters');

console.log('========================================');
console.log('  适配器测试');
console.log('========================================\n');

// 1. 测试支持的平台
console.log('1. 支持的平台:', adapterManager.getSupportedPlatforms());

// 2. 注册测试适配器
console.log('\n2. 注册测试适配器...');

try {
  // 注册SHEIN(full)全托管适配器（测试配置）
  adapterManager.register('shop_shein_full_001', 'shein_full', {
    openKeyId: 'test_open_key_id',
    secretKey: 'test_secret_key',
    baseUrl: 'https://openapi.sheincorp.cn'
  });

  // 注册TEMU适配器（测试配置）
  adapterManager.register('shop_temu_001', 'temu', {
    appKey: 'test_app_key',
    appSecret: 'test_app_secret',
    accessToken: 'test_access_token'
  });

  // 注册TikTok适配器（测试配置）
  adapterManager.register('shop_tiktok_001', 'tiktok', {
    appKey: 'test_app_key',
    appSecret: 'test_app_secret',
    accessToken: 'test_access_token'
  });

  console.log('   适配器注册成功!');
} catch (error) {
  console.error('   注册失败:', error.message);
}

// 3. 获取适配器统计
console.log('\n3. 适配器统计:', adapterManager.getStats());

// 4. 获取所有适配器
console.log('\n4. 已注册适配器:');
const adapters = adapterManager.getAll();
adapters.forEach(({ shopId, platform, adapter }) => {
  console.log(`   - ${shopId} (${platform}):`, adapter.getInfo());
});

// 5. 测试数据转换
console.log('\n5. 测试数据转换...');

const sheinFullAdapter = adapterManager.get('shop_shein_full_001');

// 模拟SHEIN订单数据
const mockSheinOrder = {
  orderNo: 'SHEIN123456',
  orderStatus: '2',
  orderTime: '2025-12-03 10:00:00',
  payTime: '2025-12-03 10:05:00',
  currency: 'USD',
  orderAmount: '99.99',
  goodsAmount: '89.99',
  shippingFee: '10.00',
  consigneeName: 'John Doe',
  consigneePhone: '+1234567890',
  consigneeCountry: 'United States',
  consigneeCity: 'New York',
  consigneeAddress: '123 Main St',
  consigneePostcode: '10001',
  orderGoodsList: [
    {
      orderGoodsId: 'item001',
      skuCode: 'SKU001',
      spuCode: 'SPU001',
      goodsName: 'Test Product',
      quantity: 2,
      sellPrice: '44.99',
      colorName: 'Black',
      sizeName: 'M'
    }
  ]
};

const unifiedOrder = sheinAdapter.transformOrder(mockSheinOrder);
console.log('   原始订单:', mockSheinOrder.orderNo);
console.log('   转换后:');
console.log('   - 平台:', unifiedOrder.platform);
console.log('   - 订单号:', unifiedOrder.platformOrderId);
console.log('   - 状态:', unifiedOrder.status);
console.log('   - 总金额:', unifiedOrder.totalAmount, unifiedOrder.currency);
console.log('   - 收货人:', unifiedOrder.shipping.name);
console.log('   - 商品数:', unifiedOrder.items.length);

// 6. 测试按平台获取
console.log('\n6. 按平台获取适配器:');
const sheinAdapters = adapterManager.getByPlatform('shein');
console.log(`   SHEIN适配器数量: ${sheinAdapters.length}`);

console.log('\n========================================');
console.log('  测试完成!');
console.log('========================================');
