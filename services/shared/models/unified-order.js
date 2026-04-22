/**
 * 统一订单模型
 * 平台无关的订单数据结构
 */

// 订单状态枚举
const OrderStatus = {
  PENDING: 'PENDING',           // 待付款
  PAID: 'PAID',                 // 已付款
  PROCESSING: 'PROCESSING',     // 处理中
  SHIPPED: 'SHIPPED',           // 已发货
  DELIVERED: 'DELIVERED',       // 已签收
  COMPLETED: 'COMPLETED',       // 已完成
  CANCELLED: 'CANCELLED',       // 已取消
  REFUNDING: 'REFUNDING',       // 退款中
  REFUNDED: 'REFUNDED'          // 已退款
};

// 订单状态流转规则
const StatusTransitions = {
  [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED, OrderStatus.REFUNDING],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED, OrderStatus.REFUNDING],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REFUNDING]: [OrderStatus.REFUNDED, OrderStatus.PAID],
  [OrderStatus.REFUNDED]: []
};

/**
 * 统一订单类
 */
class UnifiedOrder {
  constructor(data = {}) {
    // 内部标识
    this.internalId = data.internalId || null;
    
    // 平台信息
    this.platform = data.platform || '';
    this.platformOrderId = data.platformOrderId || '';
    this.shopId = data.shopId || '';
    
    // 订单状态
    this.status = data.status || OrderStatus.PENDING;
    this.platformStatus = data.platformStatus || '';
    
    // 时间信息
    this.orderTime = data.orderTime ? new Date(data.orderTime) : null;
    this.payTime = data.payTime ? new Date(data.payTime) : null;
    this.shipTime = data.shipTime ? new Date(data.shipTime) : null;
    this.deliverTime = data.deliverTime ? new Date(data.deliverTime) : null;
    
    // 金额信息
    this.currency = data.currency || 'USD';
    this.totalAmount = parseFloat(data.totalAmount) || 0;
    this.productAmount = parseFloat(data.productAmount) || 0;
    this.shippingFee = parseFloat(data.shippingFee) || 0;
    this.discount = parseFloat(data.discount) || 0;
    this.tax = parseFloat(data.tax) || 0;
    
    // 收货信息
    this.shipping = {
      name: data.shipping?.name || '',
      phone: data.shipping?.phone || '',
      email: data.shipping?.email || '',
      country: data.shipping?.country || '',
      countryCode: data.shipping?.countryCode || '',
      province: data.shipping?.province || '',
      city: data.shipping?.city || '',
      district: data.shipping?.district || '',
      address: data.shipping?.address || '',
      address2: data.shipping?.address2 || '',
      zipCode: data.shipping?.zipCode || ''
    };
    
    // 物流信息
    this.logistics = {
      company: data.logistics?.company || '',
      companyCode: data.logistics?.companyCode || '',
      trackingNo: data.logistics?.trackingNo || '',
      shippingMethod: data.logistics?.shippingMethod || ''
    };
    
    // 商品明细
    this.items = (data.items || []).map(item => ({
      platformItemId: item.platformItemId || '',
      platformSkuId: item.platformSkuId || '',
      platformProductId: item.platformProductId || '',
      internalSkuId: item.internalSkuId || '',
      productName: item.productName || '',
      productImage: item.productImage || '',
      quantity: parseInt(item.quantity) || 0,
      price: parseFloat(item.price) || 0,
      totalPrice: parseFloat(item.totalPrice) || 0,
      attributes: item.attributes || {},
      weight: parseFloat(item.weight) || 0,
      barcode: item.barcode || ''
    }));
    
    // 备注
    this.buyerNote = data.buyerNote || '';
    this.sellerNote = data.sellerNote || '';
    
    // 元数据
    this.rawData = data.rawData || null;
    this.syncedAt = data.syncedAt ? new Date(data.syncedAt) : null;
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }
  
  /**
   * 检查是否可以流转到目标状态
   */
  canTransitionTo(targetStatus) {
    const allowedTransitions = StatusTransitions[this.status] || [];
    return allowedTransitions.includes(targetStatus);
  }
  
  /**
   * 转换为数据库存储格式
   */
  toDatabase() {
    return {
      internal_order_id: this.internalId,
      platform: this.platform,
      platform_order_id: this.platformOrderId,
      shop_id: this.shopId,
      status: this.status,
      platform_status: this.platformStatus,
      order_time: this.orderTime,
      pay_time: this.payTime,
      ship_time: this.shipTime,
      deliver_time: this.deliverTime,
      currency: this.currency,
      total_amount: this.totalAmount,
      product_amount: this.productAmount,
      shipping_fee: this.shippingFee,
      discount: this.discount,
      tax: this.tax,
      receiver_name: this.shipping.name,
      receiver_phone: this.shipping.phone,
      receiver_email: this.shipping.email,
      country: this.shipping.country,
      country_code: this.shipping.countryCode,
      province: this.shipping.province,
      city: this.shipping.city,
      district: this.shipping.district,
      address: this.shipping.address,
      address2: this.shipping.address2,
      zip_code: this.shipping.zipCode,
      logistics_company: this.logistics.company,
      logistics_company_code: this.logistics.companyCode,
      tracking_no: this.logistics.trackingNo,
      shipping_method: this.logistics.shippingMethod,
      buyer_note: this.buyerNote,
      seller_note: this.sellerNote,
      raw_data: JSON.stringify(this.rawData),
      synced_at: this.syncedAt,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }
  
  /**
   * 从数据库记录创建实例
   */
  static fromDatabase(row) {
    return new UnifiedOrder({
      internalId: row.internal_order_id,
      platform: row.platform,
      platformOrderId: row.platform_order_id,
      shopId: row.shop_id,
      status: row.status,
      platformStatus: row.platform_status,
      orderTime: row.order_time,
      payTime: row.pay_time,
      shipTime: row.ship_time,
      deliverTime: row.deliver_time,
      currency: row.currency,
      totalAmount: row.total_amount,
      productAmount: row.product_amount,
      shippingFee: row.shipping_fee,
      discount: row.discount,
      tax: row.tax,
      shipping: {
        name: row.receiver_name,
        phone: row.receiver_phone,
        email: row.receiver_email,
        country: row.country,
        countryCode: row.country_code,
        province: row.province,
        city: row.city,
        district: row.district,
        address: row.address,
        address2: row.address2,
        zipCode: row.zip_code
      },
      logistics: {
        company: row.logistics_company,
        companyCode: row.logistics_company_code,
        trackingNo: row.tracking_no,
        shippingMethod: row.shipping_method
      },
      buyerNote: row.buyer_note,
      sellerNote: row.seller_note,
      rawData: row.raw_data ? JSON.parse(row.raw_data) : null,
      syncedAt: row.synced_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }
}

module.exports = UnifiedOrder;
module.exports.OrderStatus = OrderStatus;
module.exports.StatusTransitions = StatusTransitions;
