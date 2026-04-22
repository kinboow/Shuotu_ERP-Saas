# SSL/HTTPS 配置与使用文档

## 📋 目录

1. [概述](#概述)
2. [SSL证书文件位置](#ssl证书文件位置)
3. [各服务SSL配置详解](#各服务ssl配置详解)
4. [SSL证书生成](#ssl证书生成)
5. [环境变量配置](#环境变量配置)
6. [启动流程](#启动流程)
7. [常见问题](#常见问题)

---

## 概述

本项目采用全面的HTTPS加密通信方案，所有面向公网的服务都启用了SSL/TLS加密：

### 启用HTTPS的服务

| 服务 | 端口 | 域名/地址 | 用途 |
|------|------|-----------|------|
| **Gateway (API网关)** | 5000 (HTTPS) / 5080 (HTTP) | erp.hlsd.work:5000 | 统一API入口 |
| **Frontend (前端)** | 3000 | erp.hlsd.work:3000 | Web管理界面 |
| **PDA-App (移动端)** | 3099 | 192.168.5.105:3099 | 移动端应用 |
| **Webhook服务** | 8678 (HTTPS) / 8080 (HTTP) | 192.168.5.105:8678 | 第三方平台回调 |

### SSL证书类型

- **正式证书**: Gateway使用域名证书 (`erp.hlsd.work`)
- **自签名证书**: Frontend、PDA-App、Webhook使用自签名证书（开发/内网环境）

---

## SSL证书文件位置

### 1. 项目根目录（正式域名证书）

```
项目根目录/
├── erp.hlsd.work_certificate.pem  # 域名证书（公钥）
└── erp.hlsd.work_private.key      # 域名私钥
```


**用途**: Gateway服务的HTTPS证书，用于公网访问

### 2. Gateway服务证书

```
services/gateway/ssl/
├── cert.pem  # SSL证书
└── key.pem   # 私钥
```

**用途**: Gateway服务的备用证书（通过环境变量配置）

### 3. Frontend前端证书

```
frontend/ssl/
├── cert.pem  # 自签名证书
└── key.pem   # 私钥
```

**用途**: React前端开发服务器的HTTPS证书

### 4. PDA-App移动端证书

```
pda-app/ssl/
├── cert.pem              # 自签名证书
├── key.pem               # 私钥
├── generate-cert.bat     # Windows证书生成脚本
├── generate-cert.sh      # Linux/Mac证书生成脚本
└── .gitignore            # 忽略证书文件（安全）
```

**用途**: PDA移动端应用的HTTPS证书

### 5. Webhook服务证书

```
services/webhook/ssl/
├── server.crt            # 自签名证书
├── server.key            # 私钥
└── generate-cert.bat     # 证书生成脚本
```

**用途**: 接收第三方平台（SHEIN、TEMU、TikTok）的Webhook回调

---

## 各服务SSL配置详解

### 1. Gateway (API网关) - 核心服务

#### 配置文件: `services/.env`

```env
# SSL证书路径（相对于services目录）
SSL_CERT_PATH=gateway/ssl/cert.pem
SSL_KEY_PATH=gateway/ssl/key.pem

# 启用HTTPS
HTTPS_ENABLED=true

# 端口配置
GATEWAY_PORT=5000        # HTTPS端口
HTTP_PORT=5080           # HTTP端口（内网代理用）
```

#### 实现逻辑 (`services/gateway/src/index.js`)

```javascript
const https = require('https');
const fs = require('fs');
const path = require('path');

// 证书路径解析（支持多种配置方式）
const SSL_CERT_PATH = process.env.SSL_CERT_PATH 
  ? path.resolve(servicesRoot, process.env.SSL_CERT_PATH)
  : path.resolve(projectRoot, 'erp.hlsd.work_certificate.pem');

const SSL_KEY_PATH = process.env.SSL_KEY_PATH 
  ? path.resolve(servicesRoot, process.env.SSL_KEY_PATH)
  : path.resolve(projectRoot, 'erp.hlsd.work_private.key');

// 启动HTTPS服务器
if (HTTPS_ENABLED && fs.existsSync(SSL_CERT_PATH) && fs.existsSync(SSL_KEY_PATH)) {
  const httpsOptions = {
    cert: fs.readFileSync(SSL_CERT_PATH),
    key: fs.readFileSync(SSL_KEY_PATH)
  };
  
  https.createServer(httpsOptions, app).listen(PORT, '0.0.0.0', () => {
    console.log(`HTTPS服务已启动，端口: ${PORT}`);
  });
}
```

#### 特点

- **双端口模式**: 同时启动HTTPS (5000) 和 HTTP (5080)
- **证书回退**: 优先使用配置的证书，否则使用根目录域名证书
- **灵活配置**: 通过环境变量控制是否启用HTTPS

---

### 2. Frontend (前端应用)

#### 配置文件: `frontend/.env`

```env
# HTTPS配置
PORT=3000
HTTPS=true
SSL_CRT_FILE=ssl/cert.pem
SSL_KEY_FILE=ssl/key.pem

# API地址（使用HTTPS）
REACT_APP_API_URL=https://erp.hlsd.work:5000/api
REACT_APP_OSS_URL=https://erp.hlsd.work:5000

# 开发配置
HOST=0.0.0.0
DANGEROUSLY_DISABLE_HOST_CHECK=true
```

#### 实现方式

React Scripts (Create React App) 内置支持HTTPS：

- 设置 `HTTPS=true` 启用HTTPS
- 通过 `SSL_CRT_FILE` 和 `SSL_KEY_FILE` 指定证书路径
- 自动使用指定的SSL证书启动开发服务器

#### 启动命令

```bash
cd frontend
npm start
```

访问地址: `https://erp.hlsd.work:3000`

---

### 3. PDA-App (移动端应用)

#### 配置文件: `pda-app/.env`

```env
# HTTPS配置
PORT=3099
HTTPS=true
SSL_CRT_FILE=ssl/cert.pem
SSL_KEY_FILE=ssl/key.pem

# API地址
REACT_APP_API_URL=https://erp.hlsd.work:5000

# 开发配置
HOST=0.0.0.0
DANGEROUSLY_DISABLE_HOST_CHECK=true
```

#### 实现方式

与Frontend相同，使用React Scripts的HTTPS支持。

#### 启动命令

```bash
cd pda-app
npm start
```

访问地址: `https://192.168.5.105:3099`

---

### 4. Webhook服务

#### 配置文件: `services/.env`

```env
# Webhook服务配置
WEBHOOK_HOST=192.168.5.105
WEBHOOK_HTTPS_PORT=8678
WEBHOOK_HTTP_PORT=8080
```

#### 实现逻辑 (`services/webhook/src/index.js`)

```javascript
const https = require('https');
const http = require('http');
const fs = require('fs');

const SSL_KEY_PATH = process.env.SSL_KEY_PATH || path.join(__dirname, '../ssl/server.key');
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || path.join(__dirname, '../ssl/server.crt');

// 同时启动HTTPS和HTTP服务
if (fs.existsSync(SSL_KEY_PATH) && fs.existsSync(SSL_CERT_PATH)) {
  const sslOptions = {
    key: fs.readFileSync(SSL_KEY_PATH),
    cert: fs.readFileSync(SSL_CERT_PATH)
  };

  https.createServer(sslOptions, app).listen(HTTPS_PORT);
  http.createServer(app).listen(HTTP_PORT);
}
```

#### 支持的平台回调

- **SHEIN全托管**: `https://192.168.5.105:8678/shein-full/callback`
- **TEMU**: `https://192.168.5.105:8678/temu/callback`
- **TikTok**: `https://192.168.5.105:8678/tiktok/callback`

---

## SSL证书生成

### 方法1: PDA-App证书生成（推荐）

#### Windows系统

```bash
cd pda-app/ssl
generate-cert.bat
```

#### Linux/Mac系统

```bash
cd pda-app/ssl
chmod +x generate-cert.sh
./generate-cert.sh
```

#### 生成的证书参数

```bash
openssl req -x509 -newkey rsa:2048 \
  -keyout key.pem \
  -out cert.pem \
  -days 365 \
  -nodes \
  -subj "/CN=localhost/O=PDA-App/C=CN" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:192.168.5.105"
```

**参数说明**:
- `-x509`: 生成自签名证书
- `-newkey rsa:2048`: 使用2048位RSA密钥
- `-days 365`: 证书有效期365天
- `-nodes`: 不加密私钥
- `subjectAltName`: 支持多个域名/IP（重要！）

---

### 方法2: Webhook证书生成

```bash
cd services/webhook/ssl
generate-cert.bat
```

生成步骤：
1. 生成私钥: `openssl genrsa -out server.key 2048`
2. 生成CSR: `openssl req -new -key server.key -out server.csr`
3. 生成证书: `openssl x509 -req -days 365 -in server.csr -signkey server.key -out server.crt`

---

### 方法3: 手动生成（通用）

```bash
# 生成私钥和证书（一步完成）
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes

# 或分步生成
# 1. 生成私钥
openssl genrsa -out key.pem 2048

# 2. 生成证书签名请求
openssl req -new -key key.pem -out cert.csr

# 3. 生成自签名证书
openssl x509 -req -days 365 -in cert.csr -signkey key.pem -out cert.pem
```

---

## 环境变量配置

### 全局配置 (`services/.env`)

```env
# ==================== SSL/HTTPS配置 ====================

# Gateway SSL证书路径（相对于services目录）
SSL_CERT_PATH=gateway/ssl/cert.pem
SSL_KEY_PATH=gateway/ssl/key.pem
HTTPS_ENABLED=true

# Gateway端口
GATEWAY_PORT=5000        # HTTPS端口
HTTP_PORT=5080           # HTTP端口（内网代理）

# Webhook端口
WEBHOOK_HTTPS_PORT=8678  # HTTPS端口
WEBHOOK_HTTP_PORT=8080   # HTTP端口

# ==================== 前端地址配置 ====================

# 前端HTTPS地址（用于构建授权回调URL）
FRONTEND_URL=https://erp.hlsd.work:3000

# ==================== 服务地址配置 ====================

# 所有服务通过Gateway的HTTPS地址访问
# 前端配置: REACT_APP_API_URL=https://erp.hlsd.work:5000/api
```

### Frontend配置 (`frontend/.env`)

```env
# HTTPS配置
PORT=3000
HTTPS=true
SSL_CRT_FILE=ssl/cert.pem
SSL_KEY_FILE=ssl/key.pem

# API地址（必须使用HTTPS）
REACT_APP_API_URL=https://erp.hlsd.work:5000/api
REACT_APP_OSS_URL=https://erp.hlsd.work:5000

# 开发配置
HOST=0.0.0.0
DANGEROUSLY_DISABLE_HOST_CHECK=true
```

### PDA-App配置 (`pda-app/.env`)

```env
# HTTPS配置
PORT=3099
HTTPS=true
SSL_CRT_FILE=ssl/cert.pem
SSL_KEY_FILE=ssl/key.pem

# API地址
REACT_APP_API_URL=https://erp.hlsd.work:5000

# 开发配置
HOST=0.0.0.0
DANGEROUSLY_DISABLE_HOST_CHECK=true
```

---

## 启动流程

### 1. 准备SSL证书

#### 检查证书是否存在

```bash
# 检查Gateway证书
dir services\gateway\ssl

# 检查Frontend证书
dir frontend\ssl

# 检查PDA-App证书
dir pda-app\ssl

# 检查Webhook证书
dir services\webhook\ssl
```

#### 如果证书不存在，生成证书

```bash
# 生成PDA-App证书
cd pda-app\ssl
generate-cert.bat

# 生成Webhook证书
cd services\webhook\ssl
generate-cert.bat

# Frontend和Gateway可以复制PDA-App的证书
copy pda-app\ssl\*.pem frontend\ssl\
copy pda-app\ssl\*.pem services\gateway\ssl\
```

---

### 2. 启动后端服务

```bash
cd services
start-all.bat
```

**启动顺序**:
1. Gateway (HTTPS: 5000, HTTP: 5080)
2. Sync-Engine (5001)
3. OMS (5002)
4. WMS (5003)
5. PMS (5004)
6. OSS (3001)
7. MISC (5005)
8. Webhook (HTTPS: 8678, HTTP: 8080)

**验证Gateway HTTPS**:
```bash
curl -k https://erp.hlsd.work:5000/health
```

---

### 3. 启动前端应用

#### Frontend

```bash
cd frontend
npm start
```

访问: `https://erp.hlsd.work:3000`

#### PDA-App

```bash
cd pda-app
npm start
```

访问: `https://192.168.5.105:3099`

---

### 4. 验证SSL配置

#### 检查Gateway

```bash
# HTTPS端口
curl -k https://erp.hlsd.work:5000/health

# HTTP端口（内网）
curl http://192.168.5.105:5080/health
```

#### 检查Webhook

```bash
# HTTPS端口
curl -k https://192.168.5.105:8678/health

# HTTP端口
curl http://192.168.5.105:8080/health
```

#### 浏览器访问

- Frontend: `https://erp.hlsd.work:3000`
- PDA-App: `https://192.168.5.105:3099`

**注意**: 自签名证书会显示安全警告，点击"继续访问"即可。

---

## 常见问题

### 1. 浏览器显示"不安全"警告

**原因**: 使用自签名证书，浏览器无法验证证书颁发机构。

**解决方案**:
- **开发环境**: 点击"高级" → "继续访问"
- **生产环境**: 使用正式CA签发的证书（如Let's Encrypt）

---

### 2. 证书过期

**症状**: 浏览器提示"证书已过期"

**解决方案**:
```bash
# 重新生成证书（有效期365天）
cd pda-app/ssl
generate-cert.bat

# 复制到其他服务
copy *.pem ..\..\frontend\ssl\
copy *.pem ..\..\services\gateway\ssl\
copy server.* ..\..\services\webhook\ssl\
```

---

### 3. Gateway无法启动HTTPS

**症状**: 只启动了HTTP服务，没有HTTPS

**排查步骤**:

1. 检查环境变量
```bash
# 查看services/.env
HTTPS_ENABLED=true  # 必须为true
```

2. 检查证书文件
```bash
dir services\gateway\ssl
# 应该有 cert.pem 和 key.pem
```

3. 检查证书路径
```bash
# services/.env
SSL_CERT_PATH=gateway/ssl/cert.pem
SSL_KEY_PATH=gateway/ssl/key.pem
```

4. 查看启动日志
```bash
cd services\gateway
npm start
# 查看是否有证书加载错误
```

---

### 4. 跨域问题（Mixed Content）

**症状**: HTTPS页面无法访问HTTP资源

**原因**: 浏览器安全策略禁止HTTPS页面加载HTTP内容

**解决方案**:
- 确保所有API请求使用HTTPS
- 前端配置: `REACT_APP_API_URL=https://erp.hlsd.work:5000/api`
- 不要使用 `http://` 开头的API地址

---

### 5. Webhook回调失败

**症状**: 第三方平台无法回调Webhook

**排查步骤**:

1. 检查HTTPS服务是否启动
```bash
curl -k https://192.168.5.105:8678/health
```

2. 检查防火墙
```bash
# Windows防火墙允许8678端口
netsh advfirewall firewall add rule name="Webhook HTTPS" dir=in action=allow protocol=TCP localport=8678
```

3. 检查证书
```bash
dir services\webhook\ssl
# 应该有 server.crt 和 server.key
```

4. 查看Webhook日志
```bash
cd services\webhook
npm start
# 查看是否收到回调请求
```

---

### 6. 证书主题名称不匹配

**症状**: 浏览器提示"证书主题名称不匹配"

**原因**: 证书的CN或SAN不包含访问的域名/IP

**解决方案**:

生成证书时添加SAN扩展：
```bash
openssl req -x509 -newkey rsa:2048 \
  -keyout key.pem -out cert.pem \
  -days 365 -nodes \
  -subj "/CN=erp.hlsd.work/O=ERP/C=CN" \
  -addext "subjectAltName=DNS:erp.hlsd.work,DNS:localhost,IP:192.168.5.105,IP:127.0.0.1"
```

---

### 7. Node.js无法验证自签名证书

**症状**: 后端服务间调用失败，提示证书验证错误

**临时解决方案**（仅开发环境）:
```bash
# Windows
set NODE_TLS_REJECT_UNAUTHORIZED=0

# Linux/Mac
export NODE_TLS_REJECT_UNAUTHORIZED=0
```

**正确解决方案**:

在代码中配置axios忽略证书验证：
```javascript
const axios = require('axios');
const https = require('https');

const httpsAgent = new https.Agent({
  rejectUnauthorized: false  // 仅开发环境
});

axios.get('https://erp.hlsd.work:5000/api/health', { httpsAgent });
```

---

## 安全建议

### 开发环境

✅ **可以使用**:
- 自签名证书
- `rejectUnauthorized: false`
- `DANGEROUSLY_DISABLE_HOST_CHECK=true`

### 生产环境

❌ **禁止使用**:
- 自签名证书
- 禁用证书验证
- 禁用Host检查

✅ **必须使用**:
- 正式CA签发的证书（Let's Encrypt、DigiCert等）
- 启用证书验证
- 配置正确的CORS策略
- 使用环境变量管理敏感信息

---

## 证书管理最佳实践

### 1. 证书文件权限

```bash
# Linux/Mac
chmod 600 *.key *.pem  # 私钥仅所有者可读
chmod 644 *.crt        # 证书可公开读取
```

### 2. Git忽略证书

确保 `.gitignore` 包含：
```gitignore
# SSL证书
*.pem
*.key
*.crt
*.csr
!.gitkeep
```

### 3. 证书备份

```bash
# 备份证书到安全位置
mkdir ssl-backup
copy services\gateway\ssl\*.pem ssl-backup\
copy services\webhook\ssl\server.* ssl-backup\
```

### 4. 定期更新

- 自签名证书: 每年更新
- Let's Encrypt: 每90天自动更新
- 商业证书: 按购买期限更新

---

## 总结

本项目的SSL配置特点：

1. **分层架构**: Gateway作为统一HTTPS入口，内部服务使用HTTP通信
2. **双端口模式**: 同时支持HTTPS（公网）和HTTP（内网）
3. **灵活配置**: 通过环境变量控制SSL启用/禁用
4. **证书分离**: 不同服务使用独立的证书文件
5. **开发友好**: 提供自动化证书生成脚本

**核心原则**: 
- 公网访问必须使用HTTPS
- 内网服务间通信可使用HTTP（性能优化）
- 开发环境使用自签名证书
- 生产环境使用正式CA证书

---

## 附录

### A. 完整的证书生成命令

```bash
# 生成包含多个域名/IP的证书
openssl req -x509 -newkey rsa:2048 \
  -keyout key.pem \
  -out cert.pem \
  -days 365 \
  -nodes \
  -subj "/CN=erp.hlsd.work/O=CrossBorderERP/OU=IT/C=CN/ST=Fujian/L=Xiamen" \
  -addext "subjectAltName=DNS:erp.hlsd.work,DNS:*.hlsd.work,DNS:localhost,IP:192.168.5.105,IP:127.0.0.1"
```

### B. 查看证书信息

```bash
# 查看证书详情
openssl x509 -in cert.pem -text -noout

# 查看证书有效期
openssl x509 -in cert.pem -noout -dates

# 验证证书和私钥匹配
openssl x509 -noout -modulus -in cert.pem | openssl md5
openssl rsa -noout -modulus -in key.pem | openssl md5
```

### C. 测试HTTPS连接

```bash
# 使用openssl测试
openssl s_client -connect erp.hlsd.work:5000

# 使用curl测试（忽略证书验证）
curl -k -v https://erp.hlsd.work:5000/health

# 使用curl测试（验证证书）
curl --cacert cert.pem https://erp.hlsd.work:5000/health
```

---

**文档版本**: 1.0  
**最后更新**: 2025-01-05  
**维护者**: ERP开发团队
