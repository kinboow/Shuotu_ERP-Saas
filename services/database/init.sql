-- ============================================================================
-- 跨境电商ERP系统 - 微服务数据库初始化脚本
-- ============================================================================
-- 
-- 说明: 此脚本包含微服务架构所需的所有表结构
-- 使用: mysql -u root -p < services/database/init.sql
-- 
-- ============================================================================

CREATE DATABASE IF NOT EXISTS eer CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE eer;

-- 设置时区为东八区 (UTC+8)
SET time_zone = '+08:00';
SET GLOBAL time_zone = '+08:00';

SET FOREIGN_KEY_CHECKS=0;

-- ============================================================================
-- 平台配置表 (sync-engine服务)
-- ============================================================================

CREATE TABLE IF NOT EXISTS platform_configs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  platform_name VARCHAR(50) NOT NULL UNIQUE COMMENT '平台标识: shein_full, temu, tiktok',
  platform_display_name VARCHAR(100) COMMENT '平台显示名称',
  base_url VARCHAR(255) COMMENT 'API基础URL',
  auth_url VARCHAR(255) COMMENT '授权域名',
  callback_url VARCHAR(500) COMMENT '授权回调地址',
  app_key VARCHAR(255) COMMENT '应用Key/AppID',
  app_secret VARCHAR(255) COMMENT '应用密钥',
  extra_config JSON COMMENT '额外配置',
  status TINYINT DEFAULT 1 COMMENT '状态: 1启用 0禁用',
  sort_order INT DEFAULT 0 COMMENT '排序',
  remark TEXT COMMENT '备注',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台配置表';

