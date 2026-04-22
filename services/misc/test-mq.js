/**
 * 消息队列连接验证脚本
 * 用法: node test-mq.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// 手动设置 shared 模块路径
const { MessageQueue, EXCHANGES, QUEUES } = require('../shared/utils/message-queue');
const serviceConfig = require('../shared/config/services');

async function test() {
  console.log('=== RabbitMQ 连接测试 ===');
  console.log('连接地址:', serviceConfig.rabbitmq.url);

  const producer = new MessageQueue('test-producer');
  const consumer = new MessageQueue('test-consumer');

  try {
    // 1. 连接
    await producer.connect();
    await consumer.connect();
    console.log('✓ 连接成功');

    // 2. 初始化基础设施
    await producer.setupInfrastructure();
    console.log('✓ 交换机和队列创建成功');

    // 3. 测试点对点消息
    const testQueue = 'eer.test.queue';
    let received = false;

    await consumer.consume(testQueue, async (data) => {
      console.log('✓ 收到消息:', JSON.stringify(data));
      received = true;
    });

    await producer.sendToQueue(testQueue, { hello: 'world', time: new Date().toISOString() });
    console.log('✓ 消息已发送');

    // 等待消息到达
    await new Promise(r => setTimeout(r, 2000));

    if (received) {
      console.log('\n=== 测试通过 ===');
      console.log('RabbitMQ 消息队列功能正常！');
    } else {
      console.log('\n=== 警告 ===');
      console.log('消息已发送但未收到，可能需要更长等待时间');
    }

    // 4. 测试发布/订阅
    let subReceived = false;
    await consumer.subscribe(EXCHANGES.SYNC_EVENTS, async (data) => {
      console.log('✓ 订阅收到事件:', JSON.stringify(data));
      subReceived = true;
    });

    await producer.publish(EXCHANGES.SYNC_EVENTS, { type: 'test.event', msg: '测试广播' });
    console.log('✓ 广播事件已发布');

    await new Promise(r => setTimeout(r, 2000));
    if (subReceived) {
      console.log('✓ 发布/订阅模式正常');
    }

  } catch (err) {
    console.error('✗ 测试失败:', err.message);
  } finally {
    await producer.close();
    await consumer.close();
    process.exit(0);
  }
}

test();
