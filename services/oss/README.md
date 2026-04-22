# 本地对象存储服务 (Local OSS Server)

模拟阿里云OSS功能的本地文件存储服务，支持文件上传、下载、生成带签名的临时访问链接。

## 功能特性

- 文件上传（支持multipart和base64两种方式）
- 生成带签名的临时访问URL（支持自定义过期时间）
- 文件在线预览（PDF、图片等）
- 自动清理过期文件
- 存储统计

## 安装

```bash
cd oss-server
npm install
```

## 配置

复制 `.env.template` 为 `.env` 并修改配置：

```bash
cp .env.template .env
```

配置项说明：
- `PORT`: 服务端口，默认3001
- `OSS_SECRET_KEY`: 签名密钥
- `FILE_RETENTION_HOURS`: 文件保留时间（小时）
- `DEFAULT_EXPIRES_IN`: 默认签名URL过期时间（秒）

## 启动

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

## API接口

### 健康检查
```
GET /health
```

### 上传文件（multipart）
```
POST /upload
Content-Type: multipart/form-data

参数:
- file: 文件
- category: 分类目录 (pdf/images/temp/documents)
- expiresIn: 签名URL过期时间（秒）
```

### 上传文件（base64）
```
POST /upload/buffer
Content-Type: application/json

{
  "buffer": "base64编码的文件内容",
  "fileName": "文件名.pdf",
  "category": "pdf",
  "expiresIn": 7200
}
```

### 获取文件
```
GET /file/:category/:fileName?expires=xxx&signature=xxx
```

### 生成新的签名URL
```
POST /sign
Content-Type: application/json

{
  "fileId": "文件ID",
  "category": "pdf",
  "expiresIn": 7200
}
```

### 删除文件
```
DELETE /file/:category/:fileId
```

### 获取存储统计
```
GET /stats
```

### 清理过期文件
```
POST /cleanup
```

## 目录结构

```
oss-server/
├── server.js          # 主服务文件
├── package.json
├── .env.template      # 环境变量模板
├── .env               # 环境变量配置
├── storage/           # 文件存储目录
│   ├── pdf/          # PDF文件
│   ├── images/       # 图片文件
│   ├── temp/         # 临时文件
│   └── documents/    # 文档文件
└── README.md
```

## 使用示例

### 前端上传PDF并获取预览链接

```javascript
// 上传PDF
const uploadPDF = async (pdfBlob) => {
  const formData = new FormData();
  formData.append('file', pdfBlob, 'document.pdf');
  formData.append('category', 'pdf');
  formData.append('expiresIn', '7200'); // 2小时

  const response = await fetch('http://localhost:3001/upload', {
    method: 'POST',
    body: formData
  });

  const result = await response.json();
  if (result.success) {
    // 在新标签页打开PDF
    window.open(result.data.signedUrl, '_blank');
  }
};
```

### 后端调用示例

```javascript
const axios = require('axios');

// 上传Buffer
const uploadBuffer = async (buffer, fileName) => {
  const response = await axios.post('http://localhost:3001/upload/buffer', {
    buffer: buffer.toString('base64'),
    fileName,
    category: 'pdf',
    expiresIn: 7200
  });
  return response.data;
};
```
