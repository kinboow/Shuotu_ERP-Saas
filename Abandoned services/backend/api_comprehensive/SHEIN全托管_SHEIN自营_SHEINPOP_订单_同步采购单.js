/**
 * 同步采购单功能
 * 可用平台：SHEIN全托管、SHEIN自营、SHEIN POP
 * API路径：GET /open-api/order/purchase-order-infos
 * 
 * @param {Object} params - 调用参数
 * @param {number} params.shopId - 店铺ID
 * @param {string[]} [params.skcList] - SHEIN商品SKC码列表（可选）
 * @returns {Promise<Object>} - 返回同步结果
 */

const crypto = require('crypto');
const axios = require('axios');
const sequelize = require('../config/database');
const { QueryTypes } = require('sequelize');
const SheinPurchaseOrder = require('../models/SheinPurchaseOrder');
const SheinPurchaseOrderItem = require('../models/SheinPurchaseOrderItem');

/**
 * 生成5位随机字符串
 */
function generateRandomKey() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 生成SHEIN API签名
 */
function generateSignature(openKeyId, secretKey, path, timestamp, randomKey) {
  // 步骤1：组装签名数据VALUE
  const value = `${openKeyId}&${timestamp}&${path}`;
  
  // 步骤2：组装签名密钥KEY
  const key = `${secretKey}${randomKey}`;
  
  // 步骤3：HMAC-SHA256加密并转十六进制
  const hmac = crypto.createHmac('sha256', key);
  hmac.update(value);
  const hexSignature = hmac.digest('hex');
  
  // 步骤4：Base64编码
  const base64Signature = Buffer.from(hexSignature, 'utf8').toString('base64');
  
  // 步骤5：拼接RandomKey
  return `${randomKey}${base64Signature}`;
}

/**
 * 格式化日期时间为 YYYY-MM-DD HH:mm:ss
 */
function formatDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 生成55天间隔的时间范围数组（从当前时间到2012年）
 */
function generateTimeRanges() {
  const ranges = [];
  const endDate = new Date();
  const startDate = new Date('2012-01-01');
  
  let currentEnd = new Date(endDate);
  
  while (currentEnd > startDate) {
    let currentStart = new Date(currentEnd);
    currentStart.setDate(currentStart.getDate() - 55);
    
    if (currentStart < startDate) {
      currentStart = new Date(startDate);
    }
    
    ranges.push({
      start: formatDateTime(currentStart),
      end: formatDateTime(currentEnd)
    });
    
    if (currentStart.getTime() === startDate.getTime()) {
      break;
    }
    
    currentEnd = new Date(currentStart.getTime() - 1000);
  }
  
  return ranges;
}

/**
 * 解析日期字符串，处理无效日期
 */
