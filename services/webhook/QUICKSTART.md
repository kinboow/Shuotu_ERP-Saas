# Webhook微服务快速启动指南

## 5分钟快速开始

### 1. 安装依赖（首次运行）

```bash
cd services/webhook
npm install
```

### 2. 配置环境变量

编辑 `services/.env` 文件，添加SHEIN配置：

```env
# SHEIN全托管Webhook配置
SHEIN_FULL_APP_ID=你的APP_ID
SHEIN_FULL_APP_SECRET_KEY=你的APP_SECRET_KEY
```

### 3. 启动服务

```bash
npm start
```

看到以下输出表示启动成功：

```
========================================
  Webhook微服务启动
========================================

[HTTPS] 服务已启动: https://localhost:8678
[HTTP]  服务已启动: http://localhost:8080

[平台回调地址]
  SHEIN全托管: /shein-full/callback
  TEMU:        /temu/callback
  TIKTOK:      /tiktok/callback
```

### 4. 测试验证

#### 测试1：验证签名算法

```bash
node test-signature.js
```

预期输出：
```
✅ 签名算法正确！
✅ 验签通过
```

#### 测试2：模拟SHEIN服务器发送webhook

打开新终端，运行：

```bash
node test-webhook.js
```

预期输出：
```
[测试1] 发货单变更通知
✅ 测试通过

[测试2] 采购单通知
✅ 测试通过

[测试3] 店铺授权变更通知
✅ 测试通过
```

同时在服务端终端可以看到接收到的webhook请求日志。

### 5. 生产环境部署

参考 [DEPLOYMENT.md](./DEPLOYMENT.md) 进行完整部署。

## 常见问题

### Q: 如何获取SHEIN的APP_ID和APP_SECRET_KEY？
A: 登录SHEIN开放平台 (https://open.sheincorp.com)，在应用管理中查看。

### Q: 本地开发如何测试真实的SHEIN webhook？
A: 使用内网穿透工具（如ngrok）将本地服务暴露到公网，然后在SHEIN平台配置该地址。

### Q: 为什么需要公网地址？
A: 因为SHEIN服务器需要主动POST请求到我们的服务，所以必须是公网可访问的地址。

### Q: 可以只使用HTTP不用HTTPS吗？
A: 开发测试可以，但生产环境强烈建议使用HTTPS确保数据安全。

### Q: 签名验证失败怎么办？
A: 
1. 确认使用的是APP_ID和APP_SECRET_KEY（不是openKey和secretKey）
2. 运行 `node test-signature.js` 验证算法是否正确
3. 检查环境变量配置是否正确

## 下一步

- 📖 阅读 [README.md](./README.md) 了解详细功能
- 🚀 阅读 [DEPLOYMENT.md](./DEPLOYMENT.md) 了解生产部署
- 🔧 根据业务需求修改事件处理函数（在 `src/routes/platforms/shein-full.js` 中）

## 支持的事件类型

当前已实现17种SHEIN事件的接收和分发：

- ✅ 发货单变更通知
- ✅ 采购单通知
- ✅ 店铺授权变更通知
- ✅ 商品上下架通知
- ✅ 商品审核通知
- ✅ 库存预警通知
- ✅ 订单同步通知
- ✅ 退货单通知
- ... 等17种事件

每个事件都有对应的处理函数，可以根据业务需求进行扩展。
