@echo off
setlocal

echo ========================================
echo   ERP 开发模式一键启动脚本
echo ========================================
echo.

set "ROOT_DIR=%~dp0"

echo [0/3] 检查 Docker 基础设施...
docker ps --filter "name=eer-mysql" --format "{{.Status}}" | findstr "healthy" >nul 2>&1
if errorlevel 1 (
    echo MySQL 未运行或未就绪，正在启动 Docker 基础设施...
    docker compose -f "%ROOT_DIR%docker-compose.infra.yml" up -d
    echo 等待 MySQL 就绪...
    timeout /t 15 /nobreak > nul
) else (
    echo MySQL 已就绪
)

docker ps --filter "name=eer-redis" --format "{{.Status}}" | findstr "healthy" >nul 2>&1
if errorlevel 1 (
    echo Redis 未运行，请检查 Docker
    pause
    exit /b 1
) else (
    echo Redis 已就绪
)

docker ps --filter "name=eer-rabbitmq" --format "{{.Status}}" | findstr "healthy" >nul 2>&1
if errorlevel 1 (
    echo RabbitMQ 未运行或未就绪，等待中...
    timeout /t 10 /nobreak > nul
    docker ps --filter "name=eer-rabbitmq" --format "{{.Status}}" | findstr "healthy" >nul 2>&1
    if errorlevel 1 (
        echo RabbitMQ 仍未就绪，服务将在MQ不可用模式下运行
    ) else (
        echo RabbitMQ 已就绪
    )
) else (
    echo RabbitMQ 已就绪
)

echo.
echo [1/3] 启动后端微服务（开发模式 - nodemon 热重载）...

echo 启动 Webhook 服务 (端口 8678/8080)...
start "Webhook-Dev" cmd /k "cd /d "%ROOT_DIR%services\webhook" && npm run dev"
timeout /t 2 /nobreak > nul

echo 启动 OSS 服务 (端口 3001)...
start "OSS-Dev" cmd /k "cd /d "%ROOT_DIR%services\oss" && npm run dev"
timeout /t 2 /nobreak > nul

echo 启动 Sync-Engine 服务 (端口 5001)...
start "SyncEngine-Dev" cmd /k "cd /d "%ROOT_DIR%services\sync-engine" && npm run dev"
timeout /t 2 /nobreak > nul

echo 启动 OMS 服务 (端口 5002)...
start "OMS-Dev" cmd /k "cd /d "%ROOT_DIR%services\oms" && npm run dev"
timeout /t 2 /nobreak > nul

echo 启动 WMS 服务 (端口 5003)...
start "WMS-Dev" cmd /k "cd /d "%ROOT_DIR%services\wms" && npm run dev"
timeout /t 2 /nobreak > nul

echo 启动 PMS 服务 (端口 5004)...
start "PMS-Dev" cmd /k "cd /d "%ROOT_DIR%services\pms" && npm run dev"
timeout /t 2 /nobreak > nul

echo 启动 MISC 服务 (端口 5005)...
start "MISC-Dev" cmd /k "cd /d "%ROOT_DIR%services\misc" && npm run dev"
timeout /t 2 /nobreak > nul

echo 启动 Gateway 服务 (端口 5000)...
start "Gateway-Dev" cmd /k "cd /d "%ROOT_DIR%services\gateway" && npm run dev"
timeout /t 3 /nobreak > nul

echo.
echo [2/3] 启动主前端（开发模式）...
start "Frontend-Dev" cmd /k "cd /d "%ROOT_DIR%frontend" && npm start"

echo.
echo ========================================
echo   所有服务已以开发模式启动
echo ========================================
echo.
echo Docker 基础设施:
echo   MySQL:       localhost:3307 (Docker)
echo   Redis:       localhost:6380 (Docker)
echo   RabbitMQ:    localhost:5672 (Docker)
echo   RabbitMQ管理: http://localhost:15672 (eer_admin/eer_mq_2024)
echo.
echo 后端微服务（nodemon 热重载）:
echo   Gateway:     https://localhost:5000
echo   Sync-Engine: http://localhost:5001
echo   OMS:         http://localhost:5002
echo   WMS:         http://localhost:5003
echo   PMS:         http://localhost:5004
echo   MISC:        http://localhost:5005
echo   OSS:         http://localhost:3001
echo   Webhook:     https://localhost:8678
echo.
echo 前端:
echo   Frontend:    https://localhost:3788
echo.
echo 提示: 关闭对应命令行窗口即可停止服务。
echo.
pause

endlocal
