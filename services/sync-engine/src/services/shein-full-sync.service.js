/**
 * SHEIN(full)数据同步服务 - 全托管模式
 * 负责将SHEIN API数据同步到本地数据库
 * 支持异步非阻塞同步，不影响其他功能使用
 */
const { v4: uuidv4 } = require('uuid');
const SheinFullAdapter = require('../adapters/shein-full.adapter');
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

// 同步任务状态存储（内存中）
const syncTasksStatus = new Map();

// 运行中的同步任务锁 - key: `${shopId}_${dataType}`, value: taskId
const runningSyncLocks = new Map();

class SheinFullSyncService {
  constructor() {
    this.sequelize = sequelize;
    this._ensureProductBarcodeColumnPromise = null;
  }

  /**
   * 获取适配器 - 从shein_full_shops表获取配置
   */
  async getAdapter(shopId) {
    const [shops] = await this.sequelize.query(`
      SELECT * FROM shein_full_shops WHERE id = ? AND status = 1
    `, { replacements: [shopId], type: QueryTypes.SELECT });

    const shop = shops;
    if (!shop) throw new Error('店铺不存在或已禁用');
    if (shop.auth_status !== 1) throw new Error('店铺未授权，请先完成授权');

    return new SheinFullAdapter({
      openKeyId: shop.open_key_id,
      secretKey: shop.secret_key,
      appId: shop.app_id,
      appSecret: shop.app_secret,
      baseUrl: shop.base_url || 'https://openapi.sheincorp.cn',
      appType: shop.is_test === 1 ? 'test' : 'full-managed',
      shopId: shop.id
    });
  }

  /**
   * 创建同步任务记录
   */
  async createSyncTask(platform, shopId, taskType, params = {}) {
    const taskId = uuidv4().replace(/-/g, '');
    await this.sequelize.query(`
      INSERT INTO sync_tasks (task_id, platform, shop_id, task_type, status, params, created_at)
      VALUES (?, ?, ?, ?, 'PENDING', ?, NOW())
    `, {
      replacements: [taskId, platform, shopId, taskType, JSON.stringify(params)]
    });

    // 初始化内存状态
    syncTasksStatus.set(taskId, {
      status: 'PENDING',
      progress: 0,
      currentDataType: null,
      currentDataTypeName: null,
      results: {},
      startedAt: null,
      completedAt: null
    });

    return taskId;
  }

  /**
   * 更新同步任务状态
   */
  async updateSyncTask(taskId, updates) {
    const sets = [];
    const values = [];

    // 更新内存状态
    const memStatus = syncTasksStatus.get(taskId) || {};
    Object.assign(memStatus, updates);
    syncTasksStatus.set(taskId, memStatus);

    // 更新数据库
    for (const [key, value] of Object.entries(updates)) {
      if (['currentDataType', 'currentDataTypeName', 'progress', 'results'].includes(key)) continue;
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      sets.push(`${dbKey} = ?`);
      // Date对象直接使用，其他对象才JSON序列化
      if (value instanceof Date) {
        values.push(value);
      } else if (typeof value === 'object' && value !== null) {
        values.push(JSON.stringify(value));
      } else {
        values.push(value);
      }
    }

    if (sets.length > 0) {
      values.push(taskId);
      await this.sequelize.query(`
        UPDATE sync_tasks SET ${sets.join(', ')}, updated_at = NOW() WHERE task_id = ?
      `, { replacements: values });
    }
  }

  /**
   * 获取同步任务状态
   */
  getSyncTaskStatus(taskId) {
    return syncTasksStatus.get(taskId) || null;
  }


  /**
   * 检查是否有正在运行的同步任务
   * @param {number} shopId - 店铺ID
   * @param {string[]} dataTypes - 数据类型数组
   * @returns {object|null} 返回已存在的任务信息或null
   */
  checkRunningSyncTask(shopId, dataTypes) {
    for (const dataType of dataTypes) {
      const lockKey = `${shopId}_${dataType}`;
      const existingTaskId = runningSyncLocks.get(lockKey);
      if (existingTaskId) {
        const status = syncTasksStatus.get(existingTaskId);
        if (status && ['PENDING', 'RUNNING'].includes(status.status)) {
          return {
            taskId: existingTaskId,
            dataType,
            status: status.status,
            progress: status.progress
          };
        } else {
          // 任务已完成，清除锁
          runningSyncLocks.delete(lockKey);
        }
      }
    }
    return null;
  }

  /**
   * 获取店铺所有运行中的同步任务
   * @param {number} shopId - 店铺ID
   * @returns {Array} 运行中的任务列表
   */
  getRunningTasksForShop(shopId) {
    const tasks = [];
    for (const [lockKey, taskId] of runningSyncLocks.entries()) {
      if (lockKey.startsWith(`${shopId}_`)) {
        const status = syncTasksStatus.get(taskId);
        if (status && ['PENDING', 'RUNNING'].includes(status.status)) {
          const dataType = lockKey.replace(`${shopId}_`, '');
          tasks.push({
            taskId,
            dataType,
            dataTypeName: this._getDataTypeName(dataType),
            ...status
          });
        }
      }
    }
    return tasks;
  }

