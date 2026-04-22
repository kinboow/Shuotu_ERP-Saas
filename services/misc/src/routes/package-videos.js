/**
 * 包装录像管理路由
 */

const express = require('express');
const router = express.Router();
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/videos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['video/webm', 'video/mp4', 'video/quicktime'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的视频格式'));
    }
  }
});

/**
 * 获取包装录像列表
 * GET /api/package-videos
 */
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      order_no = '',
      sku_code = '',
      status = '',
      device_type = '',
      start_date = '',
      end_date = ''
    } = req.query;
    
    const offset = (page - 1) * limit;
    let whereClause = '';
    const params = {};

    if (order_no) {
      whereClause += ' AND order_no LIKE :order_no';
      params.order_no = `%${order_no}%`;
    }

    if (sku_code) {
      whereClause += ' AND sku_code LIKE :sku_code';
      params.sku_code = `%${sku_code}%`;
    }

    if (status) {
      whereClause += ' AND status = :status';
      params.status = status;
    }

    if (device_type) {
      whereClause += ' AND device_type = :device_type';
      params.device_type = device_type;
    }

    if (start_date) {
      whereClause += ' AND created_at >= :start_date';
      params.start_date = start_date;
    }

    if (end_date) {
      whereClause += ' AND created_at <= :end_date';
      params.end_date = end_date + ' 23:59:59';
    }

    const countQuery = `SELECT COUNT(*) as total FROM package_videos WHERE 1=1 ${whereClause}`;
    const countResult = await sequelize.query(countQuery, { 
      replacements: params, 
      type: QueryTypes.SELECT 
    });

    const dataQuery = `
      SELECT * FROM package_videos 
      WHERE 1=1 ${whereClause}
      ORDER BY created_at DESC
      LIMIT :limit OFFSET :offset
    `;

    const videos = await sequelize.query(dataQuery, {
      replacements: { ...params, limit: parseInt(limit), offset },
      type: QueryTypes.SELECT
    });

    res.json({
      success: true,
      data: videos,
      total: countResult[0]?.total || 0,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('获取包装录像列表失败:', error);
    res.json({ success: false, message: '获取包装录像列表失败: ' + error.message });
  }
});

/**
 * 获取统计信息
 * GET /api/package-videos/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM package_videos
    `;
    const result = await sequelize.query(query, { type: QueryTypes.SELECT });
    res.json({ 
      success: true, 
      data: result[0] || { total: 0, today: 0, pending: 0 } 
    });
  } catch (error) {
    res.json({ success: false, message: '获取统计信息失败: ' + error.message });
  }
});

/**
 * 检查订单是否有包装录像
 * GET /api/package-videos/check/:orderNo
 */
