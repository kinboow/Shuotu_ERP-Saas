import React, { useState, useEffect } from 'react';
import {
  Table, Tag, Space, Button, Input, Select, message, Card, Row, Col, Image,
  Modal, Form, Drawer, Descriptions, Empty, Tooltip, Badge, Popconfirm, Dropdown
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, DeleteOutlined, EyeOutlined,
  PrinterOutlined, SendOutlined, CloseCircleOutlined, DownOutlined, CopyOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { stockOrdersAPI } from '../api';
import JsBarcode from 'jsbarcode';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import pdfMake from 'pdfmake/build/pdfmake';
import chineseFontVfs from '../fonts/vfs_fonts';

// 初始化 pdfMake 字体（只使用中文字体）
pdfMake.vfs = chineseFontVfs;

// 注册中文字体
pdfMake.fonts = {
  ChineseFont: {
    normal: 'ChineseFont.ttf',
    bold: 'ChineseFont.ttf',
    italics: 'ChineseFont.ttf',
    bolditalics: 'ChineseFont.ttf'
  }
};

const HEADER_CATEGORY_MAX_WIDTH = 118;
const HEADER_CATEGORY_DEFAULT_FONT_SIZE = 9;
const HEADER_CATEGORY_MIN_FONT_SIZE = 6;

function measureHeaderTextWidth(text, fontSize) {
  const content = String(text || '');
  if (!content) {
    return 0;
  }

  if (typeof document === 'undefined') {
    return content.length * fontSize * 0.55;
  }

  const canvas = measureHeaderTextWidth._canvas || (measureHeaderTextWidth._canvas = document.createElement('canvas'));
  const context = canvas.getContext('2d');
  if (!context) {
    return content.length * fontSize * 0.55;
  }

  context.font = `bold ${fontSize}px Arial`;
  return context.measureText(content).width;
}

function getCategoryHeaderFontSize(text) {
  const content = String(text || '').trim();
  if (!content) {
    return HEADER_CATEGORY_DEFAULT_FONT_SIZE;
  }

  let fontSize = HEADER_CATEGORY_DEFAULT_FONT_SIZE;
  while (fontSize > HEADER_CATEGORY_MIN_FONT_SIZE && measureHeaderTextWidth(content, fontSize) > HEADER_CATEGORY_MAX_WIDTH) {
    fontSize -= 0.5;
  }

  return Math.max(fontSize, HEADER_CATEGORY_MIN_FONT_SIZE);
}

const { Option } = Select;

// 格式化时间
const formatTime = (timeStr) => {
  if (!timeStr) return '-';
  try {
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) return timeStr;
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Shanghai'
    }).replace(/\//g, '-');
  } catch (e) {
    return timeStr;
  }
};

