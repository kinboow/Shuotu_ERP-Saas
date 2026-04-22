import React, { useState, useRef, useEffect } from 'react';
import { Button, Space, InputNumber, Select, Input, Divider, Card, Tooltip, message, Modal, Row, Col, Dropdown, Tabs, Upload, Spin, Empty, Form, Popconfirm, Radio } from 'antd';
import { 
  PlusOutlined, DeleteOutlined, SaveOutlined, UndoOutlined, RedoOutlined,
  FontSizeOutlined, BoldOutlined, AlignLeftOutlined, AlignCenterOutlined,
  AlignRightOutlined, BorderOutlined, LeftOutlined, SettingOutlined,
  PrinterOutlined, ScissorOutlined, CopyOutlined, SnippetsOutlined,
  VerticalAlignTopOutlined, VerticalAlignBottomOutlined, VerticalAlignMiddleOutlined,
  PicCenterOutlined, ColumnWidthOutlined, ColumnHeightOutlined,
  ZoomInOutlined, ZoomOutOutlined, ExpandOutlined, SelectOutlined,
  MenuOutlined, DownOutlined, FileOutlined, CloseOutlined,
  AppstoreOutlined, PictureOutlined, SafetyCertificateOutlined, FileTextOutlined, UploadOutlined, ReloadOutlined,
  EditOutlined, LinkOutlined, DatabaseOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import DataTableManager from './DataTableManager';

const { Option } = Select;
const { TextArea } = Input;

// 二维码组件
const QRCodeImage = ({ content, size }) => {
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    if (content) {
      QRCode.toDataURL(content, {
        width: size || 100,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      }).then(url => {
        setQrDataUrl(url);
      }).catch(err => {
        console.error('生成二维码失败:', err);
      });
    }
  }, [content, size]);

  return qrDataUrl ? (
    <img 
      src={qrDataUrl} 
      alt="QR Code" 
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      style={{ 
        width: '100%', 
        height: '100%', 
        objectFit: 'contain',
        pointerEvents: 'none',
        userSelect: 'none'
      }} 
    />
  ) : (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0' }}>
      <span style={{ fontSize: 12, color: '#999' }}>二维码</span>
    </div>
  );
};

