/**
 * 商品打印条码功能
 * 可用平台：SHEIN全托管、SHEIN自营
 * API路径：POST /open-api/goods/print-barcode
 * 
 * @param {Object} params - 调用参数
 * @param {number} params.shopId - 店铺ID（必须）
 * @param {Array} params.data - 打印数据数组（必须）
 * @param {string} [params.data[].orderNo] - 采购单号（可选）
 * @param {string} [params.data[].supplierSku] - 卖家SKU编码（与sheinSku二选一）
 * @param {string} params.data[].sheinSku - SHEIN SKU编码（必须）
 * @param {number} params.data[].printNumber - 打印份数（必须，累计不超过2000）
 * @returns {Promise<Object>} - 返回打印结果
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
 * 商品打印条码主函数
 * @param {Object} params - 调用参数
 * @returns {Promise<Object>} - 返回结果
 */
async function printBarcode(params) {
  const { shopId, data } = params;
  
  const result = {
    success: false,
    url: null,
    codingInfoList: [],
    errorData: [],
    message: '',
    traceId: null
  };

  try {
    // 参数校验
    if (!shopId) {
      result.message = '缺少必要参数: shopId';
      return result;
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      result.message = '缺少必要参数: data（打印数据数组）';
      return result;
    }

    // 校验打印数量限制
    const totalPrintNumber = data.reduce((sum, item) => sum + (item.printNumber || 0), 0);
    if (totalPrintNumber > 2000) {
      result.message = '打印总数量不能超过2000份';
      return result;
    }

    // 校验每条数据
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      if (!item.sheinSku && !item.supplierSku) {
        result.message = `第${i + 1}条数据缺少sheinSku或supplierSku`;
        return result;
      }
      if (!item.printNumber || item.printNumber < 1) {
        result.message = `第${i + 1}条数据的printNumber必须大于等于1`;
        return result;
      }
    }

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
    
    if (!shop.open_key_id || !shop.secret_key) {
      result.message = '店铺授权信息不完整，请重新授权';
      return result;
    }

    const apiDomain = shop.api_domain || 'https://openapi.sheincorp.com';
    const apiPath = '/open-api/goods/print-barcode';

    // 生成签名
    const timestamp = Date.now().toString();
    const randomKey = generateRandomKey();
    const signature = generateSignature(shop.open_key_id, shop.secret_key, apiPath, timestamp, randomKey);

    // 构建请求体
    const requestBody = {
      type: 2, // 普通订单条码（平台建议）
      printContentType: 1, // 打印商家货号
      printFormatType: 1, // 打印20*70
      data: data.map(item => ({
        orderNo: item.orderNo || null,
        supplierSku: item.supplierSku || null,
        sheinSku: item.sheinSku,
        printNumber: item.printNumber
      }))
    };

    console.log(`[打印条码] 请求: ${apiDomain}${apiPath}`);
    console.log(`[打印条码] 数据条数: ${data.length}, 总打印份数: ${totalPrintNumber}`);

    // 调用API
    const response = await axios.post(`${apiDomain}${apiPath}`, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'x-lt-openKeyId': shop.open_key_id,
        'x-lt-timestamp': timestamp,
        'x-lt-signature': signature,
        'x-lt-language': 'CN'
      },
      timeout: 30000
    });

    console.log(`[打印条码] 响应code: ${response.data.code}, msg: ${response.data.msg}`);

    // 处理响应
    if (response.data.code === '0') {
      const info = response.data.info || {};
      
      result.success = true;
      result.url = info.url || null;
      result.codingInfoList = info.codingInfoList || [];
      result.errorData = info.errorData || [];
      result.traceId = response.data.traceId || info.traceId;
      
      if (result.errorData && result.errorData.length > 0) {
        result.message = `部分条码打印失败，成功${result.codingInfoList.length}条，失败${result.errorData.length}条`;
      } else {
        result.message = '条码打印成功';
      }
    } else {
      result.success = false;
      result.message = response.data.msg || `API错误: ${response.data.code}`;
      result.traceId = response.data.traceId;
    }

  } catch (error) {
    console.error('[打印条码] 错误:', error.message);
    
    if (error.response) {
      result.message = `API请求失败: ${error.response.status} - ${error.response.data?.msg || error.message}`;
    } else if (error.code === 'ECONNABORTED') {
      result.message = '请求超时，请稍后重试';
    } else {
      result.message = `打印条码失败: ${error.message}`;
    }
  }

  return result;
}

module.exports = { printBarcode };
