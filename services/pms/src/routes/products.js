/**
 * 商品API路由
 */

const express = require('express');
const router = express.Router();
const productService = require('../services/product.service');
const { getRequiredEnterpriseIdFromRequest } = require('../services/tenant-context.service');

// 查询商品列表
router.get('/', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const result = await productService.queryProducts(req.query, enterpriseId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取商品详情
router.get('/:productId', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const product = await productService.getProductDetail(req.params.productId, enterpriseId);
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
});

// 创建商品
router.post('/', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const product = await productService.createProduct(req.body, enterpriseId);
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 更新商品
router.put('/:productId', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const product = await productService.updateProduct(req.params.productId, req.body, enterpriseId);
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 查询SKU映射
router.get('/mappings/list', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const result = await productService.queryMappings(req.query, enterpriseId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 创建SKU映射
router.post('/mappings', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const mapping = await productService.createMapping(req.body, enterpriseId);
    res.json({ success: true, data: mapping });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 批量创建映射
router.post('/mappings/batch', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const { mappings } = req.body;
    if (!mappings || !Array.isArray(mappings)) {
      return res.status(400).json({ success: false, message: '缺少mappings数组' });
    }
    const result = await productService.batchCreateMappings(mappings, enterpriseId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 根据平台SKU查找内部SKU
router.get('/mappings/find', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    const { platform, shopId, platformSkuId } = req.query;
    if (!platform || !shopId || !platformSkuId) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }
    const mapping = await productService.findInternalSku(platform, shopId, platformSkuId, enterpriseId);
    res.json({ success: true, data: mapping });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 删除映射
router.delete('/mappings/:id', async (req, res) => {
  try {
    const enterpriseId = getRequiredEnterpriseIdFromRequest(req);
    await productService.deleteMapping(req.params.id, enterpriseId);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
