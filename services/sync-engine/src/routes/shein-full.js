/**
 * SHEIN(full)平台同步路由 - 全托管模式
 * 提供完整的SHEIN平台数据同步API
 */
const express = require('express');
const router = express.Router();
const SheinFullAdapter = require('../adapters/shein-full.adapter');
const SheinFullAuthService = require('../services/shein-full-auth.service');
const SheinFullShopService = require('../services/shein-full-shop.service');
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

// 获取适配器实例的辅助函数 (使用shein_full_shops表)
async function getAdapter(shopId) {
  const shopConfig = await SheinFullShopService.getShopConfig(shopId);
  return new SheinFullAdapter(shopConfig);
}

function parseJsonSafe(value, fallback) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  if (typeof value === 'object') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function extractImageUrl(image) {
  if (!image) return null;
  if (typeof image === 'string') return image;
  return image.imageUrl || image.image_url || image.url || null;
}

function findLangText(list, preferredLanguages = []) {
  if (!Array.isArray(list) || list.length === 0) {
    return null;
  }

  const normalized = preferredLanguages.map(lang => String(lang).toLowerCase());
  const matched = list.find(item => {
    const lang = String(item?.language || item?.lang || '').toLowerCase();
    return normalized.includes(lang);
  });

  if (matched) {
    return matched.productName || matched.name || matched.value || null;
  }

  const first = list[0];
  return first?.productName || first?.name || first?.value || null;
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function normalizeBarcodeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .flatMap(item => normalizeBarcodeList(item))
      .filter(Boolean);
  }
  if (typeof value === 'number') {
    return [String(value)];
  }
  if (typeof value === 'string') {
    return value
      .split(/[\s,;|]+/)
      .map(item => item.trim())
      .filter(Boolean);
  }
  if (typeof value === 'object') {
    return [
      ...normalizeBarcodeList(value.barcodeList),
      ...normalizeBarcodeList(value.barcode_list),
      ...normalizeBarcodeList(value.barcode),
      ...normalizeBarcodeList(value.code),
      ...normalizeBarcodeList(value.value),
      ...normalizeBarcodeList(value.supplierBarcode),
      ...normalizeBarcodeList(value.supplier_barcode)
    ];
  }
  return [];
}

function extractSkuBarcodeList(sku) {
  return extractSkuBarcodeInfo(sku).barcodeList;
}

function extractSkuBarcodeInfo(sku) {
  const result = [];
  const matchedFields = [];

  const pushBarcodeValues = (fieldPath, ...values) => {
    let hit = false;
    values.forEach(value => {
      const list = normalizeBarcodeList(value);
      if (list.length > 0) {
        hit = true;
        result.push(...list);
      }
    });
    if (hit) {
      matchedFields.push(fieldPath);
    }
  };

  const collectSupplierBarcodes = (supplierInfo, fieldPrefix) => {
    if (!supplierInfo || typeof supplierInfo !== 'object') {
      return;
    }

    pushBarcodeValues(
      `${fieldPrefix}.barcode*`,
      supplierInfo.barcodeList,
      supplierInfo.barcode_list,
      supplierInfo.barcode,
      supplierInfo.supplierBarcode,
      supplierInfo.supplier_barcode
    );

    const supplierBarcodeList = Array.isArray(supplierInfo.supplierBarcodeList)
      ? supplierInfo.supplierBarcodeList
      : (Array.isArray(supplierInfo.supplier_barcode_list) ? supplierInfo.supplier_barcode_list : []);

    supplierBarcodeList.forEach(item => {
      pushBarcodeValues(
        `${fieldPrefix}.supplierBarcodeList[].barcode*`,
        item?.barcodeList,
        item?.barcode_list,
        item?.barcode,
        item?.supplierBarcode,
        item?.supplier_barcode
      );
    });
  };

  pushBarcodeValues(
    'sku.barcode*',
    sku?.barcodeList,
    sku?.barcode_list,
    sku?.barcode,
    sku?.supplierBarcode,
    sku?.supplier_barcode
  );

  collectSupplierBarcodes(sku?.skuSupplierInfo, 'sku.skuSupplierInfo');
  collectSupplierBarcodes(sku?.sku_supplier_info, 'sku.sku_supplier_info');
  collectSupplierBarcodes(sku?.supplierInfo, 'sku.supplierInfo');

  const supplierBarcodeList = Array.isArray(sku?.supplierBarcodeList)
    ? sku.supplierBarcodeList
    : (Array.isArray(sku?.supplier_barcode_list) ? sku.supplier_barcode_list : []);

  supplierBarcodeList.forEach(item => {
    pushBarcodeValues(
      'sku.supplierBarcodeList[].barcode*',
      item?.barcodeList,
      item?.barcode_list,
      item?.barcode,
      item?.supplierBarcode,
      item?.supplier_barcode
    );
  });

  return {
    barcodeList: Array.from(new Set(result)),
    matchedFields: Array.from(new Set(matchedFields))
  };
}

function extractBarcodeSkuRowsFromDetail(detail, source) {
  const skcInfoList = Array.isArray(detail?.skcInfoList)
    ? detail.skcInfoList
    : (Array.isArray(detail?.skcList) ? detail.skcList : []);

  const skuRows = [];

  skcInfoList.forEach((skc) => {
    const skuInfoList = Array.isArray(skc?.skuInfoList)
      ? skc.skuInfoList
      : (Array.isArray(skc?.skuList) ? skc.skuList : []);

    skuInfoList.forEach((sku) => {
      const sheinSku = sku?.skuCode || sku?.sku_code || null;
      if (!sheinSku) {
        return;
      }

      const barcodeInfo = extractSkuBarcodeInfo(sku);

      skuRows.push({
        sheinSku,
        skcName: skc?.skcName || skc?.skc_name || null,
        supplierSku: sku?.supplierSku || sku?.supplier_sku || sku?.skuSupplierInfo?.supplierSku || sku?.skuSupplierInfo?.supplier_sku || sku?.sku_supplier_info?.supplierSku || sku?.sku_supplier_info?.supplier_sku || null,
        barcodeList: barcodeInfo.barcodeList,
        debugInfo: {
          source,
          matchedFields: barcodeInfo.matchedFields
        }
      });
    });
  });

  return skuRows;
}

function extractBarcodeSkuRowsFromStoredBarcode(barcodeData, source) {
  if (!Array.isArray(barcodeData) || barcodeData.length === 0) {
    return [];
  }

  return barcodeData
    .map((item) => ({
      sheinSku: item?.sheinSku || item?.skuCode || item?.sku_code || null,
      skcName: item?.skcName || item?.skc_name || null,
      supplierSku: item?.supplierSku || item?.supplier_sku || null,
      barcodeList: Array.from(new Set([
        ...normalizeBarcodeList(item?.barcodeList),
        ...(Array.isArray(item?.supplierBarcodeList)
          ? item.supplierBarcodeList.flatMap(entry => normalizeBarcodeList(entry?.barcodeList || entry?.barcode_list))
          : [])
      ])),
      debugInfo: {
        source,
        matchedFields: ['product.barcode']
      }
    }))
    .filter(row => row.sheinSku);
}

