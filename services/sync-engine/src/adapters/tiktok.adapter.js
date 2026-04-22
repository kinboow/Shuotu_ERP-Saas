/**
 * TikTok Shop平台适配器
 */

const BaseAdapter = require('./base.adapter');
const axios = require('axios');
const crypto = require('crypto');

class TikTokAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.platform = 'tiktok';
    this.baseUrl = config.baseUrl || 'https://open-api.tiktokglobalshop.com';
    this.appKey = config.appKey || '';
    this.appSecret = config.appSecret || '';
    this.accessToken = config.accessToken || '';
    this.refreshTokenValue = config.refreshToken || '';
    this.tokenExpiry = null;
  }

  // ==================== 签名工具 ====================

  _generateSign(path, params, timestamp) {
    const sortedParams = Object.keys(params).sort()
      .filter(key => key !== 'sign' && key !== 'access_token')
      .map(key => `${key}${params[key]}`)
      .join('');

    const signStr = `${this.appSecret}${path}${sortedParams}${timestamp}${this.appSecret}`;
    return crypto.createHmac('sha256', this.appSecret)
      .update(signStr)
      .digest('hex');
  }

  // ==================== HTTP请求 ====================

  async request(method, path, data = {}, queryParams = {}) {
    await this.refreshToken();

    const timestamp = Math.floor(Date.now() / 1000);
    const commonParams = {
      app_key: this.appKey,
      timestamp: timestamp,
      shop_id: this.shopId,
      access_token: this.accessToken,
      ...queryParams
    };

    const sign = this._generateSign(path, { ...commonParams, ...data }, timestamp);
    commonParams.sign = sign;

    const url = `${this.baseUrl}${path}`;
    const queryString = Object.keys(commonParams)
      .map(key => `${key}=${encodeURIComponent(commonParams[key])}`)
      .join('&');

    try {
      const response = await axios({
        method,
        url: `${url}?${queryString}`,
        data: method !== 'GET' ? data : undefined,
        headers: {
          'Content-Type': 'application/json',
          'x-tts-access-token': this.accessToken
        },
        timeout: 30000
      });

      if (response.data.code !== 0) {
        throw new Error(`TikTok API错误: [${response.data.code}] ${response.data.message}`);
      }

      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`TikTok请求失败: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  // ==================== 认证 ====================

  async authenticate() {
    if (!this.appKey || !this.appSecret) {
      throw new Error('TikTok配置缺失: appKey或appSecret');
    }

    if (this.refreshTokenValue) {
      await this.refreshToken();
      return true;
    }

    throw new Error('TikTok需要OAuth授权，请先获取accessToken');
  }

  async refreshToken() {
    if (this.tokenExpiry && Date.now() < this.tokenExpiry - 60000) {
      return true;
    }

    if (!this.refreshTokenValue) {
      return false;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/api/v2/token/refresh`, {
        params: {
          app_key: this.appKey,
          app_secret: this.appSecret,
          refresh_token: this.refreshTokenValue,
          grant_type: 'refresh_token'
        }
      });

      if (response.data.code === 0) {
        this.accessToken = response.data.data.access_token;
        this.refreshTokenValue = response.data.data.refresh_token;
        this.tokenExpiry = Date.now() + (response.data.data.access_token_expire_in * 1000);
        return true;
      }
    } catch (error) {
      console.error('TikTok Token刷新失败:', error.message);
    }

    return false;
  }

  // ==================== 订单相关 ====================

  async pullOrders(params) {
    const { startTime, endTime, status, page = 1, pageSize = 50 } = params;

    const requestBody = {
      page_size: pageSize
    };

    if (startTime) requestBody.create_time_from = Math.floor(new Date(startTime).getTime() / 1000);
    if (endTime) requestBody.create_time_to = Math.floor(new Date(endTime).getTime() / 1000);
    if (status) requestBody.order_status = status;
    if (page > 1) requestBody.cursor = String((page - 1) * pageSize);

    const result = await this.request('POST', '/api/orders/search', requestBody);

    const list = (result.data?.orders || []).map(o => this.transformOrder(o));

    return {
      list,
      total: result.data?.total || 0,
      hasMore: !!result.data?.more
    };
  }

  async getOrderDetail(orderId) {
    const result = await this.request('POST', '/api/orders/detail/query', {
      order_id: orderId
    });
    return this.transformOrder(result.data);
  }

  async shipOrder(orderId, logistics) {
    return await this.request('POST', '/api/fulfillment/ship_package', {
      order_id: orderId,
      shipping_provider_id: logistics.companyCode,
      tracking_number: logistics.trackingNo
    });
  }

  async cancelOrder(orderId, reason) {
    return await this.request('POST', '/api/orders/cancel', {
      order_id: orderId,
      cancel_reason: reason
    });
  }

  // ==================== 商品相关 ====================

  async pullProducts(params) {
    const { page = 1, pageSize = 50 } = params;

    const result = await this.request('POST', '/api/products/search', {
      page_size: pageSize,
      page_number: page
    });

    const list = (result.data?.products || []).map(p => this.transformProduct(p));

    return {
      list,
      total: result.data?.total || 0,
      hasMore: list.length === pageSize
    };
  }

  async getProductDetail(productId) {
    const result = await this.request('GET', '/api/products/details', {}, {
      product_id: productId
    });
    return this.transformProduct(result.data);
  }

  async updateProduct(productId, data) {
    return await this.request('PUT', '/api/products', {
      product_id: productId,
      ...data
    });
  }

  // ==================== 库存相关 ====================

  async syncInventory(skuList) {
    const results = [];
    for (const item of skuList) {
      try {
        const result = await this.request('PUT', '/api/products/stocks', {
          product_id: item.productId,
          skus: [{
            id: item.platformSkuId,
            stock_infos: [{
              warehouse_id: item.warehouseId || 'default',
              available_stock: item.quantity
            }]
          }]
        });
        results.push({ skuId: item.platformSkuId, success: true });
      } catch (error) {
        results.push({ skuId: item.platformSkuId, success: false, error: error.message });
      }
    }
    return results;
  }

  async getInventory(skuIds) {
    // TikTok需要通过商品详情获取库存
    return [];
  }

  // ==================== 数据转换 ====================

  transformOrder(raw) {
    if (!raw) return null;

    const payment = raw.payment || {};
    const recipient = raw.recipient_address || {};

    return {
      platform: 'tiktok',
      platformOrderId: raw.order_id || '',
      shopId: raw.shop_id || this.shopId,

      status: this._mapOrderStatus(raw.order_status),
      platformStatus: String(raw.order_status || ''),

      orderTime: raw.create_time ? new Date(raw.create_time * 1000) : null,
      payTime: raw.paid_time ? new Date(raw.paid_time * 1000) : null,
      shipTime: raw.rts_time ? new Date(raw.rts_time * 1000) : null,
      deliverTime: raw.delivery_time ? new Date(raw.delivery_time * 1000) : null,

      currency: payment.currency || 'USD',
      totalAmount: parseFloat(payment.total_amount) || 0,
      productAmount: parseFloat(payment.product_price) || 0,
      shippingFee: parseFloat(payment.shipping_fee) || 0,
      discount: parseFloat(payment.seller_discount) || 0,
      tax: parseFloat(payment.tax) || 0,

      shipping: {
        name: recipient.name || '',
        phone: recipient.phone || '',
        email: '',
        country: recipient.region || '',
        countryCode: recipient.region_code || '',
        province: recipient.state || '',
        city: recipient.city || '',
        district: recipient.district || '',
        address: recipient.full_address || '',
        address2: recipient.address_detail || '',
        zipCode: recipient.zipcode || ''
      },

      logistics: {
        company: raw.shipping_provider || '',
        companyCode: raw.shipping_provider_id || '',
        trackingNo: raw.tracking_number || '',
        shippingMethod: raw.shipping_type || ''
      },

      items: (raw.item_list || []).map(item => ({
        platformItemId: item.order_line_item_id || '',
        platformSkuId: item.sku_id || '',
        platformProductId: item.product_id || '',
        internalSkuId: '',
        productName: item.product_name || '',
        productImage: item.sku_image || '',
        quantity: parseInt(item.quantity) || 0,
        price: parseFloat(item.sku_sale_price) || 0,
        totalPrice: parseFloat(item.sku_sale_price) * parseInt(item.quantity) || 0,
        attributes: {
          variation: item.sku_name || ''
        },
        weight: 0,
        barcode: item.seller_sku || ''
      })),

      buyerNote: raw.buyer_message || '',
      sellerNote: '',

      rawData: raw,
      syncedAt: new Date()
    };
  }

  transformProduct(raw) {
    if (!raw) return null;

    const firstSku = raw.skus?.[0] || {};

    return {
      platform: 'tiktok',
      platformProductId: raw.product_id || '',
      platformSkuId: firstSku.id || '',
      shopId: this.shopId,

      productName: raw.product_name || '',
      productNameEn: raw.product_name || '',
      description: raw.description || '',
      category: raw.category_list?.[0]?.local_display_name || '',
      categoryId: raw.category_list?.[0]?.id || '',
      brand: raw.brand?.name || '',

      skuCode: firstSku.seller_sku || '',
      barcode: '',
      supplierSkuCode: firstSku.seller_sku || '',

      attributes: firstSku.sales_attributes || {},

      currency: 'USD',
      costPrice: 0,
      retailPrice: parseFloat(firstSku.price?.original_price) || 0,
      salePrice: parseFloat(firstSku.price?.sale_price) || 0,

      weight: parseFloat(raw.package_weight) || 0,
      weightUnit: 'g',

      mainImage: raw.images?.[0]?.url_list?.[0] || '',
      images: (raw.images || []).map(img => img.url_list?.[0]).filter(Boolean),

      status: raw.product_status === 4 ? 'ACTIVE' : 'INACTIVE',
      platformStatus: String(raw.product_status || ''),

      rawData: raw,
      syncedAt: new Date()
    };
  }

  _mapOrderStatus(platformStatus) {
    const statusMap = {
      '100': 'PENDING',      // Unpaid
      '111': 'PAID',         // Awaiting Shipment
      '112': 'PAID',         // Awaiting Collection
      '114': 'PROCESSING',   // Partially Shipping
      '121': 'SHIPPED',      // In Transit
      '122': 'DELIVERED',    // Delivered
      '130': 'COMPLETED',    // Completed
      '140': 'CANCELLED',    // Cancelled
      'UNPAID': 'PENDING',
      'AWAITING_SHIPMENT': 'PAID',
      'AWAITING_COLLECTION': 'PAID',
      'IN_TRANSIT': 'SHIPPED',
      'DELIVERED': 'DELIVERED',
      'COMPLETED': 'COMPLETED',
      'CANCELLED': 'CANCELLED'
    };
    return statusMap[String(platformStatus)] || 'UNKNOWN';
  }

  // ==================== Webhook ====================

  verifyWebhook(headers, body) {
    const signature = headers['x-tiktok-signature'];
    if (!signature) return false;

    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const expectedSign = crypto.createHmac('sha256', this.appSecret)
      .update(bodyStr)
      .digest('hex');

    return signature === expectedSign;
  }

  parseWebhook(eventType, payload) {
    const eventMap = {
      '1': 'order.created',
      '2': 'order.cancelled',
      '3': 'order.statusChanged',
      '4': 'product.updated'
    };

    return {
      type: eventMap[eventType] || eventType,
      data: payload
    };
  }
}

module.exports = TikTokAdapter;
