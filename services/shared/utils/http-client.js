/**
 * HTTP客户端工具
 * 用于服务间通信
 */

const axios = require('axios');
const serviceConfig = require('../config/services');

class HttpClient {
  constructor(options = {}) {
    this.timeout = options.timeout || 10000;
    this.retries = options.retries || 3;
    this.retryDelay = options.retryDelay || 1000;
  }
  
  /**
   * 创建针对特定服务的客户端
   */
  forService(serviceName) {
    const baseURL = serviceConfig.getServiceUrl(serviceName);
    
    const client = axios.create({
      baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Name': process.env.SERVICE_NAME || 'unknown'
      }
    });
    
    // 请求拦截器
    client.interceptors.request.use(config => {
      config.metadata = { startTime: Date.now() };
      return config;
    });
    
    // 响应拦截器
    client.interceptors.response.use(
      response => {
        const duration = Date.now() - response.config.metadata.startTime;
        console.log(`[HTTP] ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status} (${duration}ms)`);
        return response;
      },
      error => {
        const duration = error.config?.metadata ? Date.now() - error.config.metadata.startTime : 0;
        console.error(`[HTTP] ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.response?.status || 'ERROR'} (${duration}ms)`);
        throw error;
      }
    );
    
    return client;
  }
  
  /**
   * 带重试的请求
   */
  async requestWithRetry(client, config) {
    let lastError;
    
    for (let i = 0; i < this.retries; i++) {
      try {
        return await client.request(config);
      } catch (error) {
        lastError = error;
        
        // 不重试的情况：4xx错误
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
          throw error;
        }
        
        // 等待后重试
        if (i < this.retries - 1) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * (i + 1)));
        }
      }
    }
    
    throw lastError;
  }
}

module.exports = HttpClient;
