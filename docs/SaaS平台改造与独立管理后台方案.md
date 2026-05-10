# SaaS平台改造与独立管理后台方案

## 1. 目标

将当前 ERP 系统从单企业部署模式升级为企业级 SaaS 模式，并新增一个与业务 SaaS 系统完全隔离的独立平台管理后台。

本次改造要同时满足以下目标：

- 以企业为租户单位进行数据隔离。
- 同一企业内的成员共享企业数据。
- 不同企业之间的数据完全隔离。
- 平台级开发者配置全局共享，不随企业变化。
- 企业成员由企业管理员管理。
- 企业可以购买套餐和附加功能，功能按企业维度开通。
- 平台运营方拥有独立的管理后台，可管理平台用户、企业、套餐、平台配置。
- 平台管理后台的代码、端口、部署入口，与业务 SaaS 系统隔离。

## 2. 总体架构

系统拆分为两套入口。

### 2.1 业务 SaaS 系统

面向企业客户与企业成员使用。

包含：

- ERP 主前端
- 业务 API 网关
- 各业务微服务
- 企业成员登录、企业数据、店铺授权、订单、库存、财务、标签、打印等业务能力

### 2.2 平台管理后台

面向平台运营方使用。

包含：

- 独立平台管理前端
- 独立平台管理 API
- 平台级租户管理、套餐管理、功能配置、平台用户管理、全局平台开发者配置

### 2.3 代码边界

业务 SaaS 系统与平台管理后台必须做到：

- 前端代码目录分离
- 后端服务目录分离
- 端口分离
- Nginx / 反向代理入口分离
- API 路由分离
- 登录会话分离

## 3. 端口规划

### 3.1 本地开发端口

| 系统 | 组件 | 端口 |
| --- | --- | --- |
| 业务 SaaS | 前端 dev server | 3788 |
| 业务 SaaS | Gateway HTTP | 5080 |
| 业务 SaaS | Gateway HTTPS | 5000 |
| 平台管理后台 | 前端 dev server | 3790 |
| 平台管理后台 | Admin API | 5090 |

### 3.2 Docker / 部署端口

| 系统 | 组件 | 端口 |
| --- | --- | --- |
| 业务 SaaS | Web 容器 | 8088 |
| 平台管理后台 | Admin Web 容器 | 8090 |
| 平台管理后台 | Admin API 容器 | 5090（内部服务，可不对公网暴露） |

## 4. 租户模型

### 4.1 租户单位

租户单位定义为企业。

- 企业是数据隔离主体。
- 企业是购买主体。
- 企业是功能开通主体。
- 用户只是企业成员，不是租户主体。

### 4.2 用户与企业关系

用户注册后不直接拥有完整业务权限，而是进入企业归属流程。

支持两条路径：

- 创建企业
- 加入企业

#### 创建企业

- 用户注册成功后选择创建企业。
- 创建企业后自动成为企业拥有者。
- 默认获得企业管理员权限。
- 可管理成员、审批申请、购买套餐、配置企业信息。

#### 加入企业

- 用户注册成功后选择加入企业。
- 通过企业编码、邀请码或企业名称发起申请。
- 企业管理员审批通过后，成为企业成员。
- 成员权限由企业内角色控制。

## 5. 数据隔离规则

### 5.1 全局共享数据

以下数据为平台级共享数据，不按企业隔离：

- 平台开发者配置
- 套餐定义
- 功能定义
- 平台级管理用户
- 平台级系统参数
- 平台级审计日志

### 5.2 企业级隔离数据

以下数据按企业隔离：

- 企业信息
- 企业成员
- 企业角色与权限分配
- 企业店铺授权
- 企业商品、订单、库存、财务
- 企业供应商、物流商、标签模板、打印配置
- 企业日志
- 企业订阅与功能开通状态

## 6. 平台级通用配置与企业私有配置

### 6.1 平台级通用配置

这类配置由平台运营方统一维护，所有企业共享：

