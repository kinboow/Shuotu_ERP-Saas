/**
 * API配置
 * 开发环境使用proxy，生产环境使用环境变量配置的地址
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || '';

/**
 * 封装fetch请求，自动添加API基础地址
 */
export const apiFetch = async (url, options = {}) => {
  const fullUrl = url.startsWith('/') ? `${API_BASE_URL}${url}` : url;
  
  const response = await fetch(fullUrl, {
    ...options,
    headers: {
      ...options.headers,
    },
  });
  
  return response;
};

export default API_BASE_URL;
