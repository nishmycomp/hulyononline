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
    print_status "Pulling latest Docker images..."
    docker-compose -f docker-compose.production.yml pull
    print_success "Images pulled successfully"
}

# Start services
start_services() {
    print_status "Starting Huly services..."
    docker-compose -f docker-compose.production.yml up -d
    print_success "Services started"
}

# Check service health
check_health() {
    print_status "Checking service health..."
    sleep 10
    
    # Check if containers are running
    if docker-compose -f docker-compose.production.yml ps | grep -q "Up"; then
        print_success "Services are running"
        echo
        echo "🎉 Huly has been deployed successfully!"
        echo
        echo "Access your Huly instance at:"
        echo "  Frontend: http://your-domain.com:8087"
        echo "  Admin Panel: http://your-domain.com:8089 (CockroachDB)"
        echo "  MinIO Console: http://your-domain.com:9011"
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
        echo "  docker-compose -f docker-compose.production.yml logs"
    fi
}

# Main deployment process
main() {
    echo "========================================"
    echo "     Huly Production Deployment"
    echo "========================================"
    echo
    
    check_docker
    check_environment
    create_directories
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
    echo "  deploy   - Full deployment (default)"
    echo "  start    - Start services"
    echo "  stop     - Stop services"
    echo "  restart  - Restart services"
    echo "  logs     - View logs"
    echo "  status   - Check service status"
    echo "  update   - Update to latest images"
    echo "  help     - Show this help"
}

# Handle commands
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "start")
        print_status "Starting services..."
        docker-compose -f docker-compose.production.yml start
        ;;
    "stop")
        print_status "Stopping services..."
        docker-compose -f docker-compose.production.yml stop
        ;;
    "restart")
        print_status "Restarting services..."
        docker-compose -f docker-compose.production.yml restart
        ;;
    "logs")
        docker-compose -f docker-compose.production.yml logs -f
        ;;
    "status")
        docker-compose -f docker-compose.production.yml ps
        ;;
    "update")
        print_status "Updating images..."
        docker-compose -f docker-compose.production.yml pull
        docker-compose -f docker-compose.production.yml up -d
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