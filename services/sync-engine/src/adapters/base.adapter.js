/**
 * 平台适配器基类
 * 所有平台适配器必须继承此类并实现相应方法
 */

class BaseAdapter {
  constructor(config) {
    this.platform = '';           // 平台标识，子类必须设置
    this.config = config || {};   // 平台配置（密钥、店铺ID等）
    this.shopId = config?.shopId || '';
  }

  // ==================== 认证相关 ====================
  
  /**
   * 平台认证/获取Token
   */
  async authenticate() {
    throw new Error(`${this.platform}: authenticate() 未实现`);
  }

  /**
   * 刷新Token
   */
  async refreshToken() {
    throw new Error(`${this.platform}: refreshToken() 未实现`);
  }

  // ==================== 订单相关 ====================

  /**
   * 拉取订单列表
   * @param {Object} params - { startTime, endTime, status, page, pageSize }
   * @returns {Object} - { list: UnifiedOrder[], total, hasMore }
   */
  async pullOrders(params) {
    throw new Error(`${this.platform}: pullOrders() 未实现`);
  }

  /**
   * 获取订单详情
   * @param {string} orderId - 平台订单ID
   * @returns {UnifiedOrder}
   */
  async getOrderDetail(orderId) {
    throw new Error(`${this.platform}: getOrderDetail() 未实现`);
  }

  /**
   * 订单发货
   * @param {string} orderId - 平台订单ID
   * @param {Object} logistics - { company, companyCode, trackingNo }
   */
  async shipOrder(orderId, logistics) {
    throw new Error(`${this.platform}: shipOrder() 未实现`);
  }

  /**
   * 取消订单
   * @param {string} orderId - 平台订单ID
   * @param {string} reason - 取消原因
   */
  async cancelOrder(orderId, reason) {
    throw new Error(`${this.platform}: cancelOrder() 未实现`);
  }

  // ==================== 商品相关 ====================

  /**
   * 拉取商品列表
   * @param {Object} params - { page, pageSize, status }
   * @returns {Object} - { list: UnifiedProduct[], total, hasMore }
   */
  async pullProducts(params) {
    throw new Error(`${this.platform}: pullProducts() 未实现`);
  }

  /**
   * 获取商品详情
   * @param {string} productId - 平台商品ID
   * @returns {UnifiedProduct}
   */
  async getProductDetail(productId) {
    throw new Error(`${this.platform}: getProductDetail() 未实现`);
  }

  /**
   * 更新商品信息
   * @param {string} productId - 平台商品ID
   * @param {Object} data - 更新数据
   */
  async updateProduct(productId, data) {
    throw new Error(`${this.platform}: updateProduct() 未实现`);
  }

  // ==================== 库存相关 ====================

  /**
   * 同步库存到平台
   * @param {Array} skuList - [{ platformSkuId, quantity }]
   */
  async syncInventory(skuList) {
    throw new Error(`${this.platform}: syncInventory() 未实现`);
  }

  /**
   * 获取平台库存
   * @param {Array} skuIds - 平台SKU ID列表
   */
  async getInventory(skuIds) {
    throw new Error(`${this.platform}: getInventory() 未实现`);
  }

  // ==================== 数据转换 ====================

  /**
   * 平台订单 → 统一订单格式
   * @param {Object} rawOrder - 平台原始订单数据
   * @returns {Object} - 统一订单格式
   */
  transformOrder(rawOrder) {
    throw new Error(`${this.platform}: transformOrder() 未实现`);
  }

  /**
   * 平台商品 → 统一商品格式
   * @param {Object} rawProduct - 平台原始商品数据
   * @returns {Object} - 统一商品格式
   */
  transformProduct(rawProduct) {
    throw new Error(`${this.platform}: transformProduct() 未实现`);
  }

  /**
   * 统一订单 → 平台订单格式（用于发货等操作）
   * @param {Object} unifiedOrder - 统一订单
   * @returns {Object} - 平台格式
   */
  reverseTransformOrder(unifiedOrder) {
    throw new Error(`${this.platform}: reverseTransformOrder() 未实现`);
  }

  // ==================== Webhook相关 ====================

  /**
   * 验证Webhook签名
   * @param {Object} headers - 请求头
   * @param {Object|string} body - 请求体
   * @returns {boolean}
   */
  verifyWebhook(headers, body) {
    throw new Error(`${this.platform}: verifyWebhook() 未实现`);
  }

  /**
   * 解析Webhook数据
   * @param {string} eventType - 事件类型
   * @param {Object} payload - 事件数据
   * @returns {Object} - { type, data }
   */
  parseWebhook(eventType, payload) {
    throw new Error(`${this.platform}: parseWebhook() 未实现`);
  }

  // ==================== 通用方法 ====================

  /**
   * 发送HTTP请求（子类实现具体的签名、headers等）
   */
  async request(method, path, data, options = {}) {
    throw new Error(`${this.platform}: request() 未实现`);
  }

  /**
   * 格式化时间为平台要求的格式
   */
  formatTime(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().replace('T', ' ').slice(0, 19);
  }

  /**
   * 获取适配器信息
   */
  getInfo() {
    return {
      platform: this.platform,
      shopId: this.shopId,
      configured: !!this.config.appKey || !!this.config.clientId
    };
  }
}

module.exports = BaseAdapter;
