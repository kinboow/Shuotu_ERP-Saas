import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  DatePicker,
  Picker,
  Stepper,
  Toast,
  Dialog,
  List,
  Tag,
  Space
} from 'antd-mobile';
import {
  ScanningOutline,
  DeleteOutline,
  CheckOutline
} from 'antd-mobile-icons';
import axios from 'axios';
import dayjs from 'dayjs';

const API_URL = process.env.REACT_APP_API_URL || 'https://erp.hlsd.work:5000';

const CourierReport = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [courierCompanies, setCourierCompanies] = useState([]);
  const [packages, setPackages] = useState([]);
  const [scanInput, setScanInput] = useState('');
  const [largeCount, setLargeCount] = useState(0);
  const [smallCount, setSmallCount] = useState(0);
  const [userInfo, setUserInfo] = useState(null);

  // 获取用户信息和快递公司列表
  useEffect(() => {
    const savedUser = localStorage.getItem('pda_user') || localStorage.getItem('userInfo');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setUserInfo(user);
        
        // 如果是物流商，自动设置快递公司
        if (user.user_type === 'logistics') {
          form.setFieldsValue({
            courier_company: user.provider_name
          });
        }
      } catch (error) {
        console.error('解析用户信息失败:', error);
      }
    }
    
    fetchCourierCompanies();
    // 自动填充今天日期
    form.setFieldsValue({
      report_date: new Date()
    });
  }, []);

  const fetchCourierCompanies = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('pda_token');
      const savedUser = localStorage.getItem('pda_user') || localStorage.getItem('userInfo');
      const user = savedUser ? JSON.parse(savedUser) : null;
      
      // 如果是物流商，只显示自己的快递公司
      if (user && user.user_type === 'logistics') {
        setCourierCompanies([{
          label: user.provider_name,
          value: user.provider_name
        }]);
        return;
      }
      
      // 企业员工显示所有快递公司
      const response = await axios.get(`${API_URL}/api/courier-companies`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        const companies = response.data.data.map(c => ({
          label: c.company_name,
          value: c.company_name
        }));
        setCourierCompanies(companies);
      }
    } catch (error) {
      console.error('获取快递公司失败:', error);
      Toast.show({
        icon: 'fail',
        content: '获取快递公司列表失败'
      });
    }
  };

  // 扫码或输入包裹号
  const handleAddPackage = () => {
    if (!scanInput.trim()) {
      Toast.show({
        icon: 'fail',
        content: '请输入包裹号'
      });
      return;
    }

    // 检查是否重复
    if (packages.some(p => p.package_no === scanInput.trim())) {
      Toast.show({
        icon: 'fail',
        content: '该包裹号已添加'
      });
      return;
    }

    Dialog.confirm({
      content: '请选择包裹类型',
      confirmText: '大件',
      cancelText: '小件',
      onConfirm: () => {
        addPackage('large');
      },
      onCancel: () => {
        addPackage('small');
      }
    });
  };

  const addPackage = (type) => {
    const newPackage = {
      package_no: scanInput.trim(),
      package_type: type,
      scan_time: new Date()
    };

    setPackages([...packages, newPackage]);
    
    if (type === 'large') {
      setLargeCount(largeCount + 1);
    } else {
      setSmallCount(smallCount + 1);
    }

    setScanInput('');
    Toast.show({
      icon: 'success',
      content: `已添加${type === 'large' ? '大件' : '小件'}`
    });
  };

  // 删除包裹
  const handleDeletePackage = (index) => {
    Dialog.confirm({
      content: '确定删除该包裹吗？',
      onConfirm: () => {
        const pkg = packages[index];
        const newPackages = packages.filter((_, i) => i !== index);
        setPackages(newPackages);

        if (pkg.package_type === 'large') {
          setLargeCount(largeCount - 1);
        } else {
          setSmallCount(smallCount - 1);
        }

        Toast.show({
          icon: 'success',
          content: '已删除'
        });
      }
    });
  };

  // 提交报单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (largeCount === 0 && smallCount === 0) {
        Toast.show({
          icon: 'fail',
          content: '请至少添加一个包裹或填写数量'
        });
        return;
      }

      setLoading(true);

      const savedUser = localStorage.getItem('pda_user') || localStorage.getItem('userInfo');
      const user = savedUser ? JSON.parse(savedUser) : {};
      
      const data = {
        courier_company: values.courier_company,
        report_date: dayjs(values.report_date).format('YYYY-MM-DD'),
        large_package_count: largeCount,
        small_package_count: smallCount,
        packages: packages,
        operator_id: user.user_id || user.id,
        operator_name: user.username || user.real_name || user.provider_name,
        user_type: user.user_type || 'employee',
        logistics_id: user.user_type === 'logistics' ? user.logistics_id : null,
        remark: values.remark
      };

      const token = localStorage.getItem('token') || localStorage.getItem('pda_token');
      const response = await axios.post(
        `${API_URL}/api/courier-reports`,
        data,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        Toast.show({
          icon: 'success',
          content: '报单提交成功'
        });
        
        // 清空表单
        form.resetFields();
        setPackages([]);
        setLargeCount(0);
        setSmallCount(0);
        setScanInput('');
        
        // 重新设置日期和快递公司（物流商）
        form.setFieldsValue({
          report_date: new Date()
        });
        
        if (user.user_type === 'logistics') {
          form.setFieldsValue({
            courier_company: user.provider_name
          });
        }
      }
    } catch (error) {
      console.error('提交报单失败:', error);
      Toast.show({
        icon: 'fail',
        content: error.response?.data?.message || '提交失败'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '16px', paddingBottom: '80px' }}>
      <h2 style={{ marginBottom: '16px' }}>快递商报单</h2>

      <Form
        form={form}
        layout="horizontal"
        footer={null}
      >
        <Form.Item
          name="courier_company"
          label="快递公司"
          rules={[{ required: true, message: '请选择快递公司' }]}
        >
          <Picker columns={[courierCompanies]}>
            {(value) => value ? value[0]?.label : '请选择'}
          </Picker>
        </Form.Item>

        <Form.Item
          name="report_date"
          label="报单日期"
          rules={[{ required: true, message: '请选择日期' }]}
        >
          <DatePicker>
            {(value) => value ? dayjs(value).format('YYYY-MM-DD') : '请选择'}
          </DatePicker>
        </Form.Item>

        <Form.Item label="大件数量">
          <Stepper
            value={largeCount}
            onChange={setLargeCount}
            min={0}
          />
        </Form.Item>

        <Form.Item label="小件数量">
          <Stepper
            value={smallCount}
            onChange={setSmallCount}
            min={0}
          />
        </Form.Item>

        <Form.Item label="总件数">
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1677ff' }}>
            {largeCount + smallCount} 件
          </div>
        </Form.Item>

        <Form.Item name="remark" label="备注">
          <Input placeholder="选填" />
        </Form.Item>
      </Form>

      <div style={{ marginTop: '20px' }}>
        <h3 style={{ marginBottom: '12px' }}>扫描包裹号</h3>
        <Space style={{ width: '100%' }}>
          <Input
            placeholder="扫码或输入包裹号"
            value={scanInput}
            onChange={setScanInput}
            onEnterPress={handleAddPackage}
            style={{ flex: 1 }}
          />
          <Button
            color="primary"
            onClick={handleAddPackage}
          >
            <ScanningOutline /> 添加
          </Button>
        </Space>
      </div>

      {packages.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h3 style={{ marginBottom: '12px' }}>
            已扫描包裹 ({packages.length})
          </h3>
          <List>
            {packages.map((pkg, index) => (
              <List.Item
                key={index}
                extra={
                  <Button
                    color="danger"
                    fill="none"
                    size="small"
                    onClick={() => handleDeletePackage(index)}
                  >
                    <DeleteOutline />
                  </Button>
                }
              >
                <div>
                  <div style={{ fontWeight: 'bold' }}>{pkg.package_no}</div>
                  <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                    <Tag color={pkg.package_type === 'large' ? 'warning' : 'primary'}>
                      {pkg.package_type === 'large' ? '大件' : '小件'}
                    </Tag>
                    <span style={{ marginLeft: '8px' }}>
                      {dayjs(pkg.scan_time).format('HH:mm:ss')}
                    </span>
                  </div>
                </div>
              </List.Item>
            ))}
          </List>
        </div>
      )}

      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 16px',
          background: '#fff',
          borderTop: '1px solid #eee'
        }}
      >
        <Button
          block
          color="primary"
          size="large"
          loading={loading}
          onClick={handleSubmit}
        >
          <CheckOutline /> 提交报单
        </Button>
      </div>
    </div>
  );
};

export default CourierReport;
