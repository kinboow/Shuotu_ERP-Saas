const express = require('express');
const router = express.Router();
const { Sequelize, DataTypes } = require('sequelize');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 初始化数据库连接（使用现有连接）
const sequelize = require('../config/database');

// 导入ERP商品模型
const ERPProductSkc = require('../models/ErpProductSkc');
const ERPProductSku = require('../models/ErpProductSku');

// 确保ERP商品图片目录存在
const erpImageDir = path.join(__dirname, '../uploads/erp-products');
if (!fs.existsSync(erpImageDir)) {
  fs.mkdirSync(erpImageDir, { recursive: true });
}

/**
 * 下载远程图片到本地服务器
 * @param {string} imageUrl - 远程图片URL
 * @param {string} prefix - 文件名前缀
 * @returns {Promise<string|null>} - 本地图片路径或null
 */
async function downloadImage(imageUrl, prefix = 'img') {
  if (!imageUrl) return null;
  
  try {
    // 生成唯一文件名
    const ext = path.extname(imageUrl.split('?')[0]) || '.jpg';
    const filename = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    const localPath = path.join(erpImageDir, filename);
    
    // 下载图片
    const response = await axios({
      method: 'GET',
      url: imageUrl,
      responseType: 'stream',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    // 保存到本地
    const writer = fs.createWriteStream(localPath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        // 返回相对路径（用于存储到数据库）
        resolve(`/uploads/erp-products/${filename}`);
      });
      writer.on('error', (err) => {
        console.error('保存图片失败:', err);
        resolve(null);
      });
    });
  } catch (error) {
    console.error('下载图片失败:', imageUrl, error.message);
    return null;
  }
}

/**
 * 批量下载图片
 * @param {string[]} imageUrls - 图片URL数组
 * @param {string} prefix - 文件名前缀
 * @returns {Promise<string[]>} - 本地图片路径数组
 */
async function downloadImages(imageUrls, prefix = 'img') {
  if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
    return [];
  }
  
  const localPaths = [];
  for (const url of imageUrls) {
    const localPath = await downloadImage(url, prefix);
    if (localPath) {
      localPaths.push(localPath);
    }
  }
  return localPaths;
}

