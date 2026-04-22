const express = require('express');
const router = express.Router();

// 引入功能模块
const { syncPurchaseOrders } = require('../api_comprehensive/SHEIN全托管_SHEIN自营_SHEINPOP_订单_同步采购单');
const { syncDeliveryNotes } = require('../api_comprehensive/SHEIN全托管_SHEIN自营_SHEINPOP_订单_同步发货单');

/**
 * SHEIN同步路由
 */

// 同步状态管理（内存存储）
const syncStatus = new Map();

// 数据类型名称映射
const dataTypeNames = {
  products: '商品',
  orders: '订单',
  stock_orders: '采购单',
  delivery_orders: '发货单',
  inventory: '库存',
  finance: '财务'
};

/**
 * 获取同步状态
 * GET /api/shein-sync/status/:taskId
 */
router.get('/status/:taskId', (req, res) => {
  const { taskId } = req.params;
  const status = syncStatus.get(taskId);
  
  if (!status) {
    return res.json({
      success: false,
      message: '同步任务不存在'
    });
  }
  
  res.json({
    success: true,
    data: status
  });
});

/**
 * 获取所有进行中的同步任务
 * GET /api/shein-sync/active
 */
router.get('/active', (req, res) => {
  const activeTasks = [];
  syncStatus.forEach((status, taskId) => {
    if (status.status === 'running') {
      activeTasks.push({ taskId, ...status });
    }
  });
  
  res.json({
    success: true,
    data: activeTasks
  });
});

/**
 * 查询并同步SHEIN商品到产品管理
 * POST /api/shein-sync/query-and-sync
 * 功能已删除，待重新实现
 */
router.post('/query-and-sync', async (req, res) => {
  res.json({
    success: false,
    message: '功能开发中：查询并同步SHEIN商品'
  });
});

/**
 * 批量同步数据
 * POST /api/shein-sync/batch
 * 支持同步：采购单(orders)
 * 其他数据类型待实现
 */
