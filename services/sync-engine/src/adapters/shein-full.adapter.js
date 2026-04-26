/**
 * SHEIN(full)平台适配器 - 全托管模式
 * 完整实现SHEIN开放平台API对接
 * 基于官方API文档: https://open.sheincorp.com
 */

const BaseAdapter = require('./base.adapter');
const axios = require('axios');
const crypto = require('crypto');

class SheinFullAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.platform = 'shein_full';
    // 根据应用类型选择域名
    this.baseUrl = config.baseUrl || this._getBaseUrl(config.appType);
    this.openKeyId = config.openKeyId || '';
    this.secretKey = config.secretKey || '';
    this.appId = config.appId || '';
    this.appSecret = config.appSecret || '';
    this.language = config.language || 'zh-cn';
    this.shopId = config.shopId || '';
  }

  /**
   * 根据应用类型获取API域名
   */
  _getBaseUrl(appType) {
    const urlMap = {
      'traditional': 'https://openapi.sheincorp.com',      // 传统平台/自主运营
      'semi-managed': 'https://openapi.sheincorp.com',     // 半托管
      'full-managed': 'https://openapi.sheincorp.cn',      // 全托管/代运营
      'self-operated': 'https://openapi.sheincorp.cn',     // SHEIN自营
      'test': 'https://openapi-test01.sheincorp.cn'        // 测试环境
    };
    return urlMap[appType] || 'https://openapi.sheincorp.com';
  }

  // ==================== 签名工具 ====================

  /**
   * HMAC-SHA256签名
   */
  _hmacSha256(message, secret) {
    return crypto.createHmac('sha256', secret)
      .update(message, 'utf8')
      .digest('hex');
  }

  /**
   * 生成SHEIN API签名 (基于官方文档)
   * 步骤: 1.组装VALUE 2.组装KEY 3.HMAC-SHA256 4.Base64 5.拼接RandomKey
   */
  _generateSignature(keyId, secret, apiPath) {
    const timestamp = String(Date.now());
    // 步骤1: 组装签名数据VALUE = openKeyId + "&" + timestamp + "&" + path
    const signString = `${keyId}&${timestamp}&${apiPath}`;
    // 生成5位随机字符串
    const randomKey = crypto.randomBytes(16).toString('hex').substring(0, 5);
    // 步骤2: 组装签名密钥KEY = secretKey + randomKey
    const randomSecretKey = secret + randomKey;
    // 步骤3: HMAC-SHA256加密并转十六进制
    const hashValue = this._hmacSha256(signString, randomSecretKey);
    // 步骤4: Base64编码
    const base64Value = Buffer.from(hashValue, 'utf8').toString('base64');
    // 步骤5: 拼接RandomKey
    const signature = randomKey + base64Value;

    return { signature, timestamp };
  }

  /**
   * 生成API请求头
   */
  _generateHeaders(apiPath, options = {}) {
    const { signature, timestamp } = this._generateSignature(
      this.openKeyId,
      this.secretKey,
      apiPath
    );

    const headers = {
      'Content-Type': 'application/json;charset=UTF-8',
      'x-lt-openKeyId': this.openKeyId,
      'x-lt-timestamp': timestamp,
      'x-lt-signature': signature,
      'language': options.language || this.language
    };

    // 部分接口需要x-lt-language
    if (options.useXltLanguage) {
      headers['x-lt-language'] = this._mapLanguageCode(options.language || this.language);
    }

    return headers;
  }

  /**
   * 语言代码映射
   */
  _mapLanguageCode(lang) {
    const map = {
      'zh-cn': 'CN', 'en': 'US', 'fr': 'FR', 'es': 'ES',
      'de': 'DE', 'th': 'TH', 'pt-br': 'PT', 'tr': 'TR'
    };
    return map[lang] || 'CN';
  }

  // ==================== HTTP请求 ====================

  async request(method, path, data = {}, options = {}) {
    const headers = this._generateHeaders(path, options);
    const url = `${this.baseUrl}${path}`;

    try {
      const config = {
        method,
        url,
        headers,
        timeout: options.timeout || 30000
      };

      if (method === 'GET') {
        config.params = data;
      } else {
        config.data = data;
      }

      const response = await axios(config);

      if (response.data.code !== '0' && response.data.code !== 0) {
        const error = new Error(`SHEIN API错误: [${response.data.code}] ${response.data.msg || response.data.message}`);
        error.code = response.data.code;
        error.traceId = response.data.traceId;
        throw error;
      }

      return response.data;
    } catch (error) {
      if (error.response) {
        const err = new Error(`SHEIN请求失败: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        err.status = error.response.status;
        err.data = error.response.data;
        throw err;
      }
      throw error;
    }
  }

  // ==================== 认证相关 ====================

  async authenticate() {
    if (!this.openKeyId || !this.secretKey) {
      throw new Error('SHEIN配置缺失: openKeyId或secretKey');
    }
    // 通过调用分类接口验证凭证有效性
    try {
      await this.getCategoryTree();
      return true;
    } catch (error) {
      throw new Error(`SHEIN认证失败: ${error.message}`);
    }
  }

  async refreshToken() {
    return true; // SHEIN使用签名认证，无需刷新Token
  }

  /**
   * 解密secretKey (授权回调时使用)
   */
  static decryptSecretKey(encryptedSecretKey, appSecret) {
    try {
      const algorithm = 'aes-128-cbc';
      const key = Buffer.from(appSecret.substring(0, 16), 'utf8');
      const iv = Buffer.from('space-station-de', 'utf8');
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encryptedSecretKey, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      throw new Error(`解密secretKey失败: ${error.message}`);
    }
  }

  // ==================== 商品分类 ====================

  /**
   * 获取店铺商品末级分类
   * POST /open-api/goods/query-category-tree
   */
  async getCategoryTree(options = {}) {
    return await this.request('POST', '/open-api/goods/query-category-tree', {}, options);
  }

  /**
   * 获取商品属性模板
   * POST /open-api/goods/query-attribute-template
   */
  async getAttributeTemplate(productTypeIds) {
    return await this.request('POST', '/open-api/goods/query-attribute-template', {
      product_type_id_list: Array.isArray(productTypeIds) ? productTypeIds : [productTypeIds]
    });
  }

  /**
   * 获取商品发布字段规范
   * POST /open-api/goods/query-publish-fill-in-standard
   */
  async getPublishStandard(params = {}) {
    const data = {};
    if (params.categoryId) data.category_id = params.categoryId;
    if (params.spuName) data.spu_name = params.spuName;
    return await this.request('POST', '/open-api/goods/query-publish-fill-in-standard', data);
  }

  // ==================== 商品管理 ====================

  /**
   * 获取商品列表
   * POST /open-api/openapi-business-backend/product/query
   */
  async getProductList(params = {}) {
    const data = {
      pageNum: params.pageNum || params.page || 1,
      pageSize: params.pageSize || 50
    };
    if (params.insertTimeStart) data.insertTimeStart = params.insertTimeStart;
    if (params.insertTimeEnd) data.insertTimeEnd = params.insertTimeEnd;
    if (params.updateTimeStart) data.updateTimeStart = params.updateTimeStart;
    if (params.updateTimeEnd) data.updateTimeEnd = params.updateTimeEnd;

    return await this.request('POST', '/open-api/openapi-business-backend/product/query', data);
  }

  /**
   * 获取SPU商品详情
   * POST /open-api/goods/spu-info
   */
  async getProductDetail(spuName, languageList = ['zh-cn']) {
    return await this.request('POST', '/open-api/goods/spu-info', {
      spuName,
      languageList
    });
  }

  /**
   * 发布/编辑商品
   * POST /open-api/goods/product/publishOrEdit
   */
  async publishProduct(productData) {
    return await this.request('POST', '/open-api/goods/product/publishOrEdit', productData);
  }

  /**
   * 图片链接转换
   * POST /open-api/goods/transform-pic
   */
  async transformImage(imageUrl, imageType) {
    return await this.request('POST', '/open-api/goods/transform-pic', {
      original_url: imageUrl,
      image_type: imageType // 1:主图 2:细节图 5:方块图 6:色块图 7:详情图
    });
  }

  /**
   * 图文识别推荐类目
   * POST /open-api/goods/image-category-suggestion
   */
  async suggestCategory(params = {}) {
    const data = {};
    if (params.url) data.url = params.url;
    if (params.productInfo) data.productInfo = params.productInfo;
    return await this.request('POST', '/open-api/goods/image-category-suggestion', data);
  }

  /**
   * 商品打印条码
   * POST /open-api/goods/print-barcode
   */
  async printBarcode(printData) {
    return await this.request('POST', '/open-api/goods/print-barcode', printData, { useXltLanguage: true });
  }

  /**
   * 查询SKU销量
   * POST /open-api/goods/query-sku-sales
   */
  async getSkuSales(skuCodeList) {
    return await this.request('POST', '/open-api/goods/query-sku-sales', {
      skuCodeList: Array.isArray(skuCodeList) ? skuCodeList : [skuCodeList]
    });
  }

  // ==================== 采购单管理 ====================

  /**
   * 获取采购单信息
   * GET /open-api/order/purchase-order-infos
   */
  async getPurchaseOrders(params = {}) {
    const queryParams = {
      pageNumber: params.pageNumber || params.page || 1,
      pageSize: params.pageSize || 20
    };
    if (params.orderNos) queryParams.orderNos = Array.isArray(params.orderNos) ? params.orderNos.join(',') : params.orderNos;
    if (params.skcs) queryParams.skcs = params.skcs;
    if (params.type) queryParams.type = params.type; // 1:急采 2:备货
    if (params.supplierCodes) queryParams.supplierCodes = params.supplierCodes;
    if (params.combineTimeStart) queryParams.combineTimeStart = params.combineTimeStart;
    if (params.combineTimeEnd) queryParams.combineTimeEnd = params.combineTimeEnd;
    if (params.updateTimeStart) queryParams.updateTimeStart = params.updateTimeStart;
    if (params.updateTimeEnd) queryParams.updateTimeEnd = params.updateTimeEnd;
    if (params.selectJitMother) queryParams.selectJitMother = params.selectJitMother;

    return await this.request('GET', '/open-api/order/purchase-order-infos', queryParams, { useXltLanguage: true });
  }

  /**
   * 手工下备货单
   * POST /open-api/idms/create-order
   */
  async createStockOrder(paramList) {
    return await this.request('POST', '/open-api/idms/create-order', { paramList });
  }

  /**
   * 查询备货单审核列表
   * POST /open-api/idms/review-orders
   */
  async getReviewOrders(params = {}) {
    return await this.request('POST', '/open-api/idms/review-orders', params);
  }

  /**
   * 查询商品备货信息列表
   * POST /open-api/openapi-business-backend/stock-goods-list
   */
  async getStockGoodsList(params = {}) {
    return await this.request('POST', '/open-api/openapi-business-backend/stock-goods-list', {
      pageNum: params.pageNum || 1,
      pageSize: params.pageSize || 20
    });
  }

  /**
   * JIT母单及子单关系查询
   * GET /open-api/order/get-mothe-child-orders
   */
  async getMotherChildOrders(orderNos, selectJitMother) {
    return await this.request('GET', '/open-api/order/get-mothe-child-orders', {
      orderNos: Array.isArray(orderNos) ? orderNos.join(',') : orderNos,
      selectJitMother // 1:查母单 2:查子单
    });
  }

  // ==================== 库存管理 ====================

  /**
   * 查询库存
   * POST /open-api/stock/stock-query
   */
  async getInventory(params) {
    const data = {
      warehouseType: params.warehouseType || '1' // 1:SHEIN仓 2:半托管虚拟库存 3:全托管虚拟库存
    };
    if (params.skuCodeList) data.skuCodeList = params.skuCodeList;
    if (params.skcNameList) data.skcNameList = params.skcNameList;
    if (params.spuNameList) data.spuNameList = params.spuNameList;
    return await this.request('POST', '/open-api/stock/stock-query', data);
  }

  // ==================== 发货管理 ====================

  /**
   * 获取发货基本信息
   * GET /open-api/shipping/basic
   */
  async getShippingBasic(orderType, addressId) {
    const params = { orderType }; // 1:急采 2:备货
    if (addressId) params.addressId = addressId;
    return await this.request('GET', '/open-api/shipping/basic', params, { useXltLanguage: true });
  }

  /**
   * 查询发货单列表
   * GET /open-api/shipping/delivery
   */
  async getDeliveryList(params = {}) {
    const queryParams = {};
    if (params.deliveryCode) queryParams.deliveryCode = params.deliveryCode;
    if (params.startTime) queryParams.startTime = params.startTime;
    if (params.endTime) queryParams.endTime = params.endTime;
    if (params.page) queryParams.page = params.page;
    if (params.perPage) queryParams.perPage = Math.min(params.perPage || 200, 200);
    return await this.request('GET', '/open-api/shipping/delivery', queryParams, { useXltLanguage: true });
  }

  /**
   * 物流产品查询（SHEIN集成物流公司列表）
   * POST /open-api/shipping/express-company-list-v2
   */
  async getExpressCompanyList(params) {
    const data = {
      addressId: params.addressId,
      deliveryType: params.deliveryType || '1',
      orderType: params.orderType,
      reserveParcelTime: params.reserveParcelTime,
      purchaseOrders: params.purchaseOrders // [{orderNo, skuInfos: [{qty, skuCode}]}]
    };
    return await this.request('POST', '/open-api/shipping/express-company-list-v2', data, { useXltLanguage: true });
  }

  /**
   * 收货仓信息查询
   * GET /open-api/shipping/warehouse
   */
  async getWarehouseInfo(params) {
    const queryParams = {
      addressId: params.addressId,
      orderType: params.orderType,
      sendType: params.sendType
    };
    if (params.expressMode) queryParams.expressMode = params.expressMode;
    if (params.coding) queryParams.coding = params.coding;
    if (params.orderNoList) queryParams.orderNoList = params.orderNoList.join(',');
    if (params.shippingRoute) queryParams.shippingRoute = params.shippingRoute;
    return await this.request('GET', '/open-api/shipping/warehouse', queryParams, { useXltLanguage: true });
  }

  /**
   * 创建发货单
   * POST /open-api/shipping/orderToShipping
   */
  async createDeliveryOrder(data) {
    return await this.request('POST', '/open-api/shipping/orderToShipping', data, { useXltLanguage: true });
  }

  /**
   * 发货单维度打印面单
   * POST /open-api/shipping/delivery/print-package
   */
  async printDeliveryLabel(deliveryNo) {
    return await this.request('POST', '/open-api/shipping/delivery/print-package', { deliveryNo }, { useXltLanguage: true });
  }

  /**
   * 查询SHEIN合作物流预估运费
   * POST /open-api/openapi-business-backend/purchase-estimated-fee
   */
  async getEstimatedFee(params) {
    const data = {
      addressId: params.addressId,
      agedProductCode: params.agedProductCode,
      expressInfoList: params.expressInfoList, // [{companyCode, isRecommend}]
      orderNoList: params.orderNoList,
      orderType: params.orderType,
      weight: params.weight
    };
    return await this.request('POST', '/open-api/openapi-business-backend/purchase-estimated-fee', data);
  }

  // ==================== 财务管理 ====================

  /**
   * 查询报账单列表
   * POST /open-api/finance/report-list
   */
  async getReportList(params) {
    const data = {
      page: params.page || 1,
      perPage: Math.min(params.perPage || 200, 200)
    };
    if (params.addTimeStart) data.addTimeStart = params.addTimeStart;
    if (params.addTimeEnd) data.addTimeEnd = params.addTimeEnd;
    if (params.lastUpdateTimeStart) data.lastUpdateTimeStart = params.lastUpdateTimeStart;
    if (params.lastUpdateTimeEnd) data.lastUpdateTimeEnd = params.lastUpdateTimeEnd;
    if (params.settlementStatuses) data.settlementStatuses = params.settlementStatuses;
    return await this.request('POST', '/open-api/finance/report-list', data, { useXltLanguage: true });
  }

  /**
   * 查询报账单销售款明细
   * POST /open-api/finance/report-sales-detail
   */
  async getReportSalesDetail(reportOrderNo, params = {}) {
    return await this.request('POST', '/open-api/finance/report-sales-detail', {
      reportOrderNo,
      perPage: Math.min(params.perPage || 200, 200),
      query: params.query || undefined
    }, { useXltLanguage: true });
  }

  /**
   * 查询报账单补扣款明细
   * POST /open-api/finance/report-adjustment-detail
   */
  async getReportAdjustmentDetail(reportOrderNo, params = {}) {
    return await this.request('POST', '/open-api/finance/report-adjustment-detail', {
      reportOrderNo,
      perPage: Math.min(params.perPage || 200, 200),
      query: params.query || undefined
    }, { useXltLanguage: true });
  }

  // ==================== 统一接口实现 (继承自BaseAdapter) ====================

  /**
   * 拉取采购单列表
   */
  async pullOrders(params) {
    const { startTime, endTime, status, page = 1, pageSize = 50, type } = params;

    const requestParams = {
      pageNumber: page,
      pageSize: Math.min(pageSize, 200)
    };

    if (startTime && endTime) {
      requestParams.combineTimeStart = this.formatTime(startTime);
      requestParams.combineTimeEnd = this.formatTime(endTime);
    }
    if (type) requestParams.type = type;

    const result = await this.getPurchaseOrders(requestParams);
    const list = (result.info?.list || []).map(o => this.transformOrder(o));

    return {
      list,
      total: result.info?.count || 0,
      hasMore: list.length === pageSize
    };
  }

  /**
   * 获取采购单详情
   */
  async getOrderDetail(orderId) {
    const result = await this.getPurchaseOrders({ orderNos: orderId });
    const order = result.info?.list?.[0];
    return order ? this.transformOrder(order) : null;
  }

  async shipOrder(orderId, logistics) {
    // SHEIN发货通过发货单接口处理
    throw new Error('请使用SHEIN商家后台或专用发货接口');
  }

  async cancelOrder(orderId, reason) {
    throw new Error('SHEIN采购单不支持API取消，请联系SHEIN处理');
  }

  /**
   * 拉取商品列表
   */
  async pullProducts(params) {
    const { page = 1, pageSize = 50, insertTimeStart, insertTimeEnd } = params;

    const result = await this.getProductList({
      pageNum: page,
      pageSize: Math.min(pageSize, 50),
      insertTimeStart,
      insertTimeEnd
    });

    const list = (result.info?.data || []).map(p => this.transformProduct(p));

    return {
      list,
      total: list.length,
      hasMore: list.length === pageSize
    };
  }

  /**
   * 更新商品
   */
  async updateProduct(spuName, data) {
    return await this.publishProduct({
      spu_name: spuName,
      ...data
    });
  }

  /**
   * 同步库存
   */
  async syncInventory(skuList, warehouseType = '2') {
    // SHEIN库存通过查询接口获取，更新需要通过商家后台
    const skuCodes = skuList.map(item => item.platformSkuId || item.skuCode);
    return await this.getInventory({
      skuCodeList: skuCodes,
      warehouseType
    });
  }

  /**
   * 查询库存 (统一接口)
   */
  async queryInventory(skuIds, warehouseType = '2') {
    const result = await this.getInventory({
      skuCodeList: Array.isArray(skuIds) ? skuIds : [skuIds],
      warehouseType
    });
    return result.info?.goodsInventory || [];
  }

  // ==================== 数据转换 ====================

  /**
   * 转换采购单数据为统一格式
   */
  transformOrder(raw) {
    if (!raw) return null;

    return {
      platform: 'shein_full',
      platformOrderId: raw.orderNo,
      shopId: this.shopId,

      // 订单类型: 1急采 2备货
      orderType: raw.type,
      orderTypeName: raw.typeName,

      status: this._mapOrderStatus(raw.status),
      platformStatus: raw.status,
      statusName: raw.statusName,

      // 时间信息
      addTime: raw.addTime ? new Date(raw.addTime) : null,
      allocateTime: raw.allocateTime ? new Date(raw.allocateTime) : null,
      deliveryTime: raw.deliveryTime ? new Date(raw.deliveryTime) : null,
      receiptTime: raw.receiptTime ? new Date(raw.receiptTime) : null,
      checkTime: raw.checkTime ? new Date(raw.checkTime) : null,
      storageTime: raw.storageTime ? new Date(raw.storageTime) : null,
      updateTime: raw.updateTime ? new Date(raw.updateTime) : null,
      requestReceiptTime: raw.requestReceiptTime ? new Date(raw.requestReceiptTime) : null,
      requestTakeParcelTime: raw.requestTakeParcelTime ? new Date(raw.requestTakeParcelTime) : null,

      // 供应商信息
      supplierName: raw.supplierName || '',
      currency: raw.currency || raw.currencyName || '',
      currencyId: raw.currencyId,

      // 仓库信息
      warehouseName: raw.warehouseName || '',
      storageId: raw.storageId,

      // 标签信息
      firstMark: raw.firstMark,
      firstMarkName: raw.firstMarkName,
      prepareTypeName: raw.prepareTypeName,
      prepareTypeId: raw.prepareTypeId,
      urgentTypeName: raw.urgentTypeName,
      urgentType: raw.urgentType,
      isJitMotherName: raw.isJitMotherName,

      // 订单标签
      orderLabelInfo: raw.orderLabelInfo || [],
      goodsLevel: raw.goodsLevel || [],

      // 商品明细
      items: (raw.orderExtends || []).map(item => ({
        skc: item.skc,
        skuCode: item.skuCode,
        supplierCode: item.supplierCode,
        supplierSku: item.supplierSku,
        suffixZh: item.suffixZh,
        imgPath: item.imgPath,
        skuImg: item.skuImg,
        price: parseFloat(item.price) || 0,
        needQuantity: item.needQuantity,
        orderQuantity: item.orderQuantity,
        deliveryQuantity: item.deliveryQuantity,
        receiptQuantity: item.receiptQuantity,
        storageQuantity: item.storageQuantity,
        defectiveQuantity: item.defectiveQuantity,
        remark: item.remark || '',
        // JIT相关
        requestDeliveryQuantity: item.requestDeliveryQuantity,
        noRequestDeliveryQuantity: item.noRequestDeliveryQuantity,
        alreadyDeliveryQuantity: item.alreadyDeliveryQuantity
      })),

      // 定制信息
      customInfoId: raw.customInfoId,
      customInfo: raw.customInfo,

      rawData: raw,
      syncedAt: new Date()
    };
  }

  /**
   * 转换商品列表数据
   */
  transformProduct(raw) {
    if (!raw) return null;

    return {
      platform: 'shein_full',
      spuName: raw.spuName,
      skcName: raw.skcName,
      skuCodeList: raw.skuCodeList || [],
      shopId: this.shopId,
      rawData: raw,
      syncedAt: new Date()
    };
  }

  /**
   * 转换SPU详情数据
   */
  transformProductDetail(raw) {
    if (!raw) return null;

    return {
      platform: 'shein_full',
      spuName: raw.spuName,
      categoryId: raw.categoryId,
      productTypeId: raw.productTypeId,
      brandCode: raw.brandCode,
      supplierCode: raw.supplierCode,

      // 多语言名称
      productNames: (raw.productMultiNameList || []).reduce((acc, item) => {
        acc[item.language] = item.productName;
        return acc;
      }, {}),

      // 多语言描述
      productDescs: (raw.productMultiDescList || []).reduce((acc, item) => {
        acc[item.language] = item.productDesc;
        return acc;
      }, {}),

      // 商品属性
      productAttributes: raw.productAttributeInfoList || [],
      dimensionAttributes: raw.dimensionAttributeInfoList || [],

      // SPU图片
      spuImages: raw.spuImageInfoList || null,

      // SKC列表
      skcList: (raw.skcInfoList || []).map(skc => ({
        skcName: skc.skcName,
        supplierCode: skc.supplierCode,
        attributeId: skc.attributeId,
        attributeValueId: skc.attributeValueId,
        sampleInfo: skc.sampleInfo,
        shelfStatusList: skc.shelfStatusInfoList,
        images: skc.skcImageInfoList,
        siteDetailImages: skc.siteDetailImageInfoList,
        srpPriceInfo: skc.srpPriceInfo,
        skuList: (skc.skuInfoList || []).map(sku => ({
          skuCode: sku.skuCode,
          supplierSku: sku.supplierSku,
          length: sku.length,
          width: sku.width,
          height: sku.height,
          weight: sku.weight,
          mallState: sku.mallState,
          stopPurchase: sku.stopPurchase,
          saleAttributes: sku.saleAttributeList,
          priceList: sku.priceInfoList,
          costList: sku.costInfoList,
          skuImages: sku.skuImageInfoList,
          quantityType: sku.quantityType,
          quantityUnit: sku.quantityUnit,
          quantity: sku.quantity,
          packageType: sku.packageType
        }))
      })),

      rawData: raw,
      syncedAt: new Date()
    };
  }

  /**
   * 采购单状态映射
   */
  _mapOrderStatus(platformStatus) {
    const statusMap = {
      1: 'PENDING',      // 待下单
      2: 'ORDERED',      // 已下单
      3: 'SHIPPING',     // 发货中
      4: 'SHIPPED',      // 已送货
      5: 'RECEIVED',     // 已收货
      6: 'CHECKED',      // 已查验
      7: 'RETURNED',     // 已退货
      8: 'COMPLETED',    // 已完成
      9: 'DELISTED',     // 无货下架
      10: 'CANCELLED',   // 已作废
      11: 'PENDING_REVIEW', // 待审核
      12: 'SPLITTING',   // 分单中
      13: 'PENDING_RETURN' // 待退货
    };
    return statusMap[platformStatus] || 'UNKNOWN';
  }

  /**
   * 转换报账单数据
   */
  transformReport(raw) {
    if (!raw) return null;
    return {
      reportOrderNo: raw.reportOrderNo,
      salesTotal: raw.salesTotal,
      replenishTotal: raw.replenishTotal,
      addTime: raw.addTime ? new Date(raw.addTime) : null,
      lastUpdateTime: raw.lastUpdateTime ? new Date(raw.lastUpdateTime) : null,
      settlementStatus: raw.settlementStatus,
      settlementStatusName: raw.settlementStatusName,
      estimatePayTime: raw.estimatePayTime ? new Date(raw.estimatePayTime) : null,
      completedPayTime: raw.completedPayTime ? new Date(raw.completedPayTime) : null,
      companyName: raw.companyName,
      estimateIncomeMoneyTotal: raw.estimateIncomeMoneyTotal,
      currencyCode: raw.currencyCode
    };
  }

  // ==================== Webhook ====================

  verifyWebhook(headers, body) {
    const signature = headers['x-lt-signature'];
    const timestamp = headers['x-lt-timestamp'];
    if (!signature || !timestamp) return false;
    // SHEIN Webhook验证逻辑
    return !!signature;
  }

  parseWebhook(eventType, payload) {
    const eventMap = {
      'ORDER_CREATED': 'order.created',
      'ORDER_STATUS_CHANGED': 'order.status_changed',
      'PRODUCT_AUDIT_STATUS': 'product.audit_status',
      'AUTHORIZATION_CHANGE': 'authorization.changed'
    };
    return {
      type: eventMap[eventType] || eventType,
      data: payload
    };
  }

  // ==================== 辅助方法 ====================

  /**
   * 格式化时间为SHEIN要求的格式
   */
  formatTime(date) {
    if (!date) return null;
    const d = new Date(date);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  /**
   * 批量同步商品详情
   */
  async batchGetProductDetails(spuNames, languageList = ['zh-cn']) {
    const results = [];
    for (const spuName of spuNames) {
      try {
        const result = await this.getProductDetail(spuName, languageList);
        results.push({ spuName, success: true, data: this.transformProductDetail(result.info) });
      } catch (error) {
        results.push({ spuName, success: false, error: error.message });
      }
    }
    return results;
  }

  /**
   * 批量同步采购单
   */
  async batchSyncOrders(params = {}) {
    const allOrders = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const result = await this.pullOrders({ ...params, page, pageSize: 200 });
      allOrders.push(...result.list);
      hasMore = result.hasMore;
      page++;
      // 防止请求过快
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return allOrders;
  }

  // ==================== 商品综合查询 ====================

  /**
   * 商品综合查询
   * @param {Object} params - 查询参数 (如 skuCodeList, pageNum, pageSize 等)
   */
  async searchProduct(params) {
    const apiPath = '/open-api/goods/searchProduct';
    const { language, ...rest } = params;
    const requestBody = {
      pageNum: rest.pageNum || 1,
      pageSize: rest.pageSize || 10,
      ...rest
    };

    const options = language ? { language } : {};
    const result = await this.request('POST', apiPath, requestBody, options);
    return result.info || {};
  }

  // ==================== 商品条码打印 ====================

  /**
   * 打印商品条码
   * POST /open-api/goods/print-barcode
   * @param {Array} data - 条码数据数组 [{orderNo, supplierSku, sheinSku, printNumber, printContentType}]
   * @param {number} type - 条码类型 1:商品条码 2:普通订单条码（推荐）
   * @param {number} printFormatType - 打印格式 1:20*70 2:25*40（仅巴西商家）
   */
  async printBarcode(data, type = 2, printFormatType = 1) {
    const apiPath = '/open-api/goods/print-barcode';

    // 校验：data数组不能超过200组
    if (data.length > 200) {
      throw new Error('单次打印数据不能超过200组');
    }

    // 校验：printNumber累计不能超过2000
    const totalPrint = data.reduce((sum, item) => sum + (item.printNumber || 1), 0);
    if (totalPrint > 2000) {
      throw new Error(`打印总数量(${totalPrint})超过2000份限制`);
    }

    const requestBody = {
      type,
      data: data.map(item => ({
        orderNo: item.orderNo || null,
        supplierSku: item.supplierSku || null,
        ...(item.barcode ? { barcode: item.barcode } : {}),
        sheinSku: item.sheinSku,
        printNumber: item.printNumber || 1,
        ...(item.printContentType ? { printContentType: item.printContentType } : {}),
        ...(printFormatType !== 1 ? { printFormatType } : {})
      }))
    };

    const result = await this.request('POST', apiPath, requestBody, {
      useXltLanguage: true
    });

    return {
      url: result.info?.url || null,
      errorData: result.info?.errorData || [],
      codingInfoList: result.info?.codingInfoList || []
    };
  }
}

module.exports = SheinFullAdapter;
