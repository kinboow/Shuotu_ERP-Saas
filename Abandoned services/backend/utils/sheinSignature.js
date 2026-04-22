const crypto = require('crypto');

class SheinSignature {
  /**
   * 生成HMAC-SHA256签名
   * @param {string} message - 待签名的消息
   * @param {string} secret - 密钥
   * @returns {string} 十六进制格式的哈希字符串
   */
  static hmacSha256(message, secret) {
    return crypto.createHmac('sha256', secret)
                 .update(message, 'utf8')
                 .digest('hex');
  }

  /**
   * Base64编码
   * @param {string} data - 待编码的字符串
   * @returns {string} Base64编码结果
   */
  static base64Encode(data) {
    return Buffer.from(data, 'utf8').toString('base64');
  }

  /**
   * 生成随机字符串
   * @param {number} length - 长度
   * @returns {string} 随机字符串
   */
  static generateRandomString(length = 5) {
    return crypto.randomBytes(16).toString('hex').substring(0, length);
  }

  /**
   * 生成SHEIN API签名
   * @param {string} appid - 应用ID
   * @param {string} appSecret - 应用密钥
   * @param {string} apiPath - API路径
   * @param {string} timestamp - 时间戳
   * @returns {object} 包含signature和timestamp的对象
   */
  static generateSignature(appid, appSecret, apiPath, timestamp = null) {
    if (!timestamp) {
      timestamp = String(Date.now());
    }

    // 构建签名字符串: appid&timestamp&apiPath
    const signString = `${appid}&${timestamp}&${apiPath}`;

    // 生成5位随机字符串
    const randomKey = this.generateRandomString(5);

    // 拼接密钥: appSecret + randomKey
    const randomSecretKey = appSecret + randomKey;

    // 计算HMAC-SHA256
    const hashValue = this.hmacSha256(signString, randomSecretKey);

    // Base64编码
    const base64Value = this.base64Encode(hashValue);

    // 最终签名: randomKey + base64Value
    const signature = randomKey + base64Value;

    return {
      signature,
      timestamp,
      randomKey
    };
  }

  /**
   * 生成授权请求的签名头
   * @param {string} appid - 应用ID
   * @param {string} appSecret - 应用密钥
   * @param {string} apiPath - API路径
   * @returns {object} 请求头对象
   */
  static generateAuthHeaders(appid, appSecret, apiPath) {
    // 清理参数中的空白字符
    appid = String(appid || '').trim();
    appSecret = String(appSecret || '').trim();
    apiPath = String(apiPath || '').trim();
    
    const { signature, timestamp } = this.generateSignature(appid, appSecret, apiPath);

    return {
      'Content-Type': 'application/json;charset=UTF-8',
      'x-lt-appid': appid,
      'x-lt-timestamp': timestamp,
      'x-lt-signature': signature
    };
  }

  /**
   * 生成API调用的签名头
   * @param {string} openKeyId - 店铺授权ID
   * @param {string} secretKey - 店铺密钥
   * @param {string} apiPath - API路径
   * @returns {object} 请求头对象
   */
  static generateApiHeaders(openKeyId, secretKey, apiPath) {
    // 清理参数中的空白字符
    openKeyId = String(openKeyId || '').trim();
    secretKey = String(secretKey || '').trim();
    apiPath = String(apiPath || '').trim();
    
    const { signature, timestamp } = this.generateSignature(openKeyId, secretKey, apiPath);

    return {
      'Content-Type': 'application/json',
      'x-lt-openKeyId': openKeyId,
      'x-lt-timestamp': timestamp,
      'x-lt-signature': signature
    };
  }
}

module.exports = SheinSignature;
