/**
 * 清除 Node.js require 缓存
 * 用于强制重新加载所有模块
 */

console.log('🔄 清除 Node.js require 缓存...\n');

// 获取所有已缓存的模块
const cachedModules = Object.keys(require.cache);
console.log(`📊 当前缓存的模块数: ${cachedModules.length}\n`);

// 查找 SheinProduct 相关的模块
const sheinProductModules = cachedModules.filter(m => 
  m.includes('SheinProduct') || 
  m.includes('concurrentSync') ||
  m.includes('database.js')
);

if (sheinProductModules.length > 0) {
  console.log('🔍 找到以下相关模块：');
  sheinProductModules.forEach(m => {
    console.log(`  - ${m}`);
  });
  console.log('');
}

console.log('💡 要清除缓存，请：');
console.log('  1. 完全停止后端服务器（Ctrl+C）');
console.log('  2. 确保没有任何 node 进程在运行');
console.log('  3. 重新启动服务器：npm start');
console.log('');
console.log('⚠️  注意：nodemon 的自动重启可能不会清除所有缓存！');
console.log('');

process.exit(0);
