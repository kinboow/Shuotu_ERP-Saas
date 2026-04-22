# SHEIN平台API接口文档

## 概述

本文档描述了SHEIN平台同步服务的所有API接口，基于SHEIN开放平台官方API实现。

## 基础配置

### 环境域名
- 测试环境: `https://openapi-test01.sheincorp.cn`
- 生产环境(传统/自运营/半托管): `https://openapi.sheincorp.com`
- 生产环境(全托管/SHEIN自营): `https://openapi.sheincorp.cn`

### 认证方式
SHEIN使用HMAC-SHA256签名认证，需要以下凭证：
- `openKeyId`: 店铺级访问标识
- `secretKey`: 店铺级密钥（需解密）
- `appId`: 应用ID
- `appSecret`: 应用密钥

---

## 授权相关

### 生成授权URL
```
POST /api/shein/auth/url
```
**请求参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| appId | string | 是 | 应用ID |
| redirectUrl | string | 是 | 回调地址 |
| state | string | 是 | 自定义状态参数 |
| isTest | boolean | 否 | 是否测试环境 |

### 授权回调处理
```
POST /api/shein/auth/callback
```
**请求参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| tempToken | string | 是 | 临时Token |
| appId | string | 是 | 应用ID |
| appSecret | string | 是 | 应用密钥 |
| isTest | boolean | 否 | 是否测试环境 |

---

## 商品分类

### 获取分类树
```
POST /api/shein/categories
```
**请求参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| shopId | number | 是 | 店铺ID |

### 获取商品属性模板
```
POST /api/shein/attributes
```
**请求参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| shopId | number | 是 | 店铺ID |
| productTypeIds | array | 是 | 商品类型ID列表 |

### 获取发布规范
```
POST /api/shein/publish-standard
```
**请求参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| shopId | number | 是 | 店铺ID |
| categoryId | number | 否 | 分类ID |
| spuName | string | 否 | SPU编码 |

---

## 商品管理

### 获取商品列表
```
POST /api/shein/products
```
**请求参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| shopId | number | 是 | 店铺ID |
| pageNum | number | 否 | 页码，默认1 |
| pageSize | number | 否 | 每页数量，默认50，最大50 |
| insertTimeStart | string | 否 | 上新开始时间 |
| insertTimeEnd | string | 否 | 上新结束时间 |

### 获取商品详情
```
POST /api/shein/product-detail
```
**请求参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| shopId | number | 是 | 店铺ID |
| spuName | string | 是 | SPU编码 |
| languageList | array | 否 | 语种列表，默认['zh-cn'] |

### 发布/编辑商品
```
POST /api/shein/publish-product
```
**请求参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| shopId | number | 是 | 店铺ID |
| productData | object | 是 | 商品数据(参考SHEIN官方文档) |

### 图片链接转换
```
POST /api/shein/transform-image
```
**请求参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| shopId | number | 是 | 店铺ID |
| imageUrl | string | 是 | 原始图片URL |
| imageType | number | 是 | 图片类型: 1主图 2细节图 5方块图 6色块图 7详情图 |

### 图文识别推荐类目
```
POST /api/shein/suggest-category
```
**请求参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| shopId | number | 是 | 店铺ID |
| url | string | 否 | 图片URL |
| productInfo | string | 否 | 商品文案信息 |

### 商品打印条码
```
POST /api/shein/print-barcode
```
**请求参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| shopId | number | 是 | 店铺ID |
| data | array | 是 | 打印数据列表 |

### 查询SKU销量
```
POST /api/shein/sku-sales
```
**请求参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| shopId | number | 是 | 店铺ID |
| skuCodeList | array | 是 | SKU编码列表，最多100个 |

---

## 采购单管理

### 获取采购单列表
```
POST /api/shein/purchase-orders
```
**请求参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| shopId | number | 是 | 店铺ID |
| orderNos | string/array | 否 | 采购单号，最多200个 |
| type | number | 否 | 订单类型: 1急采 2备货 |
| combineTimeStart | string | 否 | 下发时间开始 |
| combineTimeEnd | string | 否 | 下发时间结束 |
| updateTimeStart | string | 否 | 更新时间开始 |
| updateTimeEnd | string | 否 | 更新时间结束 |
| pageNumber | number | 否 | 页码 |
| pageSize | number | 否 | 每页数量，最大200 |

