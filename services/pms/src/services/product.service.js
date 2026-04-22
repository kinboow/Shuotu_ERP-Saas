/**
 * 商品服务
 */

const { Product, Sku, SkuMapping, sequelize } = require('../models');
const { Op } = require('sequelize');

class ProductService {
  generateId(prefix = 'P') {
    const date = new Date();
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}${dateStr}${random}`;
  }

  // 创建商品
  async createProduct(data) {
    const transaction = await sequelize.transaction();
    try {
      const productId = this.generateId('P');
      const product = await Product.create({
        productId,
        productName: data.productName,
        productNameEn: data.productNameEn,
        description: data.description,
        categoryId: data.categoryId,
        categoryName: data.categoryName,
        brand: data.brand,
        supplierId: data.supplierId,
        supplierName: data.supplierName,
        mainImage: data.mainImage,
        images: data.images,
        status: data.status || 'ACTIVE'
      }, { transaction });

      // 创建SKU
      if (data.skus && data.skus.length > 0) {
        const skus = data.skus.map((sku, index) => ({
          skuId: this.generateId('S'),
          productId,
          skuCode: sku.skuCode,
          barcode: sku.barcode,
          supplierSkuCode: sku.supplierSkuCode,
          attributes: sku.attributes,
          color: sku.color,
          colorCode: sku.colorCode,
          size: sku.size,
          sizeCode: sku.sizeCode,
          currency: sku.currency || 'USD',
          costPrice: sku.costPrice,
          retailPrice: sku.retailPrice,
          salePrice: sku.salePrice,
          weight: sku.weight,
          image: sku.image,
          status: 'ACTIVE'
        }));
        await Sku.bulkCreate(skus, { transaction });
      }

      await transaction.commit();
      return await this.getProductDetail(productId);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // 获取商品详情
  async getProductDetail(productId) {
    const product = await Product.findOne({
      where: { productId },
      include: [{
        model: Sku,
        as: 'skus',
        include: [{ model: SkuMapping, as: 'mappings' }]
      }]
    });
    if (!product) throw new Error('商品不存在');
    return product;
  }

  // 查询商品列表
  async queryProducts(params = {}) {
    const { categoryId, supplierId, status, keyword, page = 1, pageSize = 20 } = params;
    const where = {};
    if (categoryId) where.categoryId = categoryId;
    if (supplierId) where.supplierId = supplierId;
    if (status) where.status = status;
    if (keyword) {
      where[Op.or] = [
        { productName: { [Op.like]: `%${keyword}%` } },
        { productId: { [Op.like]: `%${keyword}%` } }
      ];
    }

    const { count, rows } = await Product.findAndCountAll({
      where,
      include: [{ model: Sku, as: 'skus' }],
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    return { list: rows, total: count, page, pageSize, totalPages: Math.ceil(count / pageSize) };
  }

  // 更新商品
  async updateProduct(productId, data) {
    const product = await Product.findOne({ where: { productId } });
    if (!product) throw new Error('商品不存在');
    await product.update(data);
    return await this.getProductDetail(productId);
  }

  // 创建SKU映射
  async createMapping(data) {
    const { internalSkuId, platform, shopId, platformSkuId, platformProductId, platformSkuCode, platformProductName } = data;
    
    // 检查内部SKU是否存在
    const sku = await Sku.findOne({ where: { skuId: internalSkuId } });
    if (!sku) throw new Error('内部SKU不存在');

    // 检查映射是否已存在
    const existing = await SkuMapping.findOne({
      where: { platform, shopId, platformSkuId }
    });
    if (existing) {
      await existing.update({ internalSkuId, platformProductId, platformSkuCode, platformProductName, status: 'ACTIVE' });
      return existing;
    }

    return await SkuMapping.create({
      internalSkuId, platform, shopId, platformSkuId, platformProductId, platformSkuCode, platformProductName, status: 'ACTIVE'
    });
  }

  // 批量创建映射
  async batchCreateMappings(mappings) {
    const results = { success: 0, failed: 0, errors: [] };
    for (const mapping of mappings) {
      try {
        await this.createMapping(mapping);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({ mapping, error: error.message });
      }
    }
    return results;
  }

  // 根据平台SKU查找内部SKU
  async findInternalSku(platform, shopId, platformSkuId) {
    const mapping = await SkuMapping.findOne({
      where: { platform, shopId, platformSkuId, status: 'ACTIVE' },
      include: [{ model: Sku, as: 'sku', include: [{ model: Product, as: 'product' }] }]
    });
    return mapping;
  }

  // 查询SKU映射
  async queryMappings(params = {}) {
    const { platform, shopId, internalSkuId, page = 1, pageSize = 20 } = params;
    const where = {};
    if (platform) where.platform = platform;
    if (shopId) where.shopId = shopId;
    if (internalSkuId) where.internalSkuId = internalSkuId;

    const { count, rows } = await SkuMapping.findAndCountAll({
      where,
      include: [{ model: Sku, as: 'sku' }],
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    return { list: rows, total: count, page, pageSize };
  }

  // 删除映射
  async deleteMapping(id) {
    const mapping = await SkuMapping.findByPk(id);
    if (!mapping) throw new Error('映射不存在');
    await mapping.update({ status: 'DELETED' });
    return { success: true };
  }
}

module.exports = new ProductService();
