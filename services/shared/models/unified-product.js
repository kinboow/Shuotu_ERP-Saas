/**
 * 统一商品模型
 * 平台无关的商品/SKU数据结构
 */

/**
 * 统一商品类
 */
class UnifiedProduct {
  constructor(data = {}) {
    // 内部标识
    this.internalProductId = data.internalProductId || null;
    this.internalSkuId = data.internalSkuId || null;
    
    // 平台信息
    this.platform = data.platform || '';
    this.platformProductId = data.platformProductId || '';
    this.platformSkuId = data.platformSkuId || '';
    this.shopId = data.shopId || '';
    
    // 商品基本信息
    this.productName = data.productName || '';
    this.productNameEn = data.productNameEn || '';
    this.description = data.description || '';
    this.category = data.category || '';
    this.categoryId = data.categoryId || '';
    this.brand = data.brand || '';
    
    // SKU信息
    this.skuCode = data.skuCode || '';
    this.barcode = data.barcode || '';
    this.supplierSkuCode = data.supplierSkuCode || '';
    
    // 规格属性
    this.attributes = {
      color: data.attributes?.color || '',
      colorCode: data.attributes?.colorCode || '',
      size: data.attributes?.size || '',
      sizeCode: data.attributes?.sizeCode || '',
      material: data.attributes?.material || '',
      style: data.attributes?.style || '',
      ...data.attributes
    };
    
    // 价格信息
    this.currency = data.currency || 'USD';
    this.costPrice = parseFloat(data.costPrice) || 0;
    this.retailPrice = parseFloat(data.retailPrice) || 0;
    this.salePrice = parseFloat(data.salePrice) || 0;
    
    // 物理属性
    this.weight = parseFloat(data.weight) || 0;
    this.weightUnit = data.weightUnit || 'g';
    this.length = parseFloat(data.length) || 0;
    this.width = parseFloat(data.width) || 0;
    this.height = parseFloat(data.height) || 0;
    this.dimensionUnit = data.dimensionUnit || 'cm';
    
    // 图片
    this.mainImage = data.mainImage || '';
    this.images = data.images || [];
    
    // 状态
    this.status = data.status || 'ACTIVE';
    this.platformStatus = data.platformStatus || '';
    
    // 供应商信息
    this.supplierId = data.supplierId || '';
    this.supplierName = data.supplierName || '';
    
    // 元数据
    this.rawData = data.rawData || null;
    this.syncedAt = data.syncedAt ? new Date(data.syncedAt) : null;
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }
  
  /**
   * 转换为数据库存储格式
   */
  toDatabase() {
    return {
      internal_product_id: this.internalProductId,
      internal_sku_id: this.internalSkuId,
      platform: this.platform,
      platform_product_id: this.platformProductId,
      platform_sku_id: this.platformSkuId,
      shop_id: this.shopId,
      product_name: this.productName,
      product_name_en: this.productNameEn,
      description: this.description,
      category: this.category,
      category_id: this.categoryId,
      brand: this.brand,
      sku_code: this.skuCode,
      barcode: this.barcode,
      supplier_sku_code: this.supplierSkuCode,
      attributes: JSON.stringify(this.attributes),
      currency: this.currency,
      cost_price: this.costPrice,
      retail_price: this.retailPrice,
      sale_price: this.salePrice,
      weight: this.weight,
      weight_unit: this.weightUnit,
      length: this.length,
      width: this.width,
      height: this.height,
      dimension_unit: this.dimensionUnit,
      main_image: this.mainImage,
      images: JSON.stringify(this.images),
      status: this.status,
      platform_status: this.platformStatus,
      supplier_id: this.supplierId,
      supplier_name: this.supplierName,
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
    return new UnifiedProduct({
      internalProductId: row.internal_product_id,
      internalSkuId: row.internal_sku_id,
      platform: row.platform,
      platformProductId: row.platform_product_id,
      platformSkuId: row.platform_sku_id,
      shopId: row.shop_id,
      productName: row.product_name,
      productNameEn: row.product_name_en,
      description: row.description,
      category: row.category,
      categoryId: row.category_id,
      brand: row.brand,
      skuCode: row.sku_code,
      barcode: row.barcode,
      supplierSkuCode: row.supplier_sku_code,
      attributes: row.attributes ? JSON.parse(row.attributes) : {},
      currency: row.currency,
      costPrice: row.cost_price,
      retailPrice: row.retail_price,
      salePrice: row.sale_price,
      weight: row.weight,
      weightUnit: row.weight_unit,
      length: row.length,
      width: row.width,
      height: row.height,
      dimensionUnit: row.dimension_unit,
      mainImage: row.main_image,
      images: row.images ? JSON.parse(row.images) : [],
      status: row.status,
      platformStatus: row.platform_status,
      supplierId: row.supplier_id,
      supplierName: row.supplier_name,
      rawData: row.raw_data ? JSON.parse(row.raw_data) : null,
      syncedAt: row.synced_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }
}

module.exports = UnifiedProduct;
