-- ============================================================================
-- PDA登录功能增强 - 数据库更新脚本
-- ============================================================================

USE eer;

-- 1. 为物流商表添加登录相关字段
ALTER TABLE logistics_providers 
ADD COLUMN login_enabled TINYINT DEFAULT 0 COMMENT '是否启用登录: 0否 1是',
ADD COLUMN login_username VARCHAR(50) COMMENT '登录用户名',
ADD COLUMN login_password VARCHAR(255) COMMENT '登录密码(加密)',
ADD COLUMN pda_access TINYINT DEFAULT 1 COMMENT '是否允许PDA访问: 0否 1是',
ADD COLUMN last_login_at DATETIME COMMENT '最后登录时间',
ADD COLUMN login_count INT DEFAULT 0 COMMENT '登录次数';

-- 2. 为用户表添加PDA访问权限字段（如果不存在）
ALTER TABLE users 
ADD COLUMN pda_access TINYINT DEFAULT 1 COMMENT '是否允许PDA访问: 0否 1是';

-- 3. 创建PDA登录日志表
CREATE TABLE IF NOT EXISTS pda_login_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_type VARCHAR(20) NOT NULL COMMENT '用户类型: employee员工, logistics物流商',
  user_id BIGINT COMMENT '用户ID或物流商ID',
  username VARCHAR(50) COMMENT '登录用户名',
  login_status VARCHAR(20) DEFAULT 'SUCCESS' COMMENT 'SUCCESS, FAILED',
  fail_reason VARCHAR(200) COMMENT '失败原因',
  device_info VARCHAR(255) COMMENT '设备信息',
  ip_address VARCHAR(50) COMMENT 'IP地址',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_type (user_type),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='PDA登录日志表';

-- 4. 创建物流商快递报单关联表（用于记录物流商的报单）
CREATE TABLE IF NOT EXISTS logistics_courier_reports (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  logistics_id BIGINT NOT NULL COMMENT '物流商ID',
  report_id BIGINT NOT NULL COMMENT '报单ID',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_logistics_id (logistics_id),
  INDEX idx_report_id (report_id),
  FOREIGN KEY (logistics_id) REFERENCES logistics_providers(id) ON DELETE CASCADE,
  FOREIGN KEY (report_id) REFERENCES courier_reports(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='物流商快递报单关联表';

-- 5. 更新courier_reports表，添加用户类型字段
ALTER TABLE courier_reports
ADD COLUMN user_type VARCHAR(20) DEFAULT 'employee' COMMENT '用户类型: employee员工, logistics物流商',
ADD COLUMN logistics_id BIGINT COMMENT '物流商ID（如果是物流商登录）',
ADD INDEX idx_user_type (user_type),
ADD INDEX idx_logistics_id (logistics_id);

SELECT '✅ PDA登录功能增强 - 数据库更新完成' AS message;
