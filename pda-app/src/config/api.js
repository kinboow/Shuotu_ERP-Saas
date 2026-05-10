/**
 * API配置
 * 开发环境使用proxy，生产环境使用环境变量配置的地址
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || '';

const getStoredToken = () => localStorage.getItem('token') || localStorage.getItem('pda_token');

const getStoredEnterpriseId = () => {
  const savedUser = localStorage.getItem('pda_user') || localStorage.getItem('userInfo');
  if (!savedUser) {
    return null;
  }

  try {
    const user = JSON.parse(savedUser);
    return user?.enterprise_id ?? null;
  } catch (error) {
    return null;
  }
};

/**
 * 封装fetch请求，自动添加API基础地址
 */
export const apiFetch = async (url, options = {}) => {
  const fullUrl = url.startsWith('/') ? `${API_BASE_URL}${url}` : url;
  const token = getStoredToken();
  const enterpriseId = getStoredEnterpriseId();
  
  const response = await fetch(fullUrl, {
    ...options,
    headers: {
      ...(token && !options.headers?.Authorization ? { Authorization: `Bearer ${token}` } : {}),
      ...(enterpriseId !== null && enterpriseId !== undefined && options.headers?.['x-enterprise-id'] === undefined
        ? { 'x-enterprise-id': enterpriseId }
        : {}),
      ...options.headers,
    },
  });
  
  return response;
};

export default API_BASE_URL;
