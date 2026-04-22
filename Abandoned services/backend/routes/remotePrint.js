const express = require('express');
const router = express.Router();
const axios = require('axios');

// 存储已连接的打印客户端 (Socket.IO 方式)
const printClients = new Map();

// 存储 HTTP 打印客户端配置
const httpPrintClients = new Map();

// 存储io实例
let ioInstance = null;

// 初始化 Socket.IO
function initSocketIO(io) {
  ioInstance = io;
  
  io.on('connection', (socket) => {
    const { clientId, clientName, type } = socket.handshake.query;
    
    if (type === 'print-client') {
      console.log(`打印客户端连接: ${clientName} (${clientId})`);
      
      printClients.set(clientId, {
        socket,
        clientId,
        clientName,
        printers: [],
        connectedAt: new Date(),
        type: 'socket'
      });
      
      broadcastClientList();
      
      socket.on('printer-list', (data) => {
        const client = printClients.get(data.clientId);
        if (client) {
          client.printers = data.printers;
          broadcastClientList();
        }
      });
      
      socket.on('print-result', (result) => {
        console.log(`打印结果: ${result.taskId} - ${result.success ? '成功' : '失败'}`);
        ioInstance.emit('print-result', result);
      });
      
      socket.on('disconnect', () => {
        console.log(`打印客户端断开: ${clientName} (${clientId})`);
        printClients.delete(clientId);
        broadcastClientList();
      });
    } else {
      console.log('Web客户端连接');
      socket.emit('client-list', getClientList());
      socket.on('disconnect', () => {
        console.log('Web客户端断开');
      });
    }
  });
  
  return io;
}

// 广播客户端列表
function broadcastClientList() {
  if (ioInstance) {
    ioInstance.emit('client-list', getClientList());
  }
}

// 获取所有客户端列表（包括 Socket 和 HTTP 客户端）
function getClientList() {
  const list = [];
  
  // Socket.IO 客户端
  printClients.forEach((client, clientId) => {
    list.push({
      clientId,
      clientName: client.clientName,
      printers: client.printers,
      connectedAt: client.connectedAt,
      online: client.socket?.connected || false,
      type: 'socket'
    });
  });
  
  // HTTP 客户端
  httpPrintClients.forEach((client, clientId) => {
    list.push({
      clientId,
      clientName: client.clientName,
      printers: client.printers || [],
      connectedAt: client.connectedAt,
      online: client.online || false,
      type: 'http',
      url: client.url
    });
  });
  
  return list;
}

// ==================== HTTP 打印客户端管理 ====================

// 添加/更新 HTTP 打印客户端
router.post('/http-clients', async (req, res) => {
  const { clientId, clientName, url } = req.body;
  
  console.log('[远程打印] 收到HTTP客户端注册请求:', { clientId, clientName, url });
  
  if (!clientId || !clientName || !url) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数: clientId, clientName, url'
    });
  }
  
  try {
    // 测试连接
    console.log('[远程打印] 测试连接到客户端:', url);
    const statusResponse = await axios.get(`${url}/status`, { timeout: 5000 });
    console.log('[远程打印] 状态响应:', statusResponse.data);
    
    const printersResponse = await axios.get(`${url}/printers`, { timeout: 5000 });
    console.log('[远程打印] 打印机列表响应:', printersResponse.data);
    
    const printers = printersResponse.data?.printers || [];
    
    httpPrintClients.set(clientId, {
      clientId,
      clientName,
      url,
      printers,
      online: statusResponse.data?.success || false,
      connectedAt: new Date()
    });
    
    console.log('[远程打印] 客户端已注册，当前客户端数量:', httpPrintClients.size);
    broadcastClientList();
    
    res.json({
      success: true,
      message: 'HTTP打印客户端添加成功',
      data: {
        clientId,
        clientName,
        url,
        printers,
        online: true
      }
    });
  } catch (error) {
    console.log('[远程打印] 连接客户端失败:', error.message);
    
    // 即使连接失败也保存配置，标记为离线
    httpPrintClients.set(clientId, {
      clientId,
      clientName,
      url,
      printers: [],
      online: false,
      connectedAt: new Date()
    });
    
    console.log('[远程打印] 客户端已注册(离线)，当前客户端数量:', httpPrintClients.size);
    broadcastClientList();
    
    res.json({
      success: true,
      message: 'HTTP打印客户端已添加，但当前离线',
      data: {
        clientId,
        clientName,
        url,
        printers: [],
        online: false
      }
    });
  }
});

// 删除 HTTP 打印客户端
router.delete('/http-clients/:clientId', (req, res) => {
  const { clientId } = req.params;
  
  if (httpPrintClients.has(clientId)) {
    httpPrintClients.delete(clientId);
    broadcastClientList();
    res.json({ success: true, message: '客户端已删除' });
  } else {
    res.status(404).json({ success: false, message: '客户端不存在' });
  }
});