- SHEIN 开发者 App Key / Secret
- TEMU 开发者配置
- TikTok 开发者配置
- 平台 API 基础参数

### 6.2 企业私有配置

这类配置属于企业自己的业务资产：

- 企业自己的店铺授权信息
- 企业自己的店铺 token
- 企业同步任务与业务数据
- 企业自己的 ERP 配置

## 7. 套餐与功能授权模型

### 7.1 套餐主体

套餐购买主体是企业，不是用户。

### 7.2 功能授权模型

功能开通分为两层：

- 套餐内功能
- 企业单独加购功能

### 7.3 套餐示例

- 免费版
- 基础版
- 专业版
- 企业版

### 7.4 功能示例

- 企业成员管理
- 平台店铺授权
- 订单管理
- 库存管理
- 财务模块
- 远程打印
- 包装录像
- 快递报单
- 多店铺授权

### 7.5 限制方式

功能限制支持：

- 是否开通
- 数量限制
- 用量限制
- 到期时间

例如：

- 最大店铺数
- 最大成员数
- 月订单量上限
- 是否允许远程打印

## 8. 平台管理后台设计

### 8.1 独立性要求

平台管理后台必须独立于业务 SaaS 系统：

- 独立前端目录
- 独立后端目录
- 独立端口
- 独立登录入口
- 独立鉴权逻辑
- 独立 API 命名空间

### 8.2 平台管理后台职责

平台管理后台负责：

- 管理平台用户
- 管理企业列表
- 查看企业订阅状态
- 管理套餐与功能矩阵
- 管理全局平台开发者配置
- 查看平台级概览统计

### 8.3 业务 SaaS 系统职责

业务 SaaS 系统负责：

- 企业成员使用业务功能
- 企业级角色权限管理
- 企业业务数据管理
- 企业内店铺授权与同步
- 企业内采购、库存、订单、财务等业务流程

## 9. 核心数据表设计

### 9.1 平台侧表

- `platform_users`
- `platform_provider_credentials`
- `features`
- `plans`
- `plan_features`

### 9.2 企业侧表

- `enterprises`
- `enterprise_members`
- `enterprise_join_requests`
- `enterprise_roles`
- `enterprise_role_permissions`
- `enterprise_subscriptions`
- `enterprise_feature_overrides`

## 10. 登录与上下文模型

### 10.1 平台管理后台登录

平台管理后台登录使用独立 token，不复用业务 SaaS 的登录 token。

返回信息包括：

- 平台用户 ID
- 平台用户角色
- 平台级权限

### 10.2 业务 SaaS 登录

业务 SaaS 登录成功后，需要返回：

- 用户 ID
- 当前企业 ID
- 可访问企业列表
- 企业内角色
- 企业内权限
- 企业套餐状态
- 企业已开通功能

## 11. API 分层

### 11.1 业务 SaaS API

继续保持业务系统自己的 API 网关和微服务：

- `/api/auth`
- `/api/users`
- `/api/orders`
- `/api/products`
- `/api/platform-management`
- 其他业务接口

### 11.2 平台管理后台 API

平台管理后台使用独立 API：

- `/api/platform-auth/*`
- `/api/platform/overview`
- `/api/platform/users`
- `/api/platform/enterprises`
- `/api/platform/plans`
- `/api/platform/provider-credentials`

## 12. 改造阶段

### 第一阶段：骨架搭建

目标：先把 SaaS 平台化骨架和独立平台后台跑起来。

包含：

- 新增独立平台管理前端
- 新增独立平台管理 API
- 新增 SaaS 核心表
- 接入本地开发脚本
- 接入 Docker 编排
- 提供平台用户、企业、套餐、全局平台配置的基础页面和 API 骨架

### 第二阶段：企业身份体系

目标：实现企业级成员关系和审批流。

包含：

- 注册时选择创建企业或加入企业
- 企业管理员审批加入申请
- 企业成员列表管理
- 企业内角色分配

