/**
 * 消息队列工具类
 * 基于 RabbitMQ (amqplib) 的服务间异步消息通信
 * 
 * 功能：
 * - 自动重连
 * - 发布/订阅模式（fanout exchange）
 * - 点对点模式（direct queue）
 * - 延迟重试（死信队列）
 * - 优雅关闭
 */

const amqp = require('amqplib');
const serviceConfig = require('../config/services');

// 预定义的交换机
const EXCHANGES = {
  ORDER_EVENTS: 'eer.order.events',       // 订单事件（fanout）
  PRODUCT_EVENTS: 'eer.product.events',    // 商品事件（fanout）
  SYNC_EVENTS: 'eer.sync.events',         // 同步事件（fanout）
  INVENTORY_EVENTS: 'eer.inventory.events', // 库存事件（fanout）
  NOTIFICATION: 'eer.notification',         // 通知（direct）
  DEAD_LETTER: 'eer.dead-letter',          // 死信交换机
};

// 预定义的队列
const QUEUES = {
  // 同步相关
  SYNC_PRODUCT: 'eer.sync.product',
  SYNC_ORDER: 'eer.sync.order',
  SYNC_INVENTORY: 'eer.sync.inventory',
  // 订单处理
  ORDER_CREATED: 'eer.order.created',
  ORDER_STATUS_CHANGED: 'eer.order.status-changed',
  // 库存
  INVENTORY_UPDATE: 'eer.inventory.update',
  // 通知
  NOTIFICATION_EMAIL: 'eer.notification.email',
  NOTIFICATION_WEBHOOK: 'eer.notification.webhook',
};

class MessageQueue {
  constructor(serviceName) {
    this.serviceName = serviceName;
    this.connection = null;
    this.channel = null;
    this.connected = false;
    this.reconnecting = false;
    this.consumers = []; // 记录消费者以便重连后恢复
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 20;
    this.reconnectDelay = 3000; // 初始重连延迟 3s
  }

  /**
   * 连接 RabbitMQ
   */
  async connect() {
    if (this.connected) return;

    const url = serviceConfig.rabbitmq.url;
    try {
      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();

      // 设置预取数量，防止单个消费者过载
      await this.channel.prefetch(10);

      // 监听连接关闭事件
      this.connection.on('close', () => {
        if (!this.reconnecting) {
          console.warn(`[MQ] ${this.serviceName} 连接已关闭，准备重连...`);
          this.connected = false;
          this._reconnect();
        }
      });

      this.connection.on('error', (err) => {
        console.error(`[MQ] ${this.serviceName} 连接错误:`, err.message);
      });

      this.connected = true;
      this.reconnectAttempts = 0;
      console.log(`[MQ] ${this.serviceName} 已连接 RabbitMQ`);
    } catch (err) {
      console.error(`[MQ] ${this.serviceName} 连接失败:`, err.message);
      this.connected = false;
      await this._reconnect();
    }
  }

