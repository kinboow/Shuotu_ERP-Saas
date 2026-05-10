import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, BrowserRouter as Router, Routes, useNavigate } from 'react-router-dom';
import {
  createPlatformUser,
  getCurrentUser,
  getEnterprises,
  getOverview,
  getPlans,
  getPlatformUsers,
  getProviderCredentials,
  login
} from './api';

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('platform_admin_token');
  return token ? children : <Navigate to="/login" replace />;
}

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('platform_admin');
  const [password, setPassword] = useState('admin123');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const result = await login(username, password);
      if (!result.success) {
        setError(result.message || '登录失败');
        setSubmitting(false);
        return;
      }
      localStorage.setItem('platform_admin_token', result.data.token);
      localStorage.setItem('platform_admin_user', JSON.stringify(result.data.user));
      navigate('/');
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || '登录失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">平台管理后台</h1>
        <p className="login-subtitle">独立于业务 SaaS 系统的运营管理入口</p>
        {error ? <div className="error-text">{error}</div> : null}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>用户名</label>
            <input className="form-input" value={username} onChange={(event) => setUsername(event.target.value)} />
          </div>
          <div className="form-group">
            <label>密码</label>
            <input className="form-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? '登录中...' : '登录平台后台'}
          </button>
        </form>
      </div>
    </div>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const storedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('platform_admin_user') || 'null');
    } catch (error) {
      return null;
    }
  }, []);
  const [profile, setProfile] = useState(storedUser);
  const [overview, setOverview] = useState(null);
  const [platformUsers, setPlatformUsers] = useState([]);
  const [enterprises, setEnterprises] = useState([]);
  const [plans, setPlans] = useState([]);
  const [providers, setProviders] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [createForm, setCreateForm] = useState({ username: '', password: '', realName: '', email: '' });
  const [message, setMessage] = useState('');

  const loadAll = async () => {
    const [currentUserResult, overviewResult, usersResult, enterprisesResult, plansResult, providersResult] = await Promise.all([
      getCurrentUser(),
      getOverview(),
      getPlatformUsers(),
      getEnterprises(),
      getPlans(),
      getProviderCredentials()
    ]);

    if (currentUserResult.success) {
      setProfile(currentUserResult.data);
    }
    if (overviewResult.success) {
      setOverview(overviewResult.data);
    }
    if (usersResult.success) {
      setPlatformUsers(usersResult.data);
    }
    if (enterprisesResult.success) {
      setEnterprises(enterprisesResult.data);
    }
    if (plansResult.success) {
      setPlans(plansResult.data);
    }
    if (providersResult.success) {
      setProviders(providersResult.data);
    }
  };

  useEffect(() => {
    loadAll().catch((error) => {
      if (error.response?.status === 401) {
        localStorage.removeItem('platform_admin_token');
        localStorage.removeItem('platform_admin_user');
        navigate('/login');
      }
    });
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('platform_admin_token');
    localStorage.removeItem('platform_admin_user');
    navigate('/login');
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setMessage('');
    const result = await createPlatformUser(createForm);
    setMessage(result.message || (result.success ? '创建成功' : '创建失败'));
    if (result.success) {
      setCreateForm({ username: '', password: '', realName: '', email: '' });
      const usersResult = await getPlatformUsers();
      if (usersResult.success) {
        setPlatformUsers(usersResult.data);
      }
    }
  };

  return (
    <div className="app-shell">
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div className="admin-brand">协途ERP 平台后台</div>
          <div className="muted" style={{ marginBottom: 16 }}>{profile?.real_name || profile?.realName || profile?.username}</div>
          <nav className="admin-nav">
            <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>平台概览</button>
            <button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>平台用户</button>
            <button className={activeTab === 'enterprises' ? 'active' : ''} onClick={() => setActiveTab('enterprises')}>企业列表</button>
            <button className={activeTab === 'plans' ? 'active' : ''} onClick={() => setActiveTab('plans')}>套餐矩阵</button>
            <button className={activeTab === 'providers' ? 'active' : ''} onClick={() => setActiveTab('providers')}>全局平台配置</button>
          </nav>
        </aside>
        <main className="admin-main">
          <div className="admin-header">
            <div>
              <h1 style={{ margin: 0 }}>平台管理后台</h1>
              <div className="muted">独立代码、独立端口、独立 API 的平台运营入口</div>
            </div>
            <button className="primary-button" style={{ width: 140 }} onClick={handleLogout}>退出登录</button>
          </div>

          {activeTab === 'overview' && overview ? (
            <>
              <div className="card-grid">
                <div className="stat-card"><div className="stat-label">企业数</div><div className="stat-value">{overview.enterpriseCount}</div></div>
                <div className="stat-card"><div className="stat-label">企业成员数</div><div className="stat-value">{overview.memberCount}</div></div>
                <div className="stat-card"><div className="stat-label">平台用户数</div><div className="stat-value">{overview.platformUserCount}</div></div>
                <div className="stat-card"><div className="stat-label">套餐数</div><div className="stat-value">{overview.planCount}</div></div>
              </div>
              <div className="panel-card">
                <h3>第一阶段已落地内容</h3>
                <ul>
                  <li>独立平台管理后台前端 `platform-admin/`</li>
                  <li>独立平台管理 API `services/platform-admin/`</li>
                  <li>独立端口：前端 3790 / 后端 5090</li>
                  <li>SaaS 核心表：企业、成员、套餐、功能、全局平台配置</li>
                </ul>
              </div>
            </>
          ) : null}

          {activeTab === 'users' ? (
            <>
              <div className="panel-card" style={{ marginBottom: 16 }}>
                <h3>创建平台用户</h3>
                {message ? <div className="muted" style={{ marginBottom: 12 }}>{message}</div> : null}
                <form className="inline-form" onSubmit={handleCreateUser}>
                  <input className="form-input" placeholder="用户名" value={createForm.username} onChange={(event) => setCreateForm({ ...createForm, username: event.target.value })} />
                  <input className="form-input" type="password" placeholder="密码" value={createForm.password} onChange={(event) => setCreateForm({ ...createForm, password: event.target.value })} />
                  <input className="form-input" placeholder="姓名" value={createForm.realName} onChange={(event) => setCreateForm({ ...createForm, realName: event.target.value })} />
                  <input className="form-input" placeholder="邮箱" value={createForm.email} onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })} />
                  <button className="primary-button" type="submit">创建平台用户</button>
                </form>
              </div>
              <div className="panel-card">
                <h3>平台用户列表</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>用户名</th>
                        <th>姓名</th>
                        <th>角色</th>
                        <th>状态</th>
                        <th>最近登录</th>
                      </tr>
                    </thead>
                    <tbody>
                      {platformUsers.map((user) => (
                        <tr key={user.id}>
                          <td>{user.id}</td>
                          <td>{user.username}</td>
                          <td>{user.real_name || '-'}</td>
                          <td>{user.role_code}</td>
                          <td>{user.status}</td>
                          <td>{user.last_login_at || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}

          {activeTab === 'enterprises' ? (
            <div className="panel-card">
              <h3>企业列表</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>企业编码</th>
                      <th>企业名称</th>
                      <th>成员数</th>
                      <th>套餐</th>
                      <th>订阅状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enterprises.map((enterprise) => (
                      <tr key={enterprise.id}>
                        <td>{enterprise.id}</td>
                        <td>{enterprise.enterprise_code}</td>
                        <td>{enterprise.company_name}</td>
                        <td>{enterprise.member_count}</td>
                        <td>{enterprise.plan_name || '-'}</td>
                        <td>{enterprise.subscription_status || enterprise.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {activeTab === 'plans' ? (
            <div className="panel-card">
              <h3>套餐矩阵</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>套餐编码</th>
                      <th>套餐名称</th>
                      <th>计费周期</th>
                      <th>价格</th>
                      <th>功能数</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((plan) => (
                      <tr key={plan.id}>
                        <td>{plan.plan_code}</td>
                        <td>{plan.plan_name}</td>
                        <td>{plan.billing_cycle}</td>
                        <td>{plan.price}</td>
                        <td>{plan.feature_count}</td>
                        <td>{plan.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {activeTab === 'providers' ? (
            <div className="panel-card">
              <h3>全局平台配置</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>平台编码</th>
                      <th>平台名称</th>
                      <th>状态</th>
                      <th>最后更新</th>
                    </tr>
                  </thead>
                  <tbody>
                    {providers.map((provider) => (
                      <tr key={provider.id}>
                        <td>{provider.provider_code}</td>
                        <td>{provider.provider_name}</td>
                        <td>{provider.status}</td>
                        <td>{provider.updated_at || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}
