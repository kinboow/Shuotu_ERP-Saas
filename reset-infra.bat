@echo off
setlocal

echo ========================================
echo   重置本地基础设施并重新导入 SQL
echo ========================================
echo.
echo [警告] 此操作会删除 MySQL/Redis 持久化数据！
set /p confirm=确认继续请输入 YES: 
if /I not "%confirm%"=="YES" (
  echo 已取消操作。
  pause
  exit /b 0
)

where docker >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 Docker，请先安装 Docker Desktop 并启动。
  pause
  exit /b 1
)

where docker-compose >nul 2>nul
if errorlevel 1 (
  set "COMPOSE_CMD=docker compose"
) else (
  set "COMPOSE_CMD=docker-compose"
)

echo 停止并删除容器、网络、卷...
%COMPOSE_CMD% -f docker-compose.infra.yml down -v
if errorlevel 1 (
  echo [错误] 清理失败，请检查 Docker 状态。
  pause
  exit /b 1
)

echo 重新启动基础设施（将自动重新导入 SQL）...
%COMPOSE_CMD% -f docker-compose.infra.yml up -d
if errorlevel 1 (
  echo [错误] 启动失败。
  pause
  exit /b 1
)

echo.
echo 重置完成。
echo MySQL: localhost:3306  root/root123  DB: eer
echo Redis: localhost:6380
echo.
pause

endlocal
