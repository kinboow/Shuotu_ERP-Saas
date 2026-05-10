#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$ROOT_DIR/docker/.env.production"
COMPOSE_FILE="$ROOT_DIR/docker-compose.prod.yml"
DEPLOY_REMOTE="${DEPLOY_REMOTE:-origin}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[错误] 缺少生产环境变量文件: $ENV_FILE"
  echo "请先执行: cp docker/.env.production.example docker/.env.production"
  exit 1
fi

echo "========================================"
echo "  Shuotu ERP 生产部署开始"
echo "========================================"
echo "[1/5] 更新代码..."
git -C "$ROOT_DIR" fetch "$DEPLOY_REMOTE" "$DEPLOY_BRANCH"
git -C "$ROOT_DIR" checkout "$DEPLOY_BRANCH"
git -C "$ROOT_DIR" pull --ff-only "$DEPLOY_REMOTE" "$DEPLOY_BRANCH"

echo "[2/5] 构建镜像..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build migrator web admin-web admin-api gateway sync-engine oms wms pms misc oss webhook

echo "[3/5] 执行数据库迁移与补表..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm migrator

echo "[4/5] 启动/更新服务..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --remove-orphans web admin-web admin-api gateway sync-engine oms wms pms misc oss webhook

echo "[5/5] 当前容器状态"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

echo "========================================"
echo "  Shuotu ERP 生产部署完成"
echo "========================================"
