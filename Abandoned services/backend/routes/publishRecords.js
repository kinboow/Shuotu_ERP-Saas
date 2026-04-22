const express = require('express');
const router = express.Router();
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

/**
 * 获取发布记录列表
 * GET /api/publish-records
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      keyword = '',
      platform = '',
      status = '',
      startDate = '',
      endDate = ''
    } = req.query;

    const offset = (page - 1) * limit;
    
    // 构建查询条件
    let whereConditions = [];
    let params = {};
    
    if (keyword) {
      whereConditions.push('(product_name LIKE :keyword OR platform_product_id LIKE :keyword)');
      params.keyword = `%${keyword}%`;
    }
    
    if (platform) {
      whereConditions.push('platform = :platform');
      params.platform = platform;
    }
    
    if (status) {
      whereConditions.push('status = :status');
      params.status = status;
    }
    
    if (startDate) {
      whereConditions.push('DATE(published_at) >= :startDate');
      params.startDate = startDate;
    }
    
    if (endDate) {
      whereConditions.push('DATE(published_at) <= :endDate');
      params.endDate = endDate;
    }
    
    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';
    
    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM publish_records
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
        draft_id as draftId,
        product_name as productName,
        product_name_en as productNameEn,
        product_name_cn as productNameCn,
        main_image as mainImage,
        price,
        stock,
        sku,
        platform,
        platform_product_id as platformProductId,
        platform_sku as platformSku,
        publish_type as publishType,
        erp_product_id as erpProductId,
        status,
        error_message as errorMessage,
        error_code as errorCode,
        published_by as publishedBy,
        published_at as publishedAt,
        completed_at as completedAt,
        retry_count as retryCount
      FROM publish_records
      ${whereClause}
      ORDER BY published_at DESC
      LIMIT :limit OFFSET :offset
    `;
    
    const records = await sequelize.query(dataQuery, {
      replacements: { ...params, limit: parseInt(limit), offset: parseInt(offset) },
      type: QueryTypes.SELECT
    });
    
    res.json({
      success: true,
      data: records,
      total: countResult.total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('获取发布记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取发布记录失败: ' + error.message
    });
  }
});

/**
 * 获取发布记录详情
 * GET /api/publish-records/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        id,
        draft_id as draftId,
        product_name as productName,
        product_name_en as productNameEn,
        product_name_cn as productNameCn,
        main_image as mainImage,
        price,
        stock,
        sku,
        platform,
        platform_product_id as platformProductId,
        platform_sku as platformSku,
        publish_type as publishType,
        erp_product_id as erpProductId,
        status,
        error_message as errorMessage,
        error_code as errorCode,
        request_data as requestData,
        response_data as responseData,
        published_by as publishedBy,
        published_at as publishedAt,
        completed_at as completedAt,
        retry_count as retryCount
      FROM publish_records
      WHERE id = :id
    `;
    
    const [record] = await sequelize.query(query, {
      replacements: { id },
      type: QueryTypes.SELECT
    });
    
    if (!record) {
      return res.status(404).json({
        success: false,
        message: '发布记录不存在'
      });
    }
    
    // 解析JSON字段
    if (record.requestData) record.requestData = JSON.parse(record.requestData);
    if (record.responseData) record.responseData = JSON.parse(record.responseData);
    
    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    console.error('获取发布记录详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取发布记录详情失败: ' + error.message
    });
  }
});

/**
 * 创建发布记录
 * POST /api/publish-records
 */