-- 平台店铺表
CREATE TABLE IF NOT EXISTS platform_shops (
  id INT AUTO_INCREMENT PRIMARY KEY,
  platform_id INT NOT NULL COMMENT '平台ID',
  shop_name VARCHAR(100) NOT NULL COMMENT '店铺名称',
  open_key_id VARCHAR(255) COMMENT '店铺级OpenKeyId',
  secret_key VARCHAR(255) COMMENT '店铺级SecretKey',
  seller_id VARCHAR(100) COMMENT '卖家ID',
  access_token TEXT COMMENT 'Access Token',
  refresh_token TEXT COMMENT 'Refresh Token',
  token_expire_at DATETIME COMMENT 'Token过期时间',
  extra_config JSON COMMENT '额外配置',
  status TINYINT DEFAULT 1 COMMENT '状态: 1启用 0禁用',
  last_sync_at DATETIME COMMENT '最后同步时间',
  remark TEXT COMMENT '备注',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (platform_id) REFERENCES platform_configs(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台店铺表';

-- 初始化默认平台
-- 注意：请将 app_key 和 app_secret 替换为您在SHEIN开发者门户获取的实际凭证
INSERT IGNORE INTO platform_configs (platform_name, platform_display_name, base_url, auth_url, callback_url, app_key, app_secret, sort_order) VALUES
('shein_full', 'SHEIN(全托管)', 'https://openapi.sheincorp.cn', 'https://openapi-sem.sheincorp.com', '/auth/shein-full/callback', '146C9689C3801A8C3B20A2AAA0785', 'YOUR_APP_SECRET_HERE', 1),
('temu', 'TEMU', 'https://openapi.temupay.com', NULL, NULL, NULL, NULL, 2),
('tiktok', 'TikTok Shop', 'https://open-api.tiktokglobalshop.com', NULL, NULL, NULL, NULL, 3);

-- ============================================================================
-- 用户和权限表 (misc服务)
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(32) UNIQUE NOT NULL,
  username VARCHAR(50) NOT NULL,
  password VARCHAR(255),
  phone VARCHAR(20),
  email VARCHAR(100),
  avatar VARCHAR(255),
  role VARCHAR(20) DEFAULT 'user',
  role_id INT COMMENT '角色ID',
  is_admin TINYINT DEFAULT 0 COMMENT '是否主账号',
  parent_id BIGINT COMMENT '父账号ID(子账号关联)',
  real_name VARCHAR(50) COMMENT '真实姓名',
  department VARCHAR(100) COMMENT '部门',
  position VARCHAR(100) COMMENT '职位',
  login_ip VARCHAR(50) COMMENT '最后登录IP',
  login_count INT DEFAULT 0 COMMENT '登录次数',
  password_updated_at DATETIME COMMENT '密码更新时间',
  token_version INT DEFAULT 0 COMMENT 'Token版本(用于强制下线)',
  status VARCHAR(20) DEFAULT 'ACTIVE',
  last_login_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username (username),
  INDEX idx_phone (phone),
  INDEX idx_role_id (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- ============================================================================
-- 供应商和物流商表 (misc服务)
-- ============================================================================

CREATE TABLE IF NOT EXISTS suppliers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  supplier_code VARCHAR(50) UNIQUE,
  supplier_name VARCHAR(100) NOT NULL,
  short_name VARCHAR(50),
  contact_name VARCHAR(50),
  contact_phone VARCHAR(50),
  wechat VARCHAR(50),
  email VARCHAR(100),
  address VARCHAR(500),
  main_category VARCHAR(200),
  settlement_type INT DEFAULT 1 COMMENT '1-月结 2-周结 3-现结',
  settlement_cycle INT DEFAULT 30,
  bank_name VARCHAR(100),
  bank_account VARCHAR(50),
  account_name VARCHAR(100),
  status INT DEFAULT 1 COMMENT '1-启用 2-禁用',
  remark TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (supplier_name),
  INDEX idx_code (supplier_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='供应商表';

CREATE TABLE IF NOT EXISTS logistics_providers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  provider_name VARCHAR(100) NOT NULL,
  provider_code VARCHAR(50),
  provider_type VARCHAR(50) DEFAULT 'warehouse',
  logo_url VARCHAR(500),
  api_url VARCHAR(255),
  api_key VARCHAR(255),
  api_secret VARCHAR(255),
  app_id VARCHAR(100),
  customer_code VARCHAR(100),
  contact_person VARCHAR(50),
  contact_phone VARCHAR(50),
  contact_email VARCHAR(100),
  service_areas JSON,
  priority INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  remark TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (provider_name),
  INDEX idx_code (provider_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='物流商表';

-- ============================================================================
-- 财务记录表 (misc服务)
-- ============================================================================

CREATE TABLE IF NOT EXISTS finance_records (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  record_id VARCHAR(32) UNIQUE NOT NULL,
  type VARCHAR(20) NOT NULL COMMENT 'INCOME, EXPENSE, TRANSFER',
  category VARCHAR(50) COMMENT '分类',
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'CNY',
  description TEXT,
  related_type VARCHAR(20) COMMENT 'ORDER, REFUND, ADVERTISING',
  related_id VARCHAR(50),
  platform VARCHAR(20),
  shop_id VARCHAR(32),
  record_date DATETIME,
  operator_id VARCHAR(32),
  operator_name VARCHAR(50),
  status VARCHAR(20) DEFAULT 'ACTIVE',
  remark TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_type (type),
  INDEX idx_category (category),
  INDEX idx_platform (platform, shop_id),
  INDEX idx_record_date (record_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='财务记录表';

CREATE TABLE IF NOT EXISTS withdrawals (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  withdrawal_id VARCHAR(32) UNIQUE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'CNY',
  platform VARCHAR(20) NOT NULL,
  shop_id VARCHAR(32),
  bank_name VARCHAR(100),
  bank_account VARCHAR(50),
  account_holder VARCHAR(100),
  status VARCHAR(20) DEFAULT 'PENDING',
  apply_time DATETIME,
  process_time DATETIME,
  complete_time DATETIME,
  operator_id VARCHAR(32),
  operator_name VARCHAR(50),
  remark TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_platform (platform, shop_id),
  INDEX idx_status (status),
  INDEX idx_apply_time (apply_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='提现记录表';

-- ============================================================================
-- 合规标签表 (misc服务)
-- ============================================================================

CREATE TABLE IF NOT EXISTS compliance_label_templates (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  template_id VARCHAR(32) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  label_type VARCHAR(50) COMMENT 'PRODUCT, SHIPPING, WARNING',
  country VARCHAR(50),
  region VARCHAR(50),
  template JSON COMMENT '模板内容',
  width DECIMAL(8, 2),
  height DECIMAL(8, 2),
  unit VARCHAR(10) DEFAULT 'mm',
  status VARCHAR(20) DEFAULT 'ACTIVE',
  creator_id VARCHAR(32),
  creator_name VARCHAR(50),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_label_type (label_type),
  INDEX idx_country (country, region),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='合规标签模板表';

-- ============================================================================
-- 商品表 (pms服务)
-- ============================================================================

CREATE TABLE IF NOT EXISTS products (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(32) UNIQUE NOT NULL,
  sku VARCHAR(100) NOT NULL,
  name VARCHAR(500) NOT NULL,
  name_en VARCHAR(500),
  description TEXT,
  category VARCHAR(100),
  category_id VARCHAR(50),
  brand VARCHAR(100),
  supplier_id VARCHAR(32),
  supplier_sku VARCHAR(100),
  cost_price DECIMAL(10, 2),
  retail_price DECIMAL(10, 2),
  currency VARCHAR(10) DEFAULT 'CNY',
  weight DECIMAL(10, 2),
  length DECIMAL(10, 2),
  width DECIMAL(10, 2),
  height DECIMAL(10, 2),
  main_image TEXT,
  images JSON,
  attributes JSON,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sku (sku),
  INDEX idx_name (name(100)),
  INDEX idx_category (category),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品表';

-- ============================================================================
-- 库存表 (wms服务)
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  inventory_id VARCHAR(32) UNIQUE NOT NULL,
  product_id VARCHAR(32) NOT NULL,
  sku VARCHAR(100) NOT NULL,
  warehouse_id VARCHAR(32),
  warehouse_name VARCHAR(100),
  total_quantity INT DEFAULT 0,
  available_quantity INT DEFAULT 0,
  locked_quantity INT DEFAULT 0,
  transit_quantity INT DEFAULT 0,
  location VARCHAR(50),
  status VARCHAR(20) DEFAULT 'ACTIVE',
  last_sync_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_product_id (product_id),
  INDEX idx_sku (sku),
  INDEX idx_warehouse (warehouse_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存表';

-- ============================================================================
-- 订单表 (oms服务)
-- ============================================================================

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(32) UNIQUE NOT NULL,
  platform VARCHAR(20) NOT NULL,
  platform_order_id VARCHAR(100),
  shop_id VARCHAR(32),
  status VARCHAR(20) DEFAULT 'PENDING',
  order_time DATETIME,
  pay_time DATETIME,
  ship_time DATETIME,
  total_amount DECIMAL(12, 2),
  product_amount DECIMAL(12, 2),
  shipping_fee DECIMAL(10, 2),
  discount DECIMAL(10, 2),
  currency VARCHAR(10),
  buyer_name VARCHAR(100),
  buyer_phone VARCHAR(50),
  buyer_email VARCHAR(100),
  shipping_country VARCHAR(50),
  shipping_province VARCHAR(50),
  shipping_city VARCHAR(50),
  shipping_address TEXT,
  shipping_zip VARCHAR(20),
  logistics_company VARCHAR(100),
  tracking_no VARCHAR(100),
  buyer_note TEXT,
  seller_note TEXT,
  raw_data JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_platform (platform),
  INDEX idx_platform_order (platform_order_id),
  INDEX idx_status (status),
  INDEX idx_order_time (order_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单表';

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(32) NOT NULL,
  item_id VARCHAR(32) UNIQUE NOT NULL,
  platform_item_id VARCHAR(100),
  product_id VARCHAR(32),
  sku VARCHAR(100),
  product_name VARCHAR(500),
  product_image TEXT,
  quantity INT DEFAULT 1,
  price DECIMAL(10, 2),
  total_price DECIMAL(10, 2),
  attributes JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order_id (order_id),
  INDEX idx_sku (sku)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单明细表';

-- ============================================================================
-- SHEIN(full)全托管平台专用表 (sync-engine服务)
-- ============================================================================

-- SHEIN(full)店铺表 - 专用于全托管模式
CREATE TABLE IF NOT EXISTS shein_full_shops (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shop_name VARCHAR(100) NOT NULL COMMENT '店铺名称',
  app_id VARCHAR(100) NOT NULL COMMENT '应用AppID (开发者门户获取)',
  app_secret VARCHAR(255) NOT NULL COMMENT '应用AppSecret (开发者门户获取)',
  open_key_id VARCHAR(100) COMMENT '店铺级OpenKeyId (授权后获取)',
  secret_key VARCHAR(255) COMMENT '店铺级SecretKey (授权后解密存储)',
  secret_key_encrypted VARCHAR(255) COMMENT '加密存储的SecretKey',
  auth_status TINYINT DEFAULT 0 COMMENT '授权状态: 0未授权 1已授权 2授权过期',
  auth_time DATETIME COMMENT '授权时间',
  is_test TINYINT DEFAULT 0 COMMENT '是否测试环境: 0正式 1测试',
  base_url VARCHAR(255) DEFAULT 'https://openapi.sheincorp.cn' COMMENT 'API基础URL',
  auth_url VARCHAR(255) DEFAULT 'https://openapi-sem.sheincorp.com' COMMENT '授权域名',
  extra_config JSON COMMENT '额外配置',
  status TINYINT DEFAULT 1 COMMENT '状态: 1启用 0禁用',
  last_sync_at DATETIME COMMENT '最后同步时间',
  remark TEXT COMMENT '备注',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_app_id (app_id),
  INDEX idx_auth_status (auth_status),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SHEIN(full)全托管店铺表';

-- SHEIN(full)授权日志表
CREATE TABLE IF NOT EXISTS shein_full_auth_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  shop_id INT COMMENT '店铺ID',
  app_id VARCHAR(100) COMMENT '应用AppID',
  action VARCHAR(50) NOT NULL COMMENT '操作: generate_url, callback, refresh',
  temp_token VARCHAR(100) COMMENT '临时Token',
  state VARCHAR(255) COMMENT '自定义状态参数',
  redirect_url TEXT COMMENT '回调地址',
  request_data JSON COMMENT '请求数据',
  response_data JSON COMMENT '响应数据',
  error_message TEXT COMMENT '错误信息',
  ip_address VARCHAR(50) COMMENT 'IP地址',
  status VARCHAR(20) DEFAULT 'PENDING' COMMENT 'PENDING, SUCCESS, FAILED',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_shop_id (shop_id),
  INDEX idx_app_id (app_id),
  INDEX idx_action (action),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SHEIN(full)授权日志表';

-- ============================================================================
-- SHEIN(full)平台同步记录表
-- ============================================================================

-- SHEIN(full)采购单同步记录
CREATE TABLE IF NOT EXISTS shein_full_purchase_orders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  shop_id INT NOT NULL COMMENT '店铺ID',
  order_no VARCHAR(50) NOT NULL COMMENT '采购单号',
  order_type TINYINT COMMENT '订单类型: 1急采 2备货',
  order_type_name VARCHAR(20),
  status INT COMMENT '订单状态',
  status_name VARCHAR(50),
  supplier_name VARCHAR(100),
  currency VARCHAR(20),
  warehouse_name VARCHAR(100),
  storage_id VARCHAR(50),
  first_mark TINYINT COMMENT '首单标识',
  prepare_type_id INT COMMENT '备货类型',
  prepare_type_name VARCHAR(50),
  urgent_type INT COMMENT '紧急类型',
  is_jit_mother VARCHAR(10) COMMENT '是否JIT母单',
  add_time DATETIME COMMENT '创建时间',
  allocate_time DATETIME COMMENT '下发时间',
  delivery_time DATETIME COMMENT '发货时间',
  receipt_time DATETIME COMMENT '收货时间',
  check_time DATETIME COMMENT '质检时间',
  storage_time DATETIME COMMENT '入库时间',
  update_time DATETIME COMMENT '更新时间',
  request_receipt_time DATETIME COMMENT '要求收货时间',
  request_take_parcel_time DATETIME COMMENT '要求取件时间',
  order_labels JSON COMMENT '订单标签',
  goods_level JSON COMMENT '商品层次',
  raw_data JSON COMMENT '原始数据',
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_shop_order (shop_id, order_no),
  INDEX idx_status (status),
  INDEX idx_order_type (order_type),
  INDEX idx_add_time (add_time),
  INDEX idx_update_time (update_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SHEIN(full)采购单同步表';

-- SHEIN(full)采购单明细
CREATE TABLE IF NOT EXISTS shein_full_purchase_order_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL COMMENT '采购单ID',
  order_no VARCHAR(50) NOT NULL,
  skc VARCHAR(50) COMMENT 'SHEIN SKC',
  sku_code VARCHAR(50) COMMENT 'SHEIN SKU',
  supplier_code VARCHAR(100) COMMENT '供方货号',
  supplier_sku VARCHAR(100) COMMENT '供方SKU',
  suffix_zh VARCHAR(100) COMMENT '属性集',
  img_path TEXT COMMENT 'SKC图片',
  sku_img TEXT COMMENT 'SKU图片',
  price DECIMAL(10, 2) COMMENT '结算价格',
  need_quantity INT COMMENT '需求数量',
  order_quantity INT COMMENT '下单数量',
  delivery_quantity INT COMMENT '送货数量',
  receipt_quantity INT COMMENT '收货数量',
  storage_quantity INT COMMENT '入仓数量',
  defective_quantity INT COMMENT '次品数量',
  remark TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order_id (order_id),
  INDEX idx_order_no (order_no),
  INDEX idx_skc (skc),
  INDEX idx_sku_code (sku_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SHEIN(full)采购单明细表';

-- SHEIN(full)商品同步记录
CREATE TABLE IF NOT EXISTS shein_full_products (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  shop_id INT NOT NULL COMMENT '店铺ID',
  spu_name VARCHAR(50) NOT NULL COMMENT 'SPU编码',
  skc_name VARCHAR(50) COMMENT 'SKC编码',
  category_id BIGINT COMMENT '分类ID',
  product_type_id BIGINT COMMENT '商品类型ID',
  brand_code VARCHAR(50) COMMENT '品牌编码',
  supplier_code VARCHAR(100) COMMENT '供方货号',
  product_name VARCHAR(500) COMMENT '商品名称',
  product_desc TEXT COMMENT '商品描述',
  product_attributes JSON COMMENT '商品属性',
  dimension_attributes JSON COMMENT '尺码属性',
  spu_images JSON COMMENT 'SPU图片',
  skc_list JSON COMMENT 'SKC列表',
  barcode JSON COMMENT '商品条码信息',
  raw_data JSON COMMENT '原始数据',
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_shop_spu (shop_id, spu_name),
  INDEX idx_skc_name (skc_name),
  INDEX idx_category (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SHEIN(full)商品同步表';

-- SHEIN(full)报账单同步记录
CREATE TABLE IF NOT EXISTS shein_full_finance_reports (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  shop_id INT NOT NULL COMMENT '店铺ID',
  report_order_no VARCHAR(50) NOT NULL COMMENT '报账单号',
  sales_total INT COMMENT '销售款明细数量',
  replenish_total INT COMMENT '补扣款数量',
  add_time DATETIME COMMENT '生成时间',
  last_update_time DATETIME COMMENT '最后更新时间',
  settlement_status INT COMMENT '结算状态: 1待确认 2待结算 3已结算',
  settlement_status_name VARCHAR(50),
  estimate_pay_time DATETIME COMMENT '预计付款时间',
  completed_pay_time DATETIME COMMENT '实际付款时间',
  company_name VARCHAR(200) COMMENT '公司主体',
  estimate_income_money_total DECIMAL(12, 2) COMMENT '金额',
  currency_code VARCHAR(10) COMMENT '币种',
  raw_data JSON COMMENT '原始数据',
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_shop_report (shop_id, report_order_no),
  INDEX idx_settlement_status (settlement_status),
  INDEX idx_add_time (add_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SHEIN(full)报账单同步表';

-- SHEIN(full)报账单销售款明细同步记录
CREATE TABLE IF NOT EXISTS shein_full_finance_report_sales_details (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  shop_id INT NOT NULL COMMENT '店铺ID',
  report_order_no VARCHAR(50) NOT NULL COMMENT '报账单号',
  detail_id VARCHAR(100) NOT NULL COMMENT '报账单明细ID',
  second_order_type INT COMMENT '二级账单类型',
  second_order_type_name VARCHAR(200) COMMENT '二级账单类型名称',
  in_and_out INT COMMENT '收支类型: 1收入 2支出',
  in_and_out_name VARCHAR(50) COMMENT '收支类型名称',
  bz_order_no VARCHAR(100) COMMENT '业务单号',
  skc_name VARCHAR(100) COMMENT 'SKC',
  sku_code VARCHAR(100) COMMENT '平台SKU',
  supplier_sku VARCHAR(100) COMMENT '供应商SKU',
  expense_type INT COMMENT '费用类型: 0商品 1服务',
  goods_count INT COMMENT '商品数量',
  settle_currency_code VARCHAR(10) COMMENT '结算币种',
  amount DECIMAL(14, 4) COMMENT '金额',
  unit_price DECIMAL(14, 4) COMMENT '单价',
  company_name VARCHAR(200) COMMENT '公司主体',
  add_time DATETIME COMMENT '账单生成时间',
  raw_data JSON COMMENT '原始数据',
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_shop_report_sales_detail (shop_id, report_order_no, detail_id),
  INDEX idx_shop_report_sales (shop_id, report_order_no),
  INDEX idx_bz_order_no_sales (bz_order_no),
  INDEX idx_sku_code_sales (sku_code),
  INDEX idx_add_time_sales (add_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SHEIN(full)报账单销售款明细同步表';

-- SHEIN(full)报账单补扣款明细同步记录
CREATE TABLE IF NOT EXISTS shein_full_finance_report_adjustment_details (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  shop_id INT NOT NULL COMMENT '店铺ID',
  report_order_no VARCHAR(50) NOT NULL COMMENT '报账单号',
  detail_id VARCHAR(100) NOT NULL COMMENT '报账单明细ID',
  replenish_no VARCHAR(100) COMMENT '补扣款单号',
  replenish_type INT COMMENT '款项类型: 1补款 2扣款',
  replenish_type_name VARCHAR(50) COMMENT '款项类型名称',
  replenish_category VARCHAR(255) COMMENT '补扣款分类',
  bz_order_no VARCHAR(100) COMMENT '业务单号',
  skc_name VARCHAR(100) COMMENT 'SKC',
  sku_code VARCHAR(100) COMMENT '平台SKU',
  supplier_sku VARCHAR(100) COMMENT '供应商SKU',
  expense_type INT COMMENT '费用类型: 0商品 1服务',
  goods_count INT COMMENT '商品数量',
  settle_currency_code VARCHAR(10) COMMENT '结算币种',
  amount DECIMAL(14, 4) COMMENT '金额',
  unit_price DECIMAL(14, 4) COMMENT '单价',
  company_name VARCHAR(200) COMMENT '公司主体',
  add_time DATETIME COMMENT '账单生成时间',
  raw_data JSON COMMENT '原始数据',
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_shop_report_adj_detail (shop_id, report_order_no, detail_id),
  INDEX idx_shop_report_adj (shop_id, report_order_no),
  INDEX idx_bz_order_no_adj (bz_order_no),
  INDEX idx_replenish_no_adj (replenish_no),
  INDEX idx_add_time_adj (add_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SHEIN(full)报账单补扣款明细同步表';

-- SHEIN(full)发货单同步记录
CREATE TABLE IF NOT EXISTS shein_full_delivery_orders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  shop_id INT NOT NULL COMMENT '店铺ID',
  delivery_code VARCHAR(50) NOT NULL COMMENT '发货单号',
  delivery_type INT COMMENT '发货方式: 1快递 2送货上门 3定点收货',
  delivery_type_name VARCHAR(50) COMMENT '发货方式名称',
  express_id VARCHAR(50) COMMENT '快递公司ID',
  express_company_name VARCHAR(100) COMMENT '快递公司名称',
  express_code VARCHAR(100) COMMENT '物流单号',
  send_package INT COMMENT '包裹总数',
  package_weight DECIMAL(10, 2) COMMENT '包裹重量',
  take_parcel_time DATETIME COMMENT '实际取件时间',
  reserve_parcel_time DATETIME COMMENT '预约取件时间',
  add_time DATETIME COMMENT '发货时间',
  pre_receipt_time DATETIME COMMENT '预计到货时间',
  receipt_time DATETIME COMMENT '实际到货时间',
  supplier_warehouse_id BIGINT COMMENT '仓库ID',
  supplier_warehouse_name VARCHAR(100) COMMENT '仓库名称',
  raw_data JSON COMMENT '原始数据',
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_shop_delivery (shop_id, delivery_code),
  INDEX idx_add_time (add_time),
  INDEX idx_delivery_type (delivery_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SHEIN(full)发货单同步表';

-- SHEIN(full)发货单明细
CREATE TABLE IF NOT EXISTS shein_full_delivery_order_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  delivery_id BIGINT NOT NULL COMMENT '发货单ID',
  delivery_code VARCHAR(50) NOT NULL COMMENT '发货单号',
  skc VARCHAR(50) COMMENT 'SHEIN SKC',
  sku_code VARCHAR(50) COMMENT 'SHEIN SKU',
  order_no VARCHAR(50) COMMENT '关联采购单号',
  delivery_quantity INT COMMENT '发货数量',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_delivery_id (delivery_id),
  INDEX idx_delivery_code (delivery_code),
  INDEX idx_order_no (order_no),
  INDEX idx_skc (skc)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SHEIN(full)发货单明细表';

-- SHEIN(full)库存同步记录
CREATE TABLE IF NOT EXISTS shein_full_inventory (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  shop_id INT NOT NULL COMMENT '店铺ID',
  spu_name VARCHAR(50) COMMENT 'SPU编码',
  skc_name VARCHAR(50) COMMENT 'SKC编码',
  sku_code VARCHAR(50) NOT NULL COMMENT 'SKU编码',
  warehouse_type VARCHAR(10) COMMENT '仓库类型',
  warehouse_code VARCHAR(50) COMMENT '仓库编码',
  total_inventory INT DEFAULT 0 COMMENT '总库存',
  locked_quantity INT DEFAULT 0 COMMENT '锁定库存',
  temp_lock_quantity INT DEFAULT 0 COMMENT '临时锁库存',
  usable_inventory INT DEFAULT 0 COMMENT '可用库存',
  transit_quantity INT DEFAULT 0 COMMENT '在途库存',
  raw_data JSON COMMENT '原始数据',
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_shop_sku_warehouse (shop_id, sku_code, warehouse_code),
  INDEX idx_skc_name (skc_name),
  INDEX idx_spu_name (spu_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SHEIN(full)库存同步表';

-- 同步任务记录表
CREATE TABLE IF NOT EXISTS sync_tasks (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  task_id VARCHAR(32) UNIQUE NOT NULL,
  platform VARCHAR(20) NOT NULL COMMENT '平台',
  shop_id INT COMMENT '店铺ID',
  task_type VARCHAR(50) NOT NULL COMMENT '任务类型: products, orders, inventory, reports',
  status VARCHAR(20) DEFAULT 'PENDING' COMMENT 'PENDING, RUNNING, SUCCESS, FAILED',
  params JSON COMMENT '任务参数',
  result JSON COMMENT '执行结果',
  total_count INT DEFAULT 0 COMMENT '总数量',
  success_count INT DEFAULT 0 COMMENT '成功数量',
  fail_count INT DEFAULT 0 COMMENT '失败数量',
  error_message TEXT COMMENT '错误信息',
  started_at DATETIME COMMENT '开始时间',
  completed_at DATETIME COMMENT '完成时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_platform (platform),
  INDEX idx_shop_id (shop_id),
  INDEX idx_task_type (task_type),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='同步任务记录表';

-- ============================================================================
-- 账户体系 - 企业信息表（私有版只有一个企业）
-- ============================================================================
CREATE TABLE IF NOT EXISTS enterprise_info (
  id INT PRIMARY KEY DEFAULT 1,
  company_name VARCHAR(200) NOT NULL COMMENT '企业名称',
  company_short_name VARCHAR(50) COMMENT '企业简称',
  logo_url VARCHAR(500) COMMENT '企业Logo',
  contact_person VARCHAR(50) COMMENT '联系人',
  contact_phone VARCHAR(50) COMMENT '联系电话',
  contact_email VARCHAR(100) COMMENT '联系邮箱',
  address VARCHAR(500) COMMENT '企业地址',
  business_license VARCHAR(100) COMMENT '营业执照号',
  tax_number VARCHAR(100) COMMENT '税号',
  bank_name VARCHAR(100) COMMENT '开户银行',
  bank_account VARCHAR(50) COMMENT '银行账号',
  extra_info JSON COMMENT '额外信息',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='企业信息表';

-- 初始化默认企业信息
INSERT IGNORE INTO enterprise_info (id, company_name, company_short_name) VALUES 
(1, '我的企业', '我的企业');

-- ============================================================================
-- 账户体系 - 角色表
-- ============================================================================
CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_code VARCHAR(50) UNIQUE NOT NULL COMMENT '角色编码',
  role_name VARCHAR(100) NOT NULL COMMENT '角色名称',
  description TEXT COMMENT '角色描述',
  is_system TINYINT DEFAULT 0 COMMENT '是否系统角色(不可删除)',
  status TINYINT DEFAULT 1 COMMENT '状态: 1启用 0禁用',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_role_code (role_code),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色表';

-- 初始化默认角色
INSERT IGNORE INTO roles (role_code, role_name, description, is_system) VALUES
('super_admin', '超级管理员', '拥有所有权限，不可删除', 1),
('admin', '管理员', '拥有大部分管理权限', 1),
('operator', '操作员', '日常操作权限', 0),
('viewer', '查看者', '只读权限', 0);

-- ============================================================================
-- 账户体系 - 权限表
-- ============================================================================
CREATE TABLE IF NOT EXISTS permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  permission_code VARCHAR(100) UNIQUE NOT NULL COMMENT '权限编码',
  permission_name VARCHAR(100) NOT NULL COMMENT '权限名称',
  module VARCHAR(50) NOT NULL COMMENT '所属模块',
  description TEXT COMMENT '权限描述',
  sort_order INT DEFAULT 0 COMMENT '排序',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_module (module),
  INDEX idx_permission_code (permission_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='权限表';

-- 初始化权限
INSERT IGNORE INTO permissions (permission_code, permission_name, module, sort_order) VALUES
-- 系统管理
('system:enterprise:view', '查看企业信息', 'system', 1),
('system:enterprise:edit', '编辑企业信息', 'system', 2),
('system:user:view', '查看用户列表', 'system', 3),
('system:user:create', '创建用户', 'system', 4),
('system:user:edit', '编辑用户', 'system', 5),
('system:user:delete', '删除用户', 'system', 6),
('system:role:view', '查看角色列表', 'system', 7),
('system:role:create', '创建角色', 'system', 8),
('system:role:edit', '编辑角色', 'system', 9),
('system:role:delete', '删除角色', 'system', 10),
('system:log:view', '查看操作日志', 'system', 11),
-- 商品管理
('product:view', '查看商品', 'product', 1),
('product:create', '创建商品', 'product', 2),
('product:edit', '编辑商品', 'product', 3),
('product:delete', '删除商品', 'product', 4),
('product:publish', '发布商品', 'product', 5),
-- 订单管理
('order:view', '查看订单', 'order', 1),
('order:edit', '编辑订单', 'order', 2),
('order:ship', '发货操作', 'order', 3),
('order:cancel', '取消订单', 'order', 4),
-- 采购管理
('purchase:view', '查看采购单', 'purchase', 1),
('purchase:create', '创建采购单', 'purchase', 2),
('purchase:edit', '编辑采购单', 'purchase', 3),
('purchase:print', '打印采购单', 'purchase', 4),
-- 库存管理
('inventory:view', '查看库存', 'inventory', 1),
('inventory:edit', '编辑库存', 'inventory', 2),
('inventory:adjust', '库存调整', 'inventory', 3),
-- 财务管理
('finance:view', '查看财务', 'finance', 1),
('finance:edit', '编辑财务', 'finance', 2),
('finance:withdraw', '提现操作', 'finance', 3),
-- 平台管理
('platform:view', '查看平台配置', 'platform', 1),
('platform:edit', '编辑平台配置', 'platform', 2),
('platform:sync', '同步数据', 'platform', 3);

-- ============================================================================
-- 账户体系 - 角色权限关联表
-- ============================================================================
CREATE TABLE IF NOT EXISTS role_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_id INT NOT NULL COMMENT '角色ID',
  permission_id INT NOT NULL COMMENT '权限ID',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_role_permission (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色权限关联表';

-- 为超级管理员分配所有权限
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions;

-- ============================================================================
-- 账户体系 - 用户Token表（用于多设备登录管理）
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_tokens (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL COMMENT '用户ID',
  token_hash VARCHAR(64) NOT NULL COMMENT 'Token哈希值',
  device_type VARCHAR(50) COMMENT '设备类型: web, mobile, pda',
  device_info VARCHAR(255) COMMENT '设备信息',
  ip_address VARCHAR(50) COMMENT 'IP地址',
  user_agent TEXT COMMENT 'User Agent',
  expires_at DATETIME NOT NULL COMMENT '过期时间',
  last_used_at DATETIME COMMENT '最后使用时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_token_hash (token_hash),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户Token表';

-- ============================================================================
-- 账户体系 - 操作日志表
-- ============================================================================
CREATE TABLE IF NOT EXISTS operation_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT COMMENT '用户ID',
  username VARCHAR(50) COMMENT '用户名',
  real_name VARCHAR(50) COMMENT '真实姓名',
  module VARCHAR(50) NOT NULL COMMENT '操作模块',
  action VARCHAR(50) NOT NULL COMMENT '操作类型',
  target_type VARCHAR(50) COMMENT '目标类型',
  target_id VARCHAR(100) COMMENT '目标ID',
  description TEXT COMMENT '操作描述',
  request_method VARCHAR(10) COMMENT '请求方法',
  request_url VARCHAR(500) COMMENT '请求URL',
  request_params JSON COMMENT '请求参数',
  response_code INT COMMENT '响应状态码',
  response_data JSON COMMENT '响应数据(可选)',
  ip_address VARCHAR(50) COMMENT 'IP地址',
  user_agent TEXT COMMENT 'User Agent',
  duration INT COMMENT '执行时长(ms)',
  status VARCHAR(20) DEFAULT 'SUCCESS' COMMENT 'SUCCESS, FAILED',
  error_message TEXT COMMENT '错误信息',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_module (module),
  INDEX idx_action (action),
  INDEX idx_target (target_type, target_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志表';

-- ============================================================================
-- 账户体系 - 登录日志表
-- ============================================================================
CREATE TABLE IF NOT EXISTS login_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT COMMENT '用户ID',
  username VARCHAR(50) COMMENT '用户名',
  login_type VARCHAR(20) DEFAULT 'password' COMMENT '登录方式: password, token, sms',
  device_type VARCHAR(50) COMMENT '设备类型',
  ip_address VARCHAR(50) COMMENT 'IP地址',
  location VARCHAR(200) COMMENT '登录地点',
  user_agent TEXT COMMENT 'User Agent',
  status VARCHAR(20) DEFAULT 'SUCCESS' COMMENT 'SUCCESS, FAILED',
  fail_reason VARCHAR(200) COMMENT '失败原因',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_username (username),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='登录日志表';

-- ============================================================================
-- ERP商品表 (pms服务)
-- ============================================================================
CREATE TABLE IF NOT EXISTS erp_products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_code VARCHAR(25) NOT NULL UNIQUE COMMENT 'ERP产品唯一编号(XT+时间戳+随机)',
  product_name_cn VARCHAR(500) COMMENT '商品名称(中文)',
  product_name_en VARCHAR(500) COMMENT '商品名称(英文)',
  product_name_multi JSON COMMENT '多语言商品名称',
  product_desc TEXT COMMENT '商品描述',
  product_desc_multi JSON COMMENT '多语言商品描述',
  product_desc_html TEXT COMMENT '商品描述HTML格式',
  brand VARCHAR(200) COMMENT '品牌名称',
  brand_id VARCHAR(100) COMMENT '品牌ID',
  brand_code VARCHAR(100) COMMENT '品牌编码',
  category VARCHAR(200) COMMENT '类目名称',
  category_id VARCHAR(100) COMMENT '末级类目ID',
  category_path JSON COMMENT '类目路径',
  category_name VARCHAR(500) COMMENT '类目名称路径',
  warehouse_id VARCHAR(100) COMMENT '仓库ID',
  warehouse_name VARCHAR(200) COMMENT '仓库名称',
  product_attributes JSON COMMENT '商品属性列表',
  main_images JSON COMMENT '主图URL列表',
  weight INT COMMENT '重量(g)',
  length DECIMAL(10, 2) COMMENT '长度(cm)',
  width DECIMAL(10, 2) COMMENT '宽度(cm)',
  height DECIMAL(10, 2) COMMENT '高度(cm)',
  package_length DECIMAL(10, 2) COMMENT '包裹长度(cm)',
  package_width DECIMAL(10, 2) COMMENT '包裹宽度(cm)',
  package_height DECIMAL(10, 2) COMMENT '包裹高度(cm)',
  package_weight INT COMMENT '包裹重量(g)',
  cost_price DECIMAL(10, 2) COMMENT '成本价',
  suggested_price DECIMAL(10, 2) COMMENT '建议零售价',
  currency VARCHAR(10) DEFAULT 'CNY' COMMENT '币种',
  supplier_code VARCHAR(100) COMMENT '商家编码',
  source_type TINYINT DEFAULT 1 COMMENT '货源类型：1-自生产 2-厂家调货',
  supplier_id INT COMMENT '供应商ID',
  purchase_price DECIMAL(10, 2) COMMENT '采购成本价',
  production_cost DECIMAL(10, 2) COMMENT '生产成本价',
  status TINYINT DEFAULT 1 COMMENT '状态：1-正常 0-禁用',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_product_code (product_code),
  INDEX idx_product_name (product_name_cn(100)),
  INDEX idx_category (category),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='ERP商品表';

-- ============================================================================
-- 包装录像表 (misc服务)
-- ============================================================================
CREATE TABLE IF NOT EXISTS package_videos (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_no VARCHAR(100) NOT NULL COMMENT '订单号',
  sku_code VARCHAR(100) COMMENT 'SKU编码',
  product_image VARCHAR(500) COMMENT '商品图片',
  video_url VARCHAR(500) NOT NULL COMMENT '视频URL',
  duration INT DEFAULT 0 COMMENT '视频时长(秒)',
  file_size BIGINT DEFAULT 0 COMMENT '文件大小(字节)',
  device_type VARCHAR(50) DEFAULT 'video' COMMENT '设备类型: video录像端, scan扫描端',
  device_name VARCHAR(200) COMMENT '设备名称',
  operator_id VARCHAR(50) COMMENT '操作员ID',
  operator_name VARCHAR(100) COMMENT '操作员姓名',
  status VARCHAR(20) DEFAULT 'pending' COMMENT '状态: pending处理中, completed已完成, failed失败',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_order_no (order_no),
  INDEX idx_sku_code (sku_code),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='包装录像表';

-- 包装录像扫描日志表
CREATE TABLE IF NOT EXISTS package_video_scan_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_no VARCHAR(100) NOT NULL COMMENT '订单号',
  has_video TINYINT DEFAULT 0 COMMENT '是否有录像: 0无 1有',
  operator_id VARCHAR(50) COMMENT '操作员ID',
  operator_name VARCHAR(100) COMMENT '操作员姓名',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order_no (order_no),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='包装录像扫描日志表';

-- 包装录像任务队列表
CREATE TABLE IF NOT EXISTS package_video_tasks (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_no VARCHAR(100) NOT NULL COMMENT '订单号',
  sku_code VARCHAR(100) COMMENT 'SKU编码',
  product_name VARCHAR(500) COMMENT '商品名称',
  status VARCHAR(20) DEFAULT 'pending' COMMENT '状态: pending待录像, recording录像中, completed已完成, cancelled已取消',
  video_id BIGINT COMMENT '关联的录像ID',
  device_name VARCHAR(200) COMMENT '录像设备名称',
  created_by_id VARCHAR(50) COMMENT '创建人ID(扫描端)',
  created_by_name VARCHAR(100) COMMENT '创建人姓名',
  claimed_by_id VARCHAR(50) COMMENT '领取人ID(录像端)',
  claimed_by_name VARCHAR(100) COMMENT '领取人姓名',
  claimed_at DATETIME COMMENT '领取时间',
  completed_at DATETIME COMMENT '完成时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order_no (order_no),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='包装录像任务队列表';

SET FOREIGN_KEY_CHECKS=1;

-- ============================================================================
-- 完成
-- ============================================================================
SELECT '微服务数据库初始化完成' AS message;