const LabelEditor = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { templateId } = useParams();
  const [elements, setElements] = useState([]);
  const [currentTemplateId, setCurrentTemplateId] = useState(null);
  const [templateName, setTemplateName] = useState('');
  const [selectedElement, setSelectedElement] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const canvasRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [editingElement, setEditingElement] = useState(null);
  const editInputRef = useRef(null);
  const [alignmentLines, setAlignmentLines] = useState([]);
  const [editingCell, setEditingCell] = useState(null); // { elementId, row, col }
  const cellInputRef = useRef(null);
  const mouseDownTime = useRef(null);
  const mouseDownPos = useRef(null);
  const hasMoved = useRef(false);
  const [clipboard, setClipboard] = useState(null);
  
  // 标签纸大小设置 (单位: mm, 显示时按3.8倍缩放为像素)
  const [labelSize, setLabelSize] = useState({ width: 100, height: 70 });
  const [tempLabelSize, setTempLabelSize] = useState({ width: 100, height: 70 });
  const [labelSettingVisible, setLabelSettingVisible] = useState(false);
  const mmToPixel = 3.8; // 1mm = 3.8像素 (用于显示)
  
  // 素材库状态
  const [materials, setMaterials] = useState([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [materialCategory, setMaterialCategory] = useState('all');
  const [materialModalVisible, setMaterialModalVisible] = useState(false);
  
  // 素材管理状态
  const [addMaterialVisible, setAddMaterialVisible] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [materialForm] = Form.useForm();

  // 数据表管理状态
  const [dataTableVisible, setDataTableVisible] = useState(false);

  // 插入数据表变量到当前选中的文本元素
  const handleInsertVariable = (variableInfo) => {
    const variable = variableInfo.variable;
    if (selectedElement && selectedElement.type === 'text') {
      const newContent = (selectedElement.content || '') + variable;
      const newElements = elements.map(el =>
        el.id === selectedElement.id ? { ...el, content: newContent } : el
      );
      setElements(newElements);
      setSelectedElement({ ...selectedElement, content: newContent });
      addToHistory(newElements);
    } else {
      // 没有选中文本元素时，创建一个新的文本元素
      const newElement = {
        id: Date.now(),
        type: 'text',
        content: variable,
        x: 50,
        y: 50,
        width: 180,
        height: 30,
        fontSize: 12
      };
      const newElements = [...elements, newElement];
      setElements(newElements);
      setSelectedElement(newElement);
      addToHistory(newElements);
    }
  };

  // 从API加载模板
  const loadTemplateFromApi = async (id) => {
    try {
      const response = await fetch(`/api/compliance-label/templates/${id}`);
      const data = await response.json();
      if (data.success && data.data) {
        const template = data.data;
        setCurrentTemplateId(template.id);
        setTemplateName(template.template_name || '');
        if (template.label_width && template.label_height) {
          setLabelSize({ width: template.label_width, height: template.label_height });
          setTempLabelSize({ width: template.label_width, height: template.label_height });
        }
        const templateElements = template.elements || [];
        setElements(templateElements);
        addToHistory(templateElements);
        document.title = `协途 - ${template.template_name || '标签编辑器'}`;
        return true;
      }
    } catch (error) {
      console.error('加载模板失败:', error);
    }
    return false;
  };

  useEffect(() => {
    document.title = '协途 - 标签编辑器';
    
    // 如果URL中有模板ID，优先从API加载
    if (templateId) {
      loadTemplateFromApi(templateId);
      return;
    }
    
    // 优先从localStorage读取(新标签页打开时使用)
    const storedElements = localStorage.getItem('labelEditorElements');
    // 然后从路由state中获取初始元素
    if (storedElements) {
      try {
        const parsedElements = JSON.parse(storedElements);
        if (parsedElements && parsedElements.length > 0) {
          setElements(parsedElements);
          addToHistory(parsedElements);
          // 读取后清除,避免下次打开时使用旧数据
          localStorage.removeItem('labelEditorElements');
          return;
        }
      } catch (e) {
        console.error('解析标签元素失败:', e);
      }
    }
    
    if (location.state?.elements) {
      setElements(location.state.elements);
      addToHistory(location.state.elements);
    } else {
      // 空白模板
      setElements([]);
      addToHistory([]);
    }
  }, [location, templateId]);

  // 加载素材库
  const loadMaterials = async (category = 'all') => {
    setMaterialsLoading(true);
    try {
      const params = category !== 'all' ? `?category=${category}` : '';
      const response = await fetch(`/api/label-materials${params}`);
      const data = await response.json();
      if (data.success) {
        setMaterials(data.data || []);
      }
    } catch (error) {
      console.error('加载素材失败:', error);
    } finally {
      setMaterialsLoading(false);
    }
  };

  // 初始化系统素材
  const initSystemMaterials = async () => {
    try {
      const response = await fetch('/api/label-materials/init-system', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        message.success('系统素材初始化成功');
        loadMaterials(materialCategory);
      }
    } catch (error) {
      console.error('初始化素材失败:', error);
    }
  };

  // 添加素材到画布
  const addMaterialToCanvas = (material) => {
    const newId = Math.max(0, ...elements.map(e => e.id)) + 1;
    let newElement;
    
    if (material.content_type === 'text') {
      newElement = {
        id: newId,
        type: 'text',
        content: material.content,
        x: 50,
        y: 50,
        width: material.width || 150,
        height: material.height || 30,
        fontSize: 12,
        fontWeight: material.name.includes('REP') ? 'bold' : 'normal',
        border: material.name.includes('REP')
      };
    } else if (material.content_type === 'svg') {
      newElement = {
        id: newId,
        type: 'image',
        content: `data:image/svg+xml,${encodeURIComponent(material.content)}`,
        x: 50,
        y: 50,
        width: material.width || 60,
        height: material.height || 40,
        materialId: material.id,
        materialName: material.name
      };
    } else {
      newElement = {
        id: newId,
        type: 'image',
        content: material.content,
        x: 50,
        y: 50,
        width: material.width || 100,
        height: material.height || 100,
        materialId: material.id,
        materialName: material.name
      };
    }
    
    const newElements = [...elements, newElement];
    setElements(newElements);
    addToHistory(newElements);
    setSelectedElement(newElement);
    message.success(`已添加: ${material.name}`);
  };

  // 上传自定义素材
  const handleMaterialUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const uploadRes = await fetch('/api/label-materials/upload', {
        method: 'POST',
        body: formData
      });
      const uploadData = await uploadRes.json();
      
      if (uploadData.success) {
        // 创建素材记录
        const createRes = await fetch('/api/label-materials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: file.name.replace(/\.[^/.]+$/, ''),
            category: 'image',
            content_type: 'url',
            content: uploadData.data.url
          })
        });
        const createData = await createRes.json();
        if (createData.success) {
          message.success('素材上传成功');
          loadMaterials(materialCategory);
        }
      }
    } catch (error) {
      console.error('上传素材失败:', error);
      message.error('上传失败');
    }
    return false; // 阻止默认上传
  };

  // 打开添加素材弹窗
  const openAddMaterial = () => {
    setEditingMaterial(null);
    materialForm.resetFields();
    materialForm.setFieldsValue({
      category: 'text_template',
      content_type: 'text',
      width: 100,
      height: 30
    });
    setAddMaterialVisible(true);
  };

  // 打开编辑素材弹窗
  const openEditMaterial = (material) => {
    setEditingMaterial(material);
    materialForm.setFieldsValue({
      name: material.name,
      category: material.category,
      content_type: material.content_type,
      content: material.content,
      width: material.width,
      height: material.height,
      description: material.description
    });
    setAddMaterialVisible(true);
  };

  // 保存素材(新增或编辑)
  const saveMaterial = async (values) => {
    try {
      const url = editingMaterial 
        ? `/api/label-materials/${editingMaterial.id}`
        : '/api/label-materials';
      const method = editingMaterial ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      const data = await response.json();
      
      if (data.success) {
        message.success(editingMaterial ? '素材更新成功' : '素材添加成功');
        setAddMaterialVisible(false);
        loadMaterials(materialCategory);
      } else {
        message.error(data.message || '保存失败');
      }
    } catch (error) {
      console.error('保存素材失败:', error);
      message.error('保存失败');
    }
  };

  // 删除素材
  const deleteMaterial = async (id) => {
    try {
      const response = await fetch(`/api/label-materials/${id}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        message.success('素材删除成功');
        loadMaterials(materialCategory);
      } else {
        message.error(data.message || '删除失败');
      }
    } catch (error) {
      console.error('删除素材失败:', error);
      message.error('删除失败');
    }
  };

  useEffect(() => {
    loadMaterials();
  }, []);

  // 键盘快捷键 - 单独的useEffect,使用ref避免频繁重新注册
  const editingElementRef = useRef(editingElement);
  const selectedElementRef = useRef(selectedElement);
  const clipboardRef = useRef(clipboard);
  const historyIndexRef = useRef(historyIndex);
  const historyRef = useRef(history);
  const elementsRef = useRef(elements);

  useEffect(() => {
    editingElementRef.current = editingElement;
    selectedElementRef.current = selectedElement;
    clipboardRef.current = clipboard;
    historyIndexRef.current = historyIndex;
    historyRef.current = history;
    elementsRef.current = elements;
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      // 如果正在编辑文本,不触发快捷键
      if (editingElementRef.current) return;

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            if (historyIndexRef.current > 0) {
              setHistoryIndex(historyIndexRef.current - 1);
              setElements(JSON.parse(JSON.stringify(historyRef.current[historyIndexRef.current - 1])));
            }
            break;
          case 'y':
            e.preventDefault();
            if (historyIndexRef.current < historyRef.current.length - 1) {
              setHistoryIndex(historyIndexRef.current + 1);
              setElements(JSON.parse(JSON.stringify(historyRef.current[historyIndexRef.current + 1])));
            }
            break;
          case 'c':
            e.preventDefault();
            if (selectedElementRef.current) {
              setClipboard(JSON.parse(JSON.stringify(selectedElementRef.current)));
              message.success('已复制');
            }
            break;
          case 'v':
            e.preventDefault();
            if (clipboardRef.current) {
              const newElement = {
                ...clipboardRef.current,
                id: Date.now(),
                x: clipboardRef.current.x + 10,
                y: clipboardRef.current.y + 10
              };
              const newElements = [...elementsRef.current, newElement];
              setElements(newElements);
              setSelectedElement(newElement);
              addToHistory(newElements);
              message.success('已粘贴');
            }
            break;
          case 'd':
            e.preventDefault();
            if (selectedElementRef.current) {
              const newElement = {
                ...selectedElementRef.current,
                id: Date.now(),
                x: selectedElementRef.current.x + 10,
                y: selectedElementRef.current.y + 10
              };
              const newElements = [...elementsRef.current, newElement];
              setElements(newElements);
              setSelectedElement(newElement);
              addToHistory(newElements);
            }
            break;
          case 's':
            e.preventDefault();
            localStorage.setItem('labelDesign', JSON.stringify(elementsRef.current));
            message.success('标签设计已保存');
            navigate('/compliance-label-print', { state: { elements: elementsRef.current } });
            break;
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (selectedElementRef.current) {
          const newElements = elementsRef.current.filter(el => el.id !== selectedElementRef.current.id);
          setElements(newElements);
          setSelectedElement(null);
          addToHistory(newElements);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // 空依赖数组,只注册一次

  // Ctrl+滚轮缩放
  useEffect(() => {
    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(prevZoom => {
          const newZoom = Math.round((prevZoom + delta) * 10) / 10;
          return Math.max(0.3, Math.min(3, newZoom));
        });
      }
    };

    // 需要在画布区域监听,使用passive: false来允许preventDefault
    const canvasContainer = document.querySelector('[data-canvas-container]');
    if (canvasContainer) {
      canvasContainer.addEventListener('wheel', handleWheel, { passive: false });
      return () => canvasContainer.removeEventListener('wheel', handleWheel);
    }
  }, []);

  const addToHistory = (newElements) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(newElements)));
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setElements(JSON.parse(JSON.stringify(history[historyIndex - 1])));
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setElements(JSON.parse(JSON.stringify(history[historyIndex + 1])));
    }
  };

  const handleMouseDown = (e, element) => {
    e.stopPropagation();
    if (editingElement?.id === element.id) return; // 如果正在编辑,不触发
    
    // 重置移动标志
    hasMoved.current = false;
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    setDragging({
      element,
      offsetX: (e.clientX - rect.left) / zoom - element.x,
      offsetY: (e.clientY - rect.top) / zoom - element.y
    });
  };

  const handleDoubleClick = (e, element) => {
    e.stopPropagation();
    
    // 只有文本类元素支持双击编辑
    if (element.type === 'text' || element.type === 'barcode' || element.type === 'qrcode') {
      setEditingElement(element);
      setSelectedElement(element);
      setTimeout(() => {
        if (editInputRef.current) {
          editInputRef.current.focus();
          editInputRef.current.select();
        }
      }, 0);
    }
  };

  const handleEditBlur = () => {
    if (editingElement) {
      addToHistory(elements);
      setEditingElement(null);
    }
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Escape') {
      setEditingElement(null);
    }
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    
    // 检测是否移动了(移动超过3px才算拖拽)
    if (mouseDownPos.current) {
      const deltaX = Math.abs(e.clientX - mouseDownPos.current.x);
      const deltaY = Math.abs(e.clientY - mouseDownPos.current.y);
      if (deltaX > 3 || deltaY > 3) {
        hasMoved.current = true;
      }
    }
    
    // 如果没有移动,不更新位置
    if (!hasMoved.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // 计算新位置
    let x = (e.clientX - rect.left) / zoom - dragging.offsetX;
    let y = (e.clientY - rect.top) / zoom - dragging.offsetY;

    // 计算对齐线
    const snapThreshold = 5; // 吸附阈值
    const lines = [];
    const currentElement = dragging.element;
    
    // 画布中心线
    const canvasWidth = labelSize.width * mmToPixel;
    const canvasHeight = labelSize.height * mmToPixel;
    const canvasCenterX = canvasWidth / 2;
    const canvasCenterY = canvasHeight / 2;
    
    // 当前元素的中心、左、右、上、下
    const currentCenterX = x + currentElement.width / 2;
    const currentCenterY = y + currentElement.height / 2;
    const currentLeft = x;
    const currentRight = x + currentElement.width;
    const currentTop = y;
    const currentBottom = y + currentElement.height;
    
    // 检查与画布中心对齐
    if (Math.abs(currentCenterX - canvasCenterX) < snapThreshold) {
      x = canvasCenterX - currentElement.width / 2;
      lines.push({ type: 'vertical', position: canvasCenterX });
    }
    if (Math.abs(currentCenterY - canvasCenterY) < snapThreshold) {
      y = canvasCenterY - currentElement.height / 2;
      lines.push({ type: 'horizontal', position: canvasCenterY });
    }
    
    // 检查与其他元素对齐
    elements.forEach(el => {
      if (el.id === currentElement.id) return;
      
      const elCenterX = el.x + el.width / 2;
      const elCenterY = el.y + el.height / 2;
      const elLeft = el.x;
      const elRight = el.x + el.width;
      const elTop = el.y;
      const elBottom = el.y + el.height;
      
      // 水平对齐检查
      // 中心对齐
      if (Math.abs(currentCenterX - elCenterX) < snapThreshold) {
        x = elCenterX - currentElement.width / 2;
        lines.push({ type: 'vertical', position: elCenterX });
      }
      // 左边对齐
      if (Math.abs(currentLeft - elLeft) < snapThreshold) {
        x = elLeft;
        lines.push({ type: 'vertical', position: elLeft });
      }
      // 右边对齐
      if (Math.abs(currentRight - elRight) < snapThreshold) {
        x = elRight - currentElement.width;
        lines.push({ type: 'vertical', position: elRight });
      }
      // 左边对齐到右边
      if (Math.abs(currentLeft - elRight) < snapThreshold) {
        x = elRight;
        lines.push({ type: 'vertical', position: elRight });
      }
      // 右边对齐到左边
      if (Math.abs(currentRight - elLeft) < snapThreshold) {
        x = elLeft - currentElement.width;
        lines.push({ type: 'vertical', position: elLeft });
      }
      
      // 垂直对齐检查
      // 中心对齐
      if (Math.abs(currentCenterY - elCenterY) < snapThreshold) {
        y = elCenterY - currentElement.height / 2;
        lines.push({ type: 'horizontal', position: elCenterY });
      }
      // 顶部对齐
      if (Math.abs(currentTop - elTop) < snapThreshold) {
        y = elTop;
        lines.push({ type: 'horizontal', position: elTop });
      }
      // 底部对齐
      if (Math.abs(currentBottom - elBottom) < snapThreshold) {
        y = elBottom - currentElement.height;
        lines.push({ type: 'horizontal', position: elBottom });
      }
      // 顶部对齐到底部
      if (Math.abs(currentTop - elBottom) < snapThreshold) {
        y = elBottom;
        lines.push({ type: 'horizontal', position: elBottom });
      }
      // 底部对齐到顶部
      if (Math.abs(currentBottom - elTop) < snapThreshold) {
        y = elTop - currentElement.height;
        lines.push({ type: 'horizontal', position: elTop });
      }
    });
    
    setAlignmentLines(lines);

    const newElements = elements.map(el => 
      el.id === dragging.element.id 
        ? { 
            ...el, 
            x: Math.max(0, Math.min(x, labelSize.width * mmToPixel - el.width)), 
            y: Math.max(0, Math.min(y, labelSize.height * mmToPixel - el.height)) 
          }
        : el
    );
    setElements(newElements);
  };

  const handleElementMouseUp = (e, element) => {
    e.stopPropagation();
    
    if (!dragging) return;
    
    const wasMoved = hasMoved.current;
    
    // 清理状态
    setDragging(null);
    setAlignmentLines([]);
    mouseDownPos.current = null;
    hasMoved.current = false;
    
    // 如果是拖拽,保存历史
    if (wasMoved) {
      addToHistory(elementsRef.current);
    }
    // 选中由onClick处理
  };

  const handleCanvasMouseUp = () => {
    if (dragging) {
      const wasMoved = hasMoved.current;
      
      // 清理状态
      setDragging(null);
      setAlignmentLines([]);
      mouseDownPos.current = null;
      hasMoved.current = false;
      
      if (wasMoved) {
        addToHistory(elementsRef.current);
      }
    }
  };

  const handleResize = (e, element, direction) => {
    e.stopPropagation();
    e.preventDefault();
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = element.width;
    const startHeight = element.height;

    const onMouseMove = (moveEvent) => {
      moveEvent.preventDefault();
      const deltaX = (moveEvent.clientX - startX) / zoom;
      const deltaY = (moveEvent.clientY - startY) / zoom;

      const newElements = elementsRef.current.map(el => {
        if (el.id === element.id) {
          const newEl = { ...el };
          if (direction.includes('e')) newEl.width = Math.max(30, startWidth + deltaX);
          if (direction.includes('s')) newEl.height = Math.max(20, startHeight + deltaY);
          return newEl;
        }
        return el;
      });
      setElements(newElements);
    };

    const onMouseUp = (upEvent) => {
      upEvent.preventDefault();
      // 立即移除事件监听器
      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('mouseup', onMouseUp, true);
      // 保存历史
      addToHistory(elementsRef.current);
    };

    // 使用捕获阶段确保事件被正确处理
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('mouseup', onMouseUp, true);
  };

  const addElement = (type = 'text') => {
    let newElement;
    switch (type) {
      case 'text':
        newElement = {
          id: Date.now(),
          type: 'text',
          content: '新文本',
          x: 50,
          y: 50,
          width: 150,
          height: 30,
          fontSize: 12
        };
        break;
      case 'barcode':
        newElement = {
          id: Date.now(),
          type: 'barcode',
          content: '1234567890',
          x: 50,
          y: 50,
          width: 150,
          height: 50,
          fontSize: 10
        };
        break;
      case 'qrcode':
        newElement = {
          id: Date.now(),
          type: 'qrcode',
          content: 'https://example.com',
          x: 50,
          y: 50,
          width: 80,
          height: 80
        };
        break;
      case 'image':
        newElement = {
          id: Date.now(),
          type: 'image',
          content: '',
          x: 50,
          y: 50,
          width: 100,
          height: 100
        };
        break;
      case 'line':
        newElement = {
          id: Date.now(),
          type: 'line',
          x: 50,
          y: 50,
          width: 200,
          height: 2,
          borderColor: '#000'
        };
        break;
      case 'rect':
        newElement = {
          id: Date.now(),
          type: 'rect',
          x: 50,
          y: 50,
          width: 150,
          height: 100,
          borderColor: '#000',
          borderWidth: 2,
          fillColor: 'transparent'
        };
        break;
      case 'table':
        newElement = {
          id: Date.now(),
          type: 'table',
          x: 50,
          y: 50,
          width: 200,
          height: 150,
          rows: 3,
          cols: 2,
          borderColor: '#000',
          fontSize: 10,
          cellData: {} // 存储单元格内容，格式: { "0-0": "内容", "0-1": "内容", ... }
        };
        break;
      default:
        newElement = {
          id: Date.now(),
          type: 'text',
          content: '新文本',
          x: 50,
          y: 50,
          width: 150,
          height: 30,
          fontSize: 12
        };
    }
    const newElements = [...elements, newElement];
    setElements(newElements);
    setSelectedElement(newElement);
    addToHistory(newElements);
  };

  const deleteElement = () => {
    if (selectedElement) {
      const newElements = elements.filter(el => el.id !== selectedElement.id);
      setElements(newElements);
      setSelectedElement(null);
      addToHistory(newElements);
    }
  };

  const moveLayer = (direction) => {
    if (!selectedElement) return;
    const index = elements.findIndex(el => el.id === selectedElement.id);
    if (index === -1) return;

    const newElements = [...elements];
    if (direction === 'top') {
      // 置顶
      const [element] = newElements.splice(index, 1);
      newElements.push(element);
    } else if (direction === 'bottom') {
      // 置底
      const [element] = newElements.splice(index, 1);
      newElements.unshift(element);
    } else if (direction === 'up' && index < newElements.length - 1) {
      // 上移一层
      [newElements[index], newElements[index + 1]] = [newElements[index + 1], newElements[index]];
    } else if (direction === 'down' && index > 0) {
      // 下移一层
      [newElements[index], newElements[index - 1]] = [newElements[index - 1], newElements[index]];
    }
    
    setElements(newElements);
    addToHistory(newElements);
  };

  const copyElement = () => {
    if (selectedElement) {
      setClipboard(JSON.parse(JSON.stringify(selectedElement)));
      message.success('已复制');
    }
  };

  const pasteElement = () => {
    if (clipboard) {
      const newElement = {
        ...clipboard,
        id: Date.now(),
        x: clipboard.x + 10,
        y: clipboard.y + 10
      };
      const newElements = [...elements, newElement];
      setElements(newElements);
      setSelectedElement(newElement);
      addToHistory(newElements);
      message.success('已粘贴');
    }
  };

  const duplicateElement = () => {
    if (selectedElement) {
      const newElement = {
        ...selectedElement,
        id: Date.now(),
        x: selectedElement.x + 10,
        y: selectedElement.y + 10
      };
      const newElements = [...elements, newElement];
      setElements(newElements);
      setSelectedElement(newElement);
      addToHistory(newElements);
    }
  };

  const updateElement = (property, value) => {
    if (!selectedElement) return;
    const newElements = elements.map(el => 
      el.id === selectedElement.id ? { ...el, [property]: value } : el
    );
    setElements(newElements);
    setSelectedElement({ ...selectedElement, [property]: value });
  };

  const updateElementAndSave = (property, value) => {
    updateElement(property, value);
    setTimeout(() => addToHistory(elements), 100);
  };

  const handleSave = async () => {
    // 保存到localStorage
    localStorage.setItem('labelDesign', JSON.stringify(elements));
    
    // 尝试更新数据库中的模板(如果有当前模板ID)
    const saveTemplateId = currentTemplateId || localStorage.getItem('currentTemplateId');
    if (saveTemplateId) {
      try {
        const response = await fetch(`/api/compliance-label/templates/${saveTemplateId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            elements,
            label_width: labelSize.width,
            label_height: labelSize.height
          })
        });
        const data = await response.json();
        if (data.success) {
          message.success(`标签 "${templateName || '模板'}" 已保存`);
        } else {
          message.warning('保存到数据库失败,已保存到本地');
        }
      } catch (error) {
        console.error('保存到数据库失败:', error);
        message.warning('保存到数据库失败,已保存到本地');
      }
    } else {
      message.success('标签设计已保存到本地');
    }
    
    // 如果是新标签页打开的,关闭当前标签页
    if (window.opener) {
      // 通知父窗口刷新数据
      window.opener.postMessage({ type: 'labelDesignSaved', elements }, '*');
      setTimeout(() => window.close(), 500);
    } else {
      navigate('/compliance-label-print', { state: { elements } });
    }
  };

  // 全选功能
  const selectAll = () => {
    if (elements.length > 0) {
      setSelectedElement(elements[0]);
      message.info(`共 ${elements.length} 个元素`);
    }
  };

  // 打印预览
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const elementsHtml = elements.map(el => `
      <div style="
        position: absolute;
        left: ${el.x}px;
        top: ${el.y}px;
        width: ${el.width}px;
        height: ${el.height}px;
        font-size: ${el.fontSize || 12}px;
        font-weight: ${el.fontWeight || 'normal'};
        text-align: ${el.textAlign || 'left'};
        border: ${el.border ? '1px solid #000' : 'none'};
        display: flex;
        align-items: center;
        ${el.rotation ? `transform: rotate(${el.rotation}deg);` : ''}
      ">
        ${el.type === 'text' ? el.content : ''}
        ${el.type === 'qrcode' ? '<div style="width:100%;height:100%;background:#eee;display:flex;align-items:center;justify-content:center;">[二维码]</div>' : ''}
        ${el.type === 'barcode' ? '<div style="width:100%;height:100%;background:#eee;display:flex;align-items:center;justify-content:center;">[条码]</div>' : ''}
      </div>
    `).join('');
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>标签打印预览</title>
        <style>
          @media print { @page { size: ${labelSize.width}mm ${labelSize.height}mm; margin: 0; } }
          body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
        </style>
      </head>
      <body>
        <div style="width: ${labelSize.width * mmToPixel}px; height: ${labelSize.height * mmToPixel}px; border: 1px solid #000; position: relative; background: #fff;">
          ${elementsHtml}
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 300);
  };

  // 对齐功能
  const alignElements = (type) => {
    if (!selectedElement) return;
    const canvasWidth = labelSize.width * mmToPixel;
    const canvasHeight = labelSize.height * mmToPixel;
    
    let newX = selectedElement.x;
    let newY = selectedElement.y;
    
    switch(type) {
      case 'left': newX = 0; break;
      case 'center': newX = (canvasWidth - selectedElement.width) / 2; break;
      case 'right': newX = canvasWidth - selectedElement.width; break;
      case 'top': newY = 0; break;
      case 'middle': newY = (canvasHeight - selectedElement.height) / 2; break;
      case 'bottom': newY = canvasHeight - selectedElement.height; break;
      default: break;
    }
    
    updateElement(selectedElement.id, { x: newX, y: newY });
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f2f5' }}>
      {/* 顶部工具栏 - 专业风格 */}
      <div style={{ 
        background: '#fafafa', 
        borderBottom: '1px solid #e0e0e0',
        padding: '4px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        flexWrap: 'wrap'
      }}>
        {/* 文件操作组 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <Tooltip title="保存 (Ctrl+S)">
            <Button type="text" icon={<SaveOutlined />} onClick={handleSave} style={{ padding: '4px 8px' }} />
          </Tooltip>
          <Tooltip title="打印预览">
            <Button type="text" icon={<PrinterOutlined />} onClick={handlePrint} style={{ padding: '4px 8px' }} />
          </Tooltip>
        </div>
        
        <Divider type="vertical" style={{ margin: '0 4px', height: 24 }} />
        
        {/* 编辑操作组 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <Tooltip title="剪切">
            <Button type="text" icon={<ScissorOutlined />} onClick={() => { copyElement(); deleteElement(); }} disabled={!selectedElement} style={{ padding: '4px 8px' }} />
          </Tooltip>
          <Tooltip title="复制 (Ctrl+C)">
            <Button type="text" icon={<CopyOutlined />} onClick={copyElement} disabled={!selectedElement} style={{ padding: '4px 8px' }} />
          </Tooltip>
          <Tooltip title="粘贴 (Ctrl+V)">
            <Button type="text" icon={<SnippetsOutlined />} onClick={pasteElement} disabled={!clipboard} style={{ padding: '4px 8px' }} />
          </Tooltip>
        </div>
        
        <Divider type="vertical" style={{ margin: '0 4px', height: 24 }} />
        
        {/* 撤销/重做组 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <Tooltip title="撤销 (Ctrl+Z)">
            <Button type="text" icon={<UndoOutlined />} onClick={undo} disabled={historyIndex <= 0} style={{ padding: '4px 8px' }} />
          </Tooltip>
          <Tooltip title="重做 (Ctrl+Y)">
            <Button type="text" icon={<RedoOutlined />} onClick={redo} disabled={historyIndex >= history.length - 1} style={{ padding: '4px 8px' }} />
          </Tooltip>
        </div>
        
        <Divider type="vertical" style={{ margin: '0 4px', height: 24 }} />
        
        {/* 全选 */}
        <Tooltip title="全选">
          <Button type="text" icon={<SelectOutlined />} onClick={selectAll} style={{ padding: '4px 8px' }} />
        </Tooltip>
        
        <Divider type="vertical" style={{ margin: '0 4px', height: 24 }} />
        
        {/* 对齐工具组 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <Tooltip title="左对齐">
            <Button type="text" icon={<AlignLeftOutlined />} onClick={() => alignElements('left')} disabled={!selectedElement} style={{ padding: '4px 8px' }} />
          </Tooltip>
          <Tooltip title="水平居中">
            <Button type="text" icon={<AlignCenterOutlined />} onClick={() => alignElements('center')} disabled={!selectedElement} style={{ padding: '4px 8px' }} />
          </Tooltip>
          <Tooltip title="右对齐">
            <Button type="text" icon={<AlignRightOutlined />} onClick={() => alignElements('right')} disabled={!selectedElement} style={{ padding: '4px 8px' }} />
          </Tooltip>
          <Tooltip title="顶部对齐">
            <Button type="text" icon={<VerticalAlignTopOutlined />} onClick={() => alignElements('top')} disabled={!selectedElement} style={{ padding: '4px 8px' }} />
          </Tooltip>
          <Tooltip title="垂直居中">
            <Button type="text" icon={<VerticalAlignMiddleOutlined />} onClick={() => alignElements('middle')} disabled={!selectedElement} style={{ padding: '4px 8px' }} />
          </Tooltip>
          <Tooltip title="底部对齐">
            <Button type="text" icon={<VerticalAlignBottomOutlined />} onClick={() => alignElements('bottom')} disabled={!selectedElement} style={{ padding: '4px 8px' }} />
          </Tooltip>
        </div>
        
        <Divider type="vertical" style={{ margin: '0 4px', height: 24 }} />
        
        {/* 图层操作组 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <Tooltip title="置顶">
            <Button type="text" onClick={() => moveLayer('top')} disabled={!selectedElement} style={{ padding: '4px 8px', fontSize: 12 }}>置顶</Button>
          </Tooltip>
          <Tooltip title="置底">
            <Button type="text" onClick={() => moveLayer('bottom')} disabled={!selectedElement} style={{ padding: '4px 8px', fontSize: 12 }}>置底</Button>
          </Tooltip>
        </div>
        
        <Divider type="vertical" style={{ margin: '0 4px', height: 24 }} />
        
        {/* 缩放控制 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Tooltip title="缩小">
            <Button type="text" icon={<ZoomOutOutlined />} onClick={() => setZoom(Math.max(0.25, zoom - 0.25))} style={{ padding: '4px 8px' }} />
          </Tooltip>
          <Select 
            value={zoom} 
            onChange={setZoom} 
            style={{ width: 80 }} 
            size="small"
            suffixIcon={<DownOutlined style={{ fontSize: 10 }} />}
          >
            <Option value={0.25}>25%</Option>
            <Option value={0.5}>50%</Option>
            <Option value={0.75}>75%</Option>
            <Option value={1}>100%</Option>
            <Option value={1.25}>125%</Option>
            <Option value={1.5}>150%</Option>
            <Option value={2}>200%</Option>
          </Select>
          <Tooltip title="放大">
            <Button type="text" icon={<ZoomInOutlined />} onClick={() => setZoom(Math.min(3, zoom + 0.25))} style={{ padding: '4px 8px' }} />
          </Tooltip>
        </div>
        
        {/* 右侧操作区 */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Tooltip title="标签设置">
            <Button 
              type="text"
              onClick={() => {
                setTempLabelSize({ ...labelSize });
                setLabelSettingVisible(true);
              }}
              style={{ padding: '4px 8px', fontSize: 12 }}
            >
              {labelSize.width}×{labelSize.height}mm
            </Button>
          </Tooltip>
          
          <Divider type="vertical" style={{ margin: '0 4px', height: 24 }} />
          
          <Button size="small" onClick={() => navigate('/compliance-label-print')}>
            取消
          </Button>
          <Button type="primary" size="small" onClick={handleSave}>
            保存
          </Button>
        </div>
      </div>

      {/* 标签设置弹窗 */}
      <Modal
        title="标签纸设置"
        open={labelSettingVisible}
        onOk={() => {
          setLabelSize({ ...tempLabelSize });
          setLabelSettingVisible(false);
          message.success('标签尺寸已更新');
        }}
        onCancel={() => setLabelSettingVisible(false)}
        width={500}
      >
        <div style={{ padding: '16px 0' }}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>常用尺寸:</label>
            <Row gutter={[8, 8]}>
              {[
                { w: 100, h: 70, name: '100×70mm' },
                { w: 100, h: 50, name: '100×50mm' },
                { w: 80, h: 60, name: '80×60mm' },
                { w: 80, h: 40, name: '80×40mm' },
                { w: 60, h: 40, name: '60×40mm' },
                { w: 50, h: 30, name: '50×30mm' },
                { w: 40, h: 30, name: '40×30mm' },
                { w: 40, h: 20, name: '40×20mm' },
              ].map(size => (
                <Col span={6} key={size.name}>
                  <Button 
                    block
                    type={tempLabelSize.width === size.w && tempLabelSize.height === size.h ? 'primary' : 'default'}
                    onClick={() => setTempLabelSize({ width: size.w, height: size.h })}
                  >
                    {size.name}
                  </Button>
                </Col>
              ))}
            </Row>
          </div>
          
          <Divider>自定义尺寸</Divider>
          
          <Row gutter={16}>
            <Col span={12}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>宽度 (mm):</label>
              <InputNumber
                value={tempLabelSize.width}
                onChange={(value) => setTempLabelSize({ ...tempLabelSize, width: value })}
                min={20}
                max={300}
                style={{ width: '100%' }}
              />
            </Col>
            <Col span={12}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>高度 (mm):</label>
              <InputNumber
                value={tempLabelSize.height}
                onChange={(value) => setTempLabelSize({ ...tempLabelSize, height: value })}
                min={10}
                max={200}
                style={{ width: '100%' }}
              />
            </Col>
          </Row>
          
          <div style={{ marginTop: 20, padding: 16, background: '#f5f5f5', borderRadius: 4 }}>
            <div style={{ textAlign: 'center', color: '#666' }}>
              <div style={{ fontSize: 14, marginBottom: 8 }}>预览尺寸</div>
              <div 
                style={{ 
                  display: 'inline-block',
                  width: Math.min(tempLabelSize.width * 2, 200),
                  height: Math.min(tempLabelSize.height * 2, 140),
                  border: '2px solid #1890ff',
                  background: '#fff',
                  position: 'relative'
                }}
              >
                <span style={{ 
                  position: 'absolute', 
                  top: '50%', 
                  left: '50%', 
                  transform: 'translate(-50%, -50%)',
                  fontSize: 12,
                  color: '#1890ff'
                }}>
                  {tempLabelSize.width}×{tempLabelSize.height}mm
                </span>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* 主编辑区域 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 左侧工具栏和素材库 */}
        <div style={{ width: 220, background: '#fff', borderRight: '1px solid #e8e8e8', display: 'flex', flexDirection: 'column' }}>
          {/* 基础元素工具 */}
          <div style={{ padding: '12px 8px', borderBottom: '1px solid #e8e8e8' }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 8, fontWeight: 500 }}>基础元素</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
              <Tooltip title="文本">
                <Button 
                  icon={<FontSizeOutlined />} 
                  onClick={() => addElement('text')}
                  size="small"
                  style={{ height: 40, width: '100%' }}
                />
              </Tooltip>
              <Tooltip title="条码">
                <Button 
                  onClick={() => addElement('barcode')}
                  size="small"
                  style={{ height: 40, width: '100%', fontSize: 10 }}
                >
                  条码
                </Button>
              </Tooltip>
              <Tooltip title="二维码">
                <Button 
                  onClick={() => addElement('qrcode')}
                  size="small"
                  style={{ height: 40, width: '100%', fontSize: 10 }}
                >
                  QR
                </Button>
              </Tooltip>
              <Tooltip title="图片">
                <Button 
                  icon={<PictureOutlined />}
                  onClick={() => addElement('image')}
                  size="small"
                  style={{ height: 40, width: '100%' }}
                />
              </Tooltip>
              <Tooltip title="线条">
                <Button 
                  onClick={() => addElement('line')}
                  size="small"
                  style={{ height: 40, width: '100%', fontSize: 10 }}
                >
                  线条
                </Button>
              </Tooltip>
              <Tooltip title="矩形">
                <Button 
                  icon={<BorderOutlined />}
                  onClick={() => addElement('rect')}
                  size="small"
                  style={{ height: 40, width: '100%' }}
                />
              </Tooltip>
              <Tooltip title="表格">
                <Button 
                  onClick={() => addElement('table')}
                  size="small"
                  style={{ height: 40, width: '100%', fontSize: 10 }}
                >
                  表格
                </Button>
              </Tooltip>
              <Tooltip title="素材库">
                <Button
                  icon={<AppstoreOutlined />}
                  onClick={() => setMaterialModalVisible(true)}
                  size="small"
                  type="primary"
                  ghost
                  style={{ height: 40, width: '100%' }}
                />
              </Tooltip>
              <Tooltip title="数据表">
                <Button
                  icon={<DatabaseOutlined />}
                  onClick={() => setDataTableVisible(true)}
                  size="small"
                  style={{ height: 40, width: '100%', color: '#52c41a', borderColor: '#52c41a' }}
                />
              </Tooltip>
            </div>
          </div>
          
          {/* 素材库面板 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#666', fontWeight: 500 }}>
                <AppstoreOutlined style={{ marginRight: 4 }} />
                素材库
              </span>
              <Space size={4}>
                <Tooltip title="添加素材">
                  <Button type="text" size="small" icon={<PlusOutlined />} onClick={openAddMaterial} />
                </Tooltip>
                <Tooltip title="刷新">
                  <Button type="text" size="small" icon={<ReloadOutlined />} onClick={() => loadMaterials(materialCategory)} />
                </Tooltip>
                <Upload
                  accept="image/*"
                  showUploadList={false}
                  beforeUpload={handleMaterialUpload}
                >
                  <Tooltip title="上传图片">
                    <Button type="text" size="small" icon={<UploadOutlined />} />
                  </Tooltip>
                </Upload>
              </Space>
            </div>
            
            {/* 分类标签 */}
            <div style={{ padding: '4px 8px', borderBottom: '1px solid #f0f0f0' }}>
              <Select 
                value={materialCategory} 
                onChange={(v) => { setMaterialCategory(v); loadMaterials(v); }}
                size="small"
                style={{ width: '100%' }}
              >
                <Option value="all">全部素材</Option>
                <Option value="certification">认证标识</Option>
                <Option value="icon">图标</Option>
                <Option value="text_template">文本模板</Option>
                <Option value="image">图片</Option>
              </Select>
            </div>
            
            {/* 素材列表 */}
            <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
              {materialsLoading ? (
                <div style={{ textAlign: 'center', padding: 20 }}><Spin size="small" /></div>
              ) : materials.length === 0 ? (
                <Empty 
                  image={Empty.PRESENTED_IMAGE_SIMPLE} 
                  description={
                    <span style={{ fontSize: 12 }}>
                      暂无素材
                      <Button type="link" size="small" onClick={initSystemMaterials}>初始化系统素材</Button>
                    </span>
                  }
                />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {materials.map(material => (
                    <div
                      key={material.id}
                      style={{
                        border: '1px solid #e8e8e8',
                        borderRadius: 4,
                        padding: 6,
                        cursor: 'pointer',
                        textAlign: 'center',
                        background: '#fafafa',
                        transition: 'all 0.2s',
                        minHeight: 70,
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => { 
                        e.currentTarget.style.borderColor = '#1890ff'; 
                        e.currentTarget.style.background = '#e6f7ff';
                        e.currentTarget.querySelector('.material-actions').style.opacity = '1';
                      }}
                      onMouseLeave={(e) => { 
                        e.currentTarget.style.borderColor = '#e8e8e8'; 
                        e.currentTarget.style.background = '#fafafa';
                        e.currentTarget.querySelector('.material-actions').style.opacity = '0';
                      }}
                    >
                      {/* 操作按钮 */}
                      <div 
                        className="material-actions"
                        style={{ 
                          position: 'absolute', 
                          top: 2, 
                          right: 2, 
                          opacity: 0, 
                          transition: 'opacity 0.2s',
                          display: 'flex',
                          gap: 2
                        }}
                      >
                        {!material.is_system && (
                          <>
                            <Tooltip title="编辑">
                              <Button 
                                type="text" 
                                size="small" 
                                icon={<EditOutlined style={{ fontSize: 10 }} />}
                                onClick={(e) => { e.stopPropagation(); openEditMaterial(material); }}
                                style={{ padding: '0 4px', height: 18, minWidth: 18 }}
                              />
                            </Tooltip>
                            <Popconfirm
                              title="确定删除此素材?"
                              onConfirm={(e) => { e.stopPropagation(); deleteMaterial(material.id); }}
                              okText="确定"
                              cancelText="取消"
                            >
                              <Tooltip title="删除">
                                <Button 
                                  type="text" 
                                  size="small" 
                                  danger
                                  icon={<DeleteOutlined style={{ fontSize: 10 }} />}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ padding: '0 4px', height: 18, minWidth: 18 }}
                                />
                              </Tooltip>
                            </Popconfirm>
                          </>
                        )}
                      </div>
                      
                      {/* 素材内容 */}
                      <div onClick={() => addMaterialToCanvas(material)}>
                        {material.content_type === 'svg' ? (
                          <div 
                            style={{ width: '100%', height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            dangerouslySetInnerHTML={{ __html: material.content }}
                          />
                        ) : material.content_type === 'text' ? (
                          <div style={{ fontSize: 9, fontWeight: 'bold', padding: '6px 0', wordBreak: 'break-all', minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {material.content.length > 12 ? material.content.substring(0, 12) + '...' : material.content}
                          </div>
                        ) : (
                          <img 
                            src={material.content} 
                            alt={material.name}
                            style={{ maxWidth: '100%', maxHeight: 36, objectFit: 'contain' }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        )}
                        <div style={{ fontSize: 9, color: '#666', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {material.name}
                        </div>
                        <div style={{ fontSize: 8, color: '#999' }}>
                          {material.content_type === 'text' ? '文本' : material.content_type === 'url' ? '图片' : material.content_type}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 中间画布区域 */}
        <div 
          data-canvas-container
          style={{ 
            flex: 1, 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            overflow: 'auto',
            padding: 40,
            background: '#f5f5f5'
          }}
        >
          <div
            ref={canvasRef}
            style={{
              width: `${labelSize.width * mmToPixel * zoom}px`,
              height: `${labelSize.height * mmToPixel * zoom}px`,
              border: '2px solid #000',
              position: 'relative',
              background: '#fff',
              cursor: 'crosshair',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onClick={(e) => {
              if (!hasMoved.current) {
                setSelectedElement(null);
              }
            }}
          >
            {/* 对齐辅助线 */}
            {alignmentLines.map((line, index) => (
              <div
                key={`line-${index}`}
                style={{
                  position: 'absolute',
                  background: '#00bfff',
                  pointerEvents: 'none',
                  zIndex: 9999,
                  ...(line.type === 'vertical' ? {
                    left: line.position * zoom,
                    top: 0,
                    width: 1,
                    height: '100%'
                  } : {
                    left: 0,
                    top: line.position * zoom,
                    width: '100%',
                    height: 1
                  })
                }}
              />
            ))}
            
            {elements.map(element => (
              <div
                key={element.id}
                onMouseDown={(e) => handleMouseDown(e, element)}
                onMouseUp={(e) => handleElementMouseUp(e, element)}
                onClick={(e) => {
                  e.stopPropagation();
                  // 直接选中元素
                  setSelectedElement(element);
                }}
                onDoubleClick={(e) => handleDoubleClick(e, element)}
                style={{
                  position: 'absolute',
                  left: element.x * zoom,
                  top: element.y * zoom,
                  width: element.width * zoom,
                  height: element.height * zoom,
                  fontSize: (element.fontSize || 12) * zoom,
                  fontWeight: element.fontWeight || 'normal',
                  fontFamily: element.fontFamily || 'Arial',
                  color: element.color || '#000000',
                  textAlign: element.textAlign || 'left',
                  transform: element.rotation ? `rotate(${element.rotation}deg)` : 'none',
                  transformOrigin: 'center center',
                  border: element.border ? '2px solid #000' : selectedElement?.id === element.id ? '2px dashed #1890ff' : '1px solid transparent',
                  padding: element.type === 'image' || element.type === 'qrcode' || element.type === 'barcode' ? '0' : '4px',
                  cursor: editingElement?.id === element.id ? 'text' : 'move',
                  userSelect: editingElement?.id === element.id ? 'text' : 'none',
                  background: selectedElement?.id === element.id && element.type !== 'image' && element.type !== 'qrcode' && element.type !== 'barcode' ? 'rgba(24, 144, 255, 0.1)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: element.textAlign === 'center' ? 'center' : element.textAlign === 'right' ? 'flex-end' : 'flex-start',
                  overflow: editingElement?.id === element.id ? 'visible' : 'hidden',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {editingElement?.id === element.id && (element.type === 'text' || element.type === 'barcode' || element.type === 'qrcode') ? (
                  <textarea
                    ref={editInputRef}
                    value={element.content}
                    onChange={(e) => updateElement('content', e.target.value)}
                    onBlur={handleEditBlur}
                    onKeyDown={handleEditKeyDown}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      fontSize: 'inherit',
                      fontWeight: 'inherit',
                      textAlign: 'inherit',
                      padding: 0,
                      margin: 0,
                      resize: 'none',
                      fontFamily: 'inherit',
                      lineHeight: 'inherit'
                    }}
                  />
                ) : (
                  <>
                    {element.type === 'text' && (
                      /\{\{.+?\}\}/.test(element.content) ? (
                        <span>
                          {element.content.split(/(\{\{.+?\}\})/).map((part, i) =>
                            /^\{\{.+?\}\}$/.test(part) ? (
                              <span key={i} style={{ background: '#e6f7ff', border: '1px dashed #1890ff', borderRadius: 2, padding: '0 2px', fontSize: '0.9em', color: '#1890ff' }}>
                                {part}
                              </span>
                            ) : part
                          )}
                        </span>
                      ) : element.content
                    )}
                    {element.type === 'barcode' && (
                      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: '100%', height: '70%', background: 'repeating-linear-gradient(90deg, #000 0px, #000 2px, #fff 2px, #fff 4px)' }}></div>
                        <div style={{ fontSize: element.fontSize || 10, marginTop: 2 }}>{element.content}</div>
                      </div>
                    )}
                    {element.type === 'qrcode' && (
                      <QRCodeImage content={element.content || 'https://example.com'} size={Math.min(element.width, element.height)} />
                    )}
                    {element.type === 'image' && (
                      element.content ? (
                        <img 
                          src={element.content} 
                          alt={element.materialName || '图片'}
                          draggable={false}
                          onDragStart={(e) => e.preventDefault()}
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'fill',
                            pointerEvents: 'none',
                            userSelect: 'none'
                          }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling && (e.target.nextSibling.style.display = 'flex');
                          }}
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #999' }}>
                          <span style={{ fontSize: 12, color: '#999' }}>图片</span>
                        </div>
                      )
                    )}
                    {element.type === 'line' && (
                      <div style={{ width: '100%', height: '100%', background: element.borderColor || '#000' }}></div>
                    )}
                    {element.type === 'rect' && (
                      <div style={{ 
                        width: '100%', 
                        height: '100%', 
                        border: `${element.borderWidth || 2}px solid ${element.borderColor || '#000'}`,
                        background: element.fillColor || 'transparent'
                      }}></div>
                    )}
                    {element.type === 'table' && (
                      <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                        <tbody>
                          {Array.from({ length: element.rows || 3 }).map((_, i) => (
                            <tr key={i} style={{ height: `${100 / (element.rows || 3)}%` }}>
                              {Array.from({ length: element.cols || 2 }).map((_, j) => {
                                const cellKey = `${i}-${j}`;
                                const cellContent = element.cellData?.[cellKey] || '';
                                const isEditing = editingCell?.elementId === element.id && editingCell?.row === i && editingCell?.col === j;
                                
                                return (
                                  <td 
                                    key={j} 
                                    style={{ 
                                      border: `1px solid ${element.borderColor || '#000'}`, 
                                      padding: 2,
                                      fontSize: (element.fontSize || 10) * zoom,
                                      verticalAlign: 'middle',
                                      textAlign: 'center',
                                      position: 'relative',
                                      cursor: 'text',
                                      overflow: 'hidden',
                                      width: `${100 / (element.cols || 2)}%`
                                    }}
                                    onDoubleClick={(e) => {
                                      e.stopPropagation();
                                      setEditingCell({ elementId: element.id, row: i, col: j });
                                      setTimeout(() => cellInputRef.current?.focus(), 0);
                                    }}
                                  >
                                    {isEditing ? (
                                      <input
                                        ref={cellInputRef}
                                        type="text"
                                        value={cellContent}
                                        onChange={(e) => {
                                          const newCellData = { ...(element.cellData || {}), [cellKey]: e.target.value };
                                          const newElements = elements.map(el => 
                                            el.id === element.id ? { ...el, cellData: newCellData } : el
                                          );
                                          setElements(newElements);
                                        }}
                                        onBlur={() => {
                                          setEditingCell(null);
                                          addToHistory(elements);
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' || e.key === 'Escape') {
                                            setEditingCell(null);
                                            addToHistory(elements);
                                          }
                                          if (e.key === 'Tab') {
                                            e.preventDefault();
                                            // 移动到下一个单元格
                                            const nextCol = j + 1;
                                            const nextRow = nextCol >= (element.cols || 2) ? i + 1 : i;
                                            const finalCol = nextCol >= (element.cols || 2) ? 0 : nextCol;
                                            if (nextRow < (element.rows || 3)) {
                                              setEditingCell({ elementId: element.id, row: nextRow, col: finalCol });
                                            } else {
                                              setEditingCell(null);
                                            }
                                            addToHistory(elements);
                                          }
                                        }}
                                        style={{
                                          position: 'absolute',
                                          top: 0,
                                          left: 0,
                                          width: '100%',
                                          height: '100%',
                                          border: 'none',
                                          outline: 'none',
                                          boxShadow: 'inset 0 0 0 2px #1890ff',
                                          background: '#fff',
                                          textAlign: 'center',
                                          fontSize: 'inherit',
                                          padding: 0,
                                          boxSizing: 'border-box'
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    ) : (
                                      <span style={{ 
                                        userSelect: 'none',
                                        display: 'block',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        maxWidth: '100%'
                                      }}>{cellContent}</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </>
                )}
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
                        borderRadius: '50%',
                        border: '2px solid #fff'
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
                        borderRadius: '50%',
                        border: '2px solid #fff'
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
                        borderRadius: '50%',
                        border: '2px solid #fff'
                      }}
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 右侧属性面板 */}
        <div style={{ width: 280, background: '#fff', borderLeft: '1px solid #e8e8e8', overflowY: 'auto', padding: 16 }}>
          <Card title="属性编辑" size="small" bordered={false}>
            {selectedElement ? (
              <div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500 }}>类型:</label>
                  <Input value={selectedElement.type} disabled />
                </div>

                {(selectedElement.type === 'text' || selectedElement.type === 'barcode' || selectedElement.type === 'qrcode') && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500 }}>内容:</label>
                    <TextArea
                      value={selectedElement.content}
                      onChange={(e) => updateElement('content', e.target.value)}
                      onBlur={() => addToHistory(elements)}
                      rows={4}
                      placeholder="输入内容，支持 {{表名.列名}} 变量"
                    />
                    {selectedElement.type === 'text' && (
                      <div style={{ marginTop: 4 }}>
                        <Button
                          type="link"
                          size="small"
                          icon={<DatabaseOutlined />}
                          onClick={() => setDataTableVisible(true)}
                          style={{ padding: 0, fontSize: 12 }}
                        >
                          插入数据表变量
                        </Button>
                        {selectedElement.content && /\{\{.+?\}\}/.test(selectedElement.content) && (
                          <div style={{ marginTop: 4, padding: '4px 8px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4, fontSize: 11 }}>
                            包含变量引用，打印时将自动替换为数据表中的值
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {selectedElement.type === 'image' && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500 }}>图片地址:</label>
                    <Input
                      value={selectedElement.content}
                      onChange={(e) => updateElement('content', e.target.value)}
                      onBlur={() => addToHistory(elements)}
                      placeholder="输入图片URL或从素材库选择"
                      prefix={<LinkOutlined />}
                    />
                    <div style={{ marginTop: 8 }}>
                      <Upload
                        accept="image/*"
                        showUploadList={false}
                        beforeUpload={async (file) => {
                          const formData = new FormData();
                          formData.append('file', file);
                          try {
                            const res = await fetch('/api/label-materials/upload', {
                              method: 'POST',
                              body: formData
                            });
                            const data = await res.json();
                            if (data.success) {
                              updateElement('content', data.data.url);
                              addToHistory(elements);
                              message.success('图片上传成功');
                            }
                          } catch (error) {
                            message.error('上传失败');
                          }
                          return false;
                        }}
                      >
                        <Button icon={<UploadOutlined />} size="small" block>
                          上传图片
                        </Button>
                      </Upload>
                    </div>
                    {selectedElement.content && (
                      <div style={{ marginTop: 8, textAlign: 'center', padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
                        <img 
                          src={selectedElement.content} 
                          alt="预览" 
                          style={{ maxWidth: '100%', maxHeight: 100, objectFit: 'contain' }}
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {selectedElement.type === 'text' && (
                  <>
                    <Divider style={{ margin: '12px 0' }}>文本样式</Divider>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500 }}>字体大小:</label>
                  <InputNumber
                    value={selectedElement.fontSize}
                    onChange={(value) => updateElement('fontSize', value)}
                    onBlur={() => addToHistory(elements)}
                    min={6}
                    max={72}
                    style={{ width: '100%' }}
                    addonAfter="px"
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500 }}>字体:</label>
                  <Select
                    value={selectedElement.fontFamily || 'Arial'}
                    onChange={(value) => updateElementAndSave('fontFamily', value)}
                    style={{ width: '100%' }}
                  >
                    <Option value="Arial">Arial</Option>
                    <Option value="SimSun">宋体</Option>
                    <Option value="SimHei">黑体</Option>
                    <Option value="Microsoft YaHei">微软雅黑</Option>
                    <Option value="KaiTi">楷体</Option>
                    <Option value="FangSong">仿宋</Option>
                    <Option value="Times New Roman">Times New Roman</Option>
                    <Option value="Courier New">Courier New</Option>
                  </Select>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500 }}>字体粗细:</label>
                  <Select
                    value={selectedElement.fontWeight || 'normal'}
                    onChange={(value) => updateElementAndSave('fontWeight', value)}
                    style={{ width: '100%' }}
                  >
                    <Option value="normal">正常</Option>
                    <Option value="bold">粗体</Option>
                  </Select>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500 }}>文字颜色:</label>
                  <Input
                    type="color"
                    value={selectedElement.color || '#000000'}
                    onChange={(e) => updateElementAndSave('color', e.target.value)}
                    style={{ width: '100%', height: 32 }}
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500 }}>对齐:</label>
                  <Space.Compact style={{ width: '100%' }}>
                    <Button 
                      icon={<AlignLeftOutlined />}
                      type={selectedElement.textAlign === 'left' || !selectedElement.textAlign ? 'primary' : 'default'}
                      onClick={() => updateElementAndSave('textAlign', 'left')}
                      style={{ flex: 1 }}
                    />
                    <Button 
                      icon={<AlignCenterOutlined />}
                      type={selectedElement.textAlign === 'center' ? 'primary' : 'default'}
                      onClick={() => updateElementAndSave('textAlign', 'center')}
                      style={{ flex: 1 }}
                    />
                    <Button 
                      icon={<AlignRightOutlined />}
                      type={selectedElement.textAlign === 'right' ? 'primary' : 'default'}
                      onClick={() => updateElementAndSave('textAlign', 'right')}
                      style={{ flex: 1 }}
                    />
                  </Space.Compact>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500 }}>旋转角度:</label>
                  <InputNumber
                    value={selectedElement.rotation || 0}
                    onChange={(value) => updateElementAndSave('rotation', value)}
                    min={-180}
                    max={180}
                    style={{ width: '100%' }}
                    addonAfter="°"
                  />
                </div>

                <Divider style={{ margin: '12px 0' }}>位置和尺寸</Divider>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500 }}>X:</label>
                    <InputNumber
                      value={selectedElement.x}
                      onChange={(value) => updateElement('x', value)}
                      onBlur={() => addToHistory(elements)}
                      min={0}
                      max={Math.round(labelSize.width * mmToPixel)}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500 }}>Y:</label>
                    <InputNumber
                      value={selectedElement.y}
                      onChange={(value) => updateElement('y', value)}
                      onBlur={() => addToHistory(elements)}
                      min={0}
                      max={Math.round(labelSize.height * mmToPixel)}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500 }}>宽度:</label>
                    <InputNumber
                      value={selectedElement.width}
                      onChange={(value) => updateElement('width', value)}
                      onBlur={() => addToHistory(elements)}
                      min={20}
                      max={Math.round(labelSize.width * mmToPixel)}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500 }}>高度:</label>
                    <InputNumber
                      value={selectedElement.height}
                      onChange={(value) => updateElement('height', value)}
                      onBlur={() => addToHistory(elements)}
                      min={15}
                      max={Math.round(labelSize.height * mmToPixel)}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                    <div style={{ marginBottom: 12 }}>
                      <Button 
                        icon={<BorderOutlined />}
                        type={selectedElement.border ? 'primary' : 'default'}
                        onClick={() => updateElementAndSave('border', !selectedElement.border)}
                        block
                      >
                        {selectedElement.border ? '移除边框' : '添加边框'}
                      </Button>
                    </div>
                  </>
                )}

                {(selectedElement.type === 'rect' || selectedElement.type === 'line') && (
                  <>
                    <Divider style={{ margin: '12px 0' }}>边框样式</Divider>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500 }}>边框颜色:</label>
                      <Input
                        type="color"
                        value={selectedElement.borderColor || '#000'}
                        onChange={(e) => updateElementAndSave('borderColor', e.target.value)}
                      />
                    </div>
                    {selectedElement.type === 'rect' && (
                      <>
                        <div style={{ marginBottom: 12 }}>
                          <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500 }}>边框宽度:</label>
                          <InputNumber
                            value={selectedElement.borderWidth || 2}
                            onChange={(value) => updateElementAndSave('borderWidth', value)}
                            min={1}
                            max={10}
                            style={{ width: '100%' }}
                          />
                        </div>
                        <div style={{ marginBottom: 12 }}>
                          <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500 }}>填充颜色:</label>
                          <Input
                            type="color"
                            value={selectedElement.fillColor || '#ffffff'}
                            onChange={(e) => updateElementAndSave('fillColor', e.target.value)}
                          />
                        </div>
                      </>
                    )}
                  </>
                )}

                {selectedElement.type === 'table' && (
                  <>
                    <Divider style={{ margin: '12px 0' }}>表格设置</Divider>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500 }}>行数:</label>
                      <InputNumber
                        value={selectedElement.rows || 3}
                        onChange={(value) => updateElementAndSave('rows', value)}
                        min={1}
                        max={10}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500 }}>列数:</label>
                      <InputNumber
                        value={selectedElement.cols || 2}
                        onChange={(value) => updateElementAndSave('cols', value)}
                        min={1}
                        max={10}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>
                <p>点击画布中的元素</p>
                <p>开始编辑</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* 添加/编辑素材弹窗 */}
      <Modal
        title={editingMaterial ? '编辑素材' : '添加素材'}
        open={addMaterialVisible}
        onCancel={() => setAddMaterialVisible(false)}
        footer={null}
        width={500}
      >
        <Form
          form={materialForm}
          layout="vertical"
          onFinish={saveMaterial}
          initialValues={{
            category: 'text_template',
            content_type: 'text',
            width: 100,
            height: 30
          }}
        >
          <Form.Item
            name="name"
            label="素材名称"
            rules={[{ required: true, message: '请输入素材名称' }]}
          >
            <Input placeholder="例如: CE标识、公司地址" />
          </Form.Item>

          <Form.Item
            name="category"
            label="素材分类"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Select>
              <Option value="text_template">文本模板</Option>
              <Option value="certification">认证标识</Option>
              <Option value="icon">图标</Option>
              <Option value="image">图片</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="content_type"
            label="内容类型"
            rules={[{ required: true, message: '请选择内容类型' }]}
          >
            <Radio.Group>
              <Radio value="text">文本</Radio>
              <Radio value="url">图片链接</Radio>
              <Radio value="svg">SVG代码</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.content_type !== currentValues.content_type}
          >
            {({ getFieldValue }) => {
              const contentType = getFieldValue('content_type');
              return (
                <Form.Item
                  name="content"
                  label={contentType === 'text' ? '文本内容' : contentType === 'url' ? '图片链接' : 'SVG代码'}
                  rules={[{ required: true, message: '请输入内容' }]}
                >
                  {contentType === 'text' ? (
                    <Input placeholder="例如: MADE IN CHINA" />
                  ) : contentType === 'url' ? (
                    <Input 
                      placeholder="https://example.com/image.png" 
                      prefix={<LinkOutlined />}
                    />
                  ) : (
                    <TextArea 
                      rows={4} 
                      placeholder='<svg viewBox="0 0 100 100">...</svg>'
                    />
                  )}
                </Form.Item>
              );
            }}
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="width" label="默认宽度(px)">
                <InputNumber min={10} max={500} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="height" label="默认高度(px)">
                <InputNumber min={10} max={500} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="描述(可选)">
            <Input placeholder="素材用途说明" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setAddMaterialVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                {editingMaterial ? '更新' : '添加'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 数据表管理弹窗 */}
      <DataTableManager
        visible={dataTableVisible}
        onClose={() => setDataTableVisible(false)}
        onInsertVariable={handleInsertVariable}
      />
    </div>
  );
};

export default LabelEditor;
