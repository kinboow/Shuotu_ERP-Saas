# Webhook微服务

用于接收多平台的Webhook通知，支持SSL/HTTPS。

## 📚 文档导航

- **[快速开始 (QUICKSTART.md)](./QUICKSTART.md)** - 5分钟快速启动指南
- **[部署指南 (DEPLOYMENT.md)](./DEPLOYMENT.md)** - 生产环境完整部署步骤
- **[本文档 (README.md)](./README.md)** - 详细功能说明和API文档

## 工作原理

Webhook是平台服务器主动推送通知到我们本地微服务的机制：

```
┌─────────────────┐                    ┌──────────────────────┐
│  SHEIN平台      │                    │  我们的服务器         │
│                 │                    │                      │
│  事件发生:      │                    │  Webhook微服务       │
│  - 发货单变更   │  ──POST请求──>    │  :8678 (HTTPS)       │
│  - 采购单状态   │  (加密+签名)       │  :8080 (HTTP)        │
│  - 授权变更     │                    │                      │
│  ...            │                    │  ↓ 验签、解密        │
└─────────────────┘                    │  ↓ 业务处理          │
                                       │  ↓ 同步数据库        │
                                       └──────────────────────┘
```

**关键点：**
- SHEIN服务器是**主动方**，我们的微服务是**被动接收方**
- 需要在SHEIN平台配置我们的公网回调地址
- 数据经过AES加密和HMAC-SHA256签名，确保安全性
- 我们的服务收到请求后立即返回200，然后异步处理业务逻辑

## 平台回调地址配置

需要在各平台后台配置我们的回调地址（必须是公网可访问的地址）：

| 平台 | 回调地址 | 状态 |
|------|---------|------|
| SHEIN全托管 | `https://your-domain:8678/shein-full/callback` | ✅ 已实现 |
| TEMU | `https://your-domain:8678/temu/callback` | 🚧 待实现 |
| TIKTOK | `https://your-domain:8678/tiktok/callback` | 🚧 待实现 |

**示例（假设公网域名是 erp.example.com）：**
- SHEIN全托管: `https://erp.example.com:8678/shein-full/callback`
- TEMU: `https://erp.example.com:8678/temu/callback`
- TIKTOK: `https://erp.example.com:8678/tiktok/callback`

**注意事项：**
- 回调地址必须是公网可访问的（需要配置域名、端口映射、防火墙等）
- 建议使用HTTPS（端口8678）以确保数据安全
- 本地开发可以使用内网穿透工具（如ngrok、frp）进行测试

## 安装

```bash
cd services/webhook
npm install
```

## SSL证书配置

### 开发环境（自签名证书）

```bash
cd ssl
generate-cert.bat
```

### 生产环境

将正式的SSL证书文件放置到 `ssl/` 目录：
- `server.key` - 私钥文件
- `server.crt` - 证书文件

## 环境变量

在 `services/.env` 中添加：

```env
# Webhook服务端口
WEBHOOK_HTTPS_PORT=8443
WEBHOOK_HTTP_PORT=8080

# SHEIN全托管配置
SHEIN_FULL_APP_ID=your_app_id
SHEIN_FULL_APP_SECRET_KEY=your_app_secret_key

# TEMU配置
TEMU_APP_KEY=
TEMU_APP_SECRET=

# TIKTOK配置
TIKTOK_APP_KEY=
TIKTOK_APP_SECRET=
```

## 启动

```bash
npm start
```

## SHEIN全托管支持的事件

通过header中的 `x-lt-eventCode` 自动识别事件类型：

| 事件码 | 说明 | 适用模式 |
|-------|------|---------|
| delivery_modify_notice | 发货单变更通知 | 全托管 |
| purchase_order_notice | 采购单通知 | 全托管/POP |
| authorization_change_notice | 店铺授权变更通知 | 全部 |
| product_shelves_notice | 商品上下架通知 | 自运营/半托管/POP |
| product_document_audit_status_notice | 商品审核通知 | 全部 |
| product_document_audit_status_notice_all_channels | 商品审核通知(全渠道) | 全部 |
| product_document_receive_status_notice | 商品接收通知 | 全部 |
| product_price_audit_status_notice | 商品涨价审批通知 | - |
| product_prices_abnormal_notice | 商品价格异常通知 | 自运营/POP |
| product_quota_change_notice | 商品额度变动通知 | 全部 |
| inventory_warning_notice | SKU库存预警通知 | 自运营 |
| out_of_stock_notice | 缺货需求库存通知 | - |
| product_compliance_change_notice | 商品合规信息失效通知 | 全部 |
| order_push_notice | 订单同步通知 | 自运营/半托管 |
| return_order_push_notice | 退货单同步通知 | - |
| logistics_order_result_notice | 物流单下单通知 | - |
| invoice_status_notice | CTE开票通知 | - |

## SHEIN平台IP白名单

```
120.24.77.228, 8.129.229.113, 8.129.226.74, 8.129.9.82, 8.129.7.84
47.106.180.122, 120.79.71.235, 47.112.201.95, 47.112.17.164, 47.106.77.136
8.138.164.6, 8.134.140.235, 8.219.56.57, 8.219.138.159, 47.244.123.114
8.210.12.12, 52.34.71.36, 44.229.47.182, 52.40.22.133, 34.208.2.54
52.37.43.177, 100.20.197.247, 52.21.82.95, 44.218.161.133
```

