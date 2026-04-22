-- ============================================================================
-- Cross-Border E-commerce ERP System - Complete Database Script
-- 跨境电商ERP系统 - 完整数据库脚本
-- ============================================================================
-- 
-- Description:
-- 1. 包含所有表结构和数据的完整数据库脚本
-- 2. 支持全新安装和现有数据库更新
-- 3. 使用 IF NOT EXISTS 和条件检查避免重复
-- 4. 包含ERP产品管理、合规标签、素材库等所有功能
-- 
-- Usage:
-- mysql -u root -p < database/complete_database_script.sql
-- 或在MySQL客户端中: SOURCE database/complete_database_script.sql;
-- 
-- Important:
-- - 数据库名称: eer (统一使用此名称)
-- - 包含所有业务表和功能表
-- - 所有外键关系已正确配置
-- 
-- ============================================================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS eer CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE eer;

-- 设置导入选项，忽略错误
SET SESSION sql_mode='';
SET FOREIGN_KEY_CHECKS=0;

-- ============================================================================
-- 临时创建旧表结构（用于接收备份数据中的INSERT语句，之后会删除）
-- ============================================================================

-- 旧的发货单表（临时）
CREATE TABLE IF NOT EXISTS DeliveryOrders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  dummy_field VARCHAR(1) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 旧的发货单明细表（临时）
CREATE TABLE IF NOT EXISTS DeliveryOrderItems (
  id INT PRIMARY KEY AUTO_INCREMENT,
  dummy_field VARCHAR(1) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 旧的发货单同步日志表（临时）
CREATE TABLE IF NOT EXISTS DeliveryOrderSyncLogs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  dummy_field VARCHAR(1) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 旧的财务记录表（临时）
CREATE TABLE IF NOT EXISTS FinanceRecords (
  id INT PRIMARY KEY AUTO_INCREMENT,
  dummy_field VARCHAR(1) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 旧的提现表（临时）
CREATE TABLE IF NOT EXISTS Withdrawals (
  id INT PRIMARY KEY AUTO_INCREMENT,
  dummy_field VARCHAR(1) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- 核心业务表
-- ============================================================================

-- 用户表
CREATE TABLE IF NOT EXISTS Users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  uid CHAR(36) UNIQUE NOT NULL COMMENT '用户UID',
  name VARCHAR(20) NOT NULL COMMENT '用户名',
  phone VARCHAR(11) NOT NULL COMMENT '手机号',
  avatar VARCHAR(255) COMMENT '用户头像',
  last_login DATETIME COMMENT '最后登录时间',
  login_count INT DEFAULT 0 COMMENT '登录次数',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_uid (uid),
  KEY idx_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 平台配置表
CREATE TABLE IF NOT EXISTS PlatformConfigs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  platform_name ENUM('shein_full', 'shein_semi', 'amazon', 'ebay') NOT NULL COMMENT '平台名称',
  platform_display_name VARCHAR(100) NOT NULL COMMENT '平台显示名称',
  icon LONGTEXT COMMENT 'SVG图标代码',
  app_id VARCHAR(100) NOT NULL COMMENT '应用ID/AppID',
  app_secret VARCHAR(255) NOT NULL COMMENT '应用密钥/APP Secret',
  callback_url VARCHAR(500) NOT NULL COMMENT '回调URL',
  api_environment ENUM('production', 'test') DEFAULT 'production' COMMENT 'API环境',
  api_domain VARCHAR(255) COMMENT 'API域名',
  is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
  config_data JSON COMMENT '其他配置数据',
  remarks TEXT COMMENT '备注',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_platform (platform_name),
  KEY idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台配置表';

-- 平台店铺表
CREATE TABLE IF NOT EXISTS PlatformShops (
  id INT PRIMARY KEY AUTO_INCREMENT,
  platform_id INT NOT NULL COMMENT '关联平台配置ID',
  platform_name ENUM('shein_full', 'shein_semi', 'amazon', 'ebay') NOT NULL COMMENT '平台名称',
  shop_name VARCHAR(100) COMMENT '店铺名称',
  shop_code VARCHAR(100) COMMENT '店铺代码/ID',
  access_token TEXT COMMENT '访问令牌',
  refresh_token TEXT COMMENT '刷新令牌',
  token_expires_at DATETIME COMMENT '令牌过期时间',
  open_key_id VARCHAR(100) COMMENT 'SHEIN: 授权后的openKeyId',
  secret_key TEXT COMMENT 'SHEIN: 授权后的secretKey(解密)',
  encrypted_secret_key TEXT COMMENT 'SHEIN: 授权后的secretKey(加密)',
  seller_id VARCHAR(100) COMMENT 'Amazon: 卖家ID',
  marketplace_id VARCHAR(100) COMMENT 'Amazon: 市场ID',
  auth_data JSON COMMENT '其他授权数据',
  is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
  auth_time DATETIME COMMENT '授权时间',
  last_sync_time DATETIME COMMENT '最后同步时间',
  sync_status VARCHAR(50) COMMENT '同步状态',
  remarks TEXT COMMENT '备注',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_platform_shop (platform_name, shop_code),
  KEY idx_platform_id (platform_id),
  KEY idx_platform_name (platform_name),
  KEY idx_is_active (is_active),
  KEY idx_open_key_id (open_key_id),
  CONSTRAINT fk_platform_shops_config FOREIGN KEY (platform_id) 
    REFERENCES PlatformConfigs (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台店铺表';

-- ============================================================================
-- 商品表
-- ============================================================================

-- 商品表
CREATE TABLE IF NOT EXISTS Products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sku VARCHAR(100) UNIQUE NOT NULL COMMENT 'SKU代码',
  name VARCHAR(500) NOT NULL COMMENT '商品名称',
  description TEXT COMMENT '商品描述',
  price DECIMAL(10, 2) NOT NULL COMMENT '价格',
  cost DECIMAL(10, 2) COMMENT '成本',
  stock INT DEFAULT 0 COMMENT '库存数量',
  inventory_data JSON COMMENT '详细库存数据(包含仓库库存)',
  last_inventory_sync DATETIME COMMENT '最后库存同步时间',
  weight DECIMAL(10, 2) COMMENT '重量(g)',
  category VARCHAR(100) COMMENT '类目',
  image_url VARCHAR(500) COMMENT '主图URL',
  source_platform VARCHAR(50) COMMENT '来源平台',
  source_spu VARCHAR(100) COMMENT 'SHEIN SPU代码',
  source_skc VARCHAR(100) COMMENT 'SHEIN SKC代码',
  source_sku VARCHAR(100) COMMENT 'SHEIN SKU代码',
  supplier_sku VARCHAR(100) COMMENT '供应商SKU',
  supplier_code VARCHAR(100) COMMENT '供应商代码',
  brand VARCHAR(100) COMMENT '品牌',
  brand_code VARCHAR(100) COMMENT '品牌代码',
  category_id BIGINT COMMENT 'SHEIN类目ID',
  product_type_id BIGINT COMMENT 'SHEIN产品类型ID',
  length DECIMAL(10, 2) COMMENT '长度(cm)',
  width DECIMAL(10, 2) COMMENT '宽度(cm)',
  height DECIMAL(10, 2) COMMENT '高度(cm)',
  dimensions JSON COMMENT '完整尺寸信息',
  attributes JSON COMMENT '商品属性列表',
  sale_attributes JSON COMMENT '销售属性列表',
  dimension_attributes JSON COMMENT '尺码属性列表',
  images JSON COMMENT '商品图片列表',
  main_image TEXT COMMENT '主图URL',
  detail_images JSON COMMENT '详情图列表',
  base_price DECIMAL(10, 2) COMMENT '基础价格',
  special_price DECIMAL(10,2) COMMENT '特价',
  price_info JSON COMMENT '多站点价格信息',
  cost_price DECIMAL(10, 2) COMMENT '成本价',
  cost_info JSON COMMENT '成本信息',
  srp_price DECIMAL(10,2) COMMENT '建议零售价',
  currency VARCHAR(10) COMMENT '币种',
  site VARCHAR(50) COMMENT '站点',
  sites JSON COMMENT '多站点信息',
  multi_language_names JSON COMMENT '多语言名称',
  multi_language_desc JSON COMMENT '多语言描述',
  status VARCHAR(50) DEFAULT 'active' COMMENT '状态',
  shelf_status INT COMMENT '上架状态: 0-下架, 1-上架',
  mall_state INT COMMENT '商城销售状态: 1-在售 2-停售',
  stop_purchase INT COMMENT '采购状态: 1-在采 2-停采',
  recycle_status INT COMMENT '回收站状态: 0-未回收 1-已回收',
  first_shelf_time DATETIME COMMENT '首次上架时间',
  last_shelf_time DATETIME COMMENT '最近上架时间',
  last_update_time DATETIME COMMENT 'SHEIN最近更新时间',
  sync_time DATETIME COMMENT '最后同步时间',
  sample_info JSON COMMENT '样品信息',
  sample_code VARCHAR(100) COMMENT '样衣SKU',
  reserve_sample_flag INT COMMENT '是否需留样: 1-是 2-否',
  spot_flag INT COMMENT '是否现货: 1-是 2-否',
  quantity_type INT COMMENT '件数类型: 1-单件 2-同品多件',
  quantity_unit INT COMMENT '件数单位: 1-件 2-双',
  quantity INT COMMENT '件数值',
  package_type INT COMMENT '包装类型: 0-空 1-软包装+软物 2-软包装+硬物 3-硬包装 4-真空',
  supplier_barcode_enabled BOOLEAN COMMENT '是否启用供应条码',
  supplier_barcode_list JSON COMMENT '供应商条码列表',
  raw_data JSON COMMENT 'SHEIN原始完整数据',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_source_platform (source_platform),
  KEY idx_source_spu (source_spu),
  KEY idx_source_skc (source_skc),
  KEY idx_status (status),
  KEY idx_shelf_status (shelf_status),
  KEY idx_category_id (category_id),
  KEY idx_last_inventory_sync (last_inventory_sync)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品表';

-- ============================================================================
-- 备货单管理表 (已废弃 - 使用 shein_purchase_orders 替代)
-- ============================================================================
-- 注意: StockOrders 和 StockOrderItems 表已被删除
-- 新的采购单数据请使用以下表:
-- - shein_purchase_orders: SHEIN采购单主表
-- - shein_purchase_order_details: SHEIN采购单明细表
-- ============================================================================


-- ============================================================================
-- 订单和财务表
-- ============================================================================

-- 订单表
CREATE TABLE IF NOT EXISTS Orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_number VARCHAR(100) UNIQUE NOT NULL,
  platform ENUM('amazon', 'ebay', 'shopify', 'manual') NOT NULL,
  platform_order_id VARCHAR(100),
  customer_name VARCHAR(100),
  customer_email VARCHAR(100),
  shipping_address TEXT,
  total_amount DECIMAL(10, 2) NOT NULL,
  status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
  order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  tracking_number VARCHAR(100),
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_order_date (order_date),
  KEY idx_status_order (status),
  KEY idx_platform (platform)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单表';



-- ============================================================================
-- SHEIN商品表
-- ============================================================================

-- SHEIN商品列表表
CREATE TABLE IF NOT EXISTS SheinProductList (
  id INT PRIMARY KEY AUTO_INCREMENT,
  spu_id VARCHAR(50) NOT NULL COMMENT 'SPU ID',
  skc_id VARCHAR(50) NOT NULL COMMENT 'SKC ID',
  sku_id VARCHAR(50) NOT NULL COMMENT 'SKU ID',
  product_name VARCHAR(500) COMMENT '商品名称',
  product_code VARCHAR(100) COMMENT '商品代码',
  category VARCHAR(200) COMMENT '类目',
  product_image TEXT COMMENT '商品图片URL',
  attributes TEXT COMMENT '商品属性(分号分隔)',
  color VARCHAR(100) COMMENT '颜色',
  size VARCHAR(100) COMMENT '尺码',
  stock INT DEFAULT 0 COMMENT '库存数量',
  volume VARCHAR(100) COMMENT '体积(卖家测量)',
  weight VARCHAR(100) COMMENT '重量(卖家测量)',
  platform_volume VARCHAR(100) COMMENT '体积(平台测量)',
  platform_weight VARCHAR(100) COMMENT '重量(平台测量)',
  sku_category VARCHAR(50) COMMENT 'SKU类别: single/set',
  item_count INT DEFAULT 1 COMMENT '件数',
  sku_code VARCHAR(100) COMMENT 'SKU代码',
  declared_price DECIMAL(10, 2) COMMENT '申报价格(CNY)',
  today_sales INT DEFAULT 0 COMMENT '今日销量',
  today_total INT DEFAULT 0 COMMENT '今日总量',
  week_sales INT DEFAULT 0 COMMENT '7天销量',
  created_time DATETIME COMMENT '商品创建时间',
  captured_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '抓取时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  KEY idx_spu_id (spu_id),
  KEY idx_skc_id (skc_id),
  KEY idx_sku_id (sku_id),
  KEY idx_product_code (product_code),
  KEY idx_captured_at (captured_at),
  UNIQUE KEY uk_sku_id (sku_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SHEIN商品列表';

-- SHEIN商品详情表
CREATE TABLE IF NOT EXISTS SheinProducts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  shop_id INT NOT NULL COMMENT '关联店铺ID',
  spu_name VARCHAR(100) NOT NULL COMMENT 'SPU代码',
  spu_supplier_code VARCHAR(100) COMMENT 'SPU供应商代码',
  brand_code VARCHAR(100) COMMENT '品牌代码',
  category_id BIGINT COMMENT '末级类目ID',
  product_type_id BIGINT COMMENT '产品类型ID',
  skc_name VARCHAR(100) COMMENT 'SKC代码',
  skc_supplier_code VARCHAR(100) COMMENT 'SKC供应商代码',
  skc_attribute_id BIGINT COMMENT 'SKC销售属性ID',
  skc_attribute_value_id BIGINT COMMENT 'SKC销售属性值ID',
  sku_code VARCHAR(100) COMMENT 'SKU代码',
  supplier_sku VARCHAR(100) COMMENT '供应商SKU',
  product_name_cn VARCHAR(500) COMMENT '商品名称(中文)',
  product_name_en VARCHAR(500) COMMENT '商品名称(英文)',
  product_desc_cn TEXT COMMENT '商品描述(中文)',
  product_desc_en TEXT COMMENT '商品描述(英文)',
  main_image_url TEXT COMMENT '主图URL',
  image_medium_url TEXT COMMENT '中图URL',
  image_small_url TEXT COMMENT '小图URL',
  image_group_code VARCHAR(100) COMMENT '图片组编码',
  length DECIMAL(10,2) COMMENT '长度(cm)',
  width DECIMAL(10,2) COMMENT '宽度(cm)',
  height DECIMAL(10,2) COMMENT '高度(cm)',
  weight INT COMMENT '重量(g)',
  quantity_type INT COMMENT '件数类型: 1-单件 2-同品多件',
  quantity_unit INT COMMENT '件数单位: 1-件 2-双',
  quantity INT COMMENT '件数值',
  package_type INT COMMENT '包装类型',
  base_price DECIMAL(10,2) COMMENT '基础价格',
  special_price DECIMAL(10,2) COMMENT '特价',
  cost_price DECIMAL(10,2) COMMENT '成本价',
  srp_price DECIMAL(10,2) COMMENT '建议零售价',
  currency VARCHAR(10) COMMENT '币种',
  site VARCHAR(50) COMMENT '站点',
  shelf_status INT COMMENT '上架状态: 0-下架, 1-上架',
  mall_state INT COMMENT '商城状态: 1-在售, 2-停售',
  stop_purchase INT COMMENT '采购状态: 1-在采 2-停采',
  recycle_status INT COMMENT '回收站状态: 0-未回收 1-已回收',
  first_shelf_time DATETIME COMMENT '首次上架时间',
  last_shelf_time DATETIME COMMENT '最近上架时间',
  last_update_time DATETIME COMMENT '最后更新时间',
  sample_code VARCHAR(100) COMMENT '样衣SKU',
  reserve_sample_flag INT COMMENT '是否需留样: 1-是 2-否',
  spot_flag INT COMMENT '是否现货: 1-是 2-否',
  sample_judge_type INT COMMENT '审版类型',
  supplier_barcode_enabled BOOLEAN COMMENT '是否启用供应条码',
  barcode_type VARCHAR(20) COMMENT '条码类型: EAN、UPC',
  product_multi_name_list JSON COMMENT '多语言名称列表',
  product_multi_desc_list JSON COMMENT '多语言描述列表',
  product_attribute_list JSON COMMENT '商品属性列表',
  dimension_attribute_list JSON COMMENT '尺寸属性列表',
  sale_attribute_list JSON COMMENT 'SKU销售属性列表',
  skc_attribute_multi_list JSON COMMENT 'SKC属性多语言名称',
  skc_attribute_value_multi_list JSON COMMENT 'SKC属性值多语言名称',
  images JSON COMMENT '所有图片列表',
  spu_image_list JSON COMMENT 'SPU图片列表',
  skc_image_list JSON COMMENT 'SKC图片列表',
  sku_image_list JSON COMMENT 'SKU图片列表',
  site_detail_image_list JSON COMMENT '站点详情图列表',
  price_info_list JSON COMMENT '多站点价格信息列表',
  cost_info_list JSON COMMENT '供货价信息列表',
  shelf_status_info_list JSON COMMENT '上下架信息列表',
  recycle_info_list JSON COMMENT '回收站状态信息列表',
  proof_of_stock_info_list JSON COMMENT '库存证明文件信息',
  supplier_barcode_list JSON COMMENT '供应商条码列表',
  sku_supplier_info JSON COMMENT 'SKU供应商信息',
  raw_data JSON COMMENT '原始完整数据',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_shop_id (shop_id),
  KEY idx_spu_name (spu_name),
  KEY idx_skc_name (skc_name),
  KEY idx_sku_code (sku_code),
  KEY idx_shelf_status (shelf_status),
  KEY idx_mall_state (mall_state),
  UNIQUE KEY uk_shop_sku (shop_id, sku_code),
  CONSTRAINT fk_shein_products_shop FOREIGN KEY (shop_id) 
    REFERENCES PlatformShops (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SHEIN商品详情表';

-- SHEIN商品列表查询表
CREATE TABLE IF NOT EXISTS SheinProductListQuery (
  id INT PRIMARY KEY AUTO_INCREMENT,
  shop_id INT NOT NULL COMMENT '店铺ID',
  spu_name VARCHAR(100) NOT NULL COMMENT 'SPU代码',
  skc_name VARCHAR(100) NOT NULL COMMENT 'SKC代码',
  sku_code_list JSON COMMENT 'SKU代码列表(数组)',
  insert_time DATETIME COMMENT '商品首次审核时间',
  update_time DATETIME COMMENT '商品更新时间',
  sync_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '同步时间',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_shop_id (shop_id),
  KEY idx_spu_name (spu_name),
  KEY idx_skc_name (skc_name),
  KEY idx_sync_time (sync_time),
  UNIQUE KEY uk_shop_skc (shop_id, skc_name),
  CONSTRAINT fk_product_list_query_shop FOREIGN KEY (shop_id) 
    REFERENCES PlatformShops (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SHEIN商品列表查询表';

-- SHEIN商品列表同步日志表
CREATE TABLE IF NOT EXISTS SheinProductListSyncLogs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  shop_id INT NOT NULL COMMENT '店铺ID',
  sync_type VARCHAR(50) NOT NULL COMMENT '同步类型: manual, scheduled, auto',
  page_num INT DEFAULT 1 COMMENT '页码',
  page_size INT DEFAULT 50 COMMENT '每页数量',
  insert_time_start DATETIME COMMENT '插入时间开始',
  insert_time_end DATETIME COMMENT '插入时间结束',
  update_time_start DATETIME COMMENT '更新时间开始',
  update_time_end DATETIME COMMENT '更新时间结束',
  total_count INT DEFAULT 0 COMMENT '总商品数',
  success_count INT DEFAULT 0 COMMENT '成功数',
  failed_count INT DEFAULT 0 COMMENT '失败数',
  sync_status VARCHAR(50) DEFAULT 'pending' COMMENT '同步状态: pending, running, completed, failed',
  error_message TEXT COMMENT '错误信息',
  trace_id VARCHAR(100) COMMENT '请求追踪ID',
  started_at DATETIME COMMENT '开始时间',
  completed_at DATETIME COMMENT '完成时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_shop_id (shop_id),
  KEY idx_sync_status (sync_status),
  KEY idx_created_at (created_at),
  CONSTRAINT fk_product_list_sync_shop FOREIGN KEY (shop_id) 
    REFERENCES PlatformShops (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SHEIN商品列表同步日志表';


-- ============================================================================
-- 库存管理表
-- ============================================================================

-- 库存查询历史表
CREATE TABLE IF NOT EXISTS inventory_query_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  shop_id INT NOT NULL COMMENT '店铺ID',
  query_type VARCHAR(50) NOT NULL COMMENT '查询类型: sku, skc, spu',
  query_params JSON NOT NULL COMMENT '查询参数',
  warehouse_type VARCHAR(10) NOT NULL COMMENT '仓库类型: 1-SHEIN仓库, 2-虚拟库存(半托管), 3-虚拟库存(全托管)',
  result_count INT DEFAULT 0 COMMENT '结果数量',
  query_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '查询时间',
  response_time INT COMMENT '响应时间(ms)',
  status VARCHAR(50) COMMENT '查询状态: success, failed',
  error_message TEXT COMMENT '错误信息',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_shop_id_query (shop_id),
  KEY idx_query_time (query_time),
  KEY idx_status_query (status),
  CONSTRAINT fk_inventory_query_shop FOREIGN KEY (shop_id) 
    REFERENCES PlatformShops (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存查询历史表';

-- 库存快照表
CREATE TABLE IF NOT EXISTS inventory_snapshots (
  id INT PRIMARY KEY AUTO_INCREMENT,
  shop_id INT NOT NULL COMMENT '店铺ID',
  sku_code VARCHAR(100) NOT NULL COMMENT 'SKU代码',
  spu_name VARCHAR(100) COMMENT 'SPU代码',
  skc_name VARCHAR(100) COMMENT 'SKC代码',
  product_name VARCHAR(500) COMMENT '商品名称',
  warehouse_type VARCHAR(10) NOT NULL COMMENT '仓库类型',
  total_inventory_quantity INT DEFAULT 0 COMMENT '总库存',
  total_usable_inventory INT DEFAULT 0 COMMENT '可用库存',
  total_locked_quantity INT DEFAULT 0 COMMENT '锁定库存',
  total_temp_lock_quantity INT DEFAULT 0 COMMENT '临时锁定库存',
  total_transit_quantity INT DEFAULT 0 COMMENT '在途库存',
  total_out_of_stock_qty INT DEFAULT 0 COMMENT '缺货数量',
  warehouse_inventory_list JSON COMMENT '仓库库存详情列表',
  snapshot_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '快照时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_shop_sku (shop_id, sku_code),
  KEY idx_snapshot_time (snapshot_time),
  KEY idx_warehouse_type (warehouse_type),
  KEY idx_shop_sku_time (shop_id, sku_code, snapshot_time DESC),
  CONSTRAINT fk_inventory_snapshot_shop FOREIGN KEY (shop_id) 
    REFERENCES PlatformShops (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存快照表';

-- 库存预警规则表
CREATE TABLE IF NOT EXISTS inventory_alert_rules (
  id INT PRIMARY KEY AUTO_INCREMENT,
  shop_id INT NOT NULL COMMENT '店铺ID',
  rule_name VARCHAR(100) NOT NULL COMMENT '规则名称',
  alert_type VARCHAR(50) NOT NULL COMMENT '预警类型: low_stock, out_of_stock, high_stock',
  threshold_value INT NOT NULL COMMENT '阈值',
  warehouse_type VARCHAR(10) COMMENT '仓库类型',
  alert_action VARCHAR(50) NOT NULL COMMENT '预警动作: email, sms, notification',
  alert_recipients JSON COMMENT '预警接收人列表',
  is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_shop_id_rules (shop_id),
  KEY idx_is_active (is_active),
  CONSTRAINT fk_inventory_alert_shop FOREIGN KEY (shop_id) 
    REFERENCES PlatformShops (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存预警规则表';

-- 库存预警表
CREATE TABLE IF NOT EXISTS inventory_alerts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  alert_rule_id INT NOT NULL COMMENT '预警规则ID',
  shop_id INT NOT NULL COMMENT '店铺ID',
  sku_code VARCHAR(100) NOT NULL COMMENT 'SKU代码',
  product_name VARCHAR(500) COMMENT '商品名称',
  alert_type VARCHAR(50) NOT NULL COMMENT '预警类型',
  current_inventory INT COMMENT '当前库存',
  threshold_value INT COMMENT '阈值',
  warehouse_type VARCHAR(10) COMMENT '仓库类型',
  alert_status VARCHAR(50) DEFAULT 'pending' COMMENT '预警状态: pending, processed, ignored',
  processed_at DATETIME COMMENT '处理时间',
  processed_by INT COMMENT '处理人ID',
  remarks TEXT COMMENT '备注',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_alert_rule (alert_rule_id),
  KEY idx_shop_id_alerts (shop_id),
  KEY idx_sku_code (sku_code),
  KEY idx_alert_status (alert_status),
  KEY idx_shop_status_time (shop_id, alert_status, created_at DESC),
  CONSTRAINT fk_inventory_alert_rule FOREIGN KEY (alert_rule_id) 
    REFERENCES inventory_alert_rules (id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_alert_shop_fk FOREIGN KEY (shop_id) 
    REFERENCES PlatformShops (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存预警表';

-- 库存同步任务表
CREATE TABLE IF NOT EXISTS inventory_sync_tasks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  shop_id INT NOT NULL COMMENT '店铺ID',
  task_name VARCHAR(100) COMMENT '任务名称',
  sync_type VARCHAR(50) NOT NULL COMMENT '同步类型: manual, scheduled, auto',
  warehouse_type VARCHAR(10) NOT NULL COMMENT '仓库类型',
  product_limit INT DEFAULT 100 COMMENT '商品限制',
  task_status VARCHAR(50) DEFAULT 'pending' COMMENT '任务状态: pending, running, completed, failed',
  progress_percentage INT DEFAULT 0 COMMENT '进度百分比',
  total_products INT DEFAULT 0 COMMENT '总商品数',
  synced_products INT DEFAULT 0 COMMENT '已同步商品数',
  failed_products INT DEFAULT 0 COMMENT '失败商品数',
  started_at DATETIME COMMENT '开始时间',
  completed_at DATETIME COMMENT '完成时间',
  error_message TEXT COMMENT '错误信息',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_shop_id_sync (shop_id),
  KEY idx_task_status (task_status),
  KEY idx_created_at_sync (created_at),
  CONSTRAINT fk_inventory_sync_shop FOREIGN KEY (shop_id) 
    REFERENCES PlatformShops (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存同步任务表';

-- 库存变更日志表
CREATE TABLE IF NOT EXISTS inventory_change_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  shop_id INT NOT NULL COMMENT '店铺ID',
  sku_code VARCHAR(100) NOT NULL COMMENT 'SKU代码',
  product_name VARCHAR(500) COMMENT '商品名称',
  warehouse_type VARCHAR(10) NOT NULL COMMENT '仓库类型',
  change_type VARCHAR(50) NOT NULL COMMENT '变更类型: increase, decrease, adjustment',
  old_inventory INT COMMENT '原库存',
  new_inventory INT COMMENT '新库存',
  change_quantity INT COMMENT '变更数量',
  change_reason VARCHAR(200) COMMENT '变更原因',
  operator_id INT COMMENT '操作人ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_shop_sku_log (shop_id, sku_code),
  KEY idx_created_at_log (created_at),
  KEY idx_change_type (change_type),
  KEY idx_shop_sku_time_log (shop_id, sku_code, created_at DESC),
  CONSTRAINT fk_inventory_log_shop FOREIGN KEY (shop_id) 
    REFERENCES PlatformShops (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存变更日志表';

-- ============================================================================
-- SHEIN采购单表
-- ============================================================================

-- SHEIN采购单主表
CREATE TABLE IF NOT EXISTS shein_purchase_orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  shop_id INT NOT NULL COMMENT '店铺ID',
  platform_id INT COMMENT '平台ID: 1=SHEIN, 5=TEMU, 6=TIKTOK',
  order_no VARCHAR(100) UNIQUE NOT NULL COMMENT '采购单号',
  type INT NOT NULL COMMENT '订单类型: 1=急采, 2=备货',
  type_name VARCHAR(50) COMMENT '订单类型名称',
  status INT NOT NULL COMMENT '订单状态',
  status_name VARCHAR(50) COMMENT '状态名称',
  supplier_name VARCHAR(200) COMMENT '供应商名称',
  supplier_code VARCHAR(100) COMMENT '供应商代码',
  currency VARCHAR(10) COMMENT '币种代码',
  currency_name VARCHAR(50) COMMENT '币种名称',
  currency_id INT COMMENT '币种ID',
  add_time DATETIME COMMENT '订单创建时间',
  allocate_time DATETIME COMMENT '订单分配时间',
  request_delivery_time DATETIME COMMENT '要求发货时间',
  request_receipt_time DATETIME COMMENT '要求收货时间',
  request_take_parcel_time DATETIME COMMENT '要求取件时间',
  delivery_time DATETIME COMMENT '发货时间',
  reserve_time DATETIME COMMENT '预约发货时间',
  receipt_time DATETIME COMMENT 'SHEIN仓库收货时间',
  check_time DATETIME COMMENT '质检完成时间',
  storage_time DATETIME COMMENT '仓库确认时间',
  return_time DATETIME COMMENT '退货时间',
  request_complete_time DATETIME COMMENT '要求完成时间(JIT场景)',
  update_time DATETIME COMMENT '更新时间',
  warehouse_name VARCHAR(100) COMMENT '收货仓库名称',
  storage_id VARCHAR(50) COMMENT 'SHEIN收货仓库ID',
  recommended_sub_warehouse_id VARCHAR(50) COMMENT '预估收货仓库ID',
  first_mark INT COMMENT '首单标记: 1=是, 2=否',
  first_mark_name VARCHAR(50) COMMENT '首单标记名称',
  is_jit_mother INT COMMENT 'JIT母单标记: 1=是, 2=否',
  is_jit_mother_name VARCHAR(50) COMMENT 'JIT母单标记名称',
  is_prior_production_name VARCHAR(50) COMMENT '是否优先生产',
  is_production_completion_name VARCHAR(50) COMMENT '是否生产完成',
  is_all_delivery_name VARCHAR(50) COMMENT '是否全部发货',
  is_delivery_name VARCHAR(50) COMMENT '是否发货',
  prepare_type_id INT COMMENT '备货类型ID',
  prepare_type_name VARCHAR(100) COMMENT '备货类型名称',
  category INT COMMENT '订单类别: 0=ODM, 1=线上, 2=线下',
  category_name VARCHAR(50) COMMENT '订单类别名称',
  order_mark_id INT COMMENT '订单标记ID',
  order_mark_name VARCHAR(100) COMMENT '订单标记名称',
  urgent_type INT COMMENT '紧急类型: 0=普通, 1=紧急, 2=特急',
  urgent_type_name VARCHAR(50) COMMENT '紧急类型名称',
  country_market INT COMMENT '国家市场: 0=默认, 1=南美, 2=北美',
  request_delivery_quantity INT COMMENT 'JIT母单已下子单数量',
  no_request_delivery_quantity INT COMMENT 'JIT母单未下子单数量',
  already_delivery_quantity INT COMMENT 'JIT母单已发货总数',
  order_supervisor VARCHAR(100) COMMENT '订单负责人',
  add_uid VARCHAR(100) COMMENT '添加人',
  custom_info_id VARCHAR(100) COMMENT '自定义信息ID',
  custom_info JSON COMMENT '自定义信息',
  order_label_info JSON COMMENT '备货单标签信息',
  goods_level JSON COMMENT '备货单商品层次信息',
  attribute_version INT COMMENT '属性版本',
  is_increment_on_way INT COMMENT '是否在途增量: 1=是, 2=否',
  trace_id VARCHAR(100) COMMENT '请求唯一标识',
  raw_data JSON COMMENT '原始完整数据',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_shop_id (shop_id),
  KEY idx_order_no (order_no),
  KEY idx_type (type),
  KEY idx_status (status),
  KEY idx_add_time (add_time),
  KEY idx_allocate_time (allocate_time),
  KEY idx_update_time (update_time),
  KEY idx_supplier_code (supplier_code),
  CONSTRAINT fk_shein_purchase_orders_shop FOREIGN KEY (shop_id) 
    REFERENCES PlatformShops (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SHEIN采购单主表';

-- SHEIN采购单标签表
CREATE TABLE IF NOT EXISTS shein_purchase_order_labels (
  id INT PRIMARY KEY AUTO_INCREMENT,
  purchase_order_id INT NOT NULL COMMENT '采购单ID',
  order_label INT NOT NULL COMMENT '标签枚举值',
  order_label_name VARCHAR(100) COMMENT '标签名称',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_purchase_order_id (purchase_order_id),
  CONSTRAINT fk_purchase_order_labels FOREIGN KEY (purchase_order_id) 
    REFERENCES shein_purchase_orders (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SHEIN采购单标签表';

-- SHEIN采购单商品等级表
CREATE TABLE IF NOT EXISTS shein_purchase_order_goods_levels (
  id INT PRIMARY KEY AUTO_INCREMENT,
  purchase_order_id INT NOT NULL COMMENT '采购单ID',
  goods_level INT NOT NULL COMMENT '商品等级枚举值',
  goods_level_name VARCHAR(100) COMMENT '商品等级名称',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_purchase_order_id (purchase_order_id),
  CONSTRAINT fk_purchase_order_goods_levels FOREIGN KEY (purchase_order_id) 
    REFERENCES shein_purchase_orders (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SHEIN采购单商品等级表';

-- SHEIN采购单明细表(SKU级别)
CREATE TABLE IF NOT EXISTS shein_purchase_order_details (
  id INT PRIMARY KEY AUTO_INCREMENT,
  purchase_order_id INT NOT NULL COMMENT '采购单ID',
  order_no VARCHAR(100) COMMENT '采购单号（冗余字段便于查询）',
  skc VARCHAR(100) NOT NULL COMMENT 'SHEIN SKC代码',
  sku_code VARCHAR(100) COMMENT 'SHEIN SKU代码',
  sku_img TEXT COMMENT 'SKU图片URL',
  suffix_zh VARCHAR(200) COMMENT 'SKU属性(如: Brown-28 inch)',
  supplier_sku VARCHAR(100) COMMENT '供应商SKU',
  supplier_code VARCHAR(100) COMMENT '供应商代码(SKC维度)',
  img_path TEXT COMMENT 'SKC图片URL',
  price DECIMAL(12, 2) COMMENT '结算价格',
  currency_name VARCHAR(50) COMMENT '币种名称',
  need_quantity INT COMMENT '需求数量',
  order_quantity INT COMMENT '下单数量',
  delivery_quantity INT COMMENT '发货数量',
  receipt_quantity INT COMMENT '收货数量',
  storage_quantity INT COMMENT '入库数量',
  defective_quantity INT COMMENT '次品数量',
  request_delivery_quantity INT COMMENT 'JIT母单已下子单数量',
  no_request_delivery_quantity INT COMMENT 'JIT母单未下子单数量',
  already_delivery_quantity INT COMMENT 'JIT母单已发货总数',
  remark TEXT COMMENT '备注',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_purchase_order_id (purchase_order_id),
  KEY idx_order_no (order_no),
  KEY idx_skc (skc),
  KEY idx_sku_code (sku_code),
  KEY idx_supplier_code (supplier_code),
  CONSTRAINT fk_purchase_order_details FOREIGN KEY (purchase_order_id) 
    REFERENCES shein_purchase_orders (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SHEIN采购单明细表';

-- SHEIN采购单同步日志表
CREATE TABLE IF NOT EXISTS shein_purchase_order_sync_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  shop_id INT NOT NULL COMMENT '店铺ID',
  sync_type VARCHAR(50) NOT NULL COMMENT '同步类型: manual, scheduled, auto',
  query_params JSON COMMENT '查询参数',
  total_count INT DEFAULT 0 COMMENT '总同步数',
  success_count INT DEFAULT 0 COMMENT '成功数',
  failed_count INT DEFAULT 0 COMMENT '失败数',
  sync_status VARCHAR(50) DEFAULT 'pending' COMMENT '同步状态: pending, running, completed, failed',
  error_message TEXT COMMENT '错误信息',
  started_at DATETIME COMMENT '开始时间',
  completed_at DATETIME COMMENT '完成时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_shop_id (shop_id),
  KEY idx_sync_status (sync_status),
  KEY idx_created_at (created_at),
  CONSTRAINT fk_purchase_order_sync_logs FOREIGN KEY (shop_id) 
    REFERENCES PlatformShops (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SHEIN采购单同步日志表';


-- ============================================================================
-- 发货单管理表
-- ============================================================================

-- SHEIN发货单主表（新）
CREATE TABLE IF NOT EXISTS shein_delivery_notes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  shop_id INT NOT NULL COMMENT '店铺ID',
  platform_id INT COMMENT '平台ID: 1=SHEIN, 5=TEMU, 6=TIKTOK',
  delivery_code VARCHAR(100) NOT NULL COMMENT '发货单号',
  delivery_type TINYINT COMMENT '发货方式：1=快递，2=送货上门，3=定点收货',
  delivery_type_name VARCHAR(50) COMMENT '发货方式名称',
  express_id VARCHAR(100) COMMENT '快递公司ID',
  express_company_name VARCHAR(100) COMMENT '快递公司名称',
  express_code VARCHAR(100) COMMENT '快递单号/物流单号',
  send_package INT DEFAULT 0 COMMENT '包裹总数',
  package_weight DECIMAL(10,2) DEFAULT 0.00 COMMENT '包裹重量(kg)',
  take_parcel_time DATETIME COMMENT '实际取件时间',
  reserve_parcel_time DATETIME COMMENT '预约取件时间',
  add_time DATETIME COMMENT '发货时间/创建时间',
  pre_receipt_time DATETIME COMMENT '预计到货时间',
  receipt_time DATETIME COMMENT '实际到货时间',
  supplier_warehouse_id BIGINT COMMENT '仓库ID',
  supplier_warehouse_name VARCHAR(200) COMMENT '仓库名称',
  total_sku_count INT DEFAULT 0 COMMENT '总SKU数量',
  total_delivery_quantity INT DEFAULT 0 COMMENT '总发货数量',
  raw_data JSON COMMENT '原始完整数据',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_shop_delivery (shop_id, delivery_code),
  KEY idx_shop_id (shop_id),
  KEY idx_delivery_code (delivery_code),
  KEY idx_add_time (add_time),
  KEY idx_express_code (express_code),
  KEY idx_shop_add_time (shop_id, add_time DESC),
  CONSTRAINT fk_shein_delivery_notes_shop FOREIGN KEY (shop_id) 
    REFERENCES PlatformShops (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SHEIN发货单主表';

-- SHEIN发货单明细表（新）
CREATE TABLE IF NOT EXISTS shein_delivery_note_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  delivery_note_id INT NOT NULL COMMENT '发货单ID',
  delivery_code VARCHAR(100) NOT NULL COMMENT '发货单号（冗余，便于查询）',
  skc VARCHAR(100) NOT NULL COMMENT 'SKC编码',
  sku_code VARCHAR(100) COMMENT 'SKU编码',
  order_no VARCHAR(100) COMMENT '关联的采购订单号',
  delivery_quantity INT DEFAULT 0 COMMENT '发货数量',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_delivery_sku_order (delivery_code, sku_code, order_no),
  KEY idx_delivery_note_id (delivery_note_id),
  KEY idx_delivery_code (delivery_code),
  KEY idx_skc (skc),
  KEY idx_sku_code (sku_code),
  KEY idx_order_no (order_no),
  CONSTRAINT fk_shein_delivery_note_items FOREIGN KEY (delivery_note_id) 
    REFERENCES shein_delivery_notes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SHEIN发货单明细表';

-- SHEIN发货单同步日志表（新）
CREATE TABLE IF NOT EXISTS shein_delivery_note_sync_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  shop_id INT NOT NULL COMMENT '店铺ID',
  sync_type VARCHAR(50) NOT NULL COMMENT '同步类型: manual, scheduled, auto, by_code',
  query_params JSON COMMENT '查询参数',
  total_count INT DEFAULT 0 COMMENT '总同步数',
  success_count INT DEFAULT 0 COMMENT '成功数',
  failed_count INT DEFAULT 0 COMMENT '失败数',
  sync_status VARCHAR(50) DEFAULT 'pending' COMMENT '同步状态: pending, running, completed, failed',
  error_message TEXT COMMENT '错误信息',
  started_at DATETIME COMMENT '开始时间',
  completed_at DATETIME COMMENT '完成时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_shop_id (shop_id),
  KEY idx_sync_status (sync_status),
  KEY idx_created_at (created_at),
  CONSTRAINT fk_delivery_note_sync_logs FOREIGN KEY (shop_id) 
    REFERENCES PlatformShops (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SHEIN发货单同步日志表';





-- ============================================================================
-- ERP产品管理表 (支持多平台刊登)
-- ============================================================================

-- ERP产品主表
CREATE TABLE IF NOT EXISTS erp_products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_code VARCHAR(100) UNIQUE NOT NULL COMMENT 'ERP产品编码',
  
  -- 基本信息
  product_name_cn VARCHAR(500) COMMENT '商品名称(中文)',
  product_name_en VARCHAR(500) COMMENT '商品名称(英文)',
  product_name_multi JSON COMMENT '多语言商品名称 {"en":"xxx","zh":"xxx","de":"xxx"}',
  product_desc TEXT COMMENT '商品描述',
  product_desc_multi JSON COMMENT '多语言商品描述',
  product_desc_html TEXT COMMENT '商品描述HTML格式(TikTok)',
  
  -- 品牌信息
  brand VARCHAR(200) COMMENT '品牌名称',
  brand_id VARCHAR(100) COMMENT '品牌ID(TikTok)',
  brand_code VARCHAR(100) COMMENT '品牌编码(SHEIN)',
  brand_name VARCHAR(200) COMMENT '品牌名称',
  
  -- 分类信息
  category VARCHAR(200) COMMENT '类目名称',
  category_id VARCHAR(100) COMMENT '末级类目ID',
  category_path JSON COMMENT '类目路径 [cat1Id, cat2Id, cat3Id]',
  category_name VARCHAR(500) COMMENT '类目名称路径',
  
  -- 仓库信息
  warehouse_id VARCHAR(100) COMMENT '仓库ID',
  warehouse_name VARCHAR(200) COMMENT '仓库名称',
  
  -- 商品属性
  product_attributes JSON COMMENT '商品属性列表',
  
  -- 主图
  main_images JSON COMMENT '主图/轮播图URL列表',
  
  -- 尺寸重量
  weight INT COMMENT '重量(g)',
  length DECIMAL(10,2) COMMENT '长度(cm)',
  width DECIMAL(10,2) COMMENT '宽度(cm)',
  height DECIMAL(10,2) COMMENT '高度(cm)',
  package_length DECIMAL(10,2) COMMENT '包裹长度(cm)',
  package_width DECIMAL(10,2) COMMENT '包裹宽度(cm)',
  package_height DECIMAL(10,2) COMMENT '包裹高度(cm)',
  package_weight INT COMMENT '包裹重量(g)',
  
  -- 价格信息
  cost_price DECIMAL(10,2) COMMENT '成本价',
  suggested_price DECIMAL(10,2) COMMENT '建议零售价',
  currency VARCHAR(10) DEFAULT 'CNY' COMMENT '币种',
  
  -- 商家编码
  supplier_code VARCHAR(100) COMMENT '商家/供应商编码',
  
  -- 状态
  status TINYINT DEFAULT 1 COMMENT '状态: 1-草稿, 2-已发布',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_product_code (product_code),
  INDEX idx_status (status),
  INDEX idx_product_name_cn (product_name_cn(100)),
  INDEX idx_brand (brand),
  INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='ERP产品主表';

-- ERP产品图片表
CREATE TABLE IF NOT EXISTS erp_product_images (
  id INT PRIMARY KEY AUTO_INCREMENT,
  erp_product_id INT NOT NULL COMMENT 'ERP产品ID',
  image_url TEXT NOT NULL COMMENT '图片URL',
  image_type TINYINT NOT NULL COMMENT '图片类型: 1-主图, 2-详情图, 5-方图, 6-颜色图',
  sort_order INT DEFAULT 0 COMMENT '排序',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (erp_product_id) REFERENCES erp_products(id) ON DELETE CASCADE,
  INDEX idx_erp_product (erp_product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='ERP产品图片表';

-- ERP产品SKU表
CREATE TABLE IF NOT EXISTS erp_product_skus (
  id INT PRIMARY KEY AUTO_INCREMENT,
  erp_product_id INT NOT NULL COMMENT 'ERP产品ID',
  
  -- SKU编码
  sku_code VARCHAR(200) NOT NULL COMMENT 'SKU编码',
  supplier_sku VARCHAR(200) COMMENT '商家SKU编码(SHEIN)',
  ext_code VARCHAR(200) COMMENT '外部编码(TEMU)',
  seller_sku VARCHAR(200) COMMENT '卖家SKU(TikTok)',
  
  -- 销售属性
  color VARCHAR(100) COMMENT '颜色',
  size VARCHAR(100) COMMENT '尺码',
  spec_1 VARCHAR(100) COMMENT '规格1',
  spec_2 VARCHAR(100) COMMENT '规格2',
  sale_attributes JSON COMMENT '销售属性 [{"attr_id":"xxx","value_id":"xxx","value":"xxx"}]',
  
  -- SKU图片
  sku_image VARCHAR(500) COMMENT 'SKU图片URL',
  color_image VARCHAR(500) COMMENT '颜色图片URL',
  
  -- 库存
  stock_quantity INT DEFAULT 0 COMMENT '库存数量',
  
  -- 价格
  cost_price DECIMAL(10,2) COMMENT 'SKU成本价',
  sale_price DECIMAL(10,2) COMMENT 'SKU销售价',
  supply_price DECIMAL(10,2) COMMENT '供货价',
  suggested_retail_price DECIMAL(10,2) COMMENT '建议零售价',
  currency VARCHAR(10) DEFAULT 'CNY' COMMENT '币种',
  
  -- 重量尺寸
  weight INT COMMENT '重量(g)',
  length DECIMAL(10,2) COMMENT '长度(cm)',
  width DECIMAL(10,2) COMMENT '宽度(cm)',
  height DECIMAL(10,2) COMMENT '高度(cm)',
  package_length DECIMAL(10,2) COMMENT 'SKU包裹长度(cm)',
  package_width DECIMAL(10,2) COMMENT 'SKU包裹宽度(cm)',
  package_height DECIMAL(10,2) COMMENT 'SKU包裹高度(cm)',
  package_weight INT COMMENT 'SKU包裹重量(g)',
  
  -- 条码
  barcode VARCHAR(100) COMMENT '商品条码',
  upc VARCHAR(100) COMMENT 'UPC码',
  ean VARCHAR(100) COMMENT 'EAN码',
  
  -- 状态
  status TINYINT DEFAULT 1 COMMENT '状态: 1-启用, 2-禁用',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (erp_product_id) REFERENCES erp_products(id) ON DELETE CASCADE,
  UNIQUE KEY uk_sku_code (sku_code),
  INDEX idx_erp_product (erp_product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='ERP产品SKU表';

-- ERP产品属性详情表
CREATE TABLE IF NOT EXISTS erp_product_attributes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  erp_product_id INT NOT NULL COMMENT 'ERP产品ID',
  attribute_id VARCHAR(100) NOT NULL COMMENT '属性ID',
  attribute_name VARCHAR(200) COMMENT '属性名称',
  attribute_value_id VARCHAR(100) COMMENT '属性值ID',
  attribute_value VARCHAR(500) COMMENT '属性值',
  is_required BOOLEAN DEFAULT FALSE COMMENT '是否必填',
  platform VARCHAR(50) COMMENT '适用平台: all, shein, temu, tiktok',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_erp_product (erp_product_id),
  INDEX idx_attribute_id (attribute_id),
  FOREIGN KEY (erp_product_id) REFERENCES erp_products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='ERP商品属性详情表';

-- ERP产品多语言信息表
CREATE TABLE IF NOT EXISTS erp_product_multi_lang (
  id INT PRIMARY KEY AUTO_INCREMENT,
  erp_product_id INT NOT NULL COMMENT 'ERP产品ID',
  language_code VARCHAR(10) NOT NULL COMMENT '语言代码: en, zh, de, fr, es, etc',
  product_name VARCHAR(500) COMMENT '商品名称',
  product_desc TEXT COMMENT '商品描述',
  keywords VARCHAR(500) COMMENT '关键词',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_product_lang (erp_product_id, language_code),
  INDEX idx_erp_product (erp_product_id),
  FOREIGN KEY (erp_product_id) REFERENCES erp_products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='ERP商品多语言信息表';

-- ERP产品平台映射表
CREATE TABLE IF NOT EXISTS erp_product_platform_mapping (
  id INT PRIMARY KEY AUTO_INCREMENT,
  erp_product_id INT NOT NULL COMMENT 'ERP产品ID',
  platform_id INT NOT NULL COMMENT '平台ID: 1-SHEIN, 2-TEMU, 3-TIKTOK',
  shop_id INT NOT NULL COMMENT '店铺ID',
  platform_product_id VARCHAR(200) COMMENT '平台商品ID (如SHEIN spu_name)',
  platform_category_id VARCHAR(200) COMMENT '平台类目ID',
  platform_category_path JSON COMMENT '平台类目路径',
  platform_brand_code VARCHAR(200) COMMENT '平台品牌编码',
  platform_warehouse_id VARCHAR(100) COMMENT '平台仓库ID',
  platform_attributes JSON COMMENT '平台特定属性配置',
  platform_config TEXT COMMENT '平台特定配置(JSON)',
  publish_config JSON COMMENT '发布配置(物流、运费等)',
  publish_status TINYINT DEFAULT 0 COMMENT '发布状态: 0-未发布, 1-已发布, 2-审核中, 3-被拒绝',
  publish_time TIMESTAMP NULL COMMENT '发布时间',
  audit_message TEXT COMMENT '审核信息',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (erp_product_id) REFERENCES erp_products(id) ON DELETE CASCADE,
  UNIQUE KEY uk_erp_platform_shop (erp_product_id, platform_id, shop_id),
  INDEX idx_platform_product (platform_product_id),
  INDEX idx_publish_status (publish_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='ERP产品平台映射表';

-- ERP SKU平台映射表
CREATE TABLE IF NOT EXISTS erp_sku_platform_mapping (
  id INT PRIMARY KEY AUTO_INCREMENT,
  erp_sku_id INT NOT NULL COMMENT 'ERP SKU ID',
  platform_mapping_id INT NOT NULL COMMENT '平台映射ID',
  platform_sku_code VARCHAR(200) COMMENT '平台SKU编码',
  platform_sku_id VARCHAR(200) COMMENT '平台SKU ID',
  platform_price DECIMAL(10,2) COMMENT '平台价格',
  platform_stock INT COMMENT '平台库存',
  platform_sale_attributes JSON COMMENT '平台SKU销售属性',
  platform_sku_image VARCHAR(500) COMMENT '平台SKU图片',
  platform_inventory INT COMMENT '平台库存数量',
  platform_sku_status TINYINT DEFAULT 1 COMMENT '平台SKU状态: 1-启用, 2-禁用',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (erp_sku_id) REFERENCES erp_product_skus(id) ON DELETE CASCADE,
  FOREIGN KEY (platform_mapping_id) REFERENCES erp_product_platform_mapping(id) ON DELETE CASCADE,
  INDEX idx_erp_sku (erp_sku_id),
  INDEX idx_platform_mapping (platform_mapping_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='ERP SKU平台映射表';


-- ============================================================================
-- 商品刊登管理表
-- ============================================================================

-- 商品刊登草稿表
CREATE TABLE IF NOT EXISTS publish_drafts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(500) NOT NULL COMMENT '商品标题',
  draft_type ENUM('platform', 'erp') NOT NULL COMMENT '草稿类型: platform=按平台刊登, erp=ERP产品刊登',
  erp_product_id INT COMMENT 'ERP产品ID (仅erp类型)',
  
  -- 商品基本信息
  product_name_en VARCHAR(1000) COMMENT '商品名称(英文)',
  product_name_cn VARCHAR(1000) COMMENT '商品名称(中文)',
  product_desc TEXT COMMENT '商品描述',
  price DECIMAL(10, 2) COMMENT '价格',
  stock INT COMMENT '库存',
  sku VARCHAR(100) COMMENT 'SKU编码',
  
  -- 图片信息 (JSON格式存储)
  images JSON COMMENT '商品图片列表',
  main_image VARCHAR(500) COMMENT '主图URL',
  
  -- 平台配置 (JSON格式存储)
  platforms JSON COMMENT '目标平台列表 ["shein", "temu", "tiktok"]',
  platform_configs JSON COMMENT '各平台配置信息',
  
  -- 完整草稿数据 (JSON格式存储所有表单数据)
  draft_data JSON COMMENT '完整的草稿数据',
  
  -- 元数据
  created_by INT COMMENT '创建人ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  INDEX idx_draft_type (draft_type),
  INDEX idx_created_by (created_by),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (erp_product_id) REFERENCES erp_products(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES Users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品刊登草稿表';

-- 商品发布记录表
CREATE TABLE IF NOT EXISTS publish_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  draft_id INT COMMENT '关联的草稿ID',
  
  -- 商品信息
  product_name VARCHAR(500) NOT NULL COMMENT '商品名称',
  product_name_en VARCHAR(1000) COMMENT '商品名称(英文)',
  product_name_cn VARCHAR(1000) COMMENT '商品名称(中文)',
  main_image VARCHAR(500) COMMENT '主图URL',
  price DECIMAL(10, 2) COMMENT '价格',
  stock INT COMMENT '库存',
  sku VARCHAR(100) COMMENT 'SKU编码',
  
  -- 发布信息
  platform ENUM('shein', 'temu', 'tiktok') NOT NULL COMMENT '发布平台',
  platform_product_id VARCHAR(100) COMMENT '平台商品ID',
  platform_sku VARCHAR(100) COMMENT '平台SKU',
  publish_type ENUM('platform', 'erp') NOT NULL COMMENT '发布类型',
  erp_product_id INT COMMENT 'ERP产品ID',
  
  -- 状态信息
  status ENUM('pending', 'success', 'failed') DEFAULT 'pending' COMMENT '发布状态',
  error_message TEXT COMMENT '错误信息',
  error_code VARCHAR(50) COMMENT '错误代码',
  
  -- API请求响应
  request_data JSON COMMENT '发布请求数据',
  response_data JSON COMMENT 'API响应数据',
  
  -- 元数据
  published_by INT COMMENT '发布人ID',
  published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '发布时间',
  completed_at TIMESTAMP NULL COMMENT '完成时间',
  retry_count INT DEFAULT 0 COMMENT '重试次数',
  
  INDEX idx_platform (platform),
  INDEX idx_status (status),
  INDEX idx_publish_type (publish_type),
  INDEX idx_published_at (published_at),
  INDEX idx_platform_product_id (platform_product_id),
  INDEX idx_published_by (published_by),
  FOREIGN KEY (draft_id) REFERENCES publish_drafts(id) ON DELETE SET NULL,
  FOREIGN KEY (erp_product_id) REFERENCES erp_products(id) ON DELETE SET NULL,
  FOREIGN KEY (published_by) REFERENCES Users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品发布记录表';

-- 发布记录日志表
CREATE TABLE IF NOT EXISTS publish_record_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  publish_record_id INT NOT NULL COMMENT '发布记录ID',
  
  -- 日志信息
  log_type ENUM('info', 'warning', 'error') DEFAULT 'info' COMMENT '日志类型',
  message TEXT COMMENT '日志消息',
  details JSON COMMENT '详细信息',
  
  -- 元数据
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  
  INDEX idx_publish_record_id (publish_record_id),
  INDEX idx_log_type (log_type),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (publish_record_id) REFERENCES publish_records(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='发布记录日志表';

-- ============================================================================
-- 合规标签管理表
-- ============================================================================

-- 合规标签模板表
CREATE TABLE IF NOT EXISTS compliance_label_templates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  template_name VARCHAR(200) NOT NULL COMMENT '模板名称',
  template_desc TEXT COMMENT '模板描述',
  label_width INT NOT NULL DEFAULT 100 COMMENT '标签宽度(mm)',
  label_height INT NOT NULL DEFAULT 70 COMMENT '标签高度(mm)',
  elements JSON NOT NULL COMMENT '标签元素列表(JSON)',
  is_default BOOLEAN DEFAULT FALSE COMMENT '是否默认模板',
  category VARCHAR(50) DEFAULT 'compliance' COMMENT '模板分类: all, factory, brand, compliance, shein, shein-compliance, temu, temu-compliance',
  created_by INT COMMENT '创建人ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_template_name (template_name),
  INDEX idx_is_default (is_default),
  INDEX idx_category (category),
  INDEX idx_created_by (created_by),
  FOREIGN KEY (created_by) REFERENCES Users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='合规标签模板表';

-- 合规标签打印记录表
CREATE TABLE IF NOT EXISTS compliance_label_print_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  template_id INT COMMENT '使用的模板ID',
  template_name VARCHAR(200) COMMENT '模板名称(冗余)',
  product_ids JSON COMMENT '打印的商品ID列表',
  product_skus JSON COMMENT '打印的商品SKU列表',
  print_count INT DEFAULT 1 COMMENT '打印份数',
  label_data JSON COMMENT '标签数据(包含所有打印内容)',
  print_status ENUM('pending', 'printing', 'completed', 'failed') DEFAULT 'pending' COMMENT '打印状态',
  printed_by INT COMMENT '打印人ID',
  printed_at TIMESTAMP NULL COMMENT '打印时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_template_id (template_id),
  INDEX idx_print_status (print_status),
  INDEX idx_printed_by (printed_by),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (template_id) REFERENCES compliance_label_templates(id) ON DELETE SET NULL,
  FOREIGN KEY (printed_by) REFERENCES Users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='合规标签打印记录表';

-- 标签素材库表
CREATE TABLE IF NOT EXISTS label_materials (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL COMMENT '素材名称',
  category VARCHAR(50) NOT NULL DEFAULT 'image' COMMENT '素材类型: image, icon, logo, certification, text_template',
  sub_category VARCHAR(100) COMMENT '子分类: ce_mark, fcc, ukca, rohs, weee, etc',
  content_type VARCHAR(20) NOT NULL DEFAULT 'url' COMMENT '内容类型: url, base64, svg, text',
  content LONGTEXT NOT NULL COMMENT '素材内容(URL/Base64/SVG代码/文本)',
  thumbnail TEXT COMMENT '缩略图(Base64或URL)',
  width INT COMMENT '默认宽度(px)',
  height INT COMMENT '默认高度(px)',
  description TEXT COMMENT '素材描述',
  tags JSON COMMENT '标签(用于搜索)',
  is_system BOOLEAN DEFAULT FALSE COMMENT '是否系统内置素材',
  is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
  sort_order INT DEFAULT 0 COMMENT '排序顺序',
  created_by INT COMMENT '创建人ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_sub_category (sub_category),
  INDEX idx_is_system (is_system),
  INDEX idx_is_active (is_active),
  INDEX idx_sort_order (sort_order),
  FOREIGN KEY (created_by) REFERENCES Users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='标签素材库表';

-- ============================================================================
-- Webhook日志表
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhook_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  event_type VARCHAR(100) NOT NULL COMMENT '事件类型',
  source VARCHAR(50) NOT NULL DEFAULT 'shein_webhook' COMMENT '来源',
  order_no VARCHAR(100) DEFAULT NULL COMMENT '订单号/采购单号',
  spu_name VARCHAR(100) DEFAULT NULL COMMENT 'SPU名称',
  skc_name VARCHAR(100) DEFAULT NULL COMMENT 'SKC名称',
  sku_code VARCHAR(100) DEFAULT NULL COMMENT 'SKU代码',
  request_data TEXT COMMENT '请求数据(JSON)',
  response_data TEXT COMMENT '响应数据(JSON)',
  status ENUM('success','error','processing') DEFAULT 'success' COMMENT '处理状态',
  error_message TEXT COMMENT '错误信息',
  processed_at DATETIME DEFAULT NULL COMMENT '处理时间',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_event_type (event_type),
  INDEX idx_source (source),
  INDEX idx_order_no (order_no),
  INDEX idx_spu_name (spu_name),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Webhook日志表';

-- ============================================================================
-- 插入默认配置数据
-- ============================================================================

-- 插入平台配置
INSERT INTO PlatformConfigs (
  platform_name,
  platform_display_name,
  app_id,
  app_secret,
  callback_url,
  api_environment,
  api_domain,
  is_active,
  remarks
) VALUES 
(
  'shein_full',
  'SHEIN(Full托管)',
  'YOUR_SHEIN_APP_ID',
  'YOUR_SHEIN_APP_SECRET',
  'http://localhost:3000/shein-callback',
  'production',
  'https://openapi.sheincorp.com',
  TRUE,
  'SHEIN full托管平台默认配置'
),
(
  'amazon',
  'Amazon',
  'YOUR_AMAZON_APP_ID',
  'YOUR_AMAZON_APP_SECRET',
  'http://localhost:3000/amazon-callback',
  'production',
  'https://api.amazon.com',
  FALSE,
  'Amazon平台默认配置'
),
(
  'ebay',
  'eBay',
  'YOUR_EBAY_APP_ID',
  'YOUR_EBAY_APP_SECRET',
  'http://localhost:3000/ebay-callback',
  'production',
  'https://api.ebay.com',
  FALSE,
  'eBay平台默认配置'
)
ON DUPLICATE KEY UPDATE
  platform_display_name = VALUES(platform_display_name),
  api_environment = VALUES(api_environment),
  api_domain = VALUES(api_domain),
  remarks = VALUES(remarks);

-- 插入默认合规标签模板
INSERT INTO compliance_label_templates (template_name, template_desc, label_width, label_height, elements, is_default) VALUES
('默认合规标签模板', 'EU CE标签默认模板', 100, 70, '[
  {"id": 1, "type": "text", "content": "Manufacturer", "x": 10, "y": 10, "width": 150, "height": 30, "fontSize": 12, "fontWeight": "bold"},
  {"id": 2, "type": "text", "content": "Company Name", "x": 170, "y": 10, "width": 200, "height": 30, "fontSize": 12},
  {"id": 3, "type": "text", "content": "Manufacturer Address", "x": 10, "y": 50, "width": 150, "height": 30, "fontSize": 12, "fontWeight": "bold"},
  {"id": 4, "type": "text", "content": "Address Line", "x": 170, "y": 50, "width": 200, "height": 50, "fontSize": 10},
  {"id": 5, "type": "text", "content": "EC REP", "x": 10, "y": 150, "width": 80, "height": 30, "fontSize": 12, "fontWeight": "bold", "border": true},
  {"id": 6, "type": "text", "content": "MADE IN CHINA", "x": 10, "y": 270, "width": 360, "height": 30, "fontSize": 14, "fontWeight": "bold", "textAlign": "center"}
]', TRUE)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- 插入系统默认素材
INSERT INTO label_materials (name, category, sub_category, content_type, content, width, height, is_system, sort_order) VALUES
('CE标识', 'certification', 'ce_mark', 'svg', '<svg viewBox="0 0 100 60"><text x="5" y="45" font-size="40" font-weight="bold" font-family="Arial">CE</text></svg>', 60, 40, TRUE, 1),
('FCC标识', 'certification', 'fcc', 'svg', '<svg viewBox="0 0 100 40"><text x="5" y="30" font-size="24" font-weight="bold" font-family="Arial">FCC</text></svg>', 60, 30, TRUE, 2),
('UKCA标识', 'certification', 'ukca', 'svg', '<svg viewBox="0 0 100 40"><text x="5" y="30" font-size="20" font-weight="bold" font-family="Arial">UKCA</text></svg>', 60, 30, TRUE, 3),
('RoHS标识', 'certification', 'rohs', 'svg', '<svg viewBox="0 0 100 40"><text x="5" y="30" font-size="20" font-weight="bold" font-family="Arial">RoHS</text></svg>', 60, 30, TRUE, 4),
('MADE IN CHINA', 'text_template', 'origin', 'text', 'MADE IN CHINA', 150, 30, TRUE, 20),
('EC REP', 'text_template', 'representative', 'text', 'EC REP', 80, 30, TRUE, 21),
('UK REP', 'text_template', 'representative', 'text', 'UK REP', 80, 30, TRUE, 22),
('Manufacturer', 'text_template', 'label', 'text', 'Manufacturer', 120, 25, TRUE, 23),
('Importer', 'text_template', 'label', 'text', 'Importer', 100, 25, TRUE, 24)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- ============================================================================
-- 性能优化索引
-- ============================================================================

-- SheinProducts表性能优化索引
SET @exist := (SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema = DATABASE() AND table_name = 'SheinProducts' AND index_name = 'idx_skc_updated');
SET @sqlstmt := IF(@exist = 0, 
  'ALTER TABLE SheinProducts ADD INDEX idx_skc_updated (skc_name, updatedAt DESC)', 
  'SELECT "Index idx_skc_updated already exists" AS message');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema = DATABASE() AND table_name = 'SheinProducts' AND index_name = 'idx_shop_skc_updated');
SET @sqlstmt := IF(@exist = 0, 
  'ALTER TABLE SheinProducts ADD INDEX idx_shop_skc_updated (shop_id, skc_name, updatedAt DESC)', 
  'SELECT "Index idx_shop_skc_updated already exists" AS message');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema = DATABASE() AND table_name = 'SheinProducts' AND index_name = 'idx_product_name_cn');
SET @sqlstmt := IF(@exist = 0, 
  'ALTER TABLE SheinProducts ADD INDEX idx_product_name_cn (product_name_cn(100))', 
  'SELECT "Index idx_product_name_cn already exists" AS message');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- shein_purchase_orders表性能优化索引
SET @exist := (SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema = DATABASE() AND table_name = 'shein_purchase_orders' AND index_name = 'idx_shop_status_time');
SET @sqlstmt := IF(@exist = 0, 
  'ALTER TABLE shein_purchase_orders ADD INDEX idx_shop_status_time (shop_id, status, update_time DESC)', 
  'SELECT "Index idx_shop_status_time already exists" AS message');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema = DATABASE() AND table_name = 'shein_purchase_orders' AND index_name = 'idx_shop_type_time');
SET @sqlstmt := IF(@exist = 0, 
  'ALTER TABLE shein_purchase_orders ADD INDEX idx_shop_type_time (shop_id, type, allocate_time DESC)', 
  'SELECT "Index idx_shop_type_time already exists" AS message');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- shein_purchase_order_details表性能优化索引
SET @exist := (SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema = DATABASE() AND table_name = 'shein_purchase_order_details' AND index_name = 'idx_purchase_order_skc');
SET @sqlstmt := IF(@exist = 0, 
  'ALTER TABLE shein_purchase_order_details ADD INDEX idx_purchase_order_skc (purchase_order_id, skc)', 
  'SELECT "Index idx_purchase_order_skc already exists" AS message');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- DeliveryOrders表性能优化索引
SET @exist := (SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema = DATABASE() AND table_name = 'DeliveryOrders' AND index_name = 'idx_shop_delivery_time');
SET @sqlstmt := IF(@exist = 0, 
  'ALTER TABLE DeliveryOrders ADD INDEX idx_shop_delivery_time (shop_id, add_time DESC)', 
  'SELECT "Index idx_shop_delivery_time already exists" AS message');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- DeliveryOrderItems表性能优化索引
SET @exist := (SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema = DATABASE() AND table_name = 'DeliveryOrderItems' AND index_name = 'idx_delivery_skc');
SET @sqlstmt := IF(@exist = 0, 
  'ALTER TABLE DeliveryOrderItems ADD INDEX idx_delivery_skc (delivery_code, skc)', 
  'SELECT "Index idx_delivery_skc already exists" AS message');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- 分析表以更新统计信息
-- ============================================================================

ANALYZE TABLE Products;
ANALYZE TABLE SheinProducts;
ANALYZE TABLE FinanceRecords;
ANALYZE TABLE inventory_query_history;
ANALYZE TABLE inventory_snapshots;
ANALYZE TABLE erp_products;
ANALYZE TABLE inventory_alert_rules;
ANALYZE TABLE inventory_alerts;
ANALYZE TABLE inventory_sync_tasks;
ANALYZE TABLE inventory_change_logs;
ANALYZE TABLE shein_purchase_orders;
ANALYZE TABLE shein_purchase_order_labels;
ANALYZE TABLE shein_purchase_order_goods_levels;
ANALYZE TABLE shein_purchase_order_details;
ANALYZE TABLE shein_purchase_order_sync_logs;
ANALYZE TABLE shein_delivery_notes;
ANALYZE TABLE shein_delivery_note_items;
ANALYZE TABLE shein_delivery_note_sync_logs;

-- ============================================================================
-- 清理旧表（在导入备份数据后执行）
-- ============================================================================
DROP TABLE IF EXISTS DeliveryOrderSyncLogs;
DROP TABLE IF EXISTS DeliveryOrderItems;
DROP TABLE IF EXISTS DeliveryOrders;
DROP TABLE IF EXISTS FinanceRecords;
DROP TABLE IF EXISTS Withdrawals;

-- ============================================================================
-- 完成
-- ============================================================================

SELECT 'Complete database script executed successfully!' AS 'Status';
SELECT 'Database: eer' AS 'Database Name';
SELECT COUNT(*) AS 'Total Tables' FROM information_schema.tables WHERE table_schema = 'eer';

-- 显示所有表
SHOW TABLES;

-- ============================================================================
-- 使用说明
-- ============================================================================
-- 
-- 执行此脚本:
-- 1. mysql -u root -p < database/complete_database_script.sql
-- 2. 或在MySQL客户端中: SOURCE database/complete_database_script.sql
-- 
-- 主要表说明:
-- 
-- 核心业务表:
-- - Users: 用户管理
-- - PlatformConfigs: 平台配置 (SHEIN, Amazon等)
-- - PlatformShops: 店铺管理
-- - Products: 通用商品表
-- - Orders: 销售订单表
-- - FinanceRecords: 财务记录表
-- - Withdrawals: 提现表
-- 
-- SHEIN商品表:
-- - SheinProductList: SHEIN商品列表(浏览器扩展)
-- - SheinProducts: SHEIN商品详情(API同步)
-- - SheinProductListQuery: SHEIN商品列表查询
-- - SheinProductListSyncLogs: SHEIN商品列表同步日志
-- 
-- 库存管理表:
-- - inventory_query_history: 库存查询历史
-- - inventory_snapshots: 库存快照
-- - inventory_alert_rules: 库存预警规则
-- - inventory_alerts: 库存预警
-- - inventory_sync_tasks: 库存同步任务
-- - inventory_change_logs: 库存变更日志
-- 
-- SHEIN采购单表:
-- - shein_purchase_orders: SHEIN采购单主表
-- - shein_purchase_order_labels: SHEIN采购单标签
-- - shein_purchase_order_goods_levels: SHEIN采购单商品等级
-- - shein_purchase_order_details: SHEIN采购单明细
-- - shein_purchase_order_sync_logs: SHEIN采购单同步日志
-- 
-- 发货单管理表:
-- - DeliveryOrders: 发货单主表
-- - DeliveryOrderItems: 发货单明细
-- - DeliveryOrderSyncLogs: 发货单同步日志
-- 
-- ERP产品管理表:
-- - erp_products: ERP产品主表 (支持多平台刊登)
-- - erp_product_images: ERP产品图片表
-- - erp_product_skus: ERP产品SKU表
-- - erp_product_attributes: ERP商品属性详情表
-- - erp_product_multi_lang: ERP商品多语言信息表
-- - erp_product_platform_mapping: ERP产品平台映射表
-- - erp_sku_platform_mapping: ERP SKU平台映射表
-- 
-- 商品刊登管理表:
-- - publish_drafts: 商品刊登草稿表
-- - publish_records: 商品发布记录表
-- - publish_record_logs: 发布记录日志表
-- 
-- 合规标签管理表:
-- - compliance_label_templates: 合规标签模板表
-- - compliance_label_print_records: 合规标签打印记录表
-- - label_materials: 标签素材库表
-- 
-- Webhook日志表:
-- - webhook_logs: Webhook日志表
-- 
-- ============================================================================