  /**
   * 自动重连
   */
  async _reconnect() {
    if (this.reconnecting) return;
    this.reconnecting = true;

    while (this.reconnectAttempts < this.maxReconnectAttempts && !this.connected) {
      this.reconnectAttempts++;
      const delay = Math.min(this.reconnectDelay * this.reconnectAttempts, 30000);
      console.log(`[MQ] ${this.serviceName} 第 ${this.reconnectAttempts} 次重连，等待 ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));

      try {
        await this.connect();
        // 重连成功后恢复消费者
        if (this.connected && this.consumers.length > 0) {
          console.log(`[MQ] 恢复 ${this.consumers.length} 个消费者...`);
          for (const consumer of this.consumers) {
            await this._setupConsumer(consumer);
          }
        }
      } catch (e) {
        // connect 内部已处理
      }
    }

    this.reconnecting = false;
    if (!this.connected) {
      console.error(`[MQ] ${this.serviceName} 重连失败，已达最大重试次数`);
    }
  }

  /**
   * 确保交换机存在
   */
  async assertExchange(exchange, type = 'fanout', options = {}) {
    if (!this.connected) await this.connect();
    await this.channel.assertExchange(exchange, type, {
      durable: true,
      ...options
    });
  }

  /**
   * 确保队列存在
   */
  async assertQueue(queue, options = {}) {
    if (!this.connected) await this.connect();
    return await this.channel.assertQueue(queue, {
      durable: true,
      ...options
    });
  }

  /**
   * 初始化基础设施（交换机 + 死信队列）
   * 建议在服务启动时调用一次
   */
  async setupInfrastructure() {
    if (!this.connected) await this.connect();

    // 创建死信交换机和队列
    await this.assertExchange(EXCHANGES.DEAD_LETTER, 'fanout');
    await this.assertQueue('eer.dead-letter.queue');
    await this.channel.bindQueue('eer.dead-letter.queue', EXCHANGES.DEAD_LETTER, '');

    // 创建业务交换机
    await this.assertExchange(EXCHANGES.ORDER_EVENTS, 'fanout');
    await this.assertExchange(EXCHANGES.PRODUCT_EVENTS, 'fanout');
    await this.assertExchange(EXCHANGES.SYNC_EVENTS, 'fanout');
    await this.assertExchange(EXCHANGES.INVENTORY_EVENTS, 'fanout');
    await this.assertExchange(EXCHANGES.NOTIFICATION, 'direct');

    console.log(`[MQ] ${this.serviceName} 基础设施初始化完成`);
  }

  /**
   * 发布消息到交换机（发布/订阅模式）
   * @param {string} exchange - 交换机名称
   * @param {object} message - 消息内容
   * @param {string} routingKey - 路由键（direct 模式使用）
   */
  async publish(exchange, message, routingKey = '') {
    if (!this.connected) await this.connect();

    const payload = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      source: this.serviceName,
      timestamp: new Date().toISOString(),
      data: message
    };

    this.channel.publish(
      exchange,
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      {
        persistent: true,
        contentType: 'application/json',
        headers: { 'x-source': this.serviceName }
      }
    );

    console.log(`[MQ] 发布消息 -> ${exchange}${routingKey ? ':' + routingKey : ''} (${payload.id})`);
    return payload.id;
  }

  /**
   * 发送消息到指定队列（点对点模式）
   * @param {string} queue - 队列名称
   * @param {object} message - 消息内容
   * @param {object} options - 额外选项
   */
  async sendToQueue(queue, message, options = {}) {
    if (!this.connected) await this.connect();

    await this.assertQueue(queue, {
      deadLetterExchange: EXCHANGES.DEAD_LETTER,
      ...options.queueOptions
    });

    const payload = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      source: this.serviceName,
      timestamp: new Date().toISOString(),
      data: message
    };

    this.channel.sendToQueue(
      queue,
      Buffer.from(JSON.stringify(payload)),
      {
        persistent: true,
        contentType: 'application/json',
        headers: { 'x-source': this.serviceName }
      }
    );

    console.log(`[MQ] 发送消息 -> ${queue} (${payload.id})`);
    return payload.id;
  }

  /**
   * 订阅交换机消息（发布/订阅模式）
   * @param {string} exchange - 交换机名称
   * @param {function} handler - 消息处理函数 async (data, msg) => {}
   * @param {object} options - 选项
   */
  async subscribe(exchange, handler, options = {}) {
    if (!this.connected) await this.connect();

    const queueName = options.queue || `${exchange}.${this.serviceName}`;
    const routingKey = options.routingKey || '';

    const consumerDef = { type: 'subscribe', exchange, handler, options, queueName, routingKey };
    
    // 避免重复注册
    if (!this.consumers.find(c => c.queueName === queueName)) {
      this.consumers.push(consumerDef);
    }

    await this._setupConsumer(consumerDef);
  }

  /**
   * 消费队列消息（点对点模式）
   * @param {string} queue - 队列名称
   * @param {function} handler - 消息处理函数
   * @param {object} options - 选项
   */
  async consume(queue, handler, options = {}) {
    if (!this.connected) await this.connect();

    const consumerDef = { type: 'consume', queue, handler, options };

    if (!this.consumers.find(c => c.queue === queue)) {
      this.consumers.push(consumerDef);
    }

    await this._setupConsumer(consumerDef);
  }

  /**
   * 内部：设置消费者
   */
  async _setupConsumer(consumerDef) {
    try {
      if (consumerDef.type === 'subscribe') {
        const { exchange, handler, queueName, routingKey } = consumerDef;
        
        await this.assertExchange(exchange, 'fanout');
        await this.assertQueue(queueName, {
          deadLetterExchange: EXCHANGES.DEAD_LETTER
        });
        await this.channel.bindQueue(queueName, exchange, routingKey);

        await this.channel.consume(queueName, async (msg) => {
          if (!msg) return;
          await this._processMessage(msg, handler, queueName);
        }, { noAck: false });

        console.log(`[MQ] ${this.serviceName} 订阅 ${exchange} -> ${queueName}`);
      } else {
        const { queue, handler } = consumerDef;

        await this.assertQueue(queue, {
          deadLetterExchange: EXCHANGES.DEAD_LETTER
        });

        await this.channel.consume(queue, async (msg) => {
          if (!msg) return;
          await this._processMessage(msg, handler, queue);
        }, { noAck: false });

        console.log(`[MQ] ${this.serviceName} 消费队列 ${queue}`);
      }
    } catch (err) {
      console.error(`[MQ] 设置消费者失败:`, err.message);
    }
  }

  /**
   * 内部：处理消息
   */
  async _processMessage(msg, handler, source) {
    try {
      const payload = JSON.parse(msg.content.toString());
      console.log(`[MQ] 收到消息 <- ${source} (${payload.id})`);

      await handler(payload.data, payload);
      this.channel.ack(msg);
    } catch (err) {
      console.error(`[MQ] 处理消息失败 (${source}):`, err.message);

      // 检查重试次数
      const retryCount = (msg.properties.headers && msg.properties.headers['x-retry-count']) || 0;
      if (retryCount < 3) {
        // 重新入队并增加重试计数
        this.channel.nack(msg, false, false); // 发送到死信队列
      } else {
        // 超过重试次数，丢弃
        console.error(`[MQ] 消息已超过最大重试次数，丢弃: ${source}`);
        this.channel.ack(msg);
      }
    }
  }

  /**
   * 优雅关闭
   */
  async close() {
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
      this.connected = false;
      this.consumers = [];
      console.log(`[MQ] ${this.serviceName} 已断开 RabbitMQ`);
    } catch (err) {
      console.error(`[MQ] 关闭连接出错:`, err.message);
    }
  }
}

module.exports = { MessageQueue, EXCHANGES, QUEUES };
