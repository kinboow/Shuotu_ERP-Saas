import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Input, Table, Space, message, Popconfirm, Form, Select, Tabs, Tag, Tooltip, Empty } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, DatabaseOutlined, SaveOutlined, ReloadOutlined } from '@ant-design/icons';

const API_BASE = '/api/label-data-tables';

/**
 * 数据表管理组件
 * 支持创建/编辑数据表、管理行数据、插入变量引用
 */
const DataTableManager = ({ visible, onClose, onInsertVariable }) => {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('tables'); // tables | editor
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableRows, setTableRows] = useState([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [form] = Form.useForm();
  const [columns, setColumns] = useState([{ key: 'col1', title: '列1', type: 'text' }]);

  // 加载数据表列表
  const loadTables = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API_BASE);
      const data = await res.json();
      if (data.success) {
        setTables(data.data || []);
      }
    } catch (e) {
      console.error('加载数据表失败:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (visible) loadTables();
  }, [visible, loadTables]);

  // 加载某表的行数据
  const loadRows = async (tableId) => {
    setRowsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/${tableId}`);
      const data = await res.json();
      if (data.success) {
        setSelectedTable(data.data);
        setTableRows(data.data.rows || []);
      }
    } catch (e) {
      console.error('加载行数据失败:', e);
    }
    setRowsLoading(false);
  };

  // 创建/更新数据表
  const handleSaveTable = async () => {
    try {
      const values = await form.validateFields();
      const payload = { name: values.name, description: values.description, columns };
      
      let res;
      if (editingTable) {
        res = await fetch(`${API_BASE}/${editingTable.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      const data = await res.json();
      if (data.success) {
        message.success(editingTable ? '数据表已更新' : '数据表已创建');
        setCreateModalVisible(false);
        setEditingTable(null);
        form.resetFields();
        setColumns([{ key: 'col1', title: '列1', type: 'text' }]);
        loadTables();
      } else {
        message.error(data.message);
      }
    } catch (e) {
      // validation error
    }
  };

  // 删除数据表
  const handleDeleteTable = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        message.success('已删除');
        if (selectedTable?.id === id) {
          setSelectedTable(null);
          setTableRows([]);
        }
        loadTables();
      }
    } catch (e) {
      message.error('删除失败');
    }
  };

  // 添加行
  const handleAddRow = async () => {
    if (!selectedTable) return;
    const emptyData = {};
    selectedTable.columns.forEach(col => { emptyData[col.key] = ''; });
    try {
      const res = await fetch(`${API_BASE}/${selectedTable.id}/rows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: emptyData })
      });
      const data = await res.json();
      if (data.success) {
        setTableRows([...tableRows, data.data]);
      }
    } catch (e) {
      message.error('添加行失败');
    }
  };

  // 更新行
  const handleUpdateRow = async (rowId, newData) => {
    try {
      await fetch(`${API_BASE}/${selectedTable.id}/rows/${rowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: newData })
      });
    } catch (e) {
      console.error('更新行失败:', e);
    }
  };

  // 删除行
  const handleDeleteRow = async (rowId) => {
    try {
      const res = await fetch(`${API_BASE}/${selectedTable.id}/rows/${rowId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setTableRows(tableRows.filter(r => r.id !== rowId));
      }
    } catch (e) {
      message.error('删除行失败');
    }
  };

  // 单元格编辑
  const handleCellChange = (rowId, colKey, value) => {
    const newRows = tableRows.map(row => {
      if (row.id === rowId) {
        const newData = { ...row.data, [colKey]: value };
        // 延迟保存
        clearTimeout(row._saveTimer);
        row._saveTimer = setTimeout(() => handleUpdateRow(rowId, newData), 500);
        return { ...row, data: newData };
      }
      return row;
    });
    setTableRows(newRows);
  };

  // 打开编辑表结构
  const openEditTable = (table) => {
    setEditingTable(table);
    form.setFieldsValue({ name: table.name, description: table.description });
    setColumns(table.columns || []);
    setCreateModalVisible(true);
  };

  // 添加列定义
  const addColumn = () => {
    const key = `col${columns.length + 1}`;
    setColumns([...columns, { key, title: `列${columns.length + 1}`, type: 'text' }]);
  };

  // 更新列定义
  const updateColumn = (index, field, value) => {
    const newCols = [...columns];
    newCols[index] = { ...newCols[index], [field]: value };
    // 如果修改了title，同步更新key（仅新建时）
    if (field === 'title' && !editingTable) {
      newCols[index].key = `col_${value.replace(/\s+/g, '_').toLowerCase() || index}`;
    }
    setColumns(newCols);
  };

  // 删除列定义
  const removeColumn = (index) => {
    if (columns.length <= 1) {
      message.warning('至少保留一列');
      return;
    }
    setColumns(columns.filter((_, i) => i !== index));
  };

  // 插入变量到标签编辑器
  const handleInsertVariable = (table, colKey, colTitle) => {
    if (onInsertVariable) {
      onInsertVariable({
        tableId: table.id,
        tableName: table.name,
        columnKey: colKey,
        columnTitle: colTitle,
        variable: `{{${table.name}.${colTitle}}}`
      });
      message.success(`已插入变量: {{${table.name}.${colTitle}}}`);
    }
  };

  // 数据表列表视图
  const renderTableList = () => (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
        <Button icon={<PlusOutlined />} type="primary" size="small" onClick={() => {
          setEditingTable(null);
          form.resetFields();
          setColumns([{ key: 'col1', title: '列1', type: 'text' }]);
          setCreateModalVisible(true);
        }}>
          新建数据表
        </Button>
        <Button icon={<ReloadOutlined />} size="small" onClick={loadTables}>刷新</Button>
      </div>
      
      {tables.length === 0 ? (
        <Empty description="暂无数据表，点击上方按钮创建" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tables.map(table => (
            <div 
              key={table.id}
              style={{
                padding: '12px 16px',
                border: selectedTable?.id === table.id ? '2px solid #1890ff' : '1px solid #e8e8e8',
                borderRadius: 6,
                cursor: 'pointer',
                background: selectedTable?.id === table.id ? '#e6f7ff' : '#fff',
                transition: 'all 0.2s'
              }}
              onClick={() => { loadRows(table.id); setActiveTab('editor'); }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <DatabaseOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                  <span style={{ fontWeight: 500 }}>{table.name}</span>
                  <Tag color="blue" style={{ marginLeft: 8 }}>{(table.columns || []).length} 列</Tag>
                </div>
                <Space size={4}>
                  <Tooltip title="编辑表结构">
                    <Button type="text" size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); openEditTable(table); }} />
                  </Tooltip>
                  <Popconfirm title="确定删除此数据表？" onConfirm={(e) => { e.stopPropagation(); handleDeleteTable(table.id); }}>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
                  </Popconfirm>
                </Space>
              </div>
              {table.description && <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>{table.description}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // 数据编辑视图（可编辑表格）
  const renderDataEditor = () => {
    if (!selectedTable) {
      return <Empty description="请先选择一个数据表" />;
    }

    const tableColumns = [
      {
        title: '#',
        width: 50,
        render: (_, __, index) => index + 1
      },
      ...(selectedTable.columns || []).map(col => ({
        title: (
          <div>
            {col.title}
            <Tooltip title={`插入变量 {{${selectedTable.name}.${col.title}}}`}>
              <Button 
                type="link" 
                size="small" 
                style={{ padding: '0 4px', fontSize: 11 }}
                onClick={() => handleInsertVariable(selectedTable, col.key, col.title)}
              >
                插入
              </Button>
            </Tooltip>
          </div>
        ),
        dataIndex: ['data', col.key],
        key: col.key,
        render: (text, record) => (
          <Input
            size="small"
            value={record.data?.[col.key] || ''}
            onChange={(e) => handleCellChange(record.id, col.key, e.target.value)}
            placeholder={col.title}
            style={{ border: 'none', background: 'transparent' }}
          />
        )
      })),
      {
        title: '操作',
        width: 60,
        render: (_, record) => (
          <Popconfirm title="删除此行？" onConfirm={() => handleDeleteRow(record.id)}>
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        )
      }
    ];

    return (
      <div>
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Button type="link" size="small" onClick={() => setActiveTab('tables')} style={{ padding: 0 }}>
              ← 返回列表
            </Button>
            <span style={{ marginLeft: 12, fontWeight: 500 }}>
              <DatabaseOutlined style={{ marginRight: 4 }} />
              {selectedTable.name}
            </span>
          </div>
          <Space>
            <Button icon={<PlusOutlined />} size="small" onClick={handleAddRow}>添加行</Button>
            <Button icon={<ReloadOutlined />} size="small" onClick={() => loadRows(selectedTable.id)}>刷新</Button>
          </Space>
        </div>

        {/* 变量引用提示 */}
        <div style={{ marginBottom: 8, padding: '6px 12px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4, fontSize: 12 }}>
          点击列标题旁的「插入」按钮，可将该列作为变量插入到标签文本中。变量格式：<code>{`{{表名.列名}}`}</code>
        </div>

        <Table
          columns={tableColumns}
          dataSource={tableRows}
          rowKey="id"
          size="small"
          loading={rowsLoading}
          pagination={false}
          bordered
          scroll={{ y: 350 }}
          locale={{ emptyText: '暂无数据，点击"添加行"开始录入' }}
        />
      </div>
    );
  };

  return (
    <>
      <Modal
        title={
          <span>
            <DatabaseOutlined style={{ marginRight: 8 }} />
            数据表管理
          </span>
        }
        open={visible}
        onCancel={onClose}
        width={800}
        footer={null}
        bodyStyle={{ minHeight: 400 }}
      >
        {activeTab === 'tables' ? renderTableList() : renderDataEditor()}
      </Modal>

      {/* 创建/编辑数据表弹窗 */}
      <Modal
        title={editingTable ? '编辑数据表' : '新建数据表'}
        open={createModalVisible}
        onOk={handleSaveTable}
        onCancel={() => { setCreateModalVisible(false); setEditingTable(null); }}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="表名" rules={[{ required: true, message: '请输入表名' }]}>
            <Input placeholder="例如：产品信息表" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input placeholder="可选，描述此数据表的用途" />
          </Form.Item>
        </Form>

        <div style={{ marginBottom: 8, fontWeight: 500 }}>列定义：</div>
        {columns.map((col, index) => (
          <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <Input
              value={col.title}
              onChange={(e) => updateColumn(index, 'title', e.target.value)}
              placeholder="列名"
              style={{ flex: 1 }}
            />
            <Select
              value={col.type}
              onChange={(v) => updateColumn(index, 'type', v)}
              style={{ width: 100 }}
            >
              <Select.Option value="text">文本</Select.Option>
              <Select.Option value="number">数字</Select.Option>
              <Select.Option value="date">日期</Select.Option>
            </Select>
            <Button 
              type="text" 
              danger 
              icon={<DeleteOutlined />} 
              onClick={() => removeColumn(index)}
              disabled={columns.length <= 1}
            />
          </div>
        ))}
        <Button type="dashed" block icon={<PlusOutlined />} onClick={addColumn}>
          添加列
        </Button>
      </Modal>
    </>
  );
};

export default DataTableManager;
