@echo off
REM 生成自签名SSL证书（用于开发测试）
REM 生产环境请使用正式的SSL证书

echo 正在生成自签名SSL证书...

REM 生成私钥
openssl genrsa -out server.key 2048

REM 生成证书签名请求
openssl req -new -key server.key -out server.csr -subj "/C=CN/ST=Fujian/L=Xiamen/O=YituERP/OU=IT/CN=localhost"

REM 生成自签名证书（有效期365天）
openssl x509 -req -days 365 -in server.csr -signkey server.key -out server.crt

REM 删除CSR文件
del server.csr

echo.
echo SSL证书生成完成！
echo 私钥: server.key
echo 证书: server.crt
echo.
echo 注意: 这是自签名证书，仅用于开发测试。
echo 生产环境请使用正式的SSL证书（如Let's Encrypt）。
pause
