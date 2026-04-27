/**
 * OSS上传工具函数
 * 将PDF Blob上传到OSS服务，返回可访问的签名URL
 * 如果OSS不可用则回退到本地Blob URL
 */

const ossUrl = process.env.REACT_APP_OSS_URL || '';

/**
 * 重写OSS文件URL
 * CRA dev server的historyApiFallback会拦截浏览器导航到/file/...的请求，
 * 返回index.html而不是PDF文件。通过将/file/改为/api/oss-file/，
 * 利用/api前缀确保请求被正确代理到后端，而不被historyApiFallback拦截。
 */
function rewriteOssUrl(url) {
  if (typeof url === 'string' && url.startsWith('/file/')) {
    return url.replace(/^\/file\//, '/api/oss-file/');
  }
  return url;
}

/**
 * 检查OSS服务是否可用
 */
export async function checkOssHealth() {
  try {
    const healthCheck = await fetch(`${ossUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000)
    });
    return healthCheck.ok;
  } catch (e) {
    console.warn('OSS服务不可用');
    return false;
  }
}

/**
 * 将Blob转为base64字符串
 */
function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * 上传PDF Blob到OSS服务
 * @param {Blob} pdfBlob - PDF文件的Blob对象
 * @param {string} fileName - 文件名
 * @param {object} options - 可选配置
 * @param {number} options.expiresIn - URL有效期(秒)，默认7200(2小时)
 * @param {string} options.category - 文件分类，默认'pdf'
 * @returns {Promise<{success: boolean, url: string, isOss: boolean, expiresAt?: string}>}
 */
export async function uploadPdfToOSS(pdfBlob, fileName, options = {}) {
  const { expiresIn = 7200, category = 'pdf' } = options;

  const isOssAvailable = await checkOssHealth();

  if (isOssAvailable) {
    try {
      const base64Data = await blobToBase64(pdfBlob);

      const ossResponse = await fetch(`${ossUrl}/upload/buffer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buffer: base64Data,
          fileName: fileName,
          category: category,
          expiresIn: expiresIn
        })
      });

      if (!ossResponse.ok) {
        throw new Error(`OSS服务响应错误: ${ossResponse.status}`);
      }

      const ossResult = await ossResponse.json();

      if (ossResult.success) {
        return {
          success: true,
          url: rewriteOssUrl(ossResult.data.signedUrl || ossResult.data.url),
          isOss: true,
          expiresAt: ossResult.data.expiresAt
        };
      } else {
        throw new Error(ossResult.message || 'OSS上传失败');
      }
    } catch (e) {
      console.error('OSS上传失败，回退到本地预览:', e);
    }
  }

  // 回退：本地Blob URL
  const pdfBlobWithType = new Blob([pdfBlob], { type: 'application/pdf' });
  const localUrl = URL.createObjectURL(pdfBlobWithType);
  // 2小时后释放
  setTimeout(() => URL.revokeObjectURL(localUrl), 2 * 60 * 60 * 1000);

  return {
    success: true,
    url: localUrl,
    isOss: false
  };
}

/**
 * 通过后端代理下载远程PDF，然后上传到OSS
 * 用于SHEIN API返回的面单/条码URL
 * @param {string} remoteUrl - 远程PDF的URL
 * @param {string} fileName - 保存的文件名
 * @param {object} options - 可选配置
 * @returns {Promise<{success: boolean, url: string, isOss: boolean, expiresAt?: string}>}
 */
export async function proxyAndUploadToOSS(remoteUrl, fileName, options = {}) {
  const { expiresIn = 7200, category = 'pdf' } = options;

  const isOssAvailable = await checkOssHealth();

  if (isOssAvailable) {
    try {
      // 通过后端代理下载远程PDF并上传到OSS
      const response = await fetch(`${ossUrl}/upload/from-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: remoteUrl,
          fileName: fileName,
          category: category,
          expiresIn: expiresIn
        })
      });

      if (!response.ok) {
        throw new Error(`代理上传响应错误: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        return {
          success: true,
          url: rewriteOssUrl(result.data.signedUrl || result.data.url),
          isOss: true,
          expiresAt: result.data.expiresAt
        };
      } else {
        throw new Error(result.message || '代理上传失败');
      }
    } catch (e) {
      console.error('OSS代理上传失败，直接打开远程URL:', e);
    }
  }

  // 回退：直接使用远程URL
  return {
    success: true,
    url: remoteUrl,
    isOss: false
  };
}