router.get('/check/:orderNo', async (req, res) => {
  try {
    const { orderNo } = req.params;
    
    const query = `
      SELECT * FROM package_videos 
      WHERE order_no = :orderNo AND status = 'completed'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const videos = await sequelize.query(query, {
      replacements: { orderNo },
      type: QueryTypes.SELECT
    });

    res.json({
      success: true,
      data: {
        order_no: orderNo,
        has_video: videos.length > 0,
        video_info: videos[0] || null
      }
    });
  } catch (error) {
    res.json({ success: false, message: '查询失败: ' + error.message });
  }
});

/**
 * 上传包装录像
 * POST /api/package-videos/upload
 */
router.post('/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.json({ success: false, message: '请上传视频文件' });
    }

    const { 
      order_no, 
      sku_code = '', 
      duration = 0,
      device_type = 'video',
      device_name = '',
      operator_id = '',
      operator_name = ''
    } = req.body;

    if (!order_no) {
      // 删除已上传的文件
      fs.unlinkSync(req.file.path);
      return res.json({ success: false, message: '订单号不能为空' });
    }

    const videoUrl = `/uploads/videos/${req.file.filename}`;

    const insertQuery = `
      INSERT INTO package_videos 
      (order_no, sku_code, video_url, duration, file_size, device_type, device_name, operator_id, operator_name, status, created_at)
      VALUES (:order_no, :sku_code, :video_url, :duration, :file_size, :device_type, :device_name, :operator_id, :operator_name, 'completed', NOW())
    `;

    await sequelize.query(insertQuery, {
      replacements: {
        order_no,
        sku_code,
        video_url: videoUrl,
        duration: parseInt(duration) || 0,
        file_size: req.file.size,
        device_type,
        device_name,
        operator_id,
        operator_name
      },
      type: QueryTypes.INSERT
    });

    res.json({ success: true, message: '上传成功', data: { video_url: videoUrl } });
  } catch (error) {
    console.error('上传包装录像失败:', error);
    res.json({ success: false, message: '上传失败: ' + error.message });
  }
});

/**
 * 删除包装录像
 * DELETE /api/package-videos/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 获取视频信息
    const selectQuery = 'SELECT video_url FROM package_videos WHERE id = :id';
    const videos = await sequelize.query(selectQuery, {
      replacements: { id },
      type: QueryTypes.SELECT
    });

    if (videos.length === 0) {
      return res.json({ success: false, message: '录像不存在' });
    }

    // 删除文件
    const videoPath = path.join(__dirname, '../..', videos[0].video_url);
    if (fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath);
    }

    // 删除数据库记录
    const deleteQuery = 'DELETE FROM package_videos WHERE id = :id';
    await sequelize.query(deleteQuery, {
      replacements: { id },
      type: QueryTypes.DELETE
    });

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.json({ success: false, message: '删除失败: ' + error.message });
  }
});

/**
 * 获取扫描日志
 * GET /api/package-videos/scan-logs
 */
router.get('/scan-logs', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const query = `
      SELECT * FROM package_video_scan_logs 
      ORDER BY created_at DESC
      LIMIT :limit
    `;
    const logs = await sequelize.query(query, {
      replacements: { limit: parseInt(limit) },
      type: QueryTypes.SELECT
    });

    res.json({ success: true, data: logs });
  } catch (error) {
    res.json({ success: false, message: '获取扫描日志失败: ' + error.message });
  }
});

/**
 * 记录扫描日志
 * POST /api/package-videos/scan-log
 */
router.post('/scan-log', async (req, res) => {
  try {
    const { order_no, has_video, operator_id, operator_name } = req.body;

    const insertQuery = `
      INSERT INTO package_video_scan_logs 
      (order_no, has_video, operator_id, operator_name, created_at)
      VALUES (:order_no, :has_video, :operator_id, :operator_name, NOW())
    `;

    await sequelize.query(insertQuery, {
      replacements: {
        order_no,
        has_video: has_video ? 1 : 0,
        operator_id: operator_id || '',
        operator_name: operator_name || ''
      },
      type: QueryTypes.INSERT
    });

    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, message: '记录扫描日志失败: ' + error.message });
  }
});

// ==================== 录像任务队列 ====================

/**
 * 创建录像任务（扫描端调用）
 * POST /api/package-videos/task
 */
router.post('/task', async (req, res) => {
  try {
    const { order_no, sku_code = '', product_name = '', operator_id, operator_name } = req.body;

    if (!order_no) {
      return res.json({ success: false, message: '订单号不能为空' });
    }

    // 检查是否已有待处理的任务
    const checkQuery = `
      SELECT id FROM package_video_tasks 
      WHERE order_no = :order_no AND status = 'pending'
      LIMIT 1
    `;
    const existing = await sequelize.query(checkQuery, {
      replacements: { order_no },
      type: QueryTypes.SELECT
    });

    if (existing.length > 0) {
      return res.json({ success: true, message: '任务已存在', data: { task_id: existing[0].id } });
    }

    const insertQuery = `
      INSERT INTO package_video_tasks 
      (order_no, sku_code, product_name, status, created_by_id, created_by_name, created_at)
      VALUES (:order_no, :sku_code, :product_name, 'pending', :created_by_id, :created_by_name, NOW())
    `;

    const [result] = await sequelize.query(insertQuery, {
      replacements: {
        order_no,
        sku_code,
        product_name,
        created_by_id: operator_id || '',
        created_by_name: operator_name || ''
      },
      type: QueryTypes.INSERT
    });

    res.json({ success: true, message: '录像任务已创建', data: { task_id: result } });
  } catch (error) {
    console.error('创建录像任务失败:', error);
    res.json({ success: false, message: '创建录像任务失败: ' + error.message });
  }
});

/**
 * 获取待处理的录像任务（录像端轮询）
 * GET /api/package-videos/tasks/pending
 */
router.get('/tasks/pending', async (req, res) => {
  try {
    const { last_id = 0 } = req.query;

    const query = `
      SELECT * FROM package_video_tasks 
      WHERE status = 'pending' AND id > :last_id
      ORDER BY created_at ASC
      LIMIT 10
    `;
    const tasks = await sequelize.query(query, {
      replacements: { last_id: parseInt(last_id) },
      type: QueryTypes.SELECT
    });

    res.json({ success: true, data: tasks });
  } catch (error) {
    res.json({ success: false, message: '获取任务失败: ' + error.message });
  }
});

/**
 * 领取录像任务（录像端调用）
 * POST /api/package-videos/task/:id/claim
 */
router.post('/task/:id/claim', async (req, res) => {
  try {
    const { id } = req.params;
    const { operator_id, operator_name, device_name } = req.body;

    // 检查任务状态
    const checkQuery = 'SELECT status FROM package_video_tasks WHERE id = :id';
    const tasks = await sequelize.query(checkQuery, {
      replacements: { id },
      type: QueryTypes.SELECT
    });

    if (tasks.length === 0) {
      return res.json({ success: false, message: '任务不存在' });
    }

    if (tasks[0].status !== 'pending') {
      return res.json({ success: false, message: '任务已被领取或已完成' });
    }

    const updateQuery = `
      UPDATE package_video_tasks 
      SET status = 'recording', 
          claimed_by_id = :operator_id, 
          claimed_by_name = :operator_name,
          device_name = :device_name,
          claimed_at = NOW()
      WHERE id = :id AND status = 'pending'
    `;

    const [, affectedRows] = await sequelize.query(updateQuery, {
      replacements: { id, operator_id, operator_name, device_name: device_name || '' }
    });

    if (affectedRows === 0) {
      return res.json({ success: false, message: '任务已被其他设备领取' });
    }

    res.json({ success: true, message: '任务领取成功' });
  } catch (error) {
    res.json({ success: false, message: '领取任务失败: ' + error.message });
  }
});

/**
 * 完成录像任务
 * POST /api/package-videos/task/:id/complete
 */
router.post('/task/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { video_id } = req.body;

    const updateQuery = `
      UPDATE package_video_tasks 
      SET status = 'completed', video_id = :video_id, completed_at = NOW()
      WHERE id = :id
    `;

    await sequelize.query(updateQuery, {
      replacements: { id, video_id: video_id || null }
    });

    res.json({ success: true, message: '任务完成' });
  } catch (error) {
    res.json({ success: false, message: '更新任务失败: ' + error.message });
  }
});

/**
 * 取消录像任务
 * POST /api/package-videos/task/:id/cancel
 */
router.post('/task/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;

    const updateQuery = `
      UPDATE package_video_tasks 
      SET status = 'cancelled', completed_at = NOW()
      WHERE id = :id
    `;

    await sequelize.query(updateQuery, { replacements: { id } });

    res.json({ success: true, message: '任务已取消' });
  } catch (error) {
    res.json({ success: false, message: '取消任务失败: ' + error.message });
  }
});

module.exports = router;