router.post('/batch', async (req, res) => {
  try {
    const { platform, dataTypes, shopIds } = req.body;
    
    if (!platform || !dataTypes || !shopIds || shopIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }
    
    // 生成任务ID
    const taskId = `sync_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    console.log('[批量同步] 请求:', { taskId, platform, dataTypes, shopIds });
    
    // 初始化同步状态
    syncStatus.set(taskId, {
      status: 'running',
      platform,
      dataTypes,
      shopIds,
      currentDataType: null,
      currentDataTypeName: null,
      progress: 0,
      message: '正在初始化同步任务...',
      startTime: new Date().toISOString(),
      results: {
        products: { success: 0, failed: 0, total: 0 },
        stock_orders: { success: 0, failed: 0, total: 0 },
        delivery_orders: { success: 0, failed: 0, total: 0 },
        inventory: { success: 0, failed: 0, total: 0 },
        finance: { success: 0, failed: 0, total: 0 }
      }
    });
    
    // 立即返回响应，让同步在后台执行
    res.json({
      success: true,
      message: '同步任务已启动，正在后台执行',
      data: {
        taskId,
        platform,
        shopIds,
        dataTypes,
        status: 'started'
      }
    });
    
    // 更新状态的辅助函数
    const updateStatus = (updates) => {
      const current = syncStatus.get(taskId);
      if (current) {
        syncStatus.set(taskId, { ...current, ...updates });
      }
    };
    
    // 异步执行同步任务
    (async () => {
      const results = {
        products: { success: 0, failed: 0, total: 0 },
        stock_orders: { success: 0, failed: 0, total: 0 },
        delivery_orders: { success: 0, failed: 0, total: 0 },
        inventory: { success: 0, failed: 0, total: 0 },
        finance: { success: 0, failed: 0, total: 0 }
      };
      
      const totalDataTypes = dataTypes.length;
      let completedDataTypes = 0;
      
      for (const shopId of shopIds) {
        console.log(`[批量同步] 开始同步店铺 ${shopId}`);
        
        // 同步采购单
        if (dataTypes.includes('stock_orders')) {
          updateStatus({
            currentDataType: 'stock_orders',
            currentDataTypeName: dataTypeNames.stock_orders,
            message: `正在同步${dataTypeNames.stock_orders}数据...`,
            progress: Math.round((completedDataTypes / totalDataTypes) * 100)
          });
          
          try {
            console.log(`[批量同步] 店铺 ${shopId} 开始同步采购单...`);
            
            // 调用采购单同步功能模块（只传shopId，自动按时间范围查询所有采购单）
            const syncResult = await syncPurchaseOrders({ shopId });
            
            if (syncResult.success) {
              results.stock_orders.success++;
              results.stock_orders.total += syncResult.syncedCount;
              console.log(`[批量同步] 店铺 ${shopId} 采购单同步成功: ${syncResult.syncedCount}条`);
            } else {
              results.stock_orders.failed++;
              console.error(`[批量同步] 店铺 ${shopId} 采购单同步失败: ${syncResult.message}`);
            }
          } catch (error) {
            results.stock_orders.failed++;
            console.error(`[批量同步] 店铺 ${shopId} 采购单同步异常:`, error.message);
          }
          
          completedDataTypes++;
          updateStatus({
            progress: Math.round((completedDataTypes / totalDataTypes) * 100),
            results
          });
        }
        
        // 同步发货单
        if (dataTypes.includes('delivery_orders')) {
          updateStatus({
            currentDataType: 'delivery_orders',
            currentDataTypeName: dataTypeNames.delivery_orders,
            message: `正在同步${dataTypeNames.delivery_orders}数据...`,
            progress: Math.round((completedDataTypes / totalDataTypes) * 100)
          });
          
          try {
            console.log(`[批量同步] 店铺 ${shopId} 开始同步发货单...`);
            
            // 调用发货单同步功能模块（只传shopId，自动按时间范围查询所有发货单）
            const syncResult = await syncDeliveryNotes({ shopId });
            
            if (syncResult.success) {
              results.delivery_orders.success++;
              results.delivery_orders.total += syncResult.syncedCount;
              console.log(`[批量同步] 店铺 ${shopId} 发货单同步成功: ${syncResult.syncedCount}条`);
            } else {
              results.delivery_orders.failed++;
              console.error(`[批量同步] 店铺 ${shopId} 发货单同步失败: ${syncResult.message}`);
            }
          } catch (error) {
            results.delivery_orders.failed++;
            console.error(`[批量同步] 店铺 ${shopId} 发货单同步异常:`, error.message);
          }
          
          completedDataTypes++;
          updateStatus({
            progress: Math.round((completedDataTypes / totalDataTypes) * 100),
            results
          });
        }
        
        // 同步商品（待实现）
        if (dataTypes.includes('products')) {
          updateStatus({
            currentDataType: 'products',
            currentDataTypeName: dataTypeNames.products,
            message: `正在同步${dataTypeNames.products}数据...`
          });
          
          // TODO: 调用商品同步功能模块
          console.log(`[批量同步] 店铺 ${shopId} 商品同步功能待实现`);
          results.products.failed++;
          
          completedDataTypes++;
          updateStatus({
            progress: Math.round((completedDataTypes / totalDataTypes) * 100),
            results
          });
        }
        
        // 同步库存（待实现）
        if (dataTypes.includes('inventory')) {
          updateStatus({
            currentDataType: 'inventory',
            currentDataTypeName: dataTypeNames.inventory,
            message: `正在同步${dataTypeNames.inventory}数据...`
          });
          
          // TODO: 调用库存同步功能模块
          console.log(`[批量同步] 店铺 ${shopId} 库存同步功能待实现`);
          results.inventory.failed++;
          
          completedDataTypes++;
          updateStatus({
            progress: Math.round((completedDataTypes / totalDataTypes) * 100),
            results
          });
        }
        
        // 同步财务（待实现）
        if (dataTypes.includes('finance')) {
          updateStatus({
            currentDataType: 'finance',
            currentDataTypeName: dataTypeNames.finance,
            message: `正在同步${dataTypeNames.finance}数据...`
          });
          
          // TODO: 调用财务同步功能模块
          console.log(`[批量同步] 店铺 ${shopId} 财务同步功能待实现`);
          results.finance.failed++;
          
          completedDataTypes++;
          updateStatus({
            progress: Math.round((completedDataTypes / totalDataTypes) * 100),
            results
          });
        }
      }
      
      // 同步完成
      updateStatus({
        status: 'completed',
        progress: 100,
        message: '同步完成',
        endTime: new Date().toISOString(),
        results
      });
      
      console.log('[批量同步] 完成:', results);
    })().catch(error => {
      console.error('[批量同步] 执行失败:', error);
      updateStatus({
        status: 'failed',
        message: '同步失败: ' + error.message
      });
    });
    
  } catch (error) {
    console.error('[批量同步] 错误:', error);
    res.status(500).json({
      success: false,
      message: '同步失败: ' + error.message
    });
  }
});

module.exports = router;
