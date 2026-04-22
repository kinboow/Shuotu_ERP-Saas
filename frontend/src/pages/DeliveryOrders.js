import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Table, Tag, Space, Button, Input, message, Card, DatePicker
} from 'antd';
import { 
  SearchOutlined, ReloadOutlined, EyeOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// 启用时区插件
dayjs.extend(utc);
dayjs.extend(timezone);

const { RangePicker } = DatePicker;

// 格式化日期时间 - 转换为UTC+8时区
const formatDateTime = (dateStr) => {
  if (!dateStr || dateStr === '1970-01-01 08:00:01' || dateStr === '1970-01-01T00:00:01.000Z') return '-';
  
  try {
    // 使用dayjs转换为上海时区
    const date = dayjs(dateStr).tz('Asia/Shanghai');
    if (!date.isValid()) return dateStr;
    return date.format('YYYY-MM-DD HH:mm:ss');
  } catch (e) {
    return dateStr;
  }
};

function DeliveryOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({ 
    delivery_code: '', 
    start_date: undefined,
    end_date: undefined,
    platform: 'shein' // 平台筛选：shein, temu, tiktok
  });
  const [syncLoading, setSyncLoading] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, [pagination.current, pagination.pageSize, filters.platform]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        ...filters
      };
      
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === undefined || params[key] === null) {
          delete params[key];
        }
      });
      
      // 调用发货单API
      const response = await fetch(`/api/delivery-orders?${new URLSearchParams(params)}`);
      const data = await response.json();
      
      if (data.success) {
        setOrders(data.data);
        setPagination(prev => ({
          ...prev,
          total: data.total
        }));
      }
    } catch (error) {
      message.error('获取发货单失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchOrders();
  };

  const handleSyncOrders = async () => {
    setSyncLoading(true);
    try {
      const response = await fetch('/api/delivery-orders/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: 1,
          startTime: filters.start_date,
          endTime: filters.end_date
        })
      });

      const data = await response.json();

      if (data.success) {
        message.success('同步任务已启动');
        setTimeout(() => {
          fetchOrders();
        }, 3000);
      } else {
        message.error('同步失败: ' + data.message);
      }
    } catch (error) {
      message.error('同步失败: ' + error.message);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleViewDetail = (order) => {
    window.open(`/delivery-orders/${order.id}?code=${encodeURIComponent(order.delivery_code)}`, '_blank');
  };

  const handleTableChange = (newPagination) => {
    setPagination({
      ...pagination,
      current: newPagination.current,
      pageSize: newPagination.pageSize
    });
  };

  const columns = [
    {
      title: '发货单号',
      dataIndex: 'delivery_code',
      key: 'delivery_code',
      width: 180,
      fixed: 'left',
      render: (text) => <span style={{ color: '#1890ff', fontWeight: 500 }}>{text}</span>
    },
    {
      title: '发货方式',
      dataIndex: 'delivery_type_name',
      key: 'delivery_type_name',
      width: 120,
      render: (text) => <Tag color="blue">{text}</Tag>
    },
    {
      title: '快递公司',
      dataIndex: 'express_company_name',
      key: 'express_company_name',
      width: 120,
      render: (text) => text || '-'
    },
    {
      title: '快递单号',
      dataIndex: 'express_code',
      key: 'express_code',
      width: 150,
      render: (text) => text || '-'
    },
    {
      title: '包裹数',
      dataIndex: 'send_package',
      key: 'send_package',
      width: 80,
      align: 'center',
      render: (num) => <span>{num || 0}</span>
    },
    {
      title: '重量(kg)',
      dataIndex: 'package_weight',
      key: 'package_weight',
      width: 100,
      align: 'center',
      render: (weight) => <span>{weight || 0}</span>
    },
    {
      title: 'SKU数',
      dataIndex: 'total_sku_count',
      key: 'total_sku_count',
      width: 80,
      align: 'center',
      render: (count) => <span style={{ fontWeight: 'bold' }}>{count || 0}</span>
    },
    {
      title: '发货数量',
      dataIndex: 'total_delivery_quantity',
      key: 'total_delivery_quantity',
      width: 100,
      align: 'center',
      render: (qty) => <span style={{ fontWeight: 'bold', color: '#52c41a' }}>{qty || 0}</span>
    },
    {
      title: '发货时间',
      dataIndex: 'add_time',
      key: 'add_time',
      width: 160,
      render: (time) => formatDateTime(time)
    },
    {
      title: '预计到货',
      dataIndex: 'pre_receipt_time',
      key: 'pre_receipt_time',
      width: 160,
      render: (time) => formatDateTime(time)
    },
    {
      title: '仓库',
      dataIndex: 'supplier_warehouse_name',
      key: 'supplier_warehouse_name',
      width: 150,
      ellipsis: true,
      render: (text) => text || '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button 
          type="link" 
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record)}
        >
          查看明细
        </Button>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 24 }}>发货单管理</h1>

      {/* 筛选模块 */}
      <Card style={{ marginBottom: 16 }}>
        {/* 平台筛选行 - SVG图标 */}
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: '#666' }}>平台：</span>
          {/* SHEIN */}
          <div
            onClick={() => setFilters({ ...filters, platform: 'shein' })}
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
            onClick={() => setFilters({ ...filters, platform: 'temu' })}
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
            onClick={() => setFilters({ ...filters, platform: 'tiktok' })}
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
          <Input
            placeholder="发货单号"
            prefix={<SearchOutlined />}
            value={filters.delivery_code}
            onChange={(e) => setFilters({ ...filters, delivery_code: e.target.value })}
            onPressEnter={handleSearch}
            style={{ width: 200 }}
            allowClear
          />
          <RangePicker
            placeholder={['开始时间', '结束时间']}
            style={{ width: 280 }}
            onChange={(dates) => {
              if (dates) {
                setFilters({
                  ...filters,
                  start_date: dates[0]?.format('YYYY-MM-DD HH:mm:ss'),
                  end_date: dates[1]?.format('YYYY-MM-DD HH:mm:ss')
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
      </Card>

      {/* 发货单表格 */}
      <Card>
        <Table
          columns={columns}
          dataSource={orders}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            pageSizeOptions: ['10', '20', '50', '100']
          }}
          onChange={handleTableChange}
          scroll={{ x: 1800 }}
          size="middle"
        />
      </Card>


    </div>
  );
}

export default DeliveryOrders;