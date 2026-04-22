const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const sequelize = require('./config/database');
const models = require('./models'); // Initialize all models with associations
const authRouter = require('./routes/auth');
const ordersRouter = require('./routes/orders');
const productsRouter = require('./routes/products');
const platformsRouter = require('./routes/platforms');
const platformConfigsRouter = require('./routes/platformConfigs');
const stockOrdersRouter = require('./routes/stockOrders');
const deliveryOrdersRouter = require('./routes/deliveryOrders');
const createStockOrderRouter = require('./routes/createStockOrder');
const reviewOrdersRouter = require('./routes/reviewOrders');
const skuSalesRouter = require('./routes/skuSales');
const financeRecordsRouter = require('./routes/financeRecords');
const withdrawalsRouter = require('./routes/withdrawals');
const sheinAuthRouter = require('./routes/sheinAuth');
const sheinOrdersRouter = require('./routes/sheinOrders');
const sheinProductsRouter = require('./routes/sheinProducts');
const sheinSyncRouter = require('./routes/sheinSync');
const sheinProductListRouter = require('./routes/sheinProductList');
const erpProductsRouter = require('./routes/erpProducts');
const imageUploadRouter = require('./routes/imageUpload');

const inventoryRouter = require('./routes/inventory');
const publishDraftsRouter = require('./routes/publishDrafts');
const publishRecordsRouter = require('./routes/publishRecords');
const sheinApiRouter = require('./routes/sheinApi');
const logisticsRouter = require('./routes/logistics');
const complianceLabelRouter = require('./routes/complianceLabel');
const labelMaterialsRouter = require('./routes/labelMaterials');
const pdaRouter = require('./routes/pda');
const suppliersRouter = require('./routes/suppliers');
const { router: remotePrintRouter, initSocketIO, httpPrintClients } = require('./routes/remotePrint');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['polling', 'websocket'],
  allowEIO3: true
});
const PORT = process.env.PORT || 5000;

// 配置CORS，允许浏览器扩展访问
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 路由
app.use('/api/auth', authRouter); // 认证路由（登录、登出、获取用户信息）
app.use('/api/orders', ordersRouter);
app.use('/api/products', productsRouter);
app.use('/api/platforms', platformsRouter);
app.use('/api/platform-configs', platformConfigsRouter);
app.use('/api/stock-orders', stockOrdersRouter);
app.use('/api/delivery-orders', deliveryOrdersRouter);
app.use('/api/create-stock-order', createStockOrderRouter);
app.use('/api/review-orders', reviewOrdersRouter);
app.use('/api/sku-sales', skuSalesRouter);
app.use('/api/finance-records', financeRecordsRouter);
app.use('/api/withdrawals', withdrawalsRouter);
app.use('/api/shein-auth', sheinAuthRouter);
app.use('/api/shein-orders', sheinOrdersRouter);
app.use('/api/shein-products', sheinProductsRouter);
app.use('/api/shein-sync', sheinSyncRouter);
app.use('/api/shein-product-list', sheinProductListRouter);
app.use('/api/erp-products', erpProductsRouter);
app.use('/api/images', imageUploadRouter);

app.use('/api/inventory', inventoryRouter);
app.use('/api/publish-drafts', publishDraftsRouter);
app.use('/api/publish-records', publishRecordsRouter);
app.use('/api/shein-api', sheinApiRouter);
app.use('/api/logistics', logisticsRouter);
app.use('/api/compliance-label', complianceLabelRouter);
app.use('/api/label-materials', labelMaterialsRouter);
app.use('/api/pda', pdaRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/remote-print', remotePrintRouter);

// 初始化 Socket.IO 打印服务
initSocketIO(io);

app.use('/api/auth/pda-login', (req, res, next) => {
  // 转发PDA登录请求到pda路由
  req.url = '/login';
  pdaRouter(req, res, next);
});

// 静态文件服务 - 提供上传的图片访问
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '跨境电商ERP系统运行中' });
});

// 数据库连接和启动服务器
// 注意: 使用 sync() 而不是 sync({ alter: true }) 避免创建重复索引
// 如需修改表结构，请手动执行 SQL 脚本
sequelize.sync().then(async () => {
  console.log('数据库连接成功');
  
  // 确保关键表存在并同步结构
  try {
    const SheinProduct = require('./models/SheinProduct');
    const ErpProduct = require('./models/ErpProduct');
    const ErpProductSkc = require('./models/ErpProductSkc');
    const ErpProductSku = require('./models/ErpProductSku');
    
    await SheinProduct.sync({ alter: true });
    console.log('SheinProducts 表已同步');
    
    await ErpProduct.sync({ alter: true });
    console.log('erp_products 表已同步');
    
    await ErpProductSkc.sync({ alter: true });
    console.log('erp_product_skcs 表已同步');
    
    await ErpProductSku.sync({ alter: true });
    console.log('erp_product_skus 表已同步');
    
    const Supplier = require('./models/Supplier');
    await Supplier.sync({ alter: true });
    console.log('suppliers 表已同步');
  } catch (err) {
    console.error('表同步失败:', err.message);
  }
  
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`服务器运行在端口 ${PORT}`);
    console.log(`本地访问: http://localhost:${PORT}`);
    console.log(`局域网访问: http://你的IP地址:${PORT}`);
    console.log('提示: 使用 ipconfig 命令查看本机IP地址');
    console.log('Socket.IO 打印服务已启动');
  });
}).catch(err => {
  console.error('数据库连接失败:', err);
});
