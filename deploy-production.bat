@echo off
setlocal EnableExtensions

set "ROOT_DIR=%~dp0"
set "ENV_FILE=%ROOT_DIR%docker\.env.production"
set "COMPOSE_FILE=%ROOT_DIR%docker-compose.prod.yml"
set "DEPLOY_REMOTE=origin"
set "DEPLOY_BRANCH=main"

if not "%~1"=="" set "DEPLOY_BRANCH=%~1"

if not exist "%ENV_FILE%" (
    echo [错误] 缺少生产环境变量文件: %ENV_FILE%
    echo 请先复制 docker\.env.production.example 为 docker\.env.production 并填写真实配置
    exit /b 1
)

echo ========================================
echo   Shuotu ERP 生产部署开始
echo ========================================

echo [1/5] 更新代码...
git -C "%ROOT_DIR%" fetch %DEPLOY_REMOTE% %DEPLOY_BRANCH%
if errorlevel 1 exit /b 1
git -C "%ROOT_DIR%" checkout %DEPLOY_BRANCH%
if errorlevel 1 exit /b 1
git -C "%ROOT_DIR%" pull --ff-only %DEPLOY_REMOTE% %DEPLOY_BRANCH%
if errorlevel 1 exit /b 1

echo [2/5] 构建镜像...
docker compose --env-file "%ENV_FILE%" -f "%COMPOSE_FILE%" build migrator web admin-web admin-api gateway sync-engine oms wms pms misc oss webhook
if errorlevel 1 exit /b 1

echo [3/5] 执行数据库迁移与补表...
docker compose --env-file "%ENV_FILE%" -f "%COMPOSE_FILE%" run --rm migrator
if errorlevel 1 exit /b 1

echo [4/5] 启动/更新服务...
docker compose --env-file "%ENV_FILE%" -f "%COMPOSE_FILE%" up -d --remove-orphans web admin-web admin-api gateway sync-engine oms wms pms misc oss webhook
if errorlevel 1 exit /b 1

echo [5/5] 当前容器状态
docker compose --env-file "%ENV_FILE%" -f "%COMPOSE_FILE%" ps

echo ========================================
echo   Shuotu ERP 生产部署完成
echo ========================================
