const sequelize = require('./config/database');

async function checkDrafts() {
  try {
    const [results] = await sequelize.query(`
      SELECT id, title, draft_type, platforms, created_at 
      FROM publish_drafts 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    console.log('=== 草稿箱数据 ===');
    console.log(`总共找到 ${results.length} 条草稿\n`);
    
    results.forEach(r => {
      console.log(`ID: ${r.id}`);
      console.log(`标题: ${r.title}`);
      console.log(`类型: ${r.draft_type}`);
      console.log(`平台: ${r.platforms}`);
      console.log(`创建时间: ${r.created_at}`);
      console.log('---');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('查询失败:', error);
    process.exit(1);
  }
}

checkDrafts();
