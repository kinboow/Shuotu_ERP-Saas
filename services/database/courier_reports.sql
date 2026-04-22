-- ============================================================================
-- 快递商报单功能 - 数据库表
-- ============================================================================

USE eer;

-- 快递商报单表
CREATE TABLE IF NOT EXISTS courier_reports (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  report_no VARCHAR(50) NOT NULL UNIQUE COMMENT '报单编号',
  courier_company VARCHAR(100) NOT NULL COMMENT '快递公司',
  report_date DATE NOT NULL COMMENT '报单日期',
  large_package_count INT DEFAULT 0 COMMENT '大件数量',
  small_package_count INT DEFAULT 0 COMMENT '小件数量',
  total_package_count INT DEFAULT 0 COMMENT '总件数',
  operator_id VARCHAR(50) COMMENT '操作员ID',
  operator_name VARCHAR(100) COMMENT '操作员姓名',
  device_type VARCHAR(50) DEFAULT 'pda' COMMENT '设备类型',
  status VARCHAR(20) DEFAULT 'submitted' COMMENT '状态: submitted已提交, confirmed已确认, cancelled已取消',
  remark TEXT COMMENT '备注',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_report_no (report_no),
  INDEX idx_courier_company (courier_company),
  INDEX idx_report_date (report_date),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='快递商报单表';

-- 快递商报单明细表
CREATE TABLE IF NOT EXISTS courier_report_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  report_id BIGINT NOT NULL COMMENT '报单ID',
  report_no VARCHAR(50) NOT NULL COMMENT '报单编号',
  package_no VARCHAR(100) NOT NULL COMMENT '包裹号/快递单号',
  package_type VARCHAR(20) DEFAULT 'small' COMMENT '包裹类型: large大件, small小件',
  scan_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '扫描时间',
  remark VARCHAR(500) COMMENT '备注',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_report_id (report_id),
  INDEX idx_report_no (report_no),
  INDEX idx_package_no (package_no),
  INDEX idx_package_type (package_type),
  FOREIGN KEY (report_id) REFERENCES courier_reports(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='快递商报单明细表';

-- 快递公司配置表
CREATE TABLE IF NOT EXISTS courier_companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(100) NOT NULL UNIQUE COMMENT '快递公司名称',
  company_code VARCHAR(50) COMMENT '快递公司编码',
  logo_url VARCHAR(500) COMMENT 'Logo URL',
  contact_person VARCHAR(50) COMMENT '联系人',
  contact_phone VARCHAR(50) COMMENT '联系电话',
  is_active TINYINT DEFAULT 1 COMMENT '是否启用: 1启用 0禁用',
  sort_order INT DEFAULT 0 COMMENT '排序',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_company_name (company_name),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='快递公司配置表';

-- 初始化常用快递公司
INSERT IGNORE INTO courier_companies (company_name, company_code, sort_order) VALUES
('顺丰速运', 'SF', 1),
('中通快递', 'ZTO', 2),
('圆通速递', 'YTO', 3),
('申通快递', 'STO', 4),
('韵达快递', 'YD', 5),
('百世快递', 'BEST', 6),
('极兔速递', 'JT', 7),
('京东物流', 'JD', 8),
('邮政EMS', 'EMS', 9),
('德邦快递', 'DBL', 10);

SELECT '快递商报单表创建完成' AS message;
