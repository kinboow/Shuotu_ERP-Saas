@echo off
setlocal

echo ========================================
echo   Shuotu ERP Docker 一键部署
echo ========================================
echo.

docker compose --env-file docker/.env.docker up -d --build
if errorlevel 1 (
    echo.
    echo [错误] Docker 部署失败
    exit /b 1
)

echo.
echo 部署完成
echo 前端入口: http://localhost:8088
echo RabbitMQ管理: http://localhost:15672
echo.
