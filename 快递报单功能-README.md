# 快递报单功能

> 快递员移动端报单 + 电脑端管理查看

## 🚀 快速开始

### 1. 安装（3分钟）

```bash
# 运行一键安装脚本
install-courier-report.bat

# 或手动安装
# 1) 初始化数据库
mysql -u root -p < services/database/courier_reports.sql

# 2) 安装依赖
cd pda-app && npm install dayjs
```

### 2. 访问

- **PDA移动端**：`https://192.168.5.105:3099/courier-report`
- **Web管理端**：`https://erp.hlsd.work:3000/courier-reports`

### 3. 测试

```bash
# 测试API是否正常
test-courier-report-api.bat
```

---

## 📱 功能说明

### PDA端（快递员使用）

1. 选择快递公司
2. 填写大件/小件数量
3. 扫码或输入包裹号
4. 提交报单

### Web端（管理员查看）

1. 查看所有报单
2. 按条件筛选
3. 查看详情
4. 确认/取消/删除

---

## 📚 文档

- **[安装说明](./快递报单功能安装说明.md)** - 详细的安装部署步骤
- **[使用手册](./快递报单功能说明.md)** - 完整的功能使用说明
- **[开发文档](./快递报单功能-开发总结.md)** - 技术实现细节
- **[交付清单](./快递报单功能-交付清单.md)** - 完整的交付内容

---

## 🎯 核心特性

- ✅ 自动填充日期
- ✅ 实时计算总件数
- ✅ 扫码支持
- ✅ 重复检测
- ✅ 状态管理
- ✅ 统计报表

---

## 🔧 技术栈

- **后端**：Node.js + Express + Sequelize + MySQL
- **PDA端**：React + Ant Design Mobile
- **Web端**：React + Ant Design

---

## 📊 数据库表

- `courier_companies` - 快递公司（10家预置）
- `courier_reports` - 报单主表
- `courier_report_items` - 报单明细

---

## 🆘 常见问题

**Q: 数据库初始化失败？**  
A: 检查MySQL是否安装，密码是否正确

**Q: API请求失败？**  
A: 检查MISC服务是否运行：`curl -k https://localhost:5000/health`

**Q: 页面无法访问？**  
A: 检查前端/PDA服务是否启动

---

## 📞 技术支持

- 查看文档：`快递报单功能说明.md`
- 联系开发团队

---

**版本**：v1.0  
**日期**：2026-01-18  
**状态**：✅ 已完成，可投入使用
