/**
 * 微服务配置
 */

module.exports = {
  services: {
    gateway: {
      name: 'gateway',
      host: process.env.GATEWAY_HOST || 'localhost',
      port: process.env.GATEWAY_PORT || 5000
    },
    syncEngine: {
      name: 'sync-engine',
      host: process.env.SYNC_ENGINE_HOST || 'localhost',
      port: process.env.SYNC_ENGINE_PORT || 5001
    },
    oms: {
      name: 'oms',
      host: process.env.OMS_HOST || 'localhost',
      port: process.env.OMS_PORT || 5002
    },
    wms: {
      name: 'wms',
      host: process.env.WMS_HOST || 'localhost',
      port: process.env.WMS_PORT || 5003
    },
    pms: {
      name: 'pms',
      host: process.env.PMS_HOST || 'localhost',
      port: process.env.PMS_PORT || 5004
    },
    oss: {
      name: 'oss',
      host: process.env.OSS_HOST || 'localhost',
      port: process.env.OSS_PORT || 3001
    },
    misc: {
      name: 'misc',
      host: process.env.MISC_HOST || 'localhost',
      port: process.env.MISC_PORT || 5005
    }
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || ''
  },
  
  rabbitmq: {
    host: process.env.RABBITMQ_HOST || 'localhost',
    port: parseInt(process.env.RABBITMQ_PORT || '5672'),
    user: process.env.RABBITMQ_USER || 'eer_admin',
    pass: process.env.RABBITMQ_PASS || 'eer_mq_2024',
    vhost: process.env.RABBITMQ_VHOST || 'eer',
    get url() {
      return `amqp://${this.user}:${this.pass}@${this.host}:${this.port}/${encodeURIComponent(this.vhost)}`;
    }
  },

  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'erp'
  },
  
  getServiceUrl(serviceName) {
    const service = this.services[serviceName];
    if (!service) throw new Error(`未知服务: ${serviceName}`);
    return `http://${service.host}:${service.port}`;
  }
};
