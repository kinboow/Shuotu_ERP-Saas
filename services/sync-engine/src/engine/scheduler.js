/**
 * 同步任务调度器
 * 支持定时任务调度
 */

const cron = require('node-cron');
const SyncEngine = require('./sync-engine');

class SyncScheduler {
  constructor() {
    this.syncEngine = new SyncEngine();
    this.jobs = new Map();  // jobId -> cronJob
    this.configs = new Map(); // shopId -> 调度配置
  }

  /**
   * 添加定时同步任务
   * @param {string} shopId - 店铺ID
   * @param {Object} config - 调度配置
   */
  addJob(shopId, config) {
    const {
      ordersCron = '*/10 * * * *',  // 默认每10分钟
      productsCron = '0 */2 * * *', // 默认每2小时
      enabled = true
    } = config;

    if (!enabled) {
      console.log(`[Scheduler] 店铺 ${shopId} 调度已禁用`);
      return;
    }

    // 订单同步任务
    if (ordersCron) {
      const ordersJobId = `orders_${shopId}`;
      if (this.jobs.has(ordersJobId)) {
        this.jobs.get(ordersJobId).stop();
      }

      const ordersJob = cron.schedule(ordersCron, async () => {
        console.log(`[Scheduler] 执行订单同步: ${shopId}`);
        try {
          await this.syncEngine.syncOrders(shopId, {
            startTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // 最近24小时
            endTime: new Date()
          });
        } catch (error) {
          console.error(`[Scheduler] 订单同步失败: ${shopId}`, error.message);
        }
      }, { scheduled: false });

      this.jobs.set(ordersJobId, ordersJob);
      ordersJob.start();
      console.log(`[Scheduler] 添加订单同步任务: ${shopId} - ${ordersCron}`);
    }

    // 商品同步任务
    if (productsCron) {
      const productsJobId = `products_${shopId}`;
      if (this.jobs.has(productsJobId)) {
        this.jobs.get(productsJobId).stop();
      }

      const productsJob = cron.schedule(productsCron, async () => {
        console.log(`[Scheduler] 执行商品同步: ${shopId}`);
        try {
          await this.syncEngine.syncProducts(shopId, {});
        } catch (error) {
          console.error(`[Scheduler] 商品同步失败: ${shopId}`, error.message);
        }
      }, { scheduled: false });

      this.jobs.set(productsJobId, productsJob);
      productsJob.start();
      console.log(`[Scheduler] 添加商品同步任务: ${shopId} - ${productsCron}`);
    }

    this.configs.set(shopId, config);
  }

  /**
   * 移除店铺的所有定时任务
   * @param {string} shopId - 店铺ID
   */
  removeJob(shopId) {
    const ordersJobId = `orders_${shopId}`;
    const productsJobId = `products_${shopId}`;

    if (this.jobs.has(ordersJobId)) {
      this.jobs.get(ordersJobId).stop();
      this.jobs.delete(ordersJobId);
    }

    if (this.jobs.has(productsJobId)) {
      this.jobs.get(productsJobId).stop();
      this.jobs.delete(productsJobId);
    }

    this.configs.delete(shopId);
    console.log(`[Scheduler] 移除店铺任务: ${shopId}`);
  }

  /**
   * 手动触发同步
   * @param {string} shopId - 店铺ID
   * @param {string} type - 同步类型: orders/products/inventory
   * @param {Object} params - 同步参数
   */
  async triggerSync(shopId, type, params = {}) {
    console.log(`[Scheduler] 手动触发同步: ${shopId} - ${type}`);

    switch (type) {
      case 'orders':
        return await this.syncEngine.syncOrders(shopId, params);
      case 'products':
        return await this.syncEngine.syncProducts(shopId, params);
      case 'inventory':
        return await this.syncEngine.syncInventory(shopId, params.skuList || []);
      default:
        throw new Error(`未知的同步类型: ${type}`);
    }
  }

  /**
   * 获取所有任务状态
   */
  getStatus() {
    const status = {
      totalJobs: this.jobs.size,
      shops: []
    };

    for (const [shopId, config] of this.configs) {
      status.shops.push({
        shopId,
        config,
        ordersJobRunning: this.jobs.has(`orders_${shopId}`),
        productsJobRunning: this.jobs.has(`products_${shopId}`)
      });
    }

    return status;
  }

  /**
   * 停止所有任务
   */
  stopAll() {
    for (const [jobId, job] of this.jobs) {
      job.stop();
      console.log(`[Scheduler] 停止任务: ${jobId}`);
    }
    this.jobs.clear();
    console.log('[Scheduler] 所有任务已停止');
  }

  /**
   * 启动所有任务
   */
  startAll() {
    for (const [jobId, job] of this.jobs) {
      job.start();
      console.log(`[Scheduler] 启动任务: ${jobId}`);
    }
    console.log('[Scheduler] 所有任务已启动');
  }
}

// 单例
const scheduler = new SyncScheduler();

module.exports = scheduler;
module.exports.SyncScheduler = SyncScheduler;