## 目录结构

```
webhook/
├── src/
│   ├── index.js
│   ├── routes/platforms/
│   │   ├── shein-full.js
│   │   ├── temu.js
│   │   └── tiktok.js
│   └── utils/
│       └── shein-crypto.js
├── ssl/
├── package.json
└── README.md
```


## 测试

### 1. 签名算法测试

验证签名算法是否正确实现（使用SHEIN官方文档示例数据）：

```bash
node test-signature.js
```

预期输出：
```
✅ 签名算法正确！
✅ 验签通过
```

### 2. 完整Webhook测试

启动webhook服务后，运行测试脚本**模拟SHEIN服务器**发送webhook到我们的微服务：

```bash
# 终端1：启动webhook服务（模拟我们的服务器）
npm start

# 终端2：运行测试（模拟SHEIN服务器发送POST请求）
node test-webhook.js
```

测试脚本会模拟SHEIN服务器发送以下事件：
- 发货单变更通知 (delivery_modify_notice)
- 采购单通知 (purchase_order_notice)
- 店铺授权变更通知 (authorization_change_notice)

**流程说明：**
```
test-webhook.js (模拟SHEIN服务器)
    ↓ POST请求
localhost:8080/shein-full/callback (我们的Webhook微服务)
    ↓ 验签、解密、处理
业务逻辑处理
```

### 3. 生产环境部署测试

部署到生产环境后，需要：

1. **配置公网访问**
   - 确保服务器有公网IP或域名
   - 配置防火墙开放端口8678（HTTPS）和8080（HTTP）
   - 配置Nginx反向代理（可选）

2. **在SHEIN平台配置回调地址**
   - 登录SHEIN开放平台
   - 在应用设置中配置Webhook回调地址
   - 例如：`https://erp.example.com:8678/shein-full/callback`

3. **验证接收**
   - 在SHEIN平台触发测试事件
   - 查看webhook服务日志确认收到请求
   - 检查签名验证和数据解密是否成功

### 4. 内网穿透测试（本地开发）

如果需要在本地测试真实的SHEIN webhook推送，可以使用内网穿透工具：

```bash
# 使用ngrok（示例）
ngrok http 8080

# 将ngrok提供的公网地址配置到SHEIN平台
# 例如：https://abc123.ngrok.io/shein-full/callback
```

## 签名验证说明

SHEIN Webhook使用以下签名算法（严格按照官方文档实现）：

1. **组装签名数据VALUE**: `openKeyId + "&" + timestamp + "&" + path`
2. **组装签名密钥KEY**: `secretKey + randomKey`
3. **HMAC-SHA256加密**: 对VALUE使用KEY进行HMAC-SHA256加密，得到字节数组
4. **转十六进制**: 将字节数组转换为十六进制字符串
5. **Base64编码**: 对十六进制字符串进行Base64编码
6. **拼接RandomKey**: `randomKey + Base64String`

**注意事项：**
- Webhook验签使用 `appid + appSecretKey`，而不是供应商的 `openKey + secretKey`
- 数据使用AES-128-CBC加密，IV默认为 `space-station-default-iv` 的前16字节
- 请求体格式为 `application/x-www-form-urlencoded`，参数名为 `eventData`
- SHEIN要求返回2xx状态码表示成功，建议异步处理避免超时

## 响应格式说明

根据SHEIN官方文档：
> **SHEIN会发送POST请求到您的回调地址，以验证您的回调地址可用，您必须返回code为2XX（200，201等）才会通过校验**

### POST请求响应
SHEIN通过POST请求进行：
1. **验证回调地址可用性** - 必须返回2xx状态码才能通过校验
2. **推送事件通知** - 必须返回2xx状态码表示接收成功

- **状态码**: 200
- **响应体**: `'true'`

**处理流程：**
1. 收到webhook请求
2. 验签和解密（同步）
3. 立即返回200状态码
4. 异步处理业务逻辑（避免超时）

**响应规则：**
- 成功接收：返回 `200 + 'true'`
- 处理出错：返回 `500 + 'false'`（SHEIN会重试）

## 重试机制

SHEIN平台的重试策略：
- **非订单消息**: 重试1次
- **订单事件**: 重试2次
- **重试时间**: 第一次重试约30分钟至1小时之间

## 故障排查

### 签名验证失败
1. 检查 `SHEIN_FULL_APP_ID` 和 `SHEIN_FULL_APP_SECRET_KEY` 是否正确
2. 确认使用的是appid而不是openKeyId
3. 运行 `node test-signature.js` 验证签名算法

### 解密失败
1. 检查 `SHEIN_FULL_APP_SECRET_KEY` 是否正确
2. 确认密钥长度至少16字节
3. 检查IV是否为默认值 `space-station-default-iv`

### 无法接收webhook
1. 检查防火墙是否开放端口（8080/8443）
2. 确认SHEIN平台配置的回调地址正确
3. 检查服务器IP是否在SHEIN白名单中
4. 查看服务日志确认请求是否到达