function ShippingStation() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filters, setFilters] = useState({
    order_number: '',
    platform: '',
    shop_id: ''
  });
  const [shopList, setShopList] = useState([]);

  // 打印相关状态
  const [printModalVisible, setPrintModalVisible] = useState(false);
  const [printType, setPrintType] = useState('');
  const [printLoading, setPrintLoading] = useState(false);

  const [barcodePrintData, setBarcodePrintData] = useState([]);
  const [barcodePrintType, setBarcodePrintType] = useState(2);
  const [barcodePrintMode, setBarcodePrintMode] = useState(1); // 1: 官方条码, 2: 自定义条码
  const [barcodePrintContentType, setBarcodePrintContentType] = useState(1);
  const [barcodePrintFormatType, setBarcodePrintFormatType] = useState(1);
  const [fullOrdersForPrint, setFullOrdersForPrint] = useState([]);

  useEffect(() => {
    fetchOrders();
    fetchShopList();
  }, []);

  // 获取店铺列表
  const fetchShopList = async () => {
    try {
      const response = await fetch('/api/stock-orders/shops');
      const data = await response.json();
      if (data.success) {
        setShopList(data.data || []);
      }
    } catch (error) {
      console.error('获取店铺列表失败:', error);
    }
  };

  // 获取发货台订单列表
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(filters);
      const response = await fetch(`/api/shipping-station?${params}`);
      const data = await response.json();

      if (data.success) {
        setOrders(Array.isArray(data.data) ? data.data : []);
      } else {
        message.error(data.message || '获取发货台订单失败');
        setOrders([]);
      }
    } catch (error) {
      message.error('获取发货台订单失败: ' + error.message);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  // 从发货台移除订单
  const handleRemoveFromStation = async (orderIds) => {
    try {
      const response = await fetch('/api/shipping-station/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds })
      });

      const data = await response.json();
      if (data.success) {
        message.success('已从发货台移除');
        fetchOrders();
        setSelectedOrders([]);
      } else {
        message.error(data.message || '移除失败');
      }
    } catch (error) {
      message.error('移除失败: ' + error.message);
    }
  };

  // 查看详情
  const handleViewDetail = (record) => {
    setSelectedOrder(record);
    setDetailDrawerVisible(true);
  };

  const handleCopySelectedOrderNumbers = async () => {
    const orderNumbers = Array.from(new Set(
      selectedOrders
        .map(order => order.order_number || order.order_no || '')
        .map(value => String(value).trim())
        .filter(Boolean)
    ));

    if (orderNumbers.length === 0) {
      message.warning('没有可复制的订单号');
      return;
    }

    const text = orderNumbers.join('\n');

    try {
      if (navigator?.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', 'readonly');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      message.success(`已复制 ${orderNumbers.length} 个订单号`);
    } catch (error) {
      message.error('复制订单号失败，请重试');
    }
  };

  const fetchFullOrders = async () => {
    const orderNumbers = selectedOrders.map(o => o.order_number);
    const response = await fetch(`/api/stock-orders?order_number=${orderNumbers.join(',')}&platform=shein`);
    const data = await response.json();

    if (!data.success || !data.data || data.data.length === 0) {
      throw new Error('获取订单详情失败');
    }
    return data.data;
  };


  const prepareBarcodeData = async (fullOrders) => {
    setPrintLoading(true);
    try {
      const barcodeList = [];

      fullOrders.forEach(order => {
        if (order.items && order.items.length > 0) {
          order.items.forEach(item => {
            if (item.supplier_code || item.sku_code) {
              barcodeList.push({
                barcode: item.supplier_code || '',
                skc: item.skc || '',
                skuCode: item.sku_code || '',
                sheinSku: item.sku_code || '',
                supplierSku: item.supplier_sku || '',
                size: item.suffix_zh || item.sku_attribute || '',
                quantity: item.order_quantity || 1,
                orderQuantity: item.order_quantity || 1,
                orderNumber: order.order_number || order.order_no,
                shopId: order.shop_id,
                shopName: order.shop_name
              });
            }
          });
        }
      });

      if (barcodeList.length === 0) {
        message.warning('选中的订单没有可打印的条码');
        setPrintLoading(false);
        return;
      }

      setBarcodePrintData(barcodeList);
      setPrintType('barcode');
      setPrintModalVisible(true);
    } catch (error) {
      message.error('准备打印数据失败: ' + error.message);
    } finally {
      setPrintLoading(false);
    }
  };

  const generatePickListPDF = async (fullOrders) => {
    setPrintLoading(true);
    message.loading('正在生成拣货单PDF...', 0);
    
    try {
      // 使用中文字体
      const useChineseFont = 'ChineseFont';
      
      // 图片转base64的辅助函数
      // 通过后端代理获取图片base64（解决跨域问题）
      const imageToBase64 = async (url) => {
        if (!url) return null;
        try {
          // 使用后端代理接口获取图片
          const proxyUrl = `/api/proxy/image?url=${encodeURIComponent(url)}`;
          const response = await fetch(proxyUrl);
          const data = await response.json();
          if (data.success && data.data) {
            return data.data;
          }
          console.warn('图片代理返回失败:', url, data.message);
          return null;
        } catch (e) {
          console.warn('图片加载失败:', url, e);
          return null;
        }
      };
      


      // 收集所有SKU数据，按订单+SKC分组
      const groupedItems = new Map();
      
      fullOrders.forEach(order => {
        if (order.items && order.items.length > 0) {
          order.items.forEach(item => {
            const skc = item.skc || '';
            const groupKey = `${order.order_number}_${skc}`;
            
            if (!groupedItems.has(groupKey)) {
              groupedItems.set(groupKey, {
                orderNumber: order.order_number,
                skc: skc,
                supplierCode: item.supplier_code || '',
                productImage: item.product_image || item.sku_image || '',
                addTime: order.allocate_time || order.add_time || '',
                requestDeliveryTime: order.request_delivery_time || '',
                shopName: order.shop_name || '',
                skuList: []
              });
            }
            
            groupedItems.get(groupKey).skuList.push({
              skuAttribute: item.sku_attribute || '',
              supplierCode: item.supplier_code || '',
              orderQuantity: item.order_quantity || 0
            });
          });
        }
      });
      
      const pickItems = Array.from(groupedItems.values());
      
      if (pickItems.length === 0) {
        message.destroy();
        message.warning('没有可打印的拣货数据');
        setPrintLoading(false);
        return;
      }
      
      // 当前打印时间
      const printTime = new Date().toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).replace(/\//g, '-');
      
      message.destroy();
      message.loading('正在加载图片...', 0);
      
      // 预加载所有图片并转换为base64
      const imageCache = new Map();
      for (const item of pickItems) {
        if (item.productImage && !imageCache.has(item.productImage)) {
          const base64 = await imageToBase64(item.productImage);
          imageCache.set(item.productImage, base64);
        }
      }
      
      message.destroy();
      message.loading('正在构建PDF文档...', 0);
      
      // 构建内容数组 - 每个订单作为独立的表格，确保不会跨页
      const contentItems = [];
      
      // 添加表头（只在第一页显示）
      contentItems.push({
        table: {
          headerRows: 1,
          widths: [25, 230, 100, 60, 38, 50],
          body: [
            [
              { text: '序号', style: 'tableHeader', alignment: 'center' },
              { text: '订单信息', style: 'tableHeader', alignment: 'center' },
              { text: '货号', style: 'tableHeader', alignment: 'center' },
              { text: '属性集', style: 'tableHeader', alignment: 'center' },
              { text: '数量', style: 'tableHeader', alignment: 'center' },
              { text: '拣货', style: 'tableHeader', alignment: 'center' }
            ]
          ]
        },
        layout: {
          fillColor: function (rowIndex) { return rowIndex === 0 ? '#f5f5f5' : null; },
          hLineWidth: function () { return 0.5; },
          vLineWidth: function () { return 0.5; },
          hLineColor: function () { return '#000000'; },
          vLineColor: function () { return '#000000'; }
        }
      });
      
      let itemIndex = 1;
      for (const item of pickItems) {
        const addTimeStr = item.addTime ? formatTime(item.addTime).substring(0, 19) : '-';
        const reqTimeStr = item.requestDeliveryTime ? formatTime(item.requestDeliveryTime).substring(0, 19) : '';
        const skuCount = item.skuList.length;
        const totalQuantity = item.skuList.reduce((sum, sku) => sum + sku.orderQuantity, 0);
        
        // 订单信息文本
        const orderInfoLines = [
          `SKC: ${item.skc}`,
          `订单号: ${item.orderNumber}`,
          `下发时间: ${addTimeStr}`
        ];
        if (reqTimeStr) {
          orderInfoLines.push(`要求取件: ${reqTimeStr}`);
        }
        
        // 构建订单信息单元格内容（包含图片和店铺名）
        const imageBase64 = imageCache.get(item.productImage);
        // 店铺名：蓝色加粗
        const shopLabel = item.shopName ? {
          text: item.shopName,
          fontSize: 9,
          bold: true,
          color: '#185abd',
          margin: [0, 4, 0, 0]
        } : null;
        
        let orderInfoCell;
        if (imageBase64) {
          const textContent = shopLabel 
            ? { stack: [{ text: orderInfoLines.join('\n'), fontSize: 9 }, shopLabel] }
            : { text: orderInfoLines.join('\n'), fontSize: 9 };
          orderInfoCell = {
            columns: [
              { image: imageBase64, fit: [50, 60], width: 54 },
              textContent
            ],
            columnGap: 4,
            margin: [0, 5.5, 0, 5.5]
          };
        } else {
          orderInfoCell = shopLabel 
            ? { stack: [{ text: orderInfoLines.join('\n'), fontSize: 9 }, shopLabel], margin: [0, 5.5, 0, 5.5] }
            : { text: orderInfoLines.join('\n'), fontSize: 9, margin: [0, 5.5, 0, 5.5] };
        }
        
        // 构建当前订单的所有行
        const orderRows = [];
        
        if (skuCount === 1) {
          // 单个SKU - 只有一行（行高+11）
          orderRows.push([
            { text: itemIndex.toString(), alignment: 'center', fontSize: 9, margin: [0, 5.5, 0, 5.5] },
            orderInfoCell,
            { text: item.skuList[0].supplierCode || '-', alignment: 'center', fontSize: 9, margin: [0, 5.5, 0, 5.5] },
            { text: item.skuList[0].skuAttribute || '-', alignment: 'center', fontSize: 9, margin: [0, 5.5, 0, 5.5] },
            { text: item.skuList[0].orderQuantity.toString(), alignment: 'center', fontSize: 12, bold: true, margin: [0, 5.5, 0, 5.5] },
            { text: '', margin: [0, 5.5, 0, 5.5] }
          ]);
        } else {
          // 多个SKU - 使用rowSpan
          let orderInfoCellWithSpan;
          if (imageBase64) {
            const textContent = shopLabel 
              ? { stack: [{ text: orderInfoLines.join('\n'), fontSize: 9 }, shopLabel] }
              : { text: orderInfoLines.join('\n'), fontSize: 9 };
            orderInfoCellWithSpan = {
              columns: [
                { image: imageBase64, fit: [50, 60], width: 54 },
                textContent
              ],
              columnGap: 4,
              rowSpan: skuCount + 1
            };
          } else {
            orderInfoCellWithSpan = shopLabel 
              ? { stack: [{ text: orderInfoLines.join('\n'), fontSize: 9 }, shopLabel], rowSpan: skuCount + 1 }
              : { text: orderInfoLines.join('\n'), fontSize: 9, rowSpan: skuCount + 1 };
          }
          
          // 第一行
          orderRows.push([
            { text: itemIndex.toString(), alignment: 'center', fontSize: 9, rowSpan: skuCount + 1, margin: [0, 4, 0, 4] },
            orderInfoCellWithSpan,
            { text: item.skuList[0].supplierCode || '-', alignment: 'center', fontSize: 9, margin: [0, 4, 0, 4] },
            { text: item.skuList[0].skuAttribute || '-', alignment: 'center', fontSize: 9, margin: [0, 4, 0, 4] },
            { text: item.skuList[0].orderQuantity.toString(), alignment: 'center', fontSize: 12, bold: true, margin: [0, 4, 0, 4] },
            { text: '', margin: [0, 4, 0, 4] }
          ]);
          
          // 后续SKU行
          for (let i = 1; i < skuCount; i++) {
            const sku = item.skuList[i];
            orderRows.push([
              '', '',
              { text: sku.supplierCode || '-', alignment: 'center', fontSize: 9, margin: [0, 4, 0, 4] },
              { text: sku.skuAttribute || '-', alignment: 'center', fontSize: 9, margin: [0, 4, 0, 4] },
              { text: sku.orderQuantity.toString(), alignment: 'center', fontSize: 12, bold: true, margin: [0, 4, 0, 4] },
              { text: '', margin: [0, 4, 0, 4] }
            ]);
          }
          
          // 合计行（行高-2）
          orderRows.push([
            '', '',
            { text: '合计', alignment: 'center', colSpan: 2, bold: true, fontSize: 9, fillColor: '#fffde7', margin: [0, 3, 0, 3] },
            '',
            { text: totalQuantity.toString(), alignment: 'center', fontSize: 12, bold: true, fillColor: '#fffde7', margin: [0, 3, 0, 3] },
            { text: '', margin: [0, 3, 0, 3] }
          ]);
        }
        
        // 将当前订单作为独立表格添加，使用 unbreakable 确保不跨页
        contentItems.push({
          unbreakable: true, // 关键：确保整个订单不会跨页
          table: {
            widths: [25, 230, 100, 60, 38, 50],
            body: orderRows
          },
          layout: {
            hLineWidth: function () { return 0.5; },
            vLineWidth: function () { return 0.5; },
            hLineColor: function () { return '#000000'; },
            vLineColor: function () { return '#000000'; }
          },
          margin: [0, -1, 0, 0] // 负边距消除表格间隙
        });
        
        itemIndex++;
      }
      
      // 定义PDF文档
      const docDefinition = {
        pageSize: 'A4',
        pageMargins: [20, 50, 20, 30],
        header: {
          columns: [
            { text: '拣货单', fontSize: 18, bold: true, margin: [20, 15, 0, 0], font: useChineseFont },
            { text: `打印时间: ${printTime}`, fontSize: 9, alignment: 'right', margin: [0, 20, 20, 0], color: '#666666', font: useChineseFont }
          ]
        },
        footer: function(currentPage, pageCount) {
          return {
            columns: [
              { text: '', width: '*' },
              { text: currentPage.toString() + ' / ' + pageCount.toString(), alignment: 'center', fontSize: 9, width: 'auto', font: useChineseFont },
              { text: '协途ERP©YKB', alignment: 'right', fontSize: 8, color: '#999999', width: '*', margin: [0, 0, 20, 0], font: useChineseFont }
            ],
            margin: [20, 10, 0, 0]
          };
        },
        content: contentItems,
        styles: {
          tableHeader: {
            bold: true,
            fontSize: 10,
            fillColor: '#f5f5f5',
            margin: [0, 3, 0, 3]
          }
        },
        defaultStyle: {
          fontSize: 9,
          font: useChineseFont
        }
      };
      
      message.destroy();
      message.loading('正在生成PDF文件...', 0);
      
      // 使用pdfMake生成PDF
      const pdfDocGenerator = pdfMake.createPdf(docDefinition);
      
      // 获取PDF blob
      const pdfBlob = await new Promise((resolve, reject) => {
        pdfDocGenerator.getBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('PDF生成失败'));
          }
        });
      });
      
      console.log('PDF生成成功，大小:', pdfBlob.size);
      const fileName = `拣货单_${new Date().toISOString().slice(0, 10)}_${Date.now()}.pdf`;
      
      // 将Blob转为base64
      const reader = new FileReader();
      const base64Promise = new Promise((resolve) => {
        reader.onloadend = () => {
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(pdfBlob);
      });
      const base64Data = await base64Promise;
      
      // 尝试上传到OSS服务，自动匹配当前协议
      let useOss = false;
      const ossUrl = process.env.REACT_APP_OSS_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
      try {
        const healthCheck = await fetch(`${ossUrl}/health`, { 
          method: 'GET',
          signal: AbortSignal.timeout(2000) // 2秒超时
        });
        useOss = healthCheck.ok;
      } catch (e) {
        console.warn('OSS服务不可用，使用本地预览');
        useOss = false;
      }
      
      if (useOss) {
        // 上传到OSS服务
        const ossResponse = await fetch(`${ossUrl}/upload/buffer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            buffer: base64Data,
            fileName: fileName,
            category: 'pdf',
            expiresIn: 7200 // 2小时有效
          })
        });
        
        if (!ossResponse.ok) {
          throw new Error(`OSS服务响应错误: ${ossResponse.status}`);
        }
        
        const ossResult = await ossResponse.json();
        
        if (ossResult.success) {
          window.open(ossResult.data.signedUrl, '_blank');
          message.destroy();
          message.success(`拣货单已生成，链接有效期至 ${ossResult.data.expiresAt.replace('T', ' ').slice(0, 19)}`);
        } else {
          throw new Error(ossResult.message || 'OSS上传失败');
        }
      } else {
        // 回退到本地Blob URL预览
        const pdfBlobWithType = new Blob([pdfBlob], { type: 'application/pdf' });
        const pdfUrl = URL.createObjectURL(pdfBlobWithType);
        window.open(pdfUrl, '_blank');
        
        // 2小时后释放URL
        setTimeout(() => URL.revokeObjectURL(pdfUrl), 2 * 60 * 60 * 1000);
        
        message.destroy();
        message.success('拣货单已生成（本地预览模式）');
      }
    } catch (error) {
      message.destroy();
      message.error('生成拣货单失败: ' + error.message);
      console.error('生成拣货单失败:', error);
    } finally {
      setPrintLoading(false);
    }
  };

  const handleSheinPrint = async () => {
    if (barcodePrintData.length === 0) {
      message.warning('没有可打印的条码数据');
      return;
    }

    // 检查是否有店铺ID
    const shopId = barcodePrintData[0]?.shopId;
    if (!shopId) {
      message.error('无法获取店铺信息，请确保选中的订单有关联店铺');
      return;
    }

    // 检查所有订单是否属于同一店铺
    const allSameShop = barcodePrintData.every(item => item.shopId === shopId);
    if (!allSameShop) {
      message.warning('选中的订单属于不同店铺，请分批打印');
      return;
    }

    setPrintLoading(true);
    try {
      // 构建打印数据
      const printData = barcodePrintData.map(item => ({
        orderNo: item.orderNumber || null,
        supplierSku: item.supplierSku || null,
        sheinSku: item.sheinSku,
        printNumber: item.quantity,
        printContentType: barcodePrintContentType
      }));

      // 校验打印总数
      const totalPrintNumber = printData.reduce((sum, item) => sum + item.printNumber, 0);
      if (totalPrintNumber > 2000) {
        message.error(`打印总数量(${totalPrintNumber})超过2000份限制，请减少打印数量`);
        setPrintLoading(false);
        return;
      }

      // 调用后端API
      const response = await stockOrdersAPI.printBarcode({
        shopId,
        data: printData,
        type: barcodePrintType,
        printFormatType: barcodePrintFormatType
      });

      if (response.data.success) {
        if (response.data.url) {
          // 打开PDF链接
          window.open(response.data.url, '_blank');
          message.success('条码PDF已生成，请在新窗口中打印');
        } else {
          message.warning('未获取到条码PDF链接');
        }

        // 显示错误数据（如果有）
        if (response.data.errorData && response.data.errorData.length > 0) {
          const errorCount = response.data.errorData.length;
          message.warning(`${errorCount}个SKU打印失败，请检查`);
          console.log('打印失败的SKU:', response.data.errorData);
        }

        setPrintModalVisible(false);
        // 打印完成后保留选中状态，方便用户继续其他操作
      } else {
        message.error(response.data.message || '获取条码失败');
      }
    } catch (error) {
      message.error('打印条码失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setPrintLoading(false);
    }
  };

  const generateCustomBarcodePDF = async (categoriesMap = {}, officialBarcodesMap = {}) => {
    try {
      message.loading('正在生成自定义条码PDF...', 0);

      const contentItems = [];

      // 配置：70mm x 30mm 标签尺寸
      // 1mm = 2.83465 pt
      const pageWidth = 70 * 2.83465;
      const pageHeight = 30 * 2.83465;

      // 生成间隔符标签的方法
      // 页面可用高度 = pageHeight(85pt) - 上下margin(6pt) = 79pt
      // 表格边框占2pt(上下各1pt)，所以内容区最多77pt
      // 去掉 unbreakable 和固定 heights，让 pdfMake 自动计算高度，避免溢出导致空白页
      const createSeparatorLabel = (text, shopName) => {
        return {
          stack: [
            // 顶部店铺名称（限制单行，缩小字号）
            {
              text: shopName ? `[${shopName}]` : '',
              fontSize: 7,
              bold: true,
              alignment: 'center',
              lineHeight: 1,
              noWrap: true,
              margin: [0, 0, 0, 2]
            },
            // 上方粗黑线
            {
              canvas: [{ type: 'rect', x: 0, y: 0, w: 180, h: 6, color: 'black' }],
              alignment: 'center',
              margin: [0, 0, 0, 3]
            },
            // 中间文字
            {
              text: text,
              fontSize: 12,
              bold: true,
              alignment: 'center',
              lineHeight: 1,
              margin: [0, 0, 0, 3]
            },
            // 下方粗黑线
            {
              canvas: [{ type: 'rect', x: 0, y: 0, w: 180, h: 6, color: 'black' }],
              alignment: 'center',
              margin: [0, 0, 0, 2]
            }
          ],
          margin: [0, 20, 0, 0], // 添加上边距居中 (总高度79pt - 内容高度约36pt) / 2 = ~20pt
          pageBreak: 'after' // 间隔符后一定要换页
        };
      };

      let prevShopId = null;
      let prevOrderNumber = null;
      let prevSkuCode = null;

      for (let itemIndex = 0; itemIndex < barcodePrintData.length; itemIndex++) {
        const item = barcodePrintData[itemIndex];

        // 判断是否需要插入间隔符
        if (itemIndex > 0) {
          if (item.shopId !== prevShopId) {
            contentItems.push(createSeparatorLabel('前后店铺不同，请不要贴错', item.shopName));
          } else if (item.orderNumber !== prevOrderNumber) {
            contentItems.push(createSeparatorLabel('前后订单不同，请不要贴错', item.shopName));
          } else if (item.skuCode !== prevSkuCode) {
            contentItems.push(createSeparatorLabel('前后款式不同，请不要贴错', item.shopName));
          }
        }

        prevShopId = item.shopId;
        prevOrderNumber = item.orderNumber;
        prevSkuCode = item.skuCode;

        // 创建一个隐藏的 canvas 来生成条码
        const canvas = document.createElement('canvas');

        // 使用官方返回的 barcode，如果没有则降级使用商家条码/sheinSku
        const officialBarcode = officialBarcodesMap[item.sheinSku];
        const barcodeContent = officialBarcode || (barcodePrintContentType === 1 ? item.barcode : (item.supplierSku || item.sheinSku));

        if (!barcodeContent) continue;

        // CODE128 仅支持 ASCII 字符，包含中文会报错
        const validBarcodeData = barcodeContent.replace(/[^\x20-\x7E]/g, '').trim() || item.sheinSku || 'INVALID';

        try {
          // 为了让条码在 PDF 打印时足够清晰（提升 DPI），
          // 这里将 JsBarcode 生成的宽高成倍放大，
          // 在放入 PDF 时它会被缩小，从而变得非常清晰锐利。
          JsBarcode(canvas, validBarcodeData, {
            format: "CODE128",
            width: 4,     // 放大线条宽度以提高分辨率
            height: 120,  // 生成高分辨率条码，在PDF中会被统一缩放到固定尺寸
            displayValue: false,
            margin: 0
          });
        } catch (err) {
          console.error(`生成条码图形失败 [${validBarcodeData}]:`, err);
          continue;
        }

        const barcodeDataUrl = canvas.toDataURL('image/png');

        const categoryPath = categoriesMap[item.skuCode] || '未获取到分类';
        const categoryFontSize = getCategoryHeaderFontSize(categoryPath);
        const printQty = parseInt(item.quantity) || 1;

        // 为每一个需要打印的数量，增加一页
        for (let i = 0; i < printQty; i++) {
          const isLastPageOfThisItem = (i === printQty - 1 && itemIndex === barcodePrintData.length - 1);

          // 左上角文本："类目" 或者 "类目/颜色" (如果有的话)
          // 由于原来的需求说要显示类目，我们展示 categoryPath
          const topLeftText = categoryPath;

          contentItems.push({
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    border: [true, true, true, true],
                    margin: [0, 0, 0, 0],
                    stack: [
                      // 顶部行
                      {
                        columns: [
                          { text: topLeftText, fontSize: categoryFontSize, alignment: 'left', bold: true, width: '*', noWrap: true },
                          { text: 'Made In China', fontSize: 7, alignment: 'right', bold: true, width: 'auto', noWrap: true }
                        ],
                        columnGap: 2,
                        margin: [0, 0, 0, 1]
                      },
                      // 条形码图片 - 强制固定宽高，确保所有条码大小一致
                      {
                        image: barcodeDataUrl,
                        width: 170,
                        height: 28,
                        alignment: 'center',
                        margin: [0, 0, 0, 1]
                      },
                      // 底部区域
                      {
                        columns: [
                          // 左侧：显示 商家货号、订单号 和 SKC号
                          {
                            stack: [
                              { text: item.barcode || item.supplierSku || '-', fontSize: 7, margin: [0, 0, 0, 0.5], noWrap: true },
                              { text: item.orderNumber || '-', fontSize: 7, margin: [0, 0, 0, 0.5], noWrap: true },
                              { text: item.skc || '-', fontSize: 7, noWrap: true }
                            ],
                            width: '*',
                            alignment: 'left',
                            margin: [0, 0, 0, 0]
                          },
                          // 右侧：尺码/颜色
                          {
                            text: item.size || '-',
                            fontSize: 11,
                            bold: true,
                            alignment: 'right',
                            width: 'auto',
                            margin: [0, 3, 3, 0],
                            noWrap: true
                          }
                        ]
                      }
                    ]
                  }
                ]
              ]
            },
            layout: {
              hLineWidth: function () { return 1; },
              vLineWidth: function () { return 1; },
              hLineColor: function () { return '#000000'; },
              vLineColor: function () { return '#000000'; },
              paddingLeft: function () { return 2; },
              paddingRight: function () { return 2; },
              paddingTop: function () { return 1.5; },
              paddingBottom: function () { return 1.5; }
            },
            pageBreak: isLastPageOfThisItem ? undefined : 'after' // 每个标签占一页
          });
        }
      }

      if (contentItems.length === 0) {
        message.destroy();
        message.warning('没有可打印的条码内容');
        return;
      }

      const docDefinition = {
        pageSize: { width: pageWidth, height: pageHeight },
        pageMargins: [3, 3, 3, 3],
        content: contentItems,
        defaultStyle: {
          font: 'ChineseFont' // 使用与拣货单相同的中文字体
        }
      };

      const pdfDocGenerator = pdfMake.createPdf(docDefinition);

      pdfDocGenerator.getBlob((blob) => {
        message.destroy();
        if (blob) {
          const pdfUrl = URL.createObjectURL(blob);
          window.open(pdfUrl, '_blank');
          setTimeout(() => URL.revokeObjectURL(pdfUrl), 60 * 60 * 1000);
          message.success('自定义条码已生成（本地预览）');
        } else {
          message.error('PDF生成失败');
        }
      });

    } catch (error) {
      message.destroy();
      message.error('生成自定义条码失败: ' + error.message);
      console.error(error);
    }
  };

  const handlePrintBarcode = async () => {
    if (barcodePrintData.length === 0) {
      message.warning('没有可打印的条码数据');
      return;
    }

    if (barcodePrintMode === 1) {
      // 官方标准打印
      await handleSheinPrint();
    } else {
      // 自定义本地打印
      setPrintLoading(true);
      try {
        let allCategoriesMap = {};
        let allOfficialBarcodesMap = {};

        // 按照 shopId 分组
        const shopGroups = {};
        barcodePrintData.forEach(item => {
          if (!item.shopId) return;
          if (!shopGroups[item.shopId]) {
            shopGroups[item.shopId] = [];
          }
          shopGroups[item.shopId].push(item);
        });

        const shopIds = Object.keys(shopGroups);
        if (shopIds.length === 0) {
          message.error('无法获取店铺信息，请确保选中的订单有关联店铺');
          setPrintLoading(false);
          return;
        }

        message.loading('正在获取数据...', 0);

        for (const shopId of shopIds) {
          const groupItems = shopGroups[shopId];
          const skus = Array.from(new Set(groupItems.map(item => item.skuCode).filter(Boolean)));

          // 获取类目
          if (skus.length > 0) {
            const catResponse = await stockOrdersAPI.getSkuCategories({ shopId, skus });
            if (catResponse.data?.success && catResponse.data?.data) {
              Object.assign(allCategoriesMap, catResponse.data.data);
            }
          }

          // 获取官方生成的 barcode
          const printData = groupItems.map(item => ({
            orderNo: item.orderNumber || null,
            supplierSku: item.supplierSku || null,
            sheinSku: item.sheinSku,
            printNumber: item.quantity,
            printContentType: barcodePrintContentType
          }));

          const barcodeResponse = await stockOrdersAPI.printBarcode({
            shopId,
            data: printData,
            type: barcodePrintType,
            printFormatType: barcodePrintFormatType
          });

          if (barcodeResponse.data?.code === "0" && barcodeResponse.data?.info?.codingInfoList) {
            barcodeResponse.data.info.codingInfoList.forEach(info => {
              if (info.sheinSku && info.barcode) {
                allOfficialBarcodesMap[info.sheinSku] = info.barcode;
              }
            });
          } else if (barcodeResponse.data?.success && barcodeResponse.data?.codingInfoList) {
            // 兼容可能存在的其他格式
            barcodeResponse.data.codingInfoList.forEach(info => {
              if (info.sheinSku && info.barcode) {
                allOfficialBarcodesMap[info.sheinSku] = info.barcode;
              }
            });
          } else {
            console.warn(`获取店铺 ${shopId} 的官方条码失败:`, barcodeResponse.data?.msg || barcodeResponse.data?.message);
          }
        }

        await generateCustomBarcodePDF(allCategoriesMap, allOfficialBarcodesMap);
        setPrintModalVisible(false);
        // 不清空选中的订单，方便后续操作
      } catch (error) {
        message.destroy();
        message.error('生成条码失败: ' + error.message);
      } finally {
        setPrintLoading(false);
      }
    }
  };


  const handlePrintMenuClick = async (type) => {
    if (selectedOrders.length === 0) {
      message.warning('请先选择要打印的订单');
      return;
    }

    setPrintType(type);

    try {
      if (type === 'barcode' || type === 'pickList') {
        message.loading({ content: '正在获取订单数据...', key: 'fetchFullOrders' });
        const fullOrders = await fetchFullOrders();
        message.success({ content: '获取订单数据成功', key: 'fetchFullOrders' });
        setFullOrdersForPrint(fullOrders);

        if (type === 'barcode') {
          await prepareBarcodeData(fullOrders);
        } else if (type === 'pickList') {
          await generatePickListPDF(fullOrders);
        }
      } else {
        message.info('该打印功能开发中...');
      }
    } catch (error) {
      message.error({ content: error.message, key: 'fetchFullOrders' });
    }
  };



  // 表格列配置
  const columns = [
    {
      title: '订单信息',
      key: 'orderInfo',
      width: 260,
      fixed: 'left',
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 10, padding: '8px 0' }}>
          {record.product_image ? (
            <Image
              src={record.product_image}
              style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: 4 }}
            />
          ) : (
            <div style={{ width: 70, height: 70, backgroundColor: '#f5f5f5', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 12 }}>无图</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ marginBottom: 4 }}>
              <span style={{ color: '#666', fontSize: 12 }}>订单号 </span>
              <span
                style={{ fontWeight: 'bold', color: '#1890ff', cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(record.order_number).then(() => {
                    message.success('订单号已复制');
                  });
                }}
                title="点击复制"
              >{record.order_number}</span>
            </div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>
              货号 {record.product_code || '-'}
            </div>
            <div style={{ fontSize: 12, color: '#666' }}>
              SKC {record.skc || '-'}
            </div>
          </div>
        </div>
      )
    },
    {
      title: '店铺',
      dataIndex: 'shop_name',
      key: 'shop_name',
      width: 120,
      render: (text) => <span style={{ color: '#1890ff', fontWeight: 500 }}>{text || '-'}</span>
    },
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      width: 100,
      render: (platform) => {
        const platformMap = {
          'shein': <Tag color="blue">SHEIN</Tag>,
          'temu': <Tag color="orange">TEMU</Tag>,
          'tiktok': <Tag color="black">TikTok</Tag>
        };
        return platformMap[platform] || <Tag>{platform}</Tag>;
      }
    },
    {
      title: '订单类型',
      dataIndex: 'order_type',
      key: 'order_type',
      width: 100,
      render: (type) => (
        <Tag color={type === '急采' ? 'red' : 'blue'}>{type || '-'}</Tag>
      )
    },
    {
      title: '下单数量',
      dataIndex: 'stock_quantity',
      key: 'stock_quantity',
      width: 100,
      align: 'center',
      render: (qty) => <span style={{ fontWeight: 'bold' }}>{qty || 0}</span>
    },
    {
      title: '加入时间',
      dataIndex: 'added_at',
      key: 'added_at',
      width: 160,
      render: (time) => formatTime(time)
    },
    {
      title: '要求取件时间',
      dataIndex: 'request_delivery_time',
      key: 'request_delivery_time',
      width: 160,
      render: (time) => {
        const formatted = formatTime(time);
        if (!time) return '-';

        const now = new Date();
        const deadline = new Date(time);
        const diffHours = Math.floor((deadline - now) / (1000 * 60 * 60));

        let color = '#52c41a';
        if (diffHours < 0) color = '#ff4d4f';
        else if (diffHours < 24) color = '#faad14';

        return (
          <div>
            <div>{formatted}</div>
            <div style={{ fontSize: 11, color, marginTop: 2 }}>
              {diffHours < 0 ? '已超时' : `剩余 ${diffHours}h`}
            </div>
          </div>
        );
      }
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Button type="link" size="small" onClick={() => handleViewDetail(record)}>详情</Button>
          <Popconfirm
            title="确定要从发货台移除吗？"
            onConfirm={() => handleRemoveFromStation([record.id])}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger>移除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card style={{ marginBottom: 16 }}>
        <Space size="middle" wrap>
          <Select
            placeholder="选择平台"
            value={filters.platform || undefined}
            onChange={(value) => setFilters({ ...filters, platform: value || '' })}
            style={{ width: 120 }}
            allowClear
          >
            <Option value="shein">SHEIN</Option>
            <Option value="temu">TEMU</Option>
            <Option value="tiktok">TikTok</Option>
          </Select>
          <Select
            placeholder="选择店铺"
            value={filters.shop_id || undefined}
            onChange={(value) => setFilters({ ...filters, shop_id: value || '' })}
            style={{ width: 150 }}
            allowClear
          >
            {shopList.map(shop => (
              <Option key={shop.shop_id} value={shop.shop_id}>{shop.shop_name}</Option>
            ))}
          </Select>
          <Input
            placeholder="采购单号"
            value={filters.order_number}
            onChange={(e) => setFilters({ ...filters, order_number: e.target.value })}
            style={{ width: 200 }}
            allowClear
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={fetchOrders}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchOrders}>
            刷新
          </Button>
        </Space>

        <div style={{ marginTop: 12 }}>
          <Space size="middle">
            <Dropdown
              menu={{
                items: [
                  { key: 'barcode', label: '打印条码' },
                  { key: 'pickList', label: '打印拣货单' }
                ],
                onClick: ({ key }) => handlePrintMenuClick(key)
              }}
              trigger={['click']}
              disabled={selectedOrders.length === 0}
            >
              <Button
                type="primary"
                icon={<PrinterOutlined />}
                disabled={selectedOrders.length === 0}
              >
                打印 <DownOutlined />
              </Button>
            </Dropdown>
            <Button
              type="primary"
              icon={<SendOutlined />}
              disabled={selectedOrders.length === 0}
              onClick={() => message.info('批量发货功能开发中...')}
            >
              批量发货
            </Button>
            <Button
              icon={<CopyOutlined />}
              disabled={selectedOrders.length === 0}
              onClick={handleCopySelectedOrderNumbers}
            >
              复制订单号
            </Button>
            <Popconfirm
              title={`确定要移除选中的 ${selectedOrders.length} 个订单吗？`}
              onConfirm={() => handleRemoveFromStation(selectedOrders.map(o => o.id))}
              okText="确定"
              cancelText="取消"
              disabled={selectedOrders.length === 0}
            >
              <Button
                danger
                icon={<CloseCircleOutlined />}
                disabled={selectedOrders.length === 0}
              >
                批量移除
              </Button>
            </Popconfirm>
          </Space>
        </div>
      </Card>

      {/* 统计信息 */}
      {selectedOrders.length > 0 && (
        <div style={{
          padding: '10px 16px',
          background: '#fafafa',
          borderLeft: '3px solid #1890ff',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 24
        }}>
          <span>
            已选 <span style={{ color: '#1890ff', fontWeight: 'bold' }}>{selectedOrders.length}</span> 个订单
          </span>
          <span style={{ color: '#999' }}>|</span>
          <span>
            总数量 <span style={{ fontWeight: 'bold' }}>{selectedOrders.reduce((sum, o) => sum + (o.stock_quantity || 0), 0)}</span> 件
          </span>
        </div>
      )}

      <Card>
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 500 }}>
            发货台订单列表
            <Badge
              count={orders.length}
              style={{ backgroundColor: '#52c41a', marginLeft: 8 }}
              overflowCount={999}
            />
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={orders}
          rowKey="id"
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total) => `共 ${total} 条`
          }}
          scroll={{ x: 1200 }}
          bordered
          size="middle"
          rowSelection={{
            selectedRowKeys: selectedOrders.map(o => o.id),
            onChange: (selectedRowKeys, selectedRows) => {
              setSelectedOrders(selectedRows);
            }
          }}
          locale={{
            emptyText: <Empty description="发货台暂无订单" />
          }}
        />
      </Card>

      {/* 详情抽屉 */}
      <Drawer
        title={`订单详情 - ${selectedOrder?.order_number}`}
        placement="right"
        onClose={() => setDetailDrawerVisible(false)}
        open={detailDrawerVisible}
        width={600}
      >
        {selectedOrder && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="采购单号">{selectedOrder.order_number}</Descriptions.Item>
            <Descriptions.Item label="店铺">{selectedOrder.shop_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="平台">{selectedOrder.platform || '-'}</Descriptions.Item>
            <Descriptions.Item label="订单类型">{selectedOrder.order_type || '-'}</Descriptions.Item>
            <Descriptions.Item label="SKC">{selectedOrder.skc || '-'}</Descriptions.Item>
            <Descriptions.Item label="货号">{selectedOrder.product_code || '-'}</Descriptions.Item>
            <Descriptions.Item label="下单数量">{selectedOrder.stock_quantity || 0}</Descriptions.Item>
            <Descriptions.Item label="仓库分组">{selectedOrder.warehouse_group || '-'}</Descriptions.Item>
            <Descriptions.Item label="加入发货台时间">{formatTime(selectedOrder.added_at)}</Descriptions.Item>
            <Descriptions.Item label="要求取件时间">{formatTime(selectedOrder.request_delivery_time)}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      {/* 条码打印模态框 */}
      <Modal
        title="打印商品条码"
        open={printModalVisible && printType === 'barcode'}
        onCancel={() => {
          setPrintModalVisible(false);
          setBarcodePrintData([]);
        }}
        onOk={handlePrintBarcode}
        confirmLoading={printLoading}
        width={900}
        okText="生成条码PDF"
        cancelText="取消"
      >
        {/* 打印配置 */}
        <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f0f7ff', borderRadius: 4, border: '1px solid #91caff' }}>
          <Space size="large" wrap>
            <span style={{ fontSize: 13 }}>
              打印模式：
              <Select
                value={barcodePrintMode}
                onChange={(v) => setBarcodePrintMode(v)}
                style={{ width: 180, marginLeft: 4 }}
                size="small"
              >
                <Select.Option value={1}>官方标准条码</Select.Option>
                <Select.Option value={2}>自定义条码(含分类路径)</Select.Option>
              </Select>
            </span>
            <span style={{ fontSize: 13 }}>
              条码内容：
              <Select
                value={barcodePrintContentType || 1}
                onChange={(v) => setBarcodePrintContentType(v)}
                style={{ width: 150, marginLeft: 4 }}
                size="small"
              >
                <Select.Option value={1}>商家货号</Select.Option>
                <Select.Option value={2}>商家SKU编码</Select.Option>
              </Select>
            </span>
          </Space>
        </div>

        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#666' }}>
            已选择 {selectedOrders.length} 个订单，共 {barcodePrintData.length} 个SKU，
            总打印 {barcodePrintData.reduce((sum, item) => sum + (item.quantity || 1), 0)} 份
            {barcodePrintData.reduce((sum, item) => sum + (item.quantity || 1), 0) > 2000 && (
              <span style={{ color: '#ff4d4f', marginLeft: 8 }}>（超过2000份限制）</span>
            )}
          </span>
          <Button size="small" onClick={() => {
            const newData = barcodePrintData.map(item => ({ ...item, quantity: item.orderQuantity || 1 }));
            setBarcodePrintData(newData);
          }}>重置为下单数量</Button>
        </div>

        {barcodePrintData.length > 0 && (
          <div style={{ maxHeight: 400, overflow: 'auto', border: '1px solid #e8e8e8', borderRadius: 4 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#fafafa', position: 'sticky', top: 0, zIndex: 1 }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>商家货号</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>SKC</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>尺码</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #e8e8e8' }}>下单数</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #e8e8e8' }}>打印份数</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>采购单号</th>
                </tr>
              </thead>
              <tbody>
                {barcodePrintData.map((item, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '8px 12px', fontSize: 12 }}>{item.barcode}</td>
                    <td style={{ padding: '8px 12px', fontSize: 12 }}>{item.skc}</td>
                    <td style={{ padding: '8px 12px', fontSize: 12 }}>{item.size}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12, color: '#999' }}>{item.orderQuantity || '-'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <Input
                        type="number"
                        min={1}
                        max={2000}
                        value={item.quantity}
                        style={{ width: 70, textAlign: 'center' }}
                        size="small"
                        onChange={(e) => {
                          const newData = [...barcodePrintData];
                          newData[index].quantity = Math.max(1, parseInt(e.target.value) || 1);
                          setBarcodePrintData(newData);
                        }}
                      />
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 11, color: '#666' }}>{item.orderNumber}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 16, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
          <div style={{ fontSize: 12, color: '#666' }}>
            <strong>打印说明：</strong>
            <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
              <li>调用SHEIN官方API生成条码PDF，条码格式符合SHEIN仓库要求</li>
              <li>推荐使用"普通订单条码"（type=2），方便做更精细的批次管理</li>
              <li>按SKU维度打印，多个SKU需打多个条码</li>
              <li>单次最多200个SKU，打印总份数不超过2000份</li>
              <li>急采单场景建议使用下单数量作为打印份数</li>
              <li>生成的PDF将在新窗口打开，请使用浏览器打印功能</li>
            </ul>
          </div>
        </div>
      </Modal>

    </div>
  );
}

export default ShippingStation;
