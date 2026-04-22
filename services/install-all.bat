@echo off
echo ========================================
echo   xietu微服务依赖安装脚本
echo ========================================

echo.
echo 安装 shared 依赖...
cd /d %~dp0shared
call npm install

echo.
echo 安装 oss 依赖...
cd /d %~dp0oss
call npm install

echo.
echo 安装 sync-engine 依赖...
cd /d %~dp0sync-engine
call npm install

echo.
echo 安装 oms 依赖...
cd /d %~dp0oms
call npm install

echo.
echo 安装 wms 依赖...
cd /d %~dp0wms
call npm install

echo.
echo 安装 pms 依赖...
cd /d %~dp0pms
call npm install

echo.
echo 安装 misc 依赖...
cd /d %~dp0misc
call npm install

echo.
echo 安装 gateway 依赖...
cd /d %~dp0gateway
call npm install

echo.
echo 安装 webhook 依赖...
cd /d %~dp0webhook
call npm install

echo.
echo ========================================
echo   所有依赖安装完成
echo ========================================
pause
