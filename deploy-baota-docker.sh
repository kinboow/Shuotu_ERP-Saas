#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$ROOT_DIR/docker/.env.baota"
COMPOSE_FILE="$ROOT_DIR/docker-compose.baota.yml"
DEPLOY_REMOTE="${DEPLOY_REMOTE:-origin}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
SKIP_GIT_PULL="${SKIP_GIT_PULL:-0}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[错误] 缺少环境变量文件: $ENV_FILE"
  echo "请先执行: cp docker/.env.baota.example docker/.env.baota"
  exit 1
fi

wait_for_mysql() {
  local mysql_id
  local status
  local retries=60

  mysql_id="$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps -q mysql)"
  if [[ -z "$mysql_id" ]]; then
    echo "[错误] 未找到 mysql 容器"
    exit 1
  fi

  for ((i=1; i<=retries; i++)); do
    status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$mysql_id" 2>/dev/null || true)"
    if [[ "$status" == "healthy" ]]; then
      echo "[信息] MySQL 已就绪"
      return 0
    fi
    echo "[等待] MySQL 启动中... ($i/$retries)"
    sleep 3
  done

  echo "[错误] MySQL 在预期时间内未就绪"
  exit 1
}

echo "========================================"
echo "  Shuotu ERP 宝塔 Docker 部署开始"
echo "========================================"

echo "[1/6] 更新代码..."
if [[ "$SKIP_GIT_PULL" == "1" ]]; then
  echo "[信息] 已跳过 Git 更新"
else
  git -C "$ROOT_DIR" fetch "$DEPLOY_REMOTE" "$DEPLOY_BRANCH"
  git -C "$ROOT_DIR" checkout "$DEPLOY_BRANCH"
  git -C "$ROOT_DIR" pull --ff-only "$DEPLOY_REMOTE" "$DEPLOY_BRANCH"
fi

echo "[2/6] 启动基础设施..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d mysql redis rabbitmq
wait_for_mysql

echo "[3/6] 构建业务镜像..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build migrator web admin-web admin-api gateway sync-engine oms wms pms misc oss webhook

echo "[4/6] 执行数据库迁移与补表..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm migrator

echo "[5/6] 启动全部服务..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --remove-orphans web admin-web admin-api gateway sync-engine oms wms pms misc oss webhook

echo "[6/6] 当前容器状态"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

echo "========================================"
echo "  Shuotu ERP 宝塔 Docker 部署完成"
echo "========================================"
