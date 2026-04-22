/**
 * 将 TTF 字体文件转换为 pdfmake 可用的 vfs 格式
 * 运行: node scripts/generate-font-vfs.js
 */
const fs = require('fs');
const path = require('path');

const fontPath = path.join(__dirname, '../src/fonts/1611458310630572.ttf');
const outputPath = path.join(__dirname, '../src/fonts/vfs_fonts.js');

if (!fs.existsSync(fontPath)) {
  console.error('字体文件不存在:', fontPath);
  process.exit(1);
}

const fontBuffer = fs.readFileSync(fontPath);
const base64Font = fontBuffer.toString('base64');

const vfsContent = `// 自动生成的字体文件，请勿手动修改
// 生成时间: ${new Date().toISOString()}

const chineseFontVfs = {
  "ChineseFont.ttf": "${base64Font}"
};

export default chineseFontVfs;
`;

fs.writeFileSync(outputPath, vfsContent);
console.log('字体 vfs 文件已生成:', outputPath);
console.log('字体大小:', (fontBuffer.length / 1024 / 1024).toFixed(2), 'MB');
