const express = require('express');
const router = express.Router();
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

/**
 * 获取草稿列表
 * GET /api/publish-drafts
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      keyword = '',
      draftType = '',
      platform = ''
    } = req.query;

    const offset = (page - 1) * limit;
    
    // 构建查询条件
    let whereConditions = [];
    let params = {};
    
    if (keyword) {
      whereConditions.push('(title LIKE :keyword OR product_name_en LIKE :keyword OR product_name_cn LIKE :keyword)');
      params.keyword = `%${keyword}%`;
    }
    
    if (draftType) {
      whereConditions.push('draft_type = :draftType');
      params.draftType = draftType;
    }
    
    if (platform) {
      whereConditions.push('JSON_CONTAINS(platforms, :platform)');
      params.platform = JSON.stringify(platform);
    }
    
    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';
    
    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM publish_drafts
      ${whereClause}
    `;
    
    const [countResult] = await sequelize.query(countQuery, {
      replacements: params,
      type: QueryTypes.SELECT
    });
    
    // 查询数据
    const dataQuery = `
      SELECT 
        id,
        title,
        draft_type as draftType,
        erp_product_id as erpProductId,
        product_name_en as productNameEn,
        product_name_cn as productNameCn,
        price,
        stock,
        sku,
        main_image as mainImage,
        platforms,
        created_at as createdAt,
        updated_at as updatedAt
      FROM publish_drafts
      ${whereClause}
      ORDER BY updated_at DESC
      LIMIT :limit OFFSET :offset
    `;
    
    const drafts = await sequelize.query(dataQuery, {
      replacements: { ...params, limit: parseInt(limit), offset: parseInt(offset) },
      type: QueryTypes.SELECT
    });
    
    // 解析JSON字段
    drafts.forEach(draft => {
      // 如果platforms是字符串，则解析；如果已经是数组，则保持不变
      if (draft.platforms && typeof draft.platforms === 'string') {
        try {
          draft.platforms = JSON.parse(draft.platforms);
        } catch (e) {
          console.error('解析platforms失败:', e.message, draft.platforms);
          draft.platforms = [];
        }
      }
    });
    
    res.json({
      success: true,
      data: drafts,
      total: countResult.total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('获取草稿列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取草稿列表失败: ' + error.message
    });
  }
});

/**
 * 获取草稿详情
 * GET /api/publish-drafts/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        id,
        title,
        draft_type as draftType,
        erp_product_id as erpProductId,
        product_name_en as productNameEn,
        product_name_cn as productNameCn,
        product_desc as productDesc,
        price,
        stock,
        sku,
        images,
        main_image as mainImage,
        platforms,
        platform_configs as platformConfigs,
        draft_data as draftData,
        created_at as createdAt,
        updated_at as updatedAt
      FROM publish_drafts
      WHERE id = :id
    `;
    
    const [draft] = await sequelize.query(query, {
      replacements: { id },
      type: QueryTypes.SELECT
    });
    
    if (!draft) {
      return res.status(404).json({
        success: false,
        message: '草稿不存在'
      });
    }
    
    // 解析JSON字段
    if (draft.images) draft.images = JSON.parse(draft.images);
    if (draft.platforms) draft.platforms = JSON.parse(draft.platforms);
    if (draft.platformConfigs) draft.platformConfigs = JSON.parse(draft.platformConfigs);
    if (draft.draftData) draft.draftData = JSON.parse(draft.draftData);
    
    res.json({
      success: true,
      data: draft
    });
  } catch (error) {
    console.error('获取草稿详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取草稿详情失败: ' + error.message
    });
  }
});

/**
 * 创建草稿
 * POST /api/publish-drafts
 */
