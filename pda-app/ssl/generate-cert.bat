@echo off
echo 生成自签名SSL证书...
echo.

REM 检查是否安装了openssl
where openssl >nul 2>nul
if %errorlevel% neq 0 (
    echo 错误: 未找到openssl命令
    echo 请安装OpenSSL或使用Git Bash运行generate-cert.sh
    pause
    exit /b 1
)

REM 生成私钥和证书
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost/O=PDA-App/C=CN" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:192.168.5.105"

if %errorlevel% equ 0 (
    echo.
    echo 证书生成成功！
    echo   - cert.pem: SSL证书
    echo   - key.pem: 私钥
    echo.
    echo 请重启PDA应用以使用HTTPS
) else (
    echo 证书生成失败
)

pause
