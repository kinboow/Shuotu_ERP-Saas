import React, { useState, useRef } from 'react';
import { Card, Button, Space, InputNumber, Select, Input, Divider } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';

const { Option } = Select;

const LabelDesigner = ({ onSave, initialElements = [] }) => {
  const [elements, setElements] = useState(initialElements.length > 0 ? initialElements : [
    { id: 1, type: 'text', content: 'Manufacturer', x: 10, y: 10, width: 150, height: 30, fontSize: 12, fontWeight: 'bold' },
    { id: 2, type: 'text', content: 'Xiamen Sports Yijian', x: 170, y: 10, width: 200, height: 30, fontSize: 12 },
    { id: 3, type: 'text', content: 'Manufacturer Address', x: 10, y: 50, width: 150, height: 30, fontSize: 12, fontWeight: 'bold' },
    { id: 4, type: 'text', content: 'No. 9 Qianlang, Lingxiu Town', x: 170, y: 50, width: 200, height: 30, fontSize: 10 },
    { id: 5, type: 'text', content: 'EC REP', x: 10, y: 120, width: 80, height: 30, fontSize: 12, fontWeight: 'bold', border: true },
    { id: 6, type: 'text', content: 'A6', x: 170, y: 180, width: 200, height: 50, fontSize: 32, fontWeight: 'bold', textAlign: 'center' },
    { id: 7, type: 'text', content: 'MADE IN CHINA', x: 10, y: 240, width: 360, height: 30, fontSize: 14, fontWeight: 'bold', textAlign: 'center' }
  ]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [dragging, setDragging] = useState(null);
  const canvasRef = useRef(null);

  const handleMouseDown = (e, element) => {
    e.stopPropagation();
    setSelectedElement(element);
    setDragging({
      element,
      startX: e.clientX - element.x,
      startY: e.clientY - element.y
    });
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - dragging.startX;
    const y = e.clientY - rect.top - dragging.startY;

    setElements(elements.map(el => 
      el.id === dragging.element.id 
        ? { ...el, x: Math.max(0, Math.min(x, 380 - el.width)), y: Math.max(0, Math.min(y, 280 - el.height)) }
        : el
    ));
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  const handleResize = (e, element, direction) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = element.width;
    const startHeight = element.height;

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      setElements(elements.map(el => {
        if (el.id === element.id) {
          const newEl = { ...el };
          if (direction.includes('e')) newEl.width = Math.max(30, startWidth + deltaX);
          if (direction.includes('s')) newEl.height = Math.max(20, startHeight + deltaY);
          return newEl;
        }
        return el;
      }));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const addElement = () => {
    const newElement = {
      id: Date.now(),
      type: 'text',
      content: '新文本',
      x: 50,
      y: 50,
      width: 150,
      height: 30,
      fontSize: 12
    };
    setElements([...elements, newElement]);
    setSelectedElement(newElement);
  };

  const deleteElement = () => {
    if (selectedElement) {
      setElements(elements.filter(el => el.id !== selectedElement.id));
      setSelectedElement(null);
    }
  };

  const updateElement = (property, value) => {
    if (!selectedElement) return;
    setElements(elements.map(el => 
      el.id === selectedElement.id ? { ...el, [property]: value } : el
    ));
    setSelectedElement({ ...selectedElement, [property]: value });
  };

  const handleSave = () => {
    onSave(elements);
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<PlusOutlined />} onClick={addElement}>添加文本</Button>
        <Button icon={<DeleteOutlined />} onClick={deleteElement} disabled={!selectedElement} danger>删除选中</Button>
        <Button type="primary" onClick={handleSave}>保存设计</Button>
      </Space>

      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <Card title="画布 (100mm x 70mm)" size="small">
            <div
              ref={canvasRef}
              style={{
                width: '380px',
                height: '266px',
                border: '2px solid #000',
                position: 'relative',
                background: '#fff',
                cursor: 'crosshair'
              }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onClick={() => setSelectedElement(null)}
            >
              {elements.map(element => (
                <div
                  key={element.id}
                  onMouseDown={(e) => handleMouseDown(e, element)}
                  style={{
                    position: 'absolute',
                    left: element.x,
                    top: element.y,
                    width: element.width,
                    height: element.height,
                    fontSize: element.fontSize,
                    fontWeight: element.fontWeight || 'normal',
                    textAlign: element.textAlign || 'left',
                    border: element.border ? '2px solid #000' : selectedElement?.id === element.id ? '2px dashed #1890ff' : '1px solid transparent',
                    padding: '4px',
                    cursor: 'move',
                    userSelect: 'none',
                    background: selectedElement?.id === element.id ? 'rgba(24, 144, 255, 0.1)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: element.textAlign === 'center' ? 'center' : 'flex-start',
                    overflow: 'hidden',
                    wordBreak: 'break-word'
                  }}
                >
                  {element.content}
                  {selectedElement?.id === element.id && (
                    <>
                      <div
                        onMouseDown={(e) => handleResize(e, element, 'e')}
                        style={{
                          position: 'absolute',
                          right: -4,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: 8,
                          height: 8,
                          background: '#1890ff',
                          cursor: 'e-resize',
                          borderRadius: '50%'
                        }}
                      />
                      <div
                        onMouseDown={(e) => handleResize(e, element, 's')}
                        style={{
                          position: 'absolute',
                          bottom: -4,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: 8,
                          height: 8,
                          background: '#1890ff',
                          cursor: 's-resize',
                          borderRadius: '50%'
                        }}
                      />
                      <div
                        onMouseDown={(e) => handleResize(e, element, 'se')}
                        style={{
                          position: 'absolute',
                          right: -4,
                          bottom: -4,
                          width: 8,
                          height: 8,
                          background: '#1890ff',
                          cursor: 'se-resize',
                          borderRadius: '50%'
                        }}
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div style={{ width: 300 }}>
          <Card title="属性编辑" size="small">
            {selectedElement ? (
              <div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>内容:</label>
                  <Input.TextArea
                    value={selectedElement.content}
                    onChange={(e) => updateElement('content', e.target.value)}
                    rows={3}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>字体大小:</label>
                  <InputNumber
                    value={selectedElement.fontSize}
                    onChange={(value) => updateElement('fontSize', value)}
                    min={8}
                    max={48}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>字体粗细:</label>
                  <Select
                    value={selectedElement.fontWeight || 'normal'}
                    onChange={(value) => updateElement('fontWeight', value)}
                    style={{ width: '100%' }}
                  >
                    <Option value="normal">正常</Option>
                    <Option value="bold">粗体</Option>
                  </Select>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>对齐方式:</label>
                  <Select
                    value={selectedElement.textAlign || 'left'}
                    onChange={(value) => updateElement('textAlign', value)}
                    style={{ width: '100%' }}
                  >
                    <Option value="left">左对齐</Option>
                    <Option value="center">居中</Option>
                    <Option value="right">右对齐</Option>
                  </Select>
                </div>
                <Divider style={{ margin: '12px 0' }} />
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>X 位置:</label>
                  <InputNumber
                    value={selectedElement.x}
                    onChange={(value) => updateElement('x', value)}
                    min={0}
                    max={380}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>Y 位置:</label>
                  <InputNumber
                    value={selectedElement.y}
                    onChange={(value) => updateElement('y', value)}
                    min={0}
                    max={266}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>宽度:</label>
                  <InputNumber
                    value={selectedElement.width}
                    onChange={(value) => updateElement('width', value)}
                    min={30}
                    max={380}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>高度:</label>
                  <InputNumber
                    value={selectedElement.height}
                    onChange={(value) => updateElement('height', value)}
                    min={20}
                    max={266}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>
                点击画布中的元素进行编辑
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LabelDesigner;
