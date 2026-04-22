import React, { useState } from 'react';
import { 
  Button, Table, Input, InputNumber, Select, Upload, 
  Space, Popconfirm, message, Image, Tag 
} from 'antd';
import { 
  PlusOutlined, DeleteOutlined, UploadOutlined 
} from '@ant-design/icons';

const { Option } = Select;

const SkcSkuManager = ({ 
  value = [], 
  onChange, 
  salesAttributes = [],
  publishStandard = {},
  onImageUpload 
}) => {
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);

  // 添加SKC
  const addSkc = () => {
    const newSkc = {
      key: Date.now(),
      supplier_code: '',
      sale_attribute: null,
      images: [],
      sku_list: [{
        key: Date.now(),
        supplier_sku: '',
        sale_attribute_list: [],
        cost_price: '',
        length: '',
        width: '',
        height: '',
        weight: '',
        inventory_num: 0,
        mall_state: 1,
        stop_purchase: 1
      }]
    };
    
    const newValue = [...(value || []), newSkc];
    onChange?.(newValue);
    setExpandedRowKeys([...expandedRowKeys, newSkc.key]);
  };

  // 删除SKC
  const deleteSkc = (skcKey) => {
    const newValue = value.filter(skc => skc.key !== skcKey);
    onChange?.(newValue);
  };

  // 更新SKC
  const updateSkc = (skcKey, field, fieldValue) => {
    const newValue = value.map(skc => 
      skc.key === skcKey ? { ...skc, [field]: fieldValue } : skc
    );
    onChange?.(newValue);
  };

  // 添加SKU
  const addSku = (skcKey) => {
    const newValue = value.map(skc => {
      if (skc.key === skcKey) {
        const newSku = {
          key: Date.now(),
          supplier_sku: '',
          sale_attribute_list: [],
          cost_price: '',
          length: '',
          width: '',
          height: '',
          weight: '',
          inventory_num: 0,
          mall_state: 1,
          stop_purchase: 1
        };
        return { ...skc, sku_list: [...skc.sku_list, newSku] };
      }
      return skc;
    });
    onChange?.(newValue);
  };

  // 删除SKU
  const deleteSku = (skcKey, skuKey) => {
    const newValue = value.map(skc => {
      if (skc.key === skcKey) {
        return { 
          ...skc, 
          sku_list: skc.sku_list.filter(sku => sku.key !== skuKey) 
        };
      }
      return skc;
    });
    onChange?.(newValue);
  };

  // 更新SKU
  const updateSku = (skcKey, skuKey, field, fieldValue) => {
    const newValue = value.map(skc => {
      if (skc.key === skcKey) {
        return {
          ...skc,
          sku_list: skc.sku_list.map(sku => 
            sku.key === skuKey ? { ...sku, [field]: fieldValue } : sku
          )
        };
      }
      return skc;
    });
    onChange?.(newValue);
  };

  // 主销售属性（颜色）
  const mainSalesAttrs = salesAttributes.filter(attr => attr.attribute_label === 1);
  
  // 次销售属性（尺寸等）
  const subSalesAttrs = salesAttributes.filter(attr => attr.attribute_label === 0);

  // SKC列定义
  const skcColumns = [
    {
      title: '商家货号',
      dataIndex: 'supplier_code',
      width: 150,
      render: (text, record) => (
        <Input
          value={text}
          placeholder="SKC货号"
          onChange={(e) => updateSkc(record.key, 'supplier_code', e.target.value)}
        />
      )
    },
    {
      title: '主销售属性',
      dataIndex: 'sale_attribute',
      width: 200,
      render: (text, record) => (
        <Select
          value={text ? JSON.stringify(text) : undefined}
          placeholder="选择颜色"
          style={{ width: '100%' }}
          onChange={(val) => updateSkc(record.key, 'sale_attribute', JSON.parse(val))}
        >
          {mainSalesAttrs.map(attr => (
            <Select.OptGroup key={attr.attribute_id} label={attr.attribute_name}>
              {attr.attribute_value_info_list?.map(val => (
                <Option
                  key={val.attribute_value_id}
                  value={JSON.stringify({
                    attribute_id: attr.attribute_id,
                    attribute_value_id: val.attribute_value_id
                  })}
                >
                  {val.attribute_value}
                </Option>
              ))}
            </Select.OptGroup>
          ))}
        </Select>
      )
    },
    {
      title: 'SKC图片',
      dataIndex: 'images',
      width: 200,
      render: (images, record) => (
        <Upload
          listType="picture-card"
          fileList={images?.map((img, idx) => ({
            uid: idx,
            name: `image-${idx}`,
            status: 'done',
            url: img.image_url
          }))}
          onPreview={(file) => {
            window.open(file.url);
          }}
          beforeUpload={(file) => {
            onImageUpload?.(file, 1).then(url => {
              if (url) {
                const newImages = [...(images || []), {
                  image_type: 1,
                  image_sort: (images?.length || 0) + 1,
                  image_url: url
                }];
                updateSkc(record.key, 'images', newImages);
              }
            });
            return false;
          }}
          onRemove={(file) => {
            const newImages = images.filter((_, idx) => idx !== file.uid);
            updateSkc(record.key, 'images', newImages);
          }}
        >
          {(!images || images.length < 5) && (
            <div>
              <PlusOutlined />
              <div style={{ marginTop: 8 }}>上传</div>
            </div>
          )}
        </Upload>
      )
    },
    {
      title: '操作',
      width: 100,
      render: (_, record) => (
        <Space>
          <Popconfirm
            title="确定删除此SKC？"
            onConfirm={() => deleteSkc(record.key)}
          >
            <Button type="link" danger size="small">
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  // SKU列定义
  const skuColumns = [
    {
      title: 'SKU货号',
      dataIndex: 'supplier_sku',
      width: 150,
      render: (text, record, index, skcKey) => (
        <Input
          value={text}
          placeholder="SKU货号"
          onChange={(e) => updateSku(skcKey, record.key, 'supplier_sku', e.target.value)}
        />
      )
    },
    {
      title: '次销售属性',
      dataIndex: 'sale_attribute_list',
      width: 150,
      render: (list, record, index, skcKey) => (
        <Select
          mode="multiple"
          value={list?.map(item => JSON.stringify(item))}
          placeholder="选择规格"
          style={{ width: '100%' }}
          onChange={(vals) => {
            const newList = vals.map(v => JSON.parse(v));
            updateSku(skcKey, record.key, 'sale_attribute_list', newList);
          }}
        >
          {subSalesAttrs.map(attr => (
            <Select.OptGroup key={attr.attribute_id} label={attr.attribute_name}>
              {attr.attribute_value_info_list?.map(val => (
                <Option
                  key={val.attribute_value_id}
                  value={JSON.stringify({
                    attribute_id: attr.attribute_id,
                    attribute_value_id: val.attribute_value_id
                  })}
                >
                  {val.attribute_value}
                </Option>
              ))}
            </Select.OptGroup>
          ))}
        </Select>
      )
    },
    {
      title: `供货价(${publishStandard?.currency || 'USD'})`,
      dataIndex: 'cost_price',
      width: 120,
      render: (text, record, index, skcKey) => (
        <InputNumber
          value={text}
          placeholder="价格"
          min={0}
          precision={2}
          style={{ width: '100%' }}
          onChange={(val) => updateSku(skcKey, record.key, 'cost_price', val)}
        />
      )
    },
    {
      title: '长(cm)',
      dataIndex: 'length',
      width: 80,
      render: (text, record, index, skcKey) => (
        <InputNumber
          value={text}
          min={0}
          precision={2}
          onChange={(val) => updateSku(skcKey, record.key, 'length', val)}
        />
      )
    },
    {
      title: '宽(cm)',
      dataIndex: 'width',
      width: 80,
      render: (text, record, index, skcKey) => (
        <InputNumber
          value={text}
          min={0}
          precision={2}
          onChange={(val) => updateSku(skcKey, record.key, 'width', val)}
        />
      )
    },
    {
      title: '高(cm)',
      dataIndex: 'height',
      width: 80,
      render: (text, record, index, skcKey) => (
        <InputNumber
          value={text}
          min={0}
          precision={2}
          onChange={(val) => updateSku(skcKey, record.key, 'height', val)}
        />
      )
    },
    {
      title: '重量(g)',
      dataIndex: 'weight',
      width: 80,
      render: (text, record, index, skcKey) => (
        <InputNumber
          value={text}
          min={1}
          onChange={(val) => updateSku(skcKey, record.key, 'weight', val)}
        />
      )
    },
    {
      title: '库存',
      dataIndex: 'inventory_num',
      width: 80,
      render: (text, record, index, skcKey) => (
        <InputNumber
          value={text}
          min={0}
          onChange={(val) => updateSku(skcKey, record.key, 'inventory_num', val)}
        />
      )
    },
    {
      title: '销售状态',
      dataIndex: 'mall_state',
      width: 100,
      render: (text, record, index, skcKey) => (
        <Select
          value={text}
          style={{ width: '100%' }}
          onChange={(val) => updateSku(skcKey, record.key, 'mall_state', val)}
        >
          <Option value={1}>在售</Option>
          <Option value={2}>停售</Option>
        </Select>
      )
    },
    {
      title: '采购状态',
      dataIndex: 'stop_purchase',
      width: 100,
      render: (text, record, index, skcKey) => (
        <Select
          value={text}
          style={{ width: '100%' }}
          onChange={(val) => updateSku(skcKey, record.key, 'stop_purchase', val)}
        >
          <Option value={1}>可采</Option>
          <Option value={2}>停采</Option>
        </Select>
      )
    },
    {
      title: '操作',
      width: 80,
      render: (_, record, index, skcKey) => (
        <Popconfirm
          title="确定删除？"
          onConfirm={() => deleteSku(skcKey, record.key)}
        >
          <Button type="link" danger size="small">
            删除
          </Button>
        </Popconfirm>
      )
    }
  ];

  // 展开的SKU表格
  const expandedRowRender = (skcRecord) => {
    return (
      <div style={{ padding: '0 24px' }}>
        <div style={{ marginBottom: 12 }}>
          <Button 
            type="dashed" 
            icon={<PlusOutlined />}
            onClick={() => addSku(skcRecord.key)}
          >
            添加SKU
          </Button>
        </div>
        <Table
          columns={skuColumns.map(col => ({
            ...col,
            render: col.render ? 
              (text, record, index) => col.render(text, record, index, skcRecord.key) 
              : undefined
          }))}
          dataSource={skcRecord.sku_list}
          pagination={false}
          size="small"
          rowKey="key"
        />
      </div>
    );
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={addSkc}
        >
          添加SKC
        </Button>
      </div>
      
      <Table
        columns={skcColumns}
        dataSource={value}
        pagination={false}
        expandable={{
          expandedRowRender,
          expandedRowKeys,
          onExpandedRowsChange: setExpandedRowKeys
        }}
        rowKey="key"
      />
    </div>
  );
};

export default SkcSkuManager;
