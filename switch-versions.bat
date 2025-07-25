@echo off
setlocal enabledelayedexpansion

REM Huly Version Switching Script for Windows
REM This script allows you to quickly switch between different versions of frontend and workspace

echo ========================================
echo      Huly Version Switcher
echo ========================================
echo.

REM Check if services are running
docker-compose -f docker-compose.production.yml ps | findstr "Up" >nul 2>&1
if %errorlevel% neq 0 (
    docker-compose -f docker-compose.version.yml ps | findstr "Up" >nul 2>&1
    if %errorlevel% neq 0 (
        echo [ERROR] Huly services are not running. Please start them first with:
        echo   deploy.sh start
        pause
        exit /b 1
    )
)

echo Available version options:
echo   latest    - Latest stable version
echo   staging   - Latest staging version
echo   v0.6.0    - Current stable version
echo   v0.5.0    - Previous stable version
echo   v0.4.0    - Older version
echo   custom    - Enter custom version tag
echo.

set /p frontend_ver="Enter frontend version [latest]: "
if "!frontend_ver!"=="" set frontend_ver=latest

set /p workspace_ver="Enter workspace version [latest]: "
if "!workspace_ver!"=="" set workspace_ver=latest

if "!frontend_ver!"=="custom" (
    set /p frontend_ver="Enter custom frontend version tag: "
)

if "!workspace_ver!"=="custom" (
    set /p workspace_ver="Enter custom workspace version tag: "
)

echo.
echo [INFO] Selected versions:
echo   Frontend: hardcoreeng/front:!frontend_ver!
echo   Workspace: hardcoreeng/workspace:!workspace_ver!
echo.

set /p confirm="Switch to these versions? (y/N): "
if /i not "!confirm!"=="y" (
    echo [WARNING] Version switch cancelled
    pause
    exit /b 0
)

echo [INFO] Switching to new versions...
echo [INFO] Frontend: hardcoreeng/front:!frontend_ver!
echo [INFO] Workspace: hardcoreeng/workspace:!workspace_ver!

REM Stop current services
echo [INFO] Stopping current services...
if exist docker-compose.version.yml (
    docker-compose -f docker-compose.version.yml stop frontend workspace
) else (
    docker-compose -f docker-compose.production.yml stop frontend workspace
)

