/**
 * MISC 服务消息队列集成
 * 负责消费通知事件，监听同步完成等
 */

const { MessageQueue, EXCHANGES, QUEUES } = require('../../../shared/utils/message-queue');

let mq = null;

/**
 * 初始化消息队列
 */
const initMQ = async () => {
  try {
    mq = new MessageQueue('misc');
    await mq.connect();
    await mq.setupInfrastructure();

    // 订阅同步事件（如同步完成后记录日志等）
    await mq.subscribe(EXCHANGES.SYNC_EVENTS, async (data, msg) => {
      console.log('[MQ] misc 收到同步事件:', data.type);
      // 可在此处记录操作日志、发送通知等
    });

    // 订阅订单事件
    await mq.subscribe(EXCHANGES.ORDER_EVENTS, async (data, msg) => {
      console.log('[MQ] misc 收到订单事件:', data.type);
    });

    // 订阅商品事件
    await mq.subscribe(EXCHANGES.PRODUCT_EVENTS, async (data, msg) => {
      console.log('[MQ] misc 收到商品事件:', data.type);
    });

    // 消费通知队列
    await mq.consume(QUEUES.NOTIFICATION_EMAIL, async (data, msg) => {
      console.log('[MQ] 处理邮件通知:', data);
      // TODO: 接入邮件发送服务
    });

    await mq.consume(QUEUES.NOTIFICATION_WEBHOOK, async (data, msg) => {
      console.log('[MQ] 处理Webhook通知:', data);
      // TODO: 接入Webhook推送
    });

    console.log('[MQ] misc 消息队列初始化完成');
  } catch (err) {
    console.warn('[MQ] misc 消息队列初始化失败（服务仍可正常运行）:', err.message);
  }
};

/**
 * 获取 MQ 实例
 */
const getMQ = () => mq;

/**
 * 发送通知到队列
 */
const sendNotification = async (type, data) => {
  if (!mq || !mq.connected) return;
  try {
    const queue = type === 'email' ? QUEUES.NOTIFICATION_EMAIL : QUEUES.NOTIFICATION_WEBHOOK;
    await mq.sendToQueue(queue, data);
  } catch (err) {
    console.error('[MQ] 发送通知失败:', err.message);
  }
};

/**
 * 优雅关闭
 */
const closeMQ = async () => {
  if (mq) await mq.close();
};

module.exports = {
  initMQ,
  getMQ,
  sendNotification,
  closeMQ
};
