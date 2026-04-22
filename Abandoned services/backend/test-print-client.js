/**
 * 测试打印客户端注册和获取列表
 */

const axios = require('axios');

const SERVER_URL = 'http://localhost:5000';

async function testPrintClient() {
  console.log('=== 测试打印客户端 API ===\n');
  
  // 1. 获取当前客户端列表
  console.log('1. 获取当前客户端列表...');
  try {
    const response = await axios.get(`${SERVER_URL}/api/remote-print/clients`);
    console.log('   响应:', JSON.stringify(response.data, null, 2));
    console.log('   客户端数量:', response.data.data?.length || 0);
  } catch (error) {
    console.log('   错误:', error.message);
  }
  
  // 2. 注册一个测试客户端
  console.log('\n2. 注册测试客户端...');
  try {
    const response = await axios.post(`${SERVER_URL}/api/remote-print/http-clients`, {
      clientId: 'test-client-001',
      clientName: '测试打印客户端',
      url: 'http://localhost:9100'
    });
    console.log('   响应:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('   错误:', error.message);
    if (error.response) {
      console.log('   响应数据:', error.response.data);
    }
  }
  
  // 3. 再次获取客户端列表
  console.log('\n3. 再次获取客户端列表...');
  try {
    const response = await axios.get(`${SERVER_URL}/api/remote-print/clients`);
    console.log('   响应:', JSON.stringify(response.data, null, 2));
    console.log('   客户端数量:', response.data.data?.length || 0);
  } catch (error) {
    console.log('   错误:', error.message);
  }
  
  // 4. 删除测试客户端
  console.log('\n4. 删除测试客户端...');
  try {
    const response = await axios.delete(`${SERVER_URL}/api/remote-print/http-clients/test-client-001`);
    console.log('   响应:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('   错误:', error.message);
  }
  
  // 5. 最终获取客户端列表
  console.log('\n5. 最终客户端列表...');
  try {
    const response = await axios.get(`${SERVER_URL}/api/remote-print/clients`);
    console.log('   响应:', JSON.stringify(response.data, null, 2));
    console.log('   客户端数量:', response.data.data?.length || 0);
  } catch (error) {
    console.log('   错误:', error.message);
  }
  
  console.log('\n=== 测试完成 ===');
}

testPrintClient();
