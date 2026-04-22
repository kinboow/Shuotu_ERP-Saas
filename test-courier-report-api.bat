@echo off
chcp 65001 >nul
echo ========================================
echo   快递报单功能 - API测试
echo ========================================
echo.

echo [测试1] 获取快递公司列表...
curl -k -s https://localhost:5000/api/courier-companies
echo.
echo.

echo [测试2] 检查MISC服务健康状态...
curl -k -s https://localhost:5000/health
echo.
echo.

echo ========================================
echo   测试完成
echo ========================================
echo.
echo 如果看到快递公司列表和健康状态，说明API正常运行
echo.
echo 下一步：
echo 1. 在浏览器打开 https://192.168.5.105:3099/courier-report
echo 2. 登录后测试创建报单功能
echo 3. 在浏览器打开 https://erp.hlsd.work:3000/courier-reports
echo 4. 查看报单列表
echo.
pause
