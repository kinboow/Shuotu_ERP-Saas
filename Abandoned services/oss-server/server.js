/**
 * 本地对象存储服务 (Local OSS Server)
 * 独立运行的文件存储服务，模拟阿里云OSS功能
 * 支持文件上传、下载、生成带签名的临时访问链接
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

// 配置
const SECRET_KEY = process.env.OSS_SECRET_KEY || 'local-oss-secret-key-2024';
const FILE_RETENTION_HOURS = parseInt(process.env.FILE_RETENTION_HOURS) || 24;
const DEFAULT_EXPIRES_IN = parseInt(process.env.DEFAULT_EXPIRES_IN) || 7200;

// 存储目录
const STORAGE_ROOT = path.join(__dirname, 'storage');
const CATEGORIES = ['pdf', 'images', 'temp', 'documents'];

// 确保目录存在
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// 初始化存储目录
ensureDir(STORAGE_ROOT);
CATEGORIES.forEach(cat => ensureDir(path.join(STORAGE_ROOT, cat)));

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Multer配置
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB限制
});

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 生成文件唯一标识
 */
const generateFileId = () => {
  const timestamp = Date.now();
  const random = crypto.randomBytes(16).toString('hex');
  return `${timestamp}-${random}`;
};

/**
 * 生成签名
 */
const generateSignature = (fileId, expires) => {
  const data = `${fileId}&${expires}`;
  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(data);
  return hmac.digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

/**
 * 验证签名
 */
const verifySignature = (fileId, expires, signature) => {
  const expectedSignature = generateSignature(fileId, expires);
  return expectedSignature === signature;
};

/**
 * 获取Content-Type
 */
const getContentType = (ext) => {
  const types = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.json': 'application/json',
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.xml': 'application/xml',
    '.csv': 'text/csv'
  };
  return types[ext.toLowerCase()] || 'application/octet-stream';
};

// ============================================================================
// API路由
// ============================================================================

/**
 * 健康检查
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'local-oss-server', timestamp: new Date().toISOString() });
});

/**
 * 上传文件
 * POST /upload
 * Body: multipart/form-data { file, category }
 */
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '没有上传文件' });
    }

    const category = req.body.category || 'temp';
    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: '无效的分类目录' });
    }

    const fileId = generateFileId();
    const ext = path.extname(req.file.originalname) || '.bin';
    const storedFileName = `${fileId}${ext}`;
    const filePath = path.join(STORAGE_ROOT, category, storedFileName);

    await fs.promises.writeFile(filePath, req.file.buffer);

    // 生成签名URL
    const expiresIn = parseInt(req.body.expiresIn) || DEFAULT_EXPIRES_IN;
    const expires = Math.floor(Date.now() / 1000) + expiresIn;
    const signature = generateSignature(fileId, expires);
    
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const signedUrl = `${baseUrl}/file/${category}/${fileId}${ext}?expires=${expires}&signature=${signature}`;

    res.json({
      success: true,
      data: {
        fileId,
        fileName: storedFileName,
        originalName: req.file.originalname,
        category,
        size: req.file.buffer.length,
        contentType: req.file.mimetype,
        signedUrl,
        expiresAt: new Date(expires * 1000).toISOString(),
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('上传文件失败:', error);
    res.status(500).json({ success: false, message: '上传失败: ' + error.message });
  }
});

/**
 * 上传Buffer（JSON方式）
 * POST /upload/buffer
 * Body: { buffer (base64), fileName, category, expiresIn }
 */
app.post('/upload/buffer', async (req, res) => {
  try {
    const { buffer, fileName, category = 'temp', expiresIn = DEFAULT_EXPIRES_IN } = req.body;
    
    if (!buffer || !fileName) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }

    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: '无效的分类目录' });
    }

    const fileBuffer = Buffer.from(buffer, 'base64');
    const fileId = generateFileId();
    const ext = path.extname(fileName) || '.bin';
    const storedFileName = `${fileId}${ext}`;
    const filePath = path.join(STORAGE_ROOT, category, storedFileName);

    await fs.promises.writeFile(filePath, fileBuffer);

    // 生成签名URL
    const expires = Math.floor(Date.now() / 1000) + expiresIn;
    const signature = generateSignature(fileId, expires);
    
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const signedUrl = `${baseUrl}/file/${category}/${fileId}${ext}?expires=${expires}&signature=${signature}`;

    res.json({
      success: true,
      data: {
        fileId,
        fileName: storedFileName,
        originalName: fileName,
        category,
        size: fileBuffer.length,
        signedUrl,
        expiresAt: new Date(expires * 1000).toISOString(),
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('上传Buffer失败:', error);
    res.status(500).json({ success: false, message: '上传失败: ' + error.message });
  }
});

/**
 * 获取文件（带签名验证）
 * GET /file/:category/:fileName
 */