router.post('/', async (req, res) => {
  try {
    const {
      draftId,
      productName,
      productNameEn,
      productNameCn,
      mainImage,
      price,
      stock,
      sku,
      platform,
      platformProductId,
      platformSku,
      publishType,
      erpProductId,
      status = 'pending',
      errorMessage,
      errorCode,
      requestData,
      responseData,
      publishedBy
    } = req.body;
    
    if (!productName || !platform || !publishType) {
      return res.status(400).json({
        success: false,
        message: '商品名称、平台和发布类型为必填项'
      });
    }
    
    const query = `
      INSERT INTO publish_records (
        draft_id,
        product_name,
        product_name_en,
        product_name_cn,
        main_image,
        price,
        stock,
        sku,
        platform,
        platform_product_id,
        platform_sku,
        publish_type,
        erp_product_id,
        status,
        error_message,
        error_code,
        request_data,
        response_data,
        published_by
      ) VALUES (
        :draftId,
        :productName,
        :productNameEn,
        :productNameCn,
        :mainImage,
        :price,
        :stock,
        :sku,
        :platform,
        :platformProductId,
        :platformSku,
        :publishType,
        :erpProductId,
        :status,
        :errorMessage,
        :errorCode,
        :requestData,
        :responseData,
        :publishedBy
      )
    `;
    
    const [result] = await sequelize.query(query, {
      replacements: {
        draftId: draftId || null,
        productName,
        productNameEn: productNameEn || null,
        productNameCn: productNameCn || null,
        mainImage: mainImage || null,
        price: price || null,
        stock: stock || null,
        sku: sku || null,
        platform,
        platformProductId: platformProductId || null,
        platformSku: platformSku || null,
        publishType,
        erpProductId: erpProductId || null,
        status,
        errorMessage: errorMessage || null,
        errorCode: errorCode || null,
        requestData: requestData ? JSON.stringify(requestData) : null,
        responseData: responseData ? JSON.stringify(responseData) : null,
        publishedBy: publishedBy || null
      },
      type: QueryTypes.INSERT
    });
    
    res.json({
      success: true,
      message: '发布记录创建成功',
      data: { id: result }
    });
  } catch (error) {
    console.error('创建发布记录失败:', error);
    res.status(500).json({
      success: false,
      message: '创建发布记录失败: ' + error.message
    });
  }
});

/**
 * 更新发布记录状态
 * PUT /api/publish-records/:id/status
 */
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, errorMessage, errorCode, platformProductId, responseData } = req.body;
    
    const query = `
      UPDATE publish_records SET
        status = :status,
        error_message = :errorMessage,
        error_code = :errorCode,
        platform_product_id = COALESCE(:platformProductId, platform_product_id),
        response_data = :responseData,
        completed_at = CASE WHEN :status IN ('success', 'failed') THEN NOW() ELSE completed_at END
      WHERE id = :id
    `;
    
    await sequelize.query(query, {
      replacements: {
        id,
        status,
        errorMessage: errorMessage || null,
        errorCode: errorCode || null,
        platformProductId: platformProductId || null,
        responseData: responseData ? JSON.stringify(responseData) : null
      },
      type: QueryTypes.UPDATE
    });
    
    res.json({
      success: true,
      message: '发布记录状态更新成功'
    });
  } catch (error) {
    console.error('更新发布记录状态失败:', error);
    res.status(500).json({
      success: false,
      message: '更新发布记录状态失败: ' + error.message
    });
  }
});

/**
 * 重试发布
 * POST /api/publish-records/:id/retry
 */
router.post('/:id/retry', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 获取原记录
    const [record] = await sequelize.query(
      'SELECT * FROM publish_records WHERE id = :id',
      {
        replacements: { id },
        type: QueryTypes.SELECT
      }
    );
    
    if (!record) {
      return res.status(404).json({
        success: false,
        message: '发布记录不存在'
      });
    }
    
    // 更新重试次数和状态
    await sequelize.query(
      `UPDATE publish_records SET 
        status = 'pending',
        retry_count = retry_count + 1,
        error_message = NULL,
        error_code = NULL
      WHERE id = :id`,
      {
        replacements: { id },
        type: QueryTypes.UPDATE
      }
    );
    
    // TODO: 这里应该触发实际的发布任务
    // 可以使用消息队列或后台任务处理
    
    res.json({
      success: true,
      message: '已提交重新发布请求'
    });
  } catch (error) {
    console.error('重试发布失败:', error);
    res.status(500).json({
      success: false,
      message: '重试发布失败: ' + error.message
    });
  }
});

/**
 * 获取发布统计
 * GET /api/publish-records/stats
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateCondition = '';
    let params = {};
    
    if (startDate && endDate) {
      dateCondition = 'WHERE DATE(published_at) BETWEEN :startDate AND :endDate';
      params = { startDate, endDate };
    }
    
    const query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        COUNT(DISTINCT platform) as platformCount
      FROM publish_records
      ${dateCondition}
    `;
    
    const [stats] = await sequelize.query(query, {
      replacements: params,
      type: QueryTypes.SELECT
    });
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('获取发布统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取发布统计失败: ' + error.message
    });
  }
});

module.exports = router;
