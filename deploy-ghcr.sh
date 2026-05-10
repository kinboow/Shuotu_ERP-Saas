#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$ROOT_DIR/docker/.env.ghcr"
COMPOSE_FILE="$ROOT_DIR/docker-compose.ghcr.yml"
IMAGE_TAG_OVERRIDE="${IMAGE_TAG_OVERRIDE:-}"
GHCR_NAMESPACE_OVERRIDE="${GHCR_NAMESPACE_OVERRIDE:-}"
GHCR_USERNAME="${GHCR_USERNAME:-}"
GHCR_TOKEN="${GHCR_TOKEN:-}"
SKIP_GHCR_LOGIN="${SKIP_GHCR_LOGIN:-0}"
SKIP_IMAGE_PULL="${SKIP_IMAGE_PULL:-0}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[错误] 缺少环境变量文件: $ENV_FILE"
  echo "请先执行: cp docker/.env.ghcr.example docker/.env.ghcr"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

if [[ -n "$GHCR_NAMESPACE_OVERRIDE" ]]; then
  export GHCR_NAMESPACE="$GHCR_NAMESPACE_OVERRIDE"
fi

if [[ -n "$IMAGE_TAG_OVERRIDE" ]]; then
  export IMAGE_TAG="$IMAGE_TAG_OVERRIDE"
fi

sql_escape() {
  printf "%s" "$1" | sed "s/'/''/g"
}

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

ensure_mysql_root_network_access() {
  local escaped_password

  escaped_password="$(sql_escape "$MYSQL_ROOT_PASSWORD")"

  echo "[信息] 修复 MySQL root 容器网络访问授权..."
  docker_compose exec -T mysql mysql -uroot "-p${MYSQL_ROOT_PASSWORD}" <<SQL
CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED WITH mysql_native_password BY '${escaped_password}';
ALTER USER 'root'@'%' IDENTIFIED WITH mysql_native_password BY '${escaped_password}';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;
FLUSH PRIVILEGES;
SQL
}

docker_compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

docker_login_with_retry() {
  local retries="${GHCR_LOGIN_RETRIES:-3}"
  local delay="${GHCR_LOGIN_RETRY_DELAY:-10}"

  if [[ "$SKIP_GHCR_LOGIN" == "1" ]]; then
    echo "[信息] 已跳过 GHCR 登录"
    return 0
  fi

  if [[ -z "$GHCR_USERNAME" || -z "$GHCR_TOKEN" ]]; then
    echo "[信息] 未提供 GHCR 凭证，跳过 docker login"
    return 0
  fi

  for ((i=1; i<=retries; i++)); do
    if echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin; then
      echo "[信息] GHCR 登录成功"
      return 0
    fi

    if (( i < retries )); then
      echo "[重试] GHCR 登录失败，${delay} 秒后重试... ($i/$retries)"
      sleep "$delay"
    fi
  done

  echo "[错误] GHCR 登录失败，请检查服务器到 ghcr.io 的网络连通性"
  exit 1
}

BUSINESS_SERVICES=(migrator web admin-web admin-api gateway sync-engine oms wms pms misc oss webhook)

ensure_local_business_images() {
  local image_ref

  for service in "${BUSINESS_SERVICES[@]}"; do
    image_ref="${GHCR_NAMESPACE}/shuotu-erp-${service}:${IMAGE_TAG:-latest}"
    if ! docker image inspect "$image_ref" >/dev/null 2>&1; then
      echo "[错误] 本地缺少镜像: $image_ref"
      exit 1
    fi
  done
}

pull_business_images() {
  local retries="${GHCR_PULL_RETRIES:-3}"
  local delay="${GHCR_PULL_RETRY_DELAY:-15}"

  if [[ "$SKIP_IMAGE_PULL" == "1" ]]; then
    echo "[信息] 已跳过远程拉取业务镜像，改用服务器本地已加载镜像"
    ensure_local_business_images
    return 0
  fi

  for ((i=1; i<=retries; i++)); do
    if docker_compose pull "${BUSINESS_SERVICES[@]}"; then
      return 0
    fi

    if (( i < retries )); then
      echo "[重试] 业务镜像拉取失败，${delay} 秒后重试... ($i/$retries)"
      sleep "$delay"
    fi
  done

  echo "[错误] 多次尝试后仍无法拉取 GHCR 业务镜像"
  exit 1
}

echo "========================================"
echo "  Shuotu ERP GHCR 镜像部署开始"
echo "========================================"
docker_login_with_retry

echo "[1/5] 启动基础设施..."
docker_compose up -d mysql redis rabbitmq
wait_for_mysql
ensure_mysql_root_network_access

echo "[2/5] 拉取最新业务镜像..."
pull_business_images

echo "[3/5] 执行数据库迁移与补表..."
docker_compose run --rm migrator

echo "[4/5] 启动/更新业务服务..."
docker_compose up -d --remove-orphans web admin-web admin-api gateway sync-engine oms wms pms misc oss webhook

echo "[5/5] 当前容器状态"
docker_compose ps

echo "========================================"
echo "  Shuotu ERP GHCR 镜像部署完成"
echo "========================================"
