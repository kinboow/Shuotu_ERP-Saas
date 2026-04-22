const crypto = require('crypto');

// 生成SHEIN签名
function generateSheinSignature(openKeyId, secretKey, path, timestamp, randomKey) {
  console.log('=== SHEIN签名生成测试 ===\n');
  
  // 步骤1：组装签名数据VALUE
  const value = `${openKeyId}&${timestamp}&${path}`;
  console.log('步骤1 - 签名数据VALUE:', value);
  
  // 步骤2：组装签名密钥KEY
  const key = `${secretKey}${randomKey}`;
  console.log('步骤2 - 签名密钥KEY:', key);
  
  // 步骤3：HMAC-SHA256计算并转换为十六进制
  const hmac = crypto.createHmac('sha256', key);
  hmac.update(value);
  const hexSignature = hmac.digest('hex');
  console.log('步骤3 - HMAC-SHA256结果(HEX):', hexSignature);
  
  // 步骤4：Base64编码
  const base64Signature = Buffer.from(hexSignature).toString('base64');
  console.log('步骤4 - Base64编码结果:', base64Signature);
  
  // 步骤5：拼接RandomKey
  const finalSignature = `${randomKey}${base64Signature}`;
  console.log('步骤5 - 最终签名:', finalSignature);
  
  return finalSignature;
}

// 测试示例（使用文档中的示例数据）
const openKeyId = 'B96C15416C9240DF96BAA0BC9B367C6D';
const secretKey = '6BEC9C4B668B4B14B17EEF106BB98AE5';
const path = '/open-api/order/purchase-order-info';
const timestamp = '1740709414000';
const randomKey = 'test1';

const signature = generateSheinSignature(openKeyId, secretKey, path, timestamp, randomKey);

console.log('\n=== 预期结果 ===');
console.log('test1ZDZjYTJjNzg5ZjUzMDdkZTU2N2Y3NzcxN2ZjZjA5OGIxMTRhZWI0MTU1MzQxNjZlNjFkMGQxOTJiYTk1YWNjYQ==');

console.log('\n=== 实际结果 ===');
console.log(signature);

console.log('\n=== 验证结果 ===');
if (signature === 'test1ZDZjYTJjNzg5ZjUzMDdkZTU2N2Y3NzcxN2ZjZjA5OGIxMTRhZWI0MTU1MzQxNjZlNjFkMGQxOTJiYTk1YWNjYQ==') {
  console.log('✓ 签名算法正确！');
} else {
  console.log('✗ 签名算法有误，请检查！');
}