router.post('/', async (req, res) => {
  try {
    const {
      title,
      draftType,
      erpProductId,
      productNameEn,
      productNameCn,
      productDesc,
      price,
      stock,
      sku,
      images,
      mainImage,
      platforms,
      platformConfigs,
      draftData
    } = req.body;
    
    if (!title || !draftType) {
      return res.status(400).json({
        success: false,
        message: '标题和草稿类型为必填项'
      });
    }
    
    const query = `
      INSERT INTO publish_drafts (
        title,
        draft_type,
        erp_product_id,
        product_name_en,
        product_name_cn,
        product_desc,
        price,
        stock,
        sku,
        images,
        main_image,
        platforms,
        platform_configs,
        draft_data
      ) VALUES (
        :title,
        :draftType,
        :erpProductId,
        :productNameEn,
        :productNameCn,
        :productDesc,
        :price,
        :stock,
        :sku,
        :images,
        :mainImage,
        :platforms,
        :platformConfigs,
        :draftData
      )
    `;
    
    const [result] = await sequelize.query(query, {
      replacements: {
        title,
        draftType,
        erpProductId: erpProductId || null,
        productNameEn: productNameEn || null,
        productNameCn: productNameCn || null,
        productDesc: productDesc || null,
        price: price || null,
        stock: stock || null,
        sku: sku || null,
        images: images ? JSON.stringify(images) : null,
        mainImage: mainImage || null,
        platforms: platforms ? JSON.stringify(platforms) : null,
        platformConfigs: platformConfigs ? JSON.stringify(platformConfigs) : null,
        draftData: draftData ? JSON.stringify(draftData) : null
      },
      type: QueryTypes.INSERT
    });
    
    res.json({
      success: true,
      message: '草稿创建成功',
      data: { id: result }
    });
  } catch (error) {
    console.error('创建草稿失败:', error);
    res.status(500).json({
      success: false,
      message: '创建草稿失败: ' + error.message
    });
  }
});

/**
 * 更新草稿
 * PUT /api/publish-drafts/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      draftType,
      erpProductId,
      productNameEn,
      productNameCn,
      productDesc,
      price,
      stock,
      sku,
      images,
      mainImage,
      platforms,
      platformConfigs,
      draftData
    } = req.body;
    
    const query = `
      UPDATE publish_drafts SET
        title = :title,
        draft_type = :draftType,
        erp_product_id = :erpProductId,
        product_name_en = :productNameEn,
        product_name_cn = :productNameCn,
        product_desc = :productDesc,
        price = :price,
        stock = :stock,
        sku = :sku,
        images = :images,
        main_image = :mainImage,
        platforms = :platforms,
        platform_configs = :platformConfigs,
        draft_data = :draftData
      WHERE id = :id
    `;
    
    await sequelize.query(query, {
      replacements: {
        id,
        title,
        draftType,
        erpProductId: erpProductId || null,
        productNameEn: productNameEn || null,
        productNameCn: productNameCn || null,
        productDesc: productDesc || null,
        price: price || null,
        stock: stock || null,
        sku: sku || null,
        images: images ? JSON.stringify(images) : null,
        mainImage: mainImage || null,
        platforms: platforms ? JSON.stringify(platforms) : null,
        platformConfigs: platformConfigs ? JSON.stringify(platformConfigs) : null,
        draftData: draftData ? JSON.stringify(draftData) : null
      },
      type: QueryTypes.UPDATE
    });
    
    res.json({
      success: true,
      message: '草稿更新成功'
    });
  } catch (error) {
    console.error('更新草稿失败:', error);
    res.status(500).json({
      success: false,
      message: '更新草稿失败: ' + error.message
    });
  }
});

/**
 * 删除草稿
 * DELETE /api/publish-drafts/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = 'DELETE FROM publish_drafts WHERE id = :id';
    
    await sequelize.query(query, {
      replacements: { id },
      type: QueryTypes.DELETE
    });
    
    res.json({
      success: true,
      message: '草稿删除成功'
    });
  } catch (error) {
    console.error('删除草稿失败:', error);
    res.status(500).json({
      success: false,
      message: '删除草稿失败: ' + error.message
    });
  }
});

module.exports = router;
