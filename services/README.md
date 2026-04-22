# ERP微服务架构

## 服务列表

| 服务 | 端口 | 说明 |
|------|------|------|
| gateway | 5000 | API网关（统一入口，兼容现有前端） |
| sync-engine | 5001 | 平台同步引擎 |
| oms | 5002 | 订单服务 |
| wms | 5003 | 库存服务 |
| pms | 5004 | 商品服务 |
| oss | 3001 | 文件存储服务 |
| misc | 5005 | 综合服务（用户/供应商/物流/打印/PDA） |

## 快速开始

### 1. 停止原有backend
确保原来的 `backend` 服务已停止（因为它也使用5000端口）

### 2. 安装依赖
```bash
cd services
install-all.bat
```

### 3. 配置数据库
微服务使用与原backend相同的数据库，无需创建新数据库。
在各服务目录创建 `.env` 文件：
```
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=你的密码
MYSQL_DATABASE=erp
```

### 4. 启动服务
```bash
start-all.bat
```

### 5. 前端无需修改
前端已配置连接 `localhost:5000`，网关会自动路由到各微服务。

## API路由映射

网关兼容所有现有前端API路径：

| 路径 | 转发到 | 说明 |
|------|--------|------|
| /api/auth/* | misc | 认证 |
| /api/orders/* | oms | 订单 |
| /api/stock-orders/* | oms | 采购单/备货单 |
| /api/inventory/* | wms | 库存 |
| /api/products/* | pms | 商品 |
| /api/erp-products/* | pms | ERP商品 |
| /api/platforms/* | sync-engine | 平台配置 |
| /api/shein-*/* | sync-engine | SHEIN相关 |
| /api/sync/* | sync-engine | 同步 |
| /api/suppliers/* | misc | 供应商 |
| /api/logistics/* | misc | 物流商 |
| /api/remote-print/* | misc | 远程打印 |
| /api/pda/* | misc | PDA |
| /upload/* | oss | 文件上传 |
| /webhook/* | sync-engine | Webhook |

## 迁移状态

| 功能 | 状态 | 说明 |
|------|------|------|
| 用户认证 | ✅ 完成 | JWT登录 |
| 订单管理 | ✅ 完成 | CRUD、状态机 |
| 采购单 | ✅ 完成 | 列表、详情、统计 |
| 库存管理 | ✅ 完成 | 防超卖 |
| 商品管理 | ✅ 完成 | SKU映射 |
| 平台配置 | ✅ 完成 | 店铺管理 |
| 供应商 | ✅ 完成 | CRUD |
| 物流商 | ✅ 完成 | CRUD |
| 远程打印 | ⏳ 占位 | 待迁移 |
| PDA | ⏳ 占位 | 待迁移 |
| 财务 | ⏳ 占位 | 待迁移 |

## 技术栈

- Node.js + Express
- MySQL + Sequelize
- Redis（分布式锁）
- JWT认证
- http-proxy-middleware（网关代理）
