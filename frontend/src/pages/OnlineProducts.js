import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, Select, InputNumber, message, Tag, Image } from 'antd';
import { SyncOutlined, CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import JsBarcode from 'jsbarcode';
import pdfMake from 'pdfmake/build/pdfmake';
import chineseFontVfs from '../fonts/vfs_fonts';

pdfMake.vfs = chineseFontVfs;
pdfMake.fonts = {
  ChineseFont: {
    normal: 'ChineseFont.ttf',
    bold: 'ChineseFont.ttf',
    italics: 'ChineseFont.ttf',
    bolditalics: 'ChineseFont.ttf'
  }
};

function extractSaleAttributeText(attrs) {
  if (!attrs) return '-';

  try {
    const attrList = typeof attrs === 'string' ? JSON.parse(attrs) : attrs;
    if (!Array.isArray(attrList)) {
      return '-';
    }

    const values = attrList
      .map(item => item?.attributeValueName || item?.attribute_value_name || item?.value || item?.attrValueName || item?.name || '')
      .filter(Boolean);

    return values.length > 0 ? values.join(', ') : '-';
  } catch (error) {
    return '-';
  }
}

function OnlineProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState('shein_full');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalSpu, setTotalSpu] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [syncStep, setSyncStep] = useState(0);
  const [shops, setShops] = useState([]);
  const [form] = Form.useForm();
  const [syncConfig, setSyncConfig] = useState({
    selectedShopId: null,
    isFullSync: false,
    timeStart: '',
    timeEnd: '',
    syncToProducts: true
  });
  const [syncProgress, setSyncProgress] = useState({ total: 0, current: 0, message: '' });
  const [syncResult, setSyncResult] = useState(null);
  
  // 筛选查询相关状态
  const [searchForm] = Form.useForm();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedShopId, setSelectedShopId] = useState(null);
  const [shelfStatusFilter, setShelfStatusFilter] = useState(null);
  const [mallStateFilter, setMallStateFilter] = useState(null);
  
  // 销量查询相关状态
  const [salesModalVisible, setSalesModalVisible] = useState(false);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesData, setSalesData] = useState(null);

  // SHEIN条码打印相关状态
  const [barcodePrintModalVisible, setBarcodePrintModalVisible] = useState(false);
  const [barcodePrintLoading, setBarcodePrintLoading] = useState(false);
  const [barcodePrintData, setBarcodePrintData] = useState([]);
  const [barcodePrintShopId, setBarcodePrintShopId] = useState(null);
  const [barcodePrintSpuName, setBarcodePrintSpuName] = useState('');
  const [barcodePrintSkcName, setBarcodePrintSkcName] = useState('');
  const [barcodePrintSource, setBarcodePrintSource] = useState('local');

  const generateCustomBarcodePDF = async (rows, labelMetadataMap = {}, officialBarcodesMap = {}) => {
    try {
      message.loading('正在生成自定义条码PDF...', 0);

      const contentItems = [];
      const pageWidth = 70 * 2.83465;
      const pageHeight = 30 * 2.83465;

      for (let itemIndex = 0; itemIndex < rows.length; itemIndex++) {
        const item = rows[itemIndex];
        const canvas = document.createElement('canvas');
        const labelMeta = labelMetadataMap[item.sheinSku] || {};
        const barcodeContent = barcodePrintSource === 'official'
          ? (officialBarcodesMap[item.sheinSku] || item.selectedBarcode || item.supplierSku || item.sheinSku)
          : (item.selectedBarcode || item.supplierSku || item.sheinSku);
        const platformSkuText = item.sheinSku || '-';
        const goodsCodeText = labelMeta.supplierCode || item.displayGoodsCode || labelMeta.supplierSku || item.supplierSku || item.supplier_sku || '-';
        const attributeText = labelMeta.attributeValueName || labelMeta.attributeText || item.sizeText || '-';

        if (!barcodeContent) {
          continue;
        }

        const validBarcodeData = String(barcodeContent).replace(/[^\x20-\x7E]/g, '').trim() || item.sheinSku || 'INVALID';

        try {
          JsBarcode(canvas, validBarcodeData, {
            format: 'CODE128',
            width: 4,
            height: 120,
            displayValue: false,
            margin: 0
          });
        } catch (error) {
          console.error(`生成条码图形失败 [${validBarcodeData}]:`, error);
          continue;
        }

        const barcodeDataUrl = canvas.toDataURL('image/png');
        const categoryPath = labelMeta.categoryPath || '未获取到分类';
        const printQty = parseInt(item.printNumber, 10) || 1;

        for (let i = 0; i < printQty; i++) {
          const isLastPageOfThisItem = i === printQty - 1 && itemIndex === rows.length - 1;

          contentItems.push({
            table: {
              widths: ['*'],
              body: [[{
                border: [true, true, true, true],
                margin: [0, 0, 0, 0],
                stack: [
                  {
                    columns: [
                      { text: categoryPath, fontSize: 9, alignment: 'left', bold: true, width: '*', noWrap: true },
                      { text: 'Made In China', fontSize: 7, alignment: 'right', bold: true, width: 'auto' }
                    ],
                    margin: [0, 0, 0, 1]
                  },
                  {
                    image: barcodeDataUrl,
                    width: 170,
                    height: 28,
                    alignment: 'center',
                    margin: [0, 0, 0, 1]
                  },
                  {
                    columns: [
                      {
                        stack: [
                          { text: platformSkuText, fontSize: 7, margin: [0, 0, 0, 0.5], noWrap: true },
                          { text: goodsCodeText, fontSize: 7, margin: [0, 0, 0, 0.5], noWrap: true },
                          { text: item.skcName || '-', fontSize: 7, noWrap: true }
                        ],
                        width: '*',
                        alignment: 'left',
                        margin: [0, 0, 0, 0]
                      },
                      {
                        text: attributeText,
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
              }]]
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
            pageBreak: isLastPageOfThisItem ? undefined : 'after'
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
          font: 'ChineseFont'
        }
      };

      pdfMake.createPdf(docDefinition).getBlob((blob) => {
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

  // 获取店铺列表
  const fetchShops = async () => {
    try {
      const response = await fetch('/api/shein-full-auth/shops');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.success && data.data && data.data.length > 0) {
        const activeShops = data.data.filter(shop => shop.is_active !== false);
        setShops(activeShops.length > 0 ? activeShops : data.data);
      }
    } catch (error) {
      console.error('获取店铺列表失败:', error);
    }
  };

  // 打开条码打印弹窗（按SPU读取barcode_list）
  const handleOpenBarcodePrint = async (record, targetSkcName = null) => {
    if (selectedPlatform !== 'shein_full') {
      message.warning('当前仅支持SHEIN平台打印条码');
      return;
    }

    const shopId = record.shop_id || record.platform_id || shops?.[0]?.id;
    if (!shopId) {
      message.error('无法获取店铺信息，请先配置并授权SHEIN店铺');
      return;
    }

    setBarcodePrintLoading(true);
    try {
      const localSkuRows = Array.isArray(groupedBySpu[record.spu_name]) ? groupedBySpu[record.spu_name] : [];
      const localSkuMap = new Map(localSkuRows.map(item => [item.sku_code, item]));

      const response = await fetch('/api/shein-full-products/barcode-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId,
          spuName: record.spu_name,
          languageList: ['zh-cn', 'en', 'ko', 'ja']
        })
      });

      const data = await response.json();
      if (!data.success) {
        message.error(data.message || '获取条码列表失败');
        return;
      }

      const rows = (data.data || [])
        .filter(item => item && item.sheinSku)
        .map((item, idx) => {
          const localSku = localSkuMap.get(item.sheinSku) || {};

          return {
          ...localSku,
          id: `${item.sheinSku}_${idx}`,
          sheinSku: item.sheinSku,
          skuCode: item.sheinSku,
          supplierSku: item.supplierSku || localSku.supplierSku || localSku.supplier_sku || null,
          displayGoodsCode: localSku.supplier_sku || localSku.supplierSku || item.supplierSku || null,
          skcName: item.skcName || '-',
          barcodeList: Array.isArray(item.barcodeList) ? item.barcodeList : [],
          selectedBarcode: Array.isArray(item.barcodeList) && item.barcodeList.length > 0 ? item.barcodeList[0] : null,
          sizeText: extractSaleAttributeText(localSku.sale_attribute_list),
          printNumber: 0
        };
        });

      const exactMatchedRows = targetSkcName
        ? rows.filter(item => (item.skcName || 'unknown') === (targetSkcName || 'unknown'))
        : rows;
      const filteredRows = exactMatchedRows.length > 0 ? exactMatchedRows : rows;

      if (filteredRows.length === 0) {
        message.warning('该SPU未获取到可打印的SKU条码数据');
        return;
      }

      setBarcodePrintData(filteredRows);
      setBarcodePrintShopId(shopId);
      setBarcodePrintSpuName(record.spu_name || '');
      setBarcodePrintSkcName(targetSkcName || '');
      setBarcodePrintModalVisible(true);
    } catch (error) {
      message.error('获取条码列表失败: ' + error.message);
    } finally {
      setBarcodePrintLoading(false);
    }
  };

  const handleBarcodeRowChange = (rowId, key, value) => {
    setBarcodePrintData(prev => prev.map(item => {
      if (item.id !== rowId) return item;
      return { ...item, [key]: value };
    }));
  };

  const handlePrintBarcode = async () => {
    if (!barcodePrintShopId) {
      message.error('缺少店铺信息，无法打印');
      return;
    }

    const printData = barcodePrintData
      .filter(item => Number(item.printNumber) > 0)
      .map(item => ({
        orderNo: null,
        supplierSku: item.supplierSku || null,
        barcode: item.selectedBarcode || null,
        sheinSku: item.sheinSku,
        printNumber: Number(item.printNumber) || 1,
        printContentType: 2
      }));

    if (printData.length === 0) {
      message.warning('请至少设置一个SKU的打印数量大于0');
      return;
    }

    const totalPrintNumber = printData.reduce((sum, item) => sum + item.printNumber, 0);
    if (totalPrintNumber > 2000) {
      message.error(`打印总数量(${totalPrintNumber})超过2000份限制，请减少打印数量`);
      return;
    }

    setBarcodePrintLoading(true);
    try {
      let labelMetadataMap = {};
      let officialBarcodesMap = {};
      let failedChunks = 0;
      let totalErrorSkuCount = 0;
      const shouldUseOfficialBarcode = barcodePrintSource === 'official';

      const skuCodes = Array.from(new Set(printData.map(item => item.sheinSku).filter(Boolean)));

      if (skuCodes.length > 0) {
        try {
          const categoryResponse = await fetch('/api/shein-full/sku-label-metadata', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              shopId: barcodePrintShopId,
              skus: skuCodes,
              languageList: ['en']
            })
          });

          const categoryResult = await categoryResponse.json();
          if (categoryResult.success && categoryResult.data) {
            labelMetadataMap = categoryResult.data;
          }
        } catch (error) {
          console.warn('获取SKU标签元数据失败:', error);
        }
      }

      if (shouldUseOfficialBarcode) {
        for (let i = 0; i < printData.length; i += 200) {
          const chunk = printData.slice(i, i + 200);
          try {
            const response = await fetch('/api/shein-full/print-barcode', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                shopId: barcodePrintShopId,
                data: chunk,
                type: 2,
                printFormatType: 1
              })
            });

            const result = await response.json();
            if (!result.success) {
              failedChunks += 1;
              console.warn('获取官方条码失败:', result.message || '未知错误');
              continue;
            }

            if (Array.isArray(result.codingInfoList)) {
              result.codingInfoList.forEach(info => {
                if (info?.sheinSku && info?.barcode) {
                  officialBarcodesMap[info.sheinSku] = info.barcode;
                }
              });
            }

            if (Array.isArray(result.errorData) && result.errorData.length > 0) {
              totalErrorSkuCount += result.errorData.length;
              console.log('打印失败的SKU:', result.errorData);
            }
          } catch (error) {
            failedChunks += 1;
            console.warn('获取官方条码请求失败:', error);
          }
        }
      }

      await generateCustomBarcodePDF(
        barcodePrintData.filter(item => Number(item.printNumber) > 0),
        labelMetadataMap,
        officialBarcodesMap
      );

      if (shouldUseOfficialBarcode && failedChunks > 0) {
        message.warning(`部分SKU未获取到官方条码，已自动回退使用本地条码数据（失败批次: ${failedChunks}）`);
      } else if (shouldUseOfficialBarcode && totalErrorSkuCount > 0) {
        message.warning(`${totalErrorSkuCount}个SKU未返回官方条码，已自动回退使用本地条码数据`);
      }

      setBarcodePrintModalVisible(false);
      setBarcodePrintSkcName('');
    } catch (error) {
      message.error('打印条码失败: ' + error.message);
    } finally {
      setBarcodePrintLoading(false);
    }
  };

  // 获取总SPU数量
  const fetchTotalSpu = async () => {
    try {
      let url = '';
      if (selectedPlatform === 'shein_full') {
        const params = new URLSearchParams({ countOnly: 'true' });
        if (selectedShopId !== null && selectedShopId !== undefined && selectedShopId !== '') {
          params.append('shop_id', selectedShopId);
        }
        url = `/api/shein-full-products/local?${params.toString()}`;
      } else if (selectedPlatform === 'amazon') {
        url = '/api/amazon-products/local?countOnly=true';
      } else if (selectedPlatform === 'ebay') {
        url = '/api/ebay-products/local?countOnly=true';
      }
      
      if (!url) return;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success && data.data) {
        setTotalSpu(data.data.totalSpu);
        console.log(`总SPU数量: ${data.data.totalSpu}`);
      }
    } catch (error) {
      console.error('获取总SPU数量失败:', error);
    }
  };

  // 加载当前页数据
  const fetchProducts = async () => {
    setLoading(true);
    try {
      let url = '';
      
      // 构建查询参数
      const params = new URLSearchParams({
        page: currentPage,
        pageSize: pageSize
      });
      
      // 添加筛选参数
      if (searchKeyword) {
        params.append('search', searchKeyword);
      }
      if (shelfStatusFilter !== null) {
        params.append('shelf_status', shelfStatusFilter);
      }
      if (mallStateFilter !== null) {
        params.append('mall_state', mallStateFilter);
      }
      if (selectedPlatform === 'shein_full' && selectedShopId !== null && selectedShopId !== undefined && selectedShopId !== '') {
        params.append('shop_id', selectedShopId);
      }
      
      // 根据选中的平台获取商品列表（按SKC分页）
      if (selectedPlatform === 'shein_full') {
        url = `/api/shein-full-products/local?${params.toString()}`;
      } else if (selectedPlatform === 'amazon') {
        url = `/api/amazon-products/local?${params.toString()}`;
      } else if (selectedPlatform === 'ebay') {
        url = `/api/ebay-products/local?${params.toString()}`;
      }
      
      if (!url) {
        return;
      }
      
      console.log(`========================================`);
      console.log(`加载第 ${currentPage} 页数据`);
      console.log(`每页显示: ${pageSize} 个SPU`);
      console.log(`请求URL: ${url}`);
      console.log(`========================================`);
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success && data.data) {
        // 格式化商品数据
        const formattedProducts = data.data.map(product => ({
          id: product.id,
          sku_code: product.sku_code,
          spu_name: product.spu_name,
          skc_name: product.skc_name,
          product_name_cn: product.product_name_cn || product.product_name,
          product_name_en: product.product_name_en,
          brand_code: product.brand_code,
          main_image_url: product.main_image_url,
          base_price: product.base_price,
          special_price: product.special_price,
          cost_price: product.cost_price,
          shelf_status: product.shelf_status,
          mall_state: product.mall_state,
          stop_purchase: product.stop_purchase,
          platform: selectedPlatform,
          ...product
        }));
        
        setProducts(formattedProducts);
        
        // 更新总SPU数量
        if (data.pagination && data.pagination.totalSpu !== undefined) {
          setTotalSpu(data.pagination.totalSpu);
        }
        
        console.log(`========================================`);
        console.log(`成功获取 ${data.data.length} 条SKU数据`);
        console.log(`总SPU数: ${data.pagination?.totalSpu || 0}`);
        console.log(`总SKC数: ${data.pagination?.totalSkc || 0}`);
        console.log(`========================================`);
      } else {
        console.warn('API返回数据为空或失败:', data);
        setProducts([]);
      }
    } catch (error) {
      console.error('获取商品列表失败:', error);
      message.error('加载数据失败: ' + error.message);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  // 处理筛选查询
  const handleSearch = (values) => {
    setSearchKeyword(values.keyword || '');
    setSelectedShopId(values.shop_id ?? null);
    setShelfStatusFilter(values.shelf_status);
    setMallStateFilter(values.mall_state);
    setCurrentPage(1); // 重置到第一页
  };

  // 重置筛选
  const handleReset = () => {
    searchForm.resetFields();
    setSearchKeyword('');
    setSelectedShopId(null);
    setShelfStatusFilter(null);
    setMallStateFilter(null);
    setCurrentPage(1);
  };

  // 初始化
  useEffect(() => {
    fetchShops();
    fetchTotalSpu();
    fetchProducts();
  }, []);

  // 平台切换
  useEffect(() => {
    setCurrentPage(1);
    setProducts([]);
    fetchTotalSpu();
    fetchProducts();
  }, [selectedPlatform]);

  // 页码或每页数量变化时重新加载
  useEffect(() => {
    fetchProducts();
  }, [currentPage, pageSize]);

  // 筛选条件变化时重新加载
  useEffect(() => {
    fetchProducts();
  }, [searchKeyword, selectedShopId, shelfStatusFilter, mallStateFilter]);

  // 查询销量
  const handleQuerySales = async (mode, spuName, skcName) => {
    if (!shops || shops.length === 0) {
      message.error('没有可用的店铺');
      return;
    }

    const shopId = shops[0].id; // 使用第一个店铺
    
    setSalesModalVisible(true);
    setSalesLoading(true);
    setSalesData(null);

    try {
      const requestBody = {
        shopId,
        queryMode: mode,
        spuName: mode === 'spu' ? spuName : spuName,
        skcName: mode === 'skc' ? skcName : undefined
      };

      const response = await fetch('/api/sku-sales/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (data.success) {
        setSalesData(data.data);
        message.success('查询成功');
      } else {
        message.error(data.message || '查询失败');
      }
    } catch (error) {
      console.error('查询销量失败:', error);
      message.error('查询失败: ' + error.message);
    } finally {
      setSalesLoading(false);
    }
  };

  // 复制到ERP商品 - 显示SKC列表确认
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [copyingRecord, setCopyingRecord] = useState(null);
  const [copyLoading, setCopyLoading] = useState(false);
  
  // 查看详情弹窗
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailRecord, setDetailRecord] = useState(null);

  const handleCopyToErp = async (record) => {
    setCopyingRecord(record);
    setCopyModalVisible(true);
  };

  // 查看详情
  const handleViewDetail = (record) => {
    setDetailRecord(record);
    setDetailModalVisible(true);
  };

  // 获取SPU下的所有SKC详情数据
  const getDetailSkcList = () => {
    if (!detailRecord) return [];
    const spuProducts = groupedBySpu[detailRecord.spu_name] || [];
    const skcMap = {};
    spuProducts.forEach(product => {
      const skcName = product.skc_name || 'unknown';
      if (!skcMap[skcName]) {
        skcMap[skcName] = {
          skc_name: skcName,
          main_image_url: product.main_image_url,
          product_name_cn: product.product_name_cn,
          product_name_en: product.product_name_en,
          brand_code: product.brand_code,
          category_id: product.category_id,
          base_price: product.base_price,
          special_price: product.special_price,
          cost_price: product.cost_price,
          shelf_status: product.shelf_status,
          mall_state: product.mall_state,
          stop_purchase: product.stop_purchase,
          images: product.images,
          site_detail_image_list: product.site_detail_image_list,
          product_attribute_list: product.product_attribute_list,
          skc_attribute_multi_list: product.skc_attribute_multi_list,
          skus: []
        };
      }
      // 添加SKU信息
      skcMap[skcName].skus.push({
        sku_code: product.sku_code,
        supplier_sku: product.supplier_sku,
        base_price: product.base_price,
        special_price: product.special_price,
        cost_price: product.cost_price,
        shelf_status: product.shelf_status,
        mall_state: product.mall_state,
        stop_purchase: product.stop_purchase,
        weight: product.weight,
        length: product.length,
        width: product.width,
        height: product.height,
        sale_attribute_list: product.sale_attribute_list,
        main_image_url: product.main_image_url
      });
    });
    return Object.values(skcMap);
  };

  const handleConfirmCopy = async () => {
    if (!copyingRecord) return;
    
    setCopyLoading(true);
    try {
      const response = await fetch('/api/erp-products/copy-from-online', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spuName: copyingRecord.spu_name,
          platformId: copyingRecord.platform_id || null
        })
      });

      const data = await response.json();

      if (data.success) {
        message.success(`成功复制商品！SPU编码: ${data.data.spuCode}，已创建 ${data.data.skcCount} 个SKC，${data.data.skuCount} 个SKU`);
        setCopyModalVisible(false);
        setCopyingRecord(null);
      } else {
        message.error(data.message || '复制失败');
      }
    } catch (error) {
      console.error('复制商品失败:', error);
      message.error('复制失败: ' + error.message);
    } finally {
      setCopyLoading(false);
    }
  };

  // 获取要复制的SPU下的SKC列表
  const getCopySkcList = () => {
    if (!copyingRecord) return [];
    const spuProducts = groupedBySpu[copyingRecord.spu_name] || [];
    const skcMap = {};
    spuProducts.forEach(product => {
      const skcName = product.skc_name || 'unknown';
      if (!skcMap[skcName]) {
        skcMap[skcName] = {
          skc_name: skcName,
          main_image_url: product.main_image_url,
          product_name_cn: product.product_name_cn,
          sku_count: 0
        };
      }
      skcMap[skcName].sku_count++;
    });
    return Object.values(skcMap);
  };

  // 处理同步
  const handleSync = () => {
    setSyncStep(0);
    setSyncProgress({ total: 0, current: 0, message: '' });
    setSyncResult(null);
    setSyncModalVisible(true);
  };

  const handleStartSync = async () => {
    if (!syncConfig.selectedShopId) {
      message.error('请先选择要同步的店铺');
      return;
    }

    setSyncStep(1);
    setSyncing(true);
    setSyncProgress({ total: 0, current: 0, message: '正在启动同步任务...' });

    try {
      const requestBody = {
        shopId: syncConfig.selectedShopId,
        syncMode: syncConfig.isFullSync ? 'full' : 'custom',
        syncToProducts: syncConfig.syncToProducts,
        pageSize: 50
      };

      if (!syncConfig.isFullSync) {
        requestBody.insertTimeStart = syncConfig.timeStart;
        requestBody.insertTimeEnd = syncConfig.timeEnd;
      }

      // 启动同步任务（不等待完成）
      fetch('/api/shein-full-sync/query-and-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }).then(async (response) => {
        const responseText = await response.text();

        if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
          setSyncResult({ success: false, message: '后端服务错误' });
          setSyncStep(2);
          return;
        }

        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          setSyncResult({ success: false, message: '响应格式错误' });
          setSyncStep(2);
          return;
        }

        if (data.success) {
          setSyncResult({ success: true, message: `同步完成！`, data: data.data });
          setSyncStep(2);
          
          // 清除后端缓存
          fetch('/api/shein-full-products/clear-cache', { method: 'POST' })
            .catch(err => console.warn('清除缓存失败:', err));
          
          // 重新加载数据
          setProducts([]);
          setCurrentPage(1);
          fetchTotalSpu();
          fetchProducts();
        } else {
          setSyncResult({ success: false, message: data.message || '同步失败' });
          setSyncStep(2);
        }
        setSyncing(false);
      }).catch((error) => {
        setSyncResult({ success: false, message: '同步失败: ' + error.message });
        setSyncStep(2);
        setSyncing(false);
      });

      // 立即显示同步中状态
      setSyncProgress({ total: 0, current: 0, message: '同步任务已启动，正在后台执行...' });
      message.success('同步任务已启动，您可以关闭此窗口，同步将在后台继续');
      
    } catch (error) {
      setSyncResult({ success: false, message: '启动同步失败: ' + error.message });
      setSyncStep(2);
      setSyncing(false);
    }
  };

  // 按SPU分组（使用当前页的数据）
  const groupedBySpu = {};
  products.forEach(product => {
    const spuName = product.spu_name || 'unknown';
    if (!groupedBySpu[spuName]) {
      groupedBySpu[spuName] = [];
    }
    groupedBySpu[spuName].push(product);
  });

  const spuNames = Object.keys(groupedBySpu);
  const tableData = spuNames.map((spuName, index) => {
    const spuProducts = groupedBySpu[spuName];
    const skcSet = new Set(spuProducts.map(p => p.skc_name));
    return {
      id: `spu_${index}`,
      spu_name: spuName,
      skc_count: skcSet.size,
      sku_count: spuProducts.length,
      ...spuProducts[0]
    };
  });

  // 展开行 - 显示该SPU下的所有SKC和SKU
  const expandedRowRender = (record) => {
    const spuProducts = groupedBySpu[record.spu_name] || [];
    
    // 按SKC分组
    const groupedBySkc = {};
    spuProducts.forEach(product => {
      const skcName = product.skc_name || 'unknown';
      if (!groupedBySkc[skcName]) {
        groupedBySkc[skcName] = [];
      }
      groupedBySkc[skcName].push(product);
    });

    const skcColumns = [
      {
        title: '图片',
        key: 'images',
        width: 180,
        render: (_, record) => {
          // 收集所有图片
          let allImages = [];
          if (record.main_image_url) {
            allImages.push({ url: record.main_image_url, type: '主图' });
          }
          if (record.images) {
            try {
              const imgs = typeof record.images === 'string' ? JSON.parse(record.images) : record.images;
              if (Array.isArray(imgs)) {
                imgs.forEach((img, idx) => {
                  const imgUrl = typeof img === 'string' ? img : (img.imageUrl || img.image_url);
                  if (imgUrl && !allImages.find(i => i.url === imgUrl)) {
                    allImages.push({ url: imgUrl, type: `图${idx + 1}` });
                  }
                });
              }
            } catch (e) {}
          }
          
          if (allImages.length === 0) {
            return <div style={{ width: '50px', height: '50px', background: '#f0f0f0', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#999' }}>无图</div>;
          }
          
          return (
            <Image.PreviewGroup>
              <Space size={4}>
                {allImages.slice(0, 3).map((img, idx) => (
                  <Image key={idx} src={img.url} alt={img.type} width={45} height={45} style={{ objectFit: 'cover', borderRadius: '4px' }} />
                ))}
                {allImages.length > 3 && (
                  <div style={{ width: 45, height: 45, background: '#f0f0f0', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#666' }}>
                    +{allImages.length - 3}
                  </div>
                )}
              </Space>
            </Image.PreviewGroup>
          );
        }
      },
      { 
        title: 'SKC编码', 
        dataIndex: 'skc_name', 
        key: 'skc_name', 
        width: 150,
        render: (text, record) => <strong>{text}</strong>
      },
      { 
        title: 'SKU数量', 
        key: 'sku_count', 
        width: 100,
        render: (_, record) => <Tag color="blue">{groupedBySkc[record.skc_name]?.length || 0} 个SKU</Tag>
      },
      { title: '原价', dataIndex: 'base_price', key: 'base_price', width: 100, render: (price) => price ? `¥${price}` : '-' },
      { title: '特价', dataIndex: 'special_price', key: 'special_price', width: 100, render: (price) => price ? `¥${price}` : '-' },
      { title: '供货价', dataIndex: 'cost_price', key: 'cost_price', width: 100, render: (price) => price ? `¥${price}` : '-' },
      {
        title: '上架状态',
        dataIndex: 'shelf_status',
        key: 'shelf_status',
        width: 100,
        render: (status) => {
          const statusMap = { 0: <Tag color="red">下架</Tag>, 1: <Tag color="green">上架</Tag> };
          return statusMap[status] || '-';
        }
      },
      {
        title: '销售状态',
        dataIndex: 'mall_state',
        key: 'mall_state',
        width: 100,
        render: (state) => {
          const stateMap = { 1: <Tag color="green">在售</Tag>, 2: <Tag color="red">停售</Tag> };
          return stateMap[state] || '-';
        }
      },
      {
        title: '操作',
        key: 'action',
        width: 180,
        render: (_, record) => (
          <Space size="small">
            <Button 
              type="link" 
              size="small"
              onClick={() => handleQuerySales('skc', record.spu_name, record.skc_name)}
            >
              查询销量
            </Button>
            <Button
              type="link"
              size="small"
              onClick={() => handleOpenBarcodePrint(record, record.skc_name)}
            >
              打印条码
            </Button>
          </Space>
        )
      }
    ];

    const skcData = Object.keys(groupedBySkc).map((skcName, idx) => ({
      id: `skc_${idx}`,
      skc_name: skcName,
      ...groupedBySkc[skcName][0]
    }));

    // SKU详情展开
    const skuExpandedRowRender = (skcRecord) => {
      const skus = groupedBySkc[skcRecord.skc_name] || [];
      const skuColumns = [
        {
          title: '图片',
          dataIndex: 'main_image_url',
          key: 'main_image_url',
          width: 60,
          render: (imageUrl) =>
            imageUrl ? (
              <Image src={imageUrl} alt="SKU图片" width={40} height={40} style={{ objectFit: 'cover', borderRadius: '4px' }} />
            ) : '-'
        },
        { title: 'SKU编码', dataIndex: 'sku_code', key: 'sku_code', width: 150 },
        { title: '商家SKU', dataIndex: 'supplier_sku', key: 'supplier_sku', width: 120 },
        { 
          title: '规格', 
          dataIndex: 'sale_attribute_list', 
          key: 'sale_attribute_list', 
          width: 150,
          render: (attrs) => {
            if (!attrs) return '-';
            try {
              const attrList = typeof attrs === 'string' ? JSON.parse(attrs) : attrs;
              if (Array.isArray(attrList)) {
                return attrList.map(a => a.attributeValueName || a.value || '').filter(Boolean).join(', ') || '-';
              }
            } catch (e) {}
            return '-';
          }
        },
        { title: '原价', dataIndex: 'base_price', key: 'base_price', width: 80, render: (price) => price ? `¥${price}` : '-' },
        { title: '特价', dataIndex: 'special_price', key: 'special_price', width: 80, render: (price) => price ? `¥${price}` : '-' },
        { title: '供货价', dataIndex: 'cost_price', key: 'cost_price', width: 80, render: (price) => price ? `¥${price}` : '-' },
        { title: '重量(g)', dataIndex: 'weight', key: 'weight', width: 70 },
        {
          title: '上架状态',
          dataIndex: 'shelf_status',
          key: 'shelf_status',
          width: 80,
          render: (status) => {
            const statusMap = { 0: <Tag color="red">下架</Tag>, 1: <Tag color="green">上架</Tag> };
            return statusMap[status] || '-';
          }
        },
        {
          title: '销售状态',
          dataIndex: 'mall_state',
          key: 'mall_state',
          width: 80,
          render: (state) => {
            const stateMap = { 1: <Tag color="green">在售</Tag>, 2: <Tag color="red">停售</Tag> };
            return stateMap[state] || '-';
          }
        }
      ];
      return <Table columns={skuColumns} dataSource={skus} rowKey="id" pagination={false} size="small" scroll={{ x: 900 }} />;
    };

    return (
      <Table 
        columns={skcColumns} 
        dataSource={skcData} 
        rowKey="id" 
        pagination={false} 
        size="small"
        expandable={{ 
          expandedRowRender: skuExpandedRowRender,
          defaultExpandAllRows: false
        }}
      />
    );
  };

  const columns = [
    {
      title: '图片',
      dataIndex: 'main_image_url',
      key: 'main_image_url',
      width: 80,
      render: (imageUrl) =>
        imageUrl ? (
          <Image src={imageUrl} alt="商品图片" width={60} height={60} style={{ objectFit: 'cover', borderRadius: '4px' }} />
        ) : (
          <div style={{ width: '60px', height: '60px', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', fontSize: '12px', color: '#999' }}>
            无图片
          </div>
        )
    },
    { title: 'SPU编码', dataIndex: 'spu_name', key: 'spu_name', width: 150 },
    { title: '商品名称', dataIndex: 'product_name_cn', key: 'product_name_cn', width: 200 },
    { title: '品牌', dataIndex: 'brand_code', key: 'brand_code', width: 100 },
    {
      title: 'SKC数量',
      dataIndex: 'skc_count',
      key: 'skc_count',
      width: 100,
      render: (count) => <Tag color="purple">{count} 个SKC</Tag>
    },
    {
      title: 'SKU数量',
      dataIndex: 'sku_count',
      key: 'sku_count',
      width: 100,
      render: (count) => <Tag color="blue">{count} 个SKU</Tag>
    },
    { title: '原价', dataIndex: 'base_price', key: 'base_price', width: 100, render: (price) => price ? `¥${price}` : '-' },
    { title: '特价', dataIndex: 'special_price', key: 'special_price', width: 100, render: (price) => price ? `¥${price}` : '-' },
    { title: '供货价', dataIndex: 'cost_price', key: 'cost_price', width: 100, render: (price) => price ? `¥${price}` : '-' },
    {
      title: '上架状态',
      dataIndex: 'shelf_status',
      key: 'shelf_status',
      width: 100,
      render: (status) => {
        const statusMap = { 0: <Tag color="red">下架</Tag>, 1: <Tag color="green">上架</Tag> };
        return statusMap[status] || '-';
      }
    },
    {
      title: '销售状态',
      dataIndex: 'mall_state',
      key: 'mall_state',
      width: 100,
      render: (state) => {
        const stateMap = { 1: <Tag color="green">在售</Tag>, 2: <Tag color="red">停售</Tag> };
        return stateMap[state] || '-';
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button 
            type="link" 
            size="small"
            onClick={() => handleViewDetail(record)}
          >
            查看详情
          </Button>
          <Button 
            type="link" 
            size="small"
            onClick={() => handleQuerySales('spu', record.spu_name, null)}
          >
            查询销量
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => handleOpenBarcodePrint(record)}
          >
            打印条码
          </Button>
          <Button 
            type="link" 
            size="small"
            onClick={() => handleCopyToErp(record)}
          >
            复制到ERP
          </Button>
        </Space>
      )
    }

  ];

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <Space>
          <Select
            style={{ width: 150 }}
            placeholder="选择平台"
            value={selectedPlatform}
            onChange={setSelectedPlatform}
            options={[
              { label: 'SHEIN', value: 'shein_full' },
              { label: 'Amazon', value: 'amazon' },
              { label: 'eBay', value: 'ebay' }
            ]}
          />

        </Space>
      </div>

      {/* 筛选查询表单 */}
      <div style={{ marginBottom: '16px', background: '#fafafa', padding: '16px', borderRadius: '4px' }}>
        <Form
          form={searchForm}
          layout="inline"
          onFinish={handleSearch}
        >
          <Form.Item name="keyword" label="关键词">
            <Input
              placeholder="搜索SPU/SKU/商品名称"
              style={{ width: 250 }}
              allowClear
            />
          </Form.Item>

          {selectedPlatform === 'shein_full' && (
            <Form.Item name="shop_id" label="店铺">
              <Select
                placeholder="全部店铺"
                style={{ width: 220 }}
                allowClear
                showSearch
                optionFilterProp="label"
                options={shops.map(shop => ({
                  label: shop.shop_name || `店铺 ${shop.id}`,
                  value: shop.id
                }))}
              />
            </Form.Item>
          )}
          
          <Form.Item name="shelf_status" label="上架状态">
            <Select
              placeholder="全部"
              style={{ width: 120 }}
              allowClear
              options={[
                { label: '上架', value: 1 },
                { label: '下架', value: 0 }
              ]}
            />
          </Form.Item>
          
          <Form.Item name="mall_state" label="销售状态">
            <Select
              placeholder="全部"
              style={{ width: 120 }}
              allowClear
              options={[
                { label: '在售', value: 1 },
                { label: '停售', value: 2 }
              ]}
            />
          </Form.Item>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                查询
              </Button>
              <Button onClick={handleReset}>
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </div>

      <Table
        columns={columns}
        dataSource={tableData}
        loading={loading}
        rowKey="id"
        expandable={{ expandedRowRender, defaultExpandAllRows: false }}
        pagination={{
          current: currentPage,
          pageSize: pageSize,
          total: totalSpu,
          pageSizeOptions: ['10', '20', '50', '100'],
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 个SPU`,
          onChange: (page, size) => {
            setCurrentPage(page);
            if (size !== pageSize) {
              setPageSize(size);
              setCurrentPage(1);
            }
          }
        }}
      />

      <Modal
        title="商品同步"
        open={syncModalVisible}
        width={600}
        onCancel={() => {
          setSyncModalVisible(false);
          if (syncStep === 1) {
            message.info('同步任务将在后台继续执行');
          }
        }}
        footer={null}
        closable={true}
      >
        {syncStep === 0 && (
          <div>
            <Form layout="vertical">
              <Form.Item label="店铺" required>
                <Select
                  placeholder="请选择要同步的店铺"
                  value={syncConfig.selectedShopId}
                  onChange={(value) => setSyncConfig({ ...syncConfig, selectedShopId: value })}
                  options={shops.map(shop => ({ label: shop.shop_name || `店铺 ${shop.id}`, value: shop.id }))}
                />
              </Form.Item>
              <Form.Item>
                <input
                  type="checkbox"
                  checked={syncConfig.isFullSync}
                  onChange={(e) => setSyncConfig({ ...syncConfig, isFullSync: e.target.checked })}
                />
                <span style={{ marginLeft: '8px' }}>全店同步</span>
              </Form.Item>
            </Form>
            <div style={{ textAlign: 'right' }}>
              <Button onClick={() => setSyncModalVisible(false)} style={{ marginRight: '8px' }}>
                取消
              </Button>
              <Button type="primary" onClick={handleStartSync} disabled={!syncConfig.selectedShopId}>
                开始同步
              </Button>
            </div>
          </div>
        )}

        {syncStep === 1 && (
          <div>
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <LoadingOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
              <div style={{ fontSize: '16px', marginBottom: '8px' }}>{syncProgress.message}</div>
              <div style={{ fontSize: '14px', color: '#999' }}>您可以关闭此窗口，同步将在后台继续</div>
            </div>
            <div style={{ textAlign: 'right', marginTop: '16px' }}>
              <Button onClick={() => {
                setSyncModalVisible(false);
                message.info('同步任务将在后台继续执行');
              }}>
                后台运行
              </Button>
            </div>
          </div>
        )}

        {syncStep === 2 && syncResult && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              {syncResult.success ? (
                <CheckCircleOutlined style={{ fontSize: '48px', color: '#52c41a' }} />
              ) : (
                <div style={{ fontSize: '48px', color: '#ff4d4f' }}>✕</div>
              )}
            </div>
            <div style={{ textAlign: 'center', fontSize: '16px', marginBottom: '8px' }}>{syncResult.message}</div>
            <div style={{ textAlign: 'right' }}>
              <Button type="primary" onClick={() => setSyncModalVisible(false)}>
                关闭
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 销量查询弹窗 */}
      <Modal
        title="SKU销量查询"
        open={salesModalVisible}
        onCancel={() => setSalesModalVisible(false)}
        footer={null}
        width={900}
      >
        {salesLoading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <LoadingOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
            <div style={{ marginTop: '16px' }}>正在查询销量数据...</div>
          </div>
        ) : salesData ? (
          <div>
            <div style={{ marginBottom: '16px', padding: '12px', background: '#f5f5f5', borderRadius: '4px' }}>
              <div><strong>商品名称：</strong>{salesData.productNameCn || salesData.productNameEn}</div>
              <div><strong>SPU编码：</strong>{salesData.spuName}</div>
              <div><strong>查询模式：</strong>{salesData.queryMode === 'spu' ? 'SPU模式（所有SKC）' : 'SKC模式（单个SKC）'}</div>
              <div><strong>总SKU数：</strong>{salesData.totalSkuCount} 个</div>
              {salesData.dataDate && <div><strong>数据日期：</strong>{salesData.dataDate}</div>}
            </div>

            {salesData.skcList.map((skc, idx) => (
              <div key={idx} style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', padding: '8px', background: '#fafafa', borderRadius: '4px' }}>
                  {skc.skcImage && (
                    <Image src={skc.skcImage} width={50} height={50} style={{ marginRight: '12px', borderRadius: '4px' }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div><strong>SKC编码：</strong>{skc.skcName}</div>
                    <div style={{ marginTop: '4px' }}>
                      <Tag color="blue">当日: {skc.totalRealTimeSales}</Tag>
                      <Tag color="green">7天: {skc.total7dSales}</Tag>
                      <Tag color="orange">30天: {skc.total30dSales}</Tag>
                      <Tag color="purple">昨日: {skc.totalYesterdaySales}</Tag>
                    </div>
                  </div>
                </div>

                <Table
                  size="small"
                  dataSource={skc.skuList}
                  rowKey="skuCode"
                  pagination={false}
                  columns={[
                    { title: 'SKU编码', dataIndex: 'skuCode', key: 'skuCode', width: 150 },
                    { title: '规格', dataIndex: 'saleAttribute', key: 'saleAttribute', width: 150 },
                    { 
                      title: '当日销量', 
                      dataIndex: 'realTimeSaleCnt', 
                      key: 'realTimeSaleCnt', 
                      width: 100,
                      render: (val) => <Tag color="blue">{val || 0}</Tag>
                    },
                    { 
                      title: '昨日销量', 
                      dataIndex: 'cydSaleCnt', 
                      key: 'cydSaleCnt', 
                      width: 100,
                      render: (val) => <Tag color="purple">{val || 0}</Tag>
                    },
                    { 
                      title: '7天销量', 
                      dataIndex: 'c7dSaleCnt', 
                      key: 'c7dSaleCnt', 
                      width: 100,
                      render: (val) => <Tag color="green">{val || 0}</Tag>
                    },
                    { 
                      title: '30天销量', 
                      dataIndex: 'c30dSaleCnt', 
                      key: 'c30dSaleCnt', 
                      width: 100,
                      render: (val) => <Tag color="orange">{val || 0}</Tag>
                    }
                  ]}
                />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            暂无数据
          </div>
        )}
      </Modal>

      {/* 商品详情弹窗 */}
      <Modal
        title={`商品详情 - ${detailRecord?.spu_name || ''}`}
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setDetailRecord(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setDetailModalVisible(false);
            setDetailRecord(null);
          }}>
            关闭
          </Button>,
          <Button key="copy" type="primary" onClick={() => {
            setDetailModalVisible(false);
            handleCopyToErp(detailRecord);
          }}>
            复制到ERP
          </Button>
        ]}
        width={1000}
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      >
        {detailRecord && (
          <div>
            {/* SPU基本信息 */}
            <div style={{ marginBottom: '24px', padding: '16px', background: '#f5f5f5', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                {detailRecord.main_image_url && (
                  <Image 
                    src={detailRecord.main_image_url} 
                    width={120} 
                    height={120} 
                    style={{ marginRight: '20px', borderRadius: '8px', objectFit: 'cover' }} 
                  />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}>
                    {detailRecord.product_name_cn || detailRecord.spu_name}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '14px' }}>
                    <div><strong>SPU编码：</strong>{detailRecord.spu_name}</div>
                    <div><strong>品牌：</strong>{detailRecord.brand_code || '-'}</div>
                    <div><strong>SKC数量：</strong><Tag color="purple">{detailRecord.skc_count} 个</Tag></div>
                    <div><strong>SKU数量：</strong><Tag color="blue">{detailRecord.sku_count} 个</Tag></div>
                    <div><strong>原价：</strong>{detailRecord.base_price ? `¥${detailRecord.base_price}` : '-'}</div>
                    <div><strong>特价：</strong>{detailRecord.special_price ? `¥${detailRecord.special_price}` : '-'}</div>
                    <div><strong>供货价：</strong>{detailRecord.cost_price ? `¥${detailRecord.cost_price}` : '-'}</div>
                    <div>
                      <strong>上架状态：</strong>
                      {detailRecord.shelf_status === 1 ? <Tag color="green">上架</Tag> : <Tag color="red">下架</Tag>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SKC列表 */}
            <div style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 'bold' }}>
              SKC列表 ({getDetailSkcList().length} 个)
            </div>
            
            {getDetailSkcList().map((skc, skcIndex) => (
              <div key={skcIndex} style={{ 
                marginBottom: '20px', 
                border: '1px solid #e8e8e8', 
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                {/* SKC头部信息 */}
                <div style={{ 
                  padding: '16px', 
                  background: '#fafafa', 
                  borderBottom: '1px solid #e8e8e8',
                  display: 'flex',
                  alignItems: 'flex-start'
                }}>
                  {/* SKC主图 */}
                  <div style={{ marginRight: '16px' }}>
                    {skc.main_image_url ? (
                      <Image 
                        src={skc.main_image_url} 
                        width={80} 
                        height={80} 
                        style={{ borderRadius: '4px', objectFit: 'cover' }} 
                      />
                    ) : (
                      <div style={{ 
                        width: 80, 
                        height: 80, 
                        background: '#f0f0f0', 
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#999'
                      }}>
                        无图
                      </div>
                    )}
                  </div>
                  
                  {/* SKC信息 */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '8px' }}>
                      SKC: {skc.skc_name}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', fontSize: '13px' }}>
                      <div><strong>商品名称：</strong>{skc.product_name_cn || '-'}</div>
                      <div><strong>原价：</strong>{skc.base_price ? `¥${skc.base_price}` : '-'}</div>
                      <div><strong>特价：</strong>{skc.special_price ? `¥${skc.special_price}` : '-'}</div>
                      <div><strong>供货价：</strong>{skc.cost_price ? `¥${skc.cost_price}` : '-'}</div>
                      <div>
                        <strong>上架：</strong>
                        {skc.shelf_status === 1 ? <Tag color="green" size="small">是</Tag> : <Tag color="red" size="small">否</Tag>}
                      </div>
                      <div>
                        <strong>销售：</strong>
                        {skc.mall_state === 1 ? <Tag color="green" size="small">在售</Tag> : <Tag color="red" size="small">停售</Tag>}
                      </div>
                    </div>
                    <div style={{ marginTop: '4px' }}>
                      <Tag color="blue">{skc.skus.length} 个SKU</Tag>
                    </div>
                  </div>
                </div>

                {/* SKC图片展示 - 分类显示所有图片 */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8e8e8' }}>
                  {/* 商品图片 */}
                  {skc.images && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#1890ff' }}>
                        📷 商品图片：
                      </div>
                      <Image.PreviewGroup>
                        <Space wrap size={8}>
                          {(() => {
                            try {
                              const imgs = typeof skc.images === 'string' ? JSON.parse(skc.images) : skc.images;
                              if (Array.isArray(imgs)) {
                                return imgs.map((img, imgIdx) => {
                                  const imgUrl = typeof img === 'string' ? img : (img.imageUrl || img.image_url);
                                  const imgType = img.imageType || img.image_type;
                                  return imgUrl ? (
                                    <div key={imgIdx} style={{ textAlign: 'center' }}>
                                      <Image 
                                        src={imgUrl} 
                                        width={70} 
                                        height={70} 
                                        style={{ borderRadius: '4px', objectFit: 'cover' }} 
                                      />
                                      {imgType && (
                                        <div style={{ fontSize: '10px', color: '#999', marginTop: '2px' }}>
                                          {imgType === 1 ? '主图' : imgType === 2 ? '细节' : imgType === 5 ? '方块' : imgType === 6 ? '色块' : `类型${imgType}`}
                                        </div>
                                      )}
                                    </div>
                                  ) : null;
                                }).filter(Boolean);
                              }
                            } catch (e) {}
                            return <span style={{ color: '#999' }}>无图片</span>;
                          })()}
                        </Space>
                      </Image.PreviewGroup>
                    </div>
                  )}
                  
                  {/* 详情图 */}
                  {skc.site_detail_image_list && (
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#52c41a' }}>
                        🖼️ 详情图：
                      </div>
                      <Image.PreviewGroup>
                        <Space wrap size={8}>
                          {(() => {
                            try {
                              const detailImgs = typeof skc.site_detail_image_list === 'string' 
                                ? JSON.parse(skc.site_detail_image_list) 
                                : skc.site_detail_image_list;
                              if (Array.isArray(detailImgs)) {
                                return detailImgs.map((img, imgIdx) => {
                                  const imgUrl = typeof img === 'string' ? img : (img.imageUrl || img.image_url);
                                  return imgUrl ? (
                                    <Image 
                                      key={imgIdx}
                                      src={imgUrl} 
                                      width={70} 
                                      height={70} 
                                      style={{ borderRadius: '4px', objectFit: 'cover' }} 
                                    />
                                  ) : null;
                                }).filter(Boolean);
                              }
                            } catch (e) {}
                            return <span style={{ color: '#999' }}>无详情图</span>;
                          })()}
                        </Space>
                      </Image.PreviewGroup>
                    </div>
                  )}
                  
                  {/* 如果都没有图片 */}
                  {!skc.images && !skc.site_detail_image_list && (
                    <div style={{ color: '#999', fontSize: '13px' }}>暂无图片</div>
                  )}
                </div>

                {/* SKU列表 */}
                <div style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>SKU列表：</div>
                  <Table
                    size="small"
                    dataSource={skc.skus}
                    rowKey="sku_code"
                    pagination={false}
                    columns={[
                      { 
                        title: '图片', 
                        dataIndex: 'main_image_url', 
                        width: 60,
                        render: (url) => url ? (
                          <Image src={url} width={40} height={40} style={{ objectFit: 'cover', borderRadius: '4px' }} />
                        ) : '-'
                      },
                      { title: 'SKU编码', dataIndex: 'sku_code', width: 150 },
                      { title: '商家SKU', dataIndex: 'supplier_sku', width: 120 },
                      { 
                        title: '规格', 
                        dataIndex: 'sale_attribute_list', 
                        width: 150,
                        render: (attrs) => {
                          if (!attrs) return '-';
                          try {
                            const attrList = typeof attrs === 'string' ? JSON.parse(attrs) : attrs;
                            if (Array.isArray(attrList)) {
                              return attrList.map(a => a.attributeValueName || a.value || '').filter(Boolean).join(', ') || '-';
                            }
                          } catch (e) {}
                          return '-';
                        }
                      },
                      { title: '原价', dataIndex: 'base_price', width: 80, render: (v) => v ? `¥${v}` : '-' },
                      { title: '特价', dataIndex: 'special_price', width: 80, render: (v) => v ? `¥${v}` : '-' },
                      { title: '供货价', dataIndex: 'cost_price', width: 80, render: (v) => v ? `¥${v}` : '-' },
                      { title: '重量(g)', dataIndex: 'weight', width: 70 },
                      { 
                        title: '尺寸(cm)', 
                        width: 120,
                        render: (_, record) => {
                          if (record.length || record.width || record.height) {
                            return `${record.length || 0}×${record.width || 0}×${record.height || 0}`;
                          }
                          return '-';
                        }
                      },
                      {
                        title: '状态',
                        width: 100,
                        render: (_, record) => (
                          <Space size={4}>
                            {record.shelf_status === 1 ? <Tag color="green" size="small">上架</Tag> : <Tag color="red" size="small">下架</Tag>}
                            {record.mall_state === 1 ? <Tag color="blue" size="small">在售</Tag> : <Tag color="orange" size="small">停售</Tag>}
                          </Space>
                        )
                      }
                    ]}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* SHEIN条码打印弹窗 */}
      <Modal
        title={`打印条码 - ${barcodePrintSpuName || ''}${barcodePrintSkcName ? ` / ${barcodePrintSkcName}` : ''}`}
        open={barcodePrintModalVisible}
        onCancel={() => {
          setBarcodePrintModalVisible(false);
          setBarcodePrintSkcName('');
          setBarcodePrintSource('local');
        }}
        onOk={handlePrintBarcode}
        confirmLoading={barcodePrintLoading}
        width={900}
        okText="生成自定义条码PDF"
      >
        <div style={{ marginBottom: '12px', color: '#666' }}>
          将按采购单页面的自定义条码样式生成标签，包含类目、条码/商家SKU、SHEIN SKU、SKC、规格，不显示订单号。
        </div>
        <div style={{ marginBottom: '12px' }}>
          <Space>
            <span>条码来源：</span>
            <Select
              style={{ width: 160 }}
              value={barcodePrintSource}
              onChange={setBarcodePrintSource}
              options={[
                { label: '本地条码', value: 'local' },
                { label: '官方条码', value: 'official' }
              ]}
            />
          </Space>
        </div>
        <Table
          size="small"
          dataSource={barcodePrintData}
          rowKey="id"
          pagination={false}
          scroll={{ x: 800, y: 360 }}
          columns={[
            { title: 'SKC', dataIndex: 'skcName', key: 'skcName', width: 120 },
            { title: 'SHEIN SKU', dataIndex: 'sheinSku', key: 'sheinSku', width: 160 },
            { title: '商家SKU', dataIndex: 'supplierSku', key: 'supplierSku', width: 140, render: (v) => v || '-' },
            { title: '规格', dataIndex: 'sizeText', key: 'sizeText', width: 140, render: (v) => v || '-' },
            {
              title: '打印数量',
              key: 'printNumber',
              width: 120,
              render: (_, row) => (
                <InputNumber
                  min={0}
                  max={2000}
                  value={row.printNumber}
                  onChange={(value) => handleBarcodeRowChange(row.id, 'printNumber', value || 0)}
                />
              )
            }
          ]}
        />
      </Modal>

      {/* 复制到ERP确认弹窗 */}
      <Modal
        title="复制商品到ERP"
        open={copyModalVisible}
        onCancel={() => {
          setCopyModalVisible(false);
          setCopyingRecord(null);
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setCopyModalVisible(false);
            setCopyingRecord(null);
          }}>
            取消
          </Button>,
          <Button key="confirm" type="primary" loading={copyLoading} onClick={handleConfirmCopy}>
            确认复制
          </Button>
        ]}
        width={700}
      >
        {copyingRecord && (
          <div>
            <div style={{ marginBottom: '16px', padding: '12px', background: '#f5f5f5', borderRadius: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {copyingRecord.main_image_url && (
                  <Image 
                    src={copyingRecord.main_image_url} 
                    width={80} 
                    height={80} 
                    style={{ marginRight: '16px', borderRadius: '4px', objectFit: 'cover' }} 
                  />
                )}
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
                    {copyingRecord.product_name_cn || copyingRecord.spu_name}
                  </div>
                  <div><strong>SPU编码：</strong>{copyingRecord.spu_name}</div>
                  <div style={{ marginTop: '4px' }}>
                    <Tag color="purple">{copyingRecord.skc_count} 个SKC</Tag>
                    <Tag color="blue">{copyingRecord.sku_count} 个SKU</Tag>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>将复制以下SKC到ERP商品库：</div>
            
            <Table
              size="small"
              dataSource={getCopySkcList()}
              rowKey="skc_name"
              pagination={false}
              columns={[
                {
                  title: '图片',
                  dataIndex: 'main_image_url',
                  key: 'main_image_url',
                  width: 60,
                  render: (url) => url ? (
                    <Image src={url} width={40} height={40} style={{ objectFit: 'cover', borderRadius: '4px' }} />
                  ) : (
                    <div style={{ width: 40, height: 40, background: '#f0f0f0', borderRadius: '4px' }} />
                  )
                },
                { title: 'SKC编码', dataIndex: 'skc_name', key: 'skc_name', width: 200 },
                { title: '商品名称', dataIndex: 'product_name_cn', key: 'product_name_cn' },
                { 
                  title: 'SKU数量', 
                  dataIndex: 'sku_count', 
                  key: 'sku_count', 
                  width: 100,
                  render: (count) => <Tag color="blue">{count} 个</Tag>
                }
              ]}
            />

            <div style={{ marginTop: '16px', padding: '12px', background: '#e6f7ff', borderRadius: '4px', border: '1px solid #91d5ff' }}>
              <div style={{ color: '#1890ff' }}>
                <strong>说明：</strong>复制后将在ERP商品库中创建一个SPU，包含上述所有SKC和SKU。
              </div>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}

export default OnlineProducts;
