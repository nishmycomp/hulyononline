#!/bin/bash

# Huly Production Deployment Script
# This script deploys Huly on your cPanel/AlmaLinux server

set -e

echo "🚀 Starting Huly deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default versions
FRONTEND_VERSION="latest"
WORKSPACE_VERSION="latest"

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

# Function to show version options
show_version_options() {
    echo "Available version options:"
    echo "  latest    - Latest stable version (default)"
    echo "  staging   - Latest staging version"
    echo "  v0.6.0    - Specific version tag"
    echo "  v0.5.0    - Previous version"
    echo "  custom    - Enter custom version tag"
}

# Function to select versions
select_versions() {
    echo
    echo "========================================"
    echo "     Version Selection"
    echo "========================================"
    echo
    
    show_version_options
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
    
    read -p "Continue with these versions? (y/N): " confirm
    if [[ ! $confirm =~ ^[Yy]$ ]]; then
        print_warning "Deployment cancelled"
        exit 0
    fi
}

# Function to create version-specific docker-compose file
create_version_compose() {
    print_status "Creating version-specific docker-compose file..."
    
    # Create a temporary docker-compose file with selected versions
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
      - STORAGE_CONFIG=minio|minio:9000?accessKey=minioadmin&secretKey=minioadmin
      - FRONT_URL=\${FRONT_URL:-http://localhost:8087}
      - MODEL_ENABLED=*
      - ACCOUNTS_URL=http://account:3000
      - MAIL_URL=\${MAIL_URL:-}
    restart: unless-stopped
    networks:
      - huly-network

  # Workspace Service
  workspace:
    image: hardcoreeng/workspace:$WORKSPACE_VERSION
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
      - STORAGE_CONFIG=minio|minio:9000?accessKey=minioadmin&secretKey=minioadmin
      - MODEL_ENABLED=*
      - ACCOUNTS_URL=http://account:3000
      - ELASTIC_URL=http://elasticsearch:9200
      - MAIL_URL=\${MAIL_URL:-}
      - FRONT_URL=\${FRONT_URL:-http://localhost:15087}
      - COMMUNICATION_API_ENABLED=true
      - BACKUP_STORAGE=minio
      - BACKUP_BUCKET=huly-backup
    restart: unless-stopped
    networks:
      - huly-network

  # Frontend
  frontend:
    image: hardcoreeng/front:$FRONTEND_VERSION
    ports:
      - "15087:8080"
    depends_on:
      - account
      - workspace
    environment:
      - SERVER_PORT=8080
      - SERVER_SECRET=\${SERVER_SECRET:-secret}
      - ACCOUNTS_URL=http://account:3000
      - STATS_URL=http://stats:4900
      - UPLOAD_URL=/files
      - GMAIL_URL=\${GMAIL_URL:-}
      - MAIL_URL=\${MAIL_URL:-}
      - MINIO_ENDPOINT=minio:9000
      - MINIO_ACCESS_KEY=minioadmin
      - MINIO_SECRET_KEY=minioadmin
      - CALENDAR_URL=http://localhost:8095
      - TELEGRAM_URL=http://localhost:8086
      - REKONI_URL=http://localhost:4004
      - COLLABORATOR_URL=ws://localhost:3078
      - GITHUB_URL=http://localhost:3500
      - PRINT_URL=http://localhost:4005
      - SIGN_URL=http://localhost:4006
      - DESKTOP_UPDATES_URL=https://dist.huly.io
      - DESKTOP_UPDATES_CHANNEL=production
      - BRANDING_URL=http://localhost:15087/branding.json
      - COMMUNICATION_API_ENABLED=true
      - EXCLUDED_APPLICATIONS_FOR_ANONYMOUS=["chunter", "notification"]
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

    print_success "Version-specific docker-compose file created"
}

# Check if Docker is installed
check_docker() {
    print_status "Checking Docker installation..."
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first:"
        echo "  curl -fsSL https://get.docker.com -o get-docker.sh"
        echo "  sudo sh get-docker.sh"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose."
        exit 1
    fi
    
    print_success "Docker is installed"
}

# Check if .env file exists
check_environment() {
    print_status "Checking environment configuration..."
    if [[ ! -f .env ]]; then
        print_warning ".env file not found. Creating from template..."
        cp environment.production .env
        print_warning "Please edit .env file with your production settings before continuing!"
        print_warning "Important: Change SERVER_SECRET, DOMAIN, and ADMIN_EMAILS"
        echo
        echo "Example commands to edit .env:"
        echo "  nano .env"
        echo "  # OR"
        echo "  vi .env"
        echo
        read -p "Press Enter after you've configured .env file..."
    fi
    print_success "Environment configuration found"
}

# Create necessary directories
create_directories() {
    print_status "Creating necessary directories..."
    mkdir -p data/cockroach
    mkdir -p data/minio
    mkdir -p data/elasticsearch
    mkdir -p data/redpanda
    mkdir -p logs
    print_success "Directories created"
}

# Pull latest images
pull_images() {
    print_status "Pulling Docker images for selected versions..."
    docker-compose -f docker-compose.version.yml pull
    print_success "Images pulled successfully"
}

# Start services
start_services() {
    print_status "Starting Huly services with selected versions..."
    docker-compose -f docker-compose.version.yml up -d
    print_success "Services started"
}

# Check service health
check_health() {
    print_status "Checking service health..."
    sleep 10
    
    # Check if containers are running
    if docker-compose -f docker-compose.version.yml ps | grep -q "Up"; then
        print_success "Services are running"
        echo
        echo "🎉 Huly has been deployed successfully!"
        echo
        echo "Deployed versions:"
        echo "  Frontend: hardcoreeng/front:$FRONTEND_VERSION"
        echo "  Workspace: hardcoreeng/workspace:$WORKSPACE_VERSION"
        echo
        echo "Access your Huly instance at:"
        echo "  Frontend: http://admin.imploy.com.au:15087"
        echo "  Admin Panel: http://admin.imploy.com.au:15433 (CockroachDB)"
        echo "  MinIO Console: http://admin.imploy.com.au:15101"
        echo
        echo "Default MinIO credentials:"
        echo "  Username: minioadmin"
        echo "  Password: minioadmin"
        echo
        print_warning "Remember to:"
        print_warning "1. Configure your firewall to allow the necessary ports"
        print_warning "2. Set up SSL/TLS certificates for production"
        print_warning "3. Change default passwords"
        print_warning "4. Configure email settings in .env if needed"
    else
        print_error "Some services failed to start. Check logs with:"
        echo "  docker-compose -f docker-compose.version.yml logs"
    fi
}

# Main deployment process
main() {
    echo "========================================"
    echo "     Huly Production Deployment"
    echo "========================================"
    echo
    
    select_versions
    check_docker
    check_environment
    create_directories
    create_version_compose
    pull_images
    start_services
    check_health
}

# Help function
show_help() {
    echo "Huly Deployment Script"
    echo "Usage: $0 [command]"
    echo
    echo "Commands:"
    echo "  deploy   - Full deployment with version selection (default)"
    echo "  start    - Start services"
    echo "  stop     - Stop services"
    echo "  restart  - Restart services"
    echo "  logs     - View logs"
    echo "  status   - Check service status"
    echo "  update   - Update to latest images"
    echo "  help     - Show this help"
    echo
    echo "Version Options:"
    echo "  latest   - Latest stable version"
    echo "  staging  - Latest staging version"
    echo "  v0.6.0   - Specific version tag"
    echo "  custom   - Enter custom version tag"
}

# Handle commands
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "start")
        if [[ -f docker-compose.version.yml ]]; then
            print_status "Starting services..."
            docker-compose -f docker-compose.version.yml start
        else
            print_status "Starting services with default versions..."
            docker-compose -f docker-compose.production.yml start
        fi
        ;;
    "stop")
        if [[ -f docker-compose.version.yml ]]; then
            print_status "Stopping services..."
            docker-compose -f docker-compose.version.yml stop
        else
            print_status "Stopping services..."
            docker-compose -f docker-compose.production.yml stop
        fi
        ;;
    "restart")
        if [[ -f docker-compose.version.yml ]]; then
            print_status "Restarting services..."
            docker-compose -f docker-compose.version.yml restart
        else
            print_status "Restarting services..."
            docker-compose -f docker-compose.production.yml restart
        fi
        ;;
    "logs")
        if [[ -f docker-compose.version.yml ]]; then
            docker-compose -f docker-compose.version.yml logs -f
        else
            docker-compose -f docker-compose.production.yml logs -f
        fi
        ;;
    "status")
        if [[ -f docker-compose.version.yml ]]; then
            docker-compose -f docker-compose.version.yml ps
        else
            docker-compose -f docker-compose.production.yml ps
        fi
        ;;
    "update")
        print_status "Updating images..."
        if [[ -f docker-compose.version.yml ]]; then
            docker-compose -f docker-compose.version.yml pull
            docker-compose -f docker-compose.version.yml up -d
        else
            docker-compose -f docker-compose.production.yml pull
            docker-compose -f docker-compose.production.yml up -d
        fi
        print_success "Update complete"
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