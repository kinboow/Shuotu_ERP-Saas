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
RESET_MYSQL_ON_AUTH_FAILURE="${RESET_MYSQL_ON_AUTH_FAILURE:-0}"
DEPLOY_SCRIPT_VERSION="2026-05-10-mysql-runtime-password-fix"

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

get_mysql_container_id() {
  docker_compose ps -q mysql
}

get_mysql_runtime_password() {
  local mysql_id

  mysql_id="$(get_mysql_container_id)"
  if [[ -z "$mysql_id" ]]; then
    return 0
  fi

  docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$mysql_id" \
    | grep '^MYSQL_ROOT_PASSWORD=' \
    | head -n 1 \
    | cut -d= -f2- || true
}

can_login_mysql_root() {
  local password="$1"

  docker_compose exec -T mysql mysql -uroot "-p${password}" -e "SELECT 1" >/dev/null 2>&1
}

reset_mysql_volume() {
  local volume_name

  volume_name="${COMPOSE_PROJECT_NAME:-shuotu-erp}_mysql-data"

  echo "[警告] RESET_MYSQL_ON_AUTH_FAILURE=1，开始重建 MySQL 数据卷: ${volume_name}"
  echo "[警告] 这会清空当前 MySQL 数据，仅适合首次部署或确认可重建的环境"
  docker_compose stop mysql >/dev/null 2>&1 || true
  docker_compose rm -f mysql >/dev/null 2>&1 || true
  docker volume rm "$volume_name" >/dev/null 2>&1 || true
  docker_compose up -d mysql
  wait_for_mysql
}

ensure_mysql_root_network_access() {
  local login_password
  local escaped_password
  local runtime_password
  local needs_mysql_recreate=0

  login_password="$MYSQL_ROOT_PASSWORD"
  runtime_password="$(get_mysql_runtime_password)"
  escaped_password="$(sql_escape "$MYSQL_ROOT_PASSWORD")"

  if ! can_login_mysql_root "$login_password"; then
    if [[ -n "$runtime_password" && "$runtime_password" != "$login_password" ]] && can_login_mysql_root "$runtime_password"; then
      echo "[警告] 当前 .env 中的 MYSQL_ROOT_PASSWORD 与运行中 MySQL 容器不一致，先使用容器现有密码修复授权并同步密码"
      login_password="$runtime_password"
      needs_mysql_recreate=1
    else
      if [[ "$RESET_MYSQL_ON_AUTH_FAILURE" == "1" ]]; then
        reset_mysql_volume
        runtime_password="$(get_mysql_runtime_password)"
        login_password="$MYSQL_ROOT_PASSWORD"
        if ! can_login_mysql_root "$login_password"; then
          echo "[错误] MySQL 数据卷重建后仍无法使用当前 .env 中的 MYSQL_ROOT_PASSWORD 登录"
          exit 1
        fi
      else
      echo "[错误] 无法使用当前 .env 中的 MYSQL_ROOT_PASSWORD 登录 MySQL，也无法使用运行中容器的密码回退登录"
      echo "[提示] 请检查服务器 docker/.env.ghcr 中的 MYSQL_ROOT_PASSWORD，或手动重建 MySQL 容器/数据卷"
      echo "[提示] 如果这是首次部署且可以清空数据库，请用 RESET_MYSQL_ON_AUTH_FAILURE=1 重新运行部署"
      exit 1
      fi
    fi
  fi

  if [[ -n "$runtime_password" && "$runtime_password" != "$MYSQL_ROOT_PASSWORD" ]]; then
    needs_mysql_recreate=1
  fi

  echo "[信息] 修复 MySQL root 容器网络访问授权..."
  docker_compose exec -T mysql mysql -uroot "-p${login_password}" <<SQL
CREATE USER IF NOT EXISTS 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '${escaped_password}';
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '${escaped_password}';
CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED WITH mysql_native_password BY '${escaped_password}';
ALTER USER 'root'@'%' IDENTIFIED WITH mysql_native_password BY '${escaped_password}';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'localhost' WITH GRANT OPTION;
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;
FLUSH PRIVILEGES;
SQL

  if [[ "$needs_mysql_recreate" == "1" ]]; then
    echo "[信息] 重新创建 MySQL 容器以同步最新环境变量..."
    docker_compose up -d --no-deps --force-recreate mysql
    wait_for_mysql
  fi
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
echo "  Deploy Script Version: $DEPLOY_SCRIPT_VERSION"
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
