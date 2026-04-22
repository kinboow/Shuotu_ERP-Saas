@echo off
chcp 65001 >nul
echo ========================================
echo   PDA登录功能增强 - 安装脚本
echo ========================================
echo.

echo [1/2] 更新数据库...
echo 请输入MySQL root密码：
set /p MYSQL_PASSWORD=
mysql -u root -p%MYSQL_PASSWORD% < services\database\pda_login_enhancement.sql
if %errorlevel% neq 0 (
    echo [错误] 数据库更新失败
    pause
    exit /b 1
)
echo [完成] 数据库更新成功
echo.

echo [2/2] 重启MISC服务...
echo MISC服务会自动重启（nodemon）
echo.

echo ========================================
echo   安装完成！
echo ========================================
echo.
echo 功能说明：
echo 1. PDA端支持企业员工和物流商两种登录方式
echo 2. 物流商登录后只能看到自己的快递公司
echo 3. 在Web端"设置-物流商账号"中为物流商设置登录账号
echo 4. 在Web端"设置-用户管理"中可控制员工的PDA访问权限
echo.
echo 访问地址：
echo - PDA登录: https://192.168.5.105:3099/login
echo - 物流商账号管理: https://erp.hlsd.work:3000/logistics-account-management
echo.
pause
