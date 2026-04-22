@echo off
setlocal

echo ========================================
echo   ERP前后端一键启动脚本
echo ========================================
echo.

set "ROOT_DIR=%~dp0"

if not exist "%ROOT_DIR%services\start-all.bat" (
  echo [错误] 未找到后端启动脚本: services\start-all.bat
  pause
  exit /b 1
)

if not exist "%ROOT_DIR%frontend\package.json" (
  echo [错误] 未找到前端目录: frontend
  pause
  exit /b 1
)

echo [1/2] 启动后端微服务...
start "ERP-Backend" cmd /k "cd /d "%ROOT_DIR%services" && start-all.bat"

timeout /t 3 /nobreak > nul

echo [2/2] 启动主前端...
start "ERP-Frontend" cmd /k "cd /d "%ROOT_DIR%frontend" && npm start"

echo.
echo ========================================
echo 已发起前后端启动
echo ========================================
echo.
echo 后端网关: http://localhost:5000
echo 主前端:   http://localhost:3000
echo.
echo 提示: 关闭对应命令行窗口即可停止服务。
echo.
pause

endlocal