  /**
   * 批量同步多种数据类型（异步非阻塞）
   * @param {number} shopId - 店铺ID
   * @param {string[]} dataTypes - 数据类型数组
   * @param {object} params - 同步参数
   * @returns {Promise<{taskId: string, isExisting?: boolean}>}
   */
  async batchSync(shopId, dataTypes, params = {}) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[同步任务] 开始批量同步`);
    console.log(`[同步任务] 店铺ID: ${shopId}`);
    console.log(`[同步任务] 数据类型: ${dataTypes.join(', ')}`);
    console.log(`[同步任务] 参数: ${JSON.stringify(params)}`);
    console.log(`${'='.repeat(60)}\n`);

    // 检查是否有正在运行的任务
    const existingTask = this.checkRunningSyncTask(shopId, dataTypes);
    if (existingTask) {
      console.log(`[同步任务] ⚠️ 店铺${shopId}的${existingTask.dataType}同步任务已在运行中: ${existingTask.taskId}`);
      return {
        taskId: existingTask.taskId,
        isExisting: true,
        message: `${this._getDataTypeName(existingTask.dataType)}同步任务正在进行中，请等待完成`
      };
    }

    const taskId = await this.createSyncTask('shein_full', shopId, 'batch', { dataTypes, ...params });
    console.log(`[同步任务] ✅ 创建任务成功，任务ID: ${taskId}`);

    // 设置锁
    for (const dataType of dataTypes) {
      const lockKey = `${shopId}_${dataType}`;
      runningSyncLocks.set(lockKey, taskId);
      console.log(`[同步任务] 🔒 设置锁: ${lockKey}`);
    }

    // 异步执行同步任务，不阻塞响应
    setImmediate(async () => {
      const startTime = Date.now();
      try {
        await this.updateSyncTask(taskId, { status: 'RUNNING', startedAt: new Date() });
        console.log(`[同步任务] 🚀 任务开始执行: ${taskId}`);

        const results = {};
        const totalTypes = dataTypes.length;
        let completedTypes = 0;

        for (const dataType of dataTypes) {
          const dataTypeName = this._getDataTypeName(dataType);
          const typeStartTime = Date.now();
          console.log(`\n[同步任务] ▶️ 开始同步: ${dataTypeName} (${dataType})`);
          
          await this.updateSyncTask(taskId, {
            currentDataType: dataType,
            currentDataTypeName: dataTypeName,
            progress: Math.round((completedTypes / totalTypes) * 100)
          });

          try {
            let result;
            switch (dataType) {
              case 'orders':
              case 'stock_orders':
              case 'purchase_orders':
                console.log(`[同步任务] 📦 调用 syncPurchaseOrders...`);
                result = await this.syncPurchaseOrders(shopId, params);
                break;
              case 'delivery_orders':
                console.log(`[同步任务] 🚚 调用 syncDeliveryOrders...`);
                result = await this.syncDeliveryOrders(shopId, params);
                break;
              case 'products':
                console.log(`[同步任务] 🏷️ 调用 syncProducts...`);
                result = await this.syncProducts(shopId, params);
                break;
              case 'inventory':
                console.log(`[同步任务] 📊 调用 syncInventory...`);
                result = await this.syncInventory(shopId, params);
                break;
              case 'finance':
              case 'reports':
                console.log(`[同步任务] 💰 调用 syncReports...`);
                result = await this.syncReports(shopId, params);
                break;
              default:
                result = { error: `未知数据类型: ${dataType}` };
            }
            results[dataType] = { success: true, ...result };
            const typeElapsed = ((Date.now() - typeStartTime) / 1000).toFixed(2);
            console.log(`[同步任务] ✅ ${dataTypeName}同步完成，耗时: ${typeElapsed}s，结果: ${JSON.stringify(result)}`);
          } catch (error) {
            results[dataType] = { success: false, error: error.message };
            console.error(`[同步任务] ❌ ${dataTypeName}同步失败: ${error.message}`);
            console.error(`[同步任务] 错误堆栈:`, error.stack);
          }

          completedTypes++;
          await this.updateSyncTask(taskId, {
            progress: Math.round((completedTypes / totalTypes) * 100),
            results
          });

          // 单个数据类型完成后释放锁
          const lockKey = `${shopId}_${dataType}`;
          runningSyncLocks.delete(lockKey);
          console.log(`[同步任务] 🔓 释放锁: ${lockKey}`);
        }

        await this.updateSyncTask(taskId, {
          status: 'completed',
          progress: 100,
          completedAt: new Date(),
          result: results
        });

        // 更新店铺最后同步时间
        await this.sequelize.query(`
          UPDATE shein_full_shops SET last_sync_at = NOW() WHERE id = ?
        `, { replacements: [shopId] });

        const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n${'='.repeat(60)}`);
        console.log(`[同步任务] ✅ 任务完成: ${taskId}`);
        console.log(`[同步任务] 总耗时: ${totalElapsed}s`);
        console.log(`[同步任务] 结果汇总: ${JSON.stringify(results, null, 2)}`);
        console.log(`${'='.repeat(60)}\n`);

      } catch (error) {
        // 任务失败时释放所有锁
        for (const dataType of dataTypes) {
          const lockKey = `${shopId}_${dataType}`;
          runningSyncLocks.delete(lockKey);
        }
        await this.updateSyncTask(taskId, {
          status: 'FAILED',
          errorMessage: error.message,
          completedAt: new Date()
        });
        console.error(`\n${'='.repeat(60)}`);
        console.error(`[同步任务] ❌ 任务失败: ${taskId}`);
        console.error(`[同步任务] 错误: ${error.message}`);
        console.error(`[同步任务] 堆栈:`, error.stack);
        console.error(`${'='.repeat(60)}\n`);
      }
    });

    return { taskId };
  }

  /**
   * 获取数据类型中文名称
   */
  _getDataTypeName(dataType) {
    const names = {
      'orders': '订单/采购单',
      'stock_orders': '采购单',
      'purchase_orders': '采购单',
      'delivery_orders': '发货单',
      'products': '商品',
      'inventory': '库存',
      'finance': '财务',
      'reports': '报账单'
    };
    return names[dataType] || dataType;
  }

  /**
   * 同步采购单
   */
  async syncPurchaseOrders(shopId, params = {}) {
    console.log(`[采购单同步] 开始同步，店铺ID: ${shopId}`);
    
    const adapter = await this.getAdapter(shopId);
    console.log(`[采购单同步] 获取适配器成功`);
    
    let page = 1;
    let totalCount = 0;
    let successCount = 0;
    let failCount = 0;

    // 默认同步最近60天的数据
    const endTime = params.endTime || new Date();
    const startTime = params.startTime || new Date(endTime.getTime() - 60 * 24 * 60 * 60 * 1000);
    
    console.log(`[采购单同步] 时间范围: ${this._formatDateTime(startTime)} ~ ${this._formatDateTime(endTime)}`);

    while (true) {
      console.log(`[采购单同步] 请求第${page}页数据...`);
      
      const requestParams = {
        combineTimeStart: this._formatDateTime(startTime),
        combineTimeEnd: this._formatDateTime(endTime),
        pageNumber: page,
        pageSize: 200
      };
      console.log(`[采购单同步] 请求参数: ${JSON.stringify(requestParams)}`);
      
      const result = await adapter.getPurchaseOrders(requestParams);
      console.log(`[采购单同步] API响应: code=${result.code}, msg=${result.msg}`);

      const orders = result.info?.list || [];
      console.log(`[采购单同步] 第${page}页获取${orders.length}条数据`);
      
      if (orders.length === 0) {
        console.log(`[采购单同步] 无更多数据，停止翻页`);
        break;
      }

      for (const order of orders) {
        try {
          await this.savePurchaseOrder(shopId, order);
          successCount++;
          if (successCount % 50 === 0) {
            console.log(`[采购单同步] 已保存${successCount}条...`);
          }
        } catch (err) {
          failCount++;
          console.error(`[采购单同步] ❌ 保存失败: ${order.orderNo}, 错误: ${err.message}`);
        }
      }

      totalCount += orders.length;
      page++;

      if (orders.length < 200) {
        console.log(`[采购单同步] 本页数据不足200条，停止翻页`);
        break;
      }
      // 防止请求过快，避免触发限流
      await this._sleep(200);
    }

    console.log(`[采购单同步] 完成，总计: ${totalCount}, 成功: ${successCount}, 失败: ${failCount}`);
    return { totalCount, successCount, failCount };
  }


  /**
   * 保存采购单到数据库
   */
  async savePurchaseOrder(shopId, order) {
    const [existing] = await this.sequelize.query(`
      SELECT id FROM shein_full_purchase_orders WHERE shop_id = ? AND order_no = ?
    `, { replacements: [shopId, order.orderNo], type: QueryTypes.SELECT });

    const orderData = {
      shop_id: shopId,
      order_no: order.orderNo,
      order_type: order.type,
      order_type_name: order.typeName,
      status: order.status,
      status_name: order.statusName,
      supplier_name: order.supplierName,
      currency: order.currency || order.currencyName,
      warehouse_name: order.warehouseName,
      storage_id: order.storageId,
      first_mark: order.firstMark,
      prepare_type_id: order.prepareTypeId,
      prepare_type_name: order.prepareTypeName,
      urgent_type: order.urgentType,
      is_jit_mother: order.isJitMotherName,
      add_time: this._parseDateTime(order.addTime),
      allocate_time: this._parseDateTime(order.allocateTime),
      delivery_time: this._parseDateTime(order.deliveryTime),
      receipt_time: this._parseDateTime(order.receiptTime),
      check_time: this._parseDateTime(order.checkTime),
      storage_time: this._parseDateTime(order.storageTime),
      update_time: this._parseDateTime(order.updateTime),
      request_receipt_time: this._parseDateTime(order.requestReceiptTime),
      request_take_parcel_time: this._parseDateTime(order.requestTakeParcelTime),
      order_labels: JSON.stringify(order.orderLabelInfo || []),
      goods_level: JSON.stringify(order.goodsLevel || []),
      raw_data: JSON.stringify(order),
      synced_at: new Date()
    };

    let orderId;
    if (existing) {
      orderId = existing.id;
      const sets = Object.keys(orderData).map(k => `${k} = ?`).join(', ');
      await this.sequelize.query(`
        UPDATE shein_full_purchase_orders SET ${sets}, updated_at = NOW() WHERE id = ?
      `, { replacements: [...Object.values(orderData), orderId] });
    } else {
      const cols = Object.keys(orderData).join(', ');
      const placeholders = Object.keys(orderData).map(() => '?').join(', ');
      const [result] = await this.sequelize.query(`
        INSERT INTO shein_full_purchase_orders (${cols}, created_at) VALUES (${placeholders}, NOW())
      `, { replacements: Object.values(orderData) });
      orderId = result;
    }

    // 保存订单明细
    if (order.orderExtends && order.orderExtends.length > 0) {
      await this.sequelize.query(`DELETE FROM shein_full_purchase_order_items WHERE order_id = ?`, {
        replacements: [orderId]
      });

      for (const item of order.orderExtends) {
        await this.sequelize.query(`
          INSERT INTO shein_full_purchase_order_items 
          (order_id, order_no, skc, sku_code, supplier_code, supplier_sku, suffix_zh, 
           img_path, sku_img, price, need_quantity, order_quantity, delivery_quantity,
           receipt_quantity, storage_quantity, defective_quantity, remark, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, {
          replacements: [
            orderId, order.orderNo, item.skc, item.skuCode, item.supplierCode,
            item.supplierSku, item.suffixZh, item.imgPath, item.skuImg,
            item.price, item.needQuantity, item.orderQuantity, item.deliveryQuantity,
            item.receiptQuantity, item.storageQuantity, item.defectiveQuantity, item.remark
          ]
        });
      }
    }

    return orderId;
  }

  /**
   * 同步发货单
   * 按60天间隔从当前时间(UTC+8)往2013年查询
   * 每个间隔内自动翻页直到返回数量<200
   * 连续3个间隔返回0条数据则停止
   */
  async syncDeliveryOrders(shopId, params = {}) {
    const adapter = await this.getAdapter(shopId);
    const perPage = 200;
    const intervalDays = 60;
    const minYear = 2013;
    
    // 收集所有发货单数据
    const allDeliveries = [];
    let emptyIntervalCount = 0; // 连续空间隔计数
    
    // 获取当前时间(UTC+8)
    const now = new Date();
    const utc8Offset = 8 * 60 * 60 * 1000;
    let endTime = new Date(now.getTime() + utc8Offset);
    
    console.log(`[发货单同步] 开始同步，从 ${this._formatDateTime(endTime)} 往 ${minYear}年 查询，间隔${intervalDays}天`);
    
    while (true) {
      // 计算本次查询的时间范围
      const startTime = new Date(endTime.getTime() - intervalDays * 24 * 60 * 60 * 1000);
      
      // 如果开始时间早于2013年，调整为2013年1月1日
      const minDate = new Date(minYear, 0, 1);
      if (startTime < minDate) {
        startTime.setTime(minDate.getTime());
      }
      
      console.log(`[发货单同步] 查询时间段: ${this._formatDateTime(startTime)} ~ ${this._formatDateTime(endTime)}`);
      
      let page = 1;
      let intervalCount = 0;
      
      // 在当前时间间隔内翻页查询
      while (true) {
        const result = await adapter.getDeliveryList({
          startTime: this._formatDateTime(startTime),
          endTime: this._formatDateTime(endTime),
          page: page,
          perPage: perPage
        });
        
        const deliveries = result.info?.list || [];
        
        if (deliveries.length > 0) {
          allDeliveries.push(...deliveries);
          intervalCount += deliveries.length;
          console.log(`[发货单同步] 第${page}页获取${deliveries.length}条，本间隔累计${intervalCount}条`);
        }
        
        // 当返回数量小于perPage时，本间隔查询完成
        if (deliveries.length < perPage) break;
        
        page++;
        await this._sleep(200);
      }
      
      // 检查本间隔是否有数据
      if (intervalCount === 0) {
        emptyIntervalCount++;
        console.log(`[发货单同步] 本间隔无数据，连续空间隔: ${emptyIntervalCount}/3`);
        
        // 连续3个间隔无数据，停止查询
        if (emptyIntervalCount >= 3) {
          console.log(`[发货单同步] 连续3个间隔无数据，停止查询`);
          break;
        }
      } else {
        emptyIntervalCount = 0; // 重置连续空间隔计数
      }
      
      // 如果已经查到2013年，停止
      if (startTime <= minDate) {
        console.log(`[发货单同步] 已查询到${minYear}年，停止`);
        break;
      }
      
      // 移动到下一个时间间隔
      endTime = new Date(startTime.getTime() - 1000); // 减1秒避免重复
      await this._sleep(200);
    }
    
    console.log(`[发货单同步] 查询完成，共获取${allDeliveries.length}条，开始写入数据库...`);
    
    // 写入数据库
    let successCount = 0;
    let failCount = 0;
    
    for (const delivery of allDeliveries) {
      try {
        await this.saveDeliveryOrder(shopId, delivery);
        successCount++;
      } catch (err) {
        failCount++;
        console.error(`保存发货单失败: ${delivery.deliveryCode}`, err.message);
      }
    }
    
    console.log(`[发货单同步] 写入完成，成功${successCount}条，失败${failCount}条`);
    
    return { totalCount: allDeliveries.length, successCount, failCount };
  }


  /**
   * 保存发货单到数据库（使用原子操作避免并发问题）
   * 使用 INSERT ... ON DUPLICATE KEY UPDATE 确保并发安全
   */
  async saveDeliveryOrder(shopId, delivery) {
    const deliveryData = {
      shop_id: shopId,
      delivery_code: delivery.deliveryCode,
      delivery_type: delivery.deliveryType,
      delivery_type_name: delivery.deliveryTypeName,
      express_id: delivery.expressId,
      express_company_name: delivery.expressCompanyName,
      express_code: delivery.expressCode,
      send_package: delivery.sendPackage,
      package_weight: delivery.packageWeight,
      take_parcel_time: this._parseDateTime(delivery.takeParcelTime),
      reserve_parcel_time: this._parseDateTime(delivery.reserveParcelTime),
      add_time: this._parseDateTime(delivery.addTime),
      pre_receipt_time: this._parseDateTime(delivery.preReceiptTime),
      receipt_time: this._parseDateTime(delivery.receiptTime),
      supplier_warehouse_id: delivery.supplierWarehouseId,
      supplier_warehouse_name: delivery.supplierWarehouseName,
      raw_data: JSON.stringify(delivery),
      synced_at: new Date()
    };

    const cols = Object.keys(deliveryData).join(', ');
    const placeholders = Object.keys(deliveryData).map(() => '?').join(', ');
    // 生成 ON DUPLICATE KEY UPDATE 部分（排除主键和唯一键）
    const updateCols = Object.keys(deliveryData)
      .filter(k => !['shop_id', 'delivery_code'].includes(k))
      .map(k => `${k} = VALUES(${k})`)
      .join(', ');

    // 原子操作：存在则更新，不存在则插入
    await this.sequelize.query(`
      INSERT INTO shein_full_delivery_orders (${cols}, created_at) 
      VALUES (${placeholders}, NOW())
      ON DUPLICATE KEY UPDATE ${updateCols}
    `, { replacements: Object.values(deliveryData) });

    // 获取实际的 delivery_id（无论是新插入还是更新）
    const [row] = await this.sequelize.query(`
      SELECT id FROM shein_full_delivery_orders WHERE shop_id = ? AND delivery_code = ?
    `, { replacements: [shopId, delivery.deliveryCode], type: QueryTypes.SELECT });
    
    if (!row) {
      console.error(`[发货单] 无法获取delivery_id: shop_id=${shopId}, delivery_code=${delivery.deliveryCode}`);
      return null;
    }
    const deliveryId = row.id;

    // 保存发货单明细
    if (delivery.deliveryOrderDataList && delivery.deliveryOrderDataList.length > 0) {
      console.log(`[发货单] 保存明细: delivery_id=${deliveryId}, 明细数量=${delivery.deliveryOrderDataList.length}`);
      for (const item of delivery.deliveryOrderDataList) {
        await this.sequelize.query(`
          INSERT INTO shein_full_delivery_order_items 
          (delivery_id, delivery_code, skc, sku_code, order_no, delivery_quantity, created_at)
          VALUES (?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE 
            skc = VALUES(skc), 
            delivery_quantity = VALUES(delivery_quantity)
        `, {
          replacements: [
            deliveryId, delivery.deliveryCode, item.skc, item.skuCode,
            item.orderNo, item.deliveryQuantity
          ]
        });
      }
    } else {
      console.log(`[发货单] 无明细数据: delivery_code=${delivery.deliveryCode}`);
    }

    return deliveryId;
  }

  /**
   * 同步商品列表
   */
  async syncProducts(shopId, params = {}) {
    console.log(`[商品同步] 开始同步，店铺ID: ${shopId}`);
    
    const adapter = await this.getAdapter(shopId);
    console.log(`[商品同步] 获取适配器成功`);
    
    let totalCount = 0;
    let successCount = 0;
    let failCount = 0;
    let listRowCount = 0;
    const failedItems = [];
    const productLanguageList = Array.isArray(params.productLanguageList) && params.productLanguageList.length > 0
      ? params.productLanguageList.slice(0, 5)
      : ['zh-cn', 'en', 'ko', 'ja'];
    const parsedConcurrency = Number.parseInt(params.productDetailConcurrency ?? params.detailConcurrency ?? 5, 10);
    const productDetailConcurrency = Number.isNaN(parsedConcurrency)
      ? 5
      : Math.max(1, Math.min(parsedConcurrency, 10));
    const parsedListPageSize = Number.parseInt(params.productListPageSize ?? params.pageSize ?? 50, 10);
    const productListPageSize = Number.isNaN(parsedListPageSize)
      ? 50
      : Math.max(1, Math.min(parsedListPageSize, 50));
    const parsedWindowMonths = Number.parseInt(params.productWindowMonths ?? params.intervalMonths ?? 1, 10);
    const productWindowMonths = Number.isNaN(parsedWindowMonths)
      ? 1
      : Math.max(1, Math.min(parsedWindowMonths, 12));
    const parsedListDelayMs = Number.parseInt(params.productListDelayMs ?? 200, 10);
    const productListDelayMs = Number.isNaN(parsedListDelayMs)
      ? 200
      : Math.max(0, parsedListDelayMs);
    const parsedMinYear = Number.parseInt(params.productMinYear ?? 2013, 10);
    const productMinYear = Number.isNaN(parsedMinYear)
      ? 2013
      : Math.max(2000, Math.min(parsedMinYear, new Date().getFullYear()));
    const parsedDelayMs = Number.parseInt(params.productDetailDelayMs ?? 150, 10);
    const productDetailDelayMs = Number.isNaN(parsedDelayMs)
      ? 150
      : Math.max(0, parsedDelayMs);
    const parsedRetryTimes = Number.parseInt(params.productDetailRetryTimes ?? 5, 10);
    const productDetailRetryTimes = Number.isNaN(parsedRetryTimes)
      ? 5
      : Math.max(0, Math.min(parsedRetryTimes, 10));
    const parsedRetryDelayMs = Number.parseInt(params.productDetailRetryDelayMs ?? 10000, 10);
    const productDetailRetryDelayMs = Number.isNaN(parsedRetryDelayMs)
      ? 10000
      : Math.max(0, parsedRetryDelayMs);
    let rateLimitRetryCount = 0;
    let rateLimitRecoveredCount = 0;
    let rateLimitFailedCount = 0;
    const useUpdateTime = params.useUpdateTime === true || params.productTimeField === 'update';
    const timeFieldLabel = useUpdateTime ? 'updateTime' : 'insertTime';
    const parseBoundary = (value) => {
      if (!value) return null;
      const parsed = this._parseDateTime(value);
      return parsed ? new Date(parsed.getTime()) : null;
    };
    const boundaryStart = useUpdateTime
      ? parseBoundary(params.updateTimeStart)
      : parseBoundary(params.insertTimeStart);
    const boundaryEnd = useUpdateTime
      ? parseBoundary(params.updateTimeEnd)
      : parseBoundary(params.insertTimeEnd);
    const minDate = boundaryStart || new Date(productMinYear, 0, 1, 0, 0, 0);
    let endTime = boundaryEnd || new Date();
    if (endTime < minDate) {
      endTime = new Date(minDate.getTime());
    }
    let emptyIntervalCount = 0;
    const processedSpuNames = new Set();
    const {
      productLanguageList: _productLanguageList,
      productListPageSize: _productListPageSize,
      productWindowDays: _productWindowDays,
      intervalDays: _intervalDays,
      productWindowMonths: _productWindowMonths,
      intervalMonths: _intervalMonths,
      productListDelayMs: _productListDelayMs,
      productMinYear: _productMinYear,
      useUpdateTime: _useUpdateTime,
      productTimeField: _productTimeField,
      productDetailConcurrency: _productDetailConcurrency,
      detailConcurrency: _detailConcurrency,
      productDetailDelayMs: _productDetailDelayMs,
      productDetailRetryTimes: _productDetailRetryTimes,
      productDetailRetryDelayMs: _productDetailRetryDelayMs,
      ...productListParams
    } = params;

    delete productListParams.page;
    delete productListParams.pageNum;
    delete productListParams.pageSize;
    delete productListParams.insertTimeStart;
    delete productListParams.insertTimeEnd;
    delete productListParams.updateTimeStart;
    delete productListParams.updateTimeEnd;

    console.log(`[商品同步] 详情并发数: ${productDetailConcurrency}, 列表分页: ${productListPageSize}, 列表间隔: ${productListDelayMs}ms, 详情间隔: ${productDetailDelayMs}ms, 429重试: ${productDetailRetryTimes}次/${productDetailRetryDelayMs}ms`);
    console.log(`[商品同步] 查询模式: ${timeFieldLabel}, 时间窗口: ${productWindowMonths}个月, 开始边界: ${this._formatDateTime(minDate)}, 结束边界: ${this._formatDateTime(endTime)}`);

    while (true) {
      const startTime = this._subtractMonths(endTime, productWindowMonths);
      if (startTime < minDate) {
        startTime.setTime(minDate.getTime());
      }

      console.log(`[商品同步] 查询时间段: ${this._formatDateTime(startTime)} ~ ${this._formatDateTime(endTime)}`);

      let page = 1;
      let intervalRowCount = 0;
      const intervalSpuNames = new Set();

      while (true) {
        console.log(`[商品同步] 请求时间段第${page}页商品列表...`);

        const requestParams = {
          ...productListParams,
          pageNum: page,
          pageSize: productListPageSize
        };

        if (useUpdateTime) {
          requestParams.updateTimeStart = this._formatDateTime(startTime);
          requestParams.updateTimeEnd = this._formatDateTime(endTime);
        } else {
          requestParams.insertTimeStart = this._formatDateTime(startTime);
          requestParams.insertTimeEnd = this._formatDateTime(endTime);
        }

        const result = await adapter.getProductList(requestParams);
        console.log(`[商品同步] API响应: code=${result.code}, msg=${result.msg}`);

        const products = result.info?.data || [];
        console.log(`[商品同步] 时间段第${page}页获取${products.length}条商品`);

        intervalRowCount += products.length;
        listRowCount += products.length;

        products.forEach(product => {
          if (product?.spuName) {
            intervalSpuNames.add(product.spuName);
          }
        });

        if (products.length < productListPageSize) {
          break;
        }

        page++;
        if (productListDelayMs > 0) {
          await this._sleep(productListDelayMs);
        }
      }

      if (intervalRowCount === 0) {
        emptyIntervalCount++;
        console.log(`[商品同步] 本时间段无数据，连续空时间段: ${emptyIntervalCount}/3`);
      } else {
        emptyIntervalCount = 0;
      }

      const spuNamesToSync = Array.from(intervalSpuNames).filter(spuName => !processedSpuNames.has(spuName));
      spuNamesToSync.forEach(spuName => processedSpuNames.add(spuName));
      totalCount += spuNamesToSync.length;

      console.log(`[商品同步] 本时间段列表共${intervalRowCount}条，去重后SPU ${intervalSpuNames.size}个，待同步新SPU ${spuNamesToSync.length}个`);

      await this._runWithConcurrency(spuNamesToSync, productDetailConcurrency, async (spuName, index, workerNo) => {
        try {
          console.log(`[商品同步][Worker-${workerNo}] 获取商品详情: ${spuName}`);
          const detail = await this._getProductDetailWithRetry(
            adapter,
            spuName,
            productLanguageList,
            productDetailRetryTimes,
            productDetailRetryDelayMs,
            workerNo
          );

          if (detail.retryCount > 0) {
            rateLimitRetryCount += detail.retryCount;
            rateLimitRecoveredCount++;
          }

          await this.saveProduct(shopId, detail.info);
          successCount++;
          console.log(`[商品同步][Worker-${workerNo}] ✅ 保存成功: ${spuName} (${successCount + failCount}/${Math.max(totalCount, successCount + failCount)})`);
        } catch (err) {
          failCount++;
          if (this._isRateLimitError(err)) {
            rateLimitFailedCount++;
          }
          failedItems.push({
            spuName: spuName || null,
            shopId,
            errorMessage: err.message,
            status: err.status || null,
            traceId: err.traceId || err.data?.traceId || null,
            isRateLimit: this._isRateLimitError(err)
          });
          console.error(`[商品同步][Worker-${workerNo}] ❌ 同步失败: ${spuName}, 错误: ${err.message}`);
        }

        if (productDetailDelayMs > 0 && index < spuNamesToSync.length - 1) {
          await this._sleep(productDetailDelayMs);
        }
      });

      if (emptyIntervalCount >= 3) {
        console.log(`[商品同步] 连续3个时间段无数据，停止查询`);
        break;
      }

      if (startTime <= minDate) {
        console.log(`[商品同步] 已查询到起始边界，停止`);
        break;
      }

      endTime = new Date(startTime.getTime() - 1000);
      if (productListDelayMs > 0) {
        await this._sleep(productListDelayMs);
      }
    }

    console.log(`[商品同步] 完成，列表条数: ${listRowCount}, 去重SPU: ${processedSpuNames.size}, 成功: ${successCount}, 失败: ${failCount}`);
    return {
      totalCount,
      listRowCount,
      uniqueSpuCount: processedSpuNames.size,
      successCount,
      failCount,
      failedItems,
      rateLimitRetryCount,
      rateLimitRecoveredCount,
      rateLimitFailedCount,
      emptyIntervalCount,
      productWindowMonths,
      timeField: timeFieldLabel
    };
  }

  /**
   * 保存商品到数据库
   */
  async saveProduct(shopId, product) {
    if (!product || !product.spuName) return;

    await this._ensureProductBarcodeColumn();

    const productData = {
      shop_id: shopId,
      spu_name: product.spuName,
      skc_name: product.skcInfoList?.[0]?.skcName || null,
      category_id: product.categoryId,
      product_type_id: product.productTypeId,
      brand_code: product.brandCode,
      supplier_code: product.supplierCode,
      product_name: product.productMultiNameList?.[0]?.productName,
      product_desc: product.productMultiDescList?.[0]?.productDesc,
      product_attributes: JSON.stringify(product.productAttributeInfoList || []),
      dimension_attributes: JSON.stringify(product.dimensionAttributeInfoList || []),
      spu_images: JSON.stringify(product.spuImageInfoList),
      skc_list: JSON.stringify(product.skcInfoList || []),
      barcode: JSON.stringify(this._extractProductBarcodeData(product)),
      raw_data: JSON.stringify(product),
      synced_at: new Date()
    };

    const [existing] = await this.sequelize.query(`
      SELECT id FROM shein_full_products WHERE shop_id = ? AND spu_name = ?
    `, { replacements: [shopId, product.spuName], type: QueryTypes.SELECT });

    if (existing) {
      const sets = Object.keys(productData).map(k => `${k} = ?`).join(', ');
      await this.sequelize.query(`
        UPDATE shein_full_products SET ${sets}, updated_at = NOW() WHERE id = ?
      `, { replacements: [...Object.values(productData), existing.id] });
    } else {
      const cols = Object.keys(productData).join(', ');
      const placeholders = Object.keys(productData).map(() => '?').join(', ');
      await this.sequelize.query(`
        INSERT INTO shein_full_products (${cols}, created_at) VALUES (${placeholders}, NOW())
      `, { replacements: Object.values(productData) });
    }
  }


  /**
   * 同步报账单
   */
  async syncReports(shopId, params = {}) {
    console.log(`[报账单同步] 开始同步，店铺ID: ${shopId}`);
    
    const adapter = await this.getAdapter(shopId);
    console.log(`[报账单同步] 获取适配器成功`);
    
    let page = 1;
    let totalCount = 0;
    let successCount = 0;
    let failCount = 0;

    while (true) {
      console.log(`[报账单同步] 请求第${page}页数据...`);
      
      const result = await adapter.getReportList({
        ...params,
        page,
        perPage: 200
      });
      console.log(`[报账单同步] API响应: code=${result.code}, msg=${result.msg}`);

      const reports = result.info?.reportOrderInfos || [];
      console.log(`[报账单同步] 第${page}页获取${reports.length}条数据`);
      
      if (reports.length === 0) {
        console.log(`[报账单同步] 无更多数据，停止翻页`);
        break;
      }

      const syncDetails = params.syncReportDetails !== false;

      for (const report of reports) {
        try {
          await this.saveReport(shopId, report);

          if (syncDetails) {
            await this.syncReportSalesDetails(shopId, report.reportOrderNo, params);
            await this.syncReportAdjustmentDetails(shopId, report.reportOrderNo, params);
          }

          successCount++;
          if (successCount % 50 === 0) {
            console.log(`[报账单同步] 已保存${successCount}条...`);
          }
        } catch (err) {
          failCount++;
          console.error(`[报账单同步] ❌ 保存失败: ${report.reportOrderNo}, 错误: ${err.message}`);
        }
      }

      totalCount += reports.length;
      page++;

      if (reports.length < 200) {
        console.log(`[报账单同步] 本页数据不足200条，停止翻页`);
        break;
      }
      await this._sleep(200);
    }

    console.log(`[报账单同步] 完成，总计: ${totalCount}, 成功: ${successCount}, 失败: ${failCount}`);
    return { totalCount, successCount, failCount };
  }

  async syncReportSalesDetails(shopId, reportOrderNo, params = {}) {
    const adapter = await this.getAdapter(shopId);
    const perPage = Math.min(parseInt(params.reportDetailPerPage || 200, 10), 200);
    let nextQuery = params.query || null;

    while (true) {
      const result = await adapter.getReportSalesDetail(reportOrderNo, { perPage, query: nextQuery });
      const details = result?.info?.reportSalesDetails || [];

      for (const detail of details) {
        await this.saveReportSalesDetail(shopId, reportOrderNo, detail);
      }

      nextQuery = result?.info?.query;
      if (!nextQuery) {
        break;
      }

      await this._sleep(100);
    }
  }

  async syncReportAdjustmentDetails(shopId, reportOrderNo, params = {}) {
    const adapter = await this.getAdapter(shopId);
    const perPage = Math.min(parseInt(params.reportDetailPerPage || 200, 10), 200);
    let nextQuery = params.query || null;

    while (true) {
      const result = await adapter.getReportAdjustmentDetail(reportOrderNo, { perPage, query: nextQuery });
      const details = result?.info?.reportReplenishDetail || [];

      for (const detail of details) {
        await this.saveReportAdjustmentDetail(shopId, reportOrderNo, detail);
      }

      nextQuery = result?.info?.query;
      if (!nextQuery) {
        break;
      }

      await this._sleep(100);
    }
  }

  /**
   * 保存报账单到数据库
   */
  async saveReport(shopId, report) {
    const reportData = {
      shop_id: shopId,
      report_order_no: report.reportOrderNo,
      sales_total: report.salesTotal,
      replenish_total: report.replenishTotal,
      add_time: this._parseDateTime(report.addTime),
      last_update_time: this._parseDateTime(report.lastUpdateTime),
      settlement_status: report.settlementStatus,
      settlement_status_name: report.settlementStatusName,
      estimate_pay_time: this._parseDateTime(report.estimatePayTime),
      completed_pay_time: this._parseDateTime(report.completedPayTime),
      company_name: report.companyName,
      estimate_income_money_total: report.estimateIncomeMoneyTotal,
      currency_code: report.currencyCode,
      raw_data: JSON.stringify(report),
      synced_at: new Date()
    };

    const [existing] = await this.sequelize.query(`
      SELECT id FROM shein_full_finance_reports WHERE shop_id = ? AND report_order_no = ?
    `, { replacements: [shopId, report.reportOrderNo], type: QueryTypes.SELECT });

    if (existing) {
      const sets = Object.keys(reportData).map(k => `${k} = ?`).join(', ');
      await this.sequelize.query(`
        UPDATE shein_full_finance_reports SET ${sets}, updated_at = NOW() WHERE id = ?
      `, { replacements: [...Object.values(reportData), existing.id] });
    } else {
      const cols = Object.keys(reportData).join(', ');
      const placeholders = Object.keys(reportData).map(() => '?').join(', ');
      await this.sequelize.query(`
        INSERT INTO shein_full_finance_reports (${cols}, created_at) VALUES (${placeholders}, NOW())
      `, { replacements: Object.values(reportData) });
    }
  }

  async saveReportSalesDetail(shopId, reportOrderNo, detail) {
    if (!detail?.id) {
      return;
    }

    const row = {
      shop_id: shopId,
      report_order_no: reportOrderNo,
      detail_id: detail.id,
      second_order_type: detail.secondOrderType,
      second_order_type_name: detail.secondOrderTypeName,
      in_and_out: detail.inAndOut,
      in_and_out_name: detail.inAndOutName,
      bz_order_no: detail.bzOrderNo,
      skc_name: detail.skcName,
      sku_code: detail.skuCode,
      supplier_sku: detail.supplierSku,
      expense_type: detail.expenseType,
      goods_count: detail.goodsCount,
      settle_currency_code: detail.settleCurrencyCode,
      amount: detail.amount,
      unit_price: detail.unitPrice,
      company_name: detail.companyName,
      add_time: this._parseDateTime(detail.addTime),
      raw_data: JSON.stringify(detail),
      synced_at: new Date()
    };

    const cols = Object.keys(row).join(', ');
    const placeholders = Object.keys(row).map(() => '?').join(', ');
    const updateCols = Object.keys(row)
      .filter(k => !['shop_id', 'report_order_no', 'detail_id'].includes(k))
      .map(k => `${k}=VALUES(${k})`)
      .join(', ');

    await this.sequelize.query(
      `INSERT INTO shein_full_finance_report_sales_details (${cols}, created_at)
       VALUES (${placeholders}, NOW())
       ON DUPLICATE KEY UPDATE ${updateCols}, updated_at = NOW()`,
      { replacements: Object.values(row) }
    );
  }

  async saveReportAdjustmentDetail(shopId, reportOrderNo, detail) {
    if (!detail?.id) {
      return;
    }

    const row = {
      shop_id: shopId,
      report_order_no: reportOrderNo,
      detail_id: detail.id,
      replenish_no: detail.replenishNo,
      replenish_type: detail.replenishType,
      replenish_type_name: detail.replenishTypeName,
      replenish_category: detail.replenishCategory,
      bz_order_no: detail.bzOrderNo,
      skc_name: detail.skcName,
      sku_code: detail.skuCode,
      supplier_sku: detail.supplierSku,
      expense_type: detail.expenseType,
      goods_count: detail.goodsCount,
      settle_currency_code: detail.settleCurrencyCode,
      amount: detail.amount,
      unit_price: detail.unitPrice,
      company_name: detail.companyName,
      add_time: this._parseDateTime(detail.addTime),
      raw_data: JSON.stringify(detail),
      synced_at: new Date()
    };

    const cols = Object.keys(row).join(', ');
    const placeholders = Object.keys(row).map(() => '?').join(', ');
    const updateCols = Object.keys(row)
      .filter(k => !['shop_id', 'report_order_no', 'detail_id'].includes(k))
      .map(k => `${k}=VALUES(${k})`)
      .join(', ');

    await this.sequelize.query(
      `INSERT INTO shein_full_finance_report_adjustment_details (${cols}, created_at)
       VALUES (${placeholders}, NOW())
       ON DUPLICATE KEY UPDATE ${updateCols}, updated_at = NOW()`,
      { replacements: Object.values(row) }
    );
  }

  /**
   * 同步库存
   */
  async syncInventory(shopId, params = {}) {
    console.log(`[库存同步] 开始同步，店铺ID: ${shopId}`);
    
    const adapter = await this.getAdapter(shopId);
    console.log(`[库存同步] 获取适配器成功`);
    
    const { skuCodeList, skcNameList, spuNameList, warehouseType = '2' } = params;

    // 如果没有指定SKU，先获取商品列表中的SKU
    let skuCodes = skuCodeList;
    if (!skuCodes || skuCodes.length === 0) {
      console.log(`[库存同步] 未指定SKU，从商品表获取...`);
      const [products] = await this.sequelize.query(`
        SELECT skc_list FROM shein_full_products WHERE shop_id = ? LIMIT 100
      `, { replacements: [shopId] });

      skuCodes = [];
      for (const p of products) {
        try {
          const skcList = JSON.parse(p.skc_list || '[]');
          for (const skc of skcList) {
            for (const sku of (skc.skuInfoList || [])) {
              if (sku.skuCode) skuCodes.push(sku.skuCode);
            }
          }
        } catch (e) {}
      }
      console.log(`[库存同步] 从商品表获取到${skuCodes.length}个SKU`);
    }

    if (!skuCodes || skuCodes.length === 0) {
      console.log(`[库存同步] 没有可同步的SKU，跳过`);
      return { totalCount: 0, successCount: 0, failCount: 0, message: '没有可同步的SKU' };
    }

    // 分批查询库存（每批最多100个SKU）
    let totalCount = 0;
    let successCount = 0;
    let failCount = 0;
    const totalBatches = Math.ceil(skuCodes.length / 100);

    console.log(`[库存同步] 共${skuCodes.length}个SKU，分${totalBatches}批处理`);

    for (let i = 0; i < skuCodes.length; i += 100) {
      const batchNum = Math.floor(i / 100) + 1;
      const batch = skuCodes.slice(i, i + 100);
      console.log(`[库存同步] 处理第${batchNum}/${totalBatches}批，${batch.length}个SKU`);
      
      try {
        const result = await adapter.getInventory({
          skuCodeList: batch,
          warehouseType
        });
        console.log(`[库存同步] API响应: code=${result.code}, msg=${result.msg}`);

        const inventoryList = result.info?.goodsInventory || [];
        totalCount += inventoryList.length;
        console.log(`[库存同步] 获取到${inventoryList.length}条库存数据`);

        for (const item of inventoryList) {
          for (const sku of (item.skuList || [])) {
            for (const warehouse of (sku.warehouseInventoryList || [])) {
              try {
                await this.saveInventory(shopId, {
                  spuName: item.spuName,
                  skcName: item.skcName,
                  skuCode: sku.skuCode,
                  warehouseType,
                  warehouseCode: warehouse.warehouseCode,
                  totalInventory: sku.totalInventoryQuantity,
                  lockedQuantity: sku.totalLockedQuantity,
                  tempLockQuantity: sku.totalTempLockQuantity,
                  usableInventory: sku.totalUsableInventory,
                  transitQuantity: sku.totalTransitQuantity
                });
                successCount++;
              } catch (err) {
                failCount++;
                console.error(`[库存同步] ❌ 保存失败: ${sku.skuCode}, 错误: ${err.message}`);
              }
            }
          }
        }
      } catch (err) {
        console.error(`[库存同步] ❌ 批次${batchNum}失败: ${err.message}`);
        failCount += batch.length;
      }

      await this._sleep(200);
    }

    console.log(`[库存同步] 完成，总计: ${totalCount}, 成功: ${successCount}, 失败: ${failCount}`);
    return { totalCount, successCount, failCount };
  }

  /**
   * 保存库存到数据库
   */
  async saveInventory(shopId, inventory) {
    const invData = {
      shop_id: shopId,
      spu_name: inventory.spuName,
      skc_name: inventory.skcName,
      sku_code: inventory.skuCode,
      warehouse_type: inventory.warehouseType,
      warehouse_code: inventory.warehouseCode,
      total_inventory: inventory.totalInventory || 0,
      locked_quantity: inventory.lockedQuantity || 0,
      temp_lock_quantity: inventory.tempLockQuantity || 0,
      usable_inventory: inventory.usableInventory || 0,
      transit_quantity: inventory.transitQuantity || 0,
      raw_data: JSON.stringify(inventory),
      synced_at: new Date()
    };

    await this.sequelize.query(`
      INSERT INTO shein_full_inventory 
      (shop_id, spu_name, skc_name, sku_code, warehouse_type, warehouse_code,
       total_inventory, locked_quantity, temp_lock_quantity, usable_inventory,
       transit_quantity, raw_data, synced_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
       total_inventory = VALUES(total_inventory),
       locked_quantity = VALUES(locked_quantity),
       temp_lock_quantity = VALUES(temp_lock_quantity),
       usable_inventory = VALUES(usable_inventory),
       transit_quantity = VALUES(transit_quantity),
       raw_data = VALUES(raw_data),
       synced_at = VALUES(synced_at),
       updated_at = NOW()
    `, { replacements: Object.values(invData) });
  }

  // ==================== 辅助方法 ====================

  /**
   * 格式化日期时间为SHEIN API格式 (UTC+8)
   */
  _formatDateTime(date) {
    if (!date) return null;
    const d = new Date(date);
    // 转换为UTC+8时间
    const utc8Date = new Date(d.getTime() + (8 * 60 * 60 * 1000) - (d.getTimezoneOffset() * 60 * 1000));
    const pad = n => String(n).padStart(2, '0');
    return `${utc8Date.getUTCFullYear()}-${pad(utc8Date.getUTCMonth() + 1)}-${pad(utc8Date.getUTCDate())} ${pad(utc8Date.getUTCHours())}:${pad(utc8Date.getUTCMinutes())}:${pad(utc8Date.getUTCSeconds())}`;
  }

  /**
   * 解析日期时间字符串 (假设输入为UTC+8时间)
   */
  _parseDateTime(dateStr) {
    if (!dateStr) return null;
    // 过滤掉无效日期
    if (dateStr === '1970-01-01 08:00:01' || dateStr === '1970-01-01 08:00:00') return null;
    try {
      // 假设输入的时间字符串是UTC+8时间，直接解析
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d;
    } catch (e) {
      return null;
    }
  }

  _subtractMonths(date, months) {
    const source = new Date(date);
    const target = new Date(source);
    const targetDay = target.getDate();

    target.setMonth(target.getMonth() - months);

    if (target.getDate() !== targetDay) {
      target.setDate(0);
    }

    return target;
  }

  async _ensureProductBarcodeColumn() {
    if (this._ensureProductBarcodeColumnPromise) {
      return this._ensureProductBarcodeColumnPromise;
    }

    this._ensureProductBarcodeColumnPromise = (async () => {
      const [barcodeColumn] = await this.sequelize.query(
        `SHOW COLUMNS FROM shein_full_products LIKE 'barcode'`,
        { type: QueryTypes.SELECT }
      );

      if (!barcodeColumn) {
        await this.sequelize.query(`
          ALTER TABLE shein_full_products
          ADD COLUMN barcode JSON COMMENT '商品条码信息' AFTER skc_list
        `);
      }
    })().catch((error) => {
      this._ensureProductBarcodeColumnPromise = null;
      throw error;
    });

    return this._ensureProductBarcodeColumnPromise;
  }

  _normalizeBarcodeValues(value) {
    if (value === null || value === undefined || value === '') {
      return [];
    }

    if (Array.isArray(value)) {
      return value
        .flatMap(item => this._normalizeBarcodeValues(item))
        .filter(Boolean);
    }

    if (typeof value === 'number') {
      return [String(value)];
    }

    if (typeof value === 'string') {
      return value
        .split(/[\s,;|]+/)
        .map(item => item.trim())
        .filter(Boolean);
    }

    if (typeof value === 'object') {
      return [
        ...this._normalizeBarcodeValues(value.barcodeList),
        ...this._normalizeBarcodeValues(value.barcode_list),
        ...this._normalizeBarcodeValues(value.barcode),
        ...this._normalizeBarcodeValues(value.code),
        ...this._normalizeBarcodeValues(value.value),
        ...this._normalizeBarcodeValues(value.supplierBarcode),
        ...this._normalizeBarcodeValues(value.supplier_barcode)
      ];
    }

    return [];
  }

  _extractSupplierBarcodeEntries(source) {
    if (!source || typeof source !== 'object') {
      return [];
    }

    const supplierBarcodeList = Array.isArray(source.supplierBarcodeList)
      ? source.supplierBarcodeList
      : (Array.isArray(source.supplier_barcode_list) ? source.supplier_barcode_list : []);

    return supplierBarcodeList
      .map(item => {
        const barcodeList = Array.from(new Set([
          ...this._normalizeBarcodeValues(item?.barcodeList),
          ...this._normalizeBarcodeValues(item?.barcode_list),
          ...this._normalizeBarcodeValues(item?.barcode),
          ...this._normalizeBarcodeValues(item?.supplierBarcode),
          ...this._normalizeBarcodeValues(item?.supplier_barcode)
        ]));

        const barcodeType = item?.barcodeType || item?.barcode_type || null;
        if (barcodeList.length === 0 && !barcodeType) {
          return null;
        }

        return {
          barcodeType,
          barcodeList
        };
      })
      .filter(Boolean);
  }

  _extractProductBarcodeData(product) {
    const skcInfoList = Array.isArray(product?.skcInfoList)
      ? product.skcInfoList
      : (Array.isArray(product?.skcList) ? product.skcList : []);

    return skcInfoList.flatMap((skc) => {
      const skuInfoList = Array.isArray(skc?.skuInfoList)
        ? skc.skuInfoList
        : (Array.isArray(skc?.skuList) ? skc.skuList : []);

      return skuInfoList.map((sku) => {
        const sheinSku = sku?.skuCode || sku?.sku_code || null;
        if (!sheinSku) {
          return null;
        }

        const supplierBarcodeEntries = [
          ...this._extractSupplierBarcodeEntries(sku?.skuSupplierInfo),
          ...this._extractSupplierBarcodeEntries(sku?.sku_supplier_info),
          ...this._extractSupplierBarcodeEntries(sku)
        ];

        const dedupedSupplierBarcodeEntries = Array.from(new Map(
          supplierBarcodeEntries.map(entry => [JSON.stringify(entry), entry])
        ).values());

        const barcodeList = Array.from(new Set([
          ...dedupedSupplierBarcodeEntries.flatMap(entry => entry.barcodeList || []),
          ...this._normalizeBarcodeValues(sku?.barcodeList),
          ...this._normalizeBarcodeValues(sku?.barcode_list),
          ...this._normalizeBarcodeValues(sku?.barcode),
          ...this._normalizeBarcodeValues(sku?.supplierBarcode),
          ...this._normalizeBarcodeValues(sku?.supplier_barcode)
        ]));

        if (dedupedSupplierBarcodeEntries.length === 0 && barcodeList.length === 0) {
          return null;
        }

        return {
          skcName: skc?.skcName || skc?.skc_name || null,
          sheinSku,
          supplierSku: sku?.supplierSku || sku?.supplier_sku || sku?.skuSupplierInfo?.supplierSku || sku?.skuSupplierInfo?.supplier_sku || sku?.sku_supplier_info?.supplierSku || sku?.sku_supplier_info?.supplier_sku || null,
          supplierBarcodeList: dedupedSupplierBarcodeEntries,
          barcodeList
        };
      }).filter(Boolean);
    });
  }

  _isRateLimitError(error) {
    return error?.status === 429 || String(error?.message || '').includes('429');
  }

  async _getProductDetailWithRetry(adapter, spuName, languageList, maxRetries, retryDelayMs, workerNo) {
    let attempt = 0;

    while (true) {
      try {
        const detail = await adapter.getProductDetail(spuName, languageList);
        return {
          ...detail,
          retryCount: attempt
        };
      } catch (error) {
        if (!this._isRateLimitError(error) || attempt >= maxRetries) {
          throw error;
        }

        attempt += 1;
        console.warn(`[商品同步][Worker-${workerNo}] ${spuName} 命中429，${retryDelayMs}ms后进行第${attempt}次重试`);
        await this._sleep(retryDelayMs);
      }
    }
  }

  async _runWithConcurrency(items, concurrency, handler) {
    if (!Array.isArray(items) || items.length === 0) {
      return;
    }

    const workerCount = Math.max(1, Math.min(concurrency || 1, items.length));
    let currentIndex = 0;

    await Promise.all(Array.from({ length: workerCount }, (_, workerIndex) => (async () => {
      while (true) {
        const itemIndex = currentIndex;
        currentIndex += 1;

        if (itemIndex >= items.length) {
          return;
        }

        await handler(items[itemIndex], itemIndex, workerIndex + 1);
      }
    })()));
  }

  /**
   * 延迟函数
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 导出单例
module.exports = new SheinFullSyncService();
