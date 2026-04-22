/**
 * 统一日志工具
 */

const winston = require('winston');

const createLogger = (serviceName) => {
  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
        return `${timestamp} [${service || serviceName}] ${level.toUpperCase()}: ${message} ${metaStr}`;
      })
    ),
    defaultMeta: { service: serviceName },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
            const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
            return `${timestamp} [${service || serviceName}] ${level}: ${message} ${metaStr}`;
          })
        )
      })
    ]
  });
  
  // 生产环境添加文件日志
  if (process.env.NODE_ENV === 'production') {
    logger.add(new winston.transports.File({ 
      filename: `logs/${serviceName}-error.log`, 
      level: 'error' 
    }));
    logger.add(new winston.transports.File({ 
      filename: `logs/${serviceName}.log` 
    }));
  }
  
  return logger;
};

// 默认logger
const defaultLogger = createLogger('erp');

module.exports = defaultLogger;
module.exports.createLogger = createLogger;
