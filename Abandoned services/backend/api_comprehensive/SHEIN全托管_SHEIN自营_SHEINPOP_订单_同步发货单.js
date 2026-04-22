/**
 * 同步发货单功能
 * 可用平台：SHEIN全托管、SHEIN自营、SHEIN POP
 * API路径：GET /open-api/shipping/delivery
 * 
 * @param {Object} params - 调用参数
 * @param {number} params.shopId - 店铺ID（必须）
 * @param {string} [params.deliveryCode] - SHEIN发货单号（可选，每次最多1个）
 * @returns {Promise<Object>} - 返回同步结果
 * 
 * 特殊说明：
 * - 当用户没有传入deliveryCode时，根据startTime和endTime查询API
 * - 查询间隔为30天，从当前时间查询到2012年
 * - 当返回的1页大小=200时，自动翻页直到一页大小小于200
 * - 当连续3个查询间隔返回数量为0时停止查询
 */

const crypto = require('crypto');
const axios = require('axios');
const sequelize = require('../config/database');
const { QueryTypes } = require('sequelize');

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
  const value = `${openKeyId}&${timestamp}&${path}`;
  const key = `${secretKey}${randomKey}`;
  const hmac = crypto.createHmac('sha256', key);
  hmac.update(value);
  const hexSignature = hmac.digest('hex');
  const base64Signature = Buffer.from(hexSignature, 'utf8').toString('base64');
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
 * 生成30天间隔的时间范围数组（从当前时间到2012年）
 */
