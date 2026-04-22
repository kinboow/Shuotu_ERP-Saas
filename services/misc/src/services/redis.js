/**
 * Redis服务 - 用于缓存登录信息、Token管理
 */
const Redis = require('ioredis');

// Redis配置
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB) || 0,
  keyPrefix: 'erp:',
  retryStrategy: (times) => {
    if (times > 3) {
      console.error('Redis连接失败，已重试3次');
      return null;
    }
    return Math.min(times * 200, 2000);
  }
};

let redis = null;

// 初始化Redis连接
const initRedis = () => {
  if (redis) return redis;
  
  try {
    redis = new Redis(redisConfig);
    
    redis.on('connect', () => {
      console.log('Redis连接成功');
    });
    
    redis.on('error', (err) => {
      console.error('Redis连接错误:', err.message);
    });
    
    return redis;
  } catch (error) {
    console.error('Redis初始化失败:', error.message);
    return null;
  }
};

// 获取Redis实例
const getRedis = () => {
  if (!redis) {
    return initRedis();
  }
  return redis;
};

// Token相关Key
const TOKEN_KEY = (userId) => `token:${userId}`;
const TOKEN_BLACKLIST_KEY = (tokenHash) => `token:blacklist:${tokenHash}`;
const USER_SESSION_KEY = (userId) => `session:${userId}`;
const LOGIN_ATTEMPTS_KEY = (username) => `login:attempts:${username}`;

// Token过期时间（秒）
const TOKEN_EXPIRE = parseInt(process.env.TOKEN_EXPIRE) || 7200; // 2小时
const REFRESH_TOKEN_EXPIRE = parseInt(process.env.REFRESH_TOKEN_EXPIRE) || 604800; // 7天

/**
 * 存储用户Token
 */
const setUserToken = async (userId, tokenData, expire = TOKEN_EXPIRE) => {
  const client = getRedis();
  if (!client) return false;
  
  try {
    const key = TOKEN_KEY(userId);
    await client.setex(key, expire, JSON.stringify(tokenData));
    return true;
  } catch (error) {
    console.error('存储Token失败:', error);
    return false;
  }
};

/**
 * 获取用户Token
 */
const getUserToken = async (userId) => {
  const client = getRedis();
  if (!client) return null;
  
  try {
    const key = TOKEN_KEY(userId);
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('获取Token失败:', error);
    return null;
  }
};

/**
 * 删除用户Token（登出）
 */
const deleteUserToken = async (userId) => {
  const client = getRedis();
  if (!client) return false;
  
  try {
    const key = TOKEN_KEY(userId);
    await client.del(key);
    return true;
  } catch (error) {
    console.error('删除Token失败:', error);
    return false;
  }
};

/**
 * 将Token加入黑名单
 */
const addTokenToBlacklist = async (tokenHash, expire = TOKEN_EXPIRE) => {
  const client = getRedis();
  if (!client) return false;
  
  try {
    const key = TOKEN_BLACKLIST_KEY(tokenHash);
    await client.setex(key, expire, '1');
    return true;
  } catch (error) {
    console.error('Token加入黑名单失败:', error);
    return false;
  }
};

/**
 * 检查Token是否在黑名单
 */
const isTokenBlacklisted = async (tokenHash) => {
  const client = getRedis();
  if (!client) return false;
  
  try {
    const key = TOKEN_BLACKLIST_KEY(tokenHash);
    const exists = await client.exists(key);
    return exists === 1;
  } catch (error) {
    console.error('检查Token黑名单失败:', error);
    return false;
  }
};

/**
 * 存储用户会话信息
 */
const setUserSession = async (userId, sessionData, expire = TOKEN_EXPIRE) => {
  const client = getRedis();
  if (!client) return false;
  
  try {
    const key = USER_SESSION_KEY(userId);
    await client.setex(key, expire, JSON.stringify(sessionData));
    return true;
  } catch (error) {
    console.error('存储会话失败:', error);
    return false;
  }
};

/**
 * 获取用户会话信息
 */
const getUserSession = async (userId) => {
  const client = getRedis();
  if (!client) return null;
  
  try {
    const key = USER_SESSION_KEY(userId);
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('获取会话失败:', error);
    return null;
  }
};

/**
 * 刷新会话过期时间
 */
const refreshSession = async (userId, expire = TOKEN_EXPIRE) => {
  const client = getRedis();
  if (!client) return false;
  
  try {
    const key = USER_SESSION_KEY(userId);
    await client.expire(key, expire);
    return true;
  } catch (error) {
    console.error('刷新会话失败:', error);
    return false;
  }
};

/**
 * 记录登录失败次数
 */
const recordLoginAttempt = async (username) => {
  const client = getRedis();
  if (!client) return 0;
  
  try {
    const key = LOGIN_ATTEMPTS_KEY(username);
    const count = await client.incr(key);
    await client.expire(key, 1800); // 30分钟后重置
    return count;
  } catch (error) {
    console.error('记录登录尝试失败:', error);
    return 0;
  }
};

/**
 * 获取登录失败次数
 */
const getLoginAttempts = async (username) => {
  const client = getRedis();
  if (!client) return 0;
  
  try {
    const key = LOGIN_ATTEMPTS_KEY(username);
    const count = await client.get(key);
    return parseInt(count) || 0;
  } catch (error) {
    console.error('获取登录尝试次数失败:', error);
    return 0;
  }
};

/**
 * 清除登录失败次数
 */
const clearLoginAttempts = async (username) => {
  const client = getRedis();
  if (!client) return false;
  
  try {
    const key = LOGIN_ATTEMPTS_KEY(username);
    await client.del(key);
    return true;
  } catch (error) {
    console.error('清除登录尝试次数失败:', error);
    return false;
  }
};

module.exports = {
  initRedis,
  getRedis,
  setUserToken,
  getUserToken,
  deleteUserToken,
  addTokenToBlacklist,
  isTokenBlacklisted,
  setUserSession,
  getUserSession,
  refreshSession,
  recordLoginAttempt,
  getLoginAttempts,
  clearLoginAttempts,
  TOKEN_EXPIRE,
  REFRESH_TOKEN_EXPIRE
};
