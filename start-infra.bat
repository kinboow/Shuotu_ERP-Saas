@echo off
setlocal

echo ========================================
echo   启动本地基础设施 (MySQL + Redis)
echo ========================================
echo.

where docker >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 Docker，请先安装 Docker Desktop 并启动。
  pause
  exit /b 1
)

where docker-compose >nul 2>nul
if errorlevel 1 (
  echo [信息] 未检测到 docker-compose 独立命令，尝试使用 docker compose ...
  set "COMPOSE_CMD=docker compose"
) else (
  set "COMPOSE_CMD=docker-compose"
)

echo [1/2] 拉起 MySQL 与 Redis...
%COMPOSE_CMD% -f docker-compose.infra.yml up -d
if errorlevel 1 (
  echo [错误] 基础设施启动失败。
  pause
  exit /b 1
)

echo [2/2] 查看容器状态...
%COMPOSE_CMD% -f docker-compose.infra.yml ps

echo.
echo ========================================
echo 启动完成
echo ========================================
echo MySQL: localhost:3306  (root/root123, DB: eer)
echo Redis: localhost:6380
echo.
echo 首次初始化时，MySQL 会自动导入：
echo - services/database/init.sql
echo - services/database/courier_reports.sql
echo - services/database/pda_login_enhancement.sql
echo.
echo 提示：如需强制重新导入 SQL，请运行 reset-infra.bat
echo.
pause

endlocal
