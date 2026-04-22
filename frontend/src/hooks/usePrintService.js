import { useState, useCallback } from 'react';
import { message } from 'antd';

/**
 * 打印服务 Hook
 * 支持本地打印、Socket远程打印、HTTP远程打印
 */
const usePrintService = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);

  // 加载打印客户端列表
  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/remote-print/clients');
      const data = await response.json();
      if (data.success) {
        setClients(data.data || []);
        return data.data || [];
      }
      return [];
    } catch (error) {
      console.error('加载打印客户端失败:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // 获取指定客户端的打印机列表
  const getClientPrinters = useCallback(async (clientId) => {
    try {
      const response = await fetch(`/api/remote-print/clients/${clientId}/printers`);
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('获取打印机列表失败:', error);
      return [];
    }
  }, []);

  // 本地打印（浏览器打印）
  const printLocal = useCallback((htmlContent, options = {}) => {
    const { onSuccess, onError } = options;
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        message.error('无法打开打印窗口，请检查浏览器弹窗设置');
        onError?.('无法打开打印窗口');
        return false;
      }
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
        onSuccess?.();
      }, 500);
      return true;
    } catch (error) {
      message.error('本地打印失败: ' + error.message);
      onError?.(error.message);
      return false;
    }
  }, []);

  // 远程打印（Socket客户端）
  const printRemoteSocket = useCallback(async (clientId, htmlContent, options = {}) => {
    const { printerName, copies = 1, labelWidth, labelHeight, orientation, scale } = options;
    
    try {
      const response = await fetch('/api/remote-print/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          htmlContent,
          printerName,
          copies,
          labelWidth,
          labelHeight,
          orientation: orientation || 'portrait',
          scale: scale || 100
        })
      });
      
      const data = await response.json();
      if (data.success) {
        message.success('打印任务已发送');
        return { success: true, taskId: data.data?.taskId };
      } else {
        message.error(data.message || '发送打印任务失败');
        return { success: false, message: data.message };
      }
    } catch (error) {
      message.error('远程打印失败: ' + error.message);
      return { success: false, message: error.message };
    }
  }, []);

  // 远程打印（HTTP客户端 - 原生元素）
  const printRemoteHttp = useCallback(async (clientId, elements, options = {}) => {
    const { title, labelWidth = 100, labelHeight = 70, copies = 1, dpi = 203 } = options;
    
    try {
      const response = await fetch('/api/remote-print/print-native', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          taskId: `task-${Date.now()}`,
          title: title || '标签打印',
          labelWidth,
          labelHeight,
          copies,
          dpi,
          elements
        })
      });
      
      const data = await response.json();
      if (data.success) {
        message.success('打印任务已发送');
        return { success: true, taskId: data.taskId };
      } else {
        message.error(data.message || '发送打印任务失败');
        return { success: false, message: data.message };
      }
    } catch (error) {
      message.error('远程打印失败: ' + error.message);
      return { success: false, message: error.message };
    }
  }, []);

  // 将模板元素转换为打印客户端格式
  const convertTemplateElements = useCallback((templateElements, labelWidth, labelHeight) => {
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
      
      switch (el.type) {
        case 'barcode':
          baseElement.barcodeType = el.barcodeType || 'Code128';
          baseElement.showText = el.showText !== false;
          break;
        case 'qrcode':
          break;
        case 'image':
          baseElement.imageData = el.content;
          break;
        case 'line':
        case 'rect':
          baseElement.lineWidth = el.borderWidth || 1;
          break;
        default:
          break;
      }
      
      return baseElement;
    });
  }, []);

  // 打印模板（自动选择打印方式）
  const printTemplate = useCallback(async (template, clientId, options = {}) => {
    const { mode = 'auto', printerName, copies = 1, scale = 100, orientation = 'portrait' } = options;
    
    const labelWidth = template.label_width || 100;
    const labelHeight = template.label_height || 70;
    
    // 查找客户端
    const client = clients.find(c => c.clientId === clientId);
    
    if (!client && mode !== 'local') {
      message.error('打印客户端不存在');
      return { success: false, message: '打印客户端不存在' };
    }
    
    // 根据客户端类型选择打印方式
    if (mode === 'local' || !client) {
      // 本地打印
      const htmlContent = generatePrintHtml(template);
      return { success: printLocal(htmlContent, options) };
    } else if (client.type === 'http') {
      // HTTP 客户端 - 使用原生元素
      const elements = convertTemplateElements(template.elements || [], labelWidth, labelHeight);
      return printRemoteHttp(clientId, elements, {
        title: template.template_name,
        labelWidth,
        labelHeight,
        copies
      });
    } else {
      // Socket 客户端 - 使用 HTML
      const htmlContent = generatePrintHtml(template);
      return printRemoteSocket(clientId, htmlContent, {
        printerName,
        copies,
        labelWidth,
        labelHeight,
        orientation,
        scale
      });
    }
  }, [clients, printLocal, printRemoteHttp, printRemoteSocket, convertTemplateElements]);

  // 生成打印HTML
  const generatePrintHtml = (template) => {
    const elements = template.elements || [];
    const mmToPixel = 3.8;
    const widthMm = template.label_width || 100;
    const heightMm = template.label_height || 70;
    const labelWidthPx = widthMm * mmToPixel;
    const labelHeightPx = heightMm * mmToPixel;
    
    const elementsHtml = elements.map(el => {
      let content = '';
      
      if (el.type === 'image') {
        content = `<img src="${el.content}" style="width:100%;height:100%;object-fit:fill;" />`;
      } else if (el.type === 'qrcode') {
        content = `<div style="width:100%;height:100%;background:#f0f0f0;display:flex;align-items:center;justify-content:center;">QR</div>`;
      } else if (el.type === 'barcode') {
        content = `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div style="width:100%;height:70%;background:repeating-linear-gradient(90deg,#000 0px,#000 2px,#fff 2px,#fff 4px);"></div>
          <div style="font-size:${el.fontSize || 10}px;">${el.content || ''}</div>
        </div>`;
      } else if (el.type === 'line') {
        content = `<div style="width:100%;height:100%;background:${el.borderColor || '#000'};"></div>`;
      } else if (el.type === 'rect') {
        content = `<div style="width:100%;height:100%;border:${el.borderWidth || 2}px solid ${el.borderColor || '#000'};box-sizing:border-box;"></div>`;
      } else if (el.type === 'table') {
        const rows = el.rows || 3;
        const cols = el.cols || 2;
        const cellData = el.cellData || {};
        let tableHtml = `<table style="width:100%;height:100%;border-collapse:collapse;"><tbody>`;
        for (let i = 0; i < rows; i++) {
          tableHtml += `<tr>`;
          for (let j = 0; j < cols; j++) {
            const cellContent = cellData[`${i}-${j}`] || '';
            tableHtml += `<td style="border:1px solid ${el.borderColor || '#000'};padding:2px;font-size:${el.fontSize || 10}px;text-align:center;">${cellContent}</td>`;
          }
          tableHtml += '</tr>';
        }
        tableHtml += '</tbody></table>';
        content = tableHtml;
      } else {
        content = `<span>${el.content || ''}</span>`;
      }
      
      return `
        <div style="
          position:absolute;
          left:${el.x}px;
          top:${el.y}px;
          width:${el.width}px;
          height:${el.height}px;
          font-size:${el.fontSize || 12}px;
          font-weight:${el.fontWeight || 'normal'};
          font-family:${el.fontFamily || 'Arial'};
          color:${el.color || '#000'};
          text-align:${el.textAlign || 'left'};
          transform:${el.rotation ? `rotate(${el.rotation}deg)` : 'none'};
          display:flex;
          align-items:center;
          overflow:hidden;
        ">
          ${content}
        </div>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>打印标签</title>
        <style>
          @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
          @media print {
            html, body { width: ${widthMm}mm; height: ${heightMm}mm; margin: 0 !important; padding: 0 !important; }
            .label-container { width: ${widthMm}mm !important; height: ${heightMm}mm !important; border: none !important; }
          }
          * { box-sizing: border-box; }
          html, body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
          .label-container { width: ${labelWidthPx}px; height: ${labelHeightPx}px; position: relative; background: #fff; }
        </style>
      </head>
      <body>
        <div class="label-container">${elementsHtml}</div>
      </body>
      </html>
    `;
  };

  return {
    clients,
    loading,
    loadClients,
    getClientPrinters,
    printLocal,
    printRemoteSocket,
    printRemoteHttp,
    printTemplate,
    convertTemplateElements,
    generatePrintHtml
  };
};

export default usePrintService;
