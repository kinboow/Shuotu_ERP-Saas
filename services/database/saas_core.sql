CREATE TABLE IF NOT EXISTS platform_users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  real_name VARCHAR(100),
  email VARCHAR(100),
  phone VARCHAR(20),
  role_code VARCHAR(50) NOT NULL DEFAULT 'platform_super_admin',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  last_login_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_platform_users_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS enterprises (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  enterprise_code VARCHAR(32) NOT NULL UNIQUE,
  company_name VARCHAR(200) NOT NULL,
  company_short_name VARCHAR(50),
  owner_user_id BIGINT,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_enterprises_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS enterprise_members (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  enterprise_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  member_type VARCHAR(30) NOT NULL DEFAULT 'member',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  is_owner TINYINT(1) NOT NULL DEFAULT 0,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  approved_by BIGINT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_enterprise_member (enterprise_id, user_id),
  INDEX idx_enterprise_members_status (status),
  INDEX idx_enterprise_members_enterprise (enterprise_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS enterprise_join_requests (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  enterprise_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  applicant_message VARCHAR(500),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  reviewed_by BIGINT,
  reviewed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_enterprise_join_requests_status (status),
  INDEX idx_enterprise_join_requests_enterprise (enterprise_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS features (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  feature_code VARCHAR(100) NOT NULL UNIQUE,
  feature_name VARCHAR(100) NOT NULL,
  module VARCHAR(50) NOT NULL,
  description VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_features_module (module)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS plans (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  plan_code VARCHAR(50) NOT NULL UNIQUE,
  plan_name VARCHAR(100) NOT NULL,
  billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_plans_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS plan_features (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  plan_id BIGINT NOT NULL,
  feature_id BIGINT NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  limit_type VARCHAR(30),
  limit_value INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_plan_feature (plan_id, feature_id),
  INDEX idx_plan_features_plan (plan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS enterprise_subscriptions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  enterprise_id BIGINT NOT NULL,
  plan_id BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expired_at DATETIME,
  auto_renew TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_enterprise_subscriptions_enterprise (enterprise_id),
  INDEX idx_enterprise_subscriptions_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS enterprise_feature_overrides (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  enterprise_id BIGINT NOT NULL,
  feature_id BIGINT NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  limit_type VARCHAR(30),
  limit_value INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_enterprise_feature_override (enterprise_id, feature_id),
  INDEX idx_enterprise_feature_overrides_enterprise (enterprise_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS platform_provider_credentials (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  provider_code VARCHAR(50) NOT NULL UNIQUE,
  provider_name VARCHAR(100) NOT NULL,
  app_key VARCHAR(255),
  app_secret VARCHAR(255),
  extra_config JSON,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO features (feature_code, feature_name, module, description) VALUES
('enterprise_management', '企业管理', 'system', '企业资料与组织管理'),
('member_approval', '成员审批', 'system', '企业成员加入审批'),
('role_management', '角色权限', 'system', '企业内角色权限管理'),
('platform_authorization', '店铺授权', 'platform', '平台店铺授权管理'),
('order_management', '订单管理', 'order', '订单与发货管理'),
('inventory_management', '库存管理', 'inventory', '库存与入库管理'),
('finance_management', '财务管理', 'finance', '财务与提现能力'),
('remote_print', '远程打印', 'tool', '远程打印能力'),
('package_video', '包装录像', 'tool', '包装录像能力'),
('courier_reports', '快递报单', 'tool', '快递报单能力');

INSERT IGNORE INTO plans (plan_code, plan_name, billing_cycle, price, status) VALUES
('free', '免费版', 'monthly', 0, 'ACTIVE'),
('starter', '基础版', 'monthly', 199, 'ACTIVE'),
('pro', '专业版', 'monthly', 599, 'ACTIVE'),
('enterprise', '企业版', 'monthly', 1999, 'ACTIVE');

INSERT IGNORE INTO platform_provider_credentials (provider_code, provider_name, status) VALUES
('shein', 'SHEIN', 'ACTIVE'),
('temu', 'TEMU', 'ACTIVE'),
('tiktok', 'TikTok', 'ACTIVE');
