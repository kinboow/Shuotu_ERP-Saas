# 已删除的平台API功能清单

本文档记录了从路由文件中删除的所有平台API调用功能，这些功能需要后续重新实现并放入 `api_Interface_Function` 文件夹。

## 删除日期：2025-12-01

---

## 1. stockOrders.js - 备货订单路由

| 序号 | 功能名称 | 路由路径 | HTTP方法 | API路径 | 状态 |
|------|----------|----------|----------|---------|------|
| 1 | 查询JIT母单子单关系 | /api/stock-orders/jit-relations | POST | /open-api/order/get-mothe-child-orders | 已删除 |
| 2 | 同步采购单 | /api/stock-orders/sync | POST | /open-api/order/purchase-order-infos | ✅已实现 |
| 3 | 批量获取SKC尺码 | /api/stock-orders/batch-skc-size | POST | /open-api/goods/batch-skc-size | 已删除 |

**保留功能**：本地数据库的CRUD操作（获取列表、创建、更新、删除、批量导入）

---

## 2. sheinOrders.js - SHEIN订单路由

| 序号 | 功能名称 | 路由路径 | HTTP方法 | API路径 | 状态 |
|------|----------|----------|----------|---------|------|
| 1 | 同步SHEIN采购单 | /api/shein-orders/sync/:shopId | POST | /open-api/order/purchase-order-infos | 已删除 |
| 2 | 获取采购单详情 | /api/shein-orders/detail/:shopId/:orderNo | GET | /open-api/order/purchase-order-infos | 已删除 |
| 3 | 查询JIT母单子单关系 | /api/shein-orders/jit/:shopId | GET | /open-api/order/get-mothe-child-orders | 已删除 |

---

## 3. sheinProducts.js - SHEIN商品路由

| 序号 | 功能名称 | 路由路径 | HTTP方法 | API路径 | 状态 |
|------|----------|----------|----------|---------|------|
| 1 | 查询商品列表 | /api/shein-products/query | POST | /open-api/openapi-business-backend/product/query | 已删除 |
| 2 | 获取SPU详情 | /api/shein-products/spu-info | POST | /open-api/goods/spu-info | 已删除 |
| 3 | 同步商品到本地 | /api/shein-products/sync | POST | /open-api/goods/spu-info | 已删除 |
| 4 | 批量同步商品 | /api/shein-products/batch-sync | POST | 多个API | 已删除 |

**保留功能**：本地数据库查询（/local、/local/:id、/clear-cache）

---

## 4. sheinSync.js - SHEIN同步路由

| 序号 | 功能名称 | 路由路径 | HTTP方法 | API路径 | 状态 |
|------|----------|----------|----------|---------|------|
| 1 | 查询并同步商品 | /api/shein-sync/query-and-sync | POST | /open-api/openapi-business-backend/product/query, /open-api/goods/spu-info | 已删除 |
| 2 | 批量同步数据 | /api/shein-sync/batch | POST | 多个API（商品、订单、库存、财务） | 已删除 |

**保留功能**：同步状态查询（/status/:taskId、/active）

---

## 5. sheinFinance.js - SHEIN财务路由

| 序号 | 功能名称 | 路由路径 | HTTP方法 | API路径 | 状态 |
|------|----------|----------|----------|---------|------|
| 1 | 查询对账单列表 | /api/shein-finance/check-orders | POST | /open-api/finance/get-check-order-list | 已删除 |
| 2 | 查询对账单详情 | /api/shein-finance/check-order-detail | GET | /open-api/finance/get-check-order-detail | 已删除 |
| 3 | 获取对账单统计 | /api/shein-finance/check-orders-summary | POST | 内部调用check-orders | 已删除 |

---

## 6. sheinFinanceNew.js - SHEIN财务新版路由

| 序号 | 功能名称 | 路由路径 | HTTP方法 | API路径 | 状态 |
|------|----------|----------|----------|---------|------|
| 1 | 查询报账单列表 | /api/shein-finance/report-list | POST | /open-api/finance/report-list | 已删除 |
| 2 | 查询销售款详情 | /api/shein-finance/report-sales-detail | POST | /open-api/finance/report-sales-detail | 已删除 |
| 3 | 查询补扣款详情 | /api/shein-finance/report-adjustment-detail | POST | /open-api/finance/report-adjustment-detail | 已删除 |
| 4 | 自动同步财务数据 | /api/shein-finance/auto-sync | POST | 多个API | 已删除 |

**保留功能**：同步进度查询（/sync-progress/:syncId）

---

## 7. skuSales.js - SKU销量路由

