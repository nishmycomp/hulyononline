#!/bin/bash

# Huly Version Switching Script
# This script allows you to quickly switch between different versions of frontend and workspace

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show available versions
show_available_versions() {
    echo "Available version options:"
    echo "  latest    - Latest stable version"
    echo "  staging   - Latest staging version"
    echo "  v0.6.0    - Current stable version"
    echo "  v0.5.0    - Previous stable version"
    echo "  v0.4.0    - Older version"
    echo "  custom    - Enter custom version tag"
}

# Function to check if services are running
check_services_running() {
    if [[ -f docker-compose.version.yml ]]; then
        docker-compose -f docker-compose.version.yml ps | grep -q "Up"
    else
        docker-compose -f docker-compose.production.yml ps | grep -q "Up"
    fi
}

# Function to switch versions
switch_versions() {
    local frontend_version=$1
    local workspace_version=$2
    
    print_status "Switching to new versions..."
    print_status "Frontend: hardcoreeng/front:$frontend_version"
    print_status "Workspace: hardcoreeng/workspace:$workspace_version"
    
    # Stop current services
    print_status "Stopping current services..."
    if [[ -f docker-compose.version.yml ]]; then
        docker-compose -f docker-compose.version.yml stop frontend workspace
    else
        docker-compose -f docker-compose.production.yml stop frontend workspace
    fi
    
    # Create new version-specific compose file
    print_status "Creating new version configuration..."
    cat > docker-compose.version.yml << EOF
services:
  # Database
  cockroach:
    image: cockroachdb/cockroach:latest-v24.2
    command: start-single-node --insecure
    ports:
      - "15432:26257"
      - "15433:8080"
    volumes:
      - cockroach_data:/cockroach/cockroach-data
    environment:
      - COCKROACH_SKIP_ENABLING_DIAGNOSTIC_REPORTING=true
    restart: unless-stopped
    networks:
      - huly-network

  # Message Queue
  redpanda:
    image: docker.redpanda.com/redpandadata/redpanda:v24.3.6
    command:
      - redpanda
      - start
      - --kafka-addr internal://0.0.0.0:9092,external://0.0.0.0:19092
      - --advertise-kafka-addr internal://redpanda:9092,external://localhost:19092
      - --pandaproxy-addr internal://0.0.0.0:8082,external://0.0.0.0:18082
      - --advertise-pandaproxy-addr internal://redpanda:8082,external://localhost:18082
      - --schema-registry-addr internal://0.0.0.0:8081,external://0.0.0.0:18081
      - --rpc-addr redpanda:33145
      - --advertise-rpc-addr redpanda:33145
      - --mode dev-container
      - --smp 1
      - --default-log-level=info
    ports:
      - "15081:18081"
      - "15082:18082"
      - "15092:19092"
      - "15044:9644"
    volumes:
      - redpanda_data:/var/lib/redpanda/data
    healthcheck:
      test: ['CMD', 'rpk', 'cluster', 'info']
      interval: 10s
      timeout: 5s
      retries: 10
    restart: unless-stopped
    networks:
      - huly-network

  # File Storage
  minio:
    image: minio/minio:latest
    command: server /data --address ":9000" --console-address ":9001"
    ports:
      - "15100:9000"
      - "15101:9001"
    volumes:
      - minio_data:/data
    environment:
      - MINIO_ROOT_USER=minioadmin
      - MINIO_ROOT_PASSWORD=minioadmin
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3
    restart: unless-stopped
    networks:
      - huly-network

  # Search Engine
  elasticsearch:
    image: elasticsearch:7.14.2
    ports:
      - "15200:9200"
    volumes:
      - elastic_data:/usr/share/elasticsearch/data
    environment:
      - discovery.type=single-node
      - ES_JAVA_OPTS=-Xms1024m -Xmx1024m
      - ELASTICSEARCH_PORT_NUMBER=9200
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9200/_cluster/health"]
      interval: 20s
      retries: 10
    restart: unless-stopped
    networks:
      - huly-network

  # Statistics Service
  stats:
    image: hardcoreeng/stats:latest
    ports:
      - "15900:4900"
    environment:
      - PORT=4900
      - SERVER_SECRET=\${SERVER_SECRET:-secret}
    restart: unless-stopped
    networks:
      - huly-network

  # Account Service
  account:
    image: hardcoreeng/account:latest
    ports:
      - "15000:3000"
    depends_on:
      - cockroach
      - minio
      - stats
    environment:
      - ACCOUNT_PORT=3000
      - SERVER_SECRET=\${SERVER_SECRET:-secret}
      - ADMIN_EMAILS=\${ADMIN_EMAILS:-admin@yourdomain.com}
      - STATS_URL=http://stats:4900
      - WORKSPACE_LIMIT_PER_USER=10000
      - DB_URL=postgres://root@cockroach:26257/huly?sslmode=disable
      - REGION_INFO=cockroach|CockroachDB
      - TRANSACTOR_URL=ws://workspace:3333
      - STORAGE_CONFIG=minio|minio://minioadmin:minioadmin@minio:9000?region=
      - FRONT_URL=\${FRONT_URL:-http://localhost:8087}
      - MODEL_ENABLED=*
      - ACCOUNTS_URL=http://account:3000
      - MAIL_URL=\${MAIL_URL:-}
    restart: unless-stopped
    networks:
      - huly-network

  # Workspace Service
  workspace:
    image: hardcoreeng/workspace:$workspace_version
    ports:
      - "15333:3333"
    depends_on:
      - cockroach
      - minio
      - stats
      - elasticsearch
    environment:
      - WS_OPERATION=all+backup
      - REGION=cockroach
      - SERVER_SECRET=\${SERVER_SECRET:-secret}
      - DB_URL=postgres://root@cockroach:26257/huly?sslmode=disable
      - STATS_URL=http://stats:4900
      - STORAGE_CONFIG=minio|minio://minioadmin:minioadmin@minio:9000?region=
      - MODEL_ENABLED=*
      - ACCOUNTS_URL=http://account:3000
      - ELASTIC_URL=http://elasticsearch:9200
      - MAIL_URL=\${MAIL_URL:-}
    restart: unless-stopped
    networks:
      - huly-network

  # Frontend
  frontend:
    image: hardcoreeng/front:$frontend_version
    ports:
      - "15087:8080"
    depends_on:
      - account
      - workspace
    environment:
      - SERVER_PORT=8080
      - ACCOUNTS_URL=http://account:3000
      - UPLOAD_URL=/files
    restart: unless-stopped
    networks:
      - huly-network

volumes:
  cockroach_data:
  redpanda_data:
  minio_data:
  elastic_data:

networks:
  huly-network:
    driver: bridge
EOF

    # Pull new images
    print_status "Pulling new version images..."
    docker-compose -f docker-compose.version.yml pull frontend workspace
    
    # Start services with new versions
    print_status "Starting services with new versions..."
    docker-compose -f docker-compose.version.yml up -d frontend workspace
    
    print_success "Version switch completed!"
    echo
    echo "New versions deployed:"
    echo "  Frontend: hardcoreeng/front:$frontend_version"
    echo "  Workspace: hardcoreeng/workspace:$workspace_version"
    echo
    echo "Access your Huly instance at:"
    echo "  Frontend: http://admin.imploy.com.au:15087"
}

# Main script
main() {
    echo "========================================"
    echo "     Huly Version Switcher"
    echo "========================================"
    echo
    
    # Check if services are running
    if ! check_services_running; then
        print_error "Huly services are not running. Please start them first with:"
        echo "  ./deploy.sh start"
        exit 1
    fi
    
    show_available_versions
    echo
    
    read -p "Enter frontend version [latest]: " frontend_ver
    FRONTEND_VERSION=${frontend_ver:-latest}
    
    read -p "Enter workspace version [latest]: " workspace_ver
    WORKSPACE_VERSION=${workspace_ver:-latest}
    
    if [ "$FRONTEND_VERSION" = "custom" ]; then
        read -p "Enter custom frontend version tag: " FRONTEND_VERSION
    fi
    
    if [ "$WORKSPACE_VERSION" = "custom" ]; then
        read -p "Enter custom workspace version tag: " WORKSPACE_VERSION
    fi
    
    echo
    print_status "Selected versions:"
    echo "  Frontend: hardcoreeng/front:$FRONTEND_VERSION"
    echo "  Workspace: hardcoreeng/workspace:$WORKSPACE_VERSION"
    echo
    
    read -p "Switch to these versions? (y/N): " confirm
    if [[ ! $confirm =~ ^[Yy]$ ]]; then
        print_warning "Version switch cancelled"
        exit 0
    fi
    
    switch_versions "$FRONTEND_VERSION" "$WORKSPACE_VERSION"
}

# Help function
show_help() {
    echo "Huly Version Switcher"
    echo "Usage: $0 [command]"
    echo
    echo "Commands:"
    echo "  switch   - Switch to different versions (default)"
    echo "  status   - Show current version status"
    echo "  help     - Show this help"
    echo
    echo "Version Options:"
    echo "  latest   - Latest stable version"
    echo "  staging  - Latest staging version"
    echo "  v0.6.0   - Current stable version"
    echo "  v0.5.0   - Previous stable version"
    echo "  custom   - Enter custom version tag"
}

# Handle commands
case "${1:-switch}" in
    "switch")
        main
        ;;
    "status")
        print_status "Current service status:"
        if [[ -f docker-compose.version.yml ]]; then
            docker-compose -f docker-compose.version.yml ps
        else
            docker-compose -f docker-compose.production.yml ps
        fi
        ;;
    "help")
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac 