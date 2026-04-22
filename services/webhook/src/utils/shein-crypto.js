/**
 * SHEIN平台加密解密工具
 * 严格按照官方Java示例 EventCallbackDemo.java 转换为Node.js版本
 */

const crypto = require('crypto');

// 常量定义（与Java代码保持一致）
const HMAC_SHA256 = 'sha256';
const AND = '&';
const RANDOM_LENGTH = 5;
const UTF_8 = 'utf-8';
const DEFAULT_IV_SEED = 'space-station-default-iv';
const IV_LENGTH = 16;

/**
 * HMAC-SHA256签名
 * 对应Java: ApiSignUtil.hmacSha256()
 */
function hmacSha256(message, secret) {
  try {
    const hmac = crypto.createHmac(HMAC_SHA256, Buffer.from(secret, UTF_8));
    hmac.update(message);
    const bytes = hmac.digest();
    return byteArrayToHexString(bytes);
  } catch (error) {
    console.error('[SHEIN加密] HMAC-SHA256错误:', error.message);
    return '';
  }
}

/**
 * 字节数组转十六进制字符串
 * 对应Java: ApiSignUtil.byteArrayToHexString()
 */
function byteArrayToHexString(buffer) {
  let hs = '';
  for (let n = 0; n < buffer.length; n++) {
    let tmp = (buffer[n] & 0xFF).toString(16);
    if (tmp.length === 1) {
      hs += '0';
    }
    hs += tmp;
  }
  return hs.toLowerCase();
}

/**
 * Base64编码
 * 对应Java: ApiSignUtil.base64Encode()
 */
function base64Encode(data) {
  if (!data || data.length === 0) {
    return '';
  }
  return Buffer.from(data, UTF_8).toString('base64');
}

/**
 * 生成签名
 * 对应Java: ApiSignUtil.signature()
 * 
 * 步骤：
 * 1. VALUE = openKeyId + "&" + timestamp + "&" + path
 * 2. KEY = secretKey + randomKey
 * 3. HexString = HMAC-SHA256(VALUE, KEY).toHexString()
 * 4. Base64String = Base64Encode(HexString)  // 注意：是对十六进制字符串编码，不是字节数组
 * 5. Signature = randomKey + Base64String
 */
function signature(apiKey, timestamp, requestPath, secret, randomKey) {
  // 步骤一：组装签名数据VALUE
  const value = apiKey + AND + timestamp + AND + requestPath;
  
  // 步骤二：组装签名密钥KEY
  const key = secret + randomKey;
  
  // 步骤三：HMAC-SHA256计算并转换为十六进制
  const hexSignature = hmacSha256(value, key);
  
  // 步骤四：Base64编码（注意：是对十六进制字符串进行Base64编码，不是对字节数组）
  const base64Signature = base64Encode(hexSignature);
  
  // 返回Base64编码后的结果（不包含randomKey前缀）
  return base64Signature;
}

/**
 * 创建完整签名（包含随机前缀）
 * 对应Java: ApiSignUtil.createSignature()
 * 
 * 步骤五：拼接RandomKey
 * Signature = randomKey + Base64String
 */
function createSignature(loginName, timestamp, requestPath, secret, randomKey) {
  const base64Signature = signature(loginName, timestamp, requestPath, secret, randomKey);
  const finalSignature = randomKey + base64Signature;
  return finalSignature;
}

/**
 * 验证签名
 * 对应Java: ApiSignUtil.verifySign()
 * 
 * @param {string} receivedSignature - 收到的签名 (x-lt-signature)
 * @param {string} openKey - appid或openKeyId
 * @param {string} secretKey - 密钥 (appSecretKey)
 * @param {string} requestPath - 请求路径 (requestURI)
 * @param {string} timestamp - 时间戳 (x-lt-timestamp)
 * @returns {boolean}
 */
function verifySign(receivedSignature, openKey, secretKey, requestPath, timestamp) {
  if (!receivedSignature || receivedSignature.length < RANDOM_LENGTH) {
    console.log('[验签] 签名为空或长度不足');
    return false;
  }
  
  // 从签名中提取前5位随机字符
  const randomKey = receivedSignature.substring(0, RANDOM_LENGTH);
  // 使用相同的randomKey重新计算签名
  const expectedSignature = createSignature(openKey, timestamp, requestPath, secretKey, randomKey);
  
  // 调试日志
  console.log('[验签] 验证参数:');
  console.log('[验签]   openKey:', openKey);
  console.log('[验签]   timestamp:', timestamp);
  console.log('[验签]   requestPath:', requestPath);
  console.log('[验签]   randomKey:', randomKey);
  console.log('[验签]   收到签名:', receivedSignature);
  console.log('[验签]   计算签名:', expectedSignature);
  
  return receivedSignature === expectedSignature;
}

