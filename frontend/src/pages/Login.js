import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Login.css';

function Login() {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [loginType, setLoginType] = useState('password'); // 'password' or 'code'
  const [formData, setFormData] = useState({
    phone: '',
    password: '',
    code: ''
  });
  const [registerData, setRegisterData] = useState({
    phone: '',
    password: '',
    confirmPassword: '',
    username: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [leftBgStyle, setLeftBgStyle] = useState({});
  const [messages, setMessages] = useState([]); // 消息队列 [{id, type, text}]

  // 检查背景图片是否存在
  useEffect(() => {
    const checkImage = async () => {
      try {
        const response = await fetch('/illis1.png');
        if (response.ok) {
          setLeftBgStyle({
            backgroundImage: 'url(/illis1.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          });
        }
      } catch (err) {
        console.log('背景图片不存在，使用默认样式');
      }
    };
    checkImage();
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(''); // 清除错误信息
  };

  const handleRegisterChange = (e) => {
    setRegisterData({
      ...registerData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const getApiBaseUrl = () => {
    if (process.env.REACT_APP_API_URL) {
      return process.env.REACT_APP_API_URL;
    }
    const serviceHost = process.env.REACT_APP_SERVICE_HOST || window.location.hostname;
    const protocol = window.location.protocol;
    return `${protocol}//${serviceHost}:5000/api`;
  };

  const handleForgotPassword = (e) => {
    e.preventDefault();
    const messageId = Date.now();
    const newMessage = {
      id: messageId,
      type: 'info',
      text: '如需重置，请联系管理员操作'
    };
    setMessages([...messages, newMessage]);
    // 3秒后自动关闭消息
    setTimeout(() => {
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    }, 3000);
  };

  const closeMessage = (messageId) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  };

  const handleSocialLogin = (e) => {
    e.preventDefault();
    const messageId = Date.now();
    const newMessage = {
      id: messageId,
      type: 'error',
      text: '暂未开通'
    };
    setMessages([...messages, newMessage]);
    // 3秒后自动关闭消息
    setTimeout(() => {
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    }, 3000);
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!registerData.phone || !registerData.password) {
      setError('请输入手机号和密码');
      return;
    }

    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(registerData.phone)) {
      setError('手机号格式不正确');
      return;
    }

    if (registerData.password.length < 6) {
      setError('密码长度不能少于6位');
      return;
    }

    if (registerData.password !== registerData.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    try {
      setLoading(true);

      const apiUrl = getApiBaseUrl();
      const registerRes = await axios.post(`${apiUrl}/auth/register`, {
        phone: registerData.phone,
        password: registerData.password,
        username: registerData.username || registerData.phone
      });

      if (registerRes.data.success) {
        const messageId = Date.now();
        setMessages(prev => ([...prev, { id: messageId, type: 'info', text: '注册成功，请点击登录' }]));
        setAuthMode('login');
        setFormData(prev => ({ ...prev, phone: registerData.phone, password: '' }));
        setRegisterData({ phone: '', password: '', confirmPassword: '', username: '' });
        setTimeout(() => {
          setMessages(prev => prev.filter(msg => msg.id !== messageId));
        }, 3000);
      } else {
        setError(registerRes.data.message || '注册失败');
      }
    } catch (err) {
      if (err.response) {
        setError(err.response.data.message || '注册失败');
      } else {
        setError('注册失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // 验证输入
    if (!formData.phone || !formData.password) {
      setError('请输入手机号和密码');
      return;
    }

    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(formData.phone)) {
      setError('手机号格式不正确');
      return;
    }

    try {
      setLoading(true);

      const apiUrl = getApiBaseUrl();

      // 发送登录请求
      const response = await axios.post(`${apiUrl}/auth/login`, {
        phone: formData.phone,
        password: formData.password,
        deviceType: 'web'
      });

      if (response.data.success) {
        // 保存token和用户信息
        localStorage.setItem('token', response.data.data.accessToken);
        localStorage.setItem('refreshToken', response.data.data.refreshToken);
        localStorage.setItem('user', JSON.stringify(response.data.data.user));
        localStorage.setItem('permissions', JSON.stringify(response.data.data.permissions || []));

        // 跳转到首页
        navigate('/');
      } else {
        setError(response.data.message || '登录失败');
      }

    } catch (err) {
      console.error('登录错误:', err);
      
      if (err.response) {
        // 服务器返回错误
        setError(err.response.data.message || '登录失败，请检查手机号和密码');
      } else if (err.request) {
        // 请求发送失败
        setError('无法连接到服务器，请检查网络连接');
      } else {
        setError('登录失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* 左侧区域 */}
      <div className="login-left" style={leftBgStyle}>
        <div className="welcome-section">
          <h1 className="welcome-title">全新体验</h1>
          <p className="welcome-desc">更便捷、更高效、更专业、更贴心</p>
        </div>

        <div className="illustration-area">
          {/* 3D插图区域 - 背景图片在CSS中设置 */}
        </div>
      </div>

      {/* 右侧登录区域 */}
      <div className="login-right">
        <div className="login-card">
          <h2 className="login-title">欢迎登录</h2>
          <p className="login-subtitle">协途海外跨境电商ERP系统</p>

          {/* 登录方式切换 */}
          <div className="login-tabs">
            <button
              type="button"
              className={`tab-button ${authMode === 'login' ? 'active' : ''}`}
              onClick={() => setAuthMode('login')}
            >
              账号登录
            </button>
            <button
              type="button"
              className={`tab-button ${authMode === 'register' ? 'active' : ''}`}
              onClick={() => setAuthMode('register')}
            >
              注册账号
            </button>
          </div>

          <div className="messages-container">
            {messages.map((msg, index) => (
              <div 
                key={msg.id} 
                className={`message-box-top message-${msg.type}`}
                style={{ top: `${20 + index * 60}px` }}
              >
                <span className="message-icon">ⓘ</span>
                <span className="message-text">{msg.text}</span>
                <button 
                  type="button" 
                  className="message-close"
                  onClick={() => closeMessage(msg.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {authMode === 'login' ? (
          <form onSubmit={handleSubmit} className="login-form">
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <div className="form-group">
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="手机号"
                disabled={loading}
                className="form-input"
              />
            </div>

            {loginType === 'password' ? (
              <>
                <div className="form-group">
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="请输入密码"
                    disabled={loading}
                    className="form-input"
                  />
                </div>
                <div className="forgot-password-wrapper">
                  <a href="#" className="forgot-password" onClick={handleForgotPassword}>忘记密码?</a>
                </div>
              </>
            ) : (
              <div className="form-group">
                <div className="code-input-wrapper">
                  <input
                    type="text"
                    name="code"
                    value={formData.code}
                    onChange={handleChange}
                    placeholder="请输入验证码"
                    disabled={loading}
                    className="form-input"
                  />
                  <button type="button" className="get-code-btn" onClick={handleSocialLogin}>获取验证码</button>
                </div>
              </div>
            )}

            <button 
              type="submit" 
              className="login-button"
              disabled={loading}
            >
              {loading ? '登录中...' : '登录'}
            </button>

            <div className="other-login">
              <div className="divider">
                <span>其他登录方式</span>
              </div>
              <div className="social-login">
                <button type="button" className="social-btn wechat" onClick={handleSocialLogin}>
                  <svg className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="28" height="28">
                    <path d="M664.250054 368.541681c10.015098 0 19.892049 0.732687 29.67281 1.795902-26.647917-122.810047-159.358451-214.077703-310.826188-214.077703-169.353083 0-308.085774 114.232694-308.085774 259.274068 0 83.708494 46.165436 152.460344 123.281791 205.78483l-30.80868 91.730191 107.688651-53.455469c38.558178 7.53665 69.459978 15.308661 107.924012 15.308661 9.66308 0 19.230993-0.470721 28.752858-1.225921-6.025227-20.36584-9.521864-41.723264-9.521864-63.862493C402.328693 476.632491 517.908058 368.541681 664.250054 368.541681zM498.62897 285.87389c23.200398 0 38.557154 15.120372 38.557154 38.061874 0 22.846334-15.356756 38.156018-38.557154 38.156018-23.107277 0-46.260603-15.309684-46.260603-38.156018C452.368366 300.994262 475.522716 285.87389 498.62897 285.87389zM283.016307 362.090758c-23.107277 0-46.402843-15.309684-46.402843-38.156018 0-22.941502 23.295566-38.061874 46.402843-38.061874 23.081695 0 38.46301 15.120372 38.46301 38.061874C321.479317 346.782098 306.098002 362.090758 283.016307 362.090758zM945.448458 606.151333c0-121.888048-123.258255-221.236753-261.683954-221.236753-146.57838 0-262.015505 99.348706-262.015505 221.236753 0 122.06508 115.437126 221.200938 262.015505 221.200938 30.66644 0 61.617359-7.609305 92.423993-15.262612l84.513836 45.786813-23.178909-76.17082C899.379213 735.776599 945.448458 674.90216 945.448458 606.151333zM598.803483 567.994292c-15.332197 0-30.807656-15.096836-30.807656-30.501688 0-15.190981 15.47546-30.477129 30.807656-30.477129 23.295566 0 38.558178 15.286148 38.558178 30.477129C637.361661 552.897456 622.099049 567.994292 598.803483 567.994292zM768.25071 567.994292c-15.213493 0-30.594809-15.096836-30.594809-30.501688 0-15.190981 15.381315-30.477129 30.594809-30.477129 23.107277 0 38.558178 15.286148 38.558178 30.477129C806.808888 552.897456 791.357987 567.994292 768.25071 567.994292z" fill="#707070"/>
                  </svg>
                </button>
                <button type="button" className="social-btn qq" onClick={handleSocialLogin}>
                  <svg className="icon" viewBox="0 0 1191 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="28" height="28">
                    <path d="M496.997 451.513H301.485a35.72 35.72 0 1 0 0 71.441h195.512a35.72 35.72 0 0 0 0-71.441z m0 236.234H301.485a35.72 35.72 0 1 0 0 71.442h195.512a35.72 35.72 0 1 0 0-71.442z m408.886 0H770.858a35.72 35.72 0 1 0 0 71.442h135.025a35.72 35.72 0 1 0 0-71.442z" fill="#707070"/>
                    <path d="M1065.674 952.558V512a35.72 35.72 0 0 0-16.67-30.244L651.789 230.281V35.72a35.72 35.72 0 0 0-53.343-30.958L137.168 266.716a35.72 35.72 0 0 0-18.098 30.958v654.884H0V1024h1190.698v-71.442z m-875.162 0V318.393l390.072-221.47V952.32z m461.514 0V315.535l342.445 216.707v420.792z" fill="#707070"/>
                  </svg>
                </button>
              </div>
            </div>
          </form>
          ) : (
          <form onSubmit={handleRegisterSubmit} className="login-form">
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <div className="form-group">
              <input
                type="text"
                name="phone"
                value={registerData.phone}
                onChange={handleRegisterChange}
                placeholder="手机号"
                disabled={loading}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <input
                type="text"
                name="username"
                value={registerData.username}
                onChange={handleRegisterChange}
                placeholder="用户名（可选，默认手机号）"
                disabled={loading}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <input
                type="password"
                name="password"
                value={registerData.password}
                onChange={handleRegisterChange}
                placeholder="请输入密码（至少6位）"
                disabled={loading}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <input
                type="password"
                name="confirmPassword"
                value={registerData.confirmPassword}
                onChange={handleRegisterChange}
                placeholder="请再次输入密码"
                disabled={loading}
                className="form-input"
              />
            </div>

            <button
              type="submit"
              className="login-button"
              disabled={loading}
            >
              {loading ? '注册中...' : '确认注册'}
            </button>
          </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;