function generateTimeRanges() {
  const ranges = [];
  const endDate = new Date();
  const startDate = new Date('2012-01-01');
  
  let currentEnd = new Date(endDate);
  
  while (currentEnd > startDate) {
    let currentStart = new Date(currentEnd);
    currentStart.setDate(currentStart.getDate() - 30); // 30天间隔
    
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
 * 获取店铺信息
 */
async function getShopInfo(shopId) {
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
    throw new Error(`店铺ID ${shopId} 不存在或未激活`);
  }
  
  const shop = shops[0];
  if (!shop.open_key_id || !shop.secret_key) {
    throw new Error(`店铺 ${shop.shop_name} 缺少必要的认证信息`);
  }
  
  return {
    ...shop,
    apiDomain: shop.api_domain || 'https://openapi.sheincorp.com'
  };
}

/**
 * 将发货单数据转换为数据库记录格式
 */
function convertDeliveryNoteToRecord(shopId, platformId, deliveryData) {
  const itemList = deliveryData.deliveryOrderDataList || [];
  return {
    shop_id: shopId,
    platform_id: platformId,
    delivery_code: deliveryData.deliveryCode,
    delivery_type: deliveryData.deliveryType,
    delivery_type_name: deliveryData.deliveryTypeName,
    express_id: deliveryData.expressId,
    express_company_name: deliveryData.expressCompanyName,
    express_code: deliveryData.expressCode,
    send_package: deliveryData.sendPackage || 0,
    package_weight: deliveryData.packageWeight || 0,
    take_parcel_time: parseDate(deliveryData.takeParcelTime),
    reserve_parcel_time: parseDate(deliveryData.reserveParcelTime),
    add_time: parseDate(deliveryData.addTime),
    pre_receipt_time: parseDate(deliveryData.preReceiptTime),
    receipt_time: parseDate(deliveryData.receiptTime),
    supplier_warehouse_id: deliveryData.supplierWarehouseId,
    supplier_warehouse_name: deliveryData.supplierWarehouseName,
    total_sku_count: itemList.length,
    total_delivery_quantity: itemList.reduce((sum, item) => sum + (item.deliveryQuantity || 0), 0),
    raw_data: JSON.stringify(deliveryData)
  };
}

/**
 * 将发货单明细数据转换为数据库记录格式
 */
function convertDeliveryItemToRecord(deliveryNoteId, deliveryCode, item) {
  return {
    delivery_note_id: deliveryNoteId,
    delivery_code: deliveryCode,
    skc: item.skc,
    sku_code: item.skuCode,
    order_no: item.orderNo,
    delivery_quantity: item.deliveryQuantity || 0
  };
}


/**
 * 调用SHEIN发货单查询API（支持自动翻页）
 */
async function fetchDeliveryNotes(shop, queryParams) {
  const apiPath = '/open-api/shipping/delivery';
  const allDeliveryNotes = [];
  let page = 1;
  const perPage = 200;
  let hasMore = true;

  while (hasMore) {
    const timestamp = Date.now().toString();
    const randomKey = generateRandomKey();
    
    // 构建查询参数
    const params = new URLSearchParams();
    if (queryParams.deliveryCode) {
      params.append('deliveryCode', queryParams.deliveryCode);
    }
    if (queryParams.startTime) {
      params.append('startTime', queryParams.startTime);
    }
    if (queryParams.endTime) {
      params.append('endTime', queryParams.endTime);
    }
    params.append('page', page.toString());
    params.append('perPage', perPage.toString());
    
    // 重要：签名只使用API路径，不包含查询参数
    const signature = generateSignature(shop.open_key_id, shop.secret_key, apiPath, timestamp, randomKey);
    
    const requestUrl = `${shop.apiDomain}${apiPath}?${params.toString()}`;
    console.log(`[同步发货单] 请求第${page}页: ${requestUrl}`);

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

    const deliveryNotes = response.data.info?.list || [];
    allDeliveryNotes.push(...deliveryNotes);

    console.log(`[同步发货单] 第${page}页获取${deliveryNotes.length}条数据，累计${allDeliveryNotes.length}条`);

    // 判断是否需要继续翻页：当返回数量=200时继续翻页
    if (deliveryNotes.length < perPage) {
      hasMore = false;
    } else {
      page++;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return allDeliveryNotes;
}

/**
 * 批量保存发货单到数据库（每批350条）
 */
async function saveDeliveryNotesBatch(shopId, platformId, deliveryNotesData) {
  const BATCH_SIZE = 350;
  const results = {
    syncedCount: 0,
    createdCount: 0,
    updatedCount: 0,
    errors: []
  };

  for (let i = 0; i < deliveryNotesData.length; i += BATCH_SIZE) {
    const batch = deliveryNotesData.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(deliveryNotesData.length / BATCH_SIZE);
    
    console.log(`[同步发货单] 写入批次 ${batchNum}/${totalBatches}，本批${batch.length}条`);
    
    const transaction = await sequelize.transaction();
    
    try {
      const deliveryCodes = batch.map(d => d.deliveryCode);
      
      // 查询已存在的发货单
      const existingNotes = await sequelize.query(
        `SELECT id, delivery_code FROM shein_delivery_notes WHERE shop_id = :shopId AND delivery_code IN (:deliveryCodes)`,
        {
          replacements: { shopId, deliveryCodes },
          type: QueryTypes.SELECT,
          transaction
        }
      );
      const existingMap = new Map(existingNotes.map(n => [n.delivery_code, n.id]));
      
      const toCreate = [];
      const toUpdate = [];
      
      for (const deliveryData of batch) {
        const record = convertDeliveryNoteToRecord(shopId, platformId, deliveryData);
        const existingId = existingMap.get(deliveryData.deliveryCode);
        
        if (existingId) {
          toUpdate.push({ id: existingId, record, deliveryData });
        } else {
          toCreate.push({ record, deliveryData });
        }
      }

      
      // 批量创建新发货单
      let createdIds = [];
      if (toCreate.length > 0) {
        const insertValues = toCreate.map(item => {
          const r = item.record;
          return `(${shopId}, '${r.delivery_code}', ${r.delivery_type || 'NULL'}, ${r.delivery_type_name ? `'${r.delivery_type_name}'` : 'NULL'}, 
            ${r.express_id ? `'${r.express_id}'` : 'NULL'}, ${r.express_company_name ? `'${r.express_company_name}'` : 'NULL'}, 
            ${r.express_code ? `'${r.express_code}'` : 'NULL'}, ${r.send_package}, ${r.package_weight}, 
            ${r.take_parcel_time ? `'${formatDateTime(r.take_parcel_time)}'` : 'NULL'}, 
            ${r.reserve_parcel_time ? `'${formatDateTime(r.reserve_parcel_time)}'` : 'NULL'}, 
            ${r.add_time ? `'${formatDateTime(r.add_time)}'` : 'NULL'}, 
            ${r.pre_receipt_time ? `'${formatDateTime(r.pre_receipt_time)}'` : 'NULL'}, 
            ${r.receipt_time ? `'${formatDateTime(r.receipt_time)}'` : 'NULL'}, 
            ${r.supplier_warehouse_id || 'NULL'}, ${r.supplier_warehouse_name ? `'${r.supplier_warehouse_name}'` : 'NULL'}, 
            ${r.total_sku_count}, ${r.total_delivery_quantity}, '${r.raw_data.replace(/'/g, "''")}')`;
        });
        
        // 使用单条插入以获取ID
        for (const item of toCreate) {
          const r = item.record;
          const [result] = await sequelize.query(
            `INSERT INTO shein_delivery_notes 
             (shop_id, platform_id, delivery_code, delivery_type, delivery_type_name, express_id, express_company_name, 
              express_code, send_package, package_weight, take_parcel_time, reserve_parcel_time, add_time, 
              pre_receipt_time, receipt_time, supplier_warehouse_id, supplier_warehouse_name, 
              total_sku_count, total_delivery_quantity, raw_data)
             VALUES (:shopId, :platformId, :deliveryCode, :deliveryType, :deliveryTypeName, :expressId, :expressCompanyName,
              :expressCode, :sendPackage, :packageWeight, :takeParcelTime, :reserveParcelTime, :addTime,
              :preReceiptTime, :receiptTime, :supplierWarehouseId, :supplierWarehouseName,
              :totalSkuCount, :totalDeliveryQuantity, :rawData)`,
            {
              replacements: {
                shopId,
                platformId,
                deliveryCode: r.delivery_code,
                deliveryType: r.delivery_type,
                deliveryTypeName: r.delivery_type_name,
                expressId: r.express_id,
                expressCompanyName: r.express_company_name,
                expressCode: r.express_code,
                sendPackage: r.send_package,
                packageWeight: r.package_weight,
                takeParcelTime: r.take_parcel_time,
                reserveParcelTime: r.reserve_parcel_time,
                addTime: r.add_time,
                preReceiptTime: r.pre_receipt_time,
                receiptTime: r.receipt_time,
                supplierWarehouseId: r.supplier_warehouse_id,
                supplierWarehouseName: r.supplier_warehouse_name,
                totalSkuCount: r.total_sku_count,
                totalDeliveryQuantity: r.total_delivery_quantity,
                rawData: r.raw_data
              },
              type: QueryTypes.INSERT,
              transaction
            }
          );
          createdIds.push({ id: result, deliveryData: item.deliveryData });
        }
        results.createdCount += toCreate.length;
      }
      
      // 批量更新已存在的发货单
      for (const { id, record } of toUpdate) {
        await sequelize.query(
          `UPDATE shein_delivery_notes SET 
            delivery_type = :deliveryType, delivery_type_name = :deliveryTypeName,
            express_id = :expressId, express_company_name = :expressCompanyName,
            express_code = :expressCode, send_package = :sendPackage, package_weight = :packageWeight,
            take_parcel_time = :takeParcelTime, reserve_parcel_time = :reserveParcelTime,
            add_time = :addTime, pre_receipt_time = :preReceiptTime, receipt_time = :receiptTime,
            supplier_warehouse_id = :supplierWarehouseId, supplier_warehouse_name = :supplierWarehouseName,
            total_sku_count = :totalSkuCount, total_delivery_quantity = :totalDeliveryQuantity,
            raw_data = :rawData, updatedAt = NOW()
           WHERE id = :id`,
          {
            replacements: {
              id,
              deliveryType: record.delivery_type,
              deliveryTypeName: record.delivery_type_name,
              expressId: record.express_id,
              expressCompanyName: record.express_company_name,
              expressCode: record.express_code,
              sendPackage: record.send_package,
              packageWeight: record.package_weight,
              takeParcelTime: record.take_parcel_time,
              reserveParcelTime: record.reserve_parcel_time,
              addTime: record.add_time,
              preReceiptTime: record.pre_receipt_time,
              receiptTime: record.receipt_time,
              supplierWarehouseId: record.supplier_warehouse_id,
              supplierWarehouseName: record.supplier_warehouse_name,
              totalSkuCount: record.total_sku_count,
              totalDeliveryQuantity: record.total_delivery_quantity,
              rawData: record.raw_data
            },
            type: QueryTypes.UPDATE,
            transaction
          }
        );
        results.updatedCount++;
      }

      
      // 收集所有需要处理明细的发货单
      const noteIdMap = new Map();
      
      // 新创建的发货单
      for (const { id, deliveryData } of createdIds) {
        noteIdMap.set(deliveryData.deliveryCode, { id, deliveryData });
      }
      
      // 已存在的发货单
      for (const { id, deliveryData } of toUpdate) {
        noteIdMap.set(deliveryData.deliveryCode, { id, deliveryData });
      }
      
      // 删除旧的明细记录
      const allNoteIds = Array.from(noteIdMap.values()).map(n => n.id);
      if (allNoteIds.length > 0) {
        await sequelize.query(
          `DELETE FROM shein_delivery_note_items WHERE delivery_note_id IN (:noteIds)`,
          {
            replacements: { noteIds: allNoteIds },
            type: QueryTypes.DELETE,
            transaction
          }
        );
      }
      
      // 批量插入新的明细记录
      const allItemRecords = [];
      for (const [deliveryCode, { id, deliveryData }] of noteIdMap) {
        if (deliveryData.deliveryOrderDataList && deliveryData.deliveryOrderDataList.length > 0) {
          for (const item of deliveryData.deliveryOrderDataList) {
            allItemRecords.push(convertDeliveryItemToRecord(id, deliveryCode, item));
          }
        }
      }
      
      if (allItemRecords.length > 0) {
        // 分批插入明细（每批500条）
        const ITEM_BATCH_SIZE = 500;
        for (let j = 0; j < allItemRecords.length; j += ITEM_BATCH_SIZE) {
          const itemBatch = allItemRecords.slice(j, j + ITEM_BATCH_SIZE);
          const values = itemBatch.map(item => 
            `(${item.delivery_note_id}, '${item.delivery_code}', '${item.skc}', ${item.sku_code ? `'${item.sku_code}'` : 'NULL'}, ${item.order_no ? `'${item.order_no}'` : 'NULL'}, ${item.delivery_quantity})`
          ).join(',');
          
          await sequelize.query(
            `INSERT INTO shein_delivery_note_items 
             (delivery_note_id, delivery_code, skc, sku_code, order_no, delivery_quantity)
             VALUES ${values}
             ON DUPLICATE KEY UPDATE delivery_quantity = VALUES(delivery_quantity), updatedAt = NOW()`,
            { type: QueryTypes.INSERT, transaction }
          );
        }
      }
      
      await transaction.commit();
      results.syncedCount += batch.length;
      
      console.log(`[同步发货单] 批次 ${batchNum} 完成：新增${toCreate.length}条，更新${toUpdate.length}条，明细${allItemRecords.length}条`);
      
    } catch (error) {
      await transaction.rollback();
      console.error(`[同步发货单] 批次 ${batchNum} 失败:`, error.message);
      
      for (const deliveryData of batch) {
        results.errors.push({
          deliveryCode: deliveryData.deliveryCode,
          error: error.message
        });
      }
    }
  }
  
  return results;
}


/**
 * 记录同步日志
 */
async function logSync(shopId, syncType, queryParams, status, counts, errorMessage = null) {
  try {
    await sequelize.query(
      `INSERT INTO shein_delivery_note_sync_logs 
       (shop_id, sync_type, query_params, total_count, success_count, failed_count, sync_status, error_message, started_at, completed_at)
       VALUES (:shopId, :syncType, :queryParams, :totalCount, :successCount, :failedCount, :status, :errorMessage, :startedAt, NOW())`,
      {
        replacements: {
          shopId,
          syncType,
          queryParams: JSON.stringify(queryParams),
          totalCount: counts.total || 0,
          successCount: counts.success || 0,
          failedCount: counts.failed || 0,
          status,
          errorMessage,
          startedAt: counts.startedAt || new Date()
        },
        type: QueryTypes.INSERT
      }
    );
  } catch (error) {
    console.error('[同步发货单] 记录日志失败:', error.message);
  }
}

/**
 * 同步发货单主函数
 */
async function syncDeliveryNotes(params) {
  const { shopId, deliveryCode } = params;
  
  const result = {
    success: false,
    syncedCount: 0,
    createdCount: 0,
    updatedCount: 0,
    errors: [],
    message: ''
  };
  
  const startedAt = new Date();

  try {
    // 获取店铺授权信息
    const shop = await getShopInfo(shopId);
    const platformId = shop.platform_id; // 获取平台ID
    console.log(`[同步发货单] 开始同步，店铺: ${shop.shop_name}, 平台ID: ${platformId}`);

    let allDeliveryNotes = [];
    let syncType = 'manual';
    let queryParams = {};

    if (deliveryCode) {
      // 模式1：按发货单号查询（单个）
      syncType = 'by_code';
      queryParams = { deliveryCode };
      console.log(`[同步发货单] 按发货单号查询: ${deliveryCode}`);
      
      try {
        const notes = await fetchDeliveryNotes(shop, { deliveryCode });
        allDeliveryNotes.push(...notes);
        console.log(`[同步发货单] 获取${notes.length}条发货单`);
      } catch (error) {
        result.errors.push({
          deliveryCode,
          error: error.message
        });
      }
    } else {
      // 模式2：按时间范围查询（30天间隔，从当前到2012年）
      syncType = 'auto';
      console.log('[同步发货单] 按时间范围查询（30天间隔）');
      
      const timeRanges = generateTimeRanges();
      console.log(`[同步发货单] 生成${timeRanges.length}个时间范围`);
      
      let emptyRangeCount = 0;
      const maxEmptyRanges = 3; // 连续3个空范围则停止

      for (let i = 0; i < timeRanges.length; i++) {
        const range = timeRanges[i];
        console.log(`[同步发货单] 查询时间范围 ${i + 1}/${timeRanges.length}: ${range.start} 到 ${range.end}`);

        try {
          const notes = await fetchDeliveryNotes(shop, {
            startTime: range.start,
            endTime: range.end
          });

          if (notes.length === 0) {
            emptyRangeCount++;
            console.log(`[同步发货单] 该时间范围无数据（连续${emptyRangeCount}个空范围）`);
            
            if (emptyRangeCount >= maxEmptyRanges) {
              console.log(`[同步发货单] 连续${maxEmptyRanges}个空范围，停止查询`);
              break;
            }
          } else {
            emptyRangeCount = 0;
            allDeliveryNotes.push(...notes);
            console.log(`[同步发货单] 获取${notes.length}条，累计${allDeliveryNotes.length}条`);
          }
        } catch (error) {
          result.errors.push({
            timeRange: `${range.start} - ${range.end}`,
            error: error.message
          });
          console.error(`[同步发货单] 时间范围查询失败:`, error.message);
        }

        // 避免请求过快
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      queryParams = { timeRanges: timeRanges.length };
    }

    console.log(`[同步发货单] 共获取${allDeliveryNotes.length}条发货单，开始写入数据库`);

    // 去重（按deliveryCode）
    const uniqueNotes = [];
    const codeSet = new Set();
    for (const note of allDeliveryNotes) {
      if (!codeSet.has(note.deliveryCode)) {
        codeSet.add(note.deliveryCode);
        uniqueNotes.push(note);
      }
    }

    console.log(`[同步发货单] 去重后${uniqueNotes.length}条发货单`);

    // 批量写入数据库
    if (uniqueNotes.length > 0) {
      const saveResults = await saveDeliveryNotesBatch(shopId, platformId, uniqueNotes);
      
      result.syncedCount = saveResults.syncedCount;
      result.createdCount = saveResults.createdCount;
      result.updatedCount = saveResults.updatedCount;
      result.errors.push(...saveResults.errors);
    }

    // 判断同步结果
    if (uniqueNotes.length === 0) {
      result.success = true;
      result.message = '未获取到任何发货单数据';
    } else if (result.syncedCount === 0) {
      result.success = false;
      result.message = `同步失败：${result.errors.length}条数据全部写入失败`;
    } else if (result.errors.length > 0) {
      result.success = true;
      result.message = `同步部分完成：成功${result.syncedCount}条（新增${result.createdCount}，更新${result.updatedCount}），失败${result.errors.length}条`;
    } else {
      result.success = true;
      result.message = `同步完成：共${result.syncedCount}条，新增${result.createdCount}条，更新${result.updatedCount}条`;
    }

    // 记录同步日志
    await logSync(shopId, syncType, queryParams, result.success ? 'completed' : 'failed', {
      total: uniqueNotes.length,
      success: result.syncedCount,
      failed: result.errors.length,
      startedAt
    }, result.errors.length > 0 ? JSON.stringify(result.errors.slice(0, 10)) : null);

    console.log(`[同步发货单] ${result.message}`);

  } catch (error) {
    result.message = `同步失败: ${error.message}`;
    result.errors.push({ error: error.message });
    console.error('[同步发货单] 同步失败:', error);
    
    await logSync(shopId, 'manual', {}, 'failed', { startedAt }, error.message);
  }

  return result;
}

module.exports = { syncDeliveryNotes };