/**
 * AES解密
 * 对应Java: AESTools.decrypt(content, key, iv)
 * 
 * @param {string} content - Base64编码的加密数据
 * @param {string} key - 密钥
 * @param {string} ivSeed - IV种子，默认为 'space-station-default-iv'
 * @returns {string|null}
 */
function aesDecrypt(content, key, ivSeed = DEFAULT_IV_SEED) {
  if (!content || content.length === 0 || !key || key.length === 0) {
    console.error('[AES解密] 密文和密钥不能为空');
    return null;
  }
  
  try {
    // 取IV前16字节
    const ivSeedBytes = Buffer.from(ivSeed, UTF_8);
    const ivBytes = Buffer.alloc(IV_LENGTH);
    ivSeedBytes.copy(ivBytes, 0, 0, IV_LENGTH);
    
    // 取密钥前16字节（对应Java: Arrays.copyOf(key.getBytes(UTF_8), 16)）
    const keyBytes = Buffer.alloc(16);
    Buffer.from(key, UTF_8).copy(keyBytes, 0, 0, 16);
    
    // Base64解码
    const encryptedBuffer = Buffer.from(content, 'base64');
    
    // 创建解密器 (AES/CBC/PKCS5Padding)
    const decipher = crypto.createDecipheriv('aes-128-cbc', keyBytes, ivBytes);
    decipher.setAutoPadding(true);
    
    // 解密
    let decrypted = decipher.update(encryptedBuffer);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    const result = decrypted.toString(UTF_8);
    return result;
  } catch (error) {
    console.error('[SHEIN加密] AES解密失败:', error.message);
    return null;
  }
}

/**
 * AES加密（用于测试）
 * 对应Java: AESTools.encrypt(content, key, ivSeed)
 */
function aesEncrypt(content, key, ivSeed = DEFAULT_IV_SEED) {
  if (!content || !key || !ivSeed) {
    console.error('[AES加密] 加密内容/密钥/iv不能为空');
    return null;
  }
  
  try {
    // 取IV前16字节
    const ivSeedBytes = Buffer.from(ivSeed, UTF_8);
    const ivBytes = Buffer.alloc(IV_LENGTH);
    ivSeedBytes.copy(ivBytes, 0, 0, IV_LENGTH);
    
    // 取密钥前16字节
    const keyBytes = Buffer.alloc(16);
    Buffer.from(key, UTF_8).copy(keyBytes, 0, 0, 16);
    
    // 创建加密器
    const cipher = crypto.createCipheriv('aes-128-cbc', keyBytes, ivBytes);
    cipher.setAutoPadding(true);
    
    // 加密
    let encrypted = cipher.update(content, UTF_8);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    // Base64编码返回
    return encrypted.toString('base64');
  } catch (error) {
    console.error('[SHEIN加密] AES加密失败:', error.message);
    return null;
  }
}

/**
 * 验证HTTP请求签名
 * 对应Java: EventCallbackDemo.verifySignForHttp()
 * 
 * @param {object} headers - 请求头对象
 * @param {string} secretKey - 密钥
 * @param {string} requestPath - 请求路径
 * @returns {boolean}
 */
function verifySignForHttp(headers, secretKey, requestPath) {
  // 获取请求头（express会将header名转为小写）
  // 优先使用appid，否则使用openKeyId
  let openKey = headers['x-lt-appid'];
  if (!openKey) {
    openKey = headers['x-lt-openkeyid'];
  }
  
  const timestamp = headers['x-lt-timestamp'];
  const signature = headers['x-lt-signature'];
  
  if (!openKey || !timestamp || !signature) {
    console.log('[验签] 缺少必要的请求头');
    return false;
  }
  
  return verifySign(signature, openKey, secretKey, requestPath, timestamp);
}

module.exports = {
  hmacSha256,
  byteArrayToHexString,
  base64Encode,
  signature,
  createSignature,
  verifySign,
  verifySignForHttp,
  aesDecrypt,
  aesEncrypt,
  RANDOM_LENGTH,
  DEFAULT_IV_SEED
};
