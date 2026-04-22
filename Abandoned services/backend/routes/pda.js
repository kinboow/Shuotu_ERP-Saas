const express = require('express');
const router = express.Router();

// PDA登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // 简单验证 (实际应该查询数据库)
    if (username && password) {
      res.json({
        success: true,
        token: 'pda_token_' + Date.now(),
        user: {
          id: 1,
          name: username,
          phone: '13800138000'
        }
      });
    } else {
      res.json({ success: false, message: '用户名或密码错误' });
    }
  } catch (error) {
    console.error('PDA登录错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 扫码发货 - 查询商品
router.get('/scan-ship', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.json({ success: false, message: '请输入条码' });
    }
    
    // 模拟查询商品信息 (实际应该查询数据库)
    res.json({
      success: true,
      data: {
        code: code,
        sku: code,
        productName: '商品-' + code,
        quantity: 1,
        orderNo: 'ORD' + Date.now()
      }
    });
  } catch (error) {
    console.error('扫码查询错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 确认发货
router.post('/confirm-ship', async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!items || items.length === 0) {
      return res.json({ success: false, message: '没有要发货的商品' });
    }
    
    // 实际应该更新数据库中的发货状态
    console.log('确认发货:', items.length, '件商品');
    
    res.json({
      success: true,
      message: `成功发货 ${items.length} 件商品`
    });
  } catch (error) {
    console.error('确认发货错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 扫码收货 - 查询商品
router.get('/scan-receive', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.json({ success: false, message: '请输入条码' });
    }
    
    res.json({
      success: true,
      data: {
        code: code,
        sku: code,
        productName: '收货商品-' + code,
        quantity: 1,
        purchaseNo: 'PO' + Date.now()
      }
    });
  } catch (error) {
    console.error('扫码收货查询错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 确认收货
router.post('/confirm-receive', async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!items || items.length === 0) {
      return res.json({ success: false, message: '没有要收货的商品' });
    }
    
    console.log('确认收货:', items.length, '件商品');
    
    res.json({
      success: true,
      message: `成功收货 ${items.length} 件商品`
    });
  } catch (error) {
    console.error('确认收货错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 库存查询
router.get('/inventory-query', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.json({ success: false, message: '请输入SKU' });
    }
    
    res.json({
      success: true,
      data: {
        sku: code,
        productName: '盘点商品-' + code,
        systemQuantity: Math.floor(Math.random() * 100) + 1
      }
    });
  } catch (error) {
    console.error('库存查询错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 提交盘点结果
router.post('/submit-inventory-check', async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!items || items.length === 0) {
      return res.json({ success: false, message: '没有盘点数据' });
    }
    
    console.log('提交盘点:', items.length, '个SKU');
    
    res.json({
      success: true,
      message: `成功提交 ${items.length} 个SKU的盘点结果`
    });
  } catch (error) {
    console.error('提交盘点错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 订单查询
router.get('/orders', async (req, res) => {
  try {
    const { keyword } = req.query;
    
    // 模拟订单数据
    const orders = [
      { id: 1, orderNo: 'ORD202411001', status: 'pending', productName: '测试商品A', quantity: 2, createTime: '2024-11-28 10:00' },
      { id: 2, orderNo: 'ORD202411002', status: 'shipped', productName: '测试商品B', quantity: 1, createTime: '2024-11-28 09:30' },
      { id: 3, orderNo: 'ORD202411003', status: 'completed', productName: '测试商品C', quantity: 3, createTime: '2024-11-27 15:00' },
    ];
    
    let filteredOrders = orders;
    if (keyword) {
      filteredOrders = orders.filter(o => 
        o.orderNo.includes(keyword) || o.productName.includes(keyword)
      );
    }
    
    res.json({
      success: true,
      data: filteredOrders,
      hasMore: false
    });
  } catch (error) {
    console.error('订单查询错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
