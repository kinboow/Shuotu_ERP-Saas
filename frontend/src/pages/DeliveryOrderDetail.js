import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Table, Tag, Space, Button, message, Spin } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// 启用时区插件
dayjs.extend(utc);
dayjs.extend(timezone);

// 格式化日期时间 - 转换为UTC+8时区
const formatDateTime = (dateStr) => {
  if (!dateStr || dateStr === '1970-01-01 08:00:01' || dateStr === '1970-01-01T00:00:01.000Z') return '-';
  try {
    const date = dayjs(dateStr).tz('Asia/Shanghai');
    if (!date.isValid()) return dateStr;
    return date.format('YYYY-MM-DD HH:mm:ss');
  } catch (e) {
    return dateStr;
  }
};

function DeliveryOrderDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const deliveryCode = searchParams.get('code') || '';
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('goods'); // goods: 货件信息, box: 箱子标签

  useEffect(() => {
    fetchOrderDetail();
  }, [id]);

  const fetchOrderDetail = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/delivery-orders/${id}`);
      const data = await response.json();
      if (data.success) {
        setOrder(data.data);
      } else {
        message.error('获取发货单详情失败');
      }
    } catch (error) {
      message.error('获取发货单详情失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', paddingTop: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!order) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#999', paddingTop: 100 }}>
        未找到发货单信息
      </div>
    );
  }

  // 计算合计
  const totalStats = {
    申报备货数量: order.items?.reduce((sum, item) => sum + (item.delivery_quantity || 0), 0) || 0,
    总发货实数: order.items?.reduce((sum, item) => sum + (item.delivery_quantity || 0), 0) || 0,
    待审核数量: 0,
    包裹内发货码数: order.items?.length || 0
  };


  return (
    <div style={{ padding: '16px 24px', background: '#fff', minHeight: 'calc(100vh - 55px)' }}>
      {/* 顶部标题栏 */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: 16,
        padding: '12px 0',
        borderBottom: '1px solid #f0f0f0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 'bold' }}>{order.delivery_code}</span>
          <Tag color="orange">待收货</Tag>

        </div>
        <Space>
          <Button>打印商品条码</Button>
          <Button>操作日志</Button>
        </Space>
      </div>

      {/* 发货信息 */}
      <div style={{ 
        border: '1px solid #e8e8e8', 
        borderRadius: 4, 
        marginBottom: 16 
      }}>
        <div style={{ 
          padding: '8px 16px', 
          borderBottom: '1px solid #e8e8e8',
          fontWeight: 500,
          fontSize: 14
        }}>
          发货信息
        </div>
        <div style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px 48px' }}>
            <div style={{ minWidth: 150 }}>
              <span style={{ color: '#999', marginRight: 8 }}>发货方式：</span>
              <span>{order.delivery_type_name || '快递'}</span>
            </div>
            <div style={{ minWidth: 150 }}>
              <span style={{ color: '#999', marginRight: 8 }}>发货仓库：</span>
              <span>{order.supplier_warehouse_name || '-'}</span>
            </div>
            <div style={{ minWidth: 150 }}>
              <span style={{ color: '#999', marginRight: 8 }}>发货地址：</span>
              <span>{order.address || '-'}</span>
            </div>
            <div style={{ minWidth: 200 }}>
              <span style={{ color: '#999', marginRight: 8 }}>预约取件时间：</span>
              <span>{formatDateTime(order.reserve_parcel_time) || '-'}</span>
            </div>
            <div style={{ minWidth: 150 }}>
              <span style={{ color: '#999', marginRight: 8 }}>打效产品：</span>
              <span>{order.product_type || '-'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px 48px', marginTop: 12 }}>
            <div style={{ minWidth: 150 }}>
              <span style={{ color: '#999', marginRight: 8 }}>总包裹数：</span>
              <span>{order.send_package || 0}</span>
            </div>
            <div style={{ minWidth: 150 }}>
              <span style={{ color: '#999', marginRight: 8 }}>包裹重量：</span>
              <span>{order.package_weight || 0} KG</span>
            </div>
            <div style={{ minWidth: 150 }}>
              <span style={{ color: '#999', marginRight: 8 }}>快递公司：</span>
              <span>{order.express_company_name || '-'}</span>
            </div>
            <div style={{ minWidth: 200 }}>
              <span style={{ color: '#999', marginRight: 8 }}>快递单号：</span>
              <span>{order.express_code || '-'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab切换 - 带尖角箭头样式 */}
      <div style={{ 
        display: 'flex', 
        marginBottom: 16,
        position: 'relative',
        height: 40
      }}>
        {/* 货件信息标签 */}
        <div 
          onClick={() => setActiveTab('goods')}
          style={{ 
            position: 'relative',
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: activeTab === 'goods' ? '#fff' : '#666',
            fontWeight: activeTab === 'goods' ? 'bold' : 'normal',
            background: activeTab === 'goods' ? '#28a864' : '#fff',
            border: activeTab === 'goods' ? 'none' : '1px solid #e8e8e8',
            zIndex: 2
          }}
        >
          <span style={{ 
            width: 18, 
            height: 18, 
            borderRadius: '50%', 
            background: activeTab === 'goods' ? '#fff' : '#ccc',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 8,
            fontSize: 11,
            color: activeTab === 'goods' ? '#28a864' : '#fff',
            fontWeight: 'bold'
          }}>✓</span>
          货件信息
          {/* 右侧箭头 */}
          <div style={{
            position: 'absolute',
            right: -10,
            top: 0,
            width: 0,
            height: 0,
            borderTop: '20px solid transparent',
            borderBottom: '20px solid transparent',
            borderLeft: `10px solid ${activeTab === 'goods' ? '#28a864' : '#fff'}`,
            zIndex: 3
          }} />
        </div>
        {/* 箱子标签 */}
        <div 
          onClick={() => setActiveTab('box')}
          style={{ 
            position: 'relative',
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: activeTab === 'box' ? '#fff' : '#666',
            fontWeight: activeTab === 'box' ? 'bold' : 'normal',
            background: activeTab === 'box' ? '#28a864' : '#fff',
            border: activeTab === 'box' ? 'none' : '1px solid #e8e8e8',
            zIndex: 1
          }}
        >
          <span style={{ 
            width: 18, 
            height: 18, 
            borderRadius: '50%', 
            background: activeTab === 'box' ? '#fff' : '#ccc',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 8,
            fontSize: 11,
            color: activeTab === 'box' ? '#28a864' : '#fff',
            fontWeight: 'bold'
          }}>✓</span>
          箱子标签
          {/* 右侧箭头 */}
          <div style={{
            position: 'absolute',
            right: -10,
            top: 0,
            width: 0,
            height: 0,
            borderTop: '20px solid transparent',
            borderBottom: '20px solid transparent',
            borderLeft: `10px solid ${activeTab === 'box' ? '#28a864' : '#fff'}`,
            zIndex: 3
          }} />
        </div>
      </div>

      {/* 包裹信息 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
          <Space>
            <span style={{ fontWeight: 500 }}>包裹信息</span>
            <Button type="link" size="small">按SKU明细展示</Button>
            <Button type="link" size="small">按SKC明细展示</Button>
          </Space>
        </div>
        
        {/* 商品表格 */}
        <Table
          dataSource={order.items || []}
          rowKey={(record, index) => record.id || index}
          pagination={false}
          size="small"
          bordered
          scroll={{ x: 1100 }}
          columns={[
            {
              title: '商品信息',
              key: 'product_info',
              width: 250,
              fixed: 'left',
              render: (_, record) => (
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{
                    width: 50, height: 50, background: '#f5f5f5', borderRadius: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <img
                      src={record.image_url || '/placeholder.png'}
                      alt=""
                      style={{ maxWidth: '100%', maxHeight: '100%' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: '#1890ff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      备货单号: {record.order_no}
                    </div>
                    <div style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      SKC: {record.skc}
                    </div>
                  </div>
                </div>
              )
            },
            {
              title: 'MSKU ID',
              dataIndex: 'sku_code',
              key: 'msku_id',
              width: 120,
              render: (text) => text || '-'
            },
            {
              title: '品名/SKU',
              key: 'sku_name',
              width: 100,
              render: () => <Tag color="blue">备件</Tag>
            },
            {
              title: '申报备货实数',
              dataIndex: 'delivery_quantity',
              key: 'apply_qty',
              width: 110,
              align: 'center'
            },
            {
              title: '总发货实数',
              dataIndex: 'delivery_quantity',
              key: 'total_qty',
              width: 100,
              align: 'center'
            },
            {
              title: '待审核数量',
              key: 'pending_qty',
              width: 100,
              align: 'center',
              render: () => 0
            },
            {
              title: '可用库存',
              key: 'available_stock',
              width: 80,
              align: 'center',
              render: () => '-'
            },
            {
              title: '装箱仓库',
              key: 'warehouse',
              width: 100,
              render: () => '-'
            },
            {
              title: '包裹内发货码数',
              key: 'package_qty',
              width: 120,
              align: 'center',
              render: (_, record) => record.delivery_quantity || 0
            },
            {
              title: '包裹序号',
              key: 'package_no',
              width: 80,
              align: 'center',
              render: (_, record, index) => index + 1
            }
          ]}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row style={{ background: '#fafafa' }}>
                <Table.Summary.Cell index={0}>合计</Table.Summary.Cell>
                <Table.Summary.Cell index={1}></Table.Summary.Cell>
                <Table.Summary.Cell index={2}></Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="center">
                  <span style={{ fontWeight: 'bold' }}>{totalStats.申报备货数量}</span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4} align="center">
                  <span style={{ fontWeight: 'bold' }}>{totalStats.总发货实数}</span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="center">
                  <span style={{ fontWeight: 'bold' }}>{totalStats.待审核数量}</span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6}></Table.Summary.Cell>
                <Table.Summary.Cell index={7}></Table.Summary.Cell>
                <Table.Summary.Cell index={8} align="center">
                  <span style={{ fontWeight: 'bold' }}>{totalStats.包裹内发货码数}</span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={9}></Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </div>

      {/* 物流信息 */}
      <div style={{ background: '#fff', borderRadius: 4, padding: 16 }}>
        <div style={{ fontWeight: 500, marginBottom: 16 }}>物流信息</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px 24px', fontSize: 13 }}>
          <div>
            <div style={{ color: '#999', marginBottom: 4 }}>收货仓库：</div>
            <div>{order.supplier_warehouse_name || '-'}</div>
          </div>
          <div>
            <div style={{ color: '#999', marginBottom: 4 }}>收货地址：</div>
            <div>{order.receive_address || '-'}</div>
          </div>
          <div>
            <div style={{ color: '#999', marginBottom: 4 }}>发货地址：</div>
            <div>-</div>
          </div>
          <div>
            <div style={{ color: '#999', marginBottom: 4 }}>配送方式：</div>
            <div>{order.delivery_type_name || '-'}</div>
          </div>
          <div>
            <div style={{ color: '#999', marginBottom: 4 }}>发货重量 ①：</div>
            <div>{order.package_weight || 0} KG</div>
          </div>
          <div></div>
          <div>
            <div style={{ color: '#999', marginBottom: 4 }}>预约取件时间 ②：</div>
            <div>{formatDateTime(order.reserve_parcel_time)}</div>
          </div>
          <div>
            <div style={{ color: '#999', marginBottom: 4 }}>运单号揽收时间：</div>
            <div>-</div>
          </div>
          <div>
            <div style={{ color: '#999', marginBottom: 4 }}>物流公司：</div>
            <div>{order.express_company_name || '-'}</div>
          </div>
          <div>
            <div style={{ color: '#999', marginBottom: 4 }}>发货号数量：</div>
            <div>{order.send_package || 0}</div>
          </div>
          <div>
            <div style={{ color: '#999', marginBottom: 4 }}>平台签收确认签名：</div>
            <div>-</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DeliveryOrderDetail;
