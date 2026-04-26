import axios from 'axios';

// 自动检测API地址
// 优先使用环境变量配置，否则使用相对路径（通过dev server代理）
const getApiBaseUrl = () => {
  // 优先使用环境变量
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // 默认使用相对路径，所有请求通过前端代理转发到网关
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();

console.log('API Base URL:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 30000 // 30秒超时
});

// 添加请求拦截器 - 自动添加Token
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// 添加响应拦截器
api.interceptors.response.use(
  response => response,
  error => {
    // 处理401未授权错误
    if (error.response && error.response.status === 401) {
      // Token过期或无效，清除登录信息并跳转到登录页
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    if (error.code === 'ECONNABORTED') {
      console.error('请求超时:', error.message);
      error.message = '请求超时，请检查网络连接';
    } else if (error.message === 'Network Error') {
      console.error('网络错误:', {
        message: error.message,
        config: error.config,
        apiUrl: API_BASE_URL
      });
      error.message = `无法连接到服务器 (${API_BASE_URL})，请确保：\n1. 后端服务已启动\n2. 防火墙允许访问端口5000\n3. 后端配置了CORS`;
    }
    return Promise.reject(error);
  }
);

export const ordersAPI = {
  getAll: (params) => api.get('/orders', { params }),
  create: (data) => api.post('/orders', data),
  updateStatus: (id, status) => api.put(`/orders/${id}/status`, { status })
};

export const productsAPI = {
  getAll: (params) => api.get('/products', { params }),
  create: (data) => api.post('/products', data),
  updateStock: (id, stock) => api.put(`/products/${id}/stock`, { stock })
};

export const platformsAPI = {
  getAll: () => api.get('/platforms'),
  create: (data) => api.post('/platforms', data),
  syncOrders: (id) => api.post(`/platforms/${id}/sync-orders`)
};

export const stockOrdersAPI = {
  getAll: (params) => api.get('/stock-orders', { params }),
  create: (data) => api.post('/stock-orders', data),
  delete: (id) => api.delete(`/stock-orders/${id}`),
  getStats: (params) => api.get('/stock-orders/stats/summary', { params }),
  // 打印商品条码（调用SHEIN API获取条码PDF）
  printBarcode: (data) => api.post('/stock-orders/print-barcode', data),
  // 批量获取SKU的分类树路径
  getSkuCategories: (data) => api.post('/stock-orders/sku-categories', data)
};

export const financeRecordsAPI = {
  getAll: (params) => api.get('/finance-records', { params }),
  create: (data) => api.post('/finance-records', data),
  delete: (id) => api.delete(`/finance-records/${id}`),
  getStats: (params) => api.get('/finance-records/stats/summary', { params })
};

export const withdrawalsAPI = {
  getAll: (params) => api.get('/withdrawals', { params }),
  create: (data) => api.post('/withdrawals', data),
  delete: (id) => api.delete(`/withdrawals/${id}`),
  getStats: (params) => api.get('/withdrawals/stats/summary', { params })
};

// SHEIN(full)全托管店铺管理API
export const sheinFullShopsAPI = {
  // 店铺管理
  getAll: (includeDisabled) => api.get('/shein-full/shops', { params: { includeDisabled } }),
  getById: (id) => api.get(`/shein-full/shops/${id}`),
  create: (data) => api.post('/shein-full/shops', data),
  update: (id, data) => api.put(`/shein-full/shops/${id}`, data),
  delete: (id) => api.delete(`/shein-full/shops/${id}`),
  testConnection: (id) => api.post(`/shein-full/shops/${id}/test`),
  
  // 授权相关
  generateAuthUrl: (data) => api.post('/shein-full/auth/url', data),
  generateAuthUrlDirect: (data) => api.post('/shein-full/auth/generate-url', data),
  handleCallback: (data) => api.post('/shein-full/auth/callback', data),
  getToken: (data) => api.post('/shein-full/auth/get-token', data),
  getAuthLogs: (shopId) => api.get(`/shein-full/auth/logs/${shopId}`)
};

// 兼容旧API名称
export const sheinFullAuthAPI = {
  getPlatforms: () => api.get('/shein-full/shops'),
  generateAuthUrl: (data) => api.post('/shein-full/auth/generate-url', data),
  getByToken: (data) => api.post('/shein-full/auth/get-token', data),
  getShops: () => api.get('/shein-full/shops'),
  getShop: (id) => api.get(`/shein-full/shops/${id}`),
  updateShop: (id, data) => api.put(`/shein-full/shops/${id}`, data),
  deleteShop: (id) => api.delete(`/shein-full/shops/${id}`),
  testConnection: (id) => api.post(`/shein-full/shops/${id}/test`)
};

export const sheinFullProductsAPI = {
  query: (data) => api.post('/shein-full-products/query', data),
  getSpuInfo: (data) => api.post('/shein-full-products/spu-info', data),
  sync: (data) => api.post('/shein-full-products/sync', data),
  batchSync: (data) => api.post('/shein-full-products/batch-sync', data),
  getLocal: (params) => api.get('/shein-full-products/local', { params }),
  getLocalById: (id) => api.get(`/shein-full-products/local/${id}`)
};

export const sheinFullSyncAPI = {
  queryAndSync: (data) => api.post('/shein-full-sync/query-and-sync', data),
  getLocalFinanceReports: (data) => api.post('/shein-full/finance-reports/local', data)
};

// SHEIN(full)发货管理API
export const sheinFullShippingAPI = {
  getShippingBasic: (data) => api.post('/shein-full/shipping-basic', data),
  getExpressCompanyList: (data) => api.post('/shein-full/express-company-list', data),
  getWarehouseInfo: (data) => api.post('/shein-full/warehouse-info', data),
  createDelivery: (data) => api.post('/shein-full/create-delivery', data),
  printDeliveryLabel: (data) => api.post('/shein-full/print-delivery-label', data),
  getEstimatedFee: (data) => api.post('/shein-full/estimated-fee', data)
};

// 兼容旧API名称（映射到shein-full）
export const sheinAuthAPI = sheinFullAuthAPI;
export const sheinProductsAPI = sheinFullProductsAPI;
export const sheinSyncAPI = sheinFullSyncAPI;

export const platformConfigsAPI = {
  // 平台配置
  getAll: (params) => api.get('/platforms', { params }),
  getByPlatform: (platform) => api.get(`/platforms/${platform}`),
  create: (data) => api.post('/platforms', data),
  update: (id, data) => api.put(`/platforms/${id}`, data),
  delete: (id) => api.delete(`/platforms/${id}`),
  // 店铺配置
  getShops: (params) => api.get('/platforms/shops/list', { params }),
  getShop: (id) => api.get(`/platforms/shops/${id}`),
  createShop: (data) => api.post('/platforms/shops', data),
  updateShop: (id, data) => api.put(`/platforms/shops/${id}`, data),
  deleteShop: (id) => api.delete(`/platforms/shops/${id}`),
  testShopConnection: (id) => api.post(`/platforms/shops/${id}/test`)
};

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  refresh: (data) => api.post('/auth/refresh', data),
  getCurrentUser: () => api.get('/auth/me'),
  changePassword: (data) => api.post('/auth/change-password', data)
};

