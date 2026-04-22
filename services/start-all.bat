@echo off
echo ========================================
echo   ERP微服务启动脚本
echo ========================================

echo.
echo 请确保已安装并启动相关的数据库:
echo   - MySQL (端口 3306)
echo   - Redis (端口 6379)
echo.

echo 启动 Webhook 服务 (端口 8678/8080)...
start "Webhook" cmd /k "cd /d %~dp0webhook && npm start"

timeout /t 2 /nobreak > nul

echo 启动 OSS 服务 (端口 3001)...
start "OSS" cmd /k "cd /d %~dp0oss && npm start"

timeout /t 2 /nobreak > nul

echo 启动 Sync-Engine 服务 (端口 5001)...
start "Sync-Engine" cmd /k "cd /d %~dp0sync-engine && npm start"

timeout /t 2 /nobreak > nul

echo 启动 OMS 服务 (端口 5002)...
start "OMS" cmd /k "cd /d %~dp0oms && npm start"

timeout /t 2 /nobreak > nul

echo 启动 WMS 服务 (端口 5003)...
start "WMS" cmd /k "cd /d %~dp0wms && npm start"

timeout /t 2 /nobreak > nul

echo 启动 PMS 服务 (端口 5004)...
start "PMS" cmd /k "cd /d %~dp0pms && npm start"

timeout /t 2 /nobreak > nul

echo 启动 MISC 服务 (端口 5005)...
start "MISC" cmd /k "cd /d %~dp0misc && npm start"

timeout /t 2 /nobreak > nul

echo 启动 Gateway 服务 (端口 5000)...
start "Gateway" cmd /k "cd /d %~dp0gateway && npm start"


echo.
echo ========================================
echo   所有服务已启动
echo ========================================
echo.
echo 服务地址:
echo   Gateway:     http://localhost:5000
echo   Sync-Engine: http://localhost:5001
echo   OMS:         http://localhost:5002
echo   WMS:         http://localhost:5003
echo   PMS:         http://localhost:5004
echo   MISC:        http://localhost:5005
echo   OSS:         http://localhost:3001
echo   Webhook:     https://localhost:8678 (HTTP: 8080)
echo.
pause