app.get('/file/:category/:fileName', async (req, res) => {
  try {
    const { category, fileName } = req.params;
    const { expires, signature } = req.query;

    if (!expires || !signature) {
      return res.status(400).json({ success: false, message: '缺少签名参数' });
    }

    // 从文件名提取fileId
    const fileId = fileName.split('.')[0];

    // 验证签名
    if (!verifySignature(fileId, parseInt(expires), signature)) {
      return res.status(403).json({ success: false, message: '签名验证失败' });
    }

    // 检查是否过期
    const now = Math.floor(Date.now() / 1000);
    if (now > parseInt(expires)) {
      return res.status(410).json({ success: false, message: '链接已过期' });
    }

    // 读取文件
    const filePath = path.join(STORAGE_ROOT, category, fileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: '文件不存在' });
    }

    const ext = path.extname(fileName);
    const contentType = getContentType(ext);

    // 设置响应头，支持在线预览
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    
    // 发送文件
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('获取文件失败:', error);
    res.status(500).json({ success: false, message: '获取文件失败: ' + error.message });
  }
});

/**
 * 生成签名URL（不上传文件，仅为已存在的文件生成新的签名URL）
 * POST /sign
 * Body: { fileId, category, expiresIn }
 */
app.post('/sign', async (req, res) => {
  try {
    const { fileId, category = 'temp', expiresIn = DEFAULT_EXPIRES_IN } = req.body;

    if (!fileId) {
      return res.status(400).json({ success: false, message: '缺少fileId' });
    }

    // 查找文件
    const categoryDir = path.join(STORAGE_ROOT, category);
    const files = await fs.promises.readdir(categoryDir);
    const matchedFile = files.find(f => f.startsWith(fileId));

    if (!matchedFile) {
      return res.status(404).json({ success: false, message: '文件不存在' });
    }

    // 生成新的签名URL
    const expires = Math.floor(Date.now() / 1000) + expiresIn;
    const signature = generateSignature(fileId, expires);
    
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const signedUrl = `${baseUrl}/file/${category}/${matchedFile}?expires=${expires}&signature=${signature}`;

    res.json({
      success: true,
      data: {
        fileId,
        fileName: matchedFile,
        signedUrl,
        expiresAt: new Date(expires * 1000).toISOString()
      }
    });
  } catch (error) {
    console.error('生成签名URL失败:', error);
    res.status(500).json({ success: false, message: '生成签名失败: ' + error.message });
  }
});

/**
 * 删除文件
 * DELETE /file/:category/:fileId
 */
app.delete('/file/:category/:fileId', async (req, res) => {
  try {
    const { category, fileId } = req.params;
    const categoryDir = path.join(STORAGE_ROOT, category);
    
    const files = await fs.promises.readdir(categoryDir);
    const matchedFile = files.find(f => f.startsWith(fileId));

    if (!matchedFile) {
      return res.status(404).json({ success: false, message: '文件不存在' });
    }

    await fs.promises.unlink(path.join(categoryDir, matchedFile));
    res.json({ success: true, message: '文件已删除' });
  } catch (error) {
    console.error('删除文件失败:', error);
    res.status(500).json({ success: false, message: '删除失败: ' + error.message });
  }
});

/**
 * 获取存储统计
 * GET /stats
 */
app.get('/stats', async (req, res) => {
  try {
    const stats = { categories: {}, total: { count: 0, size: 0 } };

    for (const category of CATEGORIES) {
      const categoryDir = path.join(STORAGE_ROOT, category);
      stats.categories[category] = { count: 0, size: 0 };

      if (fs.existsSync(categoryDir)) {
        const files = await fs.promises.readdir(categoryDir);
        for (const file of files) {
          const fileStat = await fs.promises.stat(path.join(categoryDir, file));
          stats.categories[category].count++;
          stats.categories[category].size += fileStat.size;
        }
      }

      stats.total.count += stats.categories[category].count;
      stats.total.size += stats.categories[category].size;
    }

    // 格式化大小
    const formatSize = (bytes) => {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
      if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
      return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    };

    stats.total.sizeFormatted = formatSize(stats.total.size);
    for (const cat of CATEGORIES) {
      stats.categories[cat].sizeFormatted = formatSize(stats.categories[cat].size);
    }

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('获取统计失败:', error);
    res.status(500).json({ success: false, message: '获取统计失败: ' + error.message });
  }
});

/**
 * 清理过期文件
 * POST /cleanup
 */
app.post('/cleanup', async (req, res) => {
  try {
    const maxAge = FILE_RETENTION_HOURS * 60 * 60 * 1000;
    let deletedCount = 0;
    const now = Date.now();

    for (const category of CATEGORIES) {
      const categoryDir = path.join(STORAGE_ROOT, category);
      if (!fs.existsSync(categoryDir)) continue;

      const files = await fs.promises.readdir(categoryDir);
      for (const file of files) {
        const timestamp = parseInt(file.split('-')[0]);
        if (!isNaN(timestamp) && (now - timestamp) > maxAge) {
          await fs.promises.unlink(path.join(categoryDir, file));
          deletedCount++;
        }
      }
    }

    res.json({ success: true, message: `已清理 ${deletedCount} 个过期文件` });
  } catch (error) {
    console.error('清理失败:', error);
    res.status(500).json({ success: false, message: '清理失败: ' + error.message });
  }
});

// 启动服务
app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  本地OSS服务已启动`);
  console.log(`  端口: ${PORT}`);
  console.log(`  存储目录: ${STORAGE_ROOT}`);
  console.log(`  文件保留: ${FILE_RETENTION_HOURS} 小时`);
  console.log(`  默认链接有效期: ${DEFAULT_EXPIRES_IN} 秒`);
  console.log(`========================================\n`);
});