### 第三阶段：企业级数据隔离

目标：逐业务模块增加 `enterprise_id` 并实现统一隔离。

包含：

- 商品、订单、库存、财务、标签、供应商、物流商等业务表逐步租户化
- 查询与写入统一附加企业上下文
- 中间件统一校验当前企业访问范围

### 第四阶段：套餐与功能控制

目标：企业购买套餐后，系统按企业维度控制功能可用性。

包含：

- 套餐购买
- 续费/到期
- 功能鉴权中间件
- 用量限制

## 13. 第一阶段代码落地范围

本轮代码改造按本方案先落地以下内容：

- 独立平台管理后台前端目录
- 独立平台管理后台后端目录
- 独立 Dockerfile 与 Nginx 配置
- 独立开发端口和部署端口
- SaaS 核心表初始化脚本
- 本地开发启动脚本接入平台后台

本轮不直接完成所有业务表的企业级隔离，只完成后续扩展所需的骨架。

## 14. 目录规划

### 14.1 业务 SaaS

- `frontend/`
- `services/gateway/`
- `services/misc/`
- `services/oms/`
- `services/wms/`
- `services/pms/`
- `services/sync-engine/`
- `services/oss/`
- `services/webhook/`

### 14.2 平台管理后台

- `platform-admin/`
- `services/platform-admin/`
- `docker/admin-web.Dockerfile`
- `docker/admin-api.Dockerfile`
- `docker/nginx/admin.conf`

## 15. 验收标准

### 15.1 架构层面

- 业务 SaaS 与平台管理后台代码分离
- 业务 SaaS 与平台管理后台端口分离
- 平台管理后台不经业务网关代理
- 平台管理后台可独立开发、独立部署

### 15.2 功能层面

- 平台管理后台可以登录
- 平台管理后台可以查看平台概览
- 平台管理后台可以查看和创建平台用户
- 平台管理后台可以查看企业列表
- 平台管理后台可以查看套餐与功能配置

### 15.3 后续扩展层面

- 具备企业级租户表结构
- 具备套餐与功能矩阵表结构
- 具备企业订阅表结构
- 为后续业务租户化改造保留稳定扩展点

## 16. 当前第一阶段代码启动方式

### 16.1 本地开发模式

先启动基础设施：

```powershell
docker compose -f docker-compose.infra.yml up -d
```

然后启动开发模式：

```powershell
.\start-dev.bat
```

启动后地址如下：

- 业务 SaaS 前端：`https://localhost:3788`
- 平台管理后台前端：`http://localhost:3790`
- 平台管理后台 API：`http://localhost:5090`

### 16.2 Docker 部署模式

```bash
docker compose --env-file docker/.env.docker up -d --build
```

部署后地址如下：

- 业务 SaaS 前端：`http://127.0.0.1:8088`
- 平台管理后台前端：`http://127.0.0.1:8090`

### 16.3 平台后台默认管理员

第一阶段平台后台会自动初始化一个默认平台管理员：

- 用户名：`platform_admin`
- 密码：`admin123`

可通过以下配置覆盖：

- `PLATFORM_ADMIN_BOOTSTRAP_USERNAME`
- `PLATFORM_ADMIN_BOOTSTRAP_PASSWORD`
- `PLATFORM_ADMIN_JWT_SECRET`

### 16.4 数据库初始化说明

新增的 SaaS 核心表在以下两种路径下都会创建：

- MySQL 初始化脚本：`services/database/saas_core.sql`
- 平台管理 API 启动时自动补齐表结构与种子数据

这意味着即使旧库不是重新初始化，只要平台管理 API 正常启动，也会自动补建第一阶段所需的核心表。

## 17. 当前第二阶段已落地范围

第二阶段当前已经在 `services/misc` 中补齐企业上下文与成员准入主链路。

### 17.1 认证接口增强

