import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Input, Table, Space, message, Popconfirm, Form, Select, Tag, Tooltip, Empty, Modal, Row, Col, Breadcrumb } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, DatabaseOutlined, SaveOutlined, ReloadOutlined, SearchOutlined, ArrowLeftOutlined } from '@ant-design/icons';

const API_BASE = '/api/label-data-tables';

const DataTablePage = () => {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableRows, setTableRows] = useState([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [form] = Form.useForm();
  const [columns, setColumns] = useState([{ key: 'col1', title: '列1', type: 'text' }]);
  const [searchText, setSearchText] = useState('');

  const loadTables = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API_BASE);
      const data = await res.json();
      if (data.success) setTables(data.data || []);
    } catch (e) {
      message.error('加载数据表失败');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadTables(); }, [loadTables]);

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
      message.error('加载数据失败');
    }
    setRowsLoading(false);
  };

  const handleSaveTable = async () => {
    try {
      const values = await form.validateFields();
      const payload = { name: values.name, description: values.description, columns };
      let res;
      if (editingTable) {
        res = await fetch(`${API_BASE}/${editingTable.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(API_BASE, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
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
    } catch (e) { /* validation */ }
  };

  const handleDeleteTable = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        message.success('已删除');
        if (selectedTable?.id === id) { setSelectedTable(null); setTableRows([]); }
        loadTables();
      }
    } catch (e) { message.error('删除失败'); }
  };

  const handleAddRow = async () => {
    if (!selectedTable) return;
    const emptyData = {};
    selectedTable.columns.forEach(col => { emptyData[col.key] = ''; });
    try {
      const res = await fetch(`${API_BASE}/${selectedTable.id}/rows`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: emptyData })
      });
      const data = await res.json();
      if (data.success) setTableRows([...tableRows, data.data]);
    } catch (e) { message.error('添加行失败'); }
  };

  const handleUpdateRow = async (rowId, newData) => {
    try {
      await fetch(`${API_BASE}/${selectedTable.id}/rows/${rowId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: newData })
      });
    } catch (e) { console.error('更新行失败:', e); }
  };

  const handleDeleteRow = async (rowId) => {
    try {
      const res = await fetch(`${API_BASE}/${selectedTable.id}/rows/${rowId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) setTableRows(tableRows.filter(r => r.id !== rowId));
    } catch (e) { message.error('删除行失败'); }
  };

  const handleCellChange = (rowId, colKey, value) => {
    const newRows = tableRows.map(row => {
      if (row.id === rowId) {
        const newData = { ...row.data, [colKey]: value };
        clearTimeout(row._saveTimer);
        row._saveTimer = setTimeout(() => handleUpdateRow(rowId, newData), 500);
        return { ...row, data: newData };
      }
      return row;
    });
    setTableRows(newRows);
  };

  const openEditTable = (table) => {
    setEditingTable(table);
    form.setFieldsValue({ name: table.name, description: table.description });
    setColumns(table.columns || []);
    setCreateModalVisible(true);
  };

  const openCreateTable = () => {
    setEditingTable(null);
    form.resetFields();
    setColumns([{ key: 'col1', title: '列1', type: 'text' }]);
    setCreateModalVisible(true);
  };

  const addColumn = () => {
    const key = `col${columns.length + 1}`;
    setColumns([...columns, { key, title: `列${columns.length + 1}`, type: 'text' }]);
  };

  const updateColumn = (index, field, value) => {
    const newCols = [...columns];
    newCols[index] = { ...newCols[index], [field]: value };
    if (field === 'title' && !editingTable) {
      newCols[index].key = `col_${value.replace(/\s+/g, '_').toLowerCase() || index}`;
    }
    setColumns(newCols);
  };

  const removeColumn = (index) => {
    if (columns.length <= 1) { message.warning('至少保留一列'); return; }
    setColumns(columns.filter((_, i) => i !== index));
  };

  const filteredTables = tables.filter(t =>
    !searchText || t.name.toLowerCase().includes(searchText.toLowerCase())
  );

  // 数据表列表视图
  if (!selectedTable) {
    return (
      <div>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <DatabaseOutlined style={{ fontSize: 20, marginRight: 8, color: '#1890ff' }} />
            <span style={{ fontSize: 18, fontWeight: 600 }}>数据表管理</span>
            <span style={{ marginLeft: 12, color: '#999', fontSize: 13 }}>
              创建和管理标签打印所需的数据表，在标签编辑器中可引用数据表字段作为变量
            </span>
          </div>
          <Space>
            <Input
              placeholder="搜索数据表"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ width: 200 }}
              allowClear
            />
            <Button icon={<ReloadOutlined />} onClick={loadTables}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateTable}>新建数据表</Button>
          </Space>
        </div>

        {filteredTables.length === 0 ? (
          <Card>
            <Empty
              description={searchText ? '没有匹配的数据表' : '暂无数据表，点击右上角"新建数据表"开始创建'}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              {!searchText && (
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreateTable}>
                  新建数据表
                </Button>
              )}
            </Empty>
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            {filteredTables.map(table => (
              <Col xs={24} sm={12} lg={8} xl={6} key={table.id}>
                <Card
                  hoverable
                  onClick={() => loadRows(table.id)}
                  actions={[
                    <Tooltip title="编辑表结构" key="edit">
                      <EditOutlined onClick={(e) => { e.stopPropagation(); openEditTable(table); }} />
                    </Tooltip>,
                    <Popconfirm
                      key="delete"
                      title="确定删除此数据表？所有数据将丢失"
                      onConfirm={(e) => { e.stopPropagation(); handleDeleteTable(table.id); }}
                      onCancel={(e) => e.stopPropagation()}
                    >
                      <DeleteOutlined style={{ color: '#ff4d4f' }} onClick={(e) => e.stopPropagation()} />
                    </Popconfirm>
                  ]}
                >
                  <Card.Meta
                    avatar={<DatabaseOutlined style={{ fontSize: 28, color: '#1890ff' }} />}
                    title={table.name}
                    description={
                      <div>
                        <div style={{ marginBottom: 8, color: '#999', fontSize: 12, minHeight: 20 }}>
                          {table.description || '暂无描述'}
                        </div>
                        <Space size={4}>
                          <Tag color="blue">{(table.columns || []).length} 列</Tag>
                          <Tag color="green">{table.createdAt ? new Date(table.createdAt).toLocaleDateString() : ''}</Tag>
                        </Space>
                        <div style={{ marginTop: 8, fontSize: 11, color: '#bbb' }}>
                          {(table.columns || []).map(c => c.title).join('、')}
                        </div>
                      </div>
                    }
                  />
                </Card>
              </Col>
            ))}
          </Row>
        )}

        {/* 创建/编辑数据表弹窗 */}
        <Modal
          title={editingTable ? '编辑数据表' : '新建数据表'}
          open={createModalVisible}
          onOk={handleSaveTable}
          onCancel={() => { setCreateModalVisible(false); setEditingTable(null); }}
          width={600}
          okText="保存"
        >
          <Form form={form} layout="vertical">
            <Form.Item name="name" label="表名" rules={[{ required: true, message: '请输入表名' }]}>
              <Input placeholder="例如：产品信息表、服装标签数据" />
            </Form.Item>
            <Form.Item name="description" label="描述">
              <Input.TextArea placeholder="可选，描述此数据表的用途" rows={2} />
            </Form.Item>
          </Form>

          <div style={{ marginBottom: 8, fontWeight: 500 }}>
            列定义：
            <span style={{ fontWeight: 'normal', color: '#999', fontSize: 12, marginLeft: 8 }}>
              定义数据表的列，每列可在标签编辑器中作为变量引用
            </span>
          </div>
          {columns.map((col, index) => (
            <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <Input
                value={col.title}
                onChange={(e) => updateColumn(index, 'title', e.target.value)}
                placeholder="列名（如：品名、材质、产地）"
                style={{ flex: 1 }}
              />
              <Select value={col.type} onChange={(v) => updateColumn(index, 'type', v)} style={{ width: 100 }}>
                <Select.Option value="text">文本</Select.Option>
                <Select.Option value="number">数字</Select.Option>
                <Select.Option value="date">日期</Select.Option>
              </Select>
              <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeColumn(index)} disabled={columns.length <= 1} />
            </div>
          ))}
          <Button type="dashed" block icon={<PlusOutlined />} onClick={addColumn}>添加列</Button>
        </Modal>
      </div>
    );
  }

  // 数据编辑视图
  const tableColumns = [
    { title: '#', width: 50, fixed: 'left', render: (_, __, index) => index + 1 },
    ...(selectedTable.columns || []).map(col => ({
      title: (
        <div>
          <span>{col.title}</span>
          <Tag color="blue" style={{ marginLeft: 4, fontSize: 10 }}>{col.type === 'text' ? '文本' : col.type === 'number' ? '数字' : '日期'}</Tag>
          <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
            变量: <code style={{ background: '#f0f0f0', padding: '0 4px', borderRadius: 2 }}>{`{{${selectedTable.name}.${col.title}}}`}</code>
          </div>
        </div>
      ),
      dataIndex: ['data', col.key],
      key: col.key,
      width: 200,
      render: (text, record) => (
        <Input
          size="small"
          value={record.data?.[col.key] || ''}
          onChange={(e) => handleCellChange(record.id, col.key, e.target.value)}
          placeholder={col.title}
          style={{ border: '1px solid transparent', background: 'transparent' }}
          onFocus={(e) => { e.target.style.border = '1px solid #1890ff'; e.target.style.background = '#fff'; }}
          onBlur={(e) => { e.target.style.border = '1px solid transparent'; e.target.style.background = 'transparent'; }}
        />
      )
    })),
    {
      title: '操作',
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <Popconfirm title="删除此行？" onConfirm={() => handleDeleteRow(record.id)}>
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Breadcrumb items={[
          { title: <a onClick={() => { setSelectedTable(null); setTableRows([]); }}>数据表管理</a> },
          { title: selectedTable.name }
        ]} />
      </div>

      <Card
        title={
          <Space>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => { setSelectedTable(null); setTableRows([]); }} />
            <DatabaseOutlined style={{ color: '#1890ff' }} />
            <span>{selectedTable.name}</span>
            {selectedTable.description && <span style={{ color: '#999', fontSize: 12, fontWeight: 'normal' }}>- {selectedTable.description}</span>}
          </Space>
        }
        extra={
          <Space>
            <Button icon={<PlusOutlined />} type="primary" onClick={handleAddRow}>添加行</Button>
            <Button icon={<EditOutlined />} onClick={() => openEditTable(selectedTable)}>编辑表结构</Button>
            <Button icon={<ReloadOutlined />} onClick={() => loadRows(selectedTable.id)}>刷新</Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 12, padding: '8px 16px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4, fontSize: 13 }}>
          <DatabaseOutlined style={{ marginRight: 8, color: '#52c41a' }} />
          在标签编辑器中添加文本时，可使用 <code>{`{{${selectedTable.name}.列名}}`}</code> 格式引用此表的数据。打印时变量会自动替换为对应行的值。
        </div>

        <Table
          columns={tableColumns}
          dataSource={tableRows}
          rowKey="id"
          size="small"
          loading={rowsLoading}
          pagination={tableRows.length > 50 ? { pageSize: 50, showTotal: (total) => `共 ${total} 行` } : false}
          bordered
          scroll={{ x: 'max-content', y: 500 }}
          locale={{ emptyText: <Empty description={'暂无数据，点击"添加行"开始录入'} image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        />
      </Card>

      {/* 编辑表结构弹窗 */}
      <Modal
        title="编辑数据表"
        open={createModalVisible}
        onOk={handleSaveTable}
        onCancel={() => { setCreateModalVisible(false); setEditingTable(null); }}
        width={600}
        okText="保存"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="表名" rules={[{ required: true, message: '请输入表名' }]}>
            <Input placeholder="例如：产品信息表" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="可选" rows={2} />
          </Form.Item>
        </Form>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>列定义：</div>
        {columns.map((col, index) => (
          <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <Input value={col.title} onChange={(e) => updateColumn(index, 'title', e.target.value)} placeholder="列名" style={{ flex: 1 }} />
            <Select value={col.type} onChange={(v) => updateColumn(index, 'type', v)} style={{ width: 100 }}>
              <Select.Option value="text">文本</Select.Option>
              <Select.Option value="number">数字</Select.Option>
              <Select.Option value="date">日期</Select.Option>
            </Select>
            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeColumn(index)} disabled={columns.length <= 1} />
          </div>
        ))}
        <Button type="dashed" block icon={<PlusOutlined />} onClick={addColumn}>添加列</Button>
      </Modal>
    </div>
  );
};

export default DataTablePage;