REM Create new version-specific compose file
echo [INFO] Creating new version configuration...
(
echo services:
echo   # Database
echo   cockroach:
echo     image: cockroachdb/cockroach:latest-v24.2
echo     command: start-single-node --insecure
echo     ports:
echo       - "15432:26257"
echo       - "15433:8080"
echo     volumes:
echo       - cockroach_data:/cockroach/cockroach-data
echo     environment:
echo       - COCKROACH_SKIP_ENABLING_DIAGNOSTIC_REPORTING=true
echo     restart: unless-stopped
echo     networks:
echo       - huly-network
echo.
echo   # Message Queue
echo   redpanda:
echo     image: docker.redpanda.com/redpandadata/redpanda:v24.3.6
echo     command:
echo       - redpanda
echo       - start
echo       - --kafka-addr internal://0.0.0.0:9092,external://0.0.0.0:19092
echo       - --advertise-kafka-addr internal://redpanda:9092,external://localhost:19092
echo       - --pandaproxy-addr internal://0.0.0.0:8082,external://0.0.0.0:18082
echo       - --advertise-pandaproxy-addr internal://redpanda:8082,external://localhost:18082
echo       - --schema-registry-addr internal://0.0.0.0:8081,external://0.0.0.0:18081
echo       - --rpc-addr redpanda:33145
echo       - --advertise-rpc-addr redpanda:33145
echo       - --mode dev-container
echo       - --smp 1
echo       - --default-log-level=info
echo     ports:
echo       - "15081:18081"
echo       - "15082:18082"
echo       - "15092:19092"
echo       - "15044:9644"
echo     volumes:
echo       - redpanda_data:/var/lib/redpanda/data
echo     healthcheck:
echo       test: ['CMD', 'rpk', 'cluster', 'info']
echo       interval: 10s
echo       timeout: 5s
echo       retries: 10
echo     restart: unless-stopped
echo     networks:
echo       - huly-network
echo.
echo   # File Storage
echo   minio:
echo     image: minio/minio:latest
echo     command: server /data --address ":9000" --console-address ":9001"
echo     ports:
echo       - "15100:9000"
echo       - "15101:9001"
echo     volumes:
echo       - minio_data:/data
echo     environment:
echo       - MINIO_ROOT_USER=minioadmin
echo       - MINIO_ROOT_PASSWORD=minioadmin
echo     healthcheck:
echo       test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
echo       interval: 30s
echo       timeout: 20s
echo       retries: 3
echo     restart: unless-stopped
echo     networks:
echo       - huly-network
echo.
echo   # Search Engine
echo   elasticsearch:
echo     image: elasticsearch:7.14.2
echo     ports:
echo       - "15200:9200"
echo     volumes:
echo       - elastic_data:/usr/share/elasticsearch/data
echo     environment:
echo       - discovery.type=single-node
echo       - ES_JAVA_OPTS=-Xms1024m -Xmx1024m
echo       - ELASTICSEARCH_PORT_NUMBER=9200
echo     healthcheck:
echo       test: ["CMD", "curl", "-f", "http://localhost:9200/_cluster/health"]
echo       interval: 20s
echo       retries: 10
echo     restart: unless-stopped
echo     networks:
echo       - huly-network
echo.
echo   # Statistics Service
echo   stats:
echo     image: hardcoreeng/stats:latest
echo     ports:
echo       - "15900:4900"
echo     environment:
echo       - PORT=4900
echo       - SERVER_SECRET=%%SERVER_SECRET%%:-secret}
echo     restart: unless-stopped
echo     networks:
echo       - huly-network
echo.
echo   # Account Service
echo   account:
echo     image: hardcoreeng/account:latest
echo     ports:
echo       - "15000:3000"
echo     depends_on:
echo       - cockroach
echo       - minio
echo       - stats
echo     environment:
echo       - ACCOUNT_PORT=3000
echo       - SERVER_SECRET=%%SERVER_SECRET%%:-secret}
echo       - ADMIN_EMAILS=%%ADMIN_EMAILS%%:-admin@yourdomain.com}
echo       - STATS_URL=http://stats:4900
echo       - WORKSPACE_LIMIT_PER_USER=10000
echo       - DB_URL=postgres://root@cockroach:26257/huly?sslmode=disable
echo       - REGION_INFO=cockroach^|CockroachDB
echo       - TRANSACTOR_URL=ws://workspace:3333
echo       - STORAGE_CONFIG=minio^|minio://minioadmin:minioadmin@minio:9000?region=
echo       - FRONT_URL=%%FRONT_URL%%:-http://localhost:8087}
echo       - MODEL_ENABLED=*
echo       - ACCOUNTS_URL=http://account:3000
echo       - MAIL_URL=%%MAIL_URL%%:-}
echo     restart: unless-stopped
echo     networks:
echo       - huly-network
echo.
echo   # Workspace Service
echo   workspace:
echo     image: hardcoreeng/workspace:!workspace_ver!
echo     ports:
echo       - "15333:3333"
echo     depends_on:
echo       - cockroach
echo       - minio
echo       - stats
echo       - elasticsearch
echo     environment:
echo       - WS_OPERATION=all+backup
echo       - REGION=cockroach
echo       - SERVER_SECRET=%%SERVER_SECRET%%:-secret}
echo       - DB_URL=postgres://root@cockroach:26257/huly?sslmode=disable
echo       - STATS_URL=http://stats:4900
echo       - STORAGE_CONFIG=minio^|minio://minioadmin:minioadmin@minio:9000?region=
echo       - MODEL_ENABLED=*
echo       - ACCOUNTS_URL=http://account:3000
echo       - ELASTIC_URL=http://elasticsearch:9200
echo       - MAIL_URL=%%MAIL_URL%%:-}
echo     restart: unless-stopped
echo     networks:
echo       - huly-network
echo.
echo   # Frontend
echo   frontend:
echo     image: hardcoreeng/front:!frontend_ver!
echo     ports:
echo       - "15087:8080"
echo     depends_on:
echo       - account
echo       - workspace
echo     environment:
echo       - SERVER_PORT=8080
echo       - ACCOUNTS_URL=http://account:3000
echo       - UPLOAD_URL=/files
echo     restart: unless-stopped
echo     networks:
echo       - huly-network
echo.
echo volumes:
echo   cockroach_data:
echo   redpanda_data:
echo   minio_data:
echo   elastic_data:
echo.
echo networks:
echo   huly-network:
echo     driver: bridge
) > docker-compose.version.yml

REM Pull new images
echo [INFO] Pulling new version images...
docker-compose -f docker-compose.version.yml pull frontend workspace

REM Start services with new versions
echo [INFO] Starting services with new versions...
docker-compose -f docker-compose.version.yml up -d frontend workspace

echo [SUCCESS] Version switch completed!
echo.
echo New versions deployed:
echo   Frontend: hardcoreeng/front:!frontend_ver!
echo   Workspace: hardcoreeng/workspace:!workspace_ver!
echo.
echo Access your Huly instance at:
echo   Frontend: http://admin.imploy.com.au:15087

pause 