// 用户管理 API
export const usersAPI = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  resetPassword: (id, data) => api.post(`/users/${id}/reset-password`, data),
  forceLogout: (id) => api.post(`/users/${id}/force-logout`)
};

// 角色管理 API
export const rolesAPI = {
  getAll: () => api.get('/roles'),
  getById: (id) => api.get(`/roles/${id}`),
  create: (data) => api.post('/roles', data),
  update: (id, data) => api.put(`/roles/${id}`, data),
  delete: (id) => api.delete(`/roles/${id}`),
  getAllPermissions: () => api.get('/roles/permissions/all')
};

// 企业信息 API
export const enterpriseAPI = {
  get: () => api.get('/enterprise'),
  update: (data) => api.put('/enterprise', data)
};

// 日志 API
export const logsAPI = {
  getOperationLogs: (params) => api.get('/logs/operation', { params }),
  getLoginLogs: (params) => api.get('/logs/login', { params }),
  getOperationDetail: (id) => api.get(`/logs/operation/${id}`),
  getModules: () => api.get('/logs/modules')
};

// PDA API
export const pdaAPI = {
  login: (data) => api.post('/pda/login', data),
  scanShip: (params) => api.get('/pda/scan-ship', { params }),
  confirmShip: (data) => api.post('/pda/confirm-ship', data),
  scanReceive: (params) => api.get('/pda/scan-receive', { params }),
  confirmReceive: (data) => api.post('/pda/confirm-receive', data),
  inventoryQuery: (params) => api.get('/pda/inventory-query', { params }),
  submitInventoryCheck: (data) => api.post('/pda/submit-inventory-check', data),
  getOrders: (params) => api.get('/pda/orders', { params })
};