function mergeBarcodeSkuRows(...rowGroups) {
  const rowMap = new Map();

  rowGroups.flat().forEach((row) => {
    if (!row?.sheinSku) {
      return;
    }

    const existing = rowMap.get(row.sheinSku);
    if (!existing) {
      rowMap.set(row.sheinSku, {
        sheinSku: row.sheinSku,
        skcName: row.skcName || null,
        supplierSku: row.supplierSku || null,
        barcodeList: Array.from(new Set(Array.isArray(row.barcodeList) ? row.barcodeList.filter(Boolean) : [])),
        debugInfo: {
          sources: Array.from(new Set([
            ...(Array.isArray(row?.debugInfo?.sources) ? row.debugInfo.sources : []),
            ...(row?.debugInfo?.source ? [row.debugInfo.source] : [])
          ])),
          matchedFields: Array.isArray(row?.debugInfo?.matchedFields) ? row.debugInfo.matchedFields : []
        }
      });
      return;
    }

    existing.skcName = existing.skcName || row.skcName || null;
    existing.supplierSku = existing.supplierSku || row.supplierSku || null;
    existing.barcodeList = Array.from(new Set([
      ...(Array.isArray(existing.barcodeList) ? existing.barcodeList : []),
      ...(Array.isArray(row.barcodeList) ? row.barcodeList.filter(Boolean) : [])
    ]));
    existing.debugInfo = {
      sources: Array.from(new Set([
        ...(Array.isArray(existing?.debugInfo?.sources) ? existing.debugInfo.sources : []),
        ...(Array.isArray(row?.debugInfo?.sources) ? row.debugInfo.sources : []),
        ...(row?.debugInfo?.source ? [row.debugInfo.source] : [])
      ])),
      matchedFields: Array.from(new Set([
        ...(Array.isArray(existing?.debugInfo?.matchedFields) ? existing.debugInfo.matchedFields : []),
        ...(Array.isArray(row?.debugInfo?.matchedFields) ? row.debugInfo.matchedFields : [])
      ]))
    };
  });

  return Array.from(rowMap.values());
}

function summarizeBarcodeRows(rows) {
  const totalSkuCount = Array.isArray(rows) ? rows.length : 0;
  const skuWithBarcodeCount = Array.isArray(rows)
    ? rows.filter(row => Array.isArray(row?.barcodeList) && row.barcodeList.length > 0).length
    : 0;
  const fieldHitMap = {};

  (rows || []).forEach((row) => {
    const matchedFields = row?.debugInfo?.matchedFields || [];
    matchedFields.forEach(field => {
      fieldHitMap[field] = (fieldHitMap[field] || 0) + 1;
    });
  });

  return {
    totalSkuCount,
    skuWithBarcodeCount,
    skuWithoutBarcodeCount: Math.max(totalSkuCount - skuWithBarcodeCount, 0),
    hitFields: Object.entries(fieldHitMap)
      .map(([field, count]) => ({ field, count }))
      .sort((a, b) => b.count - a.count)
  };
}

function buildDetailFromProductRow(productRow) {
  const rawData = parseJsonSafe(productRow?.raw_data, {});
  const skcList = parseJsonSafe(productRow?.skc_list, []);
  const barcode = parseJsonSafe(productRow?.barcode, []);

  if (!Array.isArray(rawData.skcInfoList) || rawData.skcInfoList.length === 0) {
    if (Array.isArray(skcList) && skcList.length > 0) {
      rawData.skcInfoList = skcList;
    } else if (Array.isArray(rawData.skcList) && rawData.skcList.length > 0) {
      rawData.skcInfoList = rawData.skcList;
    }
  }

  if (!Array.isArray(rawData.barcode) || rawData.barcode.length === 0) {
    rawData.barcode = barcode;
  }

  return rawData;
}

function flattenProductRows(product) {
  const rawData = parseJsonSafe(product.raw_data, {});
  const skcListFromRaw = parseJsonSafe(product.skc_list, []);
  const barcodeData = parseJsonSafe(product.barcode, []);
  const skcList = Array.isArray(skcListFromRaw) && skcListFromRaw.length > 0
    ? skcListFromRaw
    : (Array.isArray(rawData.skcInfoList)
      ? rawData.skcInfoList
      : (Array.isArray(rawData.skcList) ? rawData.skcList : []));

  const spuImages = Array.isArray(rawData.spuImageInfoList) ? rawData.spuImageInfoList : [];
  const defaultMainImage = extractImageUrl(spuImages[0]);
  const productNameCn = findLangText(rawData.productMultiNameList, ['zh-cn', 'zh_cn', 'zh']);
  const productNameEn = findLangText(rawData.productMultiNameList, ['en', 'en-us', 'en_us']);
  const siteDetailImageList = parseJsonSafe(rawData.siteDetailImageList, []);
  const productAttributeList = parseJsonSafe(rawData.productAttributeInfoList, []);

  if (!Array.isArray(skcList) || skcList.length === 0) {
    return [{
      id: `${product.id}_0_0`,
      platform_id: product.shop_id,
      shop_id: product.shop_id,
      spu_name: product.spu_name,
      skc_name: product.skc_name || null,
      sku_code: null,
      supplier_sku: null,
      product_name: product.product_name || productNameCn || productNameEn,
      product_name_cn: productNameCn || product.product_name || null,
      product_name_en: productNameEn,
      brand_code: product.brand_code || rawData.brandCode || null,
      category_id: product.category_id || rawData.categoryId || null,
      main_image_url: defaultMainImage,
      base_price: null,
      special_price: null,
      cost_price: null,
      shelf_status: null,
      mall_state: null,
      stop_purchase: null,
      weight: null,
      length: null,
      width: null,
      height: null,
      barcode: barcodeData,
      images: spuImages,
      sale_attribute_list: [],
      site_detail_image_list: siteDetailImageList,
      product_attribute_list: productAttributeList,
      skc_attribute_multi_list: []
    }];
  }

  const rows = [];

  skcList.forEach((skc, skcIndex) => {
    const skuList = Array.isArray(skc?.skuInfoList)
      ? skc.skuInfoList
      : (Array.isArray(skc?.skuList) ? skc.skuList : []);
    const skcImages = Array.isArray(skc?.skcImageInfoList)
      ? skc.skcImageInfoList
      : (Array.isArray(skc?.imageInfoList) ? skc.imageInfoList : []);
    const skcMainImage = extractImageUrl(skc?.mainImage) ||
      extractImageUrl(skc?.main_image_url) ||
      extractImageUrl(skc?.mainImageUrl) ||
      extractImageUrl(skcImages[0]) ||
      defaultMainImage;
    const skcName = skc?.skcName || skc?.skc_name || product.skc_name || null;

    const list = skuList.length > 0 ? skuList : [null];

    list.forEach((sku, skuIndex) => {
      const skuCode = sku?.skuCode || sku?.sku_code || null;
      rows.push({
        id: `${product.id}_${skcIndex}_${skuIndex}`,
        platform_id: product.shop_id,
        shop_id: product.shop_id,
        spu_name: product.spu_name,
        skc_name: skcName,
        sku_code: skuCode,
        supplier_sku: sku?.supplierSku || sku?.supplier_sku || null,
        product_name: product.product_name || productNameCn || productNameEn,
        product_name_cn: productNameCn || product.product_name || null,
        product_name_en: productNameEn,
        brand_code: product.brand_code || rawData.brandCode || null,
        category_id: product.category_id || rawData.categoryId || null,
        main_image_url: skcMainImage,
        base_price: toNumberOrNull(sku?.basePrice ?? skc?.basePrice),
        special_price: toNumberOrNull(sku?.specialPrice ?? skc?.specialPrice),
        cost_price: toNumberOrNull(sku?.costPrice ?? skc?.costPrice),
        shelf_status: toNumberOrNull(sku?.shelfStatus ?? skc?.shelfStatus),
        mall_state: toNumberOrNull(sku?.mallState ?? skc?.mallState ?? sku?.saleStatus ?? skc?.saleStatus),
        stop_purchase: toNumberOrNull(sku?.stopPurchase ?? skc?.stopPurchase),
        weight: toNumberOrNull(sku?.weight),
        length: toNumberOrNull(sku?.length),
        width: toNumberOrNull(sku?.width),
        height: toNumberOrNull(sku?.height),
        barcode: barcodeData.filter(item => item?.sheinSku === skuCode),
        images: skcImages,
        sale_attribute_list: sku?.saleAttributeList || sku?.sale_attribute_list || [],
        site_detail_image_list: siteDetailImageList,
        product_attribute_list: productAttributeList,
        skc_attribute_multi_list: skc?.skcAttributeMultiList || skc?.skc_attribute_multi_list || []
      });
    });
  });

  return rows;
}

