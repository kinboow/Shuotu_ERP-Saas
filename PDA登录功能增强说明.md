# PDA登录功能增强说明

## 📋 功能概述

PDA端现在支持两种登录方式：
1. **企业员工登录** - 使用企业账号登录，可以选择任意快递公司进行报单
2. **物流商登录** - 使用物流商账号登录，只能为自己的快递公司报单

---

## 🚀 快速安装

### 方法1：一键安装（推荐）
```bash
install-pda-login-enhancement.bat
```

### 方法2：手动安装
```bash
# 1. 更新数据库
mysql -u root -p < services/database/pda_login_enhancement.sql

# 2. MISC服务会自动重启（nodemon）
```

---

## 📱 PDA端使用说明

### 登录页面

打开PDA应用后，会看到登录页面，包含两个选项：

#### 1. 企业员工登录
- 选择"企业员工"
- 输入企业账号和密码
- 登录后可以选择任意快递公司进行报单

#### 2. 物流商登录
- 选择"物流商"
- 输入物流商账号和密码（由企业管理员分配）
- 登录后快递公司自动设置为该物流商
- 只能为自己的快递公司报单

### 快递报单

登录后进入快递报单页面：

**企业员工**：
- 可以从下拉列表选择任意快递公司
- 填写大件/小件数量
- 扫码添加包裹
- 提交报单

**物流商**：
- 快递公司自动设置且不可更改
- 填写大件/小件数量
- 扫码添加包裹
- 提交报单

---

## 💻 Web端管理说明

### 1. 物流商账号管理

**路径**：设置 → 物流商账号

**功能**：
- 查看所有物流商列表
- 为物流商设置PDA登录账号
- 开启/关闭PDA登录权限
- 修改物流商登录密码
- 查看登录统计（最后登录时间、登录次数）

**操作步骤**：

#### 设置登录账号
1. 点击"设置账号"按钮
2. 填写登录账号（字母、数字、下划线，至少4位）
3. 填写登录密码（至少6位）
4. 开启"启用PDA登录"
5. 开启"允许PDA访问"
6. 点击确定

#### 修改密码
1. 点击"修改密码"按钮
2. 输入新密码
3. 确认新密码
4. 点击确定

#### 开启/关闭登录
- 使用右侧的开关按钮快速开启/关闭PDA登录

### 2. 用户管理（企业员工）

**路径**：设置 → 用户管理

**新增功能**：
- 为企业员工账号添加"PDA访问权限"控制
- 只有开启PDA访问权限的员工才能使用PDA登录

**操作步骤**：
1. 进入用户管理页面
2. 编辑用户信息
3. 勾选"允许PDA访问"
4. 保存

---

## 🗄️ 数据库变更

### 新增表

#### 1. pda_login_logs（PDA登录日志表）
记录所有PDA登录记录，包括：
- 用户类型（employee/logistics）
- 用户ID
- 登录状态（成功/失败）
- 失败原因
- IP地址
- 登录时间

#### 2. logistics_courier_reports（物流商报单关联表）
记录物流商与报单的关联关系

### 表字段更新

#### logistics_providers（物流商表）
新增字段：
- `login_enabled` - 是否启用登录
- `login_username` - 登录用户名
- `login_password` - 登录密码（加密）
- `pda_access` - 是否允许PDA访问
- `last_login_at` - 最后登录时间
- `login_count` - 登录次数

#### users（用户表）
新增字段：
- `pda_access` - 是否允许PDA访问

#### courier_reports（快递报单表）
新增字段：
- `user_type` - 用户类型（employee/logistics）
- `logistics_id` - 物流商ID（如果是物流商登录）

---

## 🔐 安全特性

### 1. 密码加密
- 使用bcrypt加密存储密码
- 密码强度要求：至少6个字符

### 2. Token认证
- 使用JWT Token进行身份验证
- Token有效期：7天
- 支持Token验证和刷新

### 3. 权限控制
- 企业员工需要开启PDA访问权限
- 物流商需要开启登录和PDA访问权限
- 账号状态检查（ACTIVE/禁用）

### 4. 登录日志
- 记录所有登录尝试
- 包含成功和失败记录
- 记录IP地址和设备信息

---

## 📊 API接口

### PDA认证接口

#### 1. PDA登录
```
POST /api/pda-auth/pda-login
Body: {
  username: "账号",
  password: "密码",
  userType: "employee" | "logistics"
}
```

#### 2. 验证Token
```
POST /api/pda-auth/verify-token
Body: {
  token: "JWT Token"
}
```

#### 3. 获取物流商列表
```
GET /api/pda-auth/logistics-list
```

