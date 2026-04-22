# Webhook微服务部署指南

## 部署前准备

### 1. 服务器要求
- 操作系统：Linux/Windows Server
- Node.js版本：14.x 或更高
- 公网IP或域名
- 开放端口：8678（HTTPS）、8080（HTTP）

### 2. 获取SHEIN配置信息
登录SHEIN开放平台，获取以下信息：
- `APP_ID`：应用ID
- `APP_SECRET_KEY`：应用密钥（用于Webhook验签和解密）

**注意：** Webhook使用的是应用级别的appid和appSecretKey，不是供应商的openKey和secretKey。

## 部署步骤

### 1. 上传代码到服务器

```bash
# 上传整个services/webhook目录到服务器
scp -r services/webhook user@your-server:/path/to/services/
```

### 2. 安装依赖

```bash
cd /path/to/services/webhook
npm install --production
```

### 3. 配置环境变量

编辑 `services/.env` 文件：

```env
# Webhook服务端口
WEBHOOK_HTTPS_PORT=8678
WEBHOOK_HTTP_PORT=8080

# SHEIN全托管Webhook配置
SHEIN_FULL_APP_ID=你的APP_ID
SHEIN_FULL_APP_SECRET_KEY=你的APP_SECRET_KEY

# SSL证书路径（可选）
SSL_KEY_PATH=/path/to/ssl/server.key
SSL_CERT_PATH=/path/to/ssl/server.crt
```

### 4. 配置SSL证书

#### 方案A：使用Let's Encrypt免费证书（推荐）

```bash
# 安装certbot
sudo apt-get install certbot

# 生成证书
sudo certbot certonly --standalone -d your-domain.com

# 证书位置
# /etc/letsencrypt/live/your-domain.com/privkey.pem
# /etc/letsencrypt/live/your-domain.com/fullchain.pem

# 在.env中配置
SSL_KEY_PATH=/etc/letsencrypt/live/your-domain.com/privkey.pem
SSL_CERT_PATH=/etc/letsencrypt/live/your-domain.com/fullchain.pem
```

#### 方案B：使用自签名证书（仅测试）

```bash
cd ssl
./generate-cert.bat  # Windows
# 或
./generate-cert.sh   # Linux
```

### 5. 配置防火墙

```bash
# Ubuntu/Debian
sudo ufw allow 8678/tcp
sudo ufw allow 8080/tcp

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=8678/tcp
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --reload
```

### 6. 使用PM2管理进程（推荐）

```bash
# 安装PM2
npm install -g pm2

# 启动服务
pm2 start src/index.js --name webhook

# 设置开机自启
pm2 startup
pm2 save

# 查看日志
pm2 logs webhook

# 重启服务
pm2 restart webhook
```

### 7. 配置Nginx反向代理（可选）

如果希望使用标准的443端口，可以配置Nginx：

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/ssl/server.crt;
    ssl_certificate_key /path/to/ssl/server.key;

    location /shein-full/ {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /temu/ {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /tiktok/ {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

重启Nginx：
```bash
sudo nginx -t
sudo systemctl restart nginx
```

### 8. 在SHEIN平台配置回调地址

1. 登录SHEIN开放平台：https://open.sheincorp.com
2. 进入应用管理 → 选择你的应用
3. 找到Webhook配置页面
4. 配置回调地址：
   - 直接访问：`https://your-domain.com:8678/shein-full/callback`
   - 通过Nginx：`https://your-domain.com/shein-full/callback`
5. 保存配置

### 9. 测试验证

#### 本地测试
```bash
# 运行测试脚本（模拟SHEIN服务器）
node test-webhook.js
```

#### 生产环境测试
```bash
# 检查服务状态
pm2 status

# 查看实时日志
pm2 logs webhook --lines 100

# 测试端口是否开放
curl https://your-domain.com:8678/health
# 或
curl https://your-domain.com/health  # 如果使用Nginx
```

#### 在SHEIN平台触发测试
1. 在SHEIN平台后台找到Webhook测试功能
2. 发送测试事件
3. 查看webhook服务日志确认收到请求

## 监控和维护

### 查看日志
```bash
# PM2日志
pm2 logs webhook

# 系统日志（如果使用systemd）
journalctl -u webhook -f
```

### 性能监控
```bash
# PM2监控
pm2 monit

# 查看进程状态
pm2 status
```

### 重启服务
```bash
# 重启webhook服务
pm2 restart webhook

# 重载配置（无缝重启）
pm2 reload webhook
```

## 故障排查

### 1. SHEIN无法访问回调地址
- 检查防火墙是否开放端口
- 检查服务器安全组配置
- 确认域名DNS解析正确
- 测试公网访问：`curl https://your-domain.com:8678/health`

### 2. 签名验证失败
- 检查 `SHEIN_FULL_APP_ID` 是否正确
- 检查 `SHEIN_FULL_APP_SECRET_KEY` 是否正确
- 确认使用的是appid而不是openKeyId
- 查看日志中的签名对比信息

### 3. 解密失败
- 检查 `SHEIN_FULL_APP_SECRET_KEY` 是否正确
- 确认密钥长度至少16字节
- 检查是否使用了正确的IV（默认：space-station-default-iv）

### 4. 服务无响应
- 检查进程是否运行：`pm2 status`
- 查看错误日志：`pm2 logs webhook --err`
- 检查端口占用：`netstat -tlnp | grep 8080`
- 重启服务：`pm2 restart webhook`

### 5. SSL证书问题
- 检查证书是否过期：`openssl x509 -in server.crt -noout -dates`
- 检查证书路径是否正确
- 确认证书文件权限正确

## 安全建议

1. **使用HTTPS**：生产环境必须使用HTTPS，不要使用HTTP
2. **IP白名单**：在防火墙配置SHEIN平台IP白名单
3. **定期更新**：定期更新Node.js和依赖包
4. **日志审计**：定期检查webhook日志，发现异常请求
5. **密钥安全**：不要将密钥提交到代码仓库，使用环境变量管理

## SHEIN平台IP白名单

建议在防火墙配置以下IP白名单，只允许SHEIN服务器访问：

```
120.24.77.228
8.129.229.113
8.129.226.74
8.129.9.82
8.129.7.84
47.106.180.122
120.79.71.235
47.112.201.95
47.112.17.164
47.106.77.136
8.138.164.6
8.134.140.235
8.219.56.57
8.219.138.159
47.244.123.114
8.210.12.12
52.34.71.36
44.229.47.182
52.40.22.133
34.208.2.54
52.37.43.177
100.20.197.247
52.21.82.95
44.218.161.133
```

## 更新部署

```bash
# 拉取最新代码
git pull

# 安装新依赖
npm install --production

# 重启服务
pm2 restart webhook
```

## 回滚

```bash
# 查看PM2保存的历史版本
pm2 list

# 停止当前服务
pm2 stop webhook

# 切换到旧版本代码
git checkout <old-commit>

# 重新安装依赖
npm install --production

# 启动服务
pm2 start src/index.js --name webhook
```
