import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  DatePicker,
  Select,
  Input,
  Tag,
  Modal,
  message,
  Card,
  Statistic,
  Row,
  Col,
  Descriptions
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

const API_URL = process.env.REACT_APP_API_URL || '/api';

const CourierReports = () => {
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [courierCompanies, setCourierCompanies] = useState([]);
  const [stats, setStats] = useState([]);
  
  // 筛选条件
  const [filters, setFilters] = useState({
    courier_company: undefined,
    status: undefined,
    report_no: '',
    dateRange: null
  });

  // 详情弹窗
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentReport, setCurrentReport] = useState(null);

  useEffect(() => {
    fetchCourierCompanies();
    fetchData();
    fetchStats();
  }, [page, pageSize]);

  // 获取快递公司列表
  const fetchCourierCompanies = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/courier-companies`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setCourierCompanies(response.data.data);
      }
    } catch (error) {
      console.error('获取快递公司失败:', error);
    }
  };

  // 获取报单列表
  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const params = {
        page,
        pageSize,
        ...filters
      };

      if (filters.dateRange && filters.dateRange.length === 2) {
        params.start_date = filters.dateRange[0].format('YYYY-MM-DD');
        params.end_date = filters.dateRange[1].format('YYYY-MM-DD');
      }

      const response = await axios.get(`${API_URL}/courier-reports`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setDataSource(response.data.data.list);
        setTotal(response.data.data.total);
      }
    } catch (error) {
      console.error('获取报单列表失败:', error);
      message.error('获取报单列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取统计数据
  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = {};

      if (filters.dateRange && filters.dateRange.length === 2) {
        params.start_date = filters.dateRange[0].format('YYYY-MM-DD');
        params.end_date = filters.dateRange[1].format('YYYY-MM-DD');
      }

      const response = await axios.get(`${API_URL}/courier-reports/stats/summary`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  };

  // 查看详情
  const handleViewDetail = async (record) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/courier-reports/${record.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setCurrentReport(response.data.data);
        setDetailVisible(true);
      }
    } catch (error) {
      console.error('获取报单详情失败:', error);
      message.error('获取报单详情失败');
    }
  };

  // 更新状态
  const handleUpdateStatus = async (id, status) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_URL}/courier-reports/${id}/status`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      message.success('状态更新成功');
      fetchData();
      fetchStats();
    } catch (error) {
      console.error('更新状态失败:', error);
      message.error('更新状态失败');
    }
  };

  // 删除报单
  const handleDelete = (id) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条报单吗？',
      onOk: async () => {
        try {
          const token = localStorage.getItem('token');
          await axios.delete(`${API_URL}/courier-reports/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          message.success('删除成功');
          fetchData();
          fetchStats();
        } catch (error) {
          console.error('删除失败:', error);
          message.error('删除失败');
        }
      }
    });
  };

  // 搜索
  const handleSearch = () => {
    setPage(1);
    fetchData();
    fetchStats();
  };

  // 重置
  const handleReset = () => {
    setFilters({
      courier_company: undefined,
      status: undefined,
      report_no: '',
      dateRange: null
    });
    setPage(1);
    setTimeout(() => {
      fetchData();
      fetchStats();
    }, 0);
  };

  const columns = [
    {
      title: '报单编号',
      dataIndex: 'report_no',
      key: 'report_no',
      width: 180,
      fixed: 'left'
    },
    {
      title: '快递公司',
      dataIndex: 'courier_company',
      key: 'courier_company',
      width: 120
    },
    {
      title: '报单日期',
      dataIndex: 'report_date',
      key: 'report_date',
      width: 120,
      render: (text) => dayjs(text).format('YYYY-MM-DD')
    },
    {
      title: '大件数量',
      dataIndex: 'large_package_count',
      key: 'large_package_count',
      width: 100,
      align: 'center',
      render: (text) => <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>{text}</span>
    },
    {
      title: '小件数量',
      dataIndex: 'small_package_count',
      key: 'small_package_count',
      width: 100,
      align: 'center',
      render: (text) => <span style={{ color: '#1890ff', fontWeight: 'bold' }}>{text}</span>
    },
    {
      title: '总件数',
      dataIndex: 'total_package_count',
      key: 'total_package_count',
      width: 100,
      align: 'center',
      render: (text) => <span style={{ fontWeight: 'bold' }}>{text}</span>
    },
    {
      title: '操作员',
      dataIndex: 'operator_name',
      key: 'operator_name',
      width: 100
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const statusMap = {
          submitted: { color: 'processing', text: '已提交' },
          confirmed: { color: 'success', text: '已确认' },
          cancelled: { color: 'default', text: '已取消' }
        };
        const config = statusMap[status] || statusMap.submitted;
        return <Tag color={config.color}>{config.text}</Tag>;
      }
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          {record.status === 'submitted' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleUpdateStatus(record.id, 'confirmed')}
              >
                确认
              </Button>
              <Button
                type="link"
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => handleUpdateStatus(record.id, 'cancelled')}
              >
                取消
              </Button>
            </>
          )}
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <h2>快递商报单管理</h2>

      {/* 统计卡片 */}
      {stats.length > 0 && (
        <Row gutter={16} style={{ marginBottom: '24px' }}>
          {stats.map((stat, index) => (
            <Col span={6} key={index}>
              <Card>
                <Statistic
                  title={stat.courier_company}
                  value={stat.total_packages}
                  suffix="件"
                  valueStyle={{ color: '#1890ff' }}
                />
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>
                  大件: {stat.total_large} | 小件: {stat.total_small}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* 筛选条件 */}
      <Card style={{ marginBottom: '16px' }}>
        <Space wrap>
          <Select
            placeholder="快递公司"
            style={{ width: 150 }}
            value={filters.courier_company}
            onChange={(value) => setFilters({ ...filters, courier_company: value })}
            allowClear
          >
            {courierCompanies.map((company) => (
              <Option key={company.id} value={company.company_name}>
                {company.company_name}
              </Option>
            ))}
          </Select>

          <Select
            placeholder="状态"
            style={{ width: 120 }}
            value={filters.status}
            onChange={(value) => setFilters({ ...filters, status: value })}
            allowClear
          >
            <Option value="submitted">已提交</Option>
            <Option value="confirmed">已确认</Option>
            <Option value="cancelled">已取消</Option>
          </Select>

          <Input
            placeholder="报单编号"
            style={{ width: 200 }}
            value={filters.report_no}
            onChange={(e) => setFilters({ ...filters, report_no: e.target.value })}
            allowClear
          />

          <RangePicker
            value={filters.dateRange}
            onChange={(dates) => setFilters({ ...filters, dateRange: dates })}
          />

          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
          >
            搜索
          </Button>

          <Button
            icon={<ReloadOutlined />}
            onClick={handleReset}
          >
            重置
          </Button>
        </Space>
      </Card>

      {/* 表格 */}
      <Table
        columns={columns}
        dataSource={dataSource}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1500 }}
        pagination={{
          current: page,
          pageSize: pageSize,
          total: total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) => {
            setPage(page);
            setPageSize(pageSize);
          }
        }}
      />

      {/* 详情弹窗 */}
      <Modal
        title="报单详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={800}
      >
        {currentReport && (
          <>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="报单编号">{currentReport.report_no}</Descriptions.Item>
              <Descriptions.Item label="快递公司">{currentReport.courier_company}</Descriptions.Item>
              <Descriptions.Item label="报单日期">
                {dayjs(currentReport.report_date).format('YYYY-MM-DD')}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={
                  currentReport.status === 'confirmed' ? 'success' :
                  currentReport.status === 'cancelled' ? 'default' : 'processing'
                }>
                  {currentReport.status === 'confirmed' ? '已确认' :
                   currentReport.status === 'cancelled' ? '已取消' : '已提交'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="大件数量">
                <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                  {currentReport.large_package_count}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="小件数量">
                <span style={{ color: '#1890ff', fontWeight: 'bold' }}>
                  {currentReport.small_package_count}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="总件数">
                <span style={{ fontWeight: 'bold' }}>
                  {currentReport.total_package_count}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="操作员">{currentReport.operator_name}</Descriptions.Item>
              <Descriptions.Item label="创建时间" span={2}>
                {dayjs(currentReport.created_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              {currentReport.remark && (
                <Descriptions.Item label="备注" span={2}>{currentReport.remark}</Descriptions.Item>
              )}
            </Descriptions>

            {currentReport.items && currentReport.items.length > 0 && (
              <>
                <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>
                  包裹明细 ({currentReport.items.length})
                </h3>
                <Table
                  columns={[
                    {
                      title: '序号',
                      key: 'index',
                      width: 60,
                      render: (_, __, index) => index + 1
                    },
                    {
                      title: '包裹号',
                      dataIndex: 'package_no',
                      key: 'package_no'
                    },
                    {
                      title: '类型',
                      dataIndex: 'package_type',
                      key: 'package_type',
                      width: 80,
                      render: (type) => (
                        <Tag color={type === 'large' ? 'warning' : 'processing'}>
                          {type === 'large' ? '大件' : '小件'}
                        </Tag>
                      )
                    },
                    {
                      title: '扫描时间',
                      dataIndex: 'scan_time',
                      key: 'scan_time',
                      width: 180,
                      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm:ss')
                    }
                  ]}
                  dataSource={currentReport.items}
                  rowKey="id"
                  pagination={false}
                  size="small"
                />
              </>
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default CourierReports;
