/**
 * SHEIN全托管平台 Webhook路由
 * 严格按照官方文档实现
 * 
 * 统一回调地址: /shein-full/callback
 * 通过header中的x-lt-eventCode区分事件类型
 */

const express = require('express');
const router = express.Router();
const { Sequelize } = require('sequelize');
const { verifySignForHttp, aesDecrypt } = require('../../utils/shein-crypto');

// 数据库连接（使用services/.env中的MYSQL_*变量）
const sequelize = new Sequelize(
  process.env.MYSQL_DATABASE || 'eer',
  process.env.MYSQL_USER || 'root',
  process.env.MYSQL_PASSWORD || '',
  {
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3306,
    dialect: 'mysql',
    logging: false,
    timezone: '+08:00'
  }
);

// 缓存平台配置
let platformConfig = null;
let configCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

/**
 * 获取SHEIN平台配置（从数据库）
 */
async function getSheinConfig() {
  // 使用缓存
  if (platformConfig && Date.now() - configCacheTime < CACHE_TTL) {
    return platformConfig;
  }
  
  try {
    const [results] = await sequelize.query(
      `SELECT app_key, app_secret FROM platform_configs 
       WHERE platform_name = 'shein_full' AND status = 1 LIMIT 1`
    );
    
    if (!results || results.length === 0) {
      console.error('[SHEIN全托管] ❌ 未找到平台配置，请检查platform_configs表');
      return null;
    }
    
    const config = results[0];
    if (!config.app_key || !config.app_secret) {
      console.error('[SHEIN全托管] ❌ 平台凭证未配置，请在platform_configs表中设置app_key和app_secret');
      return null;
    }
    
    platformConfig = {
      appId: config.app_key,
      appSecret: config.app_secret
    };
    
    configCacheTime = Date.now();
    console.log('[SHEIN全托管] ✓ 已从数据库加载平台配置');
    
    return platformConfig;
  } catch (error) {
    console.error('[SHEIN全托管] ❌ 获取平台配置失败:', error.message);
    return null;
  }
}

/**
 * 统一回调入口
 * POST /shein-full/callback
 * 
 * SHEIN会发送POST请求到回调地址：
 * 1. 验证回调地址可用性 - 必须返回2xx状态码才能通过校验
 * 2. 推送事件通知 - 必须返回2xx状态码表示接收成功
 * 
 * 请求头:
 * - x-lt-openKeyId: 供应商openkey
 * - x-lt-eventCode: 事件编码
 * - x-lt-appid: 开发者应用id
 * - x-lt-timestamp: 请求时间戳
 * - x-lt-signature: 签名
 * - Content-Type: application/json
 * 
 * 请求体 (form-data格式):
 * - eventData: 加密内容
 */
