@echo off
setlocal EnableExtensions

echo ========================================
echo   ERP 开发模式一键启动脚本
echo ========================================
echo.

set "ROOT_DIR=%~dp0"

echo [0/4] 检查 Docker 基础设施...
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
echo [1/5] 检查并安装依赖...

call :ensure_deps "%ROOT_DIR%services\webhook" "node_modules\.bin\nodemon.cmd"
if errorlevel 1 goto install_failed
call :ensure_deps "%ROOT_DIR%services\oss" "node_modules\.bin\nodemon.cmd"
if errorlevel 1 goto install_failed
call :ensure_deps "%ROOT_DIR%services\sync-engine" "node_modules\.bin\nodemon.cmd"
if errorlevel 1 goto install_failed
call :ensure_deps "%ROOT_DIR%services\oms" "node_modules\.bin\nodemon.cmd"
if errorlevel 1 goto install_failed
call :ensure_deps "%ROOT_DIR%services\wms" "node_modules\.bin\nodemon.cmd"
if errorlevel 1 goto install_failed
call :ensure_deps "%ROOT_DIR%services\pms" "node_modules\.bin\nodemon.cmd"
if errorlevel 1 goto install_failed
call :ensure_deps "%ROOT_DIR%services\misc" "node_modules\.bin\nodemon.cmd"
if errorlevel 1 goto install_failed
call :ensure_deps "%ROOT_DIR%services\gateway" "node_modules\.bin\nodemon.cmd"
if errorlevel 1 goto install_failed
call :ensure_deps "%ROOT_DIR%services\platform-admin" "node_modules\.bin\nodemon.cmd"
if errorlevel 1 goto install_failed
call :ensure_deps "%ROOT_DIR%frontend" "node_modules\.bin\react-scripts.cmd"
if errorlevel 1 goto install_failed
call :ensure_deps "%ROOT_DIR%platform-admin" "node_modules\.bin\react-scripts.cmd"
if errorlevel 1 goto install_failed

echo.
echo [2/5] 清理开发端口占用...
call :kill_port 8678
call :kill_port 8080
call :kill_port 3001
call :kill_port 5000
call :kill_port 5001
call :kill_port 5002
call :kill_port 5003
call :kill_port 5004
call :kill_port 5005
call :kill_port 5090
call :kill_port 3788
call :kill_port 3790

echo.
echo [3/5] 启动后端微服务（开发模式 - nodemon 热重载）...

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

echo 启动 Platform Admin API 服务 (端口 5090)...
start "Platform-Admin-API-Dev" cmd /k "cd /d "%ROOT_DIR%services\platform-admin" && npm run dev"
timeout /t 2 /nobreak > nul

echo.
echo [4/5] 启动主前端（开发模式）...
start "Frontend-Dev" cmd /k "cd /d "%ROOT_DIR%frontend" && npm start"
timeout /t 2 /nobreak > nul

echo.
echo [5/5] 启动平台管理后台前端（开发模式）...
start "Platform-Admin-Web-Dev" cmd /k "cd /d "%ROOT_DIR%platform-admin" && npm start"

echo.
echo ========================================
echo   所有服务已以开发模式启动
echo ========================================
echo.
echo Docker 基础设施:
echo   MySQL:       localhost:3316 (Docker)
echo   Redis:       localhost:6380 (Docker)
echo   RabbitMQ:    localhost:5672 (Docker)
echo   RabbitMQ管理: http://localhost:15672 (eer_admin/eer_mq_2024)
echo.
echo 后端微服务（nodemon 热重载）:
echo   Gateway:     http://localhost:5080 (前端代理)
echo   Gateway:     https://localhost:5000
echo   Platform API: http://localhost:5090
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
echo   Admin Web:   http://localhost:3790
echo.
echo 提示: 关闭对应命令行窗口即可停止服务。
echo.
pause

endlocal
goto :eof

:install_failed
echo.
echo 依赖安装失败，启动流程已中止。
pause
endlocal
exit /b 1

:ensure_deps
set "TARGET_DIR=%~1"
set "TARGET_MARKER=%~2"
set "NEED_INSTALL=0"

if not exist "%TARGET_DIR%\package.json" exit /b 0

if not exist "%TARGET_DIR%\node_modules" (
    set "NEED_INSTALL=1"
) else (
    if not "%TARGET_MARKER%"=="" (
        if not exist "%TARGET_DIR%\%TARGET_MARKER%" set "NEED_INSTALL=1"
    )
)

if "%NEED_INSTALL%"=="0" (
    echo 依赖已就绪: %TARGET_DIR%
    exit /b 0
)

echo 安装依赖: %TARGET_DIR%
pushd "%TARGET_DIR%"

if exist "package-lock.json" (
    call npm ci
    if errorlevel 1 (
        echo npm ci 失败，尝试 npm install...
        call npm install
    )
) else (
    call npm install
)

set "INSTALL_EXIT=%errorlevel%"
popd

if not "%INSTALL_EXIT%"=="0" exit /b %INSTALL_EXIT%

echo 依赖安装完成: %TARGET_DIR%
exit /b 0

:kill_port
set "TARGET_PORT=%~1"
if "%TARGET_PORT%"=="" exit /b 0

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%TARGET_PORT% .*LISTENING"') do (
    if not "%%P"=="0" (
        echo 关闭占用端口 %TARGET_PORT% 的进程 PID=%%P
        taskkill /F /PID %%P >nul 2>&1
    )
)

exit /b 0