// 刷新 HTTP 客户端状态
router.post('/http-clients/:clientId/refresh', async (req, res) => {
  const { clientId } = req.params;
  const client = httpPrintClients.get(clientId);
  
  if (!client) {
    return res.status(404).json({ success: false, message: '客户端不存在' });
  }
  
  try {
    const statusResponse = await axios.get(`${client.url}/status`, { timeout: 5000 });
    const printersResponse = await axios.get(`${client.url}/printers`, { timeout: 5000 });
    
    client.printers = printersResponse.data?.printers || [];
    client.online = statusResponse.data?.success || false;
    
    broadcastClientList();
    
    res.json({
      success: true,
      data: {
        ...client,
        printCount: statusResponse.data?.printCount || 0
      }
    });
  } catch (error) {
    client.online = false;
    broadcastClientList();
    
    res.json({
      success: false,
      message: '客户端离线',
      data: client
    });
  }
});

// ==================== 通用接口 ====================

// 获取所有打印客户端
router.get('/clients', (req, res) => {
  const clientList = getClientList();
  console.log('[远程打印] 获取客户端列表，数量:', clientList.length, '详情:', clientList.map(c => ({ id: c.clientId, name: c.clientName, online: c.online, type: c.type })));
  res.json({
    success: true,
    data: clientList
  });
});

// 获取指定客户端的打印机列表
router.get('/clients/:clientId/printers', async (req, res) => {
  const { clientId } = req.params;
  
  // 先检查 Socket 客户端
  const socketClient = printClients.get(clientId);
  if (socketClient) {
    socketClient.socket.emit('request-printers');
    return res.json({
      success: true,
      data: socketClient.printers
    });
  }
  
  // 检查 HTTP 客户端
  const httpClient = httpPrintClients.get(clientId);
  if (httpClient) {
    try {
      const response = await axios.get(`${httpClient.url}/printers`, { timeout: 5000 });
      httpClient.printers = response.data?.printers || [];
      httpClient.online = true;
      return res.json({
        success: true,
        data: httpClient.printers
      });
    } catch (error) {
      httpClient.online = false;
      return res.json({
        success: false,
        message: '客户端离线',
        data: httpClient.printers || []
      });
    }
  }
  
  res.status(404).json({
    success: false,
    message: '客户端不存在或已离线'
  });
});

// 发送打印任务（统一接口）
router.post('/print', async (req, res) => {
  const { 
    clientId, 
    htmlContent,      // HTML内容（用于Socket客户端）
    elements,         // 元素数组（用于HTTP客户端）
    printerName, 
    copies, 
    labelWidth, 
    labelHeight, 
    orientation, 
    scale,
    title
  } = req.body;
  
  if (!clientId) {
    return res.status(400).json({
      success: false,
      message: '缺少客户端ID'
    });
  }
  
  const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // 先检查 Socket 客户端
  const socketClient = printClients.get(clientId);
  if (socketClient) {
    if (!htmlContent) {
      return res.status(400).json({
        success: false,
        message: 'Socket客户端需要htmlContent参数'
      });
    }
    
    socketClient.socket.emit('print-task', {
      id: taskId,
      htmlContent,
      printerName,
      copies: copies || 1,
      labelWidth,
      labelHeight,
      orientation: orientation || 'portrait',
      scale: scale || 100
    });
    
    return res.json({
      success: true,
      data: { taskId },
      message: '打印任务已发送到Socket客户端'
    });
  }
  
  // 检查 HTTP 客户端
  const httpClient = httpPrintClients.get(clientId);
  if (httpClient) {
    try {
      // 如果有 elements，直接发送；否则从 htmlContent 解析
      let printElements = elements;
      
      if (!printElements && htmlContent) {
        // 从HTML内容解析元素（简化处理，实际可能需要更复杂的解析）
        printElements = parseHtmlToElements(htmlContent, labelWidth, labelHeight);
      }
      
      const printTask = {
        taskId,
        title: title || '标签打印',
        labelWidth: labelWidth || 100,
        labelHeight: labelHeight || 70,
        copies: copies || 1,
        elements: printElements || []
      };
      
      const response = await axios.post(`${httpClient.url}/print`, printTask, {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' }
      });
      
      httpClient.online = true;
      
      if (response.data?.success) {
        return res.json({
          success: true,
          data: { taskId },
          message: '打印任务已发送到HTTP客户端'
        });
      } else {
        return res.json({
          success: false,
          message: response.data?.message || '打印失败'
        });
      }
    } catch (error) {
      httpClient.online = false;
      return res.status(500).json({
        success: false,
        message: `发送打印任务失败: ${error.message}`
      });
    }
  }
  
  res.status(404).json({
    success: false,
    message: '打印客户端不存在或已离线'
  });
});

