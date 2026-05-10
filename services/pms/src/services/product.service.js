/**
 * 商品服务
 */

const { Product, Sku, SkuMapping, sequelize } = require('../models');
const { Op } = require('sequelize');
const { ensureTenantColumns, normalizeEnterpriseId, getCurrentEnterpriseId } = require('./tenant-context.service');

class ProductService {
  resolveEnterpriseId(enterpriseId = undefined) {
    const explicitEnterpriseId = normalizeEnterpriseId(enterpriseId);
    if (explicitEnterpriseId !== null) {
      return explicitEnterpriseId;
    }

    const contextEnterpriseId = getCurrentEnterpriseId();
    return contextEnterpriseId === null ? 0 : contextEnterpriseId;
  }

  generateId(prefix = 'P') {
    const date = new Date();
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}${dateStr}${random}`;
  }

  // 创建商品
  async createProduct(data, enterpriseId = undefined) {
    await ensureTenantColumns();
    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);
    const transaction = await sequelize.transaction();
    try {
      const productId = this.generateId('P');
      const product = await Product.create({
        enterpriseId: scopedEnterpriseId,
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
          enterpriseId: scopedEnterpriseId,
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
      return await this.getProductDetail(productId, scopedEnterpriseId);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // 获取商品详情
  async getProductDetail(productId, enterpriseId = undefined) {
    await ensureTenantColumns();
    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);
    const product = await Product.findOne({
      where: { productId, enterpriseId: scopedEnterpriseId },
      include: [{
        model: Sku,
        as: 'skus',
        where: { enterpriseId: scopedEnterpriseId },
        required: false,
        include: [{ model: SkuMapping, as: 'mappings', where: { enterpriseId: scopedEnterpriseId }, required: false }]
      }]
    });
    if (!product) throw new Error('商品不存在');
    return product;
  }

  // 查询商品列表
  async queryProducts(params = {}, enterpriseId = undefined) {
    await ensureTenantColumns();
    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);
    const { categoryId, supplierId, status, keyword, page = 1, pageSize = 20 } = params;
    const where = { enterpriseId: scopedEnterpriseId };
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
      include: [{ model: Sku, as: 'skus', where: { enterpriseId: scopedEnterpriseId }, required: false }],
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    return { list: rows, total: count, page, pageSize, totalPages: Math.ceil(count / pageSize) };
  }

  // 更新商品
  async updateProduct(productId, data, enterpriseId = undefined) {
    await ensureTenantColumns();
    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);
    const product = await Product.findOne({ where: { productId, enterpriseId: scopedEnterpriseId } });
    if (!product) throw new Error('商品不存在');
    const payload = { ...data };
    delete payload.enterpriseId;
    delete payload.enterprise_id;
    await product.update(payload);
    return await this.getProductDetail(productId, scopedEnterpriseId);
  }

  // 创建SKU映射
  async createMapping(data, enterpriseId = undefined) {
    await ensureTenantColumns();
    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);
    const { internalSkuId, platform, shopId, platformSkuId, platformProductId, platformSkuCode, platformProductName } = data;
    
    // 检查内部SKU是否存在
    const sku = await Sku.findOne({ where: { skuId: internalSkuId, enterpriseId: scopedEnterpriseId } });
    if (!sku) throw new Error('内部SKU不存在');

    // 检查映射是否已存在
    const existing = await SkuMapping.findOne({
      where: { enterpriseId: scopedEnterpriseId, platform, shopId, platformSkuId }
    });
    if (existing) {
      await existing.update({ internalSkuId, platformProductId, platformSkuCode, platformProductName, status: 'ACTIVE' });
      return existing;
    }

    return await SkuMapping.create({
      enterpriseId: scopedEnterpriseId, internalSkuId, platform, shopId, platformSkuId, platformProductId, platformSkuCode, platformProductName, status: 'ACTIVE'
    });
  }

  // 批量创建映射
  async batchCreateMappings(mappings, enterpriseId = undefined) {
    const results = { success: 0, failed: 0, errors: [] };
    for (const mapping of mappings) {
      try {
        await this.createMapping(mapping, enterpriseId);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({ mapping, error: error.message });
      }
    }
    return results;
  }

  // 根据平台SKU查找内部SKU
  async findInternalSku(platform, shopId, platformSkuId, enterpriseId = undefined) {
    await ensureTenantColumns();
    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);
    const mapping = await SkuMapping.findOne({
      where: { enterpriseId: scopedEnterpriseId, platform, shopId, platformSkuId, status: 'ACTIVE' },
      include: [{ model: Sku, as: 'sku', where: { enterpriseId: scopedEnterpriseId }, include: [{ model: Product, as: 'product', where: { enterpriseId: scopedEnterpriseId } }] }]
    });
    return mapping;
  }

  // 查询SKU映射
  async queryMappings(params = {}, enterpriseId = undefined) {
    await ensureTenantColumns();
    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);
    const { platform, shopId, internalSkuId, page = 1, pageSize = 20 } = params;
    const where = { enterpriseId: scopedEnterpriseId };
    if (platform) where.platform = platform;
    if (shopId) where.shopId = shopId;
    if (internalSkuId) where.internalSkuId = internalSkuId;

    const { count, rows } = await SkuMapping.findAndCountAll({
      where,
      include: [{ model: Sku, as: 'sku', where: { enterpriseId: scopedEnterpriseId }, required: false }],
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    return { list: rows, total: count, page, pageSize };
  }

  // 删除映射
  async deleteMapping(id, enterpriseId = undefined) {
    await ensureTenantColumns();
    const scopedEnterpriseId = this.resolveEnterpriseId(enterpriseId);
    const mapping = await SkuMapping.findOne({ where: { id, enterpriseId: scopedEnterpriseId } });
    if (!mapping) throw new Error('映射不存在');
    await mapping.update({ status: 'DELETED' });
    return { success: true };
  }
}

module.exports = new ProductService();