// 供应商 API
export const suppliersAPI = {
  getAll: (params) => api.get('/suppliers', { params }),
  getById: (id) => api.get(`/suppliers/${id}`),
  create: (data) => api.post('/suppliers', data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
  delete: (id) => api.delete(`/suppliers/${id}`)
};

// 物流商 API
export const logisticsAPI = {
  getAll: (params) => api.get('/logistics', { params }),
  getById: (id) => api.get(`/logistics/${id}`),
  create: (data) => api.post('/logistics', data),
  update: (id, data) => api.put(`/logistics/${id}`, data),
  delete: (id) => api.delete(`/logistics/${id}`)
};

// 库存 API
export const inventoryAPI = {
  getAll: (params) => api.get('/inventory', { params }),
  getBySku: (sku) => api.get(`/inventory/sku/${sku}`),
  update: (id, data) => api.put(`/inventory/${id}`, data),
  sync: (data) => api.post('/inventory/sync', data)
};

// 合规标签 API
export const complianceLabelAPI = {
  getTemplates: (params) => api.get('/remote-print/compliance-label/templates', { params }),
  getTemplate: (id) => api.get(`/remote-print/compliance-label/templates/${id}`),
  createTemplate: (data) => api.post('/remote-print/compliance-label/templates', data),
  updateTemplate: (id, data) => api.put(`/remote-print/compliance-label/templates/${id}`, data),
  deleteTemplate: (id) => api.delete(`/remote-print/compliance-label/templates/${id}`),
  print: (data) => api.post('/remote-print/compliance-label/print', data),
  getMaterials: () => api.get('/remote-print/label-materials'),
  createMaterial: (data) => api.post('/remote-print/label-materials', data)
};

// OSS 文件上传 API
export const ossAPI = {
  // 获取OSS服务地址，自动匹配当前协议
  getBaseUrl: () => {
    const serviceHost = process.env.REACT_APP_SERVICE_HOST || window.location.hostname;
    const protocol = window.location.protocol;
    return `${protocol}//${serviceHost}:5000`;
  },
  // 上传文件
  upload: (file, category = 'permanent') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    return api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};

// 远程打印 API
export const remotePrintAPI = {
  // 获取所有打印客户端
  getClients: () => api.get('/remote-print/clients'),
  
  // 获取指定客户端的打印机列表
  getClientPrinters: (clientId) => api.get(`/remote-print/clients/${clientId}/printers`),
  
  // 添加 HTTP 打印客户端
  addHttpClient: (data) => api.post('/remote-print/http-clients', data),
  
  // 删除 HTTP 打印客户端
  deleteHttpClient: (clientId) => api.delete(`/remote-print/http-clients/${clientId}`),
  
  // 刷新 HTTP 客户端状态
  refreshHttpClient: (clientId) => api.post(`/remote-print/http-clients/${clientId}/refresh`),
  
  // 发送打印任务（通用）
  print: (data) => api.post('/remote-print/print', data),
  
  // 发送原生打印任务（HTTP客户端）
  printNative: (data) => api.post('/remote-print/print-native', data),
  
  // 转换模板为打印任务
  convertTemplate: (data) => api.post('/remote-print/convert-template', data)
};

export default api;
