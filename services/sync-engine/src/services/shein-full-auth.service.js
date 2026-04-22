/**
 * SHEIN(full)授权服务 - 全托管模式
 * 处理SHEIN平台的OAuth授权流程
 * 基于官方文档: https://open.sheincorp.com
 */
const crypto = require('crypto');
const axios = require('axios');

// 环境配置
const ENV_CONFIG = {
  // 正式环境 - 全托管/代运营
  production: {
    authHost: 'openapi-sem.sheincorp.com',
    apiHost: 'https://openapi.sheincorp.cn'
  },
  // 测试环境
  test: {
    authHost: 'openapi-sem-test01.dotfashion.cn',
    apiHost: 'https://openapi-test01.sheincorp.cn'
  }
};

class SheinFullAuthService {
  
  /**
   * 生成授权URL
   * 用户点击此URL后会跳转到SHEIN授权页面
   * @param {string} appId - 应用ID (开发者门户获取)
   * @param {string} redirectUrl - 回调地址 (授权成功后跳转)
   * @param {string} state - 自定义状态参数 (原样返回，用于识别授权来源)
   * @param {boolean} isTest - 是否测试环境
   * @returns {string} 授权URL
   */
  static generateAuthUrl(appId, redirectUrl, state, isTest = false) {
    if (!appId) throw new Error('appId不能为空');
    if (!redirectUrl) throw new Error('redirectUrl不能为空');
    if (!state) throw new Error('state不能为空');

    const env = isTest ? ENV_CONFIG.test : ENV_CONFIG.production;
    // redirectUrl需要Base64编码
    const encodedRedirectUrl = Buffer.from(redirectUrl, 'utf8').toString('base64');
    
    const authUrl = `https://${env.authHost}/#/empower?appid=${appId}&redirectUrl=${encodedRedirectUrl}&state=${state}`;
    
    console.log('[SheinFullAuth] 生成授权URL:', {
      appId,
      redirectUrl,
      state,
      isTest,
      authUrl
    });
    
    return authUrl;
  }

  /**
   * HMAC-SHA256签名
   */
  static _hmacSha256(message, secret) {
    return crypto.createHmac('sha256', secret)
      .update(message, 'utf8')
      .digest('hex');
  }

  /**
   * 生成APP级别签名 (用于获取店铺密钥)
   * 签名规则: randomKey + Base64(HMAC-SHA256(appId&timestamp&path, appSecret+randomKey))
   */
  static _generateAppSignature(appId, appSecret, apiPath) {
    const timestamp = String(Date.now());
    // 步骤1: 组装签名数据 VALUE = appId + "&" + timestamp + "&" + path
    const signString = `${appId}&${timestamp}&${apiPath}`;
    // 生成5位随机字符串
    const randomKey = crypto.randomBytes(16).toString('hex').substring(0, 5);
    // 步骤2: 组装签名密钥 KEY = appSecret + randomKey
    const randomSecretKey = appSecret + randomKey;
    // 步骤3: HMAC-SHA256加密并转十六进制
    const hashValue = this._hmacSha256(signString, randomSecretKey);
    // 步骤4: Base64编码
    const base64Value = Buffer.from(hashValue, 'utf8').toString('base64');
    // 步骤5: 拼接RandomKey
    const signature = randomKey + base64Value;

    return { signature, timestamp, randomKey };
  }