### 物流商账号管理接口

#### 1. 设置登录账号
```
PUT /api/logistics/providers/:id/login-account
Body: {
  login_username: "账号",
  login_password: "密码",
  login_enabled: true,
  pda_access: true
}
```

#### 2. 修改密码
```
PUT /api/logistics/providers/:id/change-password
Body: {
  new_password: "新密码"
}
```

#### 3. 开启/关闭PDA访问
```
PUT /api/logistics/providers/:id/pda-access
Body: {
  login_enabled: true,
  pda_access: true
}
```

---

## 🎯 使用场景

### 场景1：快递公司自助报单

**背景**：快递公司每天上门收件，需要向企业报告收件数量

**解决方案**：
1. 企业管理员在"物流商账号"中为快递公司设置登录账号
2. 快递员使用PDA登录（选择"物流商"）
3. 快递员扫码录入包裹信息
4. 提交报单
5. 企业管理员在Web端查看报单记录

**优势**：
- 快递公司自助操作，减少企业工作量
- 数据实时同步，便于统计
- 责任明确，可追溯

### 场景2：企业员工统一报单

**背景**：企业仓库人员统一管理所有快递报单

**解决方案**：
1. 企业员工使用PDA登录（选择"企业员工"）
2. 根据实际情况选择快递公司
3. 扫码录入包裹信息
4. 提交报单

**优势**：
- 灵活选择快递公司
- 统一管理，数据集中
- 便于对账和统计

---

## 🔍 故障排查

### 1. 登录失败

**问题**：提示"用户名或密码错误"

**排查**：
- 检查用户名和密码是否正确
- 检查是否选择了正确的登录类型
- 企业员工：检查账号状态是否为ACTIVE
- 物流商：检查是否开启了PDA登录

**问题**：提示"无PDA访问权限"

**排查**：
- 企业员工：在用户管理中检查是否开启了PDA访问权限
- 物流商：在物流商账号管理中检查是否开启了PDA访问权限

### 2. 快递公司列表为空

**问题**：物流商登录后看不到快递公司

**排查**：
- 检查物流商信息中的`provider_name`字段是否有值
- 检查后端日志是否有错误

### 3. 提交报单失败

**问题**：提示"提交失败"

**排查**：
- 检查网络连接
- 检查Token是否有效
- 查看浏览器控制台错误信息
- 查看后端日志

---

## 📝 开发文件清单

### 数据库
- `services/database/pda_login_enhancement.sql` - 数据库更新脚本

### 后端（MISC服务）
- `services/misc/src/routes/pda-auth.js` - PDA认证路由（新增）
- `services/misc/src/routes/logistics.js` - 物流商路由（更新）
- `services/misc/src/routes/courier-reports.js` - 快递报单路由（更新）
- `services/misc/src/index.js` - 服务入口（更新）

### PDA移动端
- `pda-app/src/pages/Login.js` - 登录页面（更新）
- `pda-app/src/contexts/AuthContext.js` - 认证上下文（更新）
- `pda-app/src/pages/CourierReport.js` - 快递报单页面（更新）

### Web管理端
- `frontend/src/pages/LogisticsAccountManagement.js` - 物流商账号管理（新增）
- `frontend/src/App.js` - 路由配置（更新）

### 文档和脚本
- `PDA登录功能增强说明.md` - 本文档
- `install-pda-login-enhancement.bat` - 安装脚本

---

## ✅ 验收清单

### 功能验收
- [ ] PDA端可以选择登录类型
- [ ] 企业员工可以正常登录
- [ ] 物流商可以正常登录
- [ ] 企业员工可以选择任意快递公司
- [ ] 物流商只能看到自己的快递公司
- [ ] 报单提交成功
- [ ] Web端可以查看报单记录
- [ ] 物流商账号管理页面正常
- [ ] 可以设置物流商登录账号
- [ ] 可以修改物流商密码
- [ ] 可以开启/关闭PDA登录
- [ ] 登录日志正常记录

### 安全验收
- [ ] 密码加密存储
- [ ] Token验证正常
- [ ] 权限控制有效
- [ ] 登录失败有提示
- [ ] 无权限访问被拦截

---

## 🎉 总结

PDA登录功能增强已完成，主要特性：

1. ✅ 支持企业员工和物流商两种登录方式
2. ✅ 物流商登录后只能为自己的快递公司报单
3. ✅ Web端可以管理物流商PDA账号
4. ✅ 完整的权限控制和安全机制
5. ✅ 详细的登录日志记录

功能已经可以投入使用！

---

**版本**：v1.0  
**日期**：2026-01-18  
**状态**：✅ 已完成
