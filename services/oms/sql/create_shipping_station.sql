-- 创建发货台表
CREATE TABLE IF NOT EXISTS `shipping_station` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `order_id` INT NOT NULL COMMENT '采购单ID（关联stock_orders表）',
  `added_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '加入发货台时间',
  `added_by` VARCHAR(100) DEFAULT NULL COMMENT '操作人',
  `remarks` TEXT DEFAULT NULL COMMENT '备注',
  INDEX `idx_order_id` (`order_id`),
  INDEX `idx_added_at` (`added_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='发货台';
