import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  const [barcodePrintType, setBarcodePrintType] = useState(2);
  const [barcodePrintMode, setBarcodePrintMode] = useState(1); // 1: 官方条码, 2: 自定义条码
  const [barcodePrintContentType, setBarcodePrintContentType] = useState(1);
  const [barcodePrintFormatType, setBarcodePrintFormatType] = useState(1);

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

    // 检查是否有从发货台传来的打印请求
    const action = searchParams.get('action');
    if (action === 'printBarcode') {
      const data = sessionStorage.getItem('printBarcodeData');
      if (data) {
        try {
          const barcodeList = JSON.parse(data);
          setBarcodePrintData(barcodeList);
          setPrintType('barcode');
          setPrintModalVisible(true);
          sessionStorage.removeItem('printBarcodeData');
        } catch (e) {
          console.error('解析打印数据失败:', e);
        }
      }
    } else if (action === 'printPickList') {
      const data = sessionStorage.getItem('printPickListData');
      if (data) {
        try {
          const orders = JSON.parse(data);
          setSelectedOrders(orders);
          // 直接触发打印拣货单
          setTimeout(() => {
            generatePickListPDF();
            sessionStorage.removeItem('printPickListData');
          }, 500);
        } catch (e) {
          console.error('解析打印数据失败:', e);
        }
      }
    }
  }, [location, searchParams]);

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

  // 用 ref 跟踪是否首次渲染
  const isFirstRender = useRef(true);
  // 防抖定时器
  const debounceTimer = useRef(null);

  // filters 变化时自动搜索（带防抖，避免文本输入频繁请求）
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      fetchOrders();
      fetchStats();
      fetchShopList();
      return;
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setPagination(prev => ({ ...prev, current: 1 }));
      fetchOrders();
      fetchStats();
      fetchShopList();
    }, 300);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [filters]);

  // 分页变化时重新获取（排除首次渲染）
  const prevPage = useRef({ current: pagination.current, pageSize: pagination.pageSize });
  useEffect(() => {
    if (prevPage.current.current !== pagination.current || prevPage.current.pageSize !== pagination.pageSize) {
      prevPage.current = { current: pagination.current, pageSize: pagination.pageSize };
      fetchOrders();
    }
  }, [pagination.current, pagination.pageSize]);

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
        setOrders(Array.isArray(data.data) ? data.data : []);
        setPagination(prev => ({
          ...prev,
          total: data.total || 0
        }));
      } else {
        setOrders([]);
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
                orderQuantity: item.order_quantity || 1, // 原始下单数量，用于重置
                orderNumber: order.order_number || order.order_no,
                shopId: order.shop_id, // 店铺ID
                shopName: order.shop_name // 店铺名称
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
      const printData = barcodePrintData
        .filter(item => Number(item.quantity) > 0)
        .map(item => ({
          orderNo: item.orderNumber || null,
          supplierSku: item.supplierSku || null,
          sheinSku: item.sheinSku,
          printNumber: Number(item.quantity) || 0,
          printContentType: barcodePrintContentType
        }));

      if (printData.length === 0) {
        message.warning('请至少保留一个打印数量大于0的SKU');
        setPrintLoading(false);
        return;
      }

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
        // 保留选中状态：不调用 setSelectedOrders([])
      } else {
        message.error(response.data.message || '获取条码失败');
      }
    } catch (error) {
      message.error('打印条码失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setPrintLoading(false);
    }
  };

  // 本地生成自定义条码PDF
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
                          { text: topLeftText, fontSize: 9, alignment: 'left', bold: true, width: '*', noWrap: true },
                          { text: 'Made In China', fontSize: 7, alignment: 'right', bold: true, width: 'auto' }
                        ],
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

  // 执行条码打印
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
          if (Number(item.quantity) <= 0) return;
          if (!item.shopId) return;
          if (!shopGroups[item.shopId]) {
            shopGroups[item.shopId] = [];
          }
          shopGroups[item.shopId].push(item);
        });

        const shopIds = Object.keys(shopGroups);
        if (shopIds.length === 0) {
          message.warning('请至少保留一个打印数量大于0的SKU');
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
            printNumber: Number(item.quantity) || 0,
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
        // 保留选中状态：不调用 setSelectedOrders([])
      } catch (error) {
        message.destroy();
        message.error('生成条码失败: ' + error.message);
      } finally {
        setPrintLoading(false);
      }
    }
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

  // 生成表格列配置
  const generateColumns = () => {
    return [
      {
        title: '订单信息',
        key: 'orderInfo',
        width: 260,
        fixed: 'left',
        render: (_, record) => {
          const imgSrc = record.product_image || record.items?.[0]?.product_image || record.items?.[0]?.sku_image;
          return (
            <div style={{ display: 'flex', gap: 10, padding: '8px 0' }}>
              {imgSrc ? (
                <Image
                  width={70}
                  height={70}
                  src={imgSrc}
                  style={{ objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                />
              ) : (
                <div style={{ width: 70, height: 70, backgroundColor: '#f5f5f5', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 12, flexShrink: 0 }}>无图</div>
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
                  货号 {record.product_code || record.items?.[0]?.skc || '-'}
                </div>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                  SKC {record.skc || record.items?.[0]?.skc || '-'}
                </div>
              </div>
            </div>
          );
        }
      },
      {
        title: '订单状态',
        key: 'status',
        width: 100,
        render: (_, record) => {
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
            '待创建': { color: 'default', text: '待创建' },
            '已创建': { color: 'orange', text: '待发货' },
            '已发货': { color: 'cyan', text: '已送货' },
            '已取消': { color: 'red', text: '已作废' }
          };
          const config = statusConfig[record.status] || { color: 'default', text: record.status };
          // 计算剩余时间
          const deadline = record.request_delivery_time || record.ship_deadline;
          let remainText = '';
          if (deadline) {
            const now = new Date();
            const deadlineDate = new Date(deadline);
            const diffMs = deadlineDate - now;
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            if (diffHours > 0) {
              remainText = `${diffHours}h`;
            } else if (diffHours < 0) {
              remainText = '已超时';
            }
          }
          return (
            <div style={{ textAlign: 'center' }}>
              <Tag color={config.color}>{config.text}</Tag>
              {remainText && (
                <div style={{ fontSize: 12, color: remainText === '已超时' ? '#ff4d4f' : '#666', marginTop: 4 }}>
                  剩余取件时间 <span style={{ color: remainText === '已超时' ? '#ff4d4f' : '#1890ff', fontWeight: 'bold' }}>{remainText}</span>
                </div>
              )}
              <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                下发时间 {formatTime(record.allocate_time || record.add_time)?.split(' ')[0] || '-'}
              </div>
              <div style={{ fontSize: 11, color: '#999' }}>
                截止时间 {formatTime(record.request_delivery_time || record.ship_deadline)?.split(' ')[0] || '-'}
              </div>
            </div>
          );
        }
      },
      {
        title: '商品信息',
        key: 'productInfo',
        width: 180,
        render: (_, record) => {
          const items = record.items || [];
          const SKU_ROW_HEIGHT = 76; // 统一SKU行高
          const SUMMARY_ROW_HEIGHT = 36; // 合计行高
          if (items.length === 0) {
            return <span style={{ color: '#999' }}>-</span>;
          }
          // 单SKU简单显示
          if (items.length === 1) {
            const item = items[0];
            return (
              <div>
                <div style={{ fontWeight: 500, marginBottom: 2 }}>{item.suffix_zh || item.sku_attribute || '-'}</div>
                <div style={{ fontSize: 11, color: '#999' }}>平台SKU {item.sku_code || '-'}</div>
                <div style={{ fontSize: 11, color: '#999' }}>商家SKU {item.supplier_sku || '-'}</div>
                <div style={{ fontSize: 11, color: '#999' }}>单价 CNY {parseFloat(item.price || 0).toFixed(2)}</div>
              </div>
            );
          }
          // 多SKU分行显示
          return (
            <div style={{ margin: '-12px -8px' }}>
              {items.map((item, idx) => (
                <div key={idx} style={{ padding: '8px', borderBottom: '1px solid #f0f0f0', height: SKU_ROW_HEIGHT, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontWeight: 500, marginBottom: 2 }}>{item.suffix_zh || item.sku_attribute || '-'}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>平台SKU {item.sku_code || '-'}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>商家SKU {item.supplier_sku || '-'}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>单价 CNY {parseFloat(item.price || 0).toFixed(2)}</div>
                </div>
              ))}
              <div style={{ padding: '8px', fontWeight: 500, background: '#fafafa', height: SUMMARY_ROW_HEIGHT, boxSizing: 'border-box', display: 'flex', alignItems: 'center' }}>合计</div>
            </div>
          );
        }
      },
      {
        title: '下单/需求数量',
        key: 'quantities',
        width: 100,
        align: 'center',
        render: (_, record) => {
          const items = record.items || [];
          const SKU_ROW_HEIGHT = 76; // 统一SKU行高
          const SUMMARY_ROW_HEIGHT = 36; // 合计行高
          const totalQty = items.reduce((sum, item) => sum + (item.order_quantity || 0), 0) || record.stock_quantity || 0;
          // 单SKU或无items
          if (items.length <= 1) {
            return <div style={{ fontWeight: 'bold' }}>{totalQty}</div>;
          }
          // 多SKU分行显示
          return (
            <div style={{ margin: '-12px -8px' }}>
              {items.map((item, idx) => (
                <div key={idx} style={{ padding: '8px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', height: SKU_ROW_HEIGHT, boxSizing: 'border-box' }}>
                  {item.order_quantity || 0}
                </div>
              ))}
              <div style={{ padding: '8px', fontWeight: 'bold', background: '#fafafa', textAlign: 'center', height: SUMMARY_ROW_HEIGHT, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{totalQty}</div>
            </div>
          );
        }
      },
      {
        title: '送货/上架数量',
        key: 'deliveryQuantities',
        width: 100,
        align: 'center',
        render: (_, record) => {
          const items = record.items || [];
          const SKU_ROW_HEIGHT = 76; // 统一SKU行高
          const SUMMARY_ROW_HEIGHT = 36; // 合计行高
          const totalDelivered = items.reduce((sum, item) => sum + (item.delivery_quantity || 0), 0) || record.delivered_quantity || 0;
          const totalStorage = items.reduce((sum, item) => sum + (item.storage_quantity || 0), 0) || record.warehouse_quantity || 0;
          // 单SKU或无items
          if (items.length <= 1) {
            return <div>{totalDelivered} | {totalStorage}</div>;
          }
          // 多SKU分行显示
          return (
            <div style={{ margin: '-12px -8px' }}>
              {items.map((item, idx) => (
                <div key={idx} style={{ padding: '8px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', height: SKU_ROW_HEIGHT, boxSizing: 'border-box' }}>
                  {item.delivery_quantity || '-'} | {item.storage_quantity || '-'}
                </div>
              ))}
              <div style={{ padding: '8px', fontWeight: 'bold', background: '#fafafa', textAlign: 'center', height: SUMMARY_ROW_HEIGHT, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{totalDelivered} | {totalStorage}</div>
            </div>
          );
        }
      },
      {
        title: '下单金额',
        key: 'orderAmount',
        width: 100,
        align: 'right',
        render: (_, record) => {
          const items = record.items || [];
          const SKU_ROW_HEIGHT = 76; // 统一SKU行高
          const SUMMARY_ROW_HEIGHT = 36; // 合计行高
          const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.price || 0) * (item.order_quantity || 0)), 0);
          // 单SKU或无items
          if (items.length <= 1) {
            return <span style={{ fontWeight: 'bold', color: '#ff4d4f' }}>CNY {totalAmount.toFixed(2)}</span>;
          }
          // 多SKU分行显示
          return (
            <div style={{ margin: '-12px -8px' }}>
              {items.map((item, idx) => (
                <div key={idx} style={{ padding: '8px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: SKU_ROW_HEIGHT, boxSizing: 'border-box' }}>
                  CNY {(parseFloat(item.price || 0) * (item.order_quantity || 0)).toFixed(2)}
                </div>
              ))}
              <div style={{ padding: '8px', fontWeight: 'bold', color: '#ff4d4f', background: '#fafafa', textAlign: 'right', height: SUMMARY_ROW_HEIGHT, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>CNY {totalAmount.toFixed(2)}</div>
            </div>
          );
        }
      },
      {
        title: '下单信息',
        key: 'orderDetails',
        width: 160,
        render: (_, record) => {
          const items = record.items || [];
          const SKU_ROW_HEIGHT = 76; // 统一SKU行高
          const SUMMARY_ROW_HEIGHT = 36; // 合计行高
          const content = (
            <div style={{ fontSize: 12 }}>
              <div style={{ marginBottom: 4 }}>
                <span style={{ color: '#666' }}>平台收货仓库</span> {record.warehouse_group || '-'}
              </div>
              <div style={{ marginBottom: 4 }}>
                <span style={{ color: '#666' }}>物流目的仓</span> {record.actual_warehouse || '-'}
              </div>
              <div>
                <span style={{ color: '#666' }}>下发时间</span> {formatTime(record.allocate_time || record.add_time) || '-'}
              </div>
            </div>
          );
          // 多SKU时需要匹配高度
          if (items.length > 1) {
            const totalHeight = items.length * SKU_ROW_HEIGHT;
            return (
              <div style={{ margin: '-12px -8px' }}>
                <div style={{ padding: '8px', height: totalHeight, boxSizing: 'border-box', display: 'flex', alignItems: 'center', borderBottom: '1px solid #f0f0f0' }}>{content}</div>
                <div style={{ padding: '8px', background: '#fafafa', height: SUMMARY_ROW_HEIGHT, boxSizing: 'border-box' }}></div>
              </div>
            );
          }
          return content;
        }
      },
      {
        title: '操作',
        key: 'actions',
        width: 80,
        fixed: 'right',
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            <Button type="link" size="small" onClick={() => handleViewDetail(record)}>详情</Button>
          </Space>
        )
      }
    ];
  };

  return (
    <div style={{ padding: 24 }}>
      {/* 订单类型选项卡 */}
      <div style={{
        marginBottom: 16,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
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
              onClick={async () => {
                try {
                  const orderIds = selectedOrders.map(o => o.id);
                  const response = await fetch('/api/shipping-station/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderIds })
                  });
                  const data = await response.json();
                  if (data.success) {
                    message.success(data.message || '已加入发货台');
                    setSelectedOrders([]);
                  } else {
                    message.error(data.message || '加入发货台失败');
                  }
                } catch (error) {
                  message.error('加入发货台失败: ' + error.message);
                }
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

      {/* 选择统计信息栏 */}
      {selectedOrders.length > 0 && (
        <div style={{ 
          padding: '10px 16px', 
          background: '#fafafa', 
          borderLeft: '3px solid #1890ff',
          marginBottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <span>
              已选 <span style={{ color: '#1890ff', fontWeight: 'bold' }}>{(() => {
                const skcSet = new Set();
                selectedOrders.forEach(order => {
                  order.items?.forEach(item => skcSet.add(item.skc));
                });
                return skcSet.size;
              })()}</span> 个SKC，共 <span style={{ color: '#1890ff', fontWeight: 'bold' }}>{selectedOrders.reduce((sum, order) => sum + (order.items?.reduce((s, item) => s + (item.order_quantity || 0), 0) || 0), 0)}</span> 件
            </span>
            <span style={{ color: '#999' }}>|</span>
            <span>总订单数 <span style={{ fontWeight: 'bold' }}>{selectedOrders.length}</span></span>
            <span>总下单件数 <span style={{ fontWeight: 'bold' }}>{selectedOrders.reduce((sum, order) => sum + (order.items?.reduce((s, item) => s + (item.order_quantity || 0), 0) || 0), 0)}</span></span>
            <span>总SKC数量 <span style={{ fontWeight: 'bold' }}>{(() => {
              const skcSet = new Set();
              selectedOrders.forEach(order => {
                order.items?.forEach(item => skcSet.add(item.skc));
              });
              return skcSet.size;
            })()}</span></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#999' }}>|</span>
            <span style={{ color: '#999' }}>排序方式</span>
            <Select 
              defaultValue="allocate_desc" 
              size="small" 
              style={{ width: 140 }}
              options={[
                { value: 'allocate_desc', label: '下单时间最晚在上' },
                { value: 'allocate_asc', label: '下单时间最早在上' }
              ]}
            />
          </div>
        </div>
      )}

      <Card style={{ marginTop: selectedOrders.length > 0 ? 0 : undefined }}>
        <Table
          columns={generateColumns()}
          dataSource={orders}
          rowKey="order_number"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total) => `共 ${total} 条`
          }}
          onChange={handleTableChange}
          scroll={{ x: 1200 }}
          bordered
          size="middle"
          rowSelection={{
            selectedRowKeys: selectedOrders.map(o => o.order_number),
            onChange: (selectedRowKeys, selectedRows) => {
              setSelectedOrders(selectedRows);
            },
            selections: [
              Table.SELECTION_ALL,
              Table.SELECTION_INVERT,
              Table.SELECTION_NONE
            ]
          }}

          locale={{
            emptyText: <Empty description="暂无采购单数据" />
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
            总打印 {barcodePrintData.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)} 份
            {barcodePrintData.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) > 2000 && (
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
                        min={0}
                        max={2000}
                        value={item.quantity}
                        style={{ width: 70, textAlign: 'center' }}
                        size="small"
                        onChange={(e) => {
                          const newData = [...barcodePrintData];
                          const parsedValue = parseInt(e.target.value, 10);
                          newData[index].quantity = Number.isNaN(parsedValue) ? 0 : Math.max(0, parsedValue);
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