| 序号 | 功能名称 | 路由路径 | HTTP方法 | API路径 | 状态 |
|------|----------|----------|----------|---------|------|
| 1 | 查询SKU销量 | /api/sku-sales/query | POST | /open-api/goods/spu-info, /open-api/goods/query-sku-sales | 已删除 |

---

## 8. createStockOrder.js - 创建备货单路由

| 序号 | 功能名称 | 路由路径 | HTTP方法 | API路径 | 状态 |
|------|----------|----------|----------|---------|------|
| 1 | 创建备货单 | /api/create-stock-order | POST | /open-api/idms/create-order | 已删除 |

---

## 9. sheinApi.js - SHEIN API代理路由

| 序号 | 功能名称 | 路由路径 | HTTP方法 | API路径 | 状态 |
|------|----------|----------|----------|---------|------|
| 1 | API代理 | /api/shein-api/proxy | POST | 动态路径 | 已删除 |

---

## 10. deliveryOrders.js - 发货单路由

| 序号 | 功能名称 | 路由路径 | HTTP方法 | API路径 | 状态 |
|------|----------|----------|----------|---------|------|
| 1 | 同步发货单 | /api/delivery-orders/sync | POST | /open-api/shipping/delivery | 已删除 |

**保留功能**：本地数据库查询（获取发货单列表）

---

## 11. inventory.js - 库存路由

| 序号 | 功能名称 | 路由路径 | HTTP方法 | API路径 | 状态 |
|------|----------|----------|----------|---------|------|
| 1 | 查询库存 | /api/inventory/query | POST | /open-api/stock/stock-query | 已删除 |
| 2 | 同步在线商品库存 | /api/inventory/sync-online-products | POST | /open-api/stock/stock-query | 已删除 |

---

## 12. reviewOrders.js - 备货单审核路由

| 序号 | 功能名称 | 路由路径 | HTTP方法 | API路径 | 状态 |
|------|----------|----------|----------|---------|------|
| 1 | 获取备货单审核列表 | /api/review-orders | POST | /open-api/idms/review-orders | 已删除 |

---

## 13. platforms.js - 平台管理路由

| 序号 | 功能名称 | 路由路径 | HTTP方法 | API路径 | 状态 |
|------|----------|----------|----------|---------|------|
| 1 | 同步平台订单 | /api/platforms/:id/sync-orders | POST | Amazon/Shopify API | 已删除 |

**保留功能**：获取平台列表、添加平台连接

---

## 未删除的路由（保留原有功能）

以下路由文件不涉及平台API调用或为授权功能，保持不变：

| 路由文件 | 说明 |
|----------|------|
| sheinAuth.js | **平台授权功能**，必须保留 |
| sheinProductList.js | 本地数据库操作，不涉及API调用 |
| erpProducts.js | ERP商品管理（本地数据库操作） |
| auth.js | 用户认证 |
| complianceLabel.js | 合规标签 |
| erpProducts.js | ERP商品 |
| financeRecords.js | 财务记录 |
| imageUpload.js | 图片上传 |
| labelMaterials.js | 标签材料 |
| logistics.js | 物流 |
| orders.js | 订单 |
| pda.js | PDA |
| platformConfigs.js | 平台配置 |
| products.js | 商品 |
| publishDrafts.js | 发布草稿 |
| publishRecords.js | 发布记录 |
| remotePrint.js | 远程打印 |
| suppliers.js | 供应商 |
| withdrawals.js | 提现 |

---

## 统计汇总

| 类别 | 数量 |
|------|------|
| 已删除的API功能 | 23个 |
| 涉及的路由文件 | 13个 |
| 保留的路由文件 | 17个 |

---

## 已实现的功能模块

功能模块文件位于 `backend/api_comprehensive/` 文件夹

| 文件名 | 功能 | 调用入口 | 状态 |
|--------|------|----------|------|
| SHEIN全托管_SHEIN自营_SHEINPOP_订单_同步采购单.js | 同步采购单 | 导航栏"同步数据"按钮 → 勾选"采购单" → /api/shein-sync/batch | ✅已实现 |

---

## 后续工作

1. **功能模块化**：为每个已删除的功能创建独立的功能模块文件
2. **文件命名规则**：`平台名_功能分类_功能名.js`
3. **路由重连**：修改路由文件调用功能模块
4. **测试验证**：确保功能正常工作

---

## 说明

- 所有已删除的路由现在返回 `{ success: false, message: '功能开发中：xxx' }`
- 本地数据库操作功能保持不变
- 平台授权功能（sheinAuth.js）完整保留