function normalizeSearchText(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim().toLowerCase();
}

function getRowSearchableValues(row) {
  const saleAttributeValues = Array.isArray(row?.sale_attribute_list)
    ? row.sale_attribute_list.map(item => item?.attributeValueName || item?.attribute_value_name || item?.value || item?.attrValueName || item?.name || '').filter(Boolean)
    : [];
  const barcodeValues = Array.isArray(row?.barcode)
    ? row.barcode.flatMap(item => normalizeBarcodeList(item?.barcodeList || item?.barcode || item?.supplierBarcodeList || item?.supplierBarcode || item?.supplier_sku || item?.supplierSku))
    : [];

  return [
    row?.spu_name,
    row?.skc_name,
    row?.sku_code,
    row?.supplier_sku,
    row?.product_name,
    row?.product_name_cn,
    row?.product_name_en,
    row?.brand_code,
    row?.category_id,
    ...saleAttributeValues,
    ...barcodeValues
  ]
    .map(normalizeSearchText)
    .filter(Boolean);
}

function matchesLocalProductSearch(row, keyword) {
  const normalizedKeyword = normalizeSearchText(keyword);
  if (!normalizedKeyword) {
    return true;
  }

  return getRowSearchableValues(row).some(value => value.includes(normalizedKeyword));
}

// ==================== 店铺管理 ====================

/**
 * 获取所有店铺列表
 * GET /api/shein-full/shops
 */
