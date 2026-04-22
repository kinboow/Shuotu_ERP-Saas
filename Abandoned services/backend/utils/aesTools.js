const crypto = require('crypto');

class AESTools {
  static UTF_8 = 'utf-8';
  static KEY_ALGORITHM = 'AES';
  static BLOCK_LENGTH_BITS = 128;
  static KEY_LENGTH_BYTES = 16;
  static IV_LENGTH_BYTES = 16;
  static DEFAULT_CIPHER_ALGORITHM = 'aes-128-cbc';
  static DEFAULT_IV_SEED = 'space-station-de';

  /**
   * 从字符串密钥派生出16字节的 Buffer 密钥
   */
  static getSecretKey(key) {
    const keyBuf = Buffer.from(key, this.UTF_8);
    const result = Buffer.alloc(this.KEY_LENGTH_BYTES);
    keyBuf.copy(result, 0, 0, Math.min(keyBuf.length, this.KEY_LENGTH_BYTES));
    return result;
  }

  /**
   * 从字符串种子派生出16字节的 Buffer IV
   */
  static getIV(ivSeed) {
    if (!ivSeed) {
      throw new Error('ivSeed 不能为空');
    }
    const ivBuf = Buffer.from(ivSeed, this.UTF_8);
    if (ivBuf.length < this.IV_LENGTH_BYTES) {
      throw new Error(`iv长度不能低于 ${this.IV_LENGTH_BYTES} byte`);
    }
    return ivBuf.slice(0, this.IV_LENGTH_BYTES);
  }

  /**
   * AES 加密
   * @param {string} content - 明文
   * @param {string} key - 密钥
   * @param {string} ivSeed - IV种子
   * @returns {string} Base64编码的密文
   */
  static encrypt(content, key, ivSeed = this.DEFAULT_IV_SEED) {
    if (!content || !key) {
      throw new Error('加密内容和密钥不能为空');
    }

    try {
      const keyBytes = this.getSecretKey(key);
      const ivBytes = this.getIV(ivSeed);
      
      const cipher = crypto.createCipheriv(this.DEFAULT_CIPHER_ALGORITHM, keyBytes, ivBytes);
      
      let encrypted = cipher.update(content, this.UTF_8, 'base64');
      encrypted += cipher.final('base64');
      
      return encrypted;
    } catch (ex) {
      console.error('AES加密失败:', ex);
      throw ex;
    }
  }

  /**
   * AES 解密
   * @param {string} content - Base64编码的密文
   * @param {string} key - 密钥
   * @param {string} ivSeed - IV种子
   * @returns {string} 解密后的明文
   */
  static decrypt(content, key, ivSeed = this.DEFAULT_IV_SEED) {
    if (!content || !key) {
      throw new Error('密文和密钥不能为空');
    }

    try {
      const keyBytes = this.getSecretKey(key);
      const ivBytes = this.getIV(ivSeed);
      
      const decipher = crypto.createDecipheriv(this.DEFAULT_CIPHER_ALGORITHM, keyBytes, ivBytes);
      
      let decrypted = decipher.update(content, 'base64', this.UTF_8);
      decrypted += decipher.final(this.UTF_8);
      
      return decrypted;
    } catch (ex) {
      console.error('AES解密失败:', ex);
      throw ex;
    }
  }
}

module.exports = AESTools;
