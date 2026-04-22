/**
 * TEMU平台适配器
 */

const BaseAdapter = require('./base.adapter');
const axios = require('axios');
const crypto = require('crypto');

class TemuAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.platform = 'temu';
    this.baseUrl = config.baseUrl || 'https://openapi.temu.com';
    this.appKey = config.appKey || '';
    this.appSecret = config.appSecret || '';
    this.accessToken = config.accessToken || '';
    this.refreshTokenValue = config.refreshToken || '';
    this.tokenExpiry = null;
  }

  // ==================== 签名工具 ====================

  _generateSign(params, secret) {
    // 按key排序
    const sortedKeys = Object.keys(params).sort();
    const signStr = sortedKeys.map(key => `${key}${params[key]}`).join('');
    const signData = secret + signStr + secret;
    return crypto.createHash('md5').update(signData).digest('hex').toUpperCase();
  }

  _getCommonParams() {
    return {
      app_key: this.appKey,
      timestamp: Math.floor(Date.now() / 1000),
      access_token: this.accessToken
    };
  }

  // ==================== HTTP请求 ====================

  async request(method, path, data = {}) {
    await this.refreshToken();

    const commonParams = this._getCommonParams();
    const allParams = { ...commonParams, ...data };
    allParams.sign = this._generateSign(allParams, this.appSecret);

    const url = `${this.baseUrl}${path}`;

    try {
      const response = await axios({
        method,
        url,
        params: method === 'GET' ? allParams : commonParams,
        data: method !== 'GET' ? data : undefined,
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (!response.data.success) {
        throw new Error(`TEMU API错误: [${response.data.error_code}] ${response.data.error_msg}`);
      }

      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`TEMU请求失败: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  // ==================== 认证 ====================

  async authenticate() {
    if (!this.appKey || !this.appSecret) {
      throw new Error('TEMU配置缺失: appKey或appSecret');
    }

    // 如果有refreshToken，尝试刷新
    if (this.refreshTokenValue) {
      await this.refreshToken();
      return true;
    }

    // 否则需要OAuth授权流程
    throw new Error('TEMU需要OAuth授权，请先获取accessToken');
  }

  async refreshToken() {
    // 检查Token是否过期
    if (this.tokenExpiry && Date.now() < this.tokenExpiry - 60000) {
      return true;
    }

    if (!this.refreshTokenValue) {
      return false;
    }

    try {
      const response = await axios.post(`${this.baseUrl}/api/token/refresh`, {
        app_key: this.appKey,
        app_secret: this.appSecret,
        refresh_token: this.refreshTokenValue
      });

      if (response.data.success) {
        this.accessToken = response.data.result.access_token;
        this.refreshTokenValue = response.data.result.refresh_token;
        this.tokenExpiry = Date.now() + (response.data.result.expires_in * 1000);
        return true;
      }
    } catch (error) {
      console.error('TEMU Token刷新失败:', error.message);
    }

    return false;
  }

  // ==================== 订单相关 ====================

  async pullOrders(params) {
    const { startTime, endTime, status, page = 1, pageSize = 50 } = params;

    const requestBody = {
      page_no: page,
      page_size: pageSize
    };

    if (startTime) requestBody.create_time_start = Math.floor(new Date(startTime).getTime() / 1000);
    if (endTime) requestBody.create_time_end = Math.floor(new Date(endTime).getTime() / 1000);
    if (status) requestBody.order_status = status;

    const result = await this.request('POST', '/api/order/list', requestBody);

    const list = (result.result?.orders || []).map(o => this.transformOrder(o));

    return {
      list,
      total: result.result?.total || 0,
      hasMore: list.length === pageSize
    };
  }

  async getOrderDetail(orderId) {
    const result = await this.request('POST', '/api/order/detail', {
      order_sn: orderId
    });
    return this.transformOrder(result.result);
  }

  async shipOrder(orderId, logistics) {
    return await this.request('POST', '/api/order/ship', {
      order_sn: orderId,
      tracking_company: logistics.company,
      tracking_number: logistics.trackingNo
    });
  }

  async cancelOrder(orderId, reason) {
    return await this.request('POST', '/api/order/cancel', {
      order_sn: orderId,
      cancel_reason: reason
    });
  }

  // ==================== 商品相关 ====================

  async pullProducts(params) {
    const { page = 1, pageSize = 50 } = params;

    const result = await this.request('POST', '/api/product/list', {
      page_no: page,
      page_size: pageSize
    });

    const list = (result.result?.products || []).map(p => this.transformProduct(p));

    return {
      list,
      total: result.result?.total || 0,
      hasMore: list.length === pageSize
    };
  }

  async getProductDetail(productId) {
    const result = await this.request('POST', '/api/product/detail', {
      product_id: productId
    });
    return this.transformProduct(result.result);
  }

  async updateProduct(productId, data) {
    return await this.request('POST', '/api/product/update', {
      product_id: productId,
      ...data
    });
  }

  // ==================== 库存相关 ====================

  async syncInventory(skuList) {
    const inventoryList = skuList.map(item => ({
      sku_id: item.platformSkuId,
      stock: item.quantity
    }));

    return await this.request('POST', '/api/inventory/update', {
      inventory_list: inventoryList
    });
  }

  async getInventory(skuIds) {
    const result = await this.request('POST', '/api/inventory/query', {
      sku_ids: skuIds
    });
    return result.result?.list || [];
  }

  // ==================== 数据转换 ====================

  transformOrder(raw) {
    if (!raw) return null;

    return {
      platform: 'temu',
      platformOrderId: raw.order_sn || '',
      shopId: raw.shop_id || this.shopId,

      status: this._mapOrderStatus(raw.order_status),
      platformStatus: String(raw.order_status || ''),

      orderTime: raw.create_time ? new Date(raw.create_time * 1000) : null,
      payTime: raw.pay_time ? new Date(raw.pay_time * 1000) : null,
      shipTime: raw.ship_time ? new Date(raw.ship_time * 1000) : null,
      deliverTime: raw.receive_time ? new Date(raw.receive_time * 1000) : null,

      currency: raw.currency || 'USD',
      totalAmount: parseFloat(raw.total_amount) || 0,
      productAmount: parseFloat(raw.product_amount) || 0,
      shippingFee: parseFloat(raw.shipping_fee) || 0,
      discount: parseFloat(raw.discount_amount) || 0,
      tax: parseFloat(raw.tax_amount) || 0,

      shipping: {
        name: raw.receiver_name || '',
        phone: raw.receiver_phone || '',
        email: raw.receiver_email || '',
        country: raw.receiver_country || '',
        countryCode: raw.receiver_country_code || '',
        province: raw.receiver_state || '',
        city: raw.receiver_city || '',
        district: raw.receiver_district || '',
        address: raw.receiver_address || '',
        address2: raw.receiver_address2 || '',
        zipCode: raw.receiver_zip || ''
      },

      logistics: {
        company: raw.tracking_company || '',
        companyCode: raw.tracking_company_code || '',
        trackingNo: raw.tracking_number || '',
        shippingMethod: raw.shipping_method || ''
      },

      items: (raw.order_items || []).map(item => ({
        platformItemId: item.order_item_id || '',
        platformSkuId: item.sku_id || '',
        platformProductId: item.product_id || '',
        internalSkuId: '',
        productName: item.product_name || '',
        productImage: item.product_image || '',
        quantity: parseInt(item.quantity) || 0,
        price: parseFloat(item.price) || 0,
        totalPrice: parseFloat(item.total_price) || 0,
        attributes: item.sku_attrs || {},
        weight: parseFloat(item.weight) || 0,
        barcode: item.barcode || ''
      })),

      buyerNote: raw.buyer_note || '',
      sellerNote: raw.seller_note || '',

      rawData: raw,
      syncedAt: new Date()
    };
  }

  transformProduct(raw) {
    if (!raw) return null;

    return {
      platform: 'temu',
      platformProductId: raw.product_id || '',
      platformSkuId: raw.sku_id || '',
      shopId: this.shopId,

      productName: raw.product_name || '',
      productNameEn: raw.product_name_en || '',
      description: raw.description || '',
      category: raw.category_name || '',
      categoryId: raw.category_id || '',
      brand: raw.brand || '',

      skuCode: raw.sku_code || '',
      barcode: raw.barcode || '',
      supplierSkuCode: raw.outer_sku_id || '',

      attributes: raw.sku_attrs || {},

      currency: raw.currency || 'USD',
      costPrice: parseFloat(raw.cost_price) || 0,
      retailPrice: parseFloat(raw.retail_price) || 0,
      salePrice: parseFloat(raw.sale_price) || 0,

      weight: parseFloat(raw.weight) || 0,
      weightUnit: 'g',

      mainImage: raw.main_image || '',
      images: raw.images || [],

      status: raw.status || 'ACTIVE',
      platformStatus: raw.platform_status || '',

      rawData: raw,
      syncedAt: new Date()
    };
  }

  _mapOrderStatus(platformStatus) {
    const statusMap = {
      'UNPAID': 'PENDING',
      'PENDING_SHIPMENT': 'PAID',
      'SHIPPED': 'SHIPPED',
      'DELIVERED': 'DELIVERED',
      'COMPLETED': 'COMPLETED',
      'CANCELLED': 'CANCELLED',
      'REFUNDING': 'REFUNDING',
      'REFUNDED': 'REFUNDED'
    };
    return statusMap[platformStatus] || 'UNKNOWN';
  }

  // ==================== Webhook ====================

  verifyWebhook(headers, body) {
    const signature = headers['x-temu-signature'];
    if (!signature) return false;

    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const expectedSign = crypto.createHmac('sha256', this.appSecret)
      .update(bodyStr)
      .digest('hex');

    return signature === expectedSign;
  }

  parseWebhook(eventType, payload) {
    const eventMap = {
      'order.created': 'order.created',
      'order.paid': 'order.paid',
      'order.shipped': 'order.shipped',
      'order.cancelled': 'order.cancelled'
    };

    return {
      type: eventMap[eventType] || eventType,
      data: eventType.startsWith('order.') ? this.transformOrder(payload) : payload
    };
  }
}

module.exports = TemuAdapter;
