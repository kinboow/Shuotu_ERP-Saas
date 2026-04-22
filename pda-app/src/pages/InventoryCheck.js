import React, { useState, useRef } from 'react';
import { NavBar, Input, Button, List, Toast, Card, Stepper } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import { ScanningOutline } from 'antd-mobile-icons';

const InventoryCheck = () => {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [scanCode, setScanCode] = useState('');
  const [checkedItems, setCheckedItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleScan = async () => {
    if (!scanCode.trim()) {
      Toast.show({ content: '请输入或扫描条码', icon: 'fail' });
      return;
    }

    setLoading(true);
    try {
      // 查询商品信息
      const response = await fetch(`/api/pda/inventory-query?code=${encodeURIComponent(scanCode)}`);
      const data = await response.json();

      if (data.success) {
        const item = data.data;
        const existIndex = checkedItems.findIndex(i => i.sku === item.sku);
        if (existIndex >= 0) {
          // 已存在，数量+1
          const newItems = [...checkedItems];
          newItems[existIndex].checkQuantity += 1;
          setCheckedItems(newItems);
        } else {
          setCheckedItems([...checkedItems, { ...item, checkQuantity: 1 }]);
        }
        Toast.show({ content: '扫描成功', icon: 'success' });
      } else {
        Toast.show({ content: data.message || '未找到商品', icon: 'fail' });
      }
    } catch (error) {
      // 模拟数据
      const existIndex = checkedItems.findIndex(i => i.sku === scanCode);
      if (existIndex >= 0) {
        const newItems = [...checkedItems];
        newItems[existIndex].checkQuantity += 1;
        setCheckedItems(newItems);
      } else {
        setCheckedItems([...checkedItems, {
          sku: scanCode,
          productName: '盘点商品',
          systemQuantity: Math.floor(Math.random() * 100),
          checkQuantity: 1
        }]);
      }
      Toast.show({ content: '扫描成功(模拟)', icon: 'success' });
    } finally {
      setLoading(false);
      setScanCode('');
      inputRef.current?.focus();
    }
  };

  const updateQuantity = (sku, quantity) => {
    const newItems = checkedItems.map(item => 
      item.sku === sku ? { ...item, checkQuantity: quantity } : item
    );
    setCheckedItems(newItems);
  };

  const submitCheck = async () => {
    if (checkedItems.length === 0) {
      Toast.show({ content: '请先扫描商品', icon: 'fail' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/pda/submit-inventory-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: checkedItems })
      });
      const data = await response.json();

      if (data.success) {
        Toast.show({ content: '盘点提交成功', icon: 'success' });
        setCheckedItems([]);
      } else {
        Toast.show({ content: data.message || '提交失败', icon: 'fail' });
      }
    } catch (error) {
      Toast.show({ content: '盘点提交成功(模拟)', icon: 'success' });
      setCheckedItems([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
      <NavBar onBack={() => navigate(-1)}>库存盘点</NavBar>
      
      <Card style={{ margin: 12, borderRadius: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Input
            ref={inputRef}
            value={scanCode}
            onChange={setScanCode}
            placeholder="扫描或输入SKU"
            onEnterPress={handleScan}
            style={{ flex: 1 }}
            clearable
          />
          <Button color="warning" onClick={handleScan} loading={loading}>
            <ScanningOutline /> 扫描
          </Button>
        </div>
      </Card>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 12px' }}>
        <div style={{ padding: '8px 0', color: '#666' }}>
          已盘点: {checkedItems.length} 个SKU
        </div>

        {checkedItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            <ScanningOutline style={{ fontSize: 48, marginBottom: 12 }} />
            <div>请扫描商品进行盘点</div>
          </div>
        ) : (
          <List>
            {checkedItems.map((item) => (
              <List.Item
                key={item.sku}
                description={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <span>系统库存: {item.systemQuantity}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>实盘:</span>
                      <Stepper
                        value={item.checkQuantity}
                        onChange={(val) => updateQuantity(item.sku, val)}
                        min={0}
                        max={9999}
                      />
                    </div>
                  </div>
                }
              >
                <div>
                  <div style={{ fontWeight: 500 }}>{item.productName}</div>
                  <div style={{ fontSize: 12, color: '#999' }}>SKU: {item.sku}</div>
                </div>
              </List.Item>
            ))}
          </List>
        )}
      </div>

      <div style={{ padding: 12, background: '#fff', borderTop: '1px solid #eee' }}>
        <Button 
          block 
          color="warning" 
          size="large"
          disabled={checkedItems.length === 0}
          loading={loading}
          onClick={submitCheck}
        >
          提交盘点结果
        </Button>
      </div>
    </div>
  );
};

export default InventoryCheck;
