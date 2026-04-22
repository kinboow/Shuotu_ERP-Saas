/**
 * ERP微服务共享库入口
 */

// 统一数据模型
const UnifiedOrder = require('./models/unified-order');
const UnifiedProduct = require('./models/unified-product');
const UnifiedInventory = require('./models/unified-inventory');

// 工具类
const logger = require('./utils/logger');
const HttpClient = require('./utils/http-client');
const EventBus = require('./utils/event-bus');
const { MessageQueue, EXCHANGES, QUEUES } = require('./utils/message-queue');

// 配置
const serviceConfig = require('./config/services');

module.exports = {
  // 模型
  UnifiedOrder,
  UnifiedProduct,
  UnifiedInventory,
  
  // 工具
  logger,
  HttpClient,
  EventBus,
  MessageQueue,
  EXCHANGES,
  QUEUES,
  
  // 配置
  serviceConfig
};
