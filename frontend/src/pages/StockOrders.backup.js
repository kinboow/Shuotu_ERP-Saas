import React, { useState, useEffect } from 'react';
import { 
  Table, Tag, Space, Button, Input, Select, message, Card, Statistic, Row, Col, Image,
  Modal, Form, DatePicker, Drawer, Tabs, Spin, Empty, Tooltip, Badge, Descriptions, Progress,
  Dropdown, Checkbox
} from 'antd';
import { 
  SearchOutlined, ReloadOutlined, CheckCircleOutlined, ClockCircleOutlined,
  EditOutlined, DeleteOutlined, EyeOutlined, LinkOutlined, DownloadOutlined,
  PlusOutlined, FileExcelOutlined, CopyOutlined, PrinterOutlined, DownOutlined,
  BarcodeOutlined, FilePdfOutlined
} from '@ant-design/icons';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
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


const { Option } = Select;

// 格式化时间为易读格式 (UTC+8)
const formatTime = (timeStr) => {
  if (!timeStr) return '-';
  try {
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) return timeStr;
    // 使用中国时区格式化
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

// 采购单状态码映射（根据SHEIN API文档）
const STATUS_MAP = {
  1: '待下单',
  2: '已下单',
  3: '发货中',
  4: '已送货',
  5: '已收货',
  6: '已查验',
  7: '已退货',
  8: '已完成',
  9: '无货下架',
  10: '已作废',
  11: '待审核',
  12: '分单中',
  13: '待退货'
};

// 获取状态显示文本（支持数字和中文）
const getStatusText = (status) => {
  if (!status) return '待发货';
  // 如果是数字，转换为中文
  if (typeof status === 'number' || !isNaN(Number(status))) {
    return STATUS_MAP[Number(status)] || `状态${status}`;
  }
  // 如果已经是中文，直接返回
  return status;
};

// 获取状态颜色
const getStatusColor = (status) => {
  const statusText = getStatusText(status);
  const colorMap = {
    '待下单': 'default',
    '已下单': 'orange',
    '待发货': 'orange',
    '发货中': 'processing',
    '已送货': 'cyan',
    '已收货': 'blue',
    '已查验': 'purple',
    '已退货': 'red',
    '已完成': 'green',
    '无货下架': 'default',
    '已作废': 'error',
    '待审核': 'warning',
    '分单中': 'geekblue',
    '待退货': 'volcano'
  };
  return colorMap[statusText] || 'default';
};

function StockOrders() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  
  // 从URL参数获取初始值
  const initialOrderType = searchParams.get('order_type') || '急采';
  const initialPlatform = searchParams.get('platform') || 'shein';
  
  const [filters, setFilters] = useState({ 
    status: '', 
    order_number: '', 
    product_code: '', 
    order_type: initialOrderType, 
    warehouse_group: '',
    platform: initialPlatform, // 平台筛选：shein, temu, tiktok
    shop_id: '', // 店铺筛选
    start_date: undefined,
    end_date: undefined
  });
  const [stats, setStats] = useState({ total: 0, pending: 0, shipped: 0, received: 0 });
  const [shopList, setShopList] = useState([]); // 店铺列表
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editForm] = Form.useForm();
  const [jitModalVisible, setJitModalVisible] = useState(false);
  const [jitLoading, setJitLoading] = useState(false);
  const [jitRelations, setJitRelations] = useState([]);
  const [createOrderModalVisible, setCreateOrderModalVisible] = useState(false);
  const [createOrderForm] = Form.useForm();
  const [createOrderLoading, setCreateOrderLoading] = useState(false);
  
  // 打印相关状态
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [printModalVisible, setPrintModalVisible] = useState(false);
  const [printType, setPrintType] = useState('');
  const [printLoading, setPrintLoading] = useState(false);
  
  // 多订单号搜索弹窗
  const [multiOrderModalVisible, setMultiOrderModalVisible] = useState(false);
  const [multiOrderInput, setMultiOrderInput] = useState('');
  const [barcodePrintData, setBarcodePrintData] = useState([]);

  useEffect(() => {
    // 检查是否有从其他页面跳转过来的参数
    if (location.state) {
      const { orderType, orderNumber } = location.state;
      
      if (orderType || orderNumber) {
        // 设置筛选条件
        setFilters(prev => ({
          ...prev,
          order_type: orderType || prev.order_type,
          order_number: orderNumber || ''
        }));
        
        // 清除location.state，避免刷新时重复应用
        window.history.replaceState({}, document.title);
        
        // 显示提示
        if (orderNumber) {
          message.info(`正在查询备货单号: ${orderNumber}`);
        }
      }
    }
  }, [location]);

  // 处理选项卡切换
  const handleTabChange = (orderType) => {
    setFilters({ ...filters, order_type: orderType });
    // 更新URL参数
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('order_type', orderType);
    navigate(`?${newSearchParams.toString()}`, { replace: true });
  };

  // 处理平台切换
  const handlePlatformChange = (platform) => {
    setFilters({ ...filters, platform: platform, shop_id: '' }); // 切换平台时清空店铺筛选
    // 更新URL参数
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('platform', platform);
    navigate(`?${newSearchParams.toString()}`, { replace: true });
  };

  useEffect(() => {
    fetchOrders();
    fetchStats();
    fetchShopList();
  }, [pagination.current, pagination.pageSize, filters]);

  // 获取店铺列表（从订单数据中提取）
  const fetchShopList = async () => {
    try {
      const params = { platform: filters.platform };
      const response = await fetch(`/api/stock-orders/shops?${new URLSearchParams(params)}`);
      const data = await response.json();
      if (data.success) {
        setShopList(data.data || []);
      }
    } catch (error) {
      console.error('获取店铺列表失败:', error);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        ...filters
      };
      
      // 过滤掉空值
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === undefined || params[key] === null) {
          delete params[key];
        }
      });
      
      const response = await fetch(`/api/stock-orders?${new URLSearchParams(params)}`);
      const data = await response.json();
      
      if (data.success) {
        setOrders(data.data);
        setPagination(prev => ({
          ...prev,
          total: data.total
        }));
      }
    } catch (error) {
      message.error('获取备货订单失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const params = { platform: filters.platform };
      const response = await fetch(`/api/stock-orders/stats?${new URLSearchParams(params)}`);
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('获取统计信息失败:', error);
    }
  };

  const handleTableChange = (newPagination) => {
    setPagination(newPagination);
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchOrders();
  };

  const handleViewDetail = (record) => {
    setSelectedOrder(record);
    setDetailDrawerVisible(true);
  };

  const handleEdit = (record) => {
    setSelectedOrder(record);
    editForm.setFieldsValue({
      status: record.status,
      delivered_quantity: record.delivered_quantity,
      warehouse_quantity: record.warehouse_quantity,
      delivery_number: record.delivery_number,
      actual_warehouse: record.actual_warehouse,
      remarks: record.remarks
    });
    setEditModalVisible(true);
  };

  const handleEditSubmit = async (values) => {
    try {
      const response = await fetch(`/api/stock-orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });

      const data = await response.json();
      if (data.success) {
        message.success('更新成功');
        setEditModalVisible(false);
        fetchOrders();
      } else {
        message.error(data.message);
      }
    } catch (error) {
      message.error('更新失败: ' + error.message);
    }
  };

  const handleDelete = (record) => {
    Modal.confirm({
      title: '删除确认',
      content: `确定要删除订单 ${record.order_number} 吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await fetch(`/api/stock-orders/${record.id}`, {
            method: 'DELETE'
          });

          const data = await response.json();
          if (data.success) {
            message.success('删除成功');
            fetchOrders();
          } else {
            message.error(data.message);
          }
        } catch (error) {
          message.error('删除失败: ' + error.message);
        }
      }
    });
  };

  const handleQueryJitRelations = async (record) => {
    setJitLoading(true);
    try {
      const response = await fetch('/api/stock-orders/jit-relations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: 1,
          orderNos: record.order_number,
          selectJitMother: 1
        })
      });

      const data = await response.json();
      if (data.success) {
        setJitRelations(data.data);
        setJitModalVisible(true);
      } else {
        message.error(data.message);
      }
    } catch (error) {
      message.error('查询失败: ' + error.message);
    } finally {
      setJitLoading(false);
    }
  };

  const handleCreateOrder = async (values) => {
    setCreateOrderLoading(true);
    try {
      // 解析输入的SKU数据
      const lines = values.skuData.trim().split('\n');
      const paramList = [];
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        const parts = line.trim().split(/\s+/);
        if (parts.length < 3) {
          message.error(`格式错误: ${line}`);
          setCreateOrderLoading(false);
          return;
        }
        
        const skc = parts[0];
        const skuCode = parts[1];
        const orderCount = parseInt(parts[2]);
        
        if (isNaN(orderCount) || orderCount <= 0) {
          message.error(`数量错误: ${line}`);
          setCreateOrderLoading(false);
          return;
        }
        
        // 查找是否已有该SKC
        let skcItem = paramList.find(item => item.skc === skc);
        if (!skcItem) {
          skcItem = {
            skc: skc,
            skuCodeList: []
          };
          paramList.push(skcItem);
        }
        
        // 添加SKU
        skcItem.skuCodeList.push({
          skuCode: skuCode,
          orderCount: orderCount
        });
      }
      
      if (paramList.length === 0) {
        message.error('请输入有效的SKU数据');
        setCreateOrderLoading(false);
        return;
      }
      
      console.log('创建备货单参数:', paramList);
      
      const response = await fetch('/api/create-stock-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: 1, // 需要从上下文获取
          paramList: paramList
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        message.success('备货单创建成功！');
        setCreateOrderModalVisible(false);
        createOrderForm.resetFields();
        // 刷新列表
        setTimeout(() => {
          fetchOrders();
        }, 2000);
      } else {
        message.error(data.message || '创建失败');
      }
    } catch (error) {
      message.error('创建失败: ' + error.message);
    } finally {
      setCreateOrderLoading(false);
    }
  };

  // 处理打印菜单点击
  const handlePrintMenuClick = async (type) => {
    if (selectedOrders.length === 0) {
      message.warning('请先选择要打印的订单');
      return;
    }
    
    setPrintType(type);
    
    if (type === 'barcode') {
      // 打印条码
      await prepareBarcodeData();
      setPrintModalVisible(true);
    } else if (type === 'pickList') {
      // 打印拣货单
      await generatePickListPDF();
    } else if (type === 'washLabel') {
      message.info('打印洗水标功能开发中...');
    } else if (type === 'complianceLabel') {
      message.info('打印合规标（环保标）功能开发中...');
    } else if (type === 'pdaBarcode') {
      message.info('PDA打印条码功能开发中...');
    } else if (type === 'waybill') {
      message.info('打印面单功能开发中...');
    } else if (type === 'craftSheet') {
      message.info('打印工艺单功能开发中...');
    }
  };

  // 生成拣货单PDF（使用pdfmake，文本可选择）
  const generatePickListPDF = async () => {
    setPrintLoading(true);
    message.loading('正在生成拣货单PDF...', 0);
    
    try {
      // 使用中文字体
      const useChineseFont = 'ChineseFont';
      
      // 图片转base64的辅助函数
      const imageToBase64 = async (url) => {
        if (!url) return null;
        try {
          const response = await fetch(url, { mode: 'cors' });
          const blob = await response.blob();
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          console.warn('图片加载失败:', url, e);
          return null;
        }
      };
      


      // 收集所有SKU数据，按订单+SKC分组
      const groupedItems = new Map();
      
      selectedOrders.forEach(order => {
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
                addTime: order.add_time || order.allocate_time || '',
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
          `下单时间: ${addTimeStr}`
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

  // 准备条码打印数据
  const prepareBarcodeData = async () => {
    setPrintLoading(true);
    try {
      // 收集所有选中订单的SKU条码
      const barcodeList = [];
      
      selectedOrders.forEach(order => {
        if (order.items && order.items.length > 0) {
          order.items.forEach(item => {
            // 使用supplier_code作为条码，sku_code作为sheinSku
            if (item.supplier_code || item.sku_code) {
              barcodeList.push({
                barcode: item.supplier_code || '',
                skc: item.skc || '',
                skuCode: item.sku_code || '',
                sheinSku: item.sku_code || '', // SHEIN SKU编码
                supplierSku: item.supplier_sku || '', // 卖家SKU编码
                size: item.suffix_zh || item.sku_attribute || '',
                quantity: item.order_quantity || 1,
                orderNumber: order.order_number || order.order_no,
                shopId: order.shop_id // 店铺ID
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
    } catch (error) {
      message.error('准备打印数据失败: ' + error.message);
    } finally {
      setPrintLoading(false);
    }
  };

  // 执行SHEIN官方条码打印（调用SHEIN API获取条码PDF）
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
        printNumber: item.quantity
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
        data: printData
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
        setSelectedOrders([]);
      } else {
        message.error(response.data.message || '获取条码失败');
      }
    } catch (error) {
      message.error('打印条码失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setPrintLoading(false);
    }
  };

  // 执行条码打印
  const handlePrintBarcode = async () => {
    await handleSheinPrint();
  };

  // 打印下拉菜单项
  const printMenuItems = [
    { key: 'barcode', label: '打印条码' },
    { key: 'pickList', label: '打印拣货单' },
    { key: 'washLabel', label: '打印洗水标' },
    { key: 'complianceLabel', label: '打印合规标（环保标）' },
    { type: 'divider' },
    { key: 'waybill', label: '打印面单' },
    { key: 'craftSheet', label: '打印工艺单' }
  ];

  const columns = [
    {
      title: '店铺',
      dataIndex: 'shop_name',
      key: 'shop_name',
      width: 150,
      fixed: 'left',
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{text || '-'}</div>
          {record.platform_display_name && (
            <Tag color="blue" style={{ fontSize: 11 }}>
              {record.platform_display_name}
            </Tag>
          )}
        </div>
      )
    },
    {
      title: '备货单号',
      dataIndex: 'order_number',
      key: 'order_number',
      width: 150,
      fixed: 'left',
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{text}</div>
          {record.parent_order_number && (
            <div style={{ fontSize: 12, color: '#999' }}>
              母单: {record.parent_order_number}
            </div>
          )}
          <Space size={4} wrap style={{ marginTop: 4 }}>
            {record.order_type && <Tag color="blue">{record.order_type}</Tag>}
            {record.warehouse_group && <Tag>{record.warehouse_group}</Tag>}
          </Space>
        </div>
      )
    },
    {
      title: '商品信息',
      dataIndex: 'product_name',
      key: 'product_name',
      width: 300,
      render: (text, record) => (
        <div style={{ display: 'flex', gap: 10 }}>
          {record.product_image && (
            <Image
              width={60}
              height={60}
              src={record.product_image}
              style={{ objectFit: 'cover', borderRadius: 4 }}
            />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 4 }}>{text}</div>
            {record.skc && <div style={{ fontSize: 12, color: '#666' }}>SKC: {record.skc}</div>}
            {record.product_code && <div style={{ fontSize: 12, color: '#666' }}>货号: {record.product_code}</div>}
            <Space size={4} wrap style={{ marginTop: 4 }}>
              {record.is_hot_sale && <Tag color="red">🔥 热销款</Tag>}
              {record.is_return && <Tag color="orange">返</Tag>}
              {record.is_domestic && <Tag color="green">国内备货</Tag>}
              {record.is_vmi && <Tag color="purple">VMI</Tag>}
            </Space>
          </div>
        </div>
      )
    },
    {
      title: 'SKU信息',
      dataIndex: 'sku_attribute',
      key: 'sku_attribute',
      width: 200,
      render: (text, record) => (
        <div>
          <div style={{ marginBottom: 4 }}>{text}</div>
          {record.sku_id && <div style={{ fontSize: 12, color: '#666' }}>ID: {record.sku_id}</div>}
          {record.sku_code && <div style={{ fontSize: 12, color: '#666' }}>货号: {record.sku_code}</div>}
        </div>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => {
        const statusConfig = {
          '待下单': { color: 'default', text: '待下单' },
          '待发货': { color: 'orange', text: '待发货' },
          '发货中': { color: 'processing', text: '发货中' },
          '已送货': { color: 'cyan', text: '已送货' },
          '已收货': { color: 'blue', text: '已收货' },
          '已查验': { color: 'purple', text: '已查验' },
          '已退货': { color: 'red', text: '已退货' },
          '已完成': { color: 'success', text: '已完成' },
          '无货下架': { color: 'default', text: '无货下架' },
          '已作废': { color: 'error', text: '已作废' },
          '待审核': { color: 'warning', text: '待审核' },
          '分单中': { color: 'geekblue', text: '分单中' },
          '待退货': { color: 'volcano', text: '待退货' },
          // 兼容旧状态
          '待创建': { color: 'default', text: '待创建' },
          '已创建': { color: 'orange', text: '待发货' },
          '已发货': { color: 'cyan', text: '已送货' },
          '已取消': { color: 'red', text: '已作废' }
        };
        
        const config = statusConfig[status] || { color: 'default', text: status };
        return <Tag color={config.color}>{config.text}</Tag>;
      }
    },
    {
      title: '申报价格',
      dataIndex: 'declared_price',
      key: 'declared_price',
      width: 100,
      align: 'right',
      render: (price) => {
        if (!price) return '-';
        const numPrice = typeof price === 'string' ? parseFloat(price) : price;
        return isNaN(numPrice) ? '-' : `¥${numPrice.toFixed(2)}`;
      }
    },
    {
      title: '备货件数',
      dataIndex: 'stock_quantity',
      key: 'stock_quantity',
      width: 100,
      align: 'right'
    },
    {
      title: '送货/入库',
      key: 'delivery',
      width: 100,
      align: 'right',
      render: (_, record) => `${record.delivered_quantity || 0}/${record.warehouse_quantity || 0}`
    },
    {
      title: '创建时间',
      dataIndex: 'created_time',
      key: 'created_time',
      width: 160,
      render: (time) => formatTime(time)
    },
    {
      title: '发货截止',
      dataIndex: 'ship_deadline',
      key: 'ship_deadline',
      width: 160,
      render: (deadline, record) => (
        <div>
          {formatTime(deadline)}
          {record.can_ship_today && (
            <Tag color="success" style={{ marginTop: 4 }}>今日可发货</Tag>
          )}
        </div>
      )
    },
    {
      title: '入库截止',
      dataIndex: 'arrival_deadline',
      key: 'arrival_deadline',
      width: 160,
      render: (time) => formatTime(time)
    },
    {
      title: '发货时间',
      dataIndex: 'ship_time',
      key: 'ship_time',
      width: 160,
      render: (time) => formatTime(time)
    },
    {
      title: '快递单号',
      dataIndex: 'delivery_number',
      key: 'delivery_number',
      width: 150,
      render: (text) => text || '-'
    },
    {
      title: '交接时间',
      dataIndex: 'handover_time',
      key: 'handover_time',
      width: 160,
      render: (time) => formatTime(time)
    },
    {
      title: '收货时间',
      dataIndex: 'receive_time',
      key: 'receive_time',
      width: 160,
      render: (time) => formatTime(time)
    },
    {
      title: '实际仓库',
      dataIndex: 'actual_warehouse',
      key: 'actual_warehouse',
      width: 120,
      render: (text) => text || '-'
    },
    {
      title: '退货时间',
      dataIndex: 'return_time',
      key: 'return_time',
      width: 160,
      render: (time) => formatTime(time)
    },
    {
      title: '库存水位',
      dataIndex: 'stock_water_level',
      key: 'stock_water_level',
      width: 100,
      render: (text) => text || '-'
    },
    {
      title: '进度状态',
      dataIndex: 'progress_status',
      key: 'progress_status',
      width: 200,
      render: (text) => text || '-'
    },
    {
      title: '预计发货日期',
      dataIndex: 'estimated_ship_date',
      key: 'estimated_ship_date',
      width: 160,
      render: (time) => formatTime(time)
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      key: 'remarks',
      width: 200,
      render: (text) => text || '-'
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 160,
      render: (time) => formatTime(time)
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* 订单类型选项卡 */}
      <div style={{ 
        marginBottom: 16, 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '2px solid #f0f0f0',
        paddingBottom: 12
      }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div
            onClick={() => handleTabChange('急采')}
            style={{
              padding: '8px 16px',
              cursor: 'pointer',
              borderBottom: filters.order_type === '急采' ? '3px solid #1890ff' : 'none',
              color: filters.order_type === '急采' ? '#1890ff' : '#666',
              fontWeight: filters.order_type === '急采' ? 'bold' : 'normal',
              fontSize: 14,
              transition: 'all 0.3s'
            }}
          >
            急采单
          </div>
          <div
            onClick={() => handleTabChange('备货')}
            style={{
              padding: '8px 16px',
              cursor: 'pointer',
              borderBottom: filters.order_type === '备货' ? '3px solid #1890ff' : 'none',
              color: filters.order_type === '备货' ? '#1890ff' : '#666',
              fontWeight: filters.order_type === '备货' ? 'bold' : 'normal',
              fontSize: 14,
              transition: 'all 0.3s'
            }}
          >
            备货单
          </div>
        </div>
        
        {/* 创建备货单按钮 - 仅在备货单选项卡显示 */}
        {filters.order_type === '备货' && (
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => {
              createOrderForm.resetFields();
              setCreateOrderModalVisible(true);
            }}
          >
            创建备货单
          </Button>
        )}
      </div>

      {/* 筛选模块 */}
      <Card style={{ marginBottom: 16 }}>
        {/* 平台筛选行 - SVG图标 */}
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: '#666' }}>平台：</span>
          {/* SHEIN */}
          <div
            onClick={() => handlePlatformChange('shein')}
            style={{
              width: 88,
              height: 35,
              cursor: 'pointer',
              borderRadius: 4,
              border: filters.platform === 'shein' ? '2px solid #1890ff' : '1px solid #d9d9d9',
              backgroundColor: filters.platform === 'shein' ? '#e6f7ff' : '#fff',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg viewBox="0 0 4005 1024" width="65" height="17">
              <path d="M768 722.823529c0 67.764706-15.058824 128-52.705882 173.176471-37.647059 45.176471-82.823529 82.823529-135.529412 97.882353-52.705882 22.588235-112.941176 30.117647-180.705882 30.117647-90.352941 0-173.176471-22.588235-248.470589-67.764706s-120.470588-105.411765-150.588235-180.705882L158.117647 685.176471c22.588235 52.705882 52.705882 90.352941 97.882353 120.470588s90.352941 45.176471 150.588235 45.17647c45.176471 0 82.823529-7.529412 112.941177-30.117647 30.117647-22.588235 37.647059-45.176471 37.647059-82.823529 0-30.117647-7.529412-52.705882-30.117647-75.294118-7.529412-15.058824-30.117647-30.117647-60.235295-45.17647s-67.764706-22.588235-112.941176-37.647059c-60.235294-15.058824-112.941176-37.647059-158.117647-52.705882s-75.294118-45.176471-105.411765-82.82353-37.647059-90.352941-37.647059-150.588235c0-67.764706 15.058824-120.470588 52.705883-165.647059s75.294118-75.294118 135.529411-97.882353S346.352941 0 414.117647 0c90.352941 0 165.647059 22.588235 225.882353 60.235294 60.235294 37.647059 97.882353 90.352941 120.470588 158.117647L602.352941 308.705882c-15.058824-45.176471-37.647059-75.294118-75.294117-97.882353-30.117647-22.588235-75.294118-37.647059-120.470589-37.647058-45.176471 0-82.823529 7.529412-105.411764 30.117647-30.117647 22.588235-45.176471 52.705882-45.176471 82.823529 0 22.588235 7.529412 45.176471 22.588235 60.235294 15.058824 15.058824 37.647059 30.117647 67.764706 37.647059 30.117647 7.529412 60.235294 22.588235 105.411765 37.647059 67.764706 22.588235 120.470588 37.647059 158.117647 60.235294 45.176471 22.588235 75.294118 45.176471 105.411765 90.352941s52.705882 90.352941 52.705882 150.588235z m331.294118-316.235294h444.235294V15.058824H1739.294118v993.882352h-195.764706V579.764706h-444.235294v429.17647h-195.764706V15.058824h195.764706v391.529411z m1453.17647 180.705883h-399.058823v248.470588h466.823529v173.17647h-662.588235V15.058824h647.529412v173.17647h-451.764706v233.411765h399.058823v165.647059z m421.647059 421.647058h-195.764706V15.058824h195.764706v993.882352zM3343.058824 15.058824l481.882352 655.058823V15.058824h180.705883v993.882352H3847.529412l-481.882353-655.058823v655.058823h-180.705883V15.058824h158.117648z" fill="#197afa"></path>
            </svg>
          </div>
          {/* TEMU */}
          <div
            onClick={() => handlePlatformChange('temu')}
            style={{
              width: 88,
              height: 35,
              cursor: 'pointer',
              borderRadius: 4,
              border: filters.platform === 'temu' ? '2px solid #1890ff' : '1px solid #d9d9d9',
              backgroundColor: filters.platform === 'temu' ? '#e6f7ff' : '#fff',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 2
            }}
          >
            <svg t="1764674611193" className="icon" viewBox="0 0 3876 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="70" height="18">
              <path d="M2088.448 20.114286c25.965714 0 49.883429 12.214857 64.512 33.353143l234.934857 352.036571L2622.098286 53.394286c14.848-20.918857 38.912-33.353143 64.512-33.28h66.56a106.788571 106.788571 0 0 1 107.081143 107.081143v736.182857a106.861714 106.861714 0 0 1-107.081143 107.52 107.52 107.52 0 0 1-107.52-107.52V380.123429l-181.101715 255.268571a94.646857 94.646857 0 0 1-154.038857 0l-180.955428-255.268571v483.254857a107.52 107.52 0 0 1-214.747429 0V127.268571A106.788571 106.788571 0 0 1 2021.888 20.114286h66.56z m1664.073143 0a106.788571 106.788571 0 0 1 107.081143 107.081143v441.782857c0.438857 269.897143-165.961143 401.993143-428.178286 401.993143s-422.619429-133.558857-422.619429-395.702858V127.341714A106.788571 106.788571 0 0 1 3115.885714 20.187429a106.934857 106.934857 0 0 1 107.666286 107.154285v442.953143c-0.438857 144.896 79.286857 219.794286 210.285714 219.794286 131.072 0.438857 210.797714-72.045714 210.797715-213.284572V127.195429c0-59.099429 48.493714-107.081143 107.666285-107.081143h0.219429z m-3017.362286 0a106.861714 106.861714 0 0 1 107.52 107.081143 107.52 107.52 0 0 1-107.52 107.666285H528.530286v627.565715c0 59.611429-48.347429 107.593143-107.52 107.593142A107.52 107.52 0 0 1 313.782857 862.354286V234.788571H107.373714a107.52 107.52 0 0 1-107.52-107.52A107.52 107.52 0 0 1 107.373714 20.041143h627.785143z m928.694857 0a106.788571 106.788571 0 0 1 107.154286 107.081143 106.861714 106.861714 0 0 1-107.154286 107.666285h-474.404571v152.576h412.818286c59.684571 0 107.666286 48.347429 107.666285 107.52a107.52 107.52 0 0 1-107.666285 107.154286h-412.745143v152.722286h474.477714c59.245714 0 107.081143 48.347429 107.081143 107.52a106.788571 106.788571 0 0 1-107.081143 107.666285H1082.514286a107.52 107.52 0 0 1-107.593143-107.666285V127.268571a107.52 107.52 0 0 1 107.52-107.154285h581.485714z" fill="#FB7701"></path>
            </svg>
          </div>
          {/* TIKTOK */}
          <div
            onClick={() => handlePlatformChange('tiktok')}
            style={{
              width: 88,
              height: 35,
              cursor: 'pointer',
              borderRadius: 4,
              border: filters.platform === 'tiktok' ? '2px solid #1890ff' : '1px solid #d9d9d9',
              backgroundColor: filters.platform === 'tiktok' ? '#e6f7ff' : '#fff',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              paddingRight: 6
            }}
          >
            <svg viewBox="0 0 800 360" width="110" height="32">
              <g>
                <text fontWeight="bold" xmlSpace="preserve" textAnchor="start" fontFamily="'Catamaran'" fontSize="231" y="258" x="15" strokeWidth="0" stroke="#000" fill="#00f2ea">TIKTOK</text>
                <text fontWeight="bold" xmlSpace="preserve" textAnchor="start" fontFamily="'Catamaran'" fontSize="231" y="273" x="13" strokeWidth="0" stroke="#000" fill="#ff004f">TIKTOK</text>
                <text fontWeight="bold" xmlSpace="preserve" textAnchor="start" fontFamily="'Catamaran'" fontSize="231" y="267" x="15" strokeWidth="0" stroke="#000" fill="#000000">TIKTOK</text>
              </g>
            </svg>
          </div>
        </div>
        
        {/* 搜索和筛选行 */}
        <Space size="middle" wrap>
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
          <Select
            placeholder="订单状态"
            value={filters.status || undefined}
            onChange={(value) => setFilters({ ...filters, status: value || '' })}
            style={{ width: 120 }}
            allowClear
          >
            <Option value="待发货">待发货</Option>
            <Option value="发货中">发货中</Option>
            <Option value="已送货">已送货</Option>
            <Option value="已收货">已收货</Option>
            <Option value="已完成">已完成</Option>
            <Option value="已退货">已退货</Option>
            <Option value="已作废">已作废</Option>
          </Select>
          <Input
            placeholder="采购单号"
            suffix={
              <Tooltip title="批量搜索">
                <PlusOutlined 
                  style={{ color: '#1890ff', cursor: 'pointer' }} 
                  onClick={(e) => {
                    e.stopPropagation();
                    setMultiOrderInput(filters.order_number);
                    setMultiOrderModalVisible(true);
                  }}
                />
              </Tooltip>
            }
            value={filters.order_number}
            onChange={(e) => setFilters({ ...filters, order_number: e.target.value })}
            onPressEnter={handleSearch}
            style={{ width: 200 }}
            allowClear
          />
          <Input
            placeholder="货号"
            value={filters.product_code}
            onChange={(e) => setFilters({ ...filters, product_code: e.target.value })}
            onPressEnter={handleSearch}
            style={{ width: 150 }}
            allowClear
          />

          <DatePicker.RangePicker
            placeholder={['下单开始', '下单结束']}
            style={{ width: 280 }}
            onChange={(dates) => {
              if (dates) {
                setFilters({
                  ...filters,
                  start_date: dates[0]?.format('YYYY-MM-DD'),
                  end_date: dates[1]?.format('YYYY-MM-DD')
                });
              } else {
                setFilters({
                  ...filters,
                  start_date: undefined,
                  end_date: undefined
                });
              }
            }}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchOrders}>
            刷新
          </Button>
        </Space>
        
        {/* 操作按钮行 */}
        <div style={{ marginTop: 12 }}>
          <Space size="middle">
            <Dropdown
              menu={{
                items: printMenuItems,
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
              disabled={selectedOrders.length === 0}
              onClick={() => {
                message.info('加入发货台功能开发中...');
              }}
            >
              加入发货台
            </Button>
            <Button 
              type="primary"
              ghost
              disabled={selectedOrders.length === 0}
              onClick={() => {
                message.info('作废申请功能开发中...');
              }}
            >
              作废申请
            </Button>
            <Button 
              type="default" 
              icon={<FileExcelOutlined />}
            >
              导出
            </Button>
          </Space>
        </div>
      </Card>

      <Card>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
          </div>
        ) : orders.length === 0 ? (
          <Empty description="暂无采购单数据" />
        ) : (
          <div style={{ border: '1px solid #e8e8e8', borderRadius: '4px', overflow: 'hidden' }}>
            {/* 表头（含全选复选框） */}
            <div style={{ 
              display: 'flex', 
              backgroundColor: '#fafafa', 
              borderBottom: '1px solid #e8e8e8',
              padding: '10px 0',
              fontSize: 13,
              color: '#666',
              fontWeight: 500,
              alignItems: 'center'
            }}>
              <div style={{ width: 40, textAlign: 'center' }}>
                <Checkbox
                  checked={selectedOrders.length === orders.length && orders.length > 0}
                  indeterminate={selectedOrders.length > 0 && selectedOrders.length < orders.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedOrders([...orders]);
                    } else {
                      setSelectedOrders([]);
                    }
                  }}
                />
              </div>
              <div style={{ width: 200, paddingLeft: 8 }}>
                备货单号
                {selectedOrders.length > 0 && (
                  <span style={{ color: '#1890ff', marginLeft: 8, fontWeight: 'normal', fontSize: 12 }}>
                    (已选{selectedOrders.length}个)
                  </span>
                )}
              </div>
              <div style={{ width: 280 }}>商品信息</div>
              <div style={{ width: 290 }}>SKU信息</div>
              <div style={{ width: 100, textAlign: 'center' }}>出厂价格(CNY)</div>
              <div style={{ width: 80, textAlign: 'center' }}>备货件数</div>
              <div style={{ width: 80, textAlign: 'center' }}>送货/入库数</div>
              <div style={{ width: 140, textAlign: 'center' }}>创建时间</div>
              <div style={{ width: 120, textAlign: 'center' }}>下单金额</div>
              <div style={{ flex: 1, textAlign: 'center' }}>操作</div>
            </div>

            {orders.map(order => {
              // 按SKC分组
              const groupedBySKC = {};
              if (order.items && order.items.length > 0) {
                order.items.forEach(item => {
                  const skc = item.skc || 'unknown';
                  if (!groupedBySKC[skc]) {
                    groupedBySKC[skc] = {
                      skc,
                      image: item.product_image || item.sku_image,
                      supplierCode: item.supplier_code,
                      skus: []
                    };
                  }
                  groupedBySKC[skc].skus.push(item);
                });
              }
              
              const skcGroups = Object.values(groupedBySKC);
              const totalSkus = order.items?.length || 0;
              const totalQuantity = order.items?.reduce((sum, item) => sum + (item.order_quantity || 0), 0) || 0;
              const totalAmount = order.items?.reduce((sum, item) => sum + (parseFloat(item.price || 0) * (item.order_quantity || 0)), 0) || 0;
              
              return (
                <div
                  key={order.order_number}
                  style={{ 
                    borderBottom: '1px solid #e8e8e8',
                    backgroundColor: selectedOrders.some(o => o.order_number === order.order_number) ? '#f0f7ff' : '#fff'
                  }}
                >
                  {/* 按SKC分组显示 */}
                  {skcGroups.map((skcGroup, skcIdx) => (
                    <div key={skcIdx} style={{ display: 'flex', borderBottom: skcIdx < skcGroups.length - 1 ? '1px dashed #e8e8e8' : 'none' }}>
                      {/* 复选框列（仅第一个SKC显示） */}
                      {skcIdx === 0 && (
                        <div style={{ 
                          width: 40, 
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRight: '1px solid #f0f0f0'
                        }}>
                          <Checkbox
                            checked={selectedOrders.some(o => o.order_number === order.order_number)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedOrders([...selectedOrders, order]);
                              } else {
                                setSelectedOrders(selectedOrders.filter(o => o.order_number !== order.order_number));
                              }
                            }}
                          />
                        </div>
                      )}
                      {skcIdx > 0 && <div style={{ width: 40 }}></div>}

                      {/* 左侧：备货单号（仅第一个SKC显示） */}
                      {skcIdx === 0 && (
                        <div style={{ 
                          width: 200, 
                          padding: '12px 8px',
                          borderRight: '1px solid #f0f0f0',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'flex-start'
                        }}>
                          <div style={{ marginBottom: 8 }}>
                            <span style={{ fontWeight: 500, color: '#1890ff', fontSize: 13 }}>{order.order_number}</span>
                          </div>
                          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                            {order.shop_name || '系统创建'}
                          </div>
                          <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
                            {order.warehouse_name || '广东仓B1'}
                          </div>
                          
                          {/* 时间线 */}
                          <div style={{ fontSize: 11, color: '#666' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 6 }}>
                              <span style={{ color: '#fa8c16', marginRight: 4 }}>●</span>
                              <div>
                                <div>{formatTime(order.add_time || order.allocate_time)?.split(' ')[0]}</div>
                                <div style={{ color: '#999' }}>{formatTime(order.add_time || order.allocate_time)?.split(' ')[1]}</div>
                                <Tag color={getStatusColor(order.status)} style={{ fontSize: 10, marginTop: 2 }}>{getStatusText(order.status)}</Tag>
                              </div>
                            </div>
                            {order.request_delivery_time && (
                              <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 6 }}>
                                <span style={{ color: '#999', marginRight: 4 }}>○</span>
                                <div>
                                  <div>{formatTime(order.request_delivery_time)?.split(' ')[0]}</div>
                                  <div style={{ color: '#999' }}>{formatTime(order.request_delivery_time)?.split(' ')[1]}</div>
                                  <span style={{ color: '#ff4d4f', fontSize: 10 }}>要求取件</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {skcIdx > 0 && <div style={{ width: 200 }}></div>}

                      {/* 商品信息 - 仅第一个SKU显示 */}
                      {skcIdx === 0 && (
                        <div style={{ 
                          width: 280, 
                          padding: '12px 8px',
                          borderRight: '1px solid #e8e8e8',
                          display: 'flex',
                          gap: 8,
                          rowSpan: skcGroup.skus.length
                        }}>
                          {skcGroup.image ? (
                            <Image
                              width={70}
                              height={70}
                              src={skcGroup.image}
                              style={{ objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                            />
                          ) : (
                            <div style={{ 
                              width: 70, 
                              height: 70, 
                              backgroundColor: '#f5f5f5',
                              borderRadius: 4,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#999',
                              fontSize: 11,
                              flexShrink: 0
                            }}>
                              无图
                            </div>
                          )}
                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{ fontSize: 12, color: '#333', marginBottom: 4, fontWeight: 500 }}>
                              {skcGroup.skc}
                            </div>
                            <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>
                              平台SKU: {skcGroup.supplierCode || '-'}
                            </div>
                            <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>
                              商家SKU
                            </div>
                            <div style={{ fontSize: 11, color: '#ff4d4f', fontWeight: 500 }}>
                              单价 CNY {parseFloat(skcGroup.skus[0]?.price || 0).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      )}
                      {skcIdx > 0 && <div style={{ width: 280 }}></div>}

                      {/* SKU信息列表 */}
                      <div style={{ width: 290, display: 'flex', flexDirection: 'column', borderRight: '1px solid #e8e8e8' }}>
                        {skcGroup.skus.map((sku, skuIdx) => (
                          <div 
                            key={skuIdx} 
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center',
                              padding: '8px 0',
                              borderBottom: skuIdx < skcGroup.skus.length - 1 ? '1px dotted #f0f0f0' : 'none'
                            }}
                          >
                            {/* SKU图片 */}
                            <div style={{ width: 60, padding: '0 4px', flexShrink: 0 }}>
                              {(sku.sku_img || sku.sku_image || sku.img_path || sku.product_image || skcGroup.image) ? (
                                <Image
                                  width={52}
                                  height={52}
                                  src={sku.sku_img || sku.sku_image || sku.img_path || sku.product_image || skcGroup.image}
                                  style={{ objectFit: 'cover', borderRadius: 4 }}
                                />
                              ) : (
                                <div style={{ 
                                  width: 52, 
                                  height: 52, 
                                  backgroundColor: '#f5f5f5',
                                  borderRadius: 4,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#999',
                                  fontSize: 10
                                }}>
                                  无图
                                </div>
                              )}
                            </div>

                            {/* SKU属性 */}
                            <div style={{ width: 230, padding: '0 8px', overflow: 'hidden' }}>
                              <div style={{ fontSize: 12, color: '#333', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {sku.suffix_zh || sku.sku_attribute || '-'}
                              </div>
                              <div style={{ fontSize: 11, color: '#999', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                平台SKU {sku.sku_code || '-'}
                              </div>
                              <div style={{ fontSize: 11, color: '#999', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                商家SKU
                              </div>
                            </div>

                            {/* 价格 */}
                            <div style={{ width: 100, textAlign: 'center', borderRight: '1px solid #f0f0f0' }}>
                              <span style={{ color: '#ff4d4f', fontWeight: 500 }}>¥{parseFloat(sku.price || 0).toFixed(2)}</span>
                            </div>

                            {/* 备货件数 */}
                            <div style={{ width: 80, textAlign: 'center', fontWeight: 500, borderRight: '1px solid #f0f0f0' }}>
                              {sku.order_quantity || 0}
                            </div>

                            {/* 送货/入库数 */}
                            <div style={{ width: 80, textAlign: 'center', fontSize: 12, color: '#666', borderRight: '1px solid #f0f0f0' }}>
                              {sku.delivery_quantity || '-'} / {sku.storage_quantity || '-'}
                            </div>

                            {/* 创建时间（仅第一个SKU显示） */}
                            <div style={{ width: 140, textAlign: 'center', fontSize: 11, color: '#666', borderRight: '1px solid #f0f0f0' }}>
                              {skuIdx === 0 ? formatTime(order.add_time || order.created_at)?.replace(' ', '\n') : ''}
                            </div>

                            {/* 下单金额 */}
                            <div style={{ width: 120, textAlign: 'center', fontWeight: 500, color: '#ff4d4f', borderRight: '1px solid #f0f0f0' }}>
                              ¥{(parseFloat(sku.price || 0) * (sku.order_quantity || 0)).toFixed(2)}
                            </div>

                            {/* 操作按钮（仅第一个SKU显示） */}
                            <div style={{ flex: 1, textAlign: 'center', padding: '0 8px' }}>
                              {skuIdx === 0 && (
                                <Space size={4} wrap>
                                  <Button type="link" size="small" style={{ fontSize: 11, padding: 0 }}>创建发货单</Button>
                                  <Button type="link" size="small" style={{ fontSize: 11, padding: 0 }}>修改数量</Button>
                                  <Button type="link" size="small" style={{ fontSize: 11, padding: 0 }}>加入发货台</Button>
                                  <Button type="link" size="small" style={{ fontSize: 11, padding: 0, color: '#999' }}>打印商品条码</Button>
                                </Space>
                              )}
                            </div>
                          </div>
                        ))}
                        
                        {/* SKC合计行 */}
                        {skcGroup.skus.length > 1 && (
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center',
                            padding: '6px 0',
                            backgroundColor: '#fafafa',
                            fontSize: 12
                          }}>
                            <div style={{ width: 200, padding: '0 8px', fontWeight: 500 }}>合计</div>
                            <div style={{ width: 280 }}></div>
                            <div style={{ width: 290 }}></div>
                            <div style={{ width: 100, textAlign: 'center' }}>-</div>
                            <div style={{ width: 80, textAlign: 'center', fontWeight: 500 }}>
                              {skcGroup.skus.reduce((sum, s) => sum + (s.order_quantity || 0), 0)}
                            </div>
                            <div style={{ width: 80, textAlign: 'center' }}>-</div>
                            <div style={{ width: 140, textAlign: 'center' }}>-</div>
                            <div style={{ width: 120, textAlign: 'center', fontWeight: 500, color: '#ff4d4f' }}>
                              ¥{skcGroup.skus.reduce((sum, s) => sum + (parseFloat(s.price || 0) * (s.order_quantity || 0)), 0).toFixed(2)}
                            </div>
                            <div style={{ flex: 1 }}></div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {/* 订单合计行（多SKC时显示） */}
                  {skcGroups.length > 1 && (
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      padding: '8px 16px',
                      backgroundColor: '#f5f5f5',
                      borderTop: '1px solid #e8e8e8',
                      fontSize: 12
                    }}>
                      <div style={{ width: 40 }}></div>
                      <div style={{ width: 200 }}></div>
                      <div style={{ width: 280 }}></div>
                      <div style={{ width: 250, fontWeight: 500 }}>订单合计</div>
                      <div style={{ width: 100, textAlign: 'center' }}>-</div>
                      <div style={{ width: 80, textAlign: 'center', fontWeight: 500 }}>
                        {totalQuantity}
                      </div>
                      <div style={{ width: 80, textAlign: 'center' }}>-</div>
                      <div style={{ width: 140, textAlign: 'center' }}>-</div>
                      <div style={{ width: 120, textAlign: 'center', fontWeight: 500, color: '#ff4d4f' }}>
                        ¥{totalAmount.toFixed(2)}
                      </div>
                      <div style={{ flex: 1 }}></div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* 分页 */}
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Space>
                <span style={{ fontSize: 14, color: '#666' }}>
                  共 {pagination.total} 条
                </span>
                <Button
                  disabled={pagination.current === 1}
                  onClick={() => setPagination({ ...pagination, current: pagination.current - 1 })}
                >
                  上一页
                </Button>
                <span style={{ fontSize: 14 }}>
                  {pagination.current} / {Math.ceil(pagination.total / pagination.pageSize)}
                </span>
                <Button
                  disabled={pagination.current >= Math.ceil(pagination.total / pagination.pageSize)}
                  onClick={() => setPagination({ ...pagination, current: pagination.current + 1 })}
                >
                  下一页
                </Button>
              </Space>
            </div>
          </div>
        )}
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
            <Descriptions.Item label="备货单号">{selectedOrder.order_number}</Descriptions.Item>
            <Descriptions.Item label="母单号">{selectedOrder.parent_order_number || '-'}</Descriptions.Item>
            <Descriptions.Item label="商品名称">{selectedOrder.product_name}</Descriptions.Item>
            <Descriptions.Item label="SKC">{selectedOrder.skc}</Descriptions.Item>
            <Descriptions.Item label="货号">{selectedOrder.product_code}</Descriptions.Item>
            <Descriptions.Item label="SKU属性">{selectedOrder.sku_attribute}</Descriptions.Item>
            <Descriptions.Item label="申报价格">¥{selectedOrder.declared_price ? Number(selectedOrder.declared_price).toFixed(2) : '0.00'}</Descriptions.Item>
            <Descriptions.Item label="备货件数">{selectedOrder.stock_quantity}</Descriptions.Item>
            <Descriptions.Item label="送货件数">{selectedOrder.delivered_quantity || 0}</Descriptions.Item>
            <Descriptions.Item label="入库件数">{selectedOrder.warehouse_quantity || 0}</Descriptions.Item>
            <Descriptions.Item label="状态">{getStatusText(selectedOrder.status)}</Descriptions.Item>
            <Descriptions.Item label="仓库分组">{selectedOrder.warehouse_group || '-'}</Descriptions.Item>
            <Descriptions.Item label="订单类型">{selectedOrder.order_type || '-'}</Descriptions.Item>
            <Descriptions.Item label="发货截止">{formatTime(selectedOrder.ship_deadline)}</Descriptions.Item>
            <Descriptions.Item label="入库截止">{formatTime(selectedOrder.arrival_deadline)}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{formatTime(selectedOrder.created_time)}</Descriptions.Item>
            <Descriptions.Item label="备注">{selectedOrder.remarks || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      {/* 编辑模态框 */}
      <Modal
        title="编辑备货订单"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={() => editForm.submit()}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleEditSubmit}
        >
          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select>
              <Option value="待创建">待创建</Option>
              <Option value="已创建">已创建</Option>
              <Option value="已发货">已发货</Option>
              <Option value="已收货">已收货</Option>
              <Option value="已取消">已取消</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="delivered_quantity"
            label="送货件数"
          >
            <Input type="number" />
          </Form.Item>
          <Form.Item
            name="warehouse_quantity"
            label="入库件数"
          >
            <Input type="number" />
          </Form.Item>
          <Form.Item
            name="delivery_number"
            label="快递单号"
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="actual_warehouse"
            label="实际仓库"
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="remarks"
            label="备注"
          >
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* JIT关系模态框 */}
      <Modal
        title="JIT母单及子单对应关系"
        open={jitModalVisible}
        onCancel={() => setJitModalVisible(false)}
        footer={null}
        width={800}
      >
        <Spin spinning={jitLoading}>
          {jitRelations.length > 0 ? (
            <Table
              columns={[
                {
                  title: '订单号',
                  dataIndex: 'orderNo',
                  key: 'orderNo'
                },
                {
                  title: '关联订单',
                  dataIndex: 'motherOrChildOrders',
                  key: 'motherOrChildOrders',
                  render: (orders) => (
                    <div>
                      {orders && orders.length > 0 ? (
                        orders.map((order, idx) => (
                          <div key={idx}>
                            <Tag>{order.orderNo}</Tag>
                            <span style={{ marginLeft: 8, fontSize: 12, color: '#666' }}>
                              状态: {order.statusName}
                            </span>
                          </div>
                        ))
                      ) : (
                        <span style={{ color: '#999' }}>无关联订单</span>
                      )}
                    </div>
                  )
                }
              ]}
              dataSource={jitRelations}
              rowKey="orderNo"
              pagination={false}
            />
          ) : (
            <Empty description="暂无数据" />
          )}
        </Spin>
      </Modal>

      {/* 创建备货单模态框 */}
      <Modal
        title="创建备货单"
        open={createOrderModalVisible}
        onCancel={() => !createOrderLoading && setCreateOrderModalVisible(false)}
        onOk={() => createOrderForm.submit()}
        confirmLoading={createOrderLoading}
        width={700}
        okText="创建"
        cancelText="取消"
      >
        <Form
          form={createOrderForm}
          layout="vertical"
          onFinish={handleCreateOrder}
        >
          <Form.Item
            name="skuData"
            label="SKU数据"
            rules={[{ required: true, message: '请输入SKU数据' }]}
            extra={
              <div style={{ marginTop: 8 }}>
                <div style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>
                  格式说明：每行一个SKU，格式为：SKC SKU编码 数量
                </div>
                <div style={{ color: '#999', fontSize: 12 }}>
                  示例：<br/>
                  ss25042044640264012 I5cmbaujgtlf 100<br/>
                  ss25042044640264012 I5cmbaujgtlg 50<br/>
                  se2204266637766551 I0103yilwrnq 200
                </div>
              </div>
            }
          >
            <Input.TextArea
              rows={10}
              placeholder="请输入SKU数据，每行一个SKU&#10;格式：SKC SKU编码 数量&#10;&#10;示例：&#10;ss25042044640264012 I5cmbaujgtlf 100&#10;ss25042044640264012 I5cmbaujgtlg 50"
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 条码打印模态框 */}
      <Modal
        title="打印条码"
        open={printModalVisible && printType === 'barcode'}
        onCancel={() => {
          setPrintModalVisible(false);
          setBarcodePrintData([]);
        }}
        onOk={handlePrintBarcode}
        confirmLoading={printLoading}
        width={800}
        okText="开始打印"
        cancelText="取消"
      >
        {/* 打印说明 */}
        <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f0f7ff', borderRadius: 4, border: '1px solid #91caff' }}>
          <div style={{ fontSize: 12, color: '#666' }}>
            调用SHEIN官方API生成条码PDF，条码格式符合SHEIN仓库要求
          </div>
        </div>
        
        <div style={{ marginBottom: 16 }}>
          <span style={{ color: '#666' }}>
            已选择 {selectedOrders.length} 个订单，共 {barcodePrintData.length} 个条码待打印
          </span>
        </div>
        
        {barcodePrintData.length > 0 && (
          <div style={{ maxHeight: 400, overflow: 'auto', border: '1px solid #e8e8e8', borderRadius: 4 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#fafafa' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>条码</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>SKC</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>尺码</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #e8e8e8' }}>打印数量</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>订单号</th>
                </tr>
              </thead>
              <tbody>
                {barcodePrintData.map((item, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '8px 12px' }}>{item.barcode}</td>
                    <td style={{ padding: '8px 12px' }}>{item.skc}</td>
                    <td style={{ padding: '8px 12px' }}>{item.size}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        style={{ width: 80 }}
                        onChange={(e) => {
                          const newData = [...barcodePrintData];
                          newData[index].quantity = parseInt(e.target.value) || 1;
                          setBarcodePrintData(newData);
                        }}
                      />
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: '#666' }}>{item.orderNumber}</td>
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
              <li>调用SHEIN官方API生成条码PDF</li>
              <li>条码标签尺寸：20mm × 70mm（SHEIN标准）</li>
              <li>打印内容：商家货号</li>
              <li>单次打印总数量不能超过2000份</li>
              <li>生成的PDF将在新窗口打开，请使用浏览器打印功能</li>
            </ul>
          </div>
        </div>
      </Modal>

      {/* 多订单号搜索弹窗 */}
      <Modal
        title={null}
        open={multiOrderModalVisible}
        onCancel={() => setMultiOrderModalVisible(false)}
        footer={null}
        width={500}
        closable={true}
        closeIcon={<span style={{ fontSize: 18 }}>×</span>}
        styles={{ content: { borderRadius: 4 } }}
      >
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 500 }}>采购单号</span>
          <Tooltip title="支持多个采购单号，一行一个">
            <span style={{ marginLeft: 4, color: '#999', cursor: 'help' }}>ⓘ</span>
          </Tooltip>
        </div>
        <Input.TextArea
          placeholder="请输入采购单号，一行一个"
          value={multiOrderInput}
          onChange={(e) => setMultiOrderInput(e.target.value)}
          onPaste={(e) => {
            e.preventDefault();
            const pasteText = e.clipboardData.getData('text').trim();
            if (pasteText) {
              setMultiOrderInput(prev => {
                const current = prev.trim();
                if (current) {
                  return current + '\n' + pasteText + '\n';
                }
                return pasteText + '\n';
              });
            }
          }}
          style={{ width: '100%' }}
          rows={6}
          maxLength={2000}
          showCount
        />
        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <Space>
            <Button onClick={() => setMultiOrderInput('')}>清空</Button>
            <Button onClick={() => {
              setMultiOrderInput('');
              setFilters({ ...filters, order_number: '' });
              setMultiOrderModalVisible(false);
            }}>重置</Button>
            <Button type="primary" onClick={() => {
              const newFilters = { ...filters, order_number: multiOrderInput.trim() };
              setFilters(newFilters);
              setPagination(prev => ({ ...prev, current: 1 }));
              setMultiOrderModalVisible(false);
            }}>确定</Button>
          </Space>
        </div>
      </Modal>
    </div>
  );
}

export default StockOrders;