// 发送原生打印任务到 HTTP 客户端（直接传递元素）
router.post('/print-native', async (req, res) => {
  const { 
    clientId, 
    taskId,
    title,
    labelWidth, 
    labelHeight, 
    copies,
    elements,
    dpi,
    printerName,
    orientation,
    imageData  // 新增：直接传递渲染好的图片
  } = req.body;
  
  if (!clientId || !elements) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数'
    });
  }
  
  const httpClient = httpPrintClients.get(clientId);
  if (!httpClient) {
    return res.status(404).json({
      success: false,
      message: 'HTTP打印客户端不存在'
    });
  }
  
  try {
    const printTask = {
      taskId: taskId || `task-${Date.now()}`,
      title: title || '标签打印',
      labelWidth: labelWidth || 100,
      labelHeight: labelHeight || 70,
      copies: copies || 1,
      dpi: dpi || 203,
      printerName: printerName || undefined,
      orientation: orientation || 'portrait',
      elements,
      imageData: imageData || undefined  // 直接传递图片数据
    };
    
    const response = await axios.post(`${httpClient.url}/print`, printTask, {
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    httpClient.online = true;
    
    res.json(response.data);
  } catch (error) {
    httpClient.online = false;
    res.status(500).json({
      success: false,
      message: `打印失败: ${error.message}`
    });
  }
});

// ==================== 辅助函数 ====================

// 从HTML内容解析打印元素（简化版本）
function parseHtmlToElements(htmlContent, labelWidth, labelHeight) {
  const elements = [];
  const mmToPixel = 3.8;
  
  // 使用正则表达式提取元素信息
  const divRegex = /<div[^>]*style="([^"]*)"[^>]*>([\s\S]*?)<\/div>/gi;
  let match;
  
  while ((match = divRegex.exec(htmlContent)) !== null) {
    const style = match[1];
    const content = match[2].replace(/<[^>]*>/g, '').trim();
    
    // 解析样式
    const leftMatch = style.match(/left:\s*([\d.]+)px/);
    const topMatch = style.match(/top:\s*([\d.]+)px/);
    const widthMatch = style.match(/width:\s*([\d.]+)px/);
    const heightMatch = style.match(/height:\s*([\d.]+)px/);
    const fontSizeMatch = style.match(/font-size:\s*([\d.]+)px/);
    const fontWeightMatch = style.match(/font-weight:\s*(\w+)/);
    
    if (leftMatch && topMatch && content) {
      const x = parseFloat(leftMatch[1]) / mmToPixel;
      const y = parseFloat(topMatch[1]) / mmToPixel;
      const width = widthMatch ? parseFloat(widthMatch[1]) / mmToPixel : 50;
      const height = heightMatch ? parseFloat(heightMatch[1]) / mmToPixel : 10;
      const fontSize = fontSizeMatch ? parseFloat(fontSizeMatch[1]) : 12;
      const bold = fontWeightMatch && fontWeightMatch[1] === 'bold';
      
      // 检测元素类型
      let type = 'text';
      if (content.includes('QR:') || match[0].includes('qrcode')) {
        type = 'qrcode';
      } else if (match[0].includes('barcode') || content.includes('|||')) {
        type = 'barcode';
      } else if (match[0].includes('<img')) {
        type = 'image';
      }
      
      elements.push({
        type,
        content: content.replace('QR:', '').trim(),
        x,
        y,
        width,
        height,
        fontSize,
        bold,
        fontName: 'Microsoft YaHei'
      });
    }
  }
  
  return elements;
}

// 从模板元素转换为打印客户端格式
function convertTemplateElements(templateElements, labelWidth, labelHeight) {
  const mmToPixel = 3.8;
  
  return templateElements.map(el => {
    const baseElement = {
      type: el.type || 'text',
      content: el.content || '',
      x: (el.x || 0) / mmToPixel,
      y: (el.y || 0) / mmToPixel,
      width: (el.width || 50) / mmToPixel,
      height: (el.height || 20) / mmToPixel,
      fontSize: el.fontSize || 12,
      fontName: el.fontFamily || 'Microsoft YaHei',
      bold: el.fontWeight === 'bold',
      align: el.textAlign || 'left',
      rotation: el.rotation || 0
    };
    
    // 根据类型添加特定属性
    switch (el.type) {
      case 'barcode':
        baseElement.barcodeType = el.barcodeType || 'Code128';
        baseElement.showText = el.showText !== false;
        break;
      case 'qrcode':
        // 二维码不需要额外属性
        break;
      case 'image':
        baseElement.imageData = el.content;
        break;
      case 'line':
        baseElement.lineWidth = el.borderWidth || 1;
        break;
      case 'rect':
        baseElement.lineWidth = el.borderWidth || 1;
        break;
    }
    
    return baseElement;
  });
}

// 转换模板到打印任务的接口
router.post('/convert-template', (req, res) => {
  const { template, copies } = req.body;
  
  if (!template || !template.elements) {
    return res.status(400).json({
      success: false,
      message: '缺少模板数据'
    });
  }
  
  const labelWidth = template.label_width || 100;
  const labelHeight = template.label_height || 70;
  
  const printTask = {
    taskId: `task-${Date.now()}`,
    title: template.template_name || '标签打印',
    labelWidth,
    labelHeight,
    copies: copies || 1,
    elements: convertTemplateElements(template.elements, labelWidth, labelHeight)
  };
  
  res.json({
    success: true,
    data: printTask
  });
});

module.exports = { router, initSocketIO, printClients, httpPrintClients };