function parseDate(dateStr) {
  if (!dateStr || dateStr === '1970-01-01 08:00:01' || dateStr === '1970-01-01 08:00:00') {
    return null;
  }
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * 将订单数据转换为数据库记录格式
 * 确保API返回的所有字段都被结构化保存
 */
function convertOrderToRecord(shopId, platformId, orderData, traceId) {
  return {
    // 基础关联
    shop_id: shopId,
    platform_id: platformId,
    
    // 采购单基本信息
    order_no: orderData.orderNo,
    type: orderData.type,
    type_name: orderData.typeName,
    status: orderData.status,
    status_name: orderData.statusName,
    
    // 供应商信息
    supplier_name: orderData.supplierName,
    supplier_code: orderData.supplierCode || (orderData.orderExtends?.[0]?.supplierCode),
    
    // 币种信息
    currency: orderData.currency,
    currency_id: orderData.currencyId,
    currency_name: orderData.currencyName,
    
    // 时间信息 - 全部保存
    add_time: parseDate(orderData.addTime),
    allocate_time: parseDate(orderData.allocateTime),
    update_time: parseDate(orderData.updateTime),
    reserve_time: parseDate(orderData.reserveTime),
    receipt_time: parseDate(orderData.receiptTime),
    check_time: parseDate(orderData.checkTime),
    storage_time: parseDate(orderData.storageTime),
    return_time: parseDate(orderData.returnTime),
    delivery_time: parseDate(orderData.deliveryTime),
    request_delivery_time: parseDate(orderData.requestDeliveryTime),
    request_receipt_time: parseDate(orderData.requestReceiptTime),
    request_take_parcel_time: parseDate(orderData.requestTakeParcelTime),
    request_complete_time: parseDate(orderData.requestCompleteTime),
    
    // 仓库信息
    storage_id: orderData.storageId?.toString(),
    warehouse_name: orderData.warehouseName,
    recommended_sub_warehouse_id: orderData.recommendedSubWarehouseId?.toString(),
    
    // 订单标识
    first_mark: orderData.firstMark === 1 || orderData.firstMark === true || orderData.firstMarkName === '是',
    first_mark_name: orderData.firstMarkName,
    urgent_type: orderData.urgentType,
    urgent_type_name: orderData.urgentTypeName,
    
    // 备货类型
    prepare_type_id: orderData.prepareTypeId,
    prepare_type_name: orderData.prepareTypeName,
    
    // 订单分类
    category: orderData.category,
    category_name: orderData.categoryName,
    order_mark_id: orderData.orderMarkId,
    order_mark_name: orderData.orderMarkName,
    
    // JIT相关
    is_jit_mother_name: orderData.isJitMotherName,
    is_prior_production_name: orderData.isPriorProductionName,
    is_production_completion_name: orderData.isProductionCompletionName,
    is_all_delivery_name: orderData.isAllDeliveryName,
    is_delivery_name: orderData.isDeliveryName,
    
    // 跟单信息
    order_supervisor: orderData.orderSupervisor,
    add_uid: orderData.addUid,
    
    // 国家市场
    country_market: orderData.countryMarket,
    
    // 定制信息
    custom_info_id: orderData.customInfoId,
    custom_info: orderData.customInfo,
    
    // 标签和商品层次信息（JSON存储）
    order_label_info: orderData.orderLabelInfo,
    goods_level: orderData.goodsLevel,
    
    // 版本和增值信息（OEM/ODM商家）
    attribute_version: orderData.attributeVersion,
    is_increment_on_way: orderData.isIncrementOnWay,
    
    // 请求追踪ID
    trace_id: traceId,
    
    // 原始完整数据（确保不丢失任何字段）
    raw_data: orderData
  };
}

/**
 * 将订单明细数据转换为数据库记录格式
 * 确保orderExtends中的所有字段都被结构化保存
 */
function convertItemToRecord(orderId, orderNo, item, orderCurrencyName) {
  return {
    // 关联信息
    purchase_order_id: orderId,
    order_no: orderNo,
    
    // SKC/SKU信息
    skc: item.skc,
    sku_code: item.skuCode,
    
    // 供应商信息
    supplier_code: item.supplierCode,
    supplier_sku: item.supplierSku,
    
    // 属性信息
    suffix_zh: item.suffixZh,
    
    // 价格和币种
    price: item.price,
    currency_name: item.currencyName || orderCurrencyName,
    
    // 数量信息 - 全部保存
    need_quantity: item.needQuantity,
    order_quantity: item.orderQuantity,
    delivery_quantity: item.deliveryQuantity,
    receipt_quantity: item.receiptQuantity,
    storage_quantity: item.storageQuantity,
    defective_quantity: item.defectiveQuantity,
    
    // JIT相关数量
    request_delivery_quantity: item.requestDeliveryQuantity,
    no_request_delivery_quantity: item.noRequestDeliveryQuantity,
    already_delivery_quantity: item.alreadyDeliveryQuantity,
    
    // 图片
    img_path: item.imgPath,
    sku_img: item.skuImg,
    
    // 备注
    remark: item.remark
  };
}

/**
 * 批量保存采购单到数据库（每批350条）
 */
async function savePurchaseOrdersBatch(shopId, platformId, ordersData) {
  const BATCH_SIZE = 350;
  const results = {
    syncedCount: 0,
    createdCount: 0,
    updatedCount: 0,
    errors: []
  };

  // 分批处理
  for (let i = 0; i < ordersData.length; i += BATCH_SIZE) {
    const batch = ordersData.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(ordersData.length / BATCH_SIZE);
    
    console.log(`[同步采购单] 写入批次 ${batchNum}/${totalBatches}，本批${batch.length}条`);
    
    const transaction = await sequelize.transaction();
    
    try {
      // 获取本批次所有订单号
      const orderNos = batch.map(o => o.orderNo);
      
      // 查询已存在的订单
      const existingOrders = await SheinPurchaseOrder.findAll({
        where: { shop_id: shopId, order_no: orderNos },
        transaction
      });
      const existingOrderMap = new Map(existingOrders.map(o => [o.order_no, o]));
      
      // 分离新增和更新的订单
      const toCreate = [];
      const toUpdate = [];
      
      for (const orderData of batch) {
        // 传递traceId参数（如果API返回中有的话）
        const record = convertOrderToRecord(shopId, platformId, orderData, orderData.traceId);
        const existing = existingOrderMap.get(orderData.orderNo);
        
        if (existing) {
          toUpdate.push({ existing, record, orderData });
        } else {
          toCreate.push({ record, orderData });
        }
      }
      
      // 批量创建新订单
      let createdOrders = [];
      if (toCreate.length > 0) {
        createdOrders = await SheinPurchaseOrder.bulkCreate(
          toCreate.map(item => item.record),
          { transaction, returning: true }
        );
        results.createdCount += createdOrders.length;
      }
      
      // 批量更新已存在的订单
      for (const { existing, record } of toUpdate) {
        await existing.update(record, { transaction });
        results.updatedCount++;
      }
      
      // 收集所有需要处理明细的订单ID
      const orderIdMap = new Map();
      
      // 新创建的订单
      for (let j = 0; j < createdOrders.length; j++) {
        const order = createdOrders[j];
        const orderData = toCreate[j].orderData;
        orderIdMap.set(orderData.orderNo, { id: order.id, orderData });
      }
      
      // 已存在的订单
      for (const { existing, orderData } of toUpdate) {
        orderIdMap.set(orderData.orderNo, { id: existing.id, orderData });
      }
      
      // 删除旧的明细记录
      const allOrderIds = Array.from(orderIdMap.values()).map(o => o.id);
      if (allOrderIds.length > 0) {
        await SheinPurchaseOrderItem.destroy({
          where: { purchase_order_id: allOrderIds },
          transaction
        });
      }
      
      // 批量插入新的明细记录
      const allItemRecords = [];
      for (const [orderNo, { id, orderData }] of orderIdMap) {
        if (orderData.orderExtends && orderData.orderExtends.length > 0) {
          for (const item of orderData.orderExtends) {
            // 传递订单级别的币种名称，以便明细记录也能保存
            allItemRecords.push(convertItemToRecord(id, orderNo, item, orderData.currencyName));
          }
        }
      }
      
      if (allItemRecords.length > 0) {
        await SheinPurchaseOrderItem.bulkCreate(allItemRecords, { transaction });
      }
      
      await transaction.commit();
      results.syncedCount += batch.length;
      
      console.log(`[同步采购单] 批次 ${batchNum} 完成：新增${toCreate.length}条，更新${toUpdate.length}条，明细${allItemRecords.length}条`);
      
    } catch (error) {
      await transaction.rollback();
      console.error(`[同步采购单] 批次 ${batchNum} 失败:`, error.message);
      
      // 记录本批次所有订单的错误
      for (const orderData of batch) {
        results.errors.push({
          orderNo: orderData.orderNo,
          error: error.message
        });
      }
    }
  }
  
  return results;
}

/**
 * 调用API获取采购单（支持自动翻页）
 */
async function fetchPurchaseOrders(shop, apiDomain, queryParams) {
  const apiPath = '/open-api/order/purchase-order-infos';
  const allOrders = [];
  let pageNumber = 1;
  const pageSize = 200;
  let hasMore = true;

  while (hasMore) {
    const timestamp = Date.now().toString();
    const randomKey = generateRandomKey();
    const signature = generateSignature(shop.open_key_id, shop.secret_key, apiPath, timestamp, randomKey);

    // 构建查询参数
    const params = new URLSearchParams({
      ...queryParams,
      pageNumber: pageNumber.toString(),
      pageSize: pageSize.toString()
    });

    const requestUrl = `${apiDomain}${apiPath}?${params.toString()}`;

    console.log(`[同步采购单] 请求第${pageNumber}页: ${requestUrl}`);

    const response = await axios.get(requestUrl, {
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'x-lt-openKeyId': shop.open_key_id,
        'x-lt-timestamp': timestamp,
        'x-lt-signature': signature,
        'x-lt-language': 'CN'
      },
      timeout: 60000
    });

    if (response.data.code !== '0') {
      throw new Error(response.data.msg || `API错误: ${response.data.code}`);
    }

    const orders = response.data.info?.list || [];
    allOrders.push(...orders);

    console.log(`[同步采购单] 第${pageNumber}页获取${orders.length}条数据，累计${allOrders.length}条`);

    // 判断是否需要继续翻页
    if (orders.length < pageSize) {
      hasMore = false;
    } else {
      pageNumber++;
      // 避免请求过快
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return allOrders;
}

/**
 * 同步采购单主函数
 */
async function syncPurchaseOrders(params) {
  const { shopId, skcList } = params;
  
  const result = {
    success: false,
    syncedCount: 0,
    createdCount: 0,
    updatedCount: 0,
    errors: [],
    message: ''
  };

  try {
    // 确保数据库表存在
    await SheinPurchaseOrder.sync();
    await SheinPurchaseOrderItem.sync();

    // 获取店铺授权信息
    const shops = await sequelize.query(
      `SELECT ps.*, pc.api_domain 
       FROM PlatformShops ps
       LEFT JOIN PlatformConfigs pc ON ps.platform_id = pc.id
       WHERE ps.id = :shopId AND ps.is_active = 1`,
      {
        replacements: { shopId },
        type: QueryTypes.SELECT
      }
    );

    if (!shops || shops.length === 0) {
      result.message = '店铺不存在或未授权';
      return result;
    }

    const shop = shops[0];
    const apiDomain = shop.api_domain || 'https://openapi.sheincorp.com';
    const platformId = shop.platform_id; // 获取平台ID

    console.log(`[同步采购单] 开始同步，店铺: ${shop.shop_name}, 平台ID: ${platformId}`);

    let allOrders = [];

    if (skcList && skcList.length > 0) {
      // 模式1：按SKC列表查询
      console.log(`[同步采购单] 按SKC列表查询，共${skcList.length}个SKC`);
      
      // SKC列表需要分批，每批最多200个
      const batchSize = 200;
      for (let i = 0; i < skcList.length; i += batchSize) {
        const batch = skcList.slice(i, i + batchSize);
        const skcsParam = batch.join(',');
        
        try {
          const orders = await fetchPurchaseOrders(shop, apiDomain, { skcs: skcsParam });
          allOrders.push(...orders);
          console.log(`[同步采购单] SKC批次${Math.floor(i / batchSize) + 1}获取${orders.length}条`);
        } catch (error) {
          result.errors.push({
            batch: Math.floor(i / batchSize) + 1,
            error: error.message
          });
        }
        
        // 避免请求过快
        if (i + batchSize < skcList.length) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    } else {
      // 模式2：按时间范围查询（55天间隔，从当前到2012年）
      console.log('[同步采购单] 按时间范围查询');
      
      const timeRanges = generateTimeRanges();
      console.log(`[同步采购单] 生成${timeRanges.length}个时间范围`);
      
      let emptyRangeCount = 0;
      const maxEmptyRanges = 5; // 连续5个空范围则停止

      for (let i = 0; i < timeRanges.length; i++) {
        const range = timeRanges[i];
        console.log(`[同步采购单] 查询时间范围 ${i + 1}/${timeRanges.length}: ${range.start} 到 ${range.end}`);

        try {
          const orders = await fetchPurchaseOrders(shop, apiDomain, {
            combineTimeStart: range.start,
            combineTimeEnd: range.end
          });

          if (orders.length === 0) {
            emptyRangeCount++;
            console.log(`[同步采购单] 该时间范围无数据（连续${emptyRangeCount}个空范围）`);
            
            if (emptyRangeCount >= maxEmptyRanges) {
              console.log(`[同步采购单] 连续${maxEmptyRanges}个空范围，停止查询`);
              break;
            }
          } else {
            emptyRangeCount = 0;
            allOrders.push(...orders);
            console.log(`[同步采购单] 获取${orders.length}条，累计${allOrders.length}条`);
          }
        } catch (error) {
          result.errors.push({
            timeRange: `${range.start} - ${range.end}`,
            error: error.message
          });
          console.error(`[同步采购单] 时间范围查询失败:`, error.message);
        }

        // 避免请求过快
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    console.log(`[同步采购单] 共获取${allOrders.length}条采购单，开始写入数据库`);

    // 去重（按orderNo）
    const uniqueOrders = [];
    const orderNoSet = new Set();
    for (const order of allOrders) {
      if (!orderNoSet.has(order.orderNo)) {
        orderNoSet.add(order.orderNo);
        uniqueOrders.push(order);
      }
    }

    console.log(`[同步采购单] 去重后${uniqueOrders.length}条采购单`);

    // 批量写入数据库（每350条为一批）
    const saveResults = await savePurchaseOrdersBatch(shopId, platformId, uniqueOrders);
    
    result.syncedCount = saveResults.syncedCount;
    result.createdCount = saveResults.createdCount;
    result.updatedCount = saveResults.updatedCount;
    result.errors.push(...saveResults.errors);

    // 判断同步是否成功：
    // 1. 如果没有获取到任何数据，视为失败
    // 2. 如果所有数据都写入失败，视为失败
    // 3. 如果部分成功，视为成功但带警告
    if (uniqueOrders.length === 0) {
      result.success = false;
      result.message = '未获取到任何采购单数据';
    } else if (result.syncedCount === 0) {
      result.success = false;
      result.message = `同步失败：${result.errors.length}条数据全部写入失败`;
    } else if (result.errors.length > 0) {
      // 部分成功
      result.success = true;
      result.message = `同步部分完成：成功${result.syncedCount}条（新增${result.createdCount}，更新${result.updatedCount}），失败${result.errors.length}条`;
    } else {
      result.success = true;
      result.message = `同步完成：共${result.syncedCount}条，新增${result.createdCount}条，更新${result.updatedCount}条`;
    }

    console.log(`[同步采购单] ${result.message}`);

  } catch (error) {
    result.message = `同步失败: ${error.message}`;
    result.errors.push({ error: error.message });
    console.error('[同步采购单] 同步失败:', error);
  }

  return result;
}

module.exports = { syncPurchaseOrders };
