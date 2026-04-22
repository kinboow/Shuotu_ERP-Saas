/**
 * Sync-Engine 消息队列集成
 * 负责发布同步事件，消费同步任务
 */

const { MessageQueue, EXCHANGES, QUEUES } = require('../../../shared/utils/message-queue');

let mq = null;

/**
 * 初始化消息队列
 */
const initMQ = async () => {
  try {
    mq = new MessageQueue('sync-engine');
    await mq.connect();
    await mq.setupInfrastructure();

    // 注册消费者：监听同步任务请求
    await mq.consume(QUEUES.SYNC_PRODUCT, async (data, msg) => {
      console.log('[MQ] 收到商品同步任务:', data);
      // 这里可以调用 SheinFullSyncService 执行同步
      // 示例：await syncService.syncProducts(data.shopId, data.params);
    });

    await mq.consume(QUEUES.SYNC_ORDER, async (data, msg) => {
      console.log('[MQ] 收到订单同步任务:', data);
    });

    await mq.consume(QUEUES.SYNC_INVENTORY, async (data, msg) => {
      console.log('[MQ] 收到库存同步任务:', data);
    });

    console.log('[MQ] sync-engine 消息队列初始化完成');
  } catch (err) {
    console.warn('[MQ] sync-engine 消息队列初始化失败（服务仍可正常运行）:', err.message);
  }
};

/**
 * 获取 MQ 实例
 */
const getMQ = () => mq;

/**
 * 发布同步完成事件
 */
const publishSyncComplete = async (eventData) => {
  if (!mq || !mq.connected) return;
  try {
    await mq.publish(EXCHANGES.SYNC_EVENTS, {
      type: 'sync.complete',
      ...eventData
    });
  } catch (err) {
    console.error('[MQ] 发布同步完成事件失败:', err.message);
  }
};

/**
 * 发布商品变更事件
 */
const publishProductChange = async (eventData) => {
  if (!mq || !mq.connected) return;
  try {
    await mq.publish(EXCHANGES.PRODUCT_EVENTS, {
      type: 'product.changed',
      ...eventData
    });
  } catch (err) {
    console.error('[MQ] 发布商品变更事件失败:', err.message);
  }
};

/**
 * 发布订单变更事件
 */
const publishOrderChange = async (eventData) => {
  if (!mq || !mq.connected) return;
  try {
    await mq.publish(EXCHANGES.ORDER_EVENTS, {
      type: 'order.changed',
      ...eventData
    });
  } catch (err) {
    console.error('[MQ] 发布订单变更事件失败:', err.message);
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
  publishSyncComplete,
  publishProductChange,
  publishOrderChange,
  closeMQ
};
