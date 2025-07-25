#!/bin/bash

# Local Huly Testing Script
# This script tests the Huly deployment on your local Windows machine

echo "🧪 Starting Huly Local Test..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

echo "✅ Docker is running"

# Use local environment
if [[ -f environment.local ]]; then
    echo "📝 Using local environment configuration"
    cp environment.local .env
else
    echo "❌ environment.local not found. Please create it first."
    exit 1
fi

# Pull images first
echo "📥 Pulling Docker images..."
docker compose -f docker-compose.production.yml pull

# Start services
echo "🚀 Starting Huly services locally..."
docker compose -f docker-compose.production.yml up -d

# Wait for services to start
echo "⏳ Waiting for services to initialize..."
sleep 30

# Check service status
echo "🔍 Checking service status..."
docker compose -f docker-compose.production.yml ps

echo ""
echo "🎉 Local test deployment started!"
echo ""
echo "Access Huly at:"
echo "  🌐 Frontend: http://localhost:8087"
echo "  🗄️  Database Admin: http://localhost:8089"
echo "  📁 File Storage: http://localhost:9001"
echo ""
echo "To stop the test deployment:"
echo "  docker compose -f docker-compose.production.yml down"
echo ""
echo "To view logs:"
echo "  docker compose -f docker-compose.production.yml logs -f" 