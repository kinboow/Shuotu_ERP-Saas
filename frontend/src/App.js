import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Button, Modal, Select, Checkbox, message, Space, Input } from 'antd';

const { Option } = Select;
import { ShoppingOutlined, AppstoreOutlined, LinkOutlined, DashboardOutlined, InboxOutlined, DollarOutlined, BankOutlined, ApiOutlined, TagsOutlined, LogoutOutlined, UserOutlined, CarOutlined, SyncOutlined } from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Products from './pages/Products';
import StockOrders from './pages/StockOrders';
import DeliveryOrders from './pages/DeliveryOrders';
import DeliveryOrderDetail from './pages/DeliveryOrderDetail';
import ShippingStation from './pages/ShippingStation';
import ReviewOrders from './pages/ReviewOrders';
import SkuSalesAnalysis from './pages/SkuSalesAnalysis';
import FinanceRecords from './pages/FinanceRecords';
import Withdrawals from './pages/Withdrawals';
import PlatformManagement from './pages/PlatformManagement';
import OnlineProducts from './pages/OnlineProducts';
import PublishProduct from './pages/PublishProduct';
import SelectPlatformForPublish from './pages/SelectPlatformForPublish';
import PublishByPlatform from './pages/PublishByPlatform';
import PlatformSheinFullListed from './pages/PlatformSheinFullListed';
import PublishFromERP from './pages/PublishFromERP';
import PublishDrafts from './pages/PublishDrafts';
import PublishRecords from './pages/PublishRecords';
import ERPProducts from './pages/ERPProducts';
import ERPProductEdit from './pages/ERPProductEdit';
import ProductMapping from './pages/ProductMapping';
import ProductInventory from './pages/ProductInventory';
import ProductInbound from './pages/ProductInbound';
import WarehouseInventory from './pages/WarehouseInventory';
import LogisticsManagement from './pages/LogisticsManagement';
import ComplianceLabelPrint from './pages/ComplianceLabelPrint';
import LabelEditor from './pages/LabelEditor';
import Suppliers from './pages/Suppliers';
import Login from './pages/Login';
import SheinFullAuthCallback from './pages/SheinFullAuthCallback';
import PrivateRoute from './components/PrivateRoute';
import UserManagement from './pages/UserManagement';
import RoleManagement from './pages/RoleManagement';
import EnterpriseSettings from './pages/EnterpriseSettings';
import JoinRequestReview from './pages/JoinRequestReview';
import EnterpriseOnboarding from './pages/EnterpriseOnboarding';
import OperationLogs from './pages/OperationLogs';
import LoginLogs from './pages/LoginLogs';
import PersonalCenter from './pages/PersonalCenter';
import PackageVideoList from './pages/PackageVideoList';
import CourierReports from './pages/CourierReports';
import LogisticsAccountManagement from './pages/LogisticsAccountManagement';
import DataTablePage from './pages/DataTablePage';
import { authAPI } from './api';
import { clearAuthSession, getStoredAuthState, saveAuthSession } from './utils/authStorage';

const { Header, Content, Sider } = Layout;
const PRODUCT_SYNC_CURRENT_YEAR = new Date().getFullYear();
const PRODUCT_SYNC_START_YEAR_OPTIONS = Array.from(
  { length: PRODUCT_SYNC_CURRENT_YEAR - 1999 },
  (_, index) => PRODUCT_SYNC_CURRENT_YEAR - index
);

const syncDataTypeLabels = {
  products: '商品',
  stock_orders: '采购单',
  delivery_orders: '发货单',
  inventory: '库存',
  finance: '财务'
};

const getTaskResults = (status) => status?.results || status?.result || null;

const getProductFailedItems = (syncResults) => (
  Array.isArray(syncResults?.products?.failedItems) ? syncResults.products.failedItems : []
);

const getProductFailedCount = (syncResults) => getProductFailedItems(syncResults).length;

const createDefaultProductSyncSettings = () => ({
  mode: 'incremental',
  startYear: PRODUCT_SYNC_CURRENT_YEAR
});

const normalizeProductSyncSettings = (settings = {}) => {
  const defaults = createDefaultProductSyncSettings();
  const parsedStartYear = Number.parseInt(settings.startYear, 10);
  return {
    mode: settings.mode === 'full' ? 'full' : defaults.mode,
    startYear: Number.isNaN(parsedStartYear)
      ? defaults.startYear
      : Math.max(2000, Math.min(parsedStartYear, PRODUCT_SYNC_CURRENT_YEAR))
  };
};

const buildBatchSyncPayload = ({ selectedPlatform, dataTypes, shopId, shopProductSyncSettings }) => {
  const payload = {
    platform: selectedPlatform,
    dataTypes,
    shopIds: [shopId],
    pageSize: 50,
    productLanguageList: ['zh-cn', 'en', 'ko', 'ja'],
    productDetailConcurrency: 5,
    productDetailDelayMs: 150,
    productDetailRetryTimes: 5,
    productDetailRetryDelayMs: 10000
  };

  if (Array.isArray(dataTypes) && dataTypes.includes('products')) {
    const productSettings = normalizeProductSyncSettings(shopProductSyncSettings?.[shopId]);
    payload.productSyncMode = productSettings.mode;
    payload.productStartYear = productSettings.startYear;
    payload.useUpdateTime = productSettings.mode === 'incremental';
    payload.productTimeField = productSettings.mode === 'incremental' ? 'update' : 'insert';
  }

  return payload;
};

