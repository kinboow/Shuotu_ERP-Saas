@echo off
chcp 65001 >nul
echo ========================================
echo   快递报单功能 - 一键安装脚本
echo ========================================
echo.

echo [1/4] 安装PDA依赖...
cd pda-app
call npm install dayjs
if %errorlevel% neq 0 (
    echo [错误] PDA依赖安装失败
    pause
    exit /b 1
)
cd ..
echo [完成] PDA依赖安装成功
echo.

echo [2/4] 初始化数据库...
echo 请输入MySQL root密码：
set /p MYSQL_PASSWORD=
mysql -u root -p%MYSQL_PASSWORD% < services\database\courier_reports.sql
if %errorlevel% neq 0 (
    echo [错误] 数据库初始化失败
    echo 请检查MySQL是否已安装并在PATH中
    pause
    exit /b 1
)
echo [完成] 数据库初始化成功
echo.

echo [3/4] 检查服务状态...
curl -k -s https://localhost:5000/api/courier-companies >nul 2>&1
if %errorlevel% neq 0 (
    echo [提示] MISC服务未运行，请手动启动
    echo 命令: cd services\misc ^&^& npm run dev
) else (
    echo [完成] MISC服务运行正常
)
echo.

echo [4/4] 安装完成！
echo.
echo ========================================
echo   访问地址
echo ========================================
echo PDA移动端: https://192.168.5.105:3099/courier-report
echo Web管理端: https://erp.hlsd.work:3000/courier-reports
echo.
echo ========================================
echo   快速启动命令
echo ========================================
echo 启动MISC服务: cd services\misc ^&^& npm run dev
echo 启动PDA应用: cd pda-app ^&^& npm start
echo 启动Web前端: cd frontend ^&^& npm start
echo.
pause
