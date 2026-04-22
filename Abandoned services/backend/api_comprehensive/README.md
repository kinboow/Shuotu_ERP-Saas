# API功能模块文件夹

本文件夹存放所有平台API调用的功能模块文件。

## 文件命名规则

`平台名_功能分类_功能名.js`

### 示例
- `SHEIN全托管_SHEIN自营_商品_批量获取SKC尺码.js`
- `SHEIN全托管_SHEIN自营_SHEIN-POP_订单_获取采购单信息.js`
- `SHEIN全托管_SHEIN自营_SHEIN-POP_采购单_查询JIT母单子单关系.js`

## 功能模块结构

每个功能模块文件应包含：

```javascript
/**
 * 功能名称
 * 可用平台：平台1、平台2
 * API路径：/open-api/xxx
 * 
 * @param {Object} params - 调用参数
 * @param {Object} params.shop - 店铺信息（包含open_key_id, secret_key, api_domain）
 * @param {其他参数} params.xxx - 其他必要参数
 * @returns {Promise<Object>} - 返回结果
 */
async function 功能名(params) {
  // 1. 参数验证
  // 2. 生成签名
  // 3. 调用API
  // 4. 处理响应
  // 5. 返回结果
}

module.exports = { 功能名 };
```

## 路由调用方式

```javascript
const { 功能名 } = require('../api_comprehensive/平台名_功能分类_功能名');

router.post('/xxx', async (req, res) => {
  const result = await 功能名({
    shop: shopInfo,
    // 其他参数
  });
  res.json(result);
});
```