- `POST /api/auth/register`
  - 支持 `registrationMode`
  - `create_enterprise` 时可直接创建企业
  - `join_enterprise` 时可直接提交加入申请
- `POST /api/auth/login`
  - 返回 `enterprises`
  - 返回 `currentEnterprise`
  - 返回 `pendingJoinRequests`
  - 返回 `requiresEnterpriseSelection`
- `POST /api/auth/refresh`
  - 支持携带 `enterpriseId`
- `GET /api/auth/me`
  - 返回当前用户企业上下文
- `POST /api/auth/select-enterprise`
  - 切换当前企业并签发新 token

### 17.2 企业接口增强

- `GET /api/enterprise`
  - 优先返回当前登录用户的当前企业
- `PUT /api/enterprise`
  - 企业管理员更新当前企业基础资料
- `GET /api/enterprise/context`
  - 获取当前用户的企业上下文
- `POST /api/enterprise/create`
  - 登录后补创建企业
- `GET /api/enterprise/members`
  - 获取当前企业成员列表
- `POST /api/enterprise/join-requests`
  - 提交加入企业申请
- `GET /api/enterprise/join-requests`
  - 企业管理员查看加入申请
- `POST /api/enterprise/join-requests/:id/approve`
  - 企业管理员审批通过
- `POST /api/enterprise/join-requests/:id/reject`
  - 企业管理员审批拒绝

### 17.3 主业务前端已接入范围

主业务前端当前已经完成以下接入：

- 登录页支持用户名或手机号登录
- 注册页支持三种模式
  - 暂不绑定企业
  - 创建企业
  - 加入企业
- 登录成功后前端本地会保存
  - `enterprises`
  - `currentEnterprise`
  - `pendingJoinRequests`
  - `requiresEnterpriseSelection`
- 主业务顶部导航栏支持切换当前企业
- 页面刷新后会自动通过 `GET /api/auth/me` 回填最新企业上下文
- 企业设置页已兼容新的企业上下文字段结构

### 17.4 首批数据隔离已落地范围

- 网关已透传 `x-enterprise-id`、`x-auth-user-id`、`x-auth-role-code` 等头信息，供 OMS / PMS / WMS 后续按企业隔离时复用
- `services/misc` 的用户管理接口已切换为按当前企业成员视角工作
  - 用户列表仅返回当前企业成员
  - 创建子账号后自动加入当前企业成员关系
  - 用户详情、重置密码、强制下线仅允许操作当前企业成员
  - 删除用户改为移出当前企业，不再直接全局删库
- `services/sync-engine` 已接入请求级企业上下文
  - 启动时自动补齐 `platform_configs`、`platform_shops`、`shein_full_shops` 的 `enterprise_id` 列与索引
  - `platforms` / `platform-configs` 接口按当前企业读取店铺与平台覆盖配置
  - 平台默认配置保留 `enterprise_id = 0` 作为全局兜底，企业可生成自己的覆盖配置
  - `shein_full` 店铺管理、授权、日志接口已按当前企业隔离
  - 适配器启动加载支持跨企业读取各自店铺配置
- `services/oms` 已接入请求级企业上下文
  - `orders` 主表查询、详情、状态流转、发货、统计已按当前企业隔离
  - `stock-orders` 采购单列表、统计、店铺筛选、详情已按 `enterprise_id` 过滤
  - `delivery-orders` 发货单列表、统计、详情已按 `enterprise_id` 过滤
  - `shipping-station` 发货台列表、添加、移除、清空已按当前企业隔离
  - OMS 转发到 `sync-engine` 的店铺能力请求会继续透传 `x-enterprise-id`

### 17.5 当前仍未完成的部分

以下内容仍属于后续阶段：

- 业务模块表结构全面增加 `enterprise_id`
- 各业务查询统一自动注入企业过滤条件
- 企业级角色、权限、菜单隔离体系
- 企业套餐功能拦截中间件接入全部业务模块
- 主业务页面按当前企业进行数据隔离与空态提示联动