  /**
   * 通过tempToken获取店铺密钥
   * 用户授权后，平台会重定向到回调地址并带上tempToken
   * @param {string} tempToken - 授权回调返回的临时Token (10分钟有效)
   * @param {string} appId - 应用ID
   * @param {string} appSecret - 应用密钥
   * @param {boolean} isTest - 是否测试环境
   * @returns {Object} { openKeyId, secretKey, appId }
   */
  static async getTokenByTemp(tempToken, appId, appSecret, isTest = false) {
    if (!tempToken) throw new Error('tempToken不能为空');
    if (!appId) throw new Error('appId不能为空');
    if (!appSecret) throw new Error('appSecret不能为空');

    const apiPath = '/open-api/auth/get-by-token';
    const { signature, timestamp } = this._generateAppSignature(appId, appSecret, apiPath);
    const env = isTest ? ENV_CONFIG.test : ENV_CONFIG.production;
    const url = `${env.apiHost}${apiPath}`;

    console.log('[SheinFullAuth] 获取店铺密钥:', {
      url,
      appId,
      tempToken: tempToken.substring(0, 10) + '...',
      isTest
    });

    try {
      const response = await axios.post(
        url,
        { tempToken },
        {
          headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            'x-lt-appid': appId,
            'x-lt-timestamp': timestamp,
            'x-lt-signature': signature
          },
          timeout: 30000
        }
      );

      console.log('[SheinFullAuth] API响应:', {
        code: response.data.code,
        msg: response.data.msg
      });

      if (response.data.code === '0' || response.data.code === 0) {
        const { openKeyId, secretKey } = response.data.info;
        
        if (!openKeyId || !secretKey) {
          throw new Error('返回数据缺少openKeyId或secretKey');
        }

        // 解密secretKey
        const decryptedSecretKey = this.decryptSecretKey(secretKey, appSecret);
        
        console.log('[SheinFullAuth] 授权成功:', {
          openKeyId,
          secretKeyLength: decryptedSecretKey.length
        });

        return {
          openKeyId,
          secretKey: decryptedSecretKey,
          secretKeyEncrypted: secretKey, // 保留加密版本用于存储
          appId,
          rawResponse: response.data.info
        };
      } else {
        throw new Error(response.data.msg || `获取授权信息失败 [${response.data.code}]`);
      }
    } catch (error) {
      if (error.response) {
        console.error('[SheinFullAuth] API错误:', error.response.data);
        throw new Error(`SHEIN授权请求失败: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * 解密secretKey
   * 使用AES-128-CBC解密，IV固定为"space-station-de"
   * @param {string} encryptedSecretKey - Base64编码的加密secretKey
   * @param {string} appSecret - 应用密钥 (取前16位作为AES密钥)
   */
  static decryptSecretKey(encryptedSecretKey, appSecret) {
    try {
      const algorithm = 'aes-128-cbc';
      // 密钥取appSecret前16位
      const key = Buffer.from(appSecret.substring(0, 16), 'utf8');
      // IV固定为"space-station-de"
      const iv = Buffer.from('space-station-de', 'utf8');
      
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encryptedSecretKey, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('[SheinFullAuth] 解密失败:', error.message);
      throw new Error(`解密secretKey失败: ${error.message}`);
    }
  }

  /**
   * 加密secretKey (用于安全存储)
   */
  static encryptSecretKey(secretKey, appSecret) {
    try {
      const algorithm = 'aes-128-cbc';
      const key = Buffer.from(appSecret.substring(0, 16), 'utf8');
      const iv = Buffer.from('space-station-de', 'utf8');
      
      const cipher = crypto.createCipheriv(algorithm, key, iv);
      let encrypted = cipher.update(secretKey, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      return encrypted;
    } catch (error) {
      throw new Error(`加密secretKey失败: ${error.message}`);
    }
  }

  /**
   * 验证店铺授权是否有效
   * 通过调用分类接口测试
   */
  static async verifyAuth(openKeyId, secretKey, isTest = false) {
    const SheinFullAdapter = require('../adapters/shein-full.adapter');
    const adapter = new SheinFullAdapter({
      openKeyId,
      secretKey,
      appType: isTest ? 'test' : 'full-managed'
    });

    try {
      await adapter.getCategoryTree();
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * 获取环境配置
   */
  static getEnvConfig(isTest = false) {
    return isTest ? ENV_CONFIG.test : ENV_CONFIG.production;
  }
}

module.exports = SheinFullAuthService;
