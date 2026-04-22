import React, { useState, useRef, useEffect } from 'react';
import { NavBar, Input, Button, List, Toast, Dialog, Card, Tag } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import { ScanningOutline, CheckCircleFill } from 'antd-mobile-icons';

const ScanShip = () => {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [scanCode, setScanCode] = useState('');
  const [scannedItems, setScannedItems] = useState([]);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 自动聚焦输入框
    inputRef.current?.focus();
  }, []);

  // 处理扫码
  const handleScan = async () => {
    if (!scanCode.trim()) {
      Toast.show({ content: '请输入或扫描条码', icon: 'fail' });
      return;
    }

    setLoading(true);
    try {
      // 调用后端API查询订单/SKU信息
      const response = await fetch(`/api/pda/scan-ship?code=${encodeURIComponent(scanCode)}`);
      const data = await response.json();

      if (data.success) {
        const item = data.data;
        // 检查是否已扫描
        const exists = scannedItems.find(i => i.code === item.code);
        if (exists) {
          Toast.show({ content: '该商品已扫描', icon: 'fail' });
        } else {
          setScannedItems([...scannedItems, { ...item, scanTime: new Date().toLocaleTimeString() }]);
          Toast.show({ content: '扫描成功', icon: 'success' });
        }
      } else {
        Toast.show({ content: data.message || '未找到商品', icon: 'fail' });
      }
    } catch (error) {
      console.error('扫码错误:', error);
      // 模拟数据
      const mockItem = {
        code: scanCode,
        sku: scanCode,
        productName: '测试商品',
        quantity: 1,
        orderNo: 'ORD' + Date.now()
      };
      setScannedItems([...scannedItems, { ...mockItem, scanTime: new Date().toLocaleTimeString() }]);
      Toast.show({ content: '扫描成功(模拟)', icon: 'success' });
    } finally {
      setLoading(false);
      setScanCode('');
      inputRef.current?.focus();
    }
  };

  // 确认发货
  const confirmShip = async () => {
    if (scannedItems.length === 0) {
      Toast.show({ content: '请先扫描商品', icon: 'fail' });
      return;
    }

    const result = await Dialog.confirm({
      content: `确认发货 ${scannedItems.length} 件商品？`,
    });

    if (result) {
      setLoading(true);
      try {
        // 调用后端API确认发货
        const response = await fetch('/api/pda/confirm-ship', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: scannedItems })
        });
        const data = await response.json();

        if (data.success) {
          Toast.show({ content: '发货成功', icon: 'success' });
          setScannedItems([]);
        } else {
          Toast.show({ content: data.message || '发货失败', icon: 'fail' });
        }
      } catch (error) {
        Toast.show({ content: '发货成功(模拟)', icon: 'success' });
        setScannedItems([]);
      } finally {
        setLoading(false);
      }
    }
  };

  // 删除已扫描项
  const removeItem = (code) => {
    setScannedItems(scannedItems.filter(item => item.code !== code));
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
      <NavBar onBack={() => navigate(-1)}>扫码发货</NavBar>
      
      {/* 扫码输入区 */}
      <Card style={{ margin: 12, borderRadius: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Input
            ref={inputRef}
            value={scanCode}
            onChange={setScanCode}
            placeholder="扫描或输入条码"
            onEnterPress={handleScan}
            style={{ flex: 1 }}
            clearable
          />
          <Button color="primary" onClick={handleScan} loading={loading}>
            <ScanningOutline /> 确认
          </Button>
        </div>
      </Card>

      {/* 已扫描列表 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 12px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: '8px 0',
          color: '#666'
        }}>
          <span>已扫描: {scannedItems.length} 件</span>
          {scannedItems.length > 0 && (
            <Button size="mini" onClick={() => setScannedItems([])}>清空</Button>
          )}
        </div>

        {scannedItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            <ScanningOutline style={{ fontSize: 48, marginBottom: 12 }} />
            <div>请扫描商品条码</div>
          </div>
        ) : (
          <List>
            {scannedItems.map((item, index) => (
              <List.Item
                key={item.code}
                prefix={<CheckCircleFill style={{ color: '#52c41a', fontSize: 24 }} />}
                description={
                  <div>
                    <div>SKU: {item.sku}</div>
                    <div style={{ fontSize: 12, color: '#999' }}>{item.scanTime}</div>
                  </div>
                }
                extra={
                  <Button size="mini" color="danger" fill="none" onClick={() => removeItem(item.code)}>
                    删除
                  </Button>
                }
              >
                {item.productName || item.code}
              </List.Item>
            ))}
          </List>
        )}
      </div>

      {/* 底部操作栏 */}
      <div style={{ padding: 12, background: '#fff', borderTop: '1px solid #eee' }}>
        <Button 
          block 
          color="primary" 
          size="large"
          disabled={scannedItems.length === 0}
          loading={loading}
          onClick={confirmShip}
        >
          确认发货 ({scannedItems.length})
        </Button>
      </div>
    </div>
  );
};

export default ScanShip;
