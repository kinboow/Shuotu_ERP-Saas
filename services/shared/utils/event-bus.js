/**
 * 事件总线
 * 基于Redis Pub/Sub的服务间事件通信
 */

const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');
const serviceConfig = require('../config/services');

class EventBus {
  constructor(serviceName) {
    this.serviceName = serviceName;
    this.publisher = null;
    this.subscriber = null;
    this.handlers = new Map();
    this.connected = false;
  }
  
  /**
   * 连接Redis
   */
  async connect() {
    if (this.connected) return;
    
    const redisConfig = {
      host: serviceConfig.redis.host,
      port: serviceConfig.redis.port,
      password: serviceConfig.redis.password || undefined,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    };
    
    this.publisher = new Redis(redisConfig);
    this.subscriber = new Redis(redisConfig);
    
    this.subscriber.on('message', (channel, message) => {
      this._handleMessage(channel, message);
    });
    
    this.connected = true;
    console.log(`[EventBus] ${this.serviceName} 已连接Redis`);
  }
  
  /**
   * 发布事件
   */
  async publish(eventName, data) {
    if (!this.connected) await this.connect();
    
    const event = {
      id: uuidv4(),
      name: eventName,
      source: this.serviceName,
      data,
      timestamp: Date.now()
    };
    
    await this.publisher.publish(eventName, JSON.stringify(event));
    console.log(`[EventBus] 发布事件: ${eventName}`, { id: event.id });
  }
  
  /**
   * 订阅事件
   */
  async subscribe(eventName, handler) {
    if (!this.connected) await this.connect();
    
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
      await this.subscriber.subscribe(eventName);
      console.log(`[EventBus] 订阅事件: ${eventName}`);
    }
    
    this.handlers.get(eventName).push(handler);
  }
  
  /**
   * 处理接收到的消息
   */
  async _handleMessage(channel, message) {
    const handlers = this.handlers.get(channel);
    if (!handlers || handlers.length === 0) return;
    
    try {
      const event = JSON.parse(message);
      console.log(`[EventBus] 收到事件: ${channel}`, { id: event.id, source: event.source });
      
      for (const handler of handlers) {
        try {
          await handler(event.data, event);
        } catch (error) {
          console.error(`[EventBus] 处理事件失败: ${channel}`, error);
        }
      }
    } catch (error) {
      console.error(`[EventBus] 解析消息失败: ${channel}`, error);
    }
  }
  
  /**
   * 关闭连接
   */
  async close() {
    if (this.publisher) await this.publisher.quit();
    if (this.subscriber) await this.subscriber.quit();
    this.connected = false;
    console.log(`[EventBus] ${this.serviceName} 已断开连接`);
  }
}

module.exports = EventBus;