router.get('/shops', async (req, res) => {
  try {
    const includeDisabled = req.query.includeDisabled === 'true';
    const shops = await SheinFullShopService.getAllShops(includeDisabled);
    res.json({ success: true, data: shops });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 根据SPU获取SKU条码列表（barcode_list）
 * POST /api/shein-full-products/barcode-list
 */
router.post('/barcode-list', async (req, res) => {
  try {
    const { shopId, spuName, languageList } = req.body;

    if (!shopId) {
      return res.status(400).json({ success: false, message: 'shopId不能为空' });
    }
    if (!spuName) {
      return res.status(400).json({ success: false, message: 'spuName不能为空' });
    }

    const safeLanguageList = Array.isArray(languageList) && languageList.length > 0
      ? languageList.slice(0, 5)
      : ['zh-cn', 'en', 'ko', 'ja'];

    const adapter = await getAdapter(shopId);
    let apiSkuRows = [];
    let apiError = null;
    try {
      const detailResult = await adapter.getProductDetail(spuName, safeLanguageList);
      const detail = detailResult?.info || {};
      apiSkuRows = mergeBarcodeSkuRows(
        extractBarcodeSkuRowsFromDetail(detail, 'api'),
        extractBarcodeSkuRowsFromStoredBarcode(detail?.barcode, 'api-barcode-field')
      );
    } catch (error) {
      apiError = error.message;
      console.warn(`[barcode-list] 实时获取商品详情失败: ${spuName}, ${error.message}`);
    }

    let dbSkuRows = [];
    let dbError = null;
    try {
      const productRow = await sequelize.query(
        `SELECT raw_data, skc_list, barcode FROM shein_full_products WHERE shop_id = :shopId AND spu_name = :spuName ORDER BY id DESC LIMIT 1`,
        {
          replacements: { shopId, spuName },
          type: QueryTypes.SELECT
        }
      );

      const localProduct = Array.isArray(productRow) ? productRow[0] : null;
      if (localProduct) {
        dbSkuRows = mergeBarcodeSkuRows(
          extractBarcodeSkuRowsFromDetail(buildDetailFromProductRow(localProduct), 'db'),
          extractBarcodeSkuRowsFromStoredBarcode(parseJsonSafe(localProduct?.barcode, []), 'db-barcode-field')
        );
      }
    } catch (error) {
      dbError = error.message;
      console.warn(`[barcode-list] 读取本地商品缓存失败: ${spuName}, ${error.message}`);
    }

    const skuRows = mergeBarcodeSkuRows(apiSkuRows, dbSkuRows);

    const debug = {
      spuName,
      requestedLanguages: safeLanguageList,
      apiError,
      dbError,
      api: summarizeBarcodeRows(apiSkuRows),
      db: summarizeBarcodeRows(dbSkuRows),
      merged: summarizeBarcodeRows(skuRows),
      skuSources: skuRows.map(row => ({
        sheinSku: row.sheinSku,
        source: row?.debugInfo?.sources || [],
        matchedFields: row?.debugInfo?.matchedFields || [],
        barcodeCount: Array.isArray(row?.barcodeList) ? row.barcodeList.length : 0
      }))
    };

    return res.json({ success: true, data: skuRows, debug });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 查看本地商品 barcode 字段原始内容
 * POST /api/shein-full-products/barcode-field
 */
router.post('/barcode-field', async (req, res) => {
  try {
    const { shopId, spuName } = req.body;

    if (!shopId) {
      return res.status(400).json({ success: false, message: 'shopId不能为空' });
    }
    if (!spuName) {
      return res.status(400).json({ success: false, message: 'spuName不能为空' });
    }

    const productRows = await sequelize.query(
      `SELECT id, shop_id, spu_name, barcode, updated_at
       FROM shein_full_products
       WHERE shop_id = :shopId AND spu_name = :spuName
       ORDER BY id DESC
       LIMIT 1`,
      {
        replacements: { shopId, spuName },
        type: QueryTypes.SELECT
      }
    );

    const productRow = Array.isArray(productRows) ? productRows[0] : null;
    const barcode = parseJsonSafe(productRow?.barcode, []);
    const barcodeSummary = {
      skuCount: Array.isArray(barcode) ? barcode.length : 0,
      skuWithBarcodeCount: Array.isArray(barcode)
        ? barcode.filter(item => Array.isArray(item?.barcodeList) && item.barcodeList.length > 0).length
        : 0,
      totalBarcodeCount: Array.isArray(barcode)
        ? barcode.reduce((sum, item) => sum + (Array.isArray(item?.barcodeList) ? item.barcodeList.length : 0), 0)
        : 0,
      barcodeTypes: Array.isArray(barcode)
        ? Array.from(new Set(barcode.flatMap(item => (
          Array.isArray(item?.supplierBarcodeList)
            ? item.supplierBarcodeList.map(entry => entry?.barcodeType).filter(Boolean)
            : []
        ))))
        : []
    };

    return res.json({
      success: true,
      data: {
        exists: !!productRow,
        id: productRow?.id || null,
        shopId: productRow?.shop_id || Number(shopId),
        spuName: productRow?.spu_name || spuName,
        updatedAt: productRow?.updated_at || null,
        barcode,
        barcodeSummary
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 查询本地已同步的SHEIN商品列表（从数据库读取）
 * GET /api/shein-full-products/local
 */
router.get('/local', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100);
    const offset = (page - 1) * pageSize;

    const search = (req.query.search || '').trim();
    const countOnly = req.query.countOnly === 'true';
    const parsedShopId = Number.parseInt(req.query.shop_id ?? req.query.shopId, 10);
    const shopId = Number.isNaN(parsedShopId) ? null : parsedShopId;
    const shelfStatus = req.query.shelf_status === undefined || req.query.shelf_status === ''
      ? null
      : Number(req.query.shelf_status);
    const mallState = req.query.mall_state === undefined || req.query.mall_state === ''
      ? null
      : Number(req.query.mall_state);

    const hasShelfFilter = shelfStatus !== null && !Number.isNaN(shelfStatus);
    const hasMallFilter = mallState !== null && !Number.isNaN(mallState);
    const where = [];
    const replacements = {};

    if (shopId !== null) {
      where.push('shop_id = :shopId');
      replacements.shopId = shopId;
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    // 如果有SKU维度筛选，需要先取全量再过滤，保证 totalSpu 正确
    const needInMemoryFilter = Boolean(search) || hasShelfFilter || hasMallFilter;

    if (!needInMemoryFilter) {
      const [countRow] = await sequelize.query(
        `SELECT COUNT(1) AS total FROM shein_full_products ${whereSql}`,
        { replacements, type: QueryTypes.SELECT }
      );

      const totalSpu = Number(countRow?.total || 0);

      if (countOnly) {
        return res.json({
          success: true,
          data: { totalSpu }
        });
      }

      const list = await sequelize.query(
        `SELECT p.id, p.shop_id, p.spu_name, p.skc_name, p.product_name, p.brand_code, p.category_id, p.skc_list, p.barcode, p.raw_data
         FROM shein_full_products p
         INNER JOIN (
           SELECT id
           FROM shein_full_products
           ${whereSql}
           ORDER BY updated_at DESC, id DESC
           LIMIT :limit OFFSET :offset
         ) page_ids ON page_ids.id = p.id
         ORDER BY p.updated_at DESC, p.id DESC`,
        {
          replacements: { ...replacements, limit: pageSize, offset },
          type: QueryTypes.SELECT
        }
      );

      const rows = list.flatMap(flattenProductRows);
      const skcSet = new Set(rows.map(item => `${item.spu_name || ''}_${item.skc_name || ''}`));

      return res.json({
        success: true,
        data: rows,
        pagination: {
          page,
          pageSize,
          totalSpu,
          totalSkc: skcSet.size
        }
      });
    }

    const allSpuList = await sequelize.query(
      `SELECT id, shop_id, spu_name, skc_name, product_name, brand_code, category_id, skc_list, barcode, raw_data
       FROM shein_full_products
       ${whereSql}`,
      { replacements, type: QueryTypes.SELECT }
    );

    allSpuList.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));

    const allRows = allSpuList.flatMap(flattenProductRows).filter(item => {
      if (!matchesLocalProductSearch(item, search)) {
        return false;
      }
      if (hasShelfFilter && Number(item.shelf_status) !== shelfStatus) {
        return false;
      }
      if (hasMallFilter && Number(item.mall_state) !== mallState) {
        return false;
      }
      return true;
    });

    const groupedBySpu = new Map();
    allRows.forEach(row => {
      const key = row.spu_name || '';
      if (!groupedBySpu.has(key)) {
        groupedBySpu.set(key, []);
      }
      groupedBySpu.get(key).push(row);
    });

    const allSpuNames = Array.from(groupedBySpu.keys());
    const totalSpu = allSpuNames.length;

    if (countOnly) {
      return res.json({
        success: true,
        data: { totalSpu }
      });
    }

    const pagedSpuNames = allSpuNames.slice(offset, offset + pageSize);
    const pagedRows = [];
    pagedSpuNames.forEach(spuName => {
      pagedRows.push(...(groupedBySpu.get(spuName) || []));
    });

    const skcSet = new Set(pagedRows.map(item => `${item.spu_name || ''}_${item.skc_name || ''}`));

    return res.json({
      success: true,
      data: pagedRows,
      pagination: {
        page,
        pageSize,
        totalSpu,
        totalSkc: skcSet.size
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 获取单个店铺详情
 * GET /api/shein-full/shops/:id
 */
router.get('/shops/:id', async (req, res) => {
  try {
    const shop = await SheinFullShopService.getShopById(req.params.id);
    if (!shop) {
      return res.status(404).json({ success: false, message: '店铺不存在' });
    }
    // 隐藏敏感信息
    shop.app_secret = shop.app_secret ? '******' : null;
    shop.secret_key = shop.secret_key ? '******' : null;
    res.json({ success: true, data: shop });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 创建店铺
 * POST /api/shein-full/shops
 */
router.post('/shops', async (req, res) => {
  try {
    const result = await SheinFullShopService.createShop(req.body);
    res.json({ success: true, data: result, message: '店铺创建成功，请进行授权' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 更新店铺
 * PUT /api/shein-full/shops/:id
 */
router.put('/shops/:id', async (req, res) => {
  try {
    const result = await SheinFullShopService.updateShop(req.params.id, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 删除店铺
 * DELETE /api/shein-full/shops/:id
 */
router.delete('/shops/:id', async (req, res) => {
  try {
    const result = await SheinFullShopService.deleteShop(req.params.id);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 测试店铺连接
 * POST /api/shein-full/shops/:id/test
 */
router.post('/shops/:id/test', async (req, res) => {
  try {
    const result = await SheinFullShopService.testConnection(req.params.id);
    res.json({ 
      success: result.valid, 
      message: result.valid ? '连接成功' : `连接失败: ${result.error}`,
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== 授权相关 ====================

/**
 * 生成授权URL (基于店铺ID)
 * POST /api/shein-full/auth/url
 * redirectUrl可选，不传则从数据库platform_configs表获取
 */
router.post('/auth/url', async (req, res) => {
  try {
    const { shopId, redirectUrl } = req.body;
    
    if (!shopId) {
      return res.status(400).json({ success: false, message: 'shopId不能为空' });
    }

    // redirectUrl可选，不传则从数据库获取
    const result = await SheinFullShopService.generateAuthUrl(shopId, redirectUrl || null);
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 直接生成授权URL (不需要先创建店铺)
 * POST /api/shein-full/auth/generate-url
 */
router.post('/auth/generate-url', async (req, res) => {
  try {
    const { appId, redirectUrl, state, isTest } = req.body;
    
    if (!appId) {
      return res.status(400).json({ success: false, message: 'appId不能为空' });
    }
    if (!redirectUrl) {
      return res.status(400).json({ success: false, message: 'redirectUrl不能为空' });
    }

    const authUrl = SheinFullAuthService.generateAuthUrl(
      appId, 
      redirectUrl, 
      state || `direct_${Date.now()}`,
      isTest === true
    );
    
    res.json({ success: true, data: { authUrl, appId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 授权回调处理 (基于店铺ID)
 * POST /api/shein-full/auth/callback
 */
router.post('/auth/callback', async (req, res) => {
  try {
    const { shopId, tempToken } = req.body;
    
    if (!shopId) {
      return res.status(400).json({ success: false, message: 'shopId不能为空' });
    }
    if (!tempToken) {
      return res.status(400).json({ success: false, message: 'tempToken不能为空' });
    }

    const result = await SheinFullShopService.handleAuthCallback(shopId, tempToken);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 直接获取Token (不保存到数据库)
 * POST /api/shein-full/auth/get-token
 */
router.post('/auth/get-token', async (req, res) => {
  try {
    const { tempToken, appId, appSecret, isTest } = req.body;
    
    if (!tempToken) {
      return res.status(400).json({ success: false, message: 'tempToken不能为空' });
    }
    if (!appId) {
      return res.status(400).json({ success: false, message: 'appId不能为空' });
    }
    if (!appSecret) {
      return res.status(400).json({ success: false, message: 'appSecret不能为空' });
    }

    const authData = await SheinFullAuthService.getTokenByTemp(
      tempToken, 
      appId, 
      appSecret, 
      isTest === true
    );
    
    res.json({ success: true, data: authData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 获取授权日志
 * GET /api/shein-full/auth/logs/:shopId
 */
router.get('/auth/logs/:shopId', async (req, res) => {
  try {
    const logs = await SheinFullShopService.getAuthLogs(req.params.shopId);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== 商品分类 ====================

/**
 * 获取商品分类树
 * POST /api/shein-full/categories
 */
router.post('/categories', async (req, res) => {
  try {
    const { shopId } = req.body;
    const adapter = await getAdapter(shopId);
    const result = await adapter.getCategoryTree();
    res.json({ success: true, data: result.info });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 获取商品属性模板
 * POST /api/shein-full/attributes
 */
router.post('/attributes', async (req, res) => {
  try {
    const { shopId, productTypeIds } = req.body;
    const adapter = await getAdapter(shopId);
    const result = await adapter.getAttributeTemplate(productTypeIds);
    res.json({ success: true, data: result.info });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 获取商品发布规范
 * POST /api/shein-full/publish-standard
 */
router.post('/publish-standard', async (req, res) => {
  try {
    const { shopId, categoryId, spuName } = req.body;
    const adapter = await getAdapter(shopId);
    const result = await adapter.getPublishStandard({ categoryId, spuName });
    res.json({ success: true, data: result.info });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== 商品管理 ====================

/**
 * 获取商品列表
 * POST /api/shein-full/products
 */
router.post('/products', async (req, res) => {
  try {
    const { shopId, pageNum, pageSize, insertTimeStart, insertTimeEnd, updateTimeStart, updateTimeEnd } = req.body;
    const adapter = await getAdapter(shopId);
    const result = await adapter.getProductList({
      pageNum, pageSize, insertTimeStart, insertTimeEnd, updateTimeStart, updateTimeEnd
    });
    res.json({ success: true, data: result.info });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 获取商品详情
 * POST /api/shein-full/product-detail
 */
router.post('/product-detail', async (req, res) => {
  try {
    const { shopId, spuName, languageList } = req.body;
    const adapter = await getAdapter(shopId);
    const result = await adapter.getProductDetail(spuName, languageList || ['zh-cn']);
    res.json({ success: true, data: adapter.transformProductDetail(result.info) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 发布/编辑商品
 * POST /api/shein-full/publish-product
 */
router.post('/publish-product', async (req, res) => {
  try {
    const { shopId, productData } = req.body;
    const adapter = await getAdapter(shopId);
    const result = await adapter.publishProduct(productData);
    res.json({ success: true, data: result.info });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 图片链接转换
 * POST /api/shein-full/transform-image
 */
router.post('/transform-image', async (req, res) => {
  try {
    const { shopId, imageUrl, imageType } = req.body;
    const adapter = await getAdapter(shopId);
    const result = await adapter.transformImage(imageUrl, imageType);
    res.json({ success: true, data: result.info });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 图文识别推荐类目
 * POST /api/shein-full/suggest-category
 */
router.post('/suggest-category', async (req, res) => {
  try {
    const { shopId, url, productInfo } = req.body;
    const adapter = await getAdapter(shopId);
    const result = await adapter.suggestCategory({ url, productInfo });
    res.json({ success: true, data: result.info });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 商品打印条码
 * POST /api/shein-full/print-barcode
 * @body shopId - 店铺ID
 * @body data - [{orderNo, supplierSku, sheinSku, printNumber, printContentType}]
 * @body type - 条码类型 1:商品条码 2:普通订单条码（推荐，默认2）
 * @body printFormatType - 打印格式 1:20*70（默认） 2:25*40
 */
router.post('/print-barcode', async (req, res) => {
  try {
    const { shopId, data, type = 2, printFormatType = 1 } = req.body;

    if (!shopId) {
      return res.status(400).json({ success: false, message: '缺少shopId参数' });
    }
    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ success: false, message: '缺少data参数或data为空' });
    }
    if (data.length > 200) {
      return res.status(400).json({ success: false, message: '单次打印数据不能超过200组' });
    }

    const adapter = await getAdapter(shopId);
    const result = await adapter.printBarcode(data, type, printFormatType);

    res.json({
      success: true,
      url: result.url,
      errorData: result.errorData,
      codingInfoList: result.codingInfoList
    });
  } catch (error) {
    console.error('[print-barcode] 错误:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 查询SKU销量
 * POST /api/shein-full/sku-sales
 */
router.post('/sku-sales', async (req, res) => {
  try {
    const { shopId, skuCodeList } = req.body;
    const adapter = await getAdapter(shopId);
    const result = await adapter.getSkuSales(skuCodeList);
    res.json({ success: true, data: result.info });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== 采购单管理 ====================

/**
 * 获取采购单列表
 * POST /api/shein-full/purchase-orders
 */
router.post('/purchase-orders', async (req, res) => {
  try {
    const { shopId, ...params } = req.body;
    const adapter = await getAdapter(shopId);
    const result = await adapter.getPurchaseOrders(params);
    const list = (result.info?.list || []).map(o => adapter.transformOrder(o));
    res.json({
      success: true,
      data: {
        list,
        count: result.info?.count || 0,
        pageNo: result.info?.pageNo,
        pageSize: result.info?.pageSize
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 创建备货单
 * POST /api/shein-full/create-stock-order
 */
router.post('/create-stock-order', async (req, res) => {
  try {
    const { shopId, paramList } = req.body;
    const adapter = await getAdapter(shopId);
    const result = await adapter.createStockOrder(paramList);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 查询备货单审核列表
 * POST /api/shein-full/review-orders
 */
router.post('/review-orders', async (req, res) => {
  try {
    const { shopId, ...params } = req.body;
    const adapter = await getAdapter(shopId);
    const result = await adapter.getReviewOrders(params);
    res.json({ success: true, data: result.info });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 查询商品备货信息
 * POST /api/shein-full/stock-goods-list
 */
router.post('/stock-goods-list', async (req, res) => {
  try {
    const { shopId, pageNum, pageSize } = req.body;
    const adapter = await getAdapter(shopId);
    const result = await adapter.getStockGoodsList({ pageNum, pageSize });
    res.json({ success: true, data: result.info });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * JIT母单子单关系查询
 * POST /api/shein-full/jit-orders
 */
router.post('/jit-orders', async (req, res) => {
  try {
    const { shopId, orderNos, selectJitMother } = req.body;
    const adapter = await getAdapter(shopId);
    const result = await adapter.getMotherChildOrders(orderNos, selectJitMother);
    res.json({ success: true, data: result.info });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== 库存管理 ====================

/**
 * 查询库存
 * POST /api/shein-full/inventory
 */
router.post('/inventory', async (req, res) => {
  try {
    const { shopId, skuCodeList, skcNameList, spuNameList, warehouseType } = req.body;
    const adapter = await getAdapter(shopId);
    const result = await adapter.getInventory({
      skuCodeList, skcNameList, spuNameList, warehouseType
    });
    res.json({ success: true, data: result.info });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== 辅助功能 ====================

/**
 * 批量查询SKU的分类树路径 (供OMS代理调用)
 * POST /api/shein-full/sku-categories
 */
router.post('/sku-categories', async (req, res) => {
  try {
    const { shopId, skus } = req.body;
    if (!shopId) return res.status(400).json({ success: false, message: 'shopId必填' });
    if (!skus || !Array.isArray(skus) || skus.length === 0) return res.json({ success: true, data: {} });

    const adapter = await getAdapter(shopId);

    // 1. 调用商品综合查询接口查 categoryId
    // 由于 skuCodeList 单次最多10个，需要分批查询
    const categoryIdMap = {}; // sku_code -> category_id
    const chunkSize = 10;

    for (let i = 0; i < skus.length; i += chunkSize) {
      const chunkSkus = skus.slice(i, i + chunkSize);
      try {
        const searchRes = await adapter.searchProduct({
          skuCodeList: chunkSkus,
          pageSize: 10,
          language: 'en'
        });

        if (searchRes && searchRes.data && searchRes.data.length > 0) {
          // 遍历 SPU 列表
          searchRes.data.forEach(spu => {
            const catId = spu.categoryId;
            if (catId && spu.skcList) {
              spu.skcList.forEach(skc => {
                if (skc.skuList) {
                  skc.skuList.forEach(sku => {
                    if (chunkSkus.includes(sku.skuCode)) {
                      categoryIdMap[sku.skuCode] = catId;
                    }
                  });
                }
              });
            }
          });
        }
      } catch (err) {
        console.error('searchProduct error for skus:', chunkSkus, err.message);
      }
    }

    // 2. 调用 category-tree 接口查全部树，提取出树状关系
    // 如果没有获取到任何 categoryId，就直接返回空
    if (Object.keys(categoryIdMap).length === 0) {
      return res.json({ success: true, data: {} });
    }

    let categoryTree = [];
    try {
      const treeRes = await adapter.getCategoryTree({ language: 'en' });
      categoryTree = treeRes.info?.data || [];
    } catch (err) {
      console.error('getCategoryTree error:', err.message);
    }

    // 将 category tree 展开成平级，构建子父映射或全路径映射
    // 递归查找路径
    const catIdToPath = {};

    const traverseTree = (nodes, currentPath = []) => {
      for (const node of nodes) {
        const id = node.category_id;
        const name = node.category_name;
        const newPath = [...currentPath, name];

        // 只有这里存在的时候，或者就是末级，记录下来
        // SHEIN 的分类id比较独特，直接将所有节点的路径都保存下
        catIdToPath[id] = newPath.join('/');

        if (node.children && node.children.length > 0) {
          traverseTree(node.children, newPath);
        }
      }
    };

    if (categoryTree.length > 0) {
      traverseTree(categoryTree);
    }

    // 3. 构建最终的结果映射 sku_code -> category_path (仅末级类目)
    const result = {};
    for (const sku of skus) {
      const catId = categoryIdMap[sku];
      if (catId && catIdToPath[catId]) {
        const fullPath = catIdToPath[catId];
        const parts = fullPath.split('/');
        result[sku] = parts[parts.length - 1];
      }
    }

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/sku-label-metadata', async (req, res) => {
  try {
    const { shopId, skus } = req.body;
    if (!shopId) return res.status(400).json({ success: false, message: 'shopId必填' });
    if (!skus || !Array.isArray(skus) || skus.length === 0) return res.json({ success: true, data: {} });

    const adapter = await getAdapter(shopId);
    const targetSkus = Array.from(new Set(skus.filter(Boolean)));
    const baseLanguage = 'en';
    const attributeLanguage = 'zh-cn';
    const chunkSize = 10;
    const categoryIdMap = {};
    const labelMetaMap = {};

    const pickPreferredAttributeRows = (attrList, languages) => {
      const rows = Array.isArray(attrList) ? attrList.filter(item => item && (item.attributeName || item.attributeValueName)) : [];
      if (rows.length === 0) {
        return [];
      }

      const grouped = new Map();
      rows.forEach((item) => {
        const key = item.attributeId || `${item.attributeName || ''}_${item.attributeValueName || ''}`;
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key).push(item);
      });

      return Array.from(grouped.values()).map((group) => {
        const preferred = languages
          .map(lang => group.find(item => String(item?.language || '').toLowerCase() === lang))
          .find(Boolean);
        return preferred || group[0];
      }).filter(Boolean);
    };

    const mergeAttributeValueNames = (...attrLists) => {
      const values = attrLists
        .flatMap(attrList => pickPreferredAttributeRows(attrList, [attributeLanguage])
          .map(item => item?.attributeValueName)
          .filter(Boolean))
        .filter((item, index, array) => array.indexOf(item) === index);

      return values.length > 0 ? values.join('') : null;
    };

    for (let i = 0; i < targetSkus.length; i += chunkSize) {
      const chunkSkus = targetSkus.slice(i, i + chunkSize);
      const attributeValueMap = {};

      try {
        const attributeSearchRes = await adapter.searchProduct({
          skuCodeList: chunkSkus,
          pageSize: 10,
          language: attributeLanguage,
          languageList: [attributeLanguage]
        });

        if (attributeSearchRes && Array.isArray(attributeSearchRes.data) && attributeSearchRes.data.length > 0) {
          attributeSearchRes.data.forEach((spu) => {
            const skcList = Array.isArray(spu.skcList) ? spu.skcList : [];

            skcList.forEach((skc) => {
              const skuList = Array.isArray(skc.skuList) ? skc.skuList : [];

              skuList.forEach((sku) => {
                const skuCode = sku?.skuCode;
                if (!skuCode || !chunkSkus.includes(skuCode)) {
                  return;
                }

                attributeValueMap[skuCode] = mergeAttributeValueNames(
                  skc.skcSalesAttribute,
                  sku.skuSalesAttributeList
                );
              });
            });
          });
        }
      } catch (err) {
        console.error('searchProduct attribute metadata error for skus:', chunkSkus, err.message);
      }

      try {
        const baseSearchRes = await adapter.searchProduct({
          skuCodeList: chunkSkus,
          pageSize: 10,
          language: baseLanguage,
          languageList: [baseLanguage]
        });

        if (baseSearchRes && Array.isArray(baseSearchRes.data) && baseSearchRes.data.length > 0) {
          baseSearchRes.data.forEach((spu) => {
            const catId = spu.categoryId;
            const skcList = Array.isArray(spu.skcList) ? spu.skcList : [];

            skcList.forEach((skc) => {
              const skuList = Array.isArray(skc.skuList) ? skc.skuList : [];

              skuList.forEach((sku) => {
                const skuCode = sku?.skuCode;
                if (!skuCode || !chunkSkus.includes(skuCode)) {
                  return;
                }

                const mergedAttributeValueName = attributeValueMap[skuCode] || null;
                categoryIdMap[skuCode] = catId;
                labelMetaMap[skuCode] = {
                  supplierCode: skc?.supplierCode || null,
                  supplierSku: sku?.supplierSku || null,
                  attributeValueName: mergedAttributeValueName,
                  attributeText: mergedAttributeValueName,
                  skcName: skc?.skcName || null
                };
              });
            });
          });
        }
      } catch (err) {
        console.error('searchProduct base metadata error for skus:', chunkSkus, err.message);
      }

      chunkSkus.forEach((skuCode) => {
        if (!labelMetaMap[skuCode] && attributeValueMap[skuCode]) {
          labelMetaMap[skuCode] = {
            attributeValueName: attributeValueMap[skuCode],
            attributeText: attributeValueMap[skuCode]
          };
        }
      });
    }

    if (Object.keys(categoryIdMap).length === 0) {
      return res.json({ success: true, data: labelMetaMap });
    }

    let categoryTree = [];
    try {
      const treeRes = await adapter.getCategoryTree({ language: baseLanguage });
      categoryTree = treeRes.info?.data || [];
    } catch (err) {
      console.error('getCategoryTree for sku-label-metadata error:', err.message);
    }

    const catIdToPath = {};
    const traverseTree = (nodes, currentPath = []) => {
      for (const node of nodes) {
        const id = node.category_id;
        const name = node.category_name;
        const newPath = [...currentPath, name];
        catIdToPath[id] = newPath.join('/');
        if (node.children && node.children.length > 0) {
          traverseTree(node.children, newPath);
        }
      }
    };

    if (categoryTree.length > 0) {
      traverseTree(categoryTree);
    }

    const result = {};
    targetSkus.forEach((skuCode) => {
      const meta = labelMetaMap[skuCode] || {};
      const catId = categoryIdMap[skuCode];
      const fullPath = catId && catIdToPath[catId] ? catIdToPath[catId] : null;
      const parts = fullPath ? fullPath.split('/') : [];
      result[skuCode] = {
        categoryPath: parts.length > 0 ? parts[parts.length - 1] : null,
        ...meta
      };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== 发货管理 ====================

/**
 * 获取发货基本信息
 * POST /api/shein-full/shipping-basic
 */
router.post('/shipping-basic', async (req, res) => {
  try {
    const { shopId, orderType, addressId } = req.body;
    const adapter = await getAdapter(shopId);
    const result = await adapter.getShippingBasic(orderType, addressId);
    res.json({ success: true, data: result.info });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 查询发货单列表
 * POST /api/shein-full/delivery-list
 */
router.post('/delivery-list', async (req, res) => {
  try {
    const { shopId, ...params } = req.body;
    const adapter = await getAdapter(shopId);
    const result = await adapter.getDeliveryList(params);
    res.json({ success: true, data: result.info });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== 财务管理 ====================

/**
 * 查询报账单列表
 * POST /api/shein-full/report-list
 */
router.post('/report-list', async (req, res) => {
  try {
    const { shopId, ...params } = req.body;
    const adapter = await getAdapter(shopId);
    const result = await adapter.getReportList(params);
    const list = (result.info?.reportOrderInfos || []).map(r => adapter.transformReport(r));
    res.json({
      success: true,
      data: { list, count: result.info?.count || 0 }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 查询报账单销售款明细
 * POST /api/shein-full/report-sales-detail
 */
router.post('/report-sales-detail', async (req, res) => {
  try {
    const { shopId, reportOrderNo, perPage, query } = req.body;
    const adapter = await getAdapter(shopId);
    const result = await adapter.getReportSalesDetail(reportOrderNo, { perPage, query });
    res.json({ success: true, data: result.info });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 查询报账单补扣款明细
 * POST /api/shein-full/report-adjustment-detail
 */
router.post('/report-adjustment-detail', async (req, res) => {
  try {
    const { shopId, reportOrderNo, perPage, query } = req.body;
    const adapter = await getAdapter(shopId);
    const result = await adapter.getReportAdjustmentDetail(reportOrderNo, { perPage, query });
    res.json({ success: true, data: result.info });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 查询本地已同步报账单及明细
 * POST /api/shein-full/finance-reports/local
 */
router.post('/finance-reports/local', async (req, res) => {
  try {
    const { shopId, page = 1, pageSize = 20, reportOrderNo, includeDetails = false } = req.body;

    if (!shopId) {
      return res.status(400).json({ success: false, message: 'shopId 不能为空' });
    }

    const limit = Math.min(parseInt(pageSize, 10) || 20, 200);
    const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;
    const where = ['shop_id = :shopId'];
    const replacements = { shopId, limit, offset };

    if (reportOrderNo) {
      where.push('report_order_no = :reportOrderNo');
      replacements.reportOrderNo = reportOrderNo;
    }

    const whereSql = where.join(' AND ');

    const [countRow] = await sequelize.query(
      `SELECT COUNT(1) AS total FROM shein_full_finance_reports WHERE ${whereSql}`,
      { replacements, type: QueryTypes.SELECT }
    );

    const reports = await sequelize.query(
      `SELECT * FROM shein_full_finance_reports WHERE ${whereSql}
       ORDER BY add_time DESC, id DESC LIMIT :limit OFFSET :offset`,
      { replacements, type: QueryTypes.SELECT }
    );

    if (includeDetails && reports.length > 0) {
      for (const report of reports) {
        const detailReplacements = {
          shopId,
          reportOrderNo: report.report_order_no
        };

        report.salesDetails = await sequelize.query(
          `SELECT * FROM shein_full_finance_report_sales_details
           WHERE shop_id = :shopId AND report_order_no = :reportOrderNo
           ORDER BY add_time DESC, id DESC`,
          { replacements: detailReplacements, type: QueryTypes.SELECT }
        );

        report.adjustmentDetails = await sequelize.query(
          `SELECT * FROM shein_full_finance_report_adjustment_details
           WHERE shop_id = :shopId AND report_order_no = :reportOrderNo
           ORDER BY add_time DESC, id DESC`,
          { replacements: detailReplacements, type: QueryTypes.SELECT }
        );
      }
    }

    return res.json({
      success: true,
      data: {
        list: reports,
        total: Number(countRow?.total || 0),
        page: Math.max(parseInt(page, 10) || 1, 1),
        pageSize: limit
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== 批量同步 ====================

/**
 * 批量同步数据 (仅查询不保存)
 * POST /api/shein-full/batch-sync
 */
router.post('/batch-sync', async (req, res) => {
  try {
    const { shopId, syncTypes, params = {} } = req.body;
    const adapter = await getAdapter(shopId);
    const results = {};

    for (const syncType of syncTypes) {
      try {
        switch (syncType) {
          case 'products':
            results.products = await adapter.getProductList(params.products || {});
            break;
          case 'orders':
            results.orders = await adapter.getPurchaseOrders(params.orders || {});
            break;
          case 'inventory':
            results.inventory = await adapter.getInventory(params.inventory || {});
            break;
          case 'categories':
            results.categories = await adapter.getCategoryTree();
            break;
          case 'reports':
            results.reports = await adapter.getReportList(params.reports || {});
            break;
          default:
            results[syncType] = { error: '不支持的同步类型' };
        }
      } catch (error) {
        results[syncType] = { error: error.message };
      }
    }

    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== 数据同步到数据库 ====================

const syncService = require('../services/shein-full-sync.service');

/**
 * 批量同步数据（异步非阻塞）
 * POST /api/shein-full-sync/batch
 * 支持同时同步多种数据类型，不阻塞其他功能
 */
router.post('/batch', async (req, res) => {
  try {
    const { shopIds, dataTypes, platform, ...params } = req.body;

    if (!shopIds || !Array.isArray(shopIds) || shopIds.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要同步的店铺' });
    }
    if (!dataTypes || !Array.isArray(dataTypes) || dataTypes.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要同步的数据类型' });
    }

    // 对每个店铺启动异步同步任务
    const tasks = [];
    let hasExisting = false;
    let existingMessage = '';
    
    for (const shopId of shopIds) {
      const result = await syncService.batchSync(shopId, dataTypes, params);
      tasks.push({ 
        shopId, 
        taskId: result.taskId,
        isExisting: result.isExisting || false,
        message: result.message
      });
      if (result.isExisting) {
        hasExisting = true;
        existingMessage = result.message;
      }
    }

    res.json({
      success: true,
      message: hasExisting ? existingMessage : '同步任务已启动',
      data: { 
        taskId: tasks[0]?.taskId, 
        tasks,
        hasExisting
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 获取同步任务状态
 * GET /api/shein-full-sync/status/:taskId
 */
router.get('/status/:taskId', async (req, res) => {
  try {
    const status = syncService.getSyncTaskStatus(req.params.taskId);
    if (!status) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 获取店铺运行中的同步任务
 * GET /api/shein-full-sync/running/:shopId
 */
router.get('/running/:shopId', async (req, res) => {
  try {
    const shopId = parseInt(req.params.shopId);
    const tasks = syncService.getRunningTasksForShop(shopId);
    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 同步采购单到数据库
 * POST /api/shein-full/sync/purchase-orders
 */
router.post('/sync/purchase-orders', async (req, res) => {
  try {
    const { shopId, ...params } = req.body;
    if (!shopId) {
      return res.status(400).json({ success: false, message: 'shopId不能为空' });
    }
    const result = await syncService.syncPurchaseOrders(shopId, params);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 同步发货单到数据库
 * POST /api/shein-full/sync/delivery-orders
 */
router.post('/sync/delivery-orders', async (req, res) => {
  try {
    const { shopId, ...params } = req.body;
    if (!shopId) {
      return res.status(400).json({ success: false, message: 'shopId不能为空' });
    }
    const result = await syncService.syncDeliveryOrders(shopId, params);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 同步商品到数据库
 * POST /api/shein-full/sync/products
 */
router.post('/sync/products', async (req, res) => {
  try {
    const { shopId, ...params } = req.body;
    if (!shopId) {
      return res.status(400).json({ success: false, message: 'shopId不能为空' });
    }
    const result = await syncService.syncProducts(shopId, params);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 同步报账单到数据库
 * POST /api/shein-full/sync/reports
 */
router.post('/sync/reports', async (req, res) => {
  try {
    const { shopId, ...params } = req.body;
    if (!shopId) {
      return res.status(400).json({ success: false, message: 'shopId不能为空' });
    }
    const result = await syncService.syncReports(shopId, params);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 同步库存到数据库
 * POST /api/shein-full/sync/inventory
 */
router.post('/sync/inventory', async (req, res) => {
  try {
    const { shopId, ...params } = req.body;
    if (!shopId) {
      return res.status(400).json({ success: false, message: 'shopId不能为空' });
    }
    const result = await syncService.syncInventory(shopId, params);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