// 定义ERP商品模型
const ERPProduct = sequelize.define('erp_products', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  product_code: {
    type: DataTypes.STRING(100),
    unique: true,
    allowNull: false
  },
  product_name_cn: DataTypes.STRING(500),
  product_name_en: DataTypes.STRING(500),
  product_desc: DataTypes.TEXT,
  brand: DataTypes.STRING(200),
  category: DataTypes.STRING(200),
  weight: DataTypes.INTEGER,
  length: DataTypes.DECIMAL(10, 2),
  width: DataTypes.DECIMAL(10, 2),
  height: DataTypes.DECIMAL(10, 2),
  cost_price: DataTypes.DECIMAL(10, 2),
  suggested_price: DataTypes.DECIMAL(10, 2),
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'CNY'
  }
}, {
  tableName: 'erp_products',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

/**
 * 创建ERP商品
 * POST /api/erp-products
 */
router.post('/', async (req, res) => {
  try {
    const {
      product_code,
      product_name_cn,
      product_name_en,
      product_desc,
      brand,
      category,
      weight,
      length,
      width,
      height,
      cost_price,
      suggested_price,
      currency,
      images,
      skus
    } = req.body;

    // 创建商品
    const product = await ERPProduct.create({
      product_code,
      product_name_cn,
      product_name_en,
      product_desc,
      brand,
      category,
      weight,
      length,
      width,
      height,
      cost_price,
      suggested_price,
      currency: currency || 'CNY'
    });

    // 保存图片
    if (images && images.length > 0) {
      // TODO: 保存图片到erp_product_images表
    }

    // 保存SKU
    if (skus && skus.length > 0) {
      // TODO: 保存SKU到erp_product_skus表
    }

    res.json({
      success: true,
      message: 'ERP商品创建成功',
      data: product
    });
  } catch (error) {
    console.error('创建ERP商品失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取ERP商品列表
 * GET /api/erp-products
 */
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, keyword } = req.query;
    
    const where = {};
    if (keyword) {
      where[Sequelize.Op.or] = [
        { product_code: { [Sequelize.Op.like]: `%${keyword}%` } },
        { product_name_cn: { [Sequelize.Op.like]: `%${keyword}%` } },
        { product_name_en: { [Sequelize.Op.like]: `%${keyword}%` } }
      ];
    }

    const { count, rows } = await ERPProduct.findAndCountAll({
      where,
      limit: parseInt(pageSize),
      offset: (parseInt(page) - 1) * parseInt(pageSize),
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        list: rows,
        total: count,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    console.error('获取ERP商品列表失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取ERP商品详情（包含完整的SPU -> SKC -> SKU层级结构）
 * GET /api/erp-products/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 获取SPU信息
    const product = await ERPProduct.findByPk(id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: '商品不存在'
      });
    }

    // 获取SKC列表
    const skcs = await ERPProductSkc.findAll({
      where: { erp_product_id: id },
      order: [['created_at', 'ASC']]
    });

    // 获取每个SKC下的SKU列表
    const skcList = [];
    for (const skc of skcs) {
      const skus = await ERPProductSku.findAll({
        where: { erp_skc_id: skc.id },
        order: [['created_at', 'ASC']]
      });
      skcList.push({
        ...skc.toJSON(),
        skus: skus.map(sku => sku.toJSON())
      });
    }

    // 获取没有关联SKC的SKU（兼容旧数据）
    const orphanSkus = await ERPProductSku.findAll({
      where: { 
        erp_product_id: id,
        erp_skc_id: null
      },
      order: [['created_at', 'ASC']]
    });

    res.json({
      success: true,
      data: {
        ...product.toJSON(),
        skcs: skcList,
        orphanSkus: orphanSkus.map(sku => sku.toJSON()),
        // 统计信息
        stats: {
          skcCount: skcList.length,
          skuCount: skcList.reduce((sum, skc) => sum + skc.skus.length, 0) + orphanSkus.length
        }
      }
    });
  } catch (error) {
    console.error('获取ERP商品详情失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 发布ERP商品到平台
 * POST /api/erp-products/:id/publish
 */
router.post('/:id/publish', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      platform, // 'shein', 'temu', 'tiktok'
      shopId,
      platformConfig // 平台特定配置
    } = req.body;

    const product = await ERPProduct.findByPk(id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: '商品不存在'
      });
    }

    // 根据平台调用不同的发布逻辑
    let result;
    switch (platform) {
      case 'shein':
        result = await publishToShein(product, shopId, platformConfig);
        break;
      case 'temu':
        result = await publishToTemu(product, shopId, platformConfig);
        break;
      case 'tiktok':
        result = await publishToTiktok(product, shopId, platformConfig);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: '不支持的平台'
        });
    }

    res.json({
      success: true,
      message: '发布成功',
      data: result
    });
  } catch (error) {
    console.error('发布商品失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 发布到SHEIN
async function publishToShein(product, shopId, config) {
  // TODO: 实现SHEIN发布逻辑
  throw new Error('SHEIN发布功能待实现');
}

// 发布到TEMU
async function publishToTemu(product, shopId, config) {
  // TODO: 实现TEMU发布逻辑
  throw new Error('TEMU发布功能待实现');
}

// 发布到TikTok
async function publishToTiktok(product, shopId, config) {
  // TODO: 实现TikTok发布逻辑
  throw new Error('TikTok发布功能待实现');
}

/**
 * 从在线商品复制到ERP商品
 * POST /api/erp-products/copy-from-online
 */
router.post('/copy-from-online', async (req, res) => {
  try {
    const { spuName, platformId } = req.body;

    if (!spuName) {
      return res.status(400).json({
        success: false,
        message: 'SPU名称不能为空'
      });
    }

    // 查询在线商品数据
    const onlineProducts = await sequelize.query(
      `SELECT * FROM SheinProducts WHERE spu_name = :spuName ORDER BY skc_name, sku_code`,
      {
        replacements: { spuName },
        type: Sequelize.QueryTypes.SELECT
      }
    );

    if (!onlineProducts || onlineProducts.length === 0) {
      return res.status(404).json({
        success: false,
        message: '未找到该商品'
      });
    }

    // 按SKC分组（SPU -> SKC -> SKU 三层结构）
    const skcGroups = {};
    onlineProducts.forEach(product => {
      const skcKey = product.skc_name || product.spu_name;
      if (!skcGroups[skcKey]) {
        skcGroups[skcKey] = [];
      }
      skcGroups[skcKey].push(product);
    });

    // 获取第一个商品的SPU级别信息
    const firstProduct = onlineProducts[0];
    
    // 生成唯一的SPU编码
    const spuCode = `ERP-${spuName}-${Date.now()}`;

    // 1. 创建ERP商品主记录（SPU级别）
    const erpProduct = await ERPProduct.create({
      product_code: spuCode,
      product_name_cn: firstProduct.product_name_cn || firstProduct.spu_name,
      product_name_en: firstProduct.product_name_en || '',
      product_desc: firstProduct.product_desc_cn || '',
      brand: firstProduct.brand_code || '',
      brand_code: firstProduct.brand_code || '',
      category: firstProduct.category_id?.toString() || '',
      category_id: firstProduct.category_id?.toString() || '',
      supplier_code: firstProduct.spu_supplier_code || '',
      weight: firstProduct.weight || 0,
      length: firstProduct.length || 0,
      width: firstProduct.width || 0,
      height: firstProduct.height || 0,
      cost_price: firstProduct.cost_price || 0,
      suggested_price: firstProduct.base_price || firstProduct.special_price || 0,
      currency: firstProduct.currency || 'CNY',
      product_attributes: firstProduct.product_attribute_list || []
    });

    let skcCount = 0;
    let skuCount = 0;

    // 2. 为每个SKC创建SKC记录
    for (const [skcName, skus] of Object.entries(skcGroups)) {
      const firstSku = skus[0];
      
      // 收集SKC远程图片URL
      const remoteSkcImages = [];
      if (firstSku.main_image_url) {
        remoteSkcImages.push(firstSku.main_image_url);
      }
      if (firstSku.images) {
        try {
          const images = typeof firstSku.images === 'string' ? JSON.parse(firstSku.images) : firstSku.images;
          if (Array.isArray(images)) {
            images.forEach(img => {
              const imgUrl = typeof img === 'string' ? img : img.imageUrl;
              if (imgUrl && !remoteSkcImages.includes(imgUrl)) {
                remoteSkcImages.push(imgUrl);
              }
            });
          }
        } catch (e) {
          console.error('解析图片数据失败:', e);
        }
      }

      // 下载SKC图片到本地
      console.log(`下载SKC ${skcName} 的图片 (${remoteSkcImages.length}张)...`);
      const localMainImage = await downloadImage(firstSku.main_image_url, `skc-${skcName}`);
      const localSkcImages = await downloadImages(remoteSkcImages, `skc-${skcName}`);
      
      // 下载详情图
      let localDetailImages = [];
      if (firstSku.site_detail_image_list) {
        try {
          const detailImages = typeof firstSku.site_detail_image_list === 'string' 
            ? JSON.parse(firstSku.site_detail_image_list) 
            : firstSku.site_detail_image_list;
          if (Array.isArray(detailImages)) {
            const detailUrls = detailImages.map(img => typeof img === 'string' ? img : img.imageUrl).filter(Boolean);
            localDetailImages = await downloadImages(detailUrls.slice(0, 10), `detail-${skcName}`); // 最多下载10张详情图
          }
        } catch (e) {
          console.error('解析详情图数据失败:', e);
        }
      }

      // 创建SKC记录（使用本地图片路径）
      const erpSkc = await ERPProductSkc.create({
        erp_product_id: erpProduct.id,
        skc_code: skcName,
        supplier_skc: firstSku.skc_supplier_code || '',
        skc_name_cn: firstSku.product_name_cn || skcName,
        skc_name_en: firstSku.product_name_en || '',
        color: firstSku.skc_attribute_value_id ? '' : '',
        color_attribute_id: firstSku.skc_attribute_id?.toString() || '',
        color_attribute_value_id: firstSku.skc_attribute_value_id?.toString() || '',
        main_image: localMainImage || firstSku.main_image_url || '', // 优先使用本地图片
        images: localSkcImages.length > 0 ? localSkcImages : remoteSkcImages, // 优先使用本地图片
        detail_images: localDetailImages.length > 0 ? localDetailImages : (firstSku.site_detail_image_list || []),
        skc_attributes: firstSku.skc_attribute_multi_list || []
      });

      skcCount++;

      // 3. 为每个SKU创建SKU记录
      for (const sku of skus) {
        // 提取尺码信息（从销售属性中）
        let sizeValue = '';
        if (sku.sale_attribute_list) {
          try {
            const saleAttrs = typeof sku.sale_attribute_list === 'string' 
              ? JSON.parse(sku.sale_attribute_list) 
              : sku.sale_attribute_list;
            if (Array.isArray(saleAttrs) && saleAttrs.length > 0) {
              // 通常第一个销售属性是尺码
              sizeValue = saleAttrs[0]?.attributeValueName || saleAttrs[0]?.value || '';
            }
          } catch (e) {
            console.error('解析销售属性失败:', e);
          }
        }

        // 下载SKU图片
        const localSkuImage = await downloadImage(sku.main_image_url, `sku-${sku.sku_code || skuCount}`);

        // 生成唯一的ERP SKU编码（避免重复）
        const erpSkuCode = `ERP-${sku.sku_code || 'SKU'}-${Date.now()}-${skuCount}`;
        
        await ERPProductSku.create({
          erp_product_id: erpProduct.id,
          erp_skc_id: erpSkc.id,
          sku_code: erpSkuCode,
          supplier_sku: sku.supplier_sku || sku.sku_code || '',
          color: erpSkc.color || '',
          size: sizeValue,
          sale_attributes: sku.sale_attribute_list || [],
          cost_price: sku.cost_price || 0,
          sale_price: sku.base_price || sku.special_price || 0,
          supply_price: sku.cost_price || 0,
          stock_quantity: 0,
          weight: sku.weight || 0,
          length: sku.length || 0,
          width: sku.width || 0,
          height: sku.height || 0,
          sku_image: localSkuImage || sku.main_image_url || '' // 优先使用本地图片
        });
        skuCount++;
      }
      
      // 更新SPU主图（使用第一个SKC的本地主图）
      if (skcCount === 1 && localMainImage) {
        await erpProduct.update({ main_images: [localMainImage] });
      }
    }

    // 如果还没有更新SPU主图，使用第一个SKC的图片
    if (!erpProduct.main_images || erpProduct.main_images.length === 0) {
      const firstSkcData = Object.values(skcGroups)[0]?.[0];
      if (firstSkcData?.main_image_url) {
        const localSpuImage = await downloadImage(firstSkcData.main_image_url, `spu-${spuName}`);
        const mainImages = localSpuImage ? [localSpuImage] : [firstSkcData.main_image_url];
        await erpProduct.update({ main_images: mainImages });
      }
    }

    res.json({
      success: true,
      message: '复制成功',
      data: {
        spuId: erpProduct.id,
        spuCode: spuCode,
        skcCount,
        skuCount
      }
    });

  } catch (error) {
    console.error('复制商品失败:', error);
    console.error('错误详情:', {
      name: error.name,
      message: error.message,
      errors: error.errors?.map(e => ({ message: e.message, path: e.path, value: e.value })),
      sql: error.sql
    });
    
    let errorMessage = '复制失败: ' + error.message;
    if (error.errors && error.errors.length > 0) {
      errorMessage = '复制失败: ' + error.errors.map(e => `${e.path}: ${e.message}`).join(', ');
    }
    
    res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
});

module.exports = router;