router.post('/callback', async (req, res) => {
  try {
    // 获取请求头（处理header名称可能带空格、值可能带引号的情况）
    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
      // 清理header名称的空格，清理值的引号和逗号
      let cleanValue = value;
      if (typeof value === 'string') {
        cleanValue = value.replace(/^["']|["'],?$/g, '').trim();
      }
      headers[key.trim().toLowerCase()] = cleanValue;
    }
    
    const openKeyId = headers['x-lt-openkeyid'];
    const eventCode = headers['x-lt-eventcode'];
    const appId = headers['x-lt-appid'];
    const timestamp = headers['x-lt-timestamp'];
    const signature = headers['x-lt-signature'];
    
    console.log('\n[SHEIN全托管] ==================== 收到Webhook ====================');
    console.log('[SHEIN全托管] 时间:', new Date().toISOString());
    console.log('[SHEIN全托管] 事件类型:', eventCode);
    console.log('[SHEIN全托管] openKeyId:', openKeyId);
    console.log('[SHEIN全托管] appId:', appId);
    console.log('[SHEIN全托管] timestamp:', timestamp);
    console.log('[SHEIN全托管] signature:', signature);
    
    // 获取平台配置（从数据库）
    const config = await getSheinConfig();
    
    // 签名验证结果（按Java示例，返回值应为签名验证结果）
    let verifySign = false;
    
    // 验证签名（使用appid和appSecretKey）
    if (config && config.appSecret) {
      const requestPath = req.originalUrl || req.path;
      verifySign = verifySignForHttp(headers, config.appSecret, requestPath);
      
      if (!verifySign) {
        console.warn('[SHEIN全托管] ⚠️ 签名验证失败');
      } else {
        console.log('[SHEIN全托管] ✓ 签名验证成功');
      }
    } else {
      console.warn('[SHEIN全托管] ⚠️ 未获取到平台配置，跳过签名验证');
    }
    
    // 解密数据
    // SHEIN以form-data格式传参，eventData字段包含加密内容
    let data = req.body;
    const eventData = req.body.eventData;
    
    if (eventData) {
      console.log('[SHEIN全托管] 收到加密数据，长度:', eventData.length);
      
      if (config && config.appSecret) {
        const decryptedData = aesDecrypt(eventData, config.appSecret);
        if (decryptedData) {
          try {
            // 解密后的数据可能是JSON字符串
            data = JSON.parse(decryptedData);
            console.log('[SHEIN全托管] ✓ 解密成功');
          } catch {
            // 某些事件的数据本身就是字符串（如商品合规信息失效通知）
            // 尝试再次解析（数据可能是双重JSON编码）
            try {
              data = JSON.parse(JSON.parse(decryptedData));
              console.log('[SHEIN全托管] ✓ 解密成功(双重编码)');
            } catch {
              data = decryptedData;
              console.log('[SHEIN全托管] 解密后数据不是JSON格式，使用原始字符串');
            }
          }
        } else {
          console.warn('[SHEIN全托管] ⚠️ 解密失败，使用原始数据');
        }
      } else {
        console.warn('[SHEIN全托管] ⚠️ 未获取到平台配置，无法解密');
      }
    }
    
    // 限制日志长度，避免大数据量时日志过长
    const dataStr = JSON.stringify(data, null, 2);
    console.log('[SHEIN全托管] 数据:', dataStr.length > 2000 ? dataStr.substring(0, 2000) + '...(truncated)' : dataStr);
    
    // 异步处理业务逻辑（避免接口超时）
    setImmediate(() => {
      handleEvent(eventCode, data, openKeyId).catch(err => {
        console.error('[SHEIN全托管] 异步处理失败:', err);
      });
    });
    
    // 按Java示例，返回签名验证结果（boolean）
    // SHEIN要求2xx状态码表示接收成功
    console.log('[SHEIN全托管] 返回签名验证结果:', verifySign);
    res.status(200).send(String(verifySign));
    
  } catch (error) {
    console.error('[SHEIN全托管] 处理失败:', error);
    // 出错返回500，让SHEIN知道处理失败
    res.status(500).send('false');
  }
});

/**
 * 事件分发处理
 * 根据x-lt-eventCode分发到对应的处理函数
 */
async function handleEvent(eventCode, data, openKeyId) {
  console.log(`[SHEIN全托管] 开始处理事件: ${eventCode}`);
  
  switch (eventCode) {
    // 发货单变更通知
    case 'delivery_modify_notice':
      await handleDeliveryModify(data);
      break;
    
    // 采购单通知
    case 'purchase_order_notice':
      await handlePurchaseOrder(data);
      break;
    
    // 店铺授权关系变更通知
    case 'authorization_change_notice':
      await handleAuthorizationChange(data);
      break;
    
    // 商品上下架通知
    case 'product_shelves_notice':
      await handleProductShelves(data);
      break;
    
    // 商品审核通知
    case 'product_document_audit_status_notice':
      await handleProductAudit(data);
      break;
    
    // 商品发布公文审核通知（全渠道）
    case 'product_document_audit_status_notice_all_channels':
      await handleProductAuditAllChannels(data);
      break;
    
    // 商品接收通知
    case 'product_document_receive_status_notice':
      await handleProductReceive(data);
      break;
    
    // 商品涨价审批结果通知
    case 'product_price_audit_status_notice':
      await handlePriceAudit(data);
      break;
    
    // 商品价格异常通知
    case 'product_prices_abnormal_notice':
      await handlePriceAbnormal(data);
      break;
    
    // 商品额度变动通知
    case 'product_quota_change_notice':
      await handleQuotaChange(data);
      break;
    
    // SKU库存预警通知
    case 'inventory_warning_notice':
      await handleInventoryWarning(data);
      break;
    
    // 推送缺货需求库存数（新）
    case 'out_of_stock_notice':
      await handleOutOfStock(data);
      break;
    
    // 商品合规信息失效通知
    case 'product_compliance_change_notice':
      await handleComplianceChange(data);
      break;
    
    // 订单同步通知
    case 'order_push_notice':
      await handleOrderPush(data);
      break;
    
    // 退货单同步通知
    case 'return_order_push_notice':
      await handleReturnOrder(data);
      break;
    
    // SHEIN合作物流单下单通知
    case 'logistics_order_result_notice':
      await handleLogisticsOrder(data);
      break;
    
    // CTE开票通知
    case 'invoice_status_notice':
      await handleInvoiceStatus(data);
      break;
    
    default:
      console.log(`[SHEIN全托管] ⚠️ 未知事件类型: ${eventCode}`);
  }
  
  console.log(`[SHEIN全托管] 事件处理完成: ${eventCode}`);
}


// ==================== 事件处理函数 ====================

/**
 * 发货单变更通知
 * delivery_modify_notice
 */
async function handleDeliveryModify(data) {
  const deliveryCode = data.delivery_code;
  console.log(`[发货单变更] 发货单号: ${deliveryCode}`);
  
  // TODO: 调用sync-engine同步该发货单最新数据
  // 例如: await axios.post('http://localhost:5001/api/shein-full/sync/delivery-order', { deliveryCode });
}

/**
 * 采购单通知
 * purchase_order_notice
 * 
 * 数据格式: [{orderNo, state, stateName, orderType, time, type}, ...]
 * state: 1:待下单 2:已下单 3:发货中 4:已送货 5:已收货 6:已查验 7:已退货 8:已完成 9:无货下架 10:已作废 11:待审核 12:分单中 13:待退货 14:全部触发
 * orderType: 1:急采 2:备货 3:JIT母单
 * type: 1:状态变更
 */
async function handlePurchaseOrder(data) {
  let orders = [];
  
  // 解析数据（可能是数组或包含data字段的对象）
  if (Array.isArray(data)) {
    orders = data;
  } else if (data.data) {
    orders = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
  }
  
  const stateNames = {
    1: '待下单', 2: '已下单', 3: '发货中', 4: '已送货', 5: '已收货',
    6: '已查验', 7: '已退货', 8: '已完成', 9: '无货下架', 10: '已作废',
    11: '待审核', 12: '分单中', 13: '待退货', 14: '全部触发'
  };
  const orderTypes = { 1: '急采', 2: '备货', 3: 'JIT母单' };
  
  for (const order of orders) {
    console.log(`[采购单通知] 订单号: ${order.orderNo}`);
    console.log(`[采购单通知] 状态: ${stateNames[order.state] || order.state} (${order.stateName || ''})`);
    console.log(`[采购单通知] 类型: ${orderTypes[order.orderType] || order.orderType}`);
    console.log(`[采购单通知] 变动时间: ${new Date(order.time).toISOString()}`);
  }
  
  // TODO: 更新本地采购单状态
}

/**
 * 店铺授权关系变更通知
 * authorization_change_notice
 * 
 * type: 1-卖家手动解绑 2-卖家重置秘钥 3-店铺已失效 4-其它
 */
async function handleAuthorizationChange(data) {
  const { type, srmSupplierId, message } = data;
  const typeNames = { 1: '卖家手动解绑', 2: '卖家重置秘钥', 3: '店铺已失效', 4: '其它' };
  
  console.log(`[授权变更] 供应商ID: ${srmSupplierId}`);
  console.log(`[授权变更] 类型: ${typeNames[type] || type}`);
  console.log(`[授权变更] 消息: ${message}`);
  
  // TODO: 更新店铺授权状态
  // 如果是解绑或失效，需要标记店铺为未授权状态
}

/**
 * 商品上下架通知
 * product_shelves_notice
 * 
 * 数据格式:
 * {
 *   skcName: string,           // 平台生成的SKC
 *   updateTime: long,          // 上下架更新时间(毫秒时间戳)
 *   shelfChangeInfos: [{
 *     siteChangeInfos: [{
 *       site: string,          // 变更站点(如shein-us)
 *       shelfState: integer,   // 上下架状态 1:上架 0:下架
 *       firstShelfTime: string,// 子站首次上架时间
 *       lastShelfTime: string, // 子站最近上架时间
 *       recycleState: string   // 回收站状态 1:在回收站 0:不在回收站
 *     }]
 *   }]
 * }
 */
async function handleProductShelves(data) {
  const { skcName, updateTime, shelfChangeInfos } = data;
  const shelfStates = { 0: '下架', 1: '上架' };
  const recycleStates = { '0': '不在回收站', '1': '在回收站' };
  
  console.log(`[商品上下架] SKC: ${skcName}`);
  console.log(`[商品上下架] 更新时间: ${new Date(updateTime).toISOString()}`);
  
  if (shelfChangeInfos && shelfChangeInfos.length > 0) {
    for (const changeInfo of shelfChangeInfos) {
      if (changeInfo.siteChangeInfos) {
        for (const siteInfo of changeInfo.siteChangeInfos) {
          console.log(`[商品上下架] 站点: ${siteInfo.site}`);
          console.log(`[商品上下架] 状态: ${shelfStates[siteInfo.shelfState] || siteInfo.shelfState}`);
          console.log(`[商品上下架] 回收站: ${recycleStates[siteInfo.recycleState] || siteInfo.recycleState}`);
        }
      }
    }
  }
  
  // TODO: 更新本地商品上下架状态
}

/**
 * 商品审核通知
 * product_document_audit_status_notice
 * 
 * 数据格式:
 * {
 *   spu_name: string,          // 平台生成的SPU
 *   skc_name: string,          // 平台生成的SKC
 *   sku_list: [{ sku_code }],  // SKU信息
 *   document_sn: string,       // 商品审核的公文号
 *   version: string,           // 发品接口返回的版本号
 *   audit_time: string,        // 审核时间
 *   audit_state: integer,      // 审核状态 1:待审核 2:审批成功 3:审批失败 4:已撤回
 *   failed_reason: [{language, content}] // 审核失败原因
 * }
 */
async function handleProductAudit(data) {
  const auditStates = { 1: '待审核', 2: '审批成功', 3: '审批失败', 4: '已撤回' };
  const { spu_name, skc_name, sku_list, document_sn, version, audit_time, audit_state, failed_reason } = data;
  
  console.log(`[商品审核] SPU: ${spu_name}`);
  console.log(`[商品审核] SKC: ${skc_name}`);
  console.log(`[商品审核] 公文号: ${document_sn}`);
  console.log(`[商品审核] 版本号: ${version}`);
  console.log(`[商品审核] 审核时间: ${audit_time}`);
  console.log(`[商品审核] 审核状态: ${auditStates[audit_state] || audit_state}`);
  
  if (sku_list && sku_list.length > 0) {
    console.log(`[商品审核] SKU列表: ${sku_list.map(s => s.sku_code).join(', ')}`);
  }
  
  if (audit_state === 3 && failed_reason) {
    console.log(`[商品审核] 失败原因:`);
    for (const reason of failed_reason) {
      console.log(`  - [${reason.language}] ${reason.content}`);
    }
  }
  
  // TODO: 更新本地商品审核状态
}

/**
 * 商品发布公文审核通知（全渠道）
 * product_document_audit_status_notice_all_channels
 * 
 * 数据格式同 product_document_audit_status_notice
 */
async function handleProductAuditAllChannels(data) {
  const auditStates = { 1: '待审核', 2: '审批成功', 3: '审批失败', 4: '已撤回' };
  const { spu_name, skc_name, document_sn, audit_time, audit_state } = data;
  
  console.log(`[商品审核-全渠道] SPU: ${spu_name}`);
  console.log(`[商品审核-全渠道] SKC: ${skc_name}`);
  console.log(`[商品审核-全渠道] 公文号: ${document_sn}`);
  console.log(`[商品审核-全渠道] 审核时间: ${audit_time}`);
  console.log(`[商品审核-全渠道] 审核状态: ${auditStates[audit_state] || audit_state}`);
  
  // TODO: 更新本地商品审核状态
}

/**
 * 商品接收通知
 * product_document_receive_status_notice
 * 
 * 数据格式:
 * {
 *   spu_name: string,           // 平台生成的SPU
 *   version: string,            // 发品接口返回的版本号
 *   received_success: boolean,  // 平台是否接收成功
 *   document_details: [{
 *     document_sn: string,      // 公文号
 *     skc_name: string,         // SKC
 *     sku_list: [{ seller_sku, sku_code }]
 *   }],
 *   failed_reason: [{language, content}]
 * }
 */
async function handleProductReceive(data) {
  const { spu_name, version, received_success, document_details, failed_reason } = data;
  
  console.log(`[商品接收] SPU: ${spu_name}`);
  console.log(`[商品接收] 版本号: ${version}`);
  console.log(`[商品接收] 接收状态: ${received_success ? '成功' : '失败'}`);
  
  if (document_details && document_details.length > 0) {
    for (const detail of document_details) {
      console.log(`[商品接收] 公文号: ${detail.document_sn}, SKC: ${detail.skc_name}`);
      if (detail.sku_list) {
        for (const sku of detail.sku_list) {
          console.log(`[商品接收]   SKU: ${sku.sku_code}, 商家SKU: ${sku.seller_sku}`);
        }
      }
    }
  }
  
  if (!received_success && failed_reason) {
    console.log(`[商品接收] 失败原因:`);
    for (const reason of failed_reason) {
      console.log(`  - [${reason.language}] ${reason.content}`);
    }
  }
  
  // TODO: 更新本地商品接收状态
}

/**
 * 商品涨价审批结果通知
 * product_price_audit_status_notice
 */
async function handlePriceAudit(data) {
  console.log('[涨价审批] 数据:', JSON.stringify(data, null, 2));
  // TODO: 更新本地商品价格审批状态
}

/**
 * 商品价格异常通知
 * product_prices_abnormal_notice
 * 
 * 数据格式:
 * {
 *   skuInfos: [{
 *     skcName: string,          // SKC
 *     skuCode: string,          // SKU
 *     siteList: string[],       // 销售站点
 *     mutiAbnormalReason: [{language, remark}]
 *   }]
 * }
 */
async function handlePriceAbnormal(data) {
  const skuInfos = data.skuInfos || data.data?.skuInfos || [];
  
  console.log(`[价格异常] 异常SKU数量: ${skuInfos.length}`);
  
  for (const sku of skuInfos) {
    console.log(`[价格异常] SKC: ${sku.skcName}, SKU: ${sku.skuCode}`);
    console.log(`[价格异常] 站点: ${(sku.siteList || []).join(', ')}`);
    
    if (sku.mutiAbnormalReason) {
      const cnReason = sku.mutiAbnormalReason.find(r => r.language === 'CN');
      if (cnReason) {
        console.log(`[价格异常] 原因: ${cnReason.remark}`);
      }
    }
  }
  
  // TODO: 通知相关人员处理价格异常
}

/**
 * 商品额度变动通知
 * product_quota_change_notice
 * 
 * 数据格式:
 * {
 *   supplierId: long,       // 供应商ID
 *   reason: string,         // 原因
 *   availableLimit: long,   // 可用额度
 *   sendTimeStamp: long     // 时间戳
 * }
 */
async function handleQuotaChange(data) {
  // 数据可能在data字段中
  let quotaData = data;
  if (typeof data.data === 'string') {
    quotaData = JSON.parse(data.data);
  } else if (data.data) {
    quotaData = data.data;
  }
  
  const { supplierId, reason, availableLimit, sendTimeStamp } = quotaData;
  
  console.log(`[额度变动] 供应商ID: ${supplierId}`);
  console.log(`[额度变动] 可用额度: ${availableLimit}`);
  console.log(`[额度变动] 原因: ${reason}`);
  console.log(`[额度变动] 时间: ${sendTimeStamp ? new Date(sendTimeStamp).toISOString() : 'N/A'}`);
  
  if (availableLimit === 0) {
    console.warn(`[额度变动] ⚠️ 警告: 发品额度已用完，无法继续发品！`);
  }
  
  // TODO: 更新本地额度信息，额度为0时提醒用户
}

/**
 * SKU库存预警通知
 * inventory_warning_notice
 * 
 * 数据格式:
 * {
 *   sendTimestamp: long,    // 事件发送时间戳
 *   skcName: string,        // SKC
 *   skuCode: string,        // SKU
 *   salesDay: integer,      // 可售天数
 *   salesStatus: string,    // 预警状态 1:即将售罄 2:库存告急 3:库存充足
 *   usableStock: integer    // 当前可用库存
 * }
 */
async function handleInventoryWarning(data) {
  const salesStatusNames = { '1': '即将售罄', '2': '库存告急', '3': '库存充足' };
  const { sendTimestamp, skcName, skuCode, salesDay, salesStatus, usableStock } = data;
  
  console.log(`[库存预警] SKC: ${skcName}, SKU: ${skuCode}`);
  console.log(`[库存预警] 可用库存: ${usableStock}`);
  console.log(`[库存预警] 可售天数: ${salesDay}`);
  console.log(`[库存预警] 预警状态: ${salesStatusNames[salesStatus] || salesStatus}`);
  
  if (salesStatus === '1' || salesStatus === '2') {
    console.warn(`[库存预警] ⚠️ 需要补货！`);
  }
  
  // TODO: 根据预警状态触发补货流程
}

/**
 * 推送缺货需求库存数（新）
 * out_of_stock_notice
 */
async function handleOutOfStock(data) {
  console.log('[缺货通知] 数据:', JSON.stringify(data, null, 2));
  // TODO: 处理缺货通知
}

/**
 * 商品合规信息失效通知
 * product_compliance_change_notice
 * 
 * 数据格式:
 * {
 *   skc: string,              // SKC
 *   supplierId: long,         // 供应商ID
 *   complianceTypeId: int64,  // 失效类型 1:欧盟责任人 3:实拍图
 *   isRequired: integer,      // 是否必要 1:是
 *   isMiss: integer,          // 是否失效 1:是
 *   updateTime: datetime      // 失效时间
 * }
 */
async function handleComplianceChange(data) {
  // 数据可能是字符串
  let complianceData = data;
  if (typeof data === 'string') {
    complianceData = JSON.parse(data);
  }
  
  const complianceTypes = { 1: '欧盟责任人', 3: '实拍图' };
  const { skc, supplierId, complianceTypeId, isRequired, isMiss, updateTime } = complianceData;
  
  console.log(`[合规失效] SKC: ${skc}`);
  console.log(`[合规失效] 供应商ID: ${supplierId}`);
  console.log(`[合规失效] 失效类型: ${complianceTypes[complianceTypeId] || complianceTypeId}`);
  console.log(`[合规失效] 是否必要: ${isRequired === 1 ? '是' : '否'}`);
  console.log(`[合规失效] 是否失效: ${isMiss === 1 ? '是' : '否'}`);
  console.log(`[合规失效] 失效时间: ${updateTime}`);
  
  if (isMiss === 1 && isRequired === 1) {
    console.warn(`[合规失效] ⚠️ 必要的合规信息已失效，需要及时处理！`);
  }
  
  // TODO: 通知相关人员处理合规问题
}

/**
 * 订单同步通知
 * order_push_notice
 * 
 * 数据格式:
 * {
 *   orderNo: string,       // 订单号
 *   changeTime: integer,   // 更新时间(毫秒时间戳)
 *   orderStatus: integer   // 订单状态
 * }
 */
async function handleOrderPush(data) {
  const { orderNo, changeTime, orderStatus } = data;
  
  console.log(`[订单同步] 订单号: ${orderNo}`);
  console.log(`[订单同步] 订单状态: ${orderStatus}`);
  console.log(`[订单同步] 更新时间: ${changeTime ? new Date(changeTime).toISOString() : 'N/A'}`);
  
  // TODO: 同步订单数据到本地数据库
}

/**
 * 退货单同步通知
 * return_order_push_notice
 */
async function handleReturnOrder(data) {
  console.log('[退货单] 数据:', JSON.stringify(data, null, 2));
  // TODO: 同步退货单数据
}

/**
 * SHEIN合作物流单下单通知
 * logistics_order_result_notice
 */
async function handleLogisticsOrder(data) {
  console.log('[物流单] 数据:', JSON.stringify(data, null, 2));
  // TODO: 处理物流单通知
}

/**
 * CTE开票通知
 * invoice_status_notice
 */
async function handleInvoiceStatus(data) {
  console.log('[开票通知] 数据:', JSON.stringify(data, null, 2));
  // TODO: 处理开票通知
}

module.exports = router;
