# 本地 Docker 基础设施部署说明（MySQL + Redis）

## 1. 目标

将系统依赖的基础设施（MySQL、Redis）单独部署到本机 Docker，并自动导入数据库 SQL：

- `services/database/init.sql`
- `services/database/courier_reports.sql`
- `services/database/pda_login_enhancement.sql`

> 注意：MySQL 官方镜像只会在**首次初始化数据目录**时执行 `/docker-entrypoint-initdb.d` 下的 SQL。

---

## 2. 新增文件

- `docker-compose.infra.yml`：基础设施编排（仅 MySQL + Redis）
- `start-infra.bat`：一键启动基础设施
- `reset-infra.bat`：清空卷后重建（用于重新导入 SQL）

---

## 3. 启动方式

在项目根目录执行（或直接双击）：

```bat
start-infra.bat
```

默认信息：

- MySQL：`localhost:3306`
- Redis：`localhost:6380`（容器内部仍为 6379）
- MySQL Root 密码：`root123`
- 默认业务库：`eer`

---

## 4. 如何重新导入 SQL

如果你修改了 SQL 文件，或需要全量重置：

```bat
reset-infra.bat
```

该脚本会执行：

1. `down -v` 删除容器和数据卷
2. `up -d` 重新启动
3. MySQL 首次初始化时重新执行 3 个 SQL 文件

---

## 5. 服务端环境变量建议

请确保 `services/.env`（或各服务 `.env`）配置如下：

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=root123
MYSQL_DATABASE=eer

REDIS_HOST=localhost
REDIS_PORT=6380
REDIS_PASSWORD=
```

---

## 6. 快速验证

### 6.1 查看容器状态

```bash
docker compose -f docker-compose.infra.yml ps
```

### 6.2 检查 MySQL 中表是否存在

```bash
docker exec -it eer-mysql mysql -uroot -proot123 -e "USE eer; SHOW TABLES;"
```

### 6.3 检查 Redis

```bash
docker exec -it eer-redis redis-cli ping
```

返回 `PONG` 即正常。

