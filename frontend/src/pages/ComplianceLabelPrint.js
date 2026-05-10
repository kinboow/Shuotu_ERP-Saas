import React, { useState, useEffect } from 'react';
import { Input, Button, message, Modal, Form, InputNumber, Popconfirm, Empty, Select, Radio, Spin, Tag } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, PrinterOutlined, DeleteOutlined, CloudOutlined, SettingOutlined, DesktopOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PrintClientManager from '../components/PrintClientManager';

const { Option } = Select;

const ComplianceLabelPrint = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();
  
  // 远程打印相关状态
  const [printModalVisible, setPrintModalVisible] = useState(false);
  const [printClients, setPrintClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [printCopies, setPrintCopies] = useState(1);
  const [printOrientation, setPrintOrientation] = useState('portrait'); // 'portrait' 或 'landscape'
  const [printScale, setPrintScale] = useState(100); // 缩放百分比
  const [currentPrintTemplate, setCurrentPrintTemplate] = useState(null);
  const [printMode, setPrintMode] = useState('local'); // 'local' 或 'remote'
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientManagerVisible, setClientManagerVisible] = useState(false);
  const [printLabelWidth, setPrintLabelWidth] = useState(100); // 打印标签宽度
  const [printLabelHeight, setPrintLabelHeight] = useState(70); // 打印标签高度
  const [clientPrinters, setClientPrinters] = useState([]); // 当前客户端的打印机列表
  const [loadingPrinters, setLoadingPrinters] = useState(false);

  // 分类列表
  const categories = [
    { key: 'all', name: '全部' },
    { key: 'factory', name: '厂家水洗标' },
    { key: 'brand', name: '品牌' },
    { key: 'compliance', name: '合规站点标签' },
    { key: 'shein', name: 'SHEIN文件' },
    { key: 'shein-compliance', name: 'SHEIN站点' },
    { key: 'temu', name: 'TEMU文件' },
    { key: 'temu-compliance', name: 'TEMU站点' },
  ];

  useEffect(() => {
    document.title = '协途 - 合规标签打印';
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/compliance-label/templates');
      const data = await response.json();
      if (data.success) {
        setTemplates(data.data || []);
      }
    } catch (error) {
      console.error('加载模板失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async (values) => {
    try {
      const response = await fetch('/api/compliance-label/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_name: values.template_name,
          template_desc: values.template_desc || '',
          label_width: values.label_width || 100,
          label_height: values.label_height || 70,
          category: values.category || 'compliance',
          elements: []
        })
      });
      const data = await response.json();
      if (data.success) {
        message.success('模板创建成功');
        setCreateModalVisible(false);
        createForm.resetFields();
        loadTemplates();
        // 跳转到编辑器
        navigate(`/label-editor/${data.data.id}`);
      } else {
        message.error(data.message || '创建失败');
      }
    } catch (error) {
      console.error('创建模板失败:', error);
      message.error('创建模板失败');
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    try {
      const response = await fetch(`/api/compliance-label/templates/${templateId}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        message.success('模板删除成功');
        loadTemplates();
      } else {
        message.error(data.message || '删除失败');
      }
    } catch (error) {
      console.error('删除模板失败:', error);
      message.error('删除模板失败');
    }
  };

  // 打开打印对话框
  const handlePrintTemplate = (template) => {
    setCurrentPrintTemplate(template);
    setPrintLabelWidth(template.label_width || 100);
    setPrintLabelHeight(template.label_height || 70);
    setPrintModalVisible(true);
    loadPrintClients();
  };

  // 获取API基础URL，自动匹配当前协议
  const getApiBaseUrl = () => {
    if (process.env.REACT_APP_API_URL) {
      return process.env.REACT_APP_API_URL;
    }
    return '/api';
  };

  // 加载指定客户端的打印机列表
  const loadClientPrinters = async (clientId) => {
    if (!clientId) {
      setClientPrinters([]);
      return;
    }
    setLoadingPrinters(true);
    try {
      const apiUrl = getApiBaseUrl();
      const response = await fetch(`${apiUrl}/remote-print/clients/${clientId}/printers`);
      const data = await response.json();
      console.log('加载打印机列表响应:', data);
      if (data.success) {
        setClientPrinters(data.data || []);
      } else {
        setClientPrinters([]);
      }
    } catch (error) {
      console.error('加载打印机列表失败:', error);
      setClientPrinters([]);
    } finally {
      setLoadingPrinters(false);
    }
  };

  // 加载远程打印客户端列表
  const loadPrintClients = async () => {
    setLoadingClients(true);
    try {
      const apiUrl = getApiBaseUrl();
      console.log('加载打印客户端列表, API URL:', apiUrl);
      const response = await fetch(`${apiUrl}/remote-print/clients`);
      const data = await response.json();
      console.log('打印客户端列表响应:', data);
      if (data.success) {
        setPrintClients(data.data || []);
        console.log('设置打印客户端:', data.data?.length || 0, '个');
      } else {
        console.error('获取打印客户端失败:', data.message);
      }
    } catch (error) {
      console.error('加载打印客户端失败:', error);
    } finally {
      setLoadingClients(false);
    }
  };

  // 执行本地打印
  const handleLocalPrint = () => {
    if (!currentPrintTemplate) return;
    
    const printWindow = window.open('', '_blank');
    const printContent = generatePrintContent(currentPrintTemplate);
    printWindow.document.write(printContent);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
    
    setPrintModalVisible(false);
  };

  // 执行远程打印
  // 渲染模板到Canvas并返回Base64图片
  const renderTemplateToImage = async (template, widthMm, heightMm, dpi = 203) => {
    // 计算像素尺寸
    const widthPx = Math.round(widthMm / 25.4 * dpi);
    const heightPx = Math.round(heightMm / 25.4 * dpi);
    const scale = dpi / 25.4; // 毫米到像素的转换比例
    const mmToPixel = 3.8; // 编辑器中使用的比例

    const canvas = document.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext('2d');
    
    // 白色背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, widthPx, heightPx);

    const elements = template.elements || [];
    
    for (const el of elements) {
      // 将编辑器坐标转换为打印像素坐标
      const x = (el.x / mmToPixel) * scale;
      const y = (el.y / mmToPixel) * scale;
      const w = (el.width / mmToPixel) * scale;
      const h = (el.height / mmToPixel) * scale;

      ctx.fillStyle = el.color || '#000000';
      
      if (el.type === 'text') {
        const fontSize = (el.fontSize || 12) * scale / 3; // 调整字体大小
        ctx.font = `${el.fontWeight === 'bold' ? 'bold ' : ''}${fontSize}px ${el.fontFamily || 'Arial'}`;
        ctx.textAlign = el.textAlign || 'left';
        ctx.fillText(el.content || '', x, y + fontSize);
      } else if (el.type === 'image' && el.content) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = el.content;
          });
          ctx.drawImage(img, x, y, w, h);
        } catch (e) {
          console.error('加载图片失败:', e);
        }
      } else if (el.type === 'line') {
        ctx.strokeStyle = el.borderColor || '#000000';
        ctx.lineWidth = (el.borderWidth || 1) * scale / mmToPixel;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y + h);
        ctx.stroke();
      } else if (el.type === 'rect') {
        ctx.strokeStyle = el.borderColor || '#000000';
        ctx.lineWidth = (el.borderWidth || 1) * scale / mmToPixel;
        ctx.strokeRect(x, y, w, h);
      }
      // 条码和二维码由客户端生成（更清晰）
    }

    return canvas.toDataURL('image/png');
  };

  const handleRemotePrint = async () => {
    if (!currentPrintTemplate || !selectedClient) {
      message.warning('请选择打印客户端');
      return;
    }
    
    // 获取选中的客户端信息
    const client = printClients.find(c => c.clientId === selectedClient);
    
    try {
      if (client?.type === 'http') {
        // HTTP 客户端
        const elements = convertTemplateToElements(currentPrintTemplate, printLabelWidth, printLabelHeight);
        
        // 可选：预渲染图片（用于简单标签）
        // const imageData = await renderTemplateToImage(currentPrintTemplate, printLabelWidth, printLabelHeight, 203);
        
        const response = await fetch('/api/remote-print/print-native', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: selectedClient,
            taskId: `task-${Date.now()}`,
            title: currentPrintTemplate.template_name || '标签打印',
            labelWidth: printLabelWidth,
            labelHeight: printLabelHeight,
            copies: printCopies,
            printerName: selectedPrinter || undefined,
            orientation: printOrientation,
            dpi: 203,  // 指定打印DPI
            elements
            // imageData  // 如果需要预渲染，取消注释
          })
        });
        
        const data = await response.json();
        if (data.success) {
          message.success('打印任务已发送到HTTP客户端');
          setPrintModalVisible(false);
        } else {
          message.error(data.message || '发送打印任务失败');
        }
      } else {
        // Socket 客户端 - 使用 HTML 打印
        const htmlContent = generatePrintContent(currentPrintTemplate);
        const response = await fetch('/api/remote-print/print', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: selectedClient,
            htmlContent,
            printerName: selectedPrinter,
            copies: printCopies,
            orientation: printOrientation,
            scale: printScale,
            labelWidth: printLabelWidth,
            labelHeight: printLabelHeight
          })
        });
        
        const data = await response.json();
        if (data.success) {
          message.success('打印任务已发送');
          setPrintModalVisible(false);
        } else {
          message.error(data.message || '发送打印任务失败');
        }
      }
    } catch (error) {
      console.error('远程打印失败:', error);
      message.error('远程打印失败');
    }
  };

  // 将模板元素转换为打印客户端格式
  // 注意：前端编辑器中的坐标是像素(px)，需要转换为毫米(mm)发送给打印客户端
  const convertTemplateToElements = (template, targetWidth, targetHeight) => {
    const elements = template.elements || [];
    const mmToPixel = 3.8; // 编辑器中 1mm = 3.8px
    
    // 计算缩放比例（如果目标尺寸与模板尺寸不同）
    const originalWidth = template.label_width || 100;
    const originalHeight = template.label_height || 70;
    const scaleX = targetWidth / originalWidth;
    const scaleY = targetHeight / originalHeight;
    
    return elements.map(el => {
      // 将像素坐标转换为毫米，然后按比例缩放
      // 元素在编辑器中的坐标是像素，需要除以 mmToPixel 转换为毫米
      const xMm = (el.x || 0) / mmToPixel;
      const yMm = (el.y || 0) / mmToPixel;
      const widthMm = (el.width || 50) / mmToPixel;
      const heightMm = (el.height || 20) / mmToPixel;
      
      const baseElement = {
        type: el.type || 'text',
        content: el.content || '',
        // 直接使用毫米单位，打印客户端会直接使用这些值
        x: xMm * scaleX,
        y: yMm * scaleY,
        width: widthMm * scaleX,
        height: heightMm * scaleY,
        fontSize: (el.fontSize || 12) * Math.min(scaleX, scaleY),
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
          baseElement.lineWidth = (el.borderWidth || 1) * Math.min(scaleX, scaleY);
          break;
        case 'table':
          baseElement.rows = el.rows || 3;
          baseElement.cols = el.cols || 2;
          baseElement.cellData = el.cellData || {};
          break;
        default:
          break;
      }
      
      return baseElement;
    });
  };

  // 获取选中客户端的打印机列表
  const getSelectedClientPrinters = () => {
    // 优先使用动态加载的打印机列表
    if (clientPrinters.length > 0) {
      return clientPrinters;
    }
    const client = printClients.find(c => c.clientId === selectedClient);
    return client?.printers || [];
  };


  const generatePrintContent = (template) => {
    const elements = template.elements || [];
    const mmToPixel = 3.8; // 与编辑器保持一致
    const widthMm = template.label_width || 100;
    const heightMm = template.label_height || 70;
    const labelWidthPx = widthMm * mmToPixel;
    const labelHeightPx = heightMm * mmToPixel;
    
    const elementsHtml = elements.map(el => {
      let content = '';
      
      if (el.type === 'image') {
        // 图片元素 - 与编辑器一致使用 fill
        content = `<img src="${el.content}" draggable="false" style="width:100%;height:100%;object-fit:fill;pointer-events:none;user-select:none;" />`;
      } else if (el.type === 'qrcode') {
        // 二维码元素
        content = `<div style="width:100%;height:100%;background:#f0f0f0;display:flex;align-items:center;justify-content:center;font-size:10px;">QR: ${el.content || ''}</div>`;
      } else if (el.type === 'barcode') {
        // 条形码元素
        content = `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div style="width:100%;height:70%;background:repeating-linear-gradient(90deg,#000 0px,#000 2px,#fff 2px,#fff 4px);"></div>
          <div style="font-size:${el.fontSize || 10}px;margin-top:2px;">${el.content || ''}</div>
        </div>`;
      } else if (el.type === 'line') {
        // 线条元素
        content = `<div style="width:100%;height:100%;background:${el.borderColor || '#000'};"></div>`;
      } else if (el.type === 'rect') {
        // 矩形元素
        content = `<div style="width:100%;height:100%;border:${el.borderWidth || 2}px solid ${el.borderColor || '#000'};background:${el.fillColor || 'transparent'};box-sizing:border-box;"></div>`;
      } else if (el.type === 'table') {
        // 表格元素 - 与编辑器完全一致
        const rows = el.rows || 3;
        const cols = el.cols || 2;
        const cellData = el.cellData || {};
        let tableHtml = `<table style="width:100%;height:100%;border-collapse:collapse;table-layout:fixed;">`;
        tableHtml += '<tbody>';
        for (let i = 0; i < rows; i++) {
          tableHtml += `<tr style="height:${100 / rows}%;">`;
          for (let j = 0; j < cols; j++) {
            const cellKey = `${i}-${j}`;
            const cellContent = cellData[cellKey] || '';
            tableHtml += `<td style="border:1px solid ${el.borderColor || '#000'};padding:2px;font-size:${el.fontSize || 10}px;text-align:center;vertical-align:middle;overflow:hidden;width:${100 / cols}%;"><span style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;">${cellContent}</span></td>`;
          }
          tableHtml += '</tr>';
        }
        tableHtml += '</tbody></table>';
        content = tableHtml;
      } else {
        // 文本元素
        content = `<span style="user-select:none;">${el.content || ''}</span>`;
      }
      
      // 根据元素类型决定样式 - 与编辑器完全一致
      const isImageType = el.type === 'image' || el.type === 'qrcode' || el.type === 'barcode';
      const padding = isImageType ? '0' : '4px';
      
      return `
        <div style="
          position: absolute;
          left: ${el.x}px;
          top: ${el.y}px;
          width: ${el.width}px;
          height: ${el.height}px;
          font-size: ${el.fontSize || 12}px;
          font-weight: ${el.fontWeight || 'normal'};
          font-family: ${el.fontFamily || 'Arial'};
          color: ${el.color || '#000000'};
          text-align: ${el.textAlign || 'left'};
          transform: ${el.rotation ? `rotate(${el.rotation}deg)` : 'none'};
          transform-origin: center center;
          border: ${el.border ? '2px solid #000' : 'none'};
          padding: ${padding};
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: ${el.textAlign === 'center' ? 'center' : el.textAlign === 'right' ? 'flex-end' : 'flex-start'};
          overflow: hidden;
          word-break: break-word;
          white-space: pre-wrap;
          line-height: 1.2;
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
        <title>打印标签 - ${template.template_name}</title>
        <style>
          @page { 
            size: ${widthMm}mm ${heightMm}mm; 
            margin: 0; 
          }
          @media print {
            html, body {
              width: ${widthMm}mm;
              height: ${heightMm}mm;
              margin: 0 !important;
              padding: 0 !important;
            }
            .label-container {
              width: ${widthMm}mm !important;
              height: ${heightMm}mm !important;
              border: none !important;
              transform: none !important;
            }
          }
          * { box-sizing: border-box; }
          html, body { 
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
          }
          img {
            display: block;
          }
          .label-container {
            width: ${labelWidthPx}px;
            height: ${labelHeightPx}px;
            position: relative;
            background: #fff;
            box-sizing: border-box;
            transform-origin: top left;
          }
        </style>
      </head>
      <body>
        <div class="label-container">
          ${elementsHtml}
        </div>
      </body>
      </html>
    `;
  };

  // 渲染标签预览
  const renderLabelPreview = (template) => {
    const elements = template.elements || [];
    const width = template.label_width || 100;
    const height = template.label_height || 70;
    
    // 计算缩放比例，使标签完整显示在160px高度的容器中
    const containerWidth = 180;
    const containerHeight = 160;
    const scaleX = containerWidth / (width * 3.8);
    const scaleY = containerHeight / (height * 3.8);
    const scale = Math.min(scaleX, scaleY, 1); // 取较小的缩放比例，确保完整显示

    if (elements.length === 0) {
      return (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#999',
          fontSize: 12,
          userSelect: 'none'
        }}>
          空模板
        </div>
      );
    }

    return (
      <div style={{
        width: width * 3.8 * scale,
        height: height * 3.8 * scale,
        position: 'relative',
        border: '1px solid #ddd',
        background: '#fff',
        overflow: 'hidden',
        userSelect: 'none',
        pointerEvents: 'none'
      }}>
        {elements.map((el, index) => {
          // 渲染不同类型的元素
          let content;
          if (el.type === 'image') {
            content = (
              <img 
                src={el.content} 
                alt="" 
                style={{ 
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  userSelect: 'none',
                  pointerEvents: 'none'
                }} 
              />
            );
          } else if (el.type === 'qrcode') {
            // 二维码显示为占位符或实际二维码
            content = (
              <div style={{
                width: '100%',
                height: '100%',
                background: '#f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: Math.max(8 * scale, 6),
                color: '#999'
              }}>
                QR
              </div>
            );
          } else if (el.type === 'barcode') {
            // 条形码显示为占位符
            content = (
              <div style={{
                width: '100%',
                height: '100%',
                background: '#f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: Math.max(8 * scale, 6),
                color: '#999'
              }}>
                |||||||
              </div>
            );
          } else if (el.type === 'line') {
            // 线条元素
            content = (
              <div style={{ width: '100%', height: '100%', background: el.borderColor || '#000' }} />
            );
          } else if (el.type === 'rect') {
            // 矩形元素
            content = (
              <div style={{ 
                width: '100%', 
                height: '100%', 
                border: `${(el.borderWidth || 2) * scale}px solid ${el.borderColor || '#000'}`,
                background: el.fillColor || 'transparent',
                boxSizing: 'border-box'
              }} />
            );
          } else if (el.type === 'table') {
            // 表格元素
            const rows = el.rows || 3;
            const cols = el.cols || 2;
            const cellData = el.cellData || {};
            content = (
              <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <tbody>
                  {Array.from({ length: rows }).map((_, i) => (
                    <tr key={i} style={{ height: `${100 / rows}%` }}>
                      {Array.from({ length: cols }).map((_, j) => {
                        const cellKey = `${i}-${j}`;
                        const cellContent = cellData[cellKey] || '';
                        return (
                          <td 
                            key={j} 
                            style={{ 
                              border: `1px solid ${el.borderColor || '#000'}`,
                              fontSize: (el.fontSize || 10) * scale,
                              textAlign: 'center',
                              verticalAlign: 'middle',
                              overflow: 'hidden',
                              width: `${100 / cols}%`
                            }}
                          >
                            <span style={{ 
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>{cellContent}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          } else {
            // 文本内容
            content = (
              <span style={{ userSelect: 'none' }}>
                {el.content}
              </span>
            );
          }

          // 根据元素类型决定是否需要padding
          const needsPadding = el.type === 'text';
          const padding = needsPadding ? 4 * scale : 0;
          
          return (
            <div
              key={index}
              style={{
                position: 'absolute',
                left: el.x * scale,
                top: el.y * scale,
                width: el.width * scale,
                height: el.height * scale,
                fontSize: (el.fontSize || 12) * scale,
                fontWeight: el.fontWeight || 'normal',
                fontFamily: el.fontFamily || 'Arial',
                color: el.color || '#000000',
                textAlign: el.textAlign || 'left',
                border: el.border ? `${Math.max(1, 2 * scale)}px solid #000` : 'none',
                padding: padding,
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                justifyContent: el.textAlign === 'center' ? 'center' : el.textAlign === 'right' ? 'flex-end' : 'flex-start',
                overflow: 'hidden',
                lineHeight: 1.2,
                userSelect: 'none',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap'
              }}
            >
              {content}
            </div>
          );
        })}
      </div>
    );
  };

  // 过滤模板
  const filteredTemplates = templates.filter(t => {
    const matchCategory = selectedCategory === 'all' || t.category === selectedCategory;
    const matchKeyword = !searchKeyword || 
      t.template_name?.toLowerCase().includes(searchKeyword.toLowerCase());
    return matchCategory && matchKeyword;
  });


  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)', background: '#fff' }}>
      {/* 顶部工具栏 */}
      <div style={{ 
        padding: '12px 16px', 
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }}>
        <Select
          value={selectedCategory}
          onChange={setSelectedCategory}
          style={{ width: 160 }}
          placeholder="选择分类"
        >
          {categories.map(cat => (
            <Option key={cat.key} value={cat.key}>
              {cat.name}
            </Option>
          ))}
        </Select>
        <Input
          placeholder="请输入标签名称搜索"
          prefix={<SearchOutlined style={{ color: '#999' }} />}
          value={searchKeyword}
          onChange={e => setSearchKeyword(e.target.value)}
          style={{ width: 240 }}
          allowClear
        />
        <span style={{ color: '#666', fontSize: 13 }}>共 {filteredTemplates.length} 条</span>
        <div style={{ flex: 1 }} />
        <Button 
          icon={<SettingOutlined />} 
          onClick={() => setClientManagerVisible(true)}
        >
          打印客户端
        </Button>
        <Button icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
          新建模板
        </Button>
        <Button onClick={loadTemplates} loading={loading}>刷新</Button>
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* 标签卡片列表 */}
        <div style={{ 
          flex: 1, 
          overflow: 'auto', 
          padding: 16,
          background: '#fafafa'
        }}>
          {filteredTemplates.length === 0 ? (
            <Empty description="暂无标签模板" style={{ marginTop: 100 }} />
          ) : (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 16
            }}>
              {filteredTemplates.map(template => (
                <div
                  key={template.id}
                  style={{
                    background: '#fff',
                    borderRadius: 4,
                    overflow: 'hidden',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                >
                  {/* 预览区域 */}
                  <div style={{
                    height: 160,
                    background: '#f9f9f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderBottom: '1px solid #f0f0f0',
                    padding: 8
                  }}>
                    {renderLabelPreview(template)}
                  </div>
                  
                  {/* 信息区域 */}
                  <div style={{ padding: '8px 12px' }}>
                    <div style={{ 
                      fontSize: 13, 
                      fontWeight: 500, 
                      marginBottom: 4,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {template.template_name}
                    </div>
                    <div style={{ fontSize: 12, color: '#999' }}>
                      {template.label_width || 100}*{template.label_height || 70}
                    </div>
                  </div>
                  
                  {/* 操作按钮 */}
                  <div style={{ 
                    display: 'flex', 
                    borderTop: '1px solid #f0f0f0',
                    background: '#fafafa'
                  }}>
                    <div
                      onClick={() => navigate(`/label-editor/${template.id}`)}
                      style={{
                        flex: 1,
                        padding: '8px 0',
                        textAlign: 'center',
                        cursor: 'pointer',
                        fontSize: 12,
                        color: '#666',
                        borderRight: '1px solid #f0f0f0',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2
                      }}
                    >
                      <EditOutlined />
                      <span>编辑</span>
                    </div>
                    <div
                      onClick={() => handlePrintTemplate(template)}
                      style={{
                        flex: 1,
                        padding: '8px 0',
                        textAlign: 'center',
                        cursor: 'pointer',
                        fontSize: 12,
                        color: '#666',
                        borderRight: '1px solid #f0f0f0',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2
                      }}
                    >
                      <PrinterOutlined />
                      <span>打印</span>
                    </div>
                    <Popconfirm
                      title="确定删除此模板吗?"
                      onConfirm={() => handleDeleteTemplate(template.id)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <div
                        style={{
                          flex: 1,
                          padding: '8px 0',
                          textAlign: 'center',
                          cursor: 'pointer',
                          fontSize: 12,
                          color: '#666',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 2
                        }}
                      >
                        <DeleteOutlined />
                        <span>删除</span>
                      </div>
                    </Popconfirm>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 新建模板弹窗 */}
      <Modal
        title="新建标签模板"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        footer={null}
        width={400}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateTemplate}
          initialValues={{ label_width: 100, label_height: 70 }}
        >
          <Form.Item
            name="template_name"
            label="模板名称"
            rules={[{ required: true, message: '请输入模板名称' }]}
          >
            <Input placeholder="请输入模板名称" />
          </Form.Item>
          <Form.Item name="template_desc" label="模板描述">
            <Input.TextArea rows={2} placeholder="请输入模板描述（可选）" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item
              name="label_width"
              label="标签宽度(mm)"
              style={{ flex: 1 }}
              rules={[{ required: true, message: '请输入宽度' }]}
            >
              <InputNumber min={10} max={500} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="label_height"
              label="标签高度(mm)"
              style={{ flex: 1 }}
              rules={[{ required: true, message: '请输入高度' }]}
            >
              <InputNumber min={10} max={500} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item style={{ marginBottom: 0, marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={() => {
                setCreateModalVisible(false);
                createForm.resetFields();
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                创建并编辑
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* 打印对话框 */}
      <Modal
        title={<><PrinterOutlined /> 打印标签</>}
        open={printModalVisible}
        onCancel={() => {
          setPrintModalVisible(false);
          setCurrentPrintTemplate(null);
          setSelectedClient('');
          setSelectedPrinter('');
          setPrintCopies(1);
        }}
        footer={null}
        width={500}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontWeight: 500 }}>打印方式：</span>
          </div>
          <Radio.Group value={printMode} onChange={e => setPrintMode(e.target.value)}>
            <Radio.Button value="local">本地打印</Radio.Button>
            <Radio.Button value="remote">
              <CloudOutlined /> 远程打印
            </Radio.Button>
          </Radio.Group>
        </div>

        {printMode === 'local' ? (
          <div>
            <p style={{ color: '#666', marginBottom: 16 }}>
              将在当前浏览器打开打印预览窗口，使用本机连接的打印机进行打印。
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={() => setPrintModalVisible(false)}>取消</Button>
              <Button type="primary" onClick={handleLocalPrint}>
                打印预览
              </Button>
            </div>
          </div>
        ) : (
          <div>
            {loadingClients ? (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <Spin tip="加载打印客户端..." />
              </div>
            ) : printClients.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>
                <p>暂无在线的打印客户端</p>
                <p style={{ fontSize: 12 }}>请确保打印客户端已启动并连接到服务器</p>
                <Button onClick={loadPrintClients} style={{ marginTop: 8 }}>刷新</Button>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>选择打印客户端：</label>
                  <Select
                    value={selectedClient}
                    onChange={(value) => {
                      setSelectedClient(value);
                      setSelectedPrinter('');
                      setClientPrinters([]);
                      loadClientPrinters(value);
                    }}
                    style={{ width: '100%' }}
                    placeholder="请选择打印客户端"
                  >
                    {printClients.map(client => (
                      <Option key={client.clientId} value={client.clientId}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <DesktopOutlined />
                          {client.clientName}
                          <Tag color={client.type === 'http' ? 'blue' : 'green'} style={{ marginLeft: 4 }}>
                            {client.type === 'http' ? 'HTTP' : 'Socket'}
                          </Tag>
                          <span style={{ color: '#999' }}>({client.printers?.length || 0} 台打印机)</span>
                          {!client.online && <Tag color="red">离线</Tag>}
                        </span>
                      </Option>
                    ))}
                  </Select>
                </div>

                {selectedClient && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>
                      选择打印机：
                      {loadingPrinters && <Spin size="small" style={{ marginLeft: 8 }} />}
                    </label>
                    <Select
                      value={selectedPrinter}
                      onChange={setSelectedPrinter}
                      style={{ width: '100%' }}
                      placeholder="请选择打印机（可选，默认使用客户端默认打印机）"
                      allowClear
                      loading={loadingPrinters}
                    >
                      {getSelectedClientPrinters().map((printer, index) => (
                        <Option key={printer.name || printer || index} value={printer.name || printer}>
                          {printer.name || printer}
                        </Option>
                      ))}
                    </Select>
                  </div>
                )}

                {/* 标签尺寸设置 */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>标签尺寸 (mm)：</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <InputNumber
                      min={10}
                      max={500}
                      value={printLabelWidth}
                      onChange={setPrintLabelWidth}
                      style={{ width: 100 }}
                      addonAfter="宽"
                    />
                    <span>×</span>
                    <InputNumber
                      min={10}
                      max={500}
                      value={printLabelHeight}
                      onChange={setPrintLabelHeight}
                      style={{ width: 100 }}
                      addonAfter="高"
                    />
                    <Button 
                      size="small" 
                      onClick={() => {
                        setPrintLabelWidth(currentPrintTemplate?.label_width || 100);
                        setPrintLabelHeight(currentPrintTemplate?.label_height || 70);
                      }}
                    >
                      重置
                    </Button>
                  </div>
                  <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                    模板原始尺寸: {currentPrintTemplate?.label_width || 100} × {currentPrintTemplate?.label_height || 70} mm
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>打印份数：</label>
                    <InputNumber
                      min={1}
                      max={100}
                      value={printCopies}
                      onChange={setPrintCopies}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>缩放比例：</label>
                    <InputNumber
                      min={10}
                      max={200}
                      value={printScale}
                      onChange={setPrintScale}
                      formatter={value => `${value}%`}
                      parser={value => value.replace('%', '')}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>打印方向：</label>
                  <Radio.Group value={printOrientation} onChange={e => setPrintOrientation(e.target.value)}>
                    <Radio value="portrait">纵向</Radio>
                    <Radio value="landscape">横向</Radio>
                  </Radio.Group>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <Button onClick={() => setPrintModalVisible(false)}>取消</Button>
                  <Button type="primary" onClick={handleRemotePrint} disabled={!selectedClient}>
                    发送打印
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* 打印客户端管理 */}
      <PrintClientManager 
        visible={clientManagerVisible} 
        onClose={() => setClientManagerVisible(false)} 
      />
    </div>
  );
};

export default ComplianceLabelPrint;
