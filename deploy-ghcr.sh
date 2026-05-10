#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$ROOT_DIR/docker/.env.ghcr"
COMPOSE_FILE="$ROOT_DIR/docker-compose.ghcr.yml"
IMAGE_TAG_OVERRIDE="${IMAGE_TAG_OVERRIDE:-}"
GHCR_USERNAME="${GHCR_USERNAME:-}"
GHCR_TOKEN="${GHCR_TOKEN:-}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[错误] 缺少环境变量文件: $ENV_FILE"
  echo "请先执行: cp docker/.env.ghcr.example docker/.env.ghcr"
  exit 1
fi

if [[ -n "$IMAGE_TAG_OVERRIDE" ]]; then
  export IMAGE_TAG="$IMAGE_TAG_OVERRIDE"
fi

if [[ -n "$GHCR_USERNAME" && -n "$GHCR_TOKEN" ]]; then
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
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
echo "  Shuotu ERP GHCR 镜像部署开始"
echo "========================================"
echo "[1/5] 启动基础设施..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d mysql redis rabbitmq
wait_for_mysql

echo "[2/5] 拉取最新业务镜像..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" pull migrator web admin-web admin-api gateway sync-engine oms wms pms misc oss webhook

echo "[3/5] 执行数据库迁移与补表..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm migrator

echo "[4/5] 启动/更新业务服务..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --remove-orphans web admin-web admin-api gateway sync-engine oms wms pms misc oss webhook

echo "[5/5] 当前容器状态"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

echo "========================================"
echo "  Shuotu ERP GHCR 镜像部署完成"
echo "========================================"