const formatSyncDateTime = (value) => {
  if (!value) {
    return '暂无';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const getProductSyncModeText = (mode) => {
  if (mode === 'full') return '全量';
  if (mode === 'incremental') return '增量';
  return '暂无';
};

function SyncStatusSection({ syncing, currentSyncDataType, syncResults, onMinimize }) {
  const resultEntries = syncResults ? Object.entries(syncResults) : [];
  const productResult = syncResults?.products || null;
  const failedItems = getProductFailedItems(syncResults);

  return (
    <>
      {syncing && (
        <div style={{ marginTop: 16, textAlign: 'center', padding: '24px', background: '#f0f9ff', borderRadius: '4px' }}>
          <div style={{ marginBottom: 16 }}>
            <div className="sync-spinner" style={{
              width: '48px', height: '48px', border: '4px solid #f0f0f0',
              borderTopColor: '#1890ff', borderRadius: '50%',
              animation: 'spin 1s linear infinite', margin: '0 auto'
            }} />
          </div>
          <div style={{ color: '#666', fontSize: '14px', marginBottom: 12 }}>
            {currentSyncDataType ? `正在同步${currentSyncDataType}...` : '正在初始化同步任务...'}
          </div>
          <Button size="small" onClick={onMinimize}>
            最小化到后台
          </Button>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {resultEntries.length > 0 && (
        <div style={{ marginTop: 16, padding: '16px', background: '#fafafa', borderRadius: '4px', border: '1px solid #f0f0f0' }}>
          <div style={{ fontWeight: 500, marginBottom: 12 }}>同步结果</div>
          <div style={{ display: 'grid', gap: '8px' }}>
            {resultEntries.map(([type, result]) => {
              const summary = [];
              if (typeof result?.totalCount === 'number') summary.push(`总计 ${result.totalCount}`);
              if (typeof result?.successCount === 'number') summary.push(`成功 ${result.successCount}`);
              if (typeof result?.failCount === 'number') summary.push(`失败 ${result.failCount}`);
              if (result?.error) summary.push(result.error);

              const hasPartialFailure = (result?.failCount || 0) > 0;
              const failed = result?.success === false;
              const statusText = failed ? '失败' : (hasPartialFailure ? '部分失败' : '成功');
              const statusColor = failed ? '#ff4d4f' : (hasPartialFailure ? '#fa8c16' : '#52c41a');

              return (
                <div key={type} style={{ padding: '10px 12px', background: '#fff', border: '1px solid #f0f0f0', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                    <span style={{ fontWeight: 500 }}>{syncDataTypeLabels[type] || type}</span>
                    <span style={{ color: statusColor }}>{statusText}</span>
                  </div>
                  {summary.length > 0 && (
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{summary.join(' ｜ ')}</div>
                  )}
                  {type === 'products' && productResult && (
                    <>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                        {`同步模式 ${getProductSyncModeText(productResult.actualSyncMode)} ｜ 查询字段 ${productResult.timeField || '-'} ｜ 区间 ${formatSyncDateTime(productResult.syncRangeStart)} ~ ${formatSyncDateTime(productResult.syncRangeEnd)}`}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                        {`429重试 ${productResult.rateLimitRetryCount || 0} 次 ｜ 恢复 ${productResult.rateLimitRecoveredCount || 0} 个 ｜ 最终失败 ${productResult.rateLimitFailedCount || 0} 个`}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {failedItems.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 500, color: '#cf1322', marginBottom: 8 }}>{`失败商品明细（${failedItems.length}）`}</div>
              <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: '4px', background: '#fff' }}>
                {failedItems.map((item, index) => (
                  <div key={`${item.spuName || 'unknown'}_${index}`} style={{ padding: '10px 12px', borderBottom: index === failedItems.length - 1 ? 'none' : '1px solid #f5f5f5' }}>
                    <div style={{ fontWeight: 500 }}>{item.spuName || '未知SPU'}</div>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{item.errorMessage || '未知错误'}</div>
                    <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                      {`状态码: ${item.status || '-'}${item.isRateLimit ? ' ｜ 触发限流' : ''}${item.traceId ? ` ｜ traceId: ${item.traceId}` : ''}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function ProductSyncSettings({ shopId, enabled, syncing, value, onChange, shopMeta }) {
  if (!enabled) {
    return null;
  }

  const settings = normalizeProductSyncSettings(value);
  const checkpointText = formatSyncDateTime(shopMeta?.last_product_sync_checkpoint_time);
  const successText = formatSyncDateTime(shopMeta?.last_product_sync_success_at);
  const lastModeText = getProductSyncModeText(shopMeta?.last_product_sync_mode);

  return (
    <div style={{ marginBottom: '8px', padding: '10px 12px', background: '#fff', border: '1px solid #f0f0f0', borderRadius: '4px' }}>
      <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>商品同步设置：</div>
      <Space wrap>
        <Select
          size="small"
          value={settings.mode}
          style={{ width: 120 }}
          disabled={syncing}
          onChange={(mode) => onChange(shopId, { ...settings, mode })}
        >
          <Option value="incremental">增量同步</Option>
          <Option value="full">全量同步</Option>
        </Select>
        {settings.mode === 'full' && (
          <Select
            size="small"
            value={settings.startYear}
            style={{ width: 140 }}
            disabled={syncing}
            onChange={(startYear) => onChange(shopId, { ...settings, startYear })}
          >
            {PRODUCT_SYNC_START_YEAR_OPTIONS.map((year) => (
              <Option key={year} value={year}>{`${year}年开始`}</Option>
            ))}
          </Select>
        )}
      </Space>
      <div style={{ fontSize: '12px', color: '#999', marginTop: '6px' }}>
        {settings.mode === 'incremental'
          ? `增量同步仅使用 updateTime，当前增量起点：${checkpointText}；最近成功：${successText}；上次模式：${lastModeText}。若暂无成功记录，会自动回退为全量同步。`
          : '全量同步会从所选年份开始扫描到当前时间。'}
      </div>
    </div>
  );
}

// 只有顶部导航栏的布局组件（无侧边栏）
function HeaderOnlyLayout({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [enterprises, setEnterprises] = useState([]);
  const [currentEnterprise, setCurrentEnterprise] = useState(null);
  const [requiresEnterpriseSelection, setRequiresEnterpriseSelection] = useState(false);
  const [switchingEnterprise, setSwitchingEnterprise] = useState(false);
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncTaskId, setSyncTaskId] = useState(null);
  const [currentSyncDataType, setCurrentSyncDataType] = useState(null);
  const [syncResults, setSyncResults] = useState(null);
  const [productSyncInfo, setProductSyncInfo] = useState(null);
  const [shops, setShops] = useState([]);
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [filteredShops, setFilteredShops] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [shopSelectedTypes, setShopSelectedTypes] = useState({});
  const [shopProductSyncSettings, setShopProductSyncSettings] = useState({});

  useEffect(() => {
    const authState = getStoredAuthState();
    setUser(authState.user);
    setEnterprises(authState.enterprises || []);
    setCurrentEnterprise(authState.currentEnterprise || null);
    setRequiresEnterpriseSelection(Boolean(authState.requiresEnterpriseSelection));

    if (authState.token) {
      authAPI.getCurrentUser()
        .then((response) => {
          if (response.data.success) {
            saveAuthSession(response.data.data);
            const nextState = getStoredAuthState();
            setUser(nextState.user);
            setEnterprises(nextState.enterprises || []);
            setCurrentEnterprise(nextState.currentEnterprise || null);
            setRequiresEnterpriseSelection(Boolean(nextState.requiresEnterpriseSelection));
          }
        })
        .catch(() => {});
    }

    // 恢复同步状态
    const savedSyncTaskId = localStorage.getItem('syncTaskId');
    if (savedSyncTaskId) {
      setSyncTaskId(savedSyncTaskId);
      setSyncing(true);
      // 恢复轮询
      pollSyncStatusForHeader(savedSyncTaskId);
    }
    fetchShopsForHeader();
    fetchPlatformsForHeader();
  }, []);

  useEffect(() => {
    if (requiresEnterpriseSelection) {
      navigate('/enterprise-onboarding', { replace: true });
    }
  }, [navigate, requiresEnterpriseSelection]);

  const handleEnterpriseChangeForHeader = async (enterpriseId) => {
    if (!enterpriseId || Number(enterpriseId) === Number(currentEnterprise?.id)) {
      return;
    }

    try {
      setSwitchingEnterprise(true);
      const response = await authAPI.selectEnterprise({ enterpriseId });
      if (response.data.success) {
        saveAuthSession(response.data.data);
        const authState = getStoredAuthState();
        setEnterprises(authState.enterprises || []);
        setCurrentEnterprise(authState.currentEnterprise || null);
        setRequiresEnterpriseSelection(Boolean(authState.requiresEnterpriseSelection));
        message.success(`已切换到企业：${response.data.data.currentEnterprise?.companyName || '已切换'}`);
      } else {
        message.error(response.data.message || '切换企业失败');
      }
    } catch (error) {
      message.error(error.response?.data?.message || '切换企业失败');
    } finally {
      setSwitchingEnterprise(false);
    }
  };

  const fetchShopsForHeader = async () => {
    try {
      console.log('[同步弹窗] 开始获取店铺列表...');
      const response = await fetch('/api/shein-full-auth/shops');
      console.log('[同步弹窗] 响应状态:', response.status, response.ok);
      if (response.ok) {
        const data = await response.json();
        console.log('[同步弹窗] 店铺数据:', data);
        if (data.success) {
          setShops(data.data || []);
          console.log('[同步弹窗] 已设置店铺列表, 数量:', (data.data || []).length);
        }
      } else {
        const text = await response.text();
        console.error('[同步弹窗] 请求失败:', response.status, text);
      }
    } catch (error) {
      console.error('[同步弹窗] 获取店铺列表失败:', error);
    }
  };

  const fetchPlatformsForHeader = async () => {
    try {
      console.log('[同步弹窗] 开始获取平台列表...');
      const response = await fetch('/api/platform-configs?is_active=true');
      console.log('[同步弹窗] 平台API响应状态:', response.status, response.ok);
      if (response.ok) {
        const data = await response.json();
        console.log('[同步弹窗] 平台数据:', data);
        if (data.success) {
          setPlatforms(data.data || []);
          console.log('[同步弹窗] 已设置平台列表, 数量:', (data.data || []).length);
        } else {
          console.error('[同步弹窗] 平台API返回失败:', data.message);
        }
      } else {
        const text = await response.text();
        console.error('[同步弹窗] 平台API请求失败:', response.status, text);
      }
    } catch (error) {
      console.error('[同步弹窗] 获取平台列表异常:', error);
    }
  };

  const handlePlatformChangeForHeader = (platformName) => {
    console.log('[同步弹窗] 选择平台:', platformName, '当前shops数量:', shops.length);
    setSelectedPlatform(platformName);
    if (platformName) {
      // shein_full_shops表的店铺都是SHEIN全托管平台的
      if (platformName === 'shein_full') {
        console.log('[同步弹窗] 设置filteredShops为shops:', shops);
        setFilteredShops(shops);
      } else {
        // 其他平台暂时没有店铺
        setFilteredShops([]);
      }
    } else {
      setFilteredShops([]);
    }
  };

  // 轮询同步状态
  const pollSyncStatusForHeader = async (taskId) => {
    try {
      const response = await fetch(`/api/shein-full-sync/status/${taskId}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        const status = data.data;
        const taskResults = getTaskResults(status);
        const failedProductCount = getProductFailedCount(taskResults);
        setSyncProgress(status.progress || 0);
        setCurrentSyncDataType(status.currentDataTypeName || null);
        setSyncResults(taskResults);
        
        // 更新商品同步详细进度
        if (status.productSyncPhase) {
          setProductSyncInfo({
            phase: status.productSyncPhase,
            phaseName: status.currentDataTypeName,
            progress: status.productSyncProgress || 0,
            current: status.productSyncCurrent || 0,
            total: status.productSyncTotal || 0,
            batches: status.productSyncBatches
          });
        } else {
          setProductSyncInfo(null);
        }
        
        if (status.status === 'completed') {
          setSyncProgress(100);
          if (failedProductCount > 0) {
            message.warning(`数据同步完成，但有 ${failedProductCount} 个商品同步失败，请在同步窗口查看详情`);
          } else {
            message.success('数据同步完成！');
          }
          setSyncing(false);
          setSyncTaskId(null);
          setCurrentSyncDataType(null);
          localStorage.removeItem('syncTaskId');
          return;
        }
        
        if (status.status === 'failed') {
          message.error('同步任务失败');
          setSyncing(false);
          setSyncTaskId(null);
          localStorage.removeItem('syncTaskId');
          return;
        }
        
        setTimeout(() => pollSyncStatusForHeader(taskId), 1000);
      } else {
        // 任务不存在（已完成或服务重启），清除同步状态
        console.log('同步任务不存在，清除同步状态');
        setSyncing(false);
        setSyncTaskId(null);
        setSyncProgress(0);
        setCurrentSyncDataType(null);
        localStorage.removeItem('syncTaskId');
      }
    } catch (error) {
      console.error('获取同步状态失败:', error);
      setTimeout(() => pollSyncStatusForHeader(taskId), 2000);
    }
  };

  // 同步店铺所有数据
  const handleSyncShopAll = async (shopId) => {
    const allDataTypes = ['products', 'stock_orders', 'delivery_orders', 'inventory', 'finance'];
    await handleSyncShopWithTypes(shopId, allDataTypes);
  };

  // 显示同步选项弹窗
  const handleShowSyncOptions = (shopId) => {
    return shopId;
  };

  // 同步店铺指定数据类型
  const handleSyncShopWithTypes = async (shopId, dataTypes) => {
    setSyncing(true);
    setSyncProgress(0);
    setCurrentSyncDataType(null);
    setSyncResults(null);
    setProductSyncInfo(null);
    
    try {
      const payload = buildBatchSyncPayload({
        selectedPlatform,
        dataTypes,
        shopId,
        shopProductSyncSettings
      });

      const response = await fetch('/api/shein-full-sync/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      if (data.success) {
        const taskId = data.data?.taskId;
        if (taskId) {
          setSyncTaskId(taskId);
          localStorage.setItem('syncTaskId', taskId); // 持久化taskId
          message.info('同步任务已启动...');
          setTimeout(() => pollSyncStatusForHeader(taskId), 1000);
        } else {
          message.success('数据同步完成！');
          setSyncing(false);
          localStorage.removeItem('syncTaskId');
          fetchShopsForHeader();
        }
      } else {
        message.error(data.message || '同步失败');
        setSyncing(false);
        localStorage.removeItem('syncTaskId');
      }
    } catch (error) {
      console.error('同步失败:', error);
      message.error('同步失败: ' + error.message);
      setSyncing(false);
      localStorage.removeItem('syncTaskId');
    }
  };

  const handleLogoutForHeader = () => {
    clearAuthSession();
    navigate('/login');
  };

  const userMenuForHeaderItems = [
    {
      key: 'user-info',
      disabled: true,
      label: (
        <div style={{ padding: '8px 0' }}>
          <div style={{ fontWeight: 'bold' }}>{user?.realName || user?.username || '用户'}</div>
          <div style={{ fontSize: '12px', color: '#999' }}>{user?.phone || ''}</div>
        </div>
      )
    },
    {
      key: 'enterprise-info',
      disabled: true,
      label: (
        <div style={{ padding: '4px 0' }}>
          <div style={{ fontSize: '12px', color: '#999' }}>当前企业</div>
          <div>{currentEnterprise?.companyName || '未加入企业'}</div>
        </div>
      )
    },
    {
      type: 'divider'
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录'
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '0 24px',
        backgroundImage: `
          url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2400 64"><defs><linearGradient id="waveGrad" x1="0%25" y1="0%25" x2="100%25" y2="0%25"><stop offset="0%25" style="stop-color:%23b8c9f8;stop-opacity:0.34"/><stop offset="50%25" style="stop-color:%235a6fd8;stop-opacity:0.34"/><stop offset="100%25" style="stop-color:%23b8c9f8;stop-opacity:0.34"/></linearGradient><style>.wave{fill:none;stroke:url(%23waveGrad);stroke-width:1.5;}</style></defs><path class="wave" d="M0,32 Q600,-16 1200,32 T2400,32"/><path class="wave" d="M0,36 Q600,-12 1200,36 T2400,36"/><path class="wave" d="M0,40 Q600,-8 1200,40 T2400,40"/><path class="wave" d="M0,44 Q600,-4 1200,44 T2400,44"/><path class="wave" d="M0,48 Q600,0 1200,48 T2400,48"/><path class="wave" d="M0,52 Q600,4 1200,52 T2400,52"/></svg>'),
          linear-gradient(to right, #7d9bfe, #88b7fd, #88b7fd, #88b7fd, #7d9bfe)
        `,
        backgroundSize: '100% 100%, 100% 100%',
        backgroundPosition: '0 0, 0 0',
        backgroundRepeat: 'repeat-x, no-repeat'
      }}>
        <Link to="/">
          <img 
            src="/logo.png" 
            alt="logo" 
            style={{ height: '50px', cursor: 'pointer', marginTop: '-3px' }}
          />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {enterprises.length > 0 ? (
            <Select
              value={currentEnterprise?.id || undefined}
              placeholder="选择企业"
              onChange={handleEnterpriseChangeForHeader}
              loading={switchingEnterprise}
              style={{ width: 220 }}
              size="middle"
              optionFilterProp="label"
              showSearch
            >
              {enterprises.map((enterprise) => (
                <Option
                  key={enterprise.id}
                  value={enterprise.id}
                  label={`${enterprise.companyName} (${enterprise.enterpriseCode})`}
                >
                  {enterprise.companyName} ({enterprise.enterpriseCode})
                </Option>
              ))}
            </Select>
          ) : requiresEnterpriseSelection ? (
            <Button
              size="middle"
              style={{ background: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.35)', color: '#ffffff' }}
              onClick={() => navigate('/enterprise-onboarding')}
            >
              完成初始化
            </Button>
          ) : null}
          <Button 
            type="primary" 
            icon={<SyncOutlined spin={syncing} />}
            onClick={() => setSyncModalVisible(true)}
            style={{ 
              backgroundColor: syncing ? '#52c41a' : 'rgba(255, 255, 255, 0.2)',
              borderColor: syncing ? '#52c41a' : 'rgba(255, 255, 255, 0.4)',
              color: '#ffffff'
            }}
          >
            {syncing ? '正在同步...' : '同步数据'}
          </Button>
          <Dropdown
            menu={{
              items: userMenuForHeaderItems,
              onClick: ({ key }) => {
                if (key === 'logout') {
                  handleLogoutForHeader();
                }
              }
            }}
            placement="bottomRight"
          >
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Avatar 
                src={user?.avatar} 
                icon={!user?.avatar && <UserOutlined />}
                style={{ backgroundColor: '#1890ff' }}
              />
              <span style={{ color: '#ffffff' }}>{user?.realName || user?.username || '用户'}</span>
            </div>
          </Dropdown>
        </div>
      </Header>
      <Content style={{ background: '#f0f2f5' }}>
        {children}
      </Content>

      {/* 同步数据模态框 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 24 }}>
            <span>同步数据</span>
            {syncing && (
              <span style={{ fontSize: '12px', color: '#52c41a', fontWeight: 'normal' }}>
                ● 后台运行中
              </span>
            )}
          </div>
        }
        open={syncModalVisible}
        onCancel={() => {
          setSyncModalVisible(false);
          if (syncing) {
            message.info('同步任务将在后台继续执行，点击"同步数据"按钮可查看进度');
          } else {
            setSelectedPlatform(null);
            setFilteredShops([]);
          }
        }}
        footer={null}
        width={700}
        maskClosable={true}
      >
        {/* 平台筛选 */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ marginBottom: '8px', fontWeight: 500 }}>选择平台：</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {platforms.map(platform => (
              <Button
                key={platform.platform_name}
                type={selectedPlatform === platform.platform_name ? 'primary' : 'default'}
                onClick={() => handlePlatformChangeForHeader(platform.platform_name)}
              >
                {platform.platform_display_name || platform.platform_name}
              </Button>
            ))}
          </div>
        </div>

        {/* 店铺列表 */}
        {selectedPlatform && (
          <div>
            <div style={{ marginBottom: '8px', fontWeight: 500 }}>店铺列表：</div>
            {filteredShops.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#999', background: '#fafafa', borderRadius: '4px' }}>
                该平台暂无已授权店铺
              </div>
            ) : (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {filteredShops.map(shop => (
                  <div key={shop.id} style={{
                    padding: '12px 16px', marginBottom: '8px', background: '#fafafa', borderRadius: '4px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontWeight: 500 }}>{shop.shop_name}</div>
                        <div style={{ fontSize: '12px', color: '#999' }}>
                          {shop.auth_status === 1 ? '已授权' : '未授权'} | 最后同步: {shop.last_sync_at || '从未同步'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
                          {`商品成功同步: ${formatSyncDateTime(shop.last_product_sync_success_at)} ｜ 增量起点: ${formatSyncDateTime(shop.last_product_sync_checkpoint_time)} ｜ 上次模式: ${getProductSyncModeText(shop.last_product_sync_mode)}`}
                        </div>
                      </div>
                      <Button 
                        type="primary" 
                        size="small"
                        loading={syncing}
                        disabled={shop.auth_status !== 1}
                        onClick={() => handleSyncShopAll(shop.id)}
                      >
                        同步所有
                      </Button>
                    </div>
                    <ProductSyncSettings
                      shopId={shop.id}
                      enabled={shop.auth_status === 1}
                      syncing={syncing}
                      value={shopProductSyncSettings[shop.id]}
                      shopMeta={shop}
                      onChange={(targetShopId, nextSettings) => {
                        setShopProductSyncSettings(prev => ({
                          ...prev,
                          [targetShopId]: normalizeProductSyncSettings(nextSettings)
                        }));
                      }}
                    />
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>选择同步数据类型：</div>
                      <Checkbox.Group
                        value={shopSelectedTypes[shop.id] || []}
                        onChange={(values) => {
                          setShopSelectedTypes(prev => ({
                            ...prev,
                            [shop.id]: values
                          }));
                        }}
                        disabled={shop.auth_status !== 1 || syncing}
                      >
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {dataTypeOptions.map(option => (
                            <Checkbox key={option.value} value={option.value}>
                              {option.label}
                            </Checkbox>
                          ))}
                        </div>
                      </Checkbox.Group>
                    </div>
                    {shopSelectedTypes[shop.id] && shopSelectedTypes[shop.id].length > 0 && (
                      <div style={{ textAlign: 'right' }}>
                        <Space>
                          <Button 
                            size="small"
                            onClick={() => {
                              setShopSelectedTypes(prev => ({
                                ...prev,
                                [shop.id]: []
                              }));
                            }}
                          >
                            清空
                          </Button>
                          <Button 
                            type="primary"
                            size="small"
                            loading={syncing}
                            onClick={() => {
                              handleSyncShopWithTypes(shop.id, shopSelectedTypes[shop.id]);
                              setShopSelectedTypes(prev => ({
                                ...prev,
                                [shop.id]: []
                              }));
                            }}
                          >
                            开始同步 ({shopSelectedTypes[shop.id].length}项)
                          </Button>
                        </Space>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 同步进度 */}
        <SyncStatusSection
          syncing={syncing}
          currentSyncDataType={currentSyncDataType}
          syncResults={syncResults}
          onMinimize={() => {
            setSyncModalVisible(false);
            message.info('同步任务将在后台继续执行，点击"同步数据"按钮可查看进度');
          }}
        />
      </Modal>
    </Layout>
  );
}

// 数据类型选项
const dataTypeOptions = [
  { label: '商品', value: 'products' },
  { label: '采购单', value: 'stock_orders' },
  { label: '发货单', value: 'delivery_orders' },
  { label: '库存', value: 'inventory' },
  { label: '财务', value: 'finance' }
];

// 主布局组件
function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [enterprises, setEnterprises] = useState([]);
  const [currentEnterprise, setCurrentEnterprise] = useState(null);
  const [requiresEnterpriseSelection, setRequiresEnterpriseSelection] = useState(false);
  const [switchingEnterprise, setSwitchingEnterprise] = useState(false);
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncTaskId, setSyncTaskId] = useState(null);
  const [currentSyncDataType, setCurrentSyncDataType] = useState(null);
  const [syncResults, setSyncResults] = useState(null);
  const [productSyncInfo, setProductSyncInfo] = useState(null); // 商品同步详细进度
  const [shops, setShops] = useState([]);
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [filteredShops, setFilteredShops] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [shopSelectedTypes, setShopSelectedTypes] = useState({});
  const [shopProductSyncSettings, setShopProductSyncSettings] = useState({});
  const [activeTopMenu, setActiveTopMenu] = useState('dashboard'); // 当前选中的一级菜单
  const [expandedMenuGroups, setExpandedMenuGroups] = useState({ onlineProducts: true }); // 菜单分组展开状态
  const canReviewJoinRequests = Boolean(
    currentEnterprise?.isOwner || currentEnterprise?.is_owner || ['owner', 'admin'].includes((currentEnterprise?.memberType || currentEnterprise?.member_type || '').toLowerCase())
  );

  // 根据路径自动设置一级菜单
  useEffect(() => {
    const path = location.pathname;
    if (path === '/') {
      setActiveTopMenu('dashboard');
    } else if (['/orders', '/new-orders', '/review-orders', '/delivery-orders', '/products'].includes(path) || path.startsWith('/delivery-orders/')) {
      setActiveTopMenu('order-management');
    } else if (['/online-products', '/product-inventory', '/publish-product', '/publish-drafts', '/publish-records', '/erp-products', '/product-mapping', '/select-platform-for-publish', '/platform-listed', '/platform-shein-full-listed', '/erp-listed'].includes(path) || path.startsWith('/erp-products/') || path.startsWith('/online-products/')) {
      setActiveTopMenu('product-management');
    } else if (['/product-inbound'].includes(path)) {
      setActiveTopMenu('shipping-management');
    } else if (['/finance-records', '/withdrawals'].includes(path)) {
      setActiveTopMenu('finance-management');
    } else if (['/compliance-label-print', '/package-video-list', '/label-data-tables'].includes(path)) {
      setActiveTopMenu('compliance-management');
    } else if (['/platform-management', '/logistics-management', '/suppliers', '/user-management', '/role-management', '/enterprise-settings', '/join-request-review', '/operation-logs', '/login-logs'].includes(path)) {
      setActiveTopMenu('system-management');
    } else if (['/personal-center'].includes(path)) {
      setActiveTopMenu('dashboard');
    }
  }, [location.pathname]);

  useEffect(() => {
    const authState = getStoredAuthState();
    setUser(authState.user);
    setEnterprises(authState.enterprises || []);
    setCurrentEnterprise(authState.currentEnterprise || null);
    setRequiresEnterpriseSelection(Boolean(authState.requiresEnterpriseSelection));

    if (authState.token) {
      authAPI.getCurrentUser()
        .then((response) => {
          if (response.data.success) {
            saveAuthSession(response.data.data);
            const nextState = getStoredAuthState();
            setUser(nextState.user);
            setEnterprises(nextState.enterprises || []);
            setCurrentEnterprise(nextState.currentEnterprise || null);
            setRequiresEnterpriseSelection(Boolean(nextState.requiresEnterpriseSelection));
          }
        })
        .catch(() => {});
    }

    // 恢复同步状态
    const savedSyncTaskId = localStorage.getItem('syncTaskId');
    if (savedSyncTaskId) {
      setSyncTaskId(savedSyncTaskId);
      setSyncing(true);
      // 恢复轮询
      pollSyncStatus(savedSyncTaskId);
    }
    // 获取店铺列表和平台列表
    fetchShops();
    fetchPlatforms();
  }, []);

  useEffect(() => {
    if (requiresEnterpriseSelection) {
      navigate('/enterprise-onboarding', { replace: true });
    }
  }, [navigate, requiresEnterpriseSelection]);

  const handleEnterpriseChange = async (enterpriseId) => {
    if (!enterpriseId || Number(enterpriseId) === Number(currentEnterprise?.id)) {
      return;
    }

    try {
      setSwitchingEnterprise(true);
      const response = await authAPI.selectEnterprise({ enterpriseId });
      if (response.data.success) {
        saveAuthSession(response.data.data);
        const authState = getStoredAuthState();
        setEnterprises(authState.enterprises || []);
        setCurrentEnterprise(authState.currentEnterprise || null);
        setRequiresEnterpriseSelection(Boolean(authState.requiresEnterpriseSelection));
        message.success(`已切换到企业：${response.data.data.currentEnterprise?.companyName || '已切换'}`);
      } else {
        message.error(response.data.message || '切换企业失败');
      }
    } catch (error) {
      message.error(error.response?.data?.message || '切换企业失败');
    } finally {
      setSwitchingEnterprise(false);
    }
  };

  const fetchShops = async () => {
    try {
      const response = await fetch('/api/shein-full-auth/shops');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setShops(data.data || []);
        }
      }
    } catch (error) {
      console.error('获取店铺列表失败:', error);
    }
  };

  const fetchPlatforms = async () => {
    try {
      console.log('[MainLayout] 开始获取平台列表...');
      const response = await fetch('/api/platform-configs?is_active=true');
      console.log('[MainLayout] 平台API响应状态:', response.status, response.ok);
      if (response.ok) {
        const data = await response.json();
        console.log('[MainLayout] 平台API返回数据:', data);
        if (data.success) {
          setPlatforms(data.data || []);
          console.log('[MainLayout] 已启用的平台:', data.data);
        } else {
          console.error('[MainLayout] 平台API返回失败:', data.message);
        }
      } else {
        const text = await response.text();
        console.error('[MainLayout] 平台API请求失败:', response.status, text);
      }
    } catch (error) {
      console.error('[MainLayout] 获取平台列表异常:', error);
    }
  };

  // 处理平台变化
  const handlePlatformChange = (platformName) => {
    setSelectedPlatform(platformName);
    
    // 根据平台过滤店铺
    if (platformName) {
      // shein_full_shops表的店铺都是SHEIN全托管平台的
      if (platformName === 'shein_full') {
        setFilteredShops(shops);
      } else {
        // 其他平台暂时没有店铺
        setFilteredShops([]);
      }
    } else {
      setFilteredShops([]);
    }
  };

  // 轮询同步状态
  const pollSyncStatus = async (taskId) => {
    try {
      const response = await fetch(`/api/shein-full-sync/status/${taskId}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        const status = data.data;
        const taskResults = getTaskResults(status);
        const failedProductCount = getProductFailedCount(taskResults);
        setSyncProgress(status.progress || 0);
        setCurrentSyncDataType(status.currentDataTypeName || null);
        setSyncResults(taskResults);
        
        // 更新商品同步详细进度
        if (status.productSyncPhase) {
          setProductSyncInfo({
            phase: status.productSyncPhase,
            phaseName: status.currentDataTypeName,
            progress: status.productSyncProgress || 0,
            current: status.productSyncCurrent || 0,
            total: status.productSyncTotal || 0,
            batches: status.productSyncBatches
          });
        } else {
          setProductSyncInfo(null);
        }
        
        if (status.status === 'completed') {
          setSyncProgress(100);
          if (failedProductCount > 0) {
            message.warning(`数据同步完成，但有 ${failedProductCount} 个商品同步失败，请在同步窗口查看详情`);
          } else {
            message.success('数据同步完成！');
          }
          setSyncing(false);
          setSyncTaskId(null);
          setCurrentSyncDataType(null);
          localStorage.removeItem('syncTaskId');
          return;
        }
        
        if (status.status === 'failed') {
          message.error('同步任务失败');
          setSyncing(false);
          setSyncTaskId(null);
          localStorage.removeItem('syncTaskId');
          return;
        }
        
        // 继续轮询
        setTimeout(() => pollSyncStatus(taskId), 1000);
      } else {
        // 任务不存在（已完成或服务重启），清除同步状态
        console.log('同步任务不存在，清除同步状态');
        setSyncing(false);
        setSyncTaskId(null);
        setSyncProgress(0);
        setCurrentSyncDataType(null);
        localStorage.removeItem('syncTaskId');
      }
    } catch (error) {
      console.error('获取同步状态失败:', error);
      // 出错时继续轮询
      setTimeout(() => pollSyncStatus(taskId), 2000);
    }
  };

  // 同步店铺所有数据
  const handleSyncShopAll = async (shopId) => {
    const allDataTypes = ['products', 'stock_orders', 'delivery_orders', 'inventory', 'finance'];
    await handleSyncShopWithTypes(shopId, allDataTypes);
  };

  // 显示同步选项弹窗
  const handleShowSyncOptions = (shopId) => {
    return shopId;
  };

  // 同步店铺指定数据类型
  const handleSyncShopWithTypes = async (shopId, dataTypes) => {
    setSyncing(true);
    setSyncProgress(0);
    setCurrentSyncDataType(null);
    setSyncResults(null);
    setProductSyncInfo(null);
    
    try {
      const payload = buildBatchSyncPayload({
        selectedPlatform,
        dataTypes,
        shopId,
        shopProductSyncSettings
      });

      const response = await fetch('/api/shein-full-sync/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      if (data.success) {
        const taskId = data.data?.taskId;
        if (taskId) {
          setSyncTaskId(taskId);
          localStorage.setItem('syncTaskId', taskId); // 持久化taskId
          message.info('同步任务已启动...');
          setTimeout(() => pollSyncStatus(taskId), 1000);
        } else {
          message.success('数据同步完成！');
          setSyncing(false);
          localStorage.removeItem('syncTaskId');
          fetchShops();
        }
      } else {
        message.error(data.message || '同步失败');
        setSyncing(false);
        localStorage.removeItem('syncTaskId');
      }
    } catch (error) {
      console.error('同步失败:', error);
      message.error('同步失败: ' + error.message);
      setSyncing(false);
      localStorage.removeItem('syncTaskId');
    }
  };

  const handleLogout = () => {
    clearAuthSession();
    navigate('/login');
  };

  const userMenuItems = [
    {
      key: 'user-info',
      disabled: true,
      label: (
        <div style={{ padding: '8px 0' }}>
          <div style={{ fontWeight: 'bold' }}>{user?.realName || user?.username || '用户'}</div>
          <div style={{ fontSize: '12px', color: '#999' }}>{user?.phone || ''}</div>
        </div>
      )
    },
    {
      key: 'enterprise-info',
      disabled: true,
      label: (
        <div style={{ padding: '4px 0' }}>
          <div style={{ fontSize: '12px', color: '#999' }}>当前企业</div>
          <div>{currentEnterprise?.companyName || '未加入企业'}</div>
        </div>
      )
    },
    {
      type: 'divider'
    },
    {
      key: 'personal-center',
      icon: <UserOutlined />,
      label: '个人中心'
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录'
    }
  ];

  const topMenuItems = [
    { key: 'dashboard', label: <Link to="/" style={{ color: 'inherit' }}>首页</Link> },
    { key: 'order-management', label: <Link to="/new-orders" style={{ color: 'inherit' }}>订单</Link> },
    { key: 'shipping-management', label: <Link to="/product-inbound" style={{ color: 'inherit' }}>仓库</Link> },
    { key: 'product-management', label: <Link to="/online-products" style={{ color: 'inherit' }}>商品</Link> },
    { key: 'finance-management', label: <Link to="/finance-records" style={{ color: 'inherit' }}>财务</Link> },
    { key: 'compliance-management', label: <Link to="/compliance-label-print" style={{ color: 'inherit' }}>更多+</Link> },
    { key: 'system-management', label: <Link to="/platform-management" style={{ color: 'inherit' }}>设置</Link> }
  ];

  // 根据当前路径获取选中的菜单项和展开的子菜单
  const getSelectedKey = () => {
    const path = location.pathname;
    if (path === '/') return ['dashboard'];
    if (path === '/orders') return ['urgent-orders'];
    if (path === '/new-orders') return ['stock-orders'];
    if (path === '/review-orders') return ['review-orders'];
    if (path === '/shipping-station') return ['shipping-station'];
    if (path === '/delivery-orders') return ['delivery-orders'];
    if (path === '/products') return ['after-sales'];
    if (path === '/online-products/shein') return ['online-products-shein'];
    if (path === '/online-products/temu') return ['online-products-temu'];
    if (path === '/online-products/tiktok') return ['online-products-tiktok'];
    if (path === '/online-products') return ['online-products-shein'];
    if (path === '/product-inventory') return ['product-inventory'];
    if (path === '/product-inbound') return ['product-inbound'];
    if (path === '/warehouse-inventory') return ['warehouse-inventory'];
    if (path === '/publish-product') return ['publish-product'];
    if (path === '/select-platform-for-publish') return ['publish-product'];
    if (path === '/publish-drafts') return ['publish-drafts'];
    if (path === '/publish-records') return ['publish-records'];
    if (path === '/platform-listed') return ['publish-product'];
    if (path === '/platform-shein-full-listed') return ['publish-product'];
    if (path === '/erp-listed') return ['publish-product'];
    if (path === '/erp-products') return ['erp-products'];
    if (path === '/product-mapping') return ['product-mapping'];
    if (path === '/finance-records') return ['basic-finance'];
    if (path === '/withdrawals') return ['sales-finance'];
    if (path === '/platform-management') return ['platform-management'];
    if (path === '/logistics-management') return ['logistics-management'];
    if (path === '/suppliers') return ['suppliers'];
    if (path === '/compliance-label-print') return ['compliance-label-print'];
    if (path === '/label-data-tables') return ['label-data-tables'];
    if (path === '/package-video-list') return ['package-video-list'];
    if (path === '/user-management') return ['user-management'];
    if (path === '/role-management') return ['role-management'];
    if (path === '/enterprise-settings') return ['enterprise-settings'];
    if (path === '/join-request-review') return ['join-request-review'];
    if (path === '/operation-logs') return ['operation-logs'];
    if (path === '/login-logs') return ['login-logs'];
    if (path === '/personal-center') return ['personal-center'];
    return ['dashboard'];
  };

  const getOpenKeys = () => {
    const path = location.pathname;
    if (path === '/orders' || path === '/new-orders' || path === '/review-orders' || path === '/delivery-orders' || path === '/products') {
      return ['order-management'];
    }
    if (path.startsWith('/online-products') || path === '/product-inventory' || path === '/publish-product' || path === '/select-platform-for-publish' || path === '/publish-drafts' || path === '/publish-records' || path === '/platform-listed' || path === '/platform-shein-full-listed' || path === '/erp-listed' || path === '/erp-products' || path === '/product-mapping') {
      return ['product-management'];
    }
    if (path === '/finance-records' || path === '/withdrawals') {
      return ['finance-management'];
    }
    if (path === '/platform-management' || path === '/logistics-management' || path === '/suppliers' || 
        path === '/user-management' || path === '/role-management' || path === '/enterprise-settings' ||
        path === '/join-request-review' ||
        path === '/operation-logs' || path === '/login-logs') {
      return ['system-management'];
    }
    if (path === '/compliance-label-print') {
      return ['compliance-management'];
    }
    return [];
  };

  const sideMenuItems = [
    ...(activeTopMenu === 'order-management' ? [
      { key: 'stock-orders', label: <Link to="/new-orders">采购单列表</Link> },
      { key: 'review-orders', label: <Link to="/review-orders">备货审核列表</Link> },
      { key: 'shipping-station', label: <Link to="/shipping-station">发货台</Link> },
      { key: 'delivery-orders', label: <Link to="/delivery-orders">发货单列表</Link> },
      { key: 'urgent-orders', label: <Link to="/orders">自发货列表</Link> },
      { key: 'after-sales', label: <Link to="/products">售后列表</Link> }
    ] : []),
    ...(activeTopMenu === 'product-management' ? [
      {
        key: 'online-products-group-toggle',
        disabled: true,
        label: (
          <div
            style={{
              margin: '-12px -16px',
              padding: '12px 16px',
              background: '#f5f5f5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid #e8e8e8',
              cursor: 'pointer'
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setExpandedMenuGroups(prev => ({ ...prev, onlineProducts: !prev.onlineProducts }));
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShoppingOutlined style={{ fontSize: '18px', color: '#333' }} />
              <span style={{ fontSize: '14px', color: '#333', fontWeight: 500 }}>在线商品</span>
            </div>
            <span
              style={{
                color: '#999',
                fontSize: '12px',
                transition: 'transform 0.2s',
                transform: expandedMenuGroups.onlineProducts ? 'rotate(0deg)' : 'rotate(180deg)'
              }}
            >
              ∧
            </span>
          </div>
        )
      },
      ...(expandedMenuGroups.onlineProducts ? [
        { key: 'online-products-shein', label: <Link to="/online-products/shein">SHEIN</Link> },
        { key: 'online-products-temu', label: <Link to="/online-products/temu">TEMU</Link> },
        { key: 'online-products-tiktok', label: <Link to="/online-products/tiktok">TikTok</Link> }
      ] : []),
      { key: 'product-inventory', label: <Link to="/product-inventory">商品库存</Link> },
      { key: 'publish-product', label: <Link to="/publish-product">刊登产品</Link> },
      { key: 'publish-drafts', label: <Link to="/publish-drafts">刊登草稿箱</Link> },
      { key: 'publish-records', label: <Link to="/publish-records">发布记录</Link> },
      { key: 'erp-products', label: <Link to="/erp-products">ERP商品</Link> },
      { key: 'product-mapping', label: <Link to="/product-mapping">映射管理</Link> }
    ] : []),
    ...(activeTopMenu === 'shipping-management' ? [
      { key: 'product-inbound', label: <Link to="/product-inbound">产品入库</Link> },
      { key: 'warehouse-inventory', label: <Link to="/warehouse-inventory">产品库存</Link> }
    ] : []),
    ...(activeTopMenu === 'finance-management' ? [
      { key: 'basic-finance', label: <Link to="/finance-records">基础流水</Link> },
      { key: 'sales-finance', label: <Link to="/withdrawals">销售流水</Link> }
    ] : []),
    ...(activeTopMenu === 'compliance-management' ? [
      { key: 'compliance-label-print', label: <Link to="/compliance-label-print">合规标签打印</Link> },
      { key: 'label-data-tables', label: <Link to="/label-data-tables">标签数据表</Link> },
      { key: 'package-video-list', label: <Link to="/package-video-list">包装录像列表</Link> }
    ] : []),
    ...(activeTopMenu === 'system-management' ? [
      { key: 'platform-management', label: <Link to="/platform-management">店铺授权</Link> },
      { key: 'logistics-management', label: <Link to="/logistics-management">物流商对接</Link> },
      { key: 'logistics-account-management', label: <Link to="/logistics-account-management">物流商账号</Link> },
      { key: 'suppliers', label: <Link to="/suppliers">厂家管理</Link> },
      { type: 'divider' },
      { key: 'user-management', label: <Link to="/user-management">用户管理</Link> },
      { key: 'role-management', label: <Link to="/role-management">角色权限</Link> },
      { key: 'enterprise-settings', label: <Link to="/enterprise-settings">企业设置</Link> },
      ...(canReviewJoinRequests ? [{ key: 'join-request-review', label: <Link to="/join-request-review">加入申请审核</Link> }] : []),
      { type: 'divider' },
      { key: 'operation-logs', label: <Link to="/operation-logs">操作日志</Link> },
      { key: 'login-logs', label: <Link to="/login-logs">登录日志</Link> }
    ] : [])
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ 
        display: 'flex', 
        alignItems: 'center',
        padding: '0 24px',
        height: 55,
        lineHeight: '55px',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        backgroundImage: `
          url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2400 64"><defs><linearGradient id="waveGrad" x1="0%25" y1="0%25" x2="100%25" y2="0%25"><stop offset="0%25" style="stop-color:%23b8c9f8;stop-opacity:0.34"/><stop offset="50%25" style="stop-color:%235a6fd8;stop-opacity:0.34"/><stop offset="100%25" style="stop-color:%23b8c9f8;stop-opacity:0.34"/></linearGradient><style>.wave{fill:none;stroke:url(%23waveGrad);stroke-width:1.5;}</style></defs><path class="wave" d="M0,32 Q600,-16 1200,32 T2400,32"/><path class="wave" d="M0,36 Q600,-12 1200,36 T2400,36"/><path class="wave" d="M0,40 Q600,-8 1200,40 T2400,40"/><path class="wave" d="M0,44 Q600,-4 1200,44 T2400,44"/><path class="wave" d="M0,48 Q600,0 1200,48 T2400,48"/><path class="wave" d="M0,52 Q600,4 1200,52 T2400,52"/></svg>'),
          linear-gradient(to right, #7d9bfe, #88b7fd, #88b7fd, #88b7fd, #7d9bfe)
        `,
        backgroundSize: '100% 100%, 100% 100%',
        backgroundPosition: '0 0, 0 0',
        backgroundRepeat: 'repeat-x, no-repeat'
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center' }}>
          <img 
            src="/logo.png" 
            alt="logo" 
            style={{ height: '40px', cursor: 'pointer' }}
          />
        </Link>
        {/* 顶部一级导航菜单 */}
        <style>{`
          .top-nav-menu.ant-menu-horizontal > .ant-menu-item-selected,
          .top-nav-menu.ant-menu-horizontal > .ant-menu-item-active {
            background: transparent !important;
          }
          .top-nav-menu.ant-menu-horizontal > .ant-menu-item-selected::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 70%;
            height: 3px;
            background: #ffffff;
            border-radius: 2px;
          }
          .top-nav-menu.ant-menu-horizontal > .ant-menu-item::after {
            border-bottom: none !important;
          }
          /* 移除菜单两侧的白色渐变遮罩 */
          .top-nav-menu.ant-menu-horizontal::before,
          .top-nav-menu.ant-menu-horizontal::after {
            display: none !important;
          }
          .top-nav-menu.ant-menu-overflow {
            overflow: visible !important;
          }
        `}</style>
        <Menu 
          mode="horizontal" 
          selectedKeys={[activeTopMenu]} 
          items={topMenuItems}
          disabledOverflow
          className="top-nav-menu"
          style={{ flex: 1, background: 'transparent', borderBottom: 'none', marginLeft: 54, fontSize: 17 }}
          theme="dark"
          onClick={({ key }) => setActiveTopMenu(key)}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {enterprises.length > 0 ? (
            <Select
              value={currentEnterprise?.id || undefined}
              placeholder="选择企业"
              onChange={handleEnterpriseChange}
              loading={switchingEnterprise}
              style={{ width: 220 }}
              size="middle"
              optionFilterProp="label"
              showSearch
            >
              {enterprises.map((enterprise) => (
                <Option
                  key={enterprise.id}
                  value={enterprise.id}
                  label={`${enterprise.companyName} (${enterprise.enterpriseCode})`}
                >
                  {enterprise.companyName} ({enterprise.enterpriseCode})
                </Option>
              ))}
            </Select>
          ) : requiresEnterpriseSelection ? (
            <Button
              size="middle"
              style={{ background: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.35)', color: '#ffffff' }}
              onClick={() => navigate('/enterprise-onboarding')}
            >
              完成初始化
            </Button>
          ) : null}
          <Button 
            type="primary" 
            icon={<SyncOutlined spin={syncing} />}
            onClick={() => setSyncModalVisible(true)}
            style={{ 
              backgroundColor: syncing ? '#52c41a' : 'rgba(255, 255, 255, 0.2)',
              borderColor: syncing ? '#52c41a' : 'rgba(255, 255, 255, 0.4)',
              color: '#ffffff'
            }}
          >
            {syncing ? '正在同步...' : '同步数据'}
          </Button>
          <Dropdown
            menu={{
              items: userMenuItems,
              onClick: ({ key }) => {
                if (key === 'personal-center') {
                  navigate('/personal-center');
                }
                if (key === 'logout') {
                  handleLogout();
                }
              }
            }}
            placement="bottomRight"
          >
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Avatar 
                src={user?.avatar} 
                icon={!user?.avatar && <UserOutlined />}
                style={{ backgroundColor: '#1890ff' }}
              />
              <span style={{ color: '#ffffff' }}>{user?.realName || user?.username || '用户'}</span>
            </div>
          </Dropdown>
        </div>
      </Header>
      <Layout style={{ marginTop: 55 }}>
        {/* 左侧二级菜单侧边栏 - 首页和详情页不显示 */}
        {activeTopMenu !== 'dashboard' && !location.pathname.match(/\/delivery-orders\/\d+/) && (
          <Sider width={170} style={{ 
            background: '#ffffff',
            position: 'fixed',
            left: 0,
            top: 55,
            bottom: 0,
            overflow: 'auto',
            zIndex: 99
          }}>
            <Menu 
              mode="inline" 
              selectedKeys={getSelectedKey()} 
              items={sideMenuItems}
              style={{ height: '100%', borderRight: 0 }}
            />
          </Sider>
        )}
        <Layout style={{ padding: '0', marginLeft: (activeTopMenu === 'dashboard' || location.pathname.match(/\/delivery-orders\/\d+/)) ? 0 : 170 }}>
          {/* 面包屑导航 - 首页不显示 */}
          {location.pathname !== '/' && (
          <div style={{
            background: '#f5f5f5',
            padding: '0 24px',
            lineHeight: '32px',
            fontSize: '14px',
            color: '#666'
          }}>
            {(() => {
              let parentMenu = '';
              let currentMenu = '';
              
              if (location.pathname === '/orders') {
                parentMenu = '订单管理';
                currentMenu = '自发货列表';
              } else if (location.pathname === '/new-orders') {
                parentMenu = '订单管理';
                currentMenu = '采购单列表';
              } else if (location.pathname === '/review-orders') {
                parentMenu = '订单管理';
                currentMenu = '备货审核列表';
              } else if (location.pathname === '/shipping-station') {
                parentMenu = '订单管理';
                currentMenu = '发货台';
              } else if (location.pathname === '/delivery-orders') {
                parentMenu = '订单管理';
                currentMenu = '发货单列表';
              } else if (location.pathname.startsWith('/delivery-orders/')) {
                parentMenu = '订单管理 > 发货单列表';
                const urlParams = new URLSearchParams(location.search);
                const deliveryCode = urlParams.get('code');
                currentMenu = deliveryCode ? `发货单详情 (${deliveryCode})` : '发货单详情';
              } else if (location.pathname === '/products') {
                parentMenu = '订单管理';
                currentMenu = '售后列表';
              } else if (location.pathname === '/online-products/shein') {
                parentMenu = '商品管理 > 在线商品';
                currentMenu = 'SHEIN';
              } else if (location.pathname === '/online-products/temu') {
                parentMenu = '商品管理 > 在线商品';
                currentMenu = 'TEMU';
              } else if (location.pathname === '/online-products/tiktok') {
                parentMenu = '商品管理 > 在线商品';
                currentMenu = 'TikTok';
              } else if (location.pathname === '/online-products') {
                parentMenu = '商品管理';
                currentMenu = '在线商品';
              } else if (location.pathname === '/product-inventory') {
                parentMenu = '商品管理';
                currentMenu = '商品库存';
              } else if (location.pathname === '/product-inbound') {
                parentMenu = '仓库管理';
                currentMenu = '产品入库';
              } else if (location.pathname === '/warehouse-inventory') {
                parentMenu = '仓库管理';
                currentMenu = '产品库存';
              } else if (location.pathname === '/publish-product') {
                parentMenu = '商品管理';
                currentMenu = '刊登产品';
              } else if (location.pathname === '/select-platform-for-publish') {
                parentMenu = '商品管理';
                currentMenu = '选择刊登平台';
              } else if (location.pathname === '/publish-drafts') {
                parentMenu = '商品管理';
                currentMenu = '刊登草稿箱';
              } else if (location.pathname === '/publish-records') {
                parentMenu = '商品管理';
                currentMenu = '发布记录';
              } else if (location.pathname === '/platform-listed') {
                parentMenu = '商品管理';
                currentMenu = '按平台刊登';
              } else if (location.pathname === '/platform-shein-full-listed') {
                parentMenu = '商品管理';
                currentMenu = 'SHEIN全托管刊登';
              } else if (location.pathname === '/erp-listed') {
                parentMenu = '商品管理';
                currentMenu = '从ERP产品刊登';
              } else if (location.pathname === '/erp-products') {
                parentMenu = '商品管理';
                currentMenu = 'ERP商品';
              } else if (location.pathname === '/erp-products/create') {
                parentMenu = '商品管理';
                currentMenu = '创建ERP商品';
              } else if (location.pathname.startsWith('/erp-products/edit/')) {
                parentMenu = '商品管理';
                currentMenu = '编辑ERP商品';
              } else if (location.pathname === '/product-mapping') {
                parentMenu = '商品管理';
                currentMenu = '映射管理';
              } else if (location.pathname === '/finance-records') {
                parentMenu = '资金管理';
                currentMenu = '基础流水';
              } else if (location.pathname === '/withdrawals') {
                parentMenu = '资金管理';
                currentMenu = '销售流水';
              } else if (location.pathname === '/platform-management') {
                parentMenu = '系统管理';
                currentMenu = '店铺授权';
              } else if (location.pathname === '/logistics-management') {
                parentMenu = '系统管理';
                currentMenu = '物流商对接';
              } else if (location.pathname === '/suppliers') {
                parentMenu = '系统管理';
                currentMenu = '厂家管理';
              } else if (location.pathname === '/compliance-label-print') {
                parentMenu = '更多功能';
                currentMenu = '合规标签打印';
              } else if (location.pathname === '/label-data-tables') {
                parentMenu = '更多功能';
                currentMenu = '标签数据表';
              } else if (location.pathname === '/package-video-list') {
                parentMenu = '更多功能';
                currentMenu = '包装录像列表';
              } else if (location.pathname === '/user-management') {
                parentMenu = '系统管理';
                currentMenu = '用户管理';
              } else if (location.pathname === '/role-management') {
                parentMenu = '系统管理';
                currentMenu = '角色权限';
              } else if (location.pathname === '/enterprise-settings') {
                parentMenu = '系统管理';
                currentMenu = '企业设置';
              } else if (location.pathname === '/join-request-review') {
                parentMenu = '系统管理';
                currentMenu = '加入申请审核';
              } else if (location.pathname === '/operation-logs') {
                parentMenu = '系统管理';
                currentMenu = '操作日志';
              } else if (location.pathname === '/login-logs') {
                parentMenu = '系统管理';
                currentMenu = '登录日志';
              } else if (location.pathname === '/personal-center') {
                parentMenu = '个人中心';
                currentMenu = '账户设置';
              }
              
              return (
                <>
                  <span style={{ cursor: 'pointer' }}>{parentMenu}</span>
                  <span style={{ margin: '0 8px', color: '#999' }}>&gt;</span>
                  <span style={{ color: '#333', fontWeight: '500' }}>{currentMenu}</span>
                </>
              );
            })()}
          </div>
          )}
          <Content style={{ background: '#fff', padding: 24, margin: '0 24px 24px 24px', minHeight: 280 }}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/products" element={<Products />} />
              <Route path="/new-orders" element={<StockOrders />} />
              <Route path="/review-orders" element={<ReviewOrders />} />
              <Route path="/shipping-station" element={<ShippingStation />} />
              <Route path="/delivery-orders" element={<DeliveryOrders />} />
              <Route path="/delivery-orders/:id" element={<DeliveryOrderDetail />} />
              <Route path="/sku-sales-analysis" element={<SkuSalesAnalysis />} />
              <Route path="/online-products" element={<OnlineProducts />} />
              <Route path="/online-products/shein" element={<OnlineProducts platform="shein" />} />
              <Route path="/online-products/temu" element={<OnlineProducts platform="temu" />} />
              <Route path="/online-products/tiktok" element={<OnlineProducts platform="tiktok" />} />
              <Route path="/product-inventory" element={<ProductInventory />} />
              <Route path="/product-inbound" element={<ProductInbound />} />
              <Route path="/warehouse-inventory" element={<WarehouseInventory />} />
              <Route path="/publish-product" element={<PublishProduct />} />
              <Route path="/select-platform-for-publish" element={<SelectPlatformForPublish />} />
              <Route path="/platform-listed" element={<PublishByPlatform />} />
              <Route path="/erp-listed" element={<PublishFromERP />} />
              <Route path="/publish-drafts" element={<PublishDrafts />} />
              <Route path="/publish-records" element={<PublishRecords />} />
              <Route path="/erp-products" element={<ERPProducts />} />
              <Route path="/erp-products/create" element={<ERPProductEdit />} />
              <Route path="/erp-products/edit/:id" element={<ERPProductEdit />} />
              <Route path="/product-mapping" element={<ProductMapping />} />
              <Route path="/finance-records" element={<FinanceRecords />} />
              <Route path="/withdrawals" element={<Withdrawals />} />
              <Route path="/platform-management" element={<PlatformManagement />} />
              <Route path="/logistics-management" element={<LogisticsManagement />} />
              <Route path="/suppliers" element={<Suppliers />} />
              <Route path="/compliance-label-print" element={<ComplianceLabelPrint />} />
              <Route path="/label-data-tables" element={<DataTablePage />} />
              <Route path="/package-video-list" element={<PackageVideoList />} />
              <Route path="/courier-reports" element={<CourierReports />} />
              <Route path="/logistics-account-management" element={<LogisticsAccountManagement />} />
              <Route path="/label-editor" element={<LabelEditor />} />
              <Route path="/label-editor/:templateId" element={<LabelEditor />} />
              <Route path="/shein-callback" element={<PlatformManagement />} />
              <Route path="/user-management" element={<UserManagement />} />
              <Route path="/role-management" element={<RoleManagement />} />
              <Route path="/enterprise-settings" element={<EnterpriseSettings />} />
              <Route path="/join-request-review" element={<JoinRequestReview />} />
              <Route path="/operation-logs" element={<OperationLogs />} />
              <Route path="/login-logs" element={<LoginLogs />} />
              <Route path="/personal-center" element={<PersonalCenter />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>

      {/* 同步数据模态框 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 24 }}>
            <span>同步数据</span>
            {syncing && (
              <span style={{ fontSize: '12px', color: '#52c41a', fontWeight: 'normal' }}>
                ● 后台运行中
              </span>
            )}
          </div>
        }
        open={syncModalVisible}
        onCancel={() => {
          setSyncModalVisible(false);
          if (syncing) {
            message.info('同步任务将在后台继续执行，点击"同步数据"按钮可查看进度');
          } else {
            setSelectedPlatform(null);
            setFilteredShops([]);
          }
        }}
        footer={null}
        width={700}
        maskClosable={true}
      >
        {/* 平台筛选 */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ marginBottom: '8px', fontWeight: 500 }}>选择平台：</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {platforms.map(platform => (
              <Button
                key={platform.platform_name}
                type={selectedPlatform === platform.platform_name ? 'primary' : 'default'}
                onClick={() => handlePlatformChange(platform.platform_name)}
              >
                {platform.platform_display_name || platform.platform_name}
              </Button>
            ))}
          </div>
        </div>

        {/* 店铺列表 */}
        {selectedPlatform && (
          <div>
            <div style={{ marginBottom: '8px', fontWeight: 500 }}>店铺列表：</div>
            {filteredShops.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#999', background: '#fafafa', borderRadius: '4px' }}>
                该平台暂无已授权店铺
              </div>
            ) : (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {filteredShops.map(shop => (
                  <div key={shop.id} style={{
                    padding: '12px 16px', marginBottom: '8px', background: '#fafafa', borderRadius: '4px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontWeight: 500 }}>{shop.shop_name}</div>
                        <div style={{ fontSize: '12px', color: '#999' }}>
                          {shop.auth_status === 1 ? '已授权' : '未授权'} | 最后同步: {shop.last_sync_at || '从未同步'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
                          {`商品成功同步: ${formatSyncDateTime(shop.last_product_sync_success_at)} ｜ 增量起点: ${formatSyncDateTime(shop.last_product_sync_checkpoint_time)} ｜ 上次模式: ${getProductSyncModeText(shop.last_product_sync_mode)}`}
                        </div>
                      </div>
                      <Button 
                        type="primary" 
                        size="small"
                        loading={syncing}
                        disabled={shop.auth_status !== 1}
                        onClick={() => handleSyncShopAll(shop.id)}
                      >
                        同步所有
                      </Button>
                    </div>
                    <ProductSyncSettings
                      shopId={shop.id}
                      enabled={shop.auth_status === 1}
                      syncing={syncing}
                      value={shopProductSyncSettings[shop.id]}
                      shopMeta={shop}
                      onChange={(targetShopId, nextSettings) => {
                        setShopProductSyncSettings(prev => ({
                          ...prev,
                          [targetShopId]: normalizeProductSyncSettings(nextSettings)
                        }));
                      }}
                    />
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>选择同步数据类型：</div>
                      <Checkbox.Group
                        value={shopSelectedTypes[shop.id] || []}
                        onChange={(values) => {
                          setShopSelectedTypes(prev => ({
                            ...prev,
                            [shop.id]: values
                          }));
                        }}
                        disabled={shop.auth_status !== 1 || syncing}
                      >
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {dataTypeOptions.map(option => (
                            <Checkbox key={option.value} value={option.value}>
                              {option.label}
                            </Checkbox>
                          ))}
                        </div>
                      </Checkbox.Group>
                    </div>
                    {shopSelectedTypes[shop.id] && shopSelectedTypes[shop.id].length > 0 && (
                      <div style={{ textAlign: 'right' }}>
                        <Space>
                          <Button 
                            size="small"
                            onClick={() => {
                              setShopSelectedTypes(prev => ({
                                ...prev,
                                [shop.id]: []
                              }));
                            }}
                          >
                            清空
                          </Button>
                          <Button 
                            type="primary"
                            size="small"
                            loading={syncing}
                            onClick={() => {
                              handleSyncShopWithTypes(shop.id, shopSelectedTypes[shop.id]);
                              setShopSelectedTypes(prev => ({
                                ...prev,
                                [shop.id]: []
                              }));
                            }}
                          >
                            开始同步 ({shopSelectedTypes[shop.id].length}项)
                          </Button>
                        </Space>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 同步进度 */}
        <SyncStatusSection
          syncing={syncing}
          currentSyncDataType={currentSyncDataType}
          syncResults={syncResults}
          onMinimize={() => {
            setSyncModalVisible(false);
            message.info('同步任务将在后台继续执行，点击"同步数据"按钮可查看进度');
          }}
        />
      </Modal>
    </Layout>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        {/* 登录页面（公开访问） */}
        <Route path="/login" element={<Login />} />
        
        {/* SHEIN授权回调页面（公开访问） */}
        <Route path="/auth/shein-full/callback" element={<SheinFullAuthCallback />} />
        
        {/* SHEIN全托管刊登页面（独立页面，有顶部导航栏但无侧边栏） */}
        <Route path="/platform-shein-full-listed" element={
          <PrivateRoute>
            <HeaderOnlyLayout>
              <PlatformSheinFullListed />
            </HeaderOnlyLayout>
          </PrivateRoute>
        } />
        
        {/* 标签编辑器（独立全屏页面，无顶部导航栏和侧边栏） */}
        <Route path="/label-editor" element={
          <PrivateRoute>
            <LabelEditor />
          </PrivateRoute>
        } />
        <Route path="/label-editor/:templateId" element={
          <PrivateRoute>
            <LabelEditor />
          </PrivateRoute>
        } />

        <Route path="/enterprise-onboarding" element={
          <PrivateRoute>
            <EnterpriseOnboarding />
          </PrivateRoute>
        } />
        
        {/* 所有其他页面都需要登录 */}
        <Route path="/*" element={
          <PrivateRoute>
            <MainLayout />
          </PrivateRoute>
        } />
      </Routes>
    </Router>
  );
}

export default App;
