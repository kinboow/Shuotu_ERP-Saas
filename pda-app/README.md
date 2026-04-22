# 协途PDA移动端

跨境电商ERP系统的PDA移动端应用，用于仓库管理、扫码发货、收货等操作。

## 功能特性

- 📱 移动端适配，支持PDA设备
- 📷 扫码发货 - 扫描商品条码进行发货操作
- 📦 扫码收货 - 扫描商品条码进行收货入库
- 📊 库存盘点 - 扫描商品进行库存盘点
- 🔍 订单查询 - 查询订单状态和详情
- 👤 用户登录 - 账号密码登录

## 技术栈

- React 18
- React Router 6
- Ant Design Mobile 5
- Axios

## 安装运行

```bash
# 进入PDA应用目录
cd pda-app

# 安装依赖
npm install

# 生成SSL证书（首次运行需要）
cd ssl
generate-cert.bat  # Windows
# 或
./generate-cert.sh  # Linux/Mac
cd ..

# 启动开发服务器（HTTPS模式）
npm start

# 构建生产版本
npm run build
```

## HTTPS配置

录像功能需要HTTPS环境才能访问摄像头。应用已配置为HTTPS模式：

1. **生成SSL证书**：运行 `ssl/generate-cert.bat` 或 `ssl/generate-cert.sh`
2. **启动应用**：`npm start`
3. **访问地址**：`https://192.168.5.105:3099`
4. **信任证书**：首次访问时浏览器会提示证书不受信任，点击"高级"→"继续访问"即可

## 项目结构

```
pda-app/
├── public/
│   └── index.html
├── src/
│   ├── components/      # 公共组件
│   │   └── Layout.js    # 布局组件
│   ├── contexts/        # 上下文
│   │   └── AuthContext.js  # 认证上下文
│   ├── pages/           # 页面组件
│   │   ├── Home.js      # 首页
│   │   ├── Login.js     # 登录页
│   │   ├── ScanShip.js  # 扫码发货
│   │   ├── ScanReceive.js  # 扫码收货
│   │   ├── InventoryCheck.js  # 库存盘点
│   │   ├── OrderQuery.js  # 订单查询
│   │   └── Settings.js  # 设置页
│   ├── App.js           # 应用入口
│   ├── index.js         # 渲染入口
│   └── index.css        # 全局样式
├── package.json
└── README.md
```

## API接口

PDA端需要后端提供以下API接口：

### 认证
- `POST /api/auth/pda-login` - PDA登录

### 扫码发货
- `GET /api/pda/scan-ship?code=xxx` - 扫码查询商品
- `POST /api/pda/confirm-ship` - 确认发货

### 扫码收货
- `GET /api/pda/scan-receive?code=xxx` - 扫码查询商品
- `POST /api/pda/confirm-receive` - 确认收货

### 库存盘点
- `GET /api/pda/inventory-query?code=xxx` - 查询商品库存
- `POST /api/pda/submit-inventory-check` - 提交盘点结果

### 订单查询
- `GET /api/pda/orders?keyword=xxx` - 搜索订单

## 部署说明

1. 构建生产版本：`npm run build`
2. 将 `build` 目录部署到Web服务器
3. 配置后端API代理或CORS

## 注意事项

- 建议在HTTPS环境下使用，以支持摄像头扫码功能
- PDA设备需要支持现代浏览器(Chrome/Safari)
- 扫码功能依赖设备的摄像头或外接扫码枪
