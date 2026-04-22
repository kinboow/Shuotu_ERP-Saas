# Webhook微服务更新日志

## 2024-12-04 - 按照SHEIN官方文档重构

### ✅ 签名算法修正

严格按照SHEIN官方文档实现签名算法：

1. **VALUE组装**: `openKeyId + "&" + timestamp + "&" + path`
2. **KEY组装**: `secretKey + randomKey`
3. **HMAC-SHA256**: 对VALUE使用KEY进行加密
4. **转十六进制**: 将字节数组转换为十六进制字符串
5. **Base64编码**: 对十六进制字符串进行Base64编码（关键修正点）
6. **拼接RandomKey**: `randomKey + Base64String`

**关键修正**: 之前是对字节数组进行Base64编码，现在改为对十六进制字符串进行Base64编码。

### ✅ 验证测试

创建 `test-signature.js` 使用官方文档示例数据验证：
- 输入: OpenKeyId, SecretKey, Path, Timestamp, RandomKey
- 预期输出: `test1ZDZjYTJjNzg5ZjUzMDdkZTU2N2Y3NzcxN2ZjZjA5OGIxMTRhZWI0MTU1MzQxNjZlNjFkMGQxOTJiYTk1YWNjYQ==`
- 测试结果: ✅ 通过

### ✅ Webhook测试脚本

创建 `test-webhook.js` 模拟SHEIN服务器发送webhook：
- 模拟发货单变更通知
- 模拟采购单通知
- 模拟店铺授权变更通知
- 包含完整的加密和签名流程

### ✅ 文档完善

1. **README.md** - 添加工作原理图、测试说明、故障排查
2. **QUICKSTART.md** - 5分钟快速启动指南
3. **DEPLOYMENT.md** - 生产环境完整部署指南
4. **CHANGELOG.md** - 本更新日志

### ✅ 配置文件更新

更新 `services/.env.example`：
```env
# SHEIN全托管Webhook配置
SHEIN_FULL_APP_ID=your_app_id
SHEIN_FULL_APP_SECRET_KEY=your_app_secret_key

# Webhook服务端口
WEBHOOK_HTTPS_PORT=8678
WEBHOOK_HTTP_PORT=8080
```

### ✅ 代码优化

1. 移除调试日志，保留关键日志
2. 统一错误信息前缀为 `[SHEIN加密]`
3. 优化注释，说明每个步骤对应的官方文档
4. 确保form-data格式正确解析

### 📋 支持的事件类型（17种）

| 事件码 | 说明 | 状态 |
|-------|------|------|
| delivery_modify_notice | 发货单变更通知 | ✅ |
| purchase_order_notice | 采购单通知 | ✅ |
| authorization_change_notice | 店铺授权变更通知 | ✅ |
| product_shelves_notice | 商品上下架通知 | ✅ |
| product_document_audit_status_notice | 商品审核通知 | ✅ |
| product_document_audit_status_notice_all_channels | 商品审核通知（全渠道） | ✅ |
| product_document_receive_status_notice | 商品接收通知 | ✅ |
| product_price_audit_status_notice | 商品涨价审批结果通知 | ✅ |
| product_prices_abnormal_notice | 商品价格异常通知 | ✅ |
| product_quota_change_notice | 商品额度变动通知 | ✅ |
| inventory_warning_notice | SKU库存预警通知 | ✅ |
| out_of_stock_notice | 推送缺货需求库存数 | ✅ |
| product_compliance_change_notice | 商品合规信息失效通知 | ✅ |
| order_push_notice | 订单同步通知 | ✅ |
| return_order_push_notice | 退货单同步通知 | ✅ |
| logistics_order_result_notice | SHEIN合作物流单下单通知 | ✅ |
| invoice_status_notice | CTE开票通知 | ✅ |

### 🔧 技术细节

**签名验证**:
- 使用 `x-lt-appid` 和 `SHEIN_FULL_APP_SECRET_KEY`
- 不是使用 `x-lt-openKeyId` 和供应商secretKey
- 从签名中提取前5位randomKey进行验证

**数据解密**:
- 算法: AES-128-CBC
- IV: `space-station-default-iv` 的前16字节
- 密钥: `SHEIN_FULL_APP_SECRET_KEY` 的前16字节
- 输入: Base64编码的密文
- 输出: JSON字符串

**请求格式**:
- Content-Type: `application/x-www-form-urlencoded`
- 参数名: `eventData`
- 参数值: Base64编码的加密数据

### 🎯 下一步计划

- [ ] 实现与sync-engine的集成，自动触发数据同步
- [ ] 添加webhook事件日志记录到数据库
- [ ] 实现webhook重试机制（如果业务处理失败）
- [ ] 添加webhook事件统计和监控
- [ ] 实现TEMU和TIKTOK平台的webhook支持

### 📝 注意事项

1. **公网访问**: Webhook必须部署在公网可访问的服务器上
2. **HTTPS推荐**: 生产环境强烈建议使用HTTPS
3. **IP白名单**: 建议配置SHEIN平台IP白名单
4. **异步处理**: 收到webhook后立即返回200，业务逻辑异步处理
5. **重试机制**: SHEIN会重试失败的webhook（非订单1次，订单2次）

### ✅ 响应格式修正

根据SHEIN官方Java示例代码，修改响应格式：
- **修改前**: 返回JSON对象 `{ success: true, message: 'received' }`
- **修改后**: 返回字符串 `'true'`
- **原因**: 严格按照官方Java示例，返回boolean值表示是否成功接收
- **状态码**: 始终返回200（即使验签或解密失败）

### 🐛 已知问题

无

### 🙏 参考文档

- SHEIN Webhook说明文档
- SHEIN签名计算方法
- SHEIN开放平台API文档
