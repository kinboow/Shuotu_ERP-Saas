/**
 * 并发同步工具
 * 使用多线程（Promise并发）实现：
 * - 2个线程用于查询API
 * - 1个线程用于写入数据库
 */

const pLimit = require('p-limit');
const axios = require('axios');
const SheinProduct = require('../models/SheinProduct');
const Product = require('../models/Product');

/**
 * 并发同步商品数据
 * @param {Array} productList - 商品列表
 * @param {Object} shop - 店铺信息
 * @param {String} apiDomain - API域名
 * @param {String} secretKey - 密钥
 * @param {Number} shopId - 店铺ID
 * @param {Boolean} syncToProducts - 是否同步到产品表
 * @param {Object} SheinSignature - 签名工具
 * @param {Function} onProgress - 进度回调函数 (可选)
 * @returns {Object} 同步结果
 */
async function concurrentSyncProducts(
  productList,
  shop,
  apiDomain,
  secretKey,
  shopId,
  syncToProducts,
  SheinSignature,
  onProgress = null
) {
  // 创建并发限制器（用于API查询）
  const apiLimit = pLimit(5);      // 5个并发线程用于API查询
  
  let syncedToSheinProducts = 0;
  let syncedToProducts = 0;
  const errors = [];
  
  // 用于批量插入的数据队列
  const sheinProductDataList = [];
  const productDataList = [];
  const batchSize = 330;           // 每批次最多330条产品
  
  // 用于存储待处理的数据
  const pendingData = [];
  
  // API请求延迟（毫秒）- 避免触发限流
  const apiDelay = 50; // 每个请求间隔50ms（平衡速度和限流）
  
  console.log(`\n开始并发同步 ${productList.length} 个商品`);
  console.log('并发配置: 5个API线程 + 3个数据库线程');
  console.log('API请求间隔: ' + apiDelay + 'ms');
  console.log('批处理大小: ' + batchSize + ' 条/批次');
  console.log('预计批次数: ' + Math.ceil(productList.length / batchSize) + ' 批');
  console.log('预计API查询时间: ~' + Math.ceil(productList.length * apiDelay / 5 / 1000) + '秒');
  console.log('========================================\n');

  // 步骤1: 并发查询API获取商品详情
  console.log('步骤1: 并发查询API获取商品详情...');
  
  let completedCount = 0;
  const startTime = Date.now();
  
  // 通知进度：开始查询阶段
  if (onProgress) {
    onProgress({
      phase: 'query',
      phaseName: '查询商品',
      current: 0,
      total: productList.length,
      percent: 0
    });
  }
  
  const apiTasks = productList.map((product, index) =>
    apiLimit(async () => {
      const taskStartTime = Date.now();
      try {
        // 每5个请求后添加延迟以避免触发API限流
        if (index > 0 && index % 5 === 0) {
          console.log(`  [暂停] 已完成 ${index} 个请求，暂停 ${apiDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, apiDelay));
        }
        
        console.log(`  [${index + 1}/${productList.length}] 开始查询: ${product.spuName}`);
        
        const detailApiPath = '/open-api/goods/spu-info';
        const detailHeaders = SheinSignature.generateApiHeaders(
          shop.open_key_id,
          secretKey,
          detailApiPath
        );

        const detailResponse = await axios.post(
          apiDomain + detailApiPath,
          { spuName: product.spuName, languageList: ['zh-cn', 'en'] },
          { headers: detailHeaders }
        );

        const taskDuration = Date.now() - taskStartTime;
        completedCount++;
        
        if (detailResponse.data.code !== '0') {
          console.error(`  ✗ [${index + 1}/${productList.length}] 查询失败: ${product.spuName} - ${detailResponse.data.msg} (耗时: ${taskDuration}ms)`);
          errors.push({
            spuName: product.spuName,
            error: detailResponse.data.msg
          });
          return null;
        }

        const skcCount = detailResponse.data.info?.skcInfoList?.length || 0;
        let skuCount = 0;
        detailResponse.data.info?.skcInfoList?.forEach(skc => {
          skuCount += skc.skuInfoList?.length || 0;
        });
        
        const queryPercent = Math.round(completedCount / productList.length * 100);
        console.log(`  ✓ [${index + 1}/${productList.length}] 查询成功: ${product.spuName} (${skcCount} SKC, ${skuCount} SKU, 耗时: ${taskDuration}ms, 进度: ${queryPercent}%)`);

        // 通知进度：查询阶段进度更新
        if (onProgress) {
          onProgress({
            phase: 'query',
            phaseName: '查询商品',
            current: completedCount,
            total: productList.length,
            percent: queryPercent
          });
        }

        // 返回查询结果
        return {
          productInfo: detailResponse.data.info,
          originalProduct: product
        };
      } catch (error) {
        const taskDuration = Date.now() - taskStartTime;
        completedCount++;
        
        // 如果是429错误，记录更详细的信息
        const errorMsg = error.response?.status === 429 
          ? '触发API限流(429)，请稍后重试' 
          : error.message;
        console.error(`  ✗ [${index + 1}/${productList.length}] 查询失败: ${product.spuName} - ${errorMsg} (耗时: ${taskDuration}ms, HTTP ${error.response?.status || 'N/A'})`);
        errors.push({
          spuName: product.spuName,
          error: errorMsg,
          statusCode: error.response?.status
        });
        return null;
      }
    })
  );

  // 等待所有API查询完成
  const apiResults = await Promise.all(apiTasks);
  const validResults = apiResults.filter(r => r !== null);
  const totalDuration = Date.now() - startTime;
  
  console.log(`\n========================================`);
  console.log(`✓ API查询完成统计:`);
  console.log(`  总数: ${productList.length} 个商品`);
  console.log(`  成功: ${validResults.length} 个`);
  console.log(`  失败: ${productList.length - validResults.length} 个`);
  console.log(`  总耗时: ${(totalDuration / 1000).toFixed(2)} 秒`);
  console.log(`  平均速度: ${(totalDuration / productList.length).toFixed(0)} ms/个`);
  console.log(`========================================\n`);

  // 步骤2: 处理查询结果并准备数据
  console.log('步骤2: 处理查询结果并准备数据...');
  
  for (const result of validResults) {
    const { productInfo, originalProduct } = result;
    
    // 遍历SKC和SKU，构建数据
    for (const skc of productInfo.skcInfoList || []) {
      for (const sku of skc.skuInfoList || []) {
        // 构建SHEIN商品数据
        const sheinProductData = buildSheinProductData(
          productInfo,
          skc,
          sku,
          shopId
        );
        
        // 构建产品数据
        const productData = syncToProducts
          ? buildProductData(productInfo, skc, sku, originalProduct)
          : null;
        
        pendingData.push({
          sheinProductData,
          productData
        });
      }
    }
  }
  
  console.log(`✓ 数据准备完成: ${pendingData.length} 条记录\n`);

  // 步骤3: 串行写入数据库（避免并发事务冲突）
  console.log('步骤3: 串行写入数据库...');
  
  const totalBatches = Math.ceil(pendingData.length / batchSize);
  let completedBatches = 0;
  
  // 通知进度：开始写入阶段
  if (onProgress) {
    onProgress({
      phase: 'write',
      phaseName: '写入数据库',
      current: 0,
      total: pendingData.length,
      percent: 0,
      batches: { completed: 0, total: totalBatches }
    });
  }
  
  // 串行处理每个批次
  for (let i = 0; i < pendingData.length; i += batchSize) {
    const batch = pendingData.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    
    try {
      const sheinBatch = batch.map(d => d.sheinProductData);
      const productBatch = batch
        .map(d => d.productData)
        .filter(d => d !== null);
      
      // 批量插入
      await batchInsertProducts(sheinBatch, productBatch, syncToProducts);
      
      syncedToSheinProducts += sheinBatch.length;
      syncedToProducts += productBatch.length;
      completedBatches++;
      
      const writePercent = Math.round(completedBatches / totalBatches * 100);
      console.log(`  ✓ 批次 ${batchNum}: 插入 ${sheinBatch.length} 条SHEIN商品, ${productBatch.length} 条产品`);
      
      // 通知进度：写入阶段进度更新
      if (onProgress) {
        onProgress({
          phase: 'write',
          phaseName: '写入数据库',
          current: syncedToSheinProducts,
          total: pendingData.length,
          percent: writePercent,
          batches: { completed: completedBatches, total: totalBatches }
        });
      }
    } catch (error) {
      console.error(`  ✗ 批次 ${batchNum} 插入失败: ${error.message}`);
      if (error.original) {
        console.error(`     SQL错误: ${error.original.message}`);
        console.error(`     SQL代码: ${error.original.code}`);
      }
      
      // 不抛出错误，继续处理下一批次
      errors.push({
        batch: batchNum,
        error: error.message,
        sqlError: error.original?.message
      });
    }
  }
  
  console.log(`\n✓ 数据库写入完成\n`);

  return {
    syncedToSheinProducts,
    syncedToProducts,
    errors
  };
}

/**
 * 构建SHEIN商品数据
 */
function buildSheinProductData(productInfo, skc, sku, shopId) {
  const nameCn = productInfo.productMultiNameList?.find(n => n.language === 'zh-cn')?.productName || '';
  const nameEn = productInfo.productMultiNameList?.find(n => n.language === 'en')?.productName || '';
  const descCn = productInfo.productMultiDescList?.find(d => d.language === 'zh-cn')?.productDesc || '';
  const descEn = productInfo.productMultiDescList?.find(d => d.language === 'en')?.productDesc || '';
  
  const mainImage = skc.skcImageInfoList?.[0] || {};
  const priceInfo = sku.priceInfoList?.[0] || {};
  const costInfo = sku.costInfoList?.[0] || {};
  const shelfInfo = skc.shelfStatusInfoList?.[0] || {};
  const recycleInfo = skc.recycleInfoList?.[0] || {};
  const sampleInfo = skc.sampleInfo || {};
  const barcodeList = sku.skuSupplierInfo?.supplierBarcodeList?.[0] || {};

  return {
    shop_id: shopId,
    spu_name: productInfo.spuName,
    spu_supplier_code: productInfo.supplierCode || null,
    brand_code: productInfo.brandCode || null,
    category_id: productInfo.categoryId || null,
    product_type_id: productInfo.productTypeId || null,
    skc_name: skc.skcName,
    skc_supplier_code: skc.supplierCode || null,
    skc_attribute_id: skc.attributeId || null,
    skc_attribute_value_id: skc.attributeValueId || null,
    sku_code: sku.skuCode,
    supplier_sku: sku.supplierSku || null,
    product_name_cn: nameCn,
    product_name_en: nameEn,
    product_desc_cn: descCn,
    product_desc_en: descEn,
    main_image_url: mainImage.imageUrl || '',
    image_medium_url: mainImage.imageMediumUrl || '',
    image_small_url: mainImage.imageSmallUrl || '',
    image_group_code: mainImage.groupCode || '',
    length: sku.length ? parseFloat(sku.length) : null,
    width: sku.width ? parseFloat(sku.width) : null,
    height: sku.height ? parseFloat(sku.height) : null,
    weight: sku.weight || null,
    quantity_type: sku.quantityType || null,
    quantity_unit: sku.quantityUnit || null,
    quantity: sku.quantity || null,
    package_type: sku.packageType || null,
    base_price: priceInfo.basePrice || null,
    special_price: priceInfo.specialPrice || null,
    cost_price: costInfo.costPrice || null,
    srp_price: sku.srpPriceInfo?.srpPrice || null,
    currency: priceInfo.currency || costInfo.currency || '',
    site: priceInfo.site || shelfInfo.siteAbbr || '',
    shelf_status: shelfInfo.shelfStatus || null,
    mall_state: sku.mallState || null,
    stop_purchase: sku.stopPurchase || null,
    recycle_status: recycleInfo.recycleStatus || null,
    first_shelf_time: shelfInfo.firstShelfTime || null,
    last_shelf_time: shelfInfo.lastShelfTime || null,
    last_update_time: shelfInfo.lastUpdateTime || null,
    sample_code: sampleInfo.sampleCode || null,
    reserve_sample_flag: sampleInfo.reserveSampleFlag || null,
    spot_flag: sampleInfo.spotFlag || null,
    sample_judge_type: sampleInfo.sampleJudgeType || null,
    supplier_barcode_enabled: sku.skuSupplierInfo?.supplierBarcodeEnabled || null,
    barcode_type: barcodeList.barcode_type || null,
    product_multi_name_list: productInfo.productMultiNameList || [],
    product_multi_desc_list: productInfo.productMultiDescList || [],
    product_attribute_list: productInfo.productAttributeInfoList || [],
    dimension_attribute_list: productInfo.dimensionAttributeInfoList || [],
    sale_attribute_list: sku.saleAttributeList || [],
    skc_attribute_multi_list: skc.attributeMultiList || [],
    skc_attribute_value_multi_list: skc.attributeValueMultiList || [],
    images: skc.skcImageInfoList || [],
    spu_image_list: productInfo.spuImageInfoList || [],
    skc_image_list: skc.skcImageInfoList || [],
    sku_image_list: sku.skuImageInfoList ? [sku.skuImageInfoList] : [],
    site_detail_image_list: skc.siteDetailImageInfoList || [],
    price_info_list: sku.priceInfoList || [],
    cost_info_list: sku.costInfoList || [],
    shelf_status_info_list: skc.shelfStatusInfoList || [],
    recycle_info_list: skc.recycleInfoList || [],
    proof_of_stock_info_list: skc.proofOfStockInfoList || [],
    supplier_barcode_list: sku.skuSupplierInfo?.supplierBarcodeList || [],
    sku_supplier_info: sku.skuSupplierInfo || {},
    raw_data: {
      spu: {
        spuName: productInfo.spuName,
        supplierCode: productInfo.supplierCode,
        brandCode: productInfo.brandCode,
        categoryId: productInfo.categoryId,
        productTypeId: productInfo.productTypeId,
        productMultiNameList: productInfo.productMultiNameList,
        productMultiDescList: productInfo.productMultiDescList,
        productAttributeInfoList: productInfo.productAttributeInfoList,
        dimensionAttributeInfoList: productInfo.dimensionAttributeInfoList,
        spuImageInfoList: productInfo.spuImageInfoList
      },
      skc: {
        skcName: skc.skcName,
        supplierCode: skc.supplierCode,
        attributeId: skc.attributeId,
        attributeValueId: skc.attributeValueId,
        attributeMultiList: skc.attributeMultiList,
        attributeValueMultiList: skc.attributeValueMultiList,
        productMultiNameList: skc.productMultiNameList,
        skcImageInfoList: skc.skcImageInfoList,
        siteDetailImageInfoList: skc.siteDetailImageInfoList,
        shelfStatusInfoList: skc.shelfStatusInfoList,
        recycleInfoList: skc.recycleInfoList,
        sampleInfo: skc.sampleInfo,
        proofOfStockInfoList: skc.proofOfStockInfoList
      },
      sku: {
        skuCode: sku.skuCode,
        supplierSku: sku.supplierSku,
        length: sku.length,
        width: sku.width,
        height: sku.height,
        weight: sku.weight,
        mallState: sku.mallState,
        stopPurchase: sku.stopPurchase,
        saleAttributeList: sku.saleAttributeList,
        priceInfoList: sku.priceInfoList,
        costInfoList: sku.costInfoList,
        skuImageInfoList: sku.skuImageInfoList,
        skuSupplierInfo: sku.skuSupplierInfo,
        quantityType: sku.quantityType,
        quantityUnit: sku.quantityUnit,
        quantity: sku.quantity,
        packageType: sku.packageType,
        srpPriceInfo: sku.srpPriceInfo
      }
    }
  };
}

/**
 * 构建产品数据
 */
function buildProductData(productInfo, skc, sku, originalProduct) {
  const priceInfo = sku.priceInfoList?.[0];
  const costInfo = sku.costInfoList?.[0];
  const shelfStatus = skc.shelfStatusInfoList?.[0];
  const sampleInfo = skc.sampleInfo;

  return {
    sku: sku.skuCode,
    name: productInfo.productMultiNameList?.[0]?.productName || originalProduct.spuName,
    description: productInfo.productMultiDescList?.[0]?.productDesc || '',
    price: costInfo?.costPrice || 0,
    cost: priceInfo?.basePrice || 0,
    stock: 0,
    weight: sku.weight || 0,
    category: productInfo.categoryId?.toString() || '',
    image_url: skc.skcImageInfoList?.[0]?.imageUrl || '',
    source_platform: 'shein',
    source_spu: productInfo.spuName,
    source_skc: skc.skcName,
    source_sku: sku.skuCode,
    supplier_sku: sku.supplierSku,
    supplier_code: productInfo.supplierCode,
    brand: productInfo.brandCode,
    brand_code: productInfo.brandCode,
    category_id: productInfo.categoryId,
    product_type_id: productInfo.productTypeId,
    length: parseFloat(sku.length) || null,
    width: parseFloat(sku.width) || null,
    height: parseFloat(sku.height) || null,
    dimensions: {
      length: sku.length,
      width: sku.width,
      height: sku.height,
      weight: sku.weight
    },
    attributes: productInfo.productAttributeInfoList || [],
    sale_attributes: sku.saleAttributeList || [],
    dimension_attributes: productInfo.dimensionAttributeInfoList || [],
    images: skc.skcImageInfoList || [],
    main_image: skc.skcImageInfoList?.[0]?.imageUrl || '',
    detail_images: skc.siteDetailImageInfoList || [],
    price_info: sku.priceInfoList || [],
    base_price: priceInfo?.basePrice || null,
    special_price: priceInfo?.specialPrice || null,
    currency: priceInfo?.currency || null,
    cost_info: sku.costInfoList || [],
    cost_price: costInfo?.costPrice || null,
    srp_price: sku.srpPriceInfo?.srpPrice || null,
    status: sku.mallState === 1 ? 'active' : 'inactive',
    shelf_status: shelfStatus?.shelfStatus,
    mall_state: sku.mallState,
    stop_purchase: sku.stopPurchase,
    recycle_status: skc.recycleInfoList?.[0]?.recycleStatus,
    first_shelf_time: shelfStatus?.firstShelfTime,
    last_shelf_time: shelfStatus?.lastShelfTime,
    last_update_time: shelfStatus?.lastUpdateTime,
    sync_time: new Date(),
    sample_info: sampleInfo,
    sample_code: sampleInfo?.sampleCode,
    reserve_sample_flag: sampleInfo?.reserveSampleFlag,
    spot_flag: sampleInfo?.spotFlag,
    quantity_type: sku.quantityType,
    quantity_unit: sku.quantityUnit,
    quantity: sku.quantity,
    package_type: sku.packageType,
    supplier_barcode_enabled: sku.skuSupplierInfo?.supplierBarcodeEnabled,
    supplier_barcode_list: sku.skuSupplierInfo?.supplierBarcodeList,
    site: priceInfo?.site || shelfStatus?.siteAbbr,
    sites: skc.shelfStatusInfoList || [],
    multi_language_names: productInfo.productMultiNameList || [],
    multi_language_desc: productInfo.productMultiDescList || [],
    raw_data: {
      spu: productInfo,
      skc: skc,
      sku: sku
    }
  };
}

/**
 * 批量插入产品数据（不使用事务，避免并发冲突）
 */
async function batchInsertProducts(sheinProductDataList, productDataList, syncToProducts) {
  try {
    // 先插入SheinProducts
    if (sheinProductDataList.length > 0) {
      await SheinProduct.bulkCreate(sheinProductDataList, {
        updateOnDuplicate: [
          'spu_supplier_code',
          'brand_code',
          'category_id',
          'product_type_id',
          'skc_supplier_code',
          'skc_attribute_id',
          'skc_attribute_value_id',
          'supplier_sku',
          'product_name_cn',
          'product_name_en',
          'product_desc_cn',
          'product_desc_en',
          'main_image_url',
          'image_medium_url',
          'image_small_url',
          'length',
          'width',
          'height',
          'weight',
          'quantity_type',
          'quantity_unit',
          'quantity',
          'package_type',
          'base_price',
          'special_price',
          'cost_price',
          'srp_price',
          'currency',
          'site',
          'shelf_status',
          'mall_state',
          'stop_purchase',
          'recycle_status',
          'first_shelf_time',
          'last_shelf_time',
          'last_update_time',
          'sample_code',
          'reserve_sample_flag',
          'spot_flag',
          'sample_judge_type',
          'supplier_barcode_enabled',
          'barcode_type',
          'product_multi_name_list',
          'product_multi_desc_list',
          'product_attribute_list',
          'dimension_attribute_list',
          'sale_attribute_list',
          'skc_attribute_multi_list',
          'skc_attribute_value_multi_list',
          'images',
          'spu_image_list',
          'skc_image_list',
          'sku_image_list',
          'site_detail_image_list',
          'price_info_list',
          'cost_info_list',
          'shelf_status_info_list',
          'recycle_info_list',
          'proof_of_stock_info_list',
          'supplier_barcode_list',
          'sku_supplier_info',
          'raw_data',
          'updatedAt'
        ]
      });
    }

    // 再插入Products
    if (syncToProducts && productDataList.length > 0) {
      await Product.bulkCreate(productDataList, {
        updateOnDuplicate: [
          'name',
          'description',
          'price',
          'cost',
          'stock',
          'weight',
          'category',
          'image_url',
          'source_platform',
          'source_spu',
          'source_skc',
          'source_sku',
          'supplier_sku',
          'supplier_code',
          'brand',
          'brand_code',
          'category_id',
          'product_type_id',
          'length',
          'width',
          'height',
          'dimensions',
          'attributes',
          'sale_attributes',
          'dimension_attributes',
          'images',
          'main_image',
          'detail_images',
          'price_info',
          'base_price',
          'special_price',
          'currency',
          'cost_info',
          'cost_price',
          'srp_price',
          'status',
          'shelf_status',
          'mall_state',
          'stop_purchase',
          'recycle_status',
          'first_shelf_time',
          'last_shelf_time',
          'last_update_time',
          'sync_time',
          'sample_info',
          'sample_code',
          'reserve_sample_flag',
          'spot_flag',
          'quantity_type',
          'quantity_unit',
          'quantity',
          'package_type',
          'supplier_barcode_enabled',
          'supplier_barcode_list',
          'site',
          'sites',
          'multi_language_names',
          'multi_language_desc',
          'raw_data',
          'updatedAt'
        ]
      });
    }
  } catch (error) {
    console.error('批量插入失败:', error.message);
    throw error;
  }
}

module.exports = {
  concurrentSyncProducts
};