### 创建备货单
```
POST /api/shein/create-stock-order
```
**请求参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| shopId | number | 是 | 店铺ID |
| paramList | array | 是 | 备货参数列表 |

### 查询备货单审核列表
```
POST /api/shein/review-orders
```

### 查询商品备货信息
```
POST /api/shein/stock-goods-list
```

### JIT母单子单关系查询
```
POST /api/shein/jit-orders
```
**请求参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| shopId | number | 是 | 店铺ID |
| orderNos | string/array | 是 | 订单号，最多200个 |
| selectJitMother | number | 是 | 1查母单 2查子单 |

---

## 库存管理

### 查询库存
```
POST /api/shein/inventory
```
**请求参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| shopId | number | 是 | 店铺ID |
| skuCodeList | array | 否 | SKU列表(三选一) |
| skcNameList | array | 否 | SKC列表(三选一) |
| spuNameList | array | 否 | SPU列表(三选一) |
| warehouseType | string | 是 | 仓库类型: 1SHEIN仓 2半托管虚拟库存 3全托管虚拟库存 |

---

## 发货管理

### 获取发货基本信息
```
POST /api/shein/shipping-basic
```
**请求参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| shopId | number | 是 | 店铺ID |
| orderType | number | 是 | 订单类型: 1急采 2备货 |
| addressId | number | 否 | 发货地址ID |

### 查询发货单列表
```
POST /api/shein/delivery-list
```
**请求参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| shopId | number | 是 | 店铺ID |
| deliveryCode | string | 否 | 发货单号 |
| startTime | string | 否 | 开始时间 |
| endTime | string | 否 | 结束时间 |
| page | number | 否 | 页码 |
| perPage | number | 否 | 每页数量，最大200 |

---

## 财务管理

### 查询报账单列表
```
POST /api/shein/report-list
```
**请求参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| shopId | number | 是 | 店铺ID |
| addTimeStart | string | 否 | 生成时间开始(与更新时间二选一) |
| addTimeEnd | string | 否 | 生成时间结束 |
| lastUpdateTimeStart | string | 否 | 更新时间开始 |
| lastUpdateTimeEnd | string | 否 | 更新时间结束 |
| settlementStatuses | array | 否 | 结算状态: 1待确认 2待结算 3已结算 |
| page | number | 是 | 页码 |
| perPage | number | 是 | 每页数量，最大200 |

### 查询报账单销售款明细
```
POST /api/shein/report-sales-detail
```
**请求参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| shopId | number | 是 | 店铺ID |
| reportOrderNo | string | 是 | 报账单号 |
| perPage | number | 是 | 每页数量，最大200 |
| query | string | 否 | 分页查询参数 |

### 查询报账单补扣款明细
```
POST /api/shein/report-adjustment-detail
```

---

## 数据同步到数据库

### 同步采购单
```
POST /api/shein/sync/purchase-orders
```
将采购单数据同步到本地数据库。

### 同步商品
```
POST /api/shein/sync/products
```
将商品数据同步到本地数据库。

### 同步报账单
```
POST /api/shein/sync/reports
```
将报账单数据同步到本地数据库。

### 同步库存
```
POST /api/shein/sync/inventory
```
将库存数据同步到本地数据库。

### 全量同步
```
POST /api/shein/sync/all
```
同步所有数据到本地数据库。

---

## 采购单状态说明

| 状态码 | 状态名称 | 说明 |
|--------|----------|------|
| 1 | 待下单 | 订单待处理 |
| 2 | 已下单 | 订单已下发给商家 |
| 3 | 发货中 | 商家正在发货 |
| 4 | 已送货 | 商家已发货 |
| 5 | 已收货 | SHEIN仓库已收货 |
| 6 | 已查验 | 质检完成 |
| 7 | 已退货 | 订单已退货 |
| 8 | 已完成 | 订单完成 |
| 9 | 无货下架 | 商品无货 |
| 10 | 已作废 | 订单作废 |
| 11 | 待审核 | 等待审核 |
| 12 | 分单中 | 订单分单处理中 |
| 13 | 待退货 | 等待退货 |

---

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| 0 | 成功 |
| openapi00006 | 触发限流 |
| openapi00007 | 签名错误 |
| -1 | 业务错误(查看msg) |

---

## 限流规则

- 商品列表: 100次/秒
- 商品发布: 40次/秒
- 图片转换: 60次/秒
- 采购单查询: 50次/秒
- 库存查询: 无限制
- 报账单查询: 无限制